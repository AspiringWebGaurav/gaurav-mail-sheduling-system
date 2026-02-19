import * as admin from "firebase-admin";
import { selectProvider, incrementProviderUsage, recordProviderSuccess, recordProviderFailure } from "./providerBalancer";
import { sendEmail } from "./emailSender";
import { renderEmailTemplate } from "./emailTemplateRenderer";
import { systemTemplates, systemThemes } from "./lib/emailSystem";
import { captureToDisasterBank } from "./disasterBank";
import { logMailAction } from "./auditService";

const MAX_LATE_MINUTES = 10;
const MAX_ATTEMPTS = 3;
const THROTTLE_MS = 1000; // Anti-abuse throttle between sends
const BATCH_LIMIT = 50;   // Max reminders per invocation

// Unique invocation ID for claim ownership tracking
const INVOCATION_ID = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export async function processReminders() {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    // Query pending reminders that are due
    const query = db
        .collection("scheduledReminders")
        .where("status", "==", "pending")
        .where("scheduledTime", "<=", now)
        .limit(BATCH_LIMIT);

    const snap = await query.get();
    if (snap.empty) return;

    console.log(JSON.stringify({
        level: 'INFO',
        event: 'SCHEDULER_START',
        count: snap.size,
        message: `Scheduler: Processing ${snap.size} due reminders`
    }));

    for (const doc of snap.docs) {
        const reminder = doc.data();

        // ═══ IDEMPOTENCY: Skip already-processed (prevents double-send on concurrent invocations) ═══
        if (reminder.processedAt) continue;

        // ═══ TRANSACTION LOCK: Atomically claim this reminder to prevent race conditions ═══
        let claimed = false;
        try {
            claimed = await db.runTransaction(async (txn) => {
                const freshSnap = await txn.get(doc.ref);
                const freshData = freshSnap.data();
                if (!freshData || freshData.status !== "pending" || freshData.processedAt) {
                    return false; // Already claimed by another invocation
                }
                txn.update(doc.ref, {
                    status: "processing",
                    claimedAt: admin.firestore.FieldValue.serverTimestamp(),
                    claimedBy: INVOCATION_ID,
                });
                return true;
            });
        } catch (txnErr) {
            console.warn(JSON.stringify({
                level: 'WARN',
                event: 'CLAIM_FAILED',
                reminderId: doc.id,
                error: txnErr instanceof Error ? txnErr.message : String(txnErr)
            }));
            continue; // Skip — another invocation is handling it
        }

        if (!claimed) {
            continue; // Already taken by another function instance
        }

        // ═══ LATE CHECK: Expire if too old ═══
        const scheduledTime = reminder.scheduledTime.toDate();
        const minutesLate = (Date.now() - scheduledTime.getTime()) / (1000 * 60);

        if (minutesLate > MAX_LATE_MINUTES) {
            await doc.ref.update({
                status: "expired_late",
                failureReason: `Expired: ${Math.round(minutesLate)} minutes late (limit: ${MAX_LATE_MINUTES})`,
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(JSON.stringify({
                level: 'INFO',
                event: 'REMINDER_EXPIRED',
                reminderId: doc.id,
                minutesLate: Math.round(minutesLate),
                message: `Reminder ${doc.id} expired (${Math.round(minutesLate)} min late)`
            }));
            continue;
        }

        // ═══ RETRY LIMIT CHECK ═══
        if (reminder.attempts >= MAX_ATTEMPTS) {
            await doc.ref.update({
                status: "failed",
                failureReason: `Max attempts (${MAX_ATTEMPTS}) exceeded`,
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // ═══ DISASTER BANK: Capture max-attempts failure ═══
            try {
                await captureToDisasterBank(
                    doc.id,
                    reminder as Record<string, unknown>,
                    "max_attempts_exceeded",
                    [reminder.failureReason || "Unknown", `Max attempts (${MAX_ATTEMPTS}) exceeded`]
                );
            } catch (dbErr) {
                console.error(`Failed to capture to Disaster Bank: ${doc.id}`, dbErr);
            }
            continue;
        }

        // ═══ PROVIDER SELECTION (balanced, lowest-usage first) ═══
        const provider = await selectProvider();
        if (!provider) {
            await doc.ref.update({
                status: "failed",
                failureReason: "quota_exceeded",
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // ═══ DISASTER BANK: Capture provider exhaustion ═══
            try {
                await captureToDisasterBank(
                    doc.id,
                    reminder as Record<string, unknown>,
                    "all_providers_exhausted",
                    [reminder.failureReason || "N/A", "All providers quota exhausted"]
                );
            } catch (dbErr) {
                console.error(`Failed to capture to Disaster Bank: ${doc.id}`, dbErr);
            }
            console.error(JSON.stringify({
                level: 'ERROR',
                event: 'PROVIDERS_EXHAUSTED',
                reminderId: doc.id,
                message: `Reminder ${doc.id} failed: all providers exhausted`
            }));
            continue;
        }

        // ═══ USER DAILY QUOTA CHECK (200/user) ═══
        const dateKey = new Date().toISOString().split('T')[0];
        const userId = reminder.userId || 'system';
        const usageRef = db.collection('users').doc(userId).collection('usage').doc(dateKey);

        try {
            const usageSnap = await usageRef.get();
            const currentUsage = usageSnap.exists ? (usageSnap.data()?.count || 0) : 0;

            if (currentUsage >= 200) {
                await doc.ref.update({
                    status: "failed",
                    failureReason: "daily_quota_exceeded",
                    processedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                await usageRef.set({
                    failedCount: admin.firestore.FieldValue.increment(1),
                    lastFailedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                console.error(JSON.stringify({
                    level: 'ERROR',
                    event: 'QUOTA_EXCEEDED',
                    reminderId: doc.id,
                    userId: userId,
                    message: `Reminder ${doc.id} failed: Daily quota exceeded for ${userId}`
                }));
                continue;
            }
        } catch (e) {
            console.warn('Quota check warning:', e);
            // Proceed — don't block sends on quota read errors
        }

        // ═══ EMAIL RENDERING & SENDING ═══
        try {
            // Template Resolution (System → DB → Default)
            let layoutType = "card";
            let subjectFormat = "Reminder: {{eventTitle}}";

            if (reminder.templateId) {
                if (reminder.templateId.startsWith('sys_')) {
                    const sysT = systemTemplates.find((t: { id: string }) => t.id === reminder.templateId);
                    if (sysT) {
                        layoutType = sysT.layoutType;
                        subjectFormat = sysT.subjectFormat;
                    }
                } else {
                    try {
                        const tDoc = await db.collection("emailTemplates").doc(reminder.templateId).get();
                        if (tDoc.exists) {
                            const tData = tDoc.data();
                            layoutType = tData?.layoutType || "card";
                            subjectFormat = tData?.subjectFormat || subjectFormat;
                        }
                    } catch { /* fallback to defaults */ }
                }
            }

            // Theme Resolution (System → DB → Default)
            let themeColors = undefined;

            if (reminder.themeId) {
                if (reminder.themeId.startsWith('sys_')) {
                    const sysTh = systemThemes.find((t: { id: string }) => t.id === reminder.themeId);
                    if (sysTh) {
                        themeColors = {
                            primaryColor: sysTh.primaryColor,
                            secondaryColor: sysTh.secondaryColor,
                            backgroundColor: sysTh.backgroundColor,
                            textColor: sysTh.textColor,
                            borderRadius: sysTh.borderRadius,
                        };
                    }
                } else {
                    try {
                        const thDoc = await db.collection("emailThemes").doc(reminder.themeId).get();
                        if (thDoc.exists) {
                            const th = thDoc.data();
                            themeColors = {
                                primaryColor: th?.primaryColor,
                                secondaryColor: th?.secondaryColor,
                                backgroundColor: th?.backgroundColor,
                                textColor: th?.textColor,
                                borderRadius: th?.borderRadius,
                            };
                        }
                    } catch { /* fallback to defaults */ }
                }
            }

            // Subject line resolution
            const emailSubject = subjectFormat
                .replace(/\{\{eventTitle\}\}/g, reminder.eventTitle || 'Event')
                .replace(/\{\{eventTime\}\}/g, scheduledTime.toLocaleString());

            // Message resolution: user custom > template default > system default
            const rawMessage = reminder.customMessage || `Your event "${reminder.eventTitle}" is starting soon!`;
            const resolvedMessage = rawMessage
                .replace(/\{\{eventTitle\}\}/g, reminder.eventTitle || 'Event')
                .replace(/\{\{eventTime\}\}/g, scheduledTime.toLocaleString())
                .replace(/\{\{recipientName\}\}/g, "there")
                .replace(/\{\{location\}\}/g, reminder.location || "TBD");

            // Render full HTML email
            const htmlContent = renderEmailTemplate(layoutType, {
                eventTitle: reminder.eventTitle,
                eventTime: scheduledTime.toLocaleString(),
                eventLocation: reminder.location,
                message: resolvedMessage,
            }, themeColors);

            // ═══ SEND EMAIL ═══
            await sendEmail(provider, {
                to_email: reminder.email,
                from_name: reminder.senderName || "GMSS System",
                reply_to_email: reminder.senderEmail || undefined,
                event_title: reminder.eventTitle,
                event_id: reminder.eventId,
                scheduled_time: scheduledTime.toISOString(),
                htmlContent,
                subject: emailSubject,
                customTitle: emailSubject,
            });

            // ═══ SUCCESS: Mark sent (atomic batch) ═══
            const batch = db.batch();

            // 1. Update Reminder Status
            batch.update(doc.ref, {
                status: "sent",
                providerUsed: provider.serviceId,
                attempts: admin.firestore.FieldValue.increment(1),
                lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // 2. Increment User Daily Quota
            // Check if usage doc exists is hard in batch without reading first (which we did earlier).
            // We'll use set with merge: true which is safe.
            batch.set(usageRef, {
                count: admin.firestore.FieldValue.increment(1),
                sentCount: admin.firestore.FieldValue.increment(1),
                lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

            await batch.commit();

            // 3. AUDIT LOG (Success)
            // Fire-and-forget audit log to keep main flow fast, but await it to ensure function doesn't terminate early
            await logMailAction({
                action: 'SEND_SUCCESS',
                status: 'SENT',
                reminderId: doc.id,
                eventId: reminder.eventId,
                eventTitle: reminder.eventTitle,
                userId: userId,
                recipientEmail: reminder.email,
                recipientName: reminder.participantName || '', // If available in future
                provider: provider.serviceId,
                templateId: reminder.templateId,
                idempotencyKey: reminder.idempotencyKey
            });

            // Increment provider daily usage + reset circuit breaker (fire and forget / separate)
            await incrementProviderUsage(provider.id);
            await recordProviderSuccess(provider.id);

            console.log(JSON.stringify({
                level: 'INFO',
                event: 'REMINDER_SENT',
                reminderId: doc.id,
                eventId: reminder.eventId,
                provider: provider.serviceId,
                attempt: (reminder.attempts || 0) + 1,
                message: `Reminder ${doc.id} sent via ${provider.serviceId}`
            }));

            // ═══ ANTI-ABUSE THROTTLE ═══
            await new Promise((r) => setTimeout(r, THROTTLE_MS));

        } catch (err) {
            // ═══ FAILURE: Track attempt, keep pending for retry ═══
            const failReason = err instanceof Error ? err.message : "Unknown error";
            await doc.ref.update({
                status: "pending", // Revert to pending for retry
                attempts: admin.firestore.FieldValue.increment(1),
                lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
                failureReason: `[ERR_SEND] ${failReason}`,
                processedAt: admin.firestore.FieldValue.delete(), // Use delete() not null — avoids false positives
                claimedAt: null,   // Release the claim
                claimedBy: null,   // Release ownership
            });

            // Track failed in user usage
            try {
                await usageRef.set({
                    failedCount: admin.firestore.FieldValue.increment(1),
                    lastFailedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            } catch { /* best effort */ }

            // AUDIT LOG (Failure)
            await logMailAction({
                action: 'SEND_FAILURE',
                status: 'FAILED',
                reminderId: doc.id,
                eventId: reminder.eventId,
                eventTitle: reminder.eventTitle,
                userId: userId,
                recipientEmail: reminder.email,
                provider: provider?.serviceId || 'unknown',
                errorMessage: failReason,
                templateId: reminder.templateId,
                idempotencyKey: reminder.idempotencyKey
            });

            console.error(JSON.stringify({
                level: 'ERROR',
                event: 'SEND_FAILED',
                reminderId: doc.id,
                reason: failReason,
                message: `Reminder ${doc.id} failed attempt (${failReason})`
            }));

            // Track provider failure for circuit breaker
            try { await recordProviderFailure(provider.id); } catch { /* best effort */ }
        }
    }
}

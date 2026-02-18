import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/admin';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const TOKEN_INVITES_COL = 'tokenInvites';
const INVITE_LOGS_COL = 'inviteExecutionLogs';

function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

async function logInviteAction(data: {
    inviteId: string;
    action: string;
    metadata?: Record<string, unknown>;
}) {
    try {
        await adminDb.collection(INVITE_LOGS_COL).add({
            ...data,
            timestamp: FieldValue.serverTimestamp(),
        });
    } catch (e) {
        console.error('[InviteLog] Failed to write log:', e);
    }
}

/**
 * Complete relational cleanup for a consumed/expired invite.
 * Deletes: tokenInvites doc, execution logs, in-app invitation.
 * Best-effort — failures never propagate.
 */
async function cleanupInviteData(inviteId: string): Promise<void> {
    try {
        // 1. Delete execution logs for this invite
        const logsSnap = await adminDb.collection(INVITE_LOGS_COL)
            .where('inviteId', '==', inviteId)
            .get();
        const batch = adminDb.batch();
        logsSnap.docs.forEach((doc) => batch.delete(doc.ref));

        // 2. Get invite data before deletion (for in-app invitation cleanup)
        const inviteSnap = await adminDb.collection(TOKEN_INVITES_COL).doc(inviteId).get();
        const inviteData = inviteSnap.data();

        // 3. Delete the tokenInvites document
        batch.delete(adminDb.collection(TOKEN_INVITES_COL).doc(inviteId));

        // 4. Delete corresponding in-app invitation if exists
        if (inviteData?.eventId && inviteData?.inviteeEmail) {
            const inAppSnap = await adminDb.collection('invitations')
                .where('eventId', '==', inviteData.eventId)
                .where('toEmail', '==', inviteData.inviteeEmail)
                .limit(1)
                .get();
            inAppSnap.docs.forEach((doc) => batch.delete(doc.ref));
        }

        await batch.commit();

        // Log the cleanup
        console.log(`[InviteCleanup] Cleaned invite ${inviteId}: ${logsSnap.size} logs removed`);
    } catch (err) {
        console.warn('[InviteCleanup] Partial or failed cleanup:', err);
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        if (!token || token.length < 32) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
        }

        const tokenHash = hashToken(token);

        // Transactional acceptance — prevents double-claim and race conditions
        const result = await adminDb.runTransaction(async (t) => {
            // Query by tokenHash
            const inviteQuery = adminDb.collection(TOKEN_INVITES_COL)
                .where('tokenHash', '==', tokenHash)
                .limit(1);
            const snap = await t.get(inviteQuery);

            if (snap.empty) {
                return { status: 'invalid' as const };
            }

            const doc = snap.docs[0];
            const data = doc.data();
            const docRef = adminDb.collection(TOKEN_INVITES_COL).doc(doc.id);

            // Already accepted — idempotent response
            if (data.status === 'accepted') {
                return {
                    status: 'already_accepted' as const,
                    inviteId: doc.id,
                    eventTitle: data.eventTitle,
                };
            }

            // Check expiry
            const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
            if (expiresAt < new Date()) {
                t.update(docRef, {
                    status: 'expired',
                    updatedAt: FieldValue.serverTimestamp(),
                    version: (data.version || 1) + 1,
                });
                return { status: 'expired' as const, inviteId: doc.id };
            }

            // Check if status allows acceptance
            if (data.status !== 'pending' && data.status !== 'email_sent') {
                return {
                    status: 'invalid_state' as const,
                    inviteId: doc.id,
                    currentStatus: data.status,
                };
            }

            // Fetch Event Data for Reminder Creation
            const eventRef = adminDb.collection('events').doc(data.eventId);
            const eventSnap = await t.get(eventRef);
            const eventData = eventSnap.data();

            if (!eventSnap.exists || !eventData) {
                // Should not happen if data integrity is maintained, but handle gracefully
                console.warn(`[InviteAccept] Event ${data.eventId} not found for invite ${doc.id}`);
            }

            // ── Fetch Original Branding (Template & Theme) ──
            // Try to find an existing reminder for this event (e.g. the owner's) to inherit style
            let inheritedTemplate = 'sys_template_prof_reminder';
            let inheritedTheme = 'sys_theme_modern_blue';
            try {
                const reminderQuery = adminDb.collection('scheduledReminders')
                    .where('eventId', '==', data.eventId)
                    .orderBy('createdAt', 'asc') // Scalable O(1) query - Requires Index
                    .limit(1);
                const reminderSnap = await reminderQuery.get();

                if (!reminderSnap.empty) {
                    const rData = reminderSnap.docs[0].data();
                    if (rData.templateId) inheritedTemplate = rData.templateId;
                    if (rData.themeId) inheritedTheme = rData.themeId;
                }
            } catch (err) {
                console.warn('[InviteAccept] Failed to fetch inheritance branding:', err);
            }

            // Accept the invite
            t.update(docRef, {
                status: 'accepted',
                acceptedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                version: (data.version || 1) + 1,
            });

            // Increment participant count for UI (Collab Icon)
            t.update(eventRef, {
                participantCount: FieldValue.increment(1)
            });

            // Add invitee to event participants
            const participantRef = adminDb
                .collection('events')
                .doc(data.eventId)
                .collection('participants')
                .doc(); // Auto-generated ID

            const newParticipantId = participantRef.id;
            const reminderOffset = 30; // Default 30 mins before
            const reminderBase = 'start';

            t.set(participantRef, {
                userId: '',  // Will be filled if user logs in later
                email: data.inviteeEmail,
                displayName: data.inviteeEmail.split('@')[0],
                role: data.role || 'viewer',
                reminderEnabled: true, // AUTO-ENABLE REMINDER
                reminderOffset,
                reminderBase,
                templateId: inheritedTemplate, // Inherit from owner
                themeId: inheritedTheme,       // Inherit from owner
                addedAt: FieldValue.serverTimestamp(),
                addedVia: 'invite_link',
                inviteId: doc.id,
            });

            // ── CRITICAL FIX: Create Scheduled Reminder ──
            // Only if event has a valid start time
            if (eventData && eventData.startTime) {
                const startTime = eventData.startTime.toDate ? eventData.startTime.toDate() : new Date(eventData.startTime);
                const scheduledTime = new Date(startTime.getTime() - reminderOffset * 60 * 1000);

                if (scheduledTime > new Date()) {
                    const reminderId = `rem_${data.eventId}_${newParticipantId}_auto`;
                    const reminderRef = adminDb.collection('scheduledReminders').doc(reminderId);

                    t.set(reminderRef, {
                        eventId: data.eventId,
                        eventTitle: data.eventTitle || eventData.title || 'Event',
                        participantId: newParticipantId,
                        userId: 'system', // System-managed for invitees initially
                        email: data.inviteeEmail,
                        scheduledTime: scheduledTime,
                        status: 'pending',
                        attempts: 0,
                        createdAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp(),
                        createdBy: 'invite_accept',
                        idempotencyKey: `auto_invite_${doc.id}`,
                        lastAttemptAt: null,
                        failureReason: '',
                        providerUsed: '',
                        processedAt: null,
                        senderName: data.inviterName || 'GMSS User',
                        senderEmail: data.inviterEmail || '',
                        templateId: inheritedTemplate, // Inherit from owner
                        themeId: inheritedTheme,       // Inherit from owner
                    });
                }
            }

            return {
                status: 'accepted' as const,
                inviteId: doc.id,
                eventId: data.eventId,
                eventTitle: data.eventTitle,
            };
        });

        // Log the action
        if (result.inviteId) {
            const actionMap: Record<string, string> = {
                accepted: 'ACCEPTED',
                already_accepted: 'REJECTED_CLAIMED',
                expired: 'REJECTED_EXPIRED',
                invalid: 'REJECTED_INVALID',
                invalid_state: 'REJECTED_INVALID',
            };
            await logInviteAction({
                inviteId: result.inviteId,
                action: actionMap[result.status] || 'REJECTED_INVALID',
                metadata: { status: result.status },
            });
        }

        // ── Layer 1: Post-acceptance/expiry cleanup (fire-and-forget) ──
        if (result.inviteId && (result.status === 'accepted' || result.status === 'expired')) {
            cleanupInviteData(result.inviteId).catch(() => { });
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error('[InviteAccept] Critical error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

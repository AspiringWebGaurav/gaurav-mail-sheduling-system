import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/server/admin';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { renderInviteEmail } from '@/lib/inviteEmailTemplate';
import { cleanupExpiredInvites } from '@/lib/server/cleanup';

export const dynamic = 'force-dynamic';

// ── Constants ──
const TOKEN_BYTES = 32;
const EXPIRY_HOURS = 10; // Strict 10-hour expiry — absolute, no extension
const MAX_INVITES_PER_EVENT = 50;
const MAX_INVITES_PER_DAY = 100;
const TOKEN_INVITES_COL = 'tokenInvites';
const INVITE_LOGS_COL = 'inviteExecutionLogs';

// ── Helpers ──
function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function getBaseUrl(request: NextRequest): string {
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
    const origin = request.headers.get('origin') || request.headers.get('x-forwarded-host');
    if (origin) {
        const proto = request.headers.get('x-forwarded-proto') || 'https';
        return origin.startsWith('http') ? origin : `${proto}://${origin}`;
    }
    return 'http://localhost:3000';
}

async function logInviteAction(data: {
    inviteId: string;
    action: string;
    provider?: string;
    durationMs?: number;
    errorMessage?: string;
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

async function sendInviteEmail(params: {
    toEmail: string;
    htmlContent: string;
    subject: string;
    fromName: string;
}): Promise<{ success: boolean; provider: string; durationMs: number; error?: string }> {
    const start = Date.now();

    const serviceId = process.env.EMAILJS_PROVIDER_1_SERVICE_ID || 'service_37etxg6';
    const templateId = process.env.EMAILJS_PROVIDER_1_TEMPLATE_ID || 'template_lh3q0q9';
    const publicKey = process.env.EMAILJS_PROVIDER_1_PUBLIC_KEY || 'xwi6F0t3bw9NkVJHp';
    const privateKey = process.env.EMAILJS_PROVIDER_1_PRIVATE_KEY || '';

    if (!privateKey) {
        return { success: false, provider: serviceId, durationMs: Date.now() - start, error: 'No private key configured' };
    }

    try {
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_id: serviceId,
                template_id: templateId,
                user_id: publicKey,
                accessToken: privateKey,
                template_params: {
                    to_email: params.toEmail,
                    from_name: params.fromName,
                    subject: params.subject,
                    message: params.htmlContent,
                    reply_to: 'no-reply@gmss.app',
                },
            }),
        });

        const durationMs = Date.now() - start;

        if (response.ok) {
            return { success: true, provider: serviceId, durationMs };
        }
        const errorText = await response.text();
        return { success: false, provider: serviceId, durationMs, error: `EmailJS ${response.status}: ${errorText}` };
    } catch (err) {
        return {
            success: false,
            provider: serviceId,
            durationMs: Date.now() - start,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

// ── Main Handler ──
export async function POST(request: NextRequest) {
    try {
        // 1. Auth verification
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let uid: string;
        try {
            const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
            uid = decoded.uid;
        } catch {
            return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
        }

        // 2. Parse body
        const body = await request.json();
        const { eventId, eventTitle, inviteeEmail, role, inviterName, inviterEmail, eventTime, eventLocation } = body;

        if (!eventId || !eventTitle || !inviteeEmail || !role) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(inviteeEmail)) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        // 3. Rate limiting checks
        const eventInvitesSnap = await adminDb.collection(TOKEN_INVITES_COL)
            .where('eventId', '==', eventId)
            .count().get();
        if (eventInvitesSnap.data().count >= MAX_INVITES_PER_EVENT) {
            return NextResponse.json({ error: `Maximum ${MAX_INVITES_PER_EVENT} invites per event` }, { status: 429 });
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const dailyInvitesSnap = await adminDb.collection(TOKEN_INVITES_COL)
            .where('inviterId', '==', uid)
            .where('createdAt', '>=', todayStart)
            .count().get();
        if (dailyInvitesSnap.data().count >= MAX_INVITES_PER_DAY) {
            return NextResponse.json({ error: `Daily invite limit (${MAX_INVITES_PER_DAY}) reached` }, { status: 429 });
        }

        // 4. Generate secure token
        const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
        const tokenHash = hashToken(rawToken);

        // 5. Idempotency key (one invite per email per event)
        const idempotencyKey = `tinv_${eventId}_${inviteeEmail}`;
        const inviteDocId = `tinv_${crypto.createHash('md5').update(idempotencyKey).digest('hex')}`;

        // 6. Atomic invite creation via transaction
        const inviteId = await adminDb.runTransaction(async (t) => {
            const docRef = adminDb.collection(TOKEN_INVITES_COL).doc(inviteDocId);
            const existing = await t.get(docRef);

            if (existing.exists) {
                const data = existing.data();
                // Allow re-invite if previous one expired or failed
                if (data && data.status !== 'expired' && data.status !== 'email_failed' && data.status !== 'revoked') {
                    throw new Error('DUPLICATE_INVITE');
                }
            }

            const expiresAt = new Date();
            expiresAt.setTime(expiresAt.getTime() + EXPIRY_HOURS * 60 * 60 * 1000);

            t.set(docRef, {
                eventId,
                eventTitle,
                inviterId: uid,
                inviterName: inviterName || 'GMSS User',
                inviterEmail: inviterEmail || '',
                inviteeEmail,
                tokenHash,
                status: 'pending',
                expiresAt,
                role: role || 'viewer',
                version: 1,
                providerAttemptCount: 0,
                emailSentAt: null,
                acceptedAt: null,
                acceptedByUid: null,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                idempotencyKey,
            });

            return inviteDocId;
        });

        // Log creation
        await logInviteAction({
            inviteId,
            action: 'CREATED',
            metadata: { eventId, inviteeEmail, role },
        });

        // 7. Send invite email
        const baseUrl = getBaseUrl(request);
        const inviteLink = `${baseUrl}/invite/${rawToken}`;

        const emailHtml = renderInviteEmail({
            inviterName: inviterName || 'GMSS User',
            eventTitle,
            eventTime: eventTime || 'See event for details',
            eventLocation,
            inviteLink,
            role: role || 'viewer',
        });

        const emailResult = await sendInviteEmail({
            toEmail: inviteeEmail,
            htmlContent: emailHtml,
            subject: `You're invited: ${eventTitle}`,
            fromName: inviterName || 'GMSS',
        });

        // 8. Update invite status based on email result
        const updateData: Record<string, unknown> = {
            providerAttemptCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (emailResult.success) {
            updateData.status = 'email_sent';
            updateData.emailSentAt = FieldValue.serverTimestamp();
        } else {
            updateData.status = 'email_failed';
        }

        await adminDb.collection(TOKEN_INVITES_COL).doc(inviteId).update(updateData);

        // Log email result
        await logInviteAction({
            inviteId,
            action: emailResult.success ? 'EMAIL_SENT' : 'EMAIL_FAILED',
            provider: emailResult.provider,
            durationMs: emailResult.durationMs,
            errorMessage: emailResult.error,
            metadata: { toEmail: inviteeEmail },
        });

        if (!emailResult.success) {
            return NextResponse.json({
                success: false,
                inviteId,
                error: 'Invite created but email delivery failed. You can retry later.',
                emailError: emailResult.error,
            }, { status: 207 }); // 207 Multi-Status: partial success
        }

        return NextResponse.json({ success: true, inviteId });

    } catch (error) {
        if (error instanceof Error && error.message === 'DUPLICATE_INVITE') {
            return NextResponse.json({ error: 'An active invitation already exists for this email' }, { status: 409 });
        }

        console.error('[InviteCreate] Critical error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    } finally {
        // Lazy Cleanup: Attempt to delete old expired invites to keep DB clean
        // We await this to ensure it runs before the Vercel function freezes/terminates
        try {
            await cleanupExpiredInvites();
        } catch (err) {
            console.error('[Cleanup] Background trigger failed:', err);
        }
    }
}

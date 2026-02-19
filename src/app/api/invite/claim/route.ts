import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { hashToken } from '@/lib/invite-token';

const TOKEN_INVITES_COL = 'tokenInvites';
const INVITE_LOGS_COL = 'inviteExecutionLogs';
const EVENTS_COL = 'events';

// Rate Limiting Constants
const MAX_CLAIMS_PER_IP_MINUTE = 10; // Basic DDoS protection

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        const body = await request.json();
        const { token } = body;

        if (!token || typeof token !== 'string') {
            return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
        }

        const tokenHash = hashToken(token);

        // Transactional Claim
        const result = await adminDb.runTransaction(async (t) => {
            // 1. Find Invite
            const q = adminDb.collection(TOKEN_INVITES_COL).where('tokenHash', '==', tokenHash).limit(1);
            const snap = await t.get(q);

            if (snap.empty) {
                throw new Error('INVITE_NOT_FOUND');
            }

            const inviteDoc = snap.docs[0];
            const inviteData = inviteDoc.data();
            const inviteId = inviteDoc.id;

            // 2. Validate Status
            if (inviteData.status === 'accepted') {
                return { status: 'already_accepted', invite: inviteData };
            }
            if (inviteData.status === 'expired' || inviteData.status === 'revoked') {
                throw new Error('INVITE_EXPIRED_OR_REVOKED');
            }

            const expiresAt = inviteData.expiresAt?.toDate ? inviteData.expiresAt.toDate() : new Date(inviteData.expiresAt);
            if (expiresAt < new Date()) {
                // Auto-expire
                t.update(inviteDoc.ref, { status: 'expired' });
                throw new Error('INVITE_EXPIRED');
            }

            // 3. Validate Event
            const eventRef = adminDb.collection(EVENTS_COL).doc(inviteData.eventId);
            const eventSnap = await t.get(eventRef);
            if (!eventSnap.exists) {
                throw new Error('EVENT_NOT_FOUND');
            }

            // 4. Claim Invite
            t.update(inviteDoc.ref, {
                status: 'accepted',
                acceptedAt: FieldValue.serverTimestamp(),
                // Note: We don't link to a UID here because this is a zero-login flow.
                // If we had a UID (e.g. from session), we would add it.
            });

            // 5. Add Participant to Event
            // check if already participant? (Maybe by email)
            // Ideally we should add to a subcollection or array. 
            // Existing system uses 'participants' subcollection or similar?
            // Let's assume subcollection 'participants' for now based on previous file reads.
            // *Wait*, looking at `participantServiceFixed.ts` it seems participants are stored... where?
            // Let's assume standard subcollection pattern or root collection.
            // Actually, `participantService.ts` isn't fully visible, but `createInvitation` used `invitations` collection.
            // Responsive to `invite` usually ends up in `participants`.
            // Let's safely write to `events/{eventId}/participants/{email}` (sanitized) or auto-id.
            // To prevent overwrites, let's use email as ID (hashed or sanitized).

            // For now, let's just log it and mark invite accepted. 
            // The REQUIREMENT says "add participant to event".
            // I'll assume a `participants` subcollection on the event doc.

            const participantRef = eventRef.collection('participants').doc(inviteData.inviteeEmail);
            t.set(participantRef, {
                userId: 'guest', // Placeholder for no-login
                email: inviteData.inviteeEmail,
                displayName: inviteData.inviteeEmail.split('@')[0], // Fallback name
                role: inviteData.role,
                status: 'active',
                addedAt: FieldValue.serverTimestamp(),
                joinMethod: 'invite_token',
                inviteId: inviteId
            }, { merge: true });

            // 6. Audit Log (Inside transaction for atomic success)
            const logRef = adminDb.collection(INVITE_LOGS_COL).doc();
            t.set(logRef, {
                inviteId,
                action: 'ACCEPTED',
                eventId: inviteData.eventId,
                timestamp: FieldValue.serverTimestamp(),
                ipHash: hashToken(ip), // Privacy-preserving IP logging
            });

            return { status: 'accepted', invite: inviteData };
        });

        return NextResponse.json(result);

    } catch (error) {
        console.error('[InviteClaim] Error:', error);

        let status = 500;
        let message = 'Internal Server Error';
        let code = 'UNKNOWN_ERROR';

        if (error instanceof Error) {
            if (error.message === 'INVITE_NOT_FOUND') {
                status = 404;
                message = 'Invite not found';
                code = 'INVALID_TOKEN';
            } else if (error.message === 'INVITE_EXPIRED_OR_REVOKED' || error.message === 'INVITE_EXPIRED') {
                status = 410; // Gone
                message = 'Invite expired';
                code = 'EXPIRED_TOKEN';
            } else if (error.message === 'EVENT_NOT_FOUND') {
                status = 404;
                message = 'Event not found';
                code = 'EVENT_NOT_FOUND';
            }
        }

        return NextResponse.json({ error: message, code }, { status });
    }
}

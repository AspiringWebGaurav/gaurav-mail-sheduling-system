import { adminDb } from '@/lib/server/admin';
import { InviteAcceptClient } from './InviteAcceptClient';
import { hashToken } from '@/lib/invite-token';
import { SSRShell } from '@/components/layout/SSRShell';
import { Calendar, MapPin, User, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface InviteData {
    eventId: string;
    eventTitle: string;
    inviterName: string;
    inviteeEmail: string;
    role: string;
    status: string;
    expiresAt: Date;
    eventTime?: string;
    eventLocation?: string;
}

async function getInviteByToken(token: string): Promise<{ invite: InviteData | null; state: 'valid' | 'expired' | 'accepted' | 'invalid' }> {
    try {
        const tokenHash = hashToken(token);
        const snap = await adminDb.collection('tokenInvites')
            .where('tokenHash', '==', tokenHash)
            .limit(1)
            .get();

        if (snap.empty) return { invite: null, state: 'invalid' };

        const data = snap.docs[0].data();
        const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);

        const invite: InviteData = {
            eventId: data.eventId,
            eventTitle: data.eventTitle,
            inviterName: data.inviterName,
            inviteeEmail: data.inviteeEmail,
            role: data.role,
            status: data.status,
            expiresAt,
        };

        // Fetch event details
        try {
            const eventSnap = await adminDb.collection('events').doc(data.eventId).get();
            if (eventSnap.exists) {
                const eventData = eventSnap.data();
                if (eventData?.startTime) {
                    const start = eventData.startTime.toDate ? eventData.startTime.toDate() : new Date(eventData.startTime);
                    invite.eventTime = start.toLocaleString('en-US', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
                    });
                }
                if (eventData?.location) invite.eventLocation = eventData.location;
            }
        } catch { }

        if (data.status === 'accepted') return { invite, state: 'accepted' };

        if (expiresAt < new Date()) {
            try {
                // Determine base URL dynamically or fallback to localhost if env not set
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

                await adminDb.collection('tokenInvites').doc(snap.docs[0].id).update({ status: 'expired' });
                fetch(`${baseUrl}/api/invite/cleanup`, { method: 'POST' }).catch(() => { });
            } catch { }
            return { invite, state: 'expired' };
        }

        if (data.status === 'revoked') return { invite, state: 'invalid' };

        return { invite, state: 'valid' };
    } catch (error) {
        console.error('[InvitePage] Error fetching invite:', error);
        return { invite: null, state: 'invalid' };
    }
}

export default async function InviteTokenPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const { invite, state } = await getInviteByToken(token);

    // Enterprise UI Components
    const Divider = () => <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '32px 0' }} />;

    const DetailRow = ({ icon: Icon, label, value }: { icon: any, label: string, value: string }) => (
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div style={{ marginTop: '2px', color: 'var(--text-tertiary)' }}><Icon size={18} /></div>
            <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
                <div style={{ color: 'var(--text-primary)', fontSize: '15px' }}>{value}</div>
            </div>
        </div>
    );

    if (state === 'valid' && invite) {
        return (
            <SSRShell title="Event Invitation">
                <div className="animate-fade-in">
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '12px', letterSpacing: '0.05em' }}>
                        EVENT INVITATION
                    </div>
                    <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px', lineHeight: 1.2 }}>
                        {invite.eventTitle}
                    </h1>
                    <p style={{ fontSize: '16px', color: 'var(--text-secondary)', maxWidth: '480px', lineHeight: 1.6 }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{invite.inviterName}</span> has invited you to join this session.
                    </p>

                    <Divider />

                    <div style={{ marginBottom: '32px' }}>
                        {invite.eventTime && <DetailRow icon={Calendar} label="DATE & TIME" value={invite.eventTime} />}
                        {invite.eventLocation && <DetailRow icon={MapPin} label="LOCATION" value={invite.eventLocation} />}
                        <DetailRow icon={User} label="ROLE" value={invite.role.charAt(0).toUpperCase() + invite.role.slice(1)} />
                    </div>

                    <InviteAcceptClient token={token} eventTitle={invite.eventTitle} />
                </div>
            </SSRShell>
        );
    }

    if (state === 'accepted') {
        return (
            <SSRShell title="Invitation Accepted">
                <div className="animate-fade-in" style={{ textAlign: 'center', padding: '40px 0' }}>
                    <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(0, 214, 143, 0.1)', color: 'var(--accent-success)', marginBottom: '24px' }}>
                        <CheckCircle size={48} />
                    </div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>All Set!</h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
                        You have accepted the invitation for <strong>{invite?.eventTitle}</strong>.
                    </p>
                    <Divider />
                    <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>You can close this page now.</p>
                </div>
            </SSRShell>
        );
    }

    if (state === 'expired') {
        return (
            <SSRShell title="Invitation Expired">
                <div className="animate-fade-in" style={{ textAlign: 'center', padding: '40px 0' }}>
                    <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(255, 170, 0, 0.1)', color: 'var(--accent-warning)', marginBottom: '24px' }}>
                        <Clock size={48} />
                    </div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>Invitation Expired</h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '400px', margin: '0 auto 32px' }}>
                        This invitation link is no longer active. Please verify the link or ask the organizer for a new one.
                    </p>
                </div>
            </SSRShell>
        );
    }

    // Invalid
    return (
        <SSRShell title="Invalid Invitation">
            <div className="animate-fade-in" style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(255, 71, 87, 0.1)', color: 'var(--accent-danger)', marginBottom: '24px' }}>
                    <AlertCircle size={48} />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>Invalid Link</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
                    We couldn&apos;t find this invitation. It may have been revoked or the link is incorrect.
                </p>
            </div>
        </SSRShell>
    );
}


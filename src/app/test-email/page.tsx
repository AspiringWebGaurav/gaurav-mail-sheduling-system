import { renderInviteEmail } from '@/lib/inviteEmailTemplate';

export default function TestEmailPage() {
    const html = renderInviteEmail({
        inviterName: "Gaurav User",
        eventTitle: "Product Strategy Sync",
        eventTime: "Monday, October 25 • 2:00 PM - 3:00 PM",
        eventLocation: "Google Meet",
        inviteLink: "http://localhost:3000/invite/test-token-123",
        role: "Editor"
    });

    return (
        <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 20px', background: '#09090b', color: '#fff', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Email Preview</span>
                <span style={{ fontSize: '12px', color: '#a1a1aa' }}>Rendered inside Iframe</span>
            </div>
            <iframe
                srcDoc={html}
                style={{ width: '100%', height: '100%', border: 'none', background: '#000' }}
                title="Email Preview"
            />
        </div>
    );
}

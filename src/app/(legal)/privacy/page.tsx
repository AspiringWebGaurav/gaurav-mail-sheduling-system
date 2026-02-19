import { SSRShell } from '@/components/layout/SSRShell';

export const dynamic = 'force-static';

export default function PrivacyPage() {
    const H2 = ({ children }: { children: React.ReactNode }) => (
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '16px' }}>{children}</h2>
    );
    const P = ({ children }: { children: React.ReactNode }) => (
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>{children}</p>
    );

    return (
        <SSRShell title="Privacy Policy">
            <div className="animate-fade-in">
                <div style={{ marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Privacy Policy</h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Last Updated: {new Date().toLocaleDateString()}</p>
                    <div style={{ height: '1px', background: 'var(--border-subtle)', marginTop: '24px' }} />
                </div>

                <H2>1. Information We Collect</H2>
                <P>We collect information you provide directly to us when you use the Service, including:</P>
                <ul style={{ paddingLeft: '24px', color: 'var(--text-secondary)', lineHeight: 1.6, listStyle: 'disc', marginBottom: '16px' }}>
                    <li style={{ marginBottom: '8px' }}><strong style={{ color: 'var(--text-primary)' }}>Account Information:</strong> When you register or are invited, we collect your name and email address.</li>
                    <li style={{ marginBottom: '8px' }}><strong style={{ color: 'var(--text-primary)' }}>Event Data:</strong> If you organize events, we collect details about your events.</li>
                    <li style={{ marginBottom: '8px' }}><strong style={{ color: 'var(--text-primary)' }}>Usage Logs:</strong> We log actions for security and audit purposes (e.g., when an invite is claimed).</li>
                </ul>

                <H2>2. How We Use Information</H2>
                <P>We use the information we collect to:</P>
                <ul style={{ paddingLeft: '24px', color: 'var(--text-secondary)', lineHeight: 1.6, listStyle: 'disc', marginBottom: '16px' }}>
                    <li style={{ marginBottom: '8px' }}>Provide, maintain, and improve our Service;</li>
                    <li style={{ marginBottom: '8px' }}>Send you technical notices, updates, security alerts, and support messages;</li>
                    <li style={{ marginBottom: '8px' }}>Respond to your comments, questions, and requests;</li>
                    <li style={{ marginBottom: '8px' }}>Monitor and analyze trends, usage, and activities in connection with our Service.</li>
                </ul>

                <H2>3. Data Sharing</H2>
                <P>We do not share your personal information with third parties except as described in this policy:</P>
                <ul style={{ paddingLeft: '24px', color: 'var(--text-secondary)', lineHeight: 1.6, listStyle: 'disc', marginBottom: '16px' }}>
                    <li style={{ marginBottom: '8px' }}><strong style={{ color: 'var(--text-primary)' }}>Service Providers:</strong> We may share data with vendors who need access to such information to carry out work on our behalf (e.g., email delivery via EmailJS).</li>
                    <li style={{ marginBottom: '8px' }}><strong style={{ color: 'var(--text-primary)' }}>Compliance with Laws:</strong> We may disclose information if we believe disclosure is in accordance with any applicable law, regulation, or legal process.</li>
                </ul>

                <H2>4. Security</H2>
                <P>We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction.</P>
            </div>
        </SSRShell>
    );
}

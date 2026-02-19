import { SSRShell } from '@/components/layout/SSRShell';

export const dynamic = 'force-static';

export default function LicensePage() {
    const H2 = ({ children }: { children: React.ReactNode }) => (
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '16px' }}>{children}</h2>
    );
    const P = ({ children }: { children: React.ReactNode }) => (
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>{children}</p>
    );

    return (
        <SSRShell title="License Information">
            <div className="animate-fade-in">
                <div style={{ marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>License Information</h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Last Updated: {new Date().toLocaleDateString()}</p>
                    <div style={{ height: '1px', background: 'var(--border-subtle)', marginTop: '24px' }} />
                </div>

                <H2>Proprietary Software</H2>
                <P>The <strong style={{ color: 'var(--text-primary)' }}>Gaurav Mail Scheduling System (GMSS)</strong> is proprietary software. All rights are reserved.</P>
                <P>Unauthorized copying, modification, distribution, or use of this software, in whole or in part, via any medium is strictly prohibited.</P>

                <H2>Third-Party Licenses</H2>
                <P>This software may include or utilize third-party software components. The licenses for these components are as follows:</P>
                <ul style={{ paddingLeft: '24px', color: 'var(--text-secondary)', lineHeight: 1.6, listStyle: 'disc', marginBottom: '16px' }}>
                    <li style={{ marginBottom: '8px' }}><strong style={{ color: 'var(--text-primary)' }}>Next.js:</strong> MIT License</li>
                    <li style={{ marginBottom: '8px' }}><strong style={{ color: 'var(--text-primary)' }}>React:</strong> MIT License</li>
                    <li style={{ marginBottom: '8px' }}><strong style={{ color: 'var(--text-primary)' }}>Firebase:</strong> Apache License 2.0</li>
                    <li style={{ marginBottom: '8px' }}><strong style={{ color: 'var(--text-primary)' }}>Lucide React:</strong> ISC License</li>
                </ul>
                <P>Full license texts for third-party components are available in their respective repositories or distributions.</P>
            </div>
        </SSRShell>
    );
}

import { SSRShell } from '@/components/layout/SSRShell';

export const dynamic = 'force-static';

export default function TermsPage() {
    const H2 = ({ children }: { children: React.ReactNode }) => (
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '32px', marginBottom: '16px' }}>{children}</h2>
    );
    const P = ({ children }: { children: React.ReactNode }) => (
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>{children}</p>
    );

    return (
        <SSRShell title="Terms of Service">
            <div className="animate-fade-in">
                <div style={{ marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Terms of Service</h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Last Updated: {new Date().toLocaleDateString()}</p>
                    <div style={{ height: '1px', background: 'var(--border-subtle)', marginTop: '24px' }} />
                </div>

                <H2>1. Acceptance of Terms</H2>
                <P>By accessing or using the GMSS (Gaurav Mail Scheduling System) platform (&quot;Service&quot;), you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the Service.</P>

                <H2>2. Use License</H2>
                <P>This is a private, proprietary system. Permission is granted to temporarily access the materials (information or software) on GMSS for personal, non-commercial transitory viewing only.</P>
                <P>This is the grant of a license, not a transfer of title, and under this license you may not:</P>
                <ul style={{ paddingLeft: '24px', color: 'var(--text-secondary)', lineHeight: 1.6, listStyle: 'disc' }}>
                    <li style={{ marginBottom: '8px' }}>Modify or copy the materials;</li>
                    <li style={{ marginBottom: '8px' }}>Use the materials for any commercial purpose, or for any public display;</li>
                    <li style={{ marginBottom: '8px' }}>Attempt to decompile or reverse engineer any software contained on GMSS;</li>
                    <li style={{ marginBottom: '8px' }}>Remove any copyright or other proprietary notations from the materials; or</li>
                    <li style={{ marginBottom: '8px' }}>Transfer the materials to another person or &quot;mirror&quot; the materials on any other server.</li>
                </ul>

                <H2>3. Disclaimer</H2>
                <P>The materials on GMSS are provided on an &apos;as is&apos; basis. GMSS makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</P>

                <H2>4. Limitations</H2>
                <P>In no event shall GMSS or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on GMSS, even if GMSS or a GMSS authorized representative has been notified orally or in writing of the possibility of such damage.</P>
            </div>
        </SSRShell>
    );
}

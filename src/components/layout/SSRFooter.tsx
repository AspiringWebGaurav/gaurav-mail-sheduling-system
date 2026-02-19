'use client';
import Link from 'next/link';

export function SSRFooter() {
    return (
        <footer style={{
            padding: '32px 24px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-primary)',
            display: 'flex',
            justifyContent: 'center'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '720px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
            }}>
                <div style={{
                    display: 'flex',
                    gap: '24px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)'
                }}>
                    <Link href="/terms" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }}>Terms</Link>
                    <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }}>Privacy</Link>
                    <Link href="/license" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.2s' }}>License</Link>
                </div>
                <div style={{
                    fontSize: '12px',
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>&copy; {new Date().getFullYear()} GMSS. Enterprise Scheduling.</span>
                    <span style={{ opacity: 0.5 }}>System v1.0.0</span>
                </div>
            </div>
        </footer>
    );
}

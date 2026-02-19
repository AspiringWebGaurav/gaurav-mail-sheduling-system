import Link from 'next/link';
import { Home } from 'lucide-react';
import { SSRShell } from '@/components/layout/SSRShell';

export default function NotFound() {
    return (
        <SSRShell title="Page Not Found">
            <div className="animate-fade-in" style={{ textAlign: 'center', padding: '60px 0' }}>
                <h1 style={{ fontSize: '120px', fontWeight: 900, lineHeight: 1, color: 'var(--bg-tertiary)', letterSpacing: '-0.05em', marginBottom: '24px' }}>
                    404
                </h1>
                <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
                    Page not found
                </h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 40px', lineHeight: 1.6 }}>
                    The page you are looking for doesn&apos;t exist or has been moved.
                </p>

                <div style={{ height: '1px', background: 'var(--border-subtle)', maxWidth: '200px', margin: '0 auto 40px' }} />

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Link href="/" className="btn-primary">
                        <Home size={18} />
                        Return Home
                    </Link>
                </div>
            </div>
        </SSRShell>
    );
}

const buttonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#6c5ce7',
    color: 'white',
    padding: '12px 24px',
    borderRadius: '12px',
    textDecoration: 'none',
    fontWeight: '600',
    transition: 'transform 0.2s',
    boxShadow: '0 4px 14px rgba(108, 92, 231, 0.3)'
};

const secondaryButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#1a1a2e',
    color: '#a855f7',
    padding: '12px 24px',
    borderRadius: '12px',
    textDecoration: 'none',
    fontWeight: '600',
    border: '1px solid #2d2d42'
};

const footerLinkStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#6b6b80',
    textDecoration: 'none',
    fontSize: '14px'
};

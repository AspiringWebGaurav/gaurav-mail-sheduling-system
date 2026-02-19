'use client';
import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';

export function SSRHeader() {
    return (
        <header style={{
            display: 'flex',
            alignItems: 'center',
            height: '64px',
            padding: '0 24px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)',
            justifyContent: 'center'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '720px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}>
                <Link href="/" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    textDecoration: 'none',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '15px'
                }}>
                    <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        background: 'var(--primary-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                    }}>
                        <LayoutGrid size={14} />
                    </div>
                    GMSS
                </Link>
            </div>
        </header>
    );
}

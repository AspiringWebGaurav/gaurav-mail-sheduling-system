'use client';
import React from 'react';
import Link from 'next/link';
import { SSRFooter } from './SSRFooter';
import { SSRHeader } from './SSRHeader';

interface SSRShellProps {
    children: React.ReactNode;
    title?: string;
}

export function SSRShell({ children, title }: SSRShellProps) {
    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            display: 'flex',
            flexDirection: 'column',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-inter)'
        }}>
            <SSRHeader />
            <main style={{
                flex: 1,
                width: '100%',
                maxWidth: '720px',
                margin: '0 auto',
                padding: '40px 24px',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {children}
            </main>
            <SSRFooter />
        </div>
    );
}

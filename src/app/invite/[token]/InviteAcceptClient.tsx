'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
    token: string;
    eventTitle: string;
}

export function InviteAcceptClient({ token, eventTitle }: Props) {
    const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const handleAccept = async () => {
        if (state === 'loading' || state === 'success') return;
        setState('loading');

        try {
            const res = await fetch('/api/invite/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });

            const data = await res.json();

            if (res.ok) {
                if (data.status === 'accepted' || data.status === 'already_accepted') {
                    setState('success');
                } else {
                    setState('error');
                    setErrorMsg('Unexpected status received.');
                }
            } else {
                if (res.status === 410 || data.code === 'EXPIRED_TOKEN') {
                    setState('error');
                    setErrorMsg('This invitation has expired.');
                } else if (res.status === 404 || data.code === 'INVALID_TOKEN') {
                    setState('error');
                    setErrorMsg('This invitation is no longer valid.');
                } else {
                    setState('error');
                    setErrorMsg(data.error || 'Something went wrong.');
                }
            }
        } catch {
            setState('error');
            setErrorMsg('Network error. Please try again.');
        }
    };

    if (state === 'success') {
        return (
            <div className="animate-fade-in" style={{ padding: '16px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-success)', marginTop: '24px' }}>
                <p style={{ color: 'var(--text-primary)', textAlign: 'center', fontSize: '15px' }}>
                    Successfully joined <strong>{eventTitle}</strong>.
                </p>
            </div>
        );
    }

    if (state === 'error') {
        return (
            <div className="animate-fade-in" style={{ padding: '16px', background: 'rgba(255, 71, 87, 0.1)', borderRadius: '12px', border: '1px solid var(--accent-danger)', marginTop: '24px' }}>
                <p style={{ color: 'var(--accent-danger)', textAlign: 'center', fontSize: '14px' }}>
                    {errorMsg}
                </p>
            </div>
        );
    }

    return (
        <div style={{ marginTop: '32px' }}>
            <button
                onClick={handleAccept}
                disabled={state === 'loading'}
                className="btn-primary" // Uses global button style
                style={{ width: '100%', height: '48px', fontSize: '16px' }}
            >
                {state === 'loading' ? (
                    <>
                        <Loader2 className="animate-spin" size={18} />
                        Processing...
                    </>
                ) : (
                    'Accept Invitation'
                )}
            </button>
            <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '16px' }}>
                By accepting, you agree to join this event session.
            </p>
        </div>
    );
}

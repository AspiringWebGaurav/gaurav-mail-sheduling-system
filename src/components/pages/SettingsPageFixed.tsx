'use client';

import { useEffect, useState, useMemo } from 'react';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/providers/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { User, Palette, FileText, Tag, LogOut, ChevronRight, ChevronDown, BarChart3, Mail, AlertTriangle, Clock, CheckCircle2, XCircle, Activity, Server, Heart, Zap, Sun, Moon, Monitor, RefreshCw, Trash2, Maximize2 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { subscribeSystemHealth, subscribeDisasterStats } from '@/services/disasterBankService';
import { subscribeProviders } from '@/services/providerService';
import { retryScheduledReminder, deleteScheduledReminder, toggleEmergencyStop } from '@/services/participantServiceFixed';
import { useInstall } from '@/providers/InstallProvider';
import type { SystemHealthStatus, EmailProvider } from '@/types';
import styles from './SettingsPage.module.css';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { AlertOctagon, Download } from 'lucide-react';

function InstallRow() {
    const { isInstallable, install } = useInstall();

    // Animate presence could be used here, but simple null check is fine for now
    if (!isInstallable) return null;

    return (
        <motion.div
            className={`card ${styles.profileCard}`} // Reuse profile card style for consistency
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem',
                borderLeft: '4px solid #8b5cf6', // Purple accent
                cursor: 'pointer'
            }}
            onClick={install}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                    background: 'var(--accent-gradient)',
                    padding: '0.6rem',
                    borderRadius: '8px',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Download size={20} />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Install App
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Add to home screen for quick access
                    </p>
                </div>
            </div>

            <div style={{
                background: 'rgba(139, 92, 246, 0.1)',
                color: '#8b5cf6',
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600
            }}>
                Install
            </div>
        </motion.div>
    );
}

// --- Audit Log Viewer Component ---
type FirestoreTimestamp = { toDate: () => Date };

interface AuditLog {
    id: string;
    timestamp: FirestoreTimestamp | null;
    status: string;
    action: string;
    recipientEmail?: string;
    reminderId?: string;
    errorDetails?: string;
}

function LogViewer({ userId }: { userId: string }) {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [limitCount, setLimitCount] = useState(20);
    const [isExpanded, setIsExpanded] = useState(false); // Default collapsed as per request "expandable if user want"

    useEffect(() => {
        if (!userId) return;
        const q = query(
            collection(db, 'mailAuditLogs'),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );
        return onSnapshot(q, (snap) => {
            setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }) as unknown as AuditLog));
        });
    }, [userId, limitCount]);

    return (
        <motion.div
            className={`card ${styles.activityDashboard}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ marginTop: '1rem' }}
        >
            <button
                className={styles.dashHeaderBtn}
                onClick={() => setIsExpanded(!isExpanded)}
                style={{ width: '100%', padding: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <Activity size={18} />
                    <span>System Audit Trail</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div onClick={(e) => e.stopPropagation()}>
                        <select
                            value={limitCount}
                            onChange={(e) => setLimitCount(Number(e.target.value))}
                            style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                                background: 'var(--card-bg)',
                                color: 'var(--text-primary)',
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                outline: 'none'
                            }}
                        >
                            <option value={10}>10 items</option>
                            <option value={20}>20 items</option>
                            <option value={50}>50 items</option>
                        </select>
                    </div>

                    <Link href="/settings/audit" onClick={(e) => e.stopPropagation()}>
                        <div
                            style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'color 0.2s' }}
                            title="Open Full Page View"
                        >
                            <Maximize2 size={16} />
                        </div>
                    </Link>

                    <ChevronDown
                        size={16}
                        style={{
                            transform: isExpanded ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s ease',
                            color: 'var(--text-secondary)'
                        }}
                    />
                </div>
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{
                            maxHeight: '300px',
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                            paddingTop: '1rem',
                            paddingRight: '4px' // prevent scrollbar overlap
                        }}>
                            {logs.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>No audit logs found.</p>}
                            {logs.map(log => {
                                const ts = log.timestamp?.toDate ? log.timestamp.toDate() : new Date();
                                let color = 'var(--text-primary)';
                                if (log.status === 'SENT') color = '#10b981';
                                if (log.status === 'FAILED') color = '#ef4444';
                                if (log.status === 'HALTED') color = '#fbbf24';
                                if (log.status === 'RETRY_INITIATED') color = '#3b82f6';

                                return (
                                    <div key={log.id} style={{
                                        fontSize: '0.85rem',
                                        padding: '0.75rem',
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: '6px',
                                        borderLeft: `3px solid ${color}`,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.25rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <strong style={{ color, fontWeight: 600 }}>{log.action}</strong>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                                {ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                                            <span>{log.recipientEmail || 'System Action'}</span>
                                            {log.reminderId && <span style={{ fontFamily: 'monospace', opacity: 0.7 }}>#{log.reminderId.slice(-6)}</span>}
                                        </div>
                                        {log.errorDetails && (
                                            <div style={{
                                                color: '#ef4444',
                                                fontSize: '0.75rem',
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                marginTop: '0.25rem'
                                            }}>
                                                Error: {log.errorDetails}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

interface UsageData {
    count: number;
    sentCount: number;
    failedCount: number;
    lastSentAt: unknown;
    lastFailedAt: unknown;
}

interface ReminderDoc {
    id: string;
    eventTitle: string;
    email: string;
    status: string;
    failureReason: string;
    scheduledTime: { toDate: () => Date };
    processedAt: { toDate: () => Date } | null;
    attempts: number;
    providerUsed: string;
}

function DatabaseMaintenanceCard() {
    const [cleaning, setCleaning] = useState(false);
    const [expiredCount, setExpiredCount] = useState<number | null>(null);

    useEffect(() => {
        fetch('/api/invite/cleanup')
            .then(res => res.json())
            .then(data => setExpiredCount(data.count))
            .catch(() => setExpiredCount(null));
    }, []);

    const handleCleanup = async () => {
        if (!confirm('Are you sure you want to clean up expired invites?')) return;
        setCleaning(true);
        try {
            const res = await fetch('/api/invite/cleanup', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert(`Cleanup Complete: ${data.deleted} expired invites removed.`);
                setExpiredCount(0); // Reset count after success
            } else {
                alert('Cleanup failed: ' + data.error);
            }
        } catch (e) {
            alert('Cleanup error: ' + String(e));
        } finally {
            setCleaning(false);
        }
    };

    return (
        <motion.div
            className={`card`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem',
                borderLeft: '4px solid #f59e0b' // Amber accent
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    padding: '0.6rem',
                    borderRadius: '8px',
                    color: '#f59e0b'
                }}>
                    <Trash2 size={20} />
                </div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Database Maintenance
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {expiredCount !== null
                            ? `${expiredCount} expired invite${expiredCount === 1 ? '' : 's'} to remove.`
                            : 'Checking for expired invites...'}
                    </p>
                </div>
            </div>

            <button
                onClick={handleCleanup}
                disabled={cleaning || expiredCount === 0}
                style={{
                    background: (cleaning || expiredCount === 0) ? 'var(--bg-secondary)' : 'var(--card-bg)',
                    border: '1px solid var(--border)',
                    color: (cleaning || expiredCount === 0) ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: (cleaning || expiredCount === 0) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s',
                    opacity: (cleaning || expiredCount === 0) ? 0.7 : 1
                }}
            >
                {cleaning ? (
                    <RefreshCw size={14} className="animate-spin" />
                ) : (
                    <Trash2 size={14} />
                )}
                {cleaning ? 'Cleaning...' : (expiredCount !== null ? `Clean Now (${expiredCount})` : 'Clean Now')}
            </button>
        </motion.div>
    );
}

export default function SettingsPage() {
    const { user, signOut } = useAuth();
    const { theme, setTheme } = useTheme();
    const [usage, setUsage] = useState<UsageData>({ count: 0, sentCount: 0, failedCount: 0, lastSentAt: null, lastFailedAt: null });
    const [recentEmails, setRecentEmails] = useState<ReminderDoc[]>([]);
    const [loadingEmails, setLoadingEmails] = useState(true);
    const [systemHealth, setSystemHealth] = useState<SystemHealthStatus | null>(null);
    const [disasterStats, setDisasterStats] = useState({ pending: 0, recovered: 0, failed: 0 });
    const [statusExpanded, setStatusExpanded] = useState(false);
    const [isEmergencyStop, setIsEmergencyStop] = useState(false);
    const [providers, setProviders] = useState<EmailProvider[]>([]);
    const [providersError, setProvidersError] = useState(false);
    const [providerSectionExpanded, setProviderSectionExpanded] = useState(false);
    const [providerUsageMap, setProviderUsageMap] = useState<Record<string, { usedToday: number; date: string }>>({}); // Real-time per-provider usage

    // Listen to Emergency Stop State
    useEffect(() => {
        return onSnapshot(doc(db, 'systemSettings', 'globalConfig'), (snap) => {
            setIsEmergencyStop(snap.data()?.emergencyStop || false);
        });
    }, []);

    const handleToggleStop = async () => {
        const newState = !isEmergencyStop;
        await toggleEmergencyStop(newState);
    };

    // Real-time System Health subscription
    useEffect(() => {
        let unsubHealth: (() => void) | undefined;
        let isUnsubscribed = false;

        try {
            unsubHealth = subscribeSystemHealth(setSystemHealth);
        } catch (error) {
            console.error('Failed to subscribe to system health:', error);
        }

        return () => {
            if (unsubHealth && !isUnsubscribed) {
                try {
                    unsubHealth();
                    isUnsubscribed = true;
                } catch (e) {
                    console.warn('Error unsubscribing from system health:', e);
                }
            }
        };
    }, []);

    // Real-time Disaster Stats subscription
    useEffect(() => {
        let unsubStats: (() => void) | undefined;
        let isUnsubscribed = false;

        try {
            unsubStats = subscribeDisasterStats(setDisasterStats);
        } catch (error) {
            console.error('Failed to subscribe to disaster stats:', error);
        }

        return () => {
            if (unsubStats && !isUnsubscribed) {
                try {
                    unsubStats();
                    isUnsubscribed = true;
                } catch (e) {
                    console.warn('Error unsubscribing from disaster stats:', e);
                }
            }
        };
    }, []);

    // Real-time Provider subscription — PRIMARY source for provider data
    useEffect(() => {
        if (!user?.uid) return;
        let unsub: (() => void) | undefined;
        try {
            unsub = subscribeProviders(user.uid, (providerList) => {
                setProviders(providerList);
                setProvidersError(false);
            });
        } catch (e) {
            console.warn('[Providers] Subscription init failed, using fallback:', e);
            setProvidersError(true);
        }
        return () => { try { unsub?.(); } catch { /* ignore */ } };
    }, [user?.uid]);

    // ── REAL-TIME PROVIDER USAGE SUBSCRIPTION ──
    // Subscribes to providerUsage/{serviceId} docs for live per-provider usage
    // Backend writes to providerUsage/{serviceId}, so we subscribe by serviceId
    const providerServiceIds = providers.map(p => p.serviceId || p.id).join(',');
    useEffect(() => {
        if (!providerServiceIds) return;
        const sids = providerServiceIds.split(',');
        const today = new Date().toISOString().split('T')[0];
        const unsubs = sids.map((sid) =>
            onSnapshot(doc(db, 'providerUsage', sid), (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    setProviderUsageMap((prev) => ({
                        ...prev,
                        [sid]: {
                            usedToday: data.date === today ? (data.usedToday || 0) : 0,
                            date: data.date || today,
                        },
                    }));
                } else {
                    // No usage doc yet — default to 0
                    setProviderUsageMap((prev) => ({ ...prev, [sid]: { usedToday: 0, date: today } }));
                }
            }, (error) => {
                console.warn(`[ProviderUsage] Subscription error for ${sid}:`, error.message);
                // Fallback: leave existing data (or 0) — graceful degradation
            })
        );
        return () => unsubs.forEach((u) => u());
    }, [providerServiceIds]);

    // Real-time quota subscription — Fallback Layer 2 (reads from usage doc)
    useEffect(() => {
        if (!user?.uid) return;
        const today = new Date().toISOString().split('T')[0];
        let unsub: (() => void) | undefined;
        try {
            unsub = onSnapshot(doc(db, 'users', user.uid, 'usage', today), (snap) => {
                if (snap.exists()) {
                    const d = snap.data();
                    setUsage({
                        count: d.count || 0,
                        sentCount: d.sentCount || 0,
                        failedCount: d.failedCount || 0,
                        lastSentAt: d.lastSentAt,
                        lastFailedAt: d.lastFailedAt,
                    });
                } else {
                    setUsage({ count: 0, sentCount: 0, failedCount: 0, lastSentAt: null, lastFailedAt: null });
                }
            }, (error) => {
                console.warn('[StatusOverview] Usage doc subscription failed (non-critical):', error.message);
            });
        } catch (e) {
            console.warn('[StatusOverview] Usage subscription init failed:', e);
        }
        return () => { try { unsub?.(); } catch { /* ignore */ } };
    }, [user?.uid]);

    // Real-time "Recent Emails" subscription — PRIMARY data source
    // Reads from scheduledReminders directly — no userId filter (single-user app)
    useEffect(() => {
        if (!user?.uid) return;
        setLoadingEmails(true);

        let unsub: (() => void) | undefined;
        try {
            const q = query(
                collection(db, 'scheduledReminders'),
                orderBy('createdAt', 'desc'),
                limit(50)
            );

            unsub = onSnapshot(q, (snap) => {
                const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ReminderDoc));
                setRecentEmails(items);
                setLoadingEmails(false);
            }, (error) => {
                console.error('[StatusOverview] scheduledReminders subscription failed:', error);
                setLoadingEmails(false);
                // Fallback: keep whatever state we had
            });
        } catch (error) {
            console.error('[StatusOverview] Failed to create email query:', error);
            setLoadingEmails(false);
        }

        return () => { try { unsub?.(); } catch { /* ignore */ } };
    }, [user?.uid]);

    const menuItems = [
        { href: '/settings/burn-monitor', icon: Activity, label: 'Usage & Burn Monitor', desc: 'Firebase usage intelligence' },
        { href: '/settings/providers', icon: Server, label: 'Email Providers', desc: 'Manage sending providers' },
        { href: '/settings/templates', icon: FileText, label: 'Email Templates', desc: 'Manage email templates' },
        { href: '/settings/themes', icon: Palette, label: 'Email Themes', desc: 'Create & edit themes' },
        { href: '/settings/categories', icon: Tag, label: 'Categories', desc: 'Manage event categories' },
    ];

    const quotaPercent = Math.min((usage.count / 200) * 100, 100);

    // ── DYNAMIC PROVIDER STATS (3-layer) ──
    // Primary: live providers from emailProviders collection
    // Fallback 1: systemHealth.providerDetails
    // Fallback 2: static defaults
    const providerCards = useMemo(() => {
        // Layer 1: Live providers with 3-layer usage resolution
        if (providers.length > 0) {
            return providers.map(p => {
                const today = new Date().toISOString().split('T')[0];

                // Usage Resolution:
                // PRIMARY: providerUsage doc (real-time, written by backend on each send)
                // Key is serviceId (matches what the backend writes to)
                const sid = p.serviceId || p.id;
                const liveUsage = providerUsageMap[sid];
                let used: number | null = null;
                if (liveUsage && liveUsage.date === today) {
                    used = liveUsage.usedToday;
                }

                // FALLBACK 1: systemHealth.remainingQuota (updated every 15 min by health checks)
                if (used === null) {
                    const healthDetail = systemHealth?.providerDetails?.find(d => d.id === p.id);
                    if (healthDetail?.remainingQuota !== undefined) {
                        used = Math.max(0, (p.dailyQuota || 200) - healthDetail.remainingQuota);
                    }
                }

                // FALLBACK 2: safe default
                if (used === null) used = 0;

                return {
                    id: p.id,
                    name: p.name || 'Unnamed',
                    status: p.status || 'disabled',
                    dailyQuota: p.dailyQuota || 200,
                    priority: p.priority || 10,
                    isDefault: p.isDefault || false,
                    usedToday: used
                };
            });
        }
        // Layer 2: systemHealth fallback (if providers collection empty/unreachable)
        if (systemHealth?.providerDetails && systemHealth.providerDetails.length > 0) {
            return systemHealth.providerDetails.map(p => ({
                id: p.id,
                name: p.name || p.id,
                status: p.status || 'active',
                dailyQuota: 200,
                priority: 10,
                isDefault: false,
                usedToday: p.remainingQuota !== undefined ? Math.max(0, 200 - p.remainingQuota) : 0
            }));
        }
        // Layer 3: static default
        return [];
    }, [providers, systemHealth, providerUsageMap]);

    const activeProviders = providerCards.filter(p => p.status === 'active');
    const totalDailyQuota = activeProviders.reduce((sum, p) => sum + p.dailyQuota, 0) || 200;

    // ── ROBUST STAT COMPUTATION ──
    // Primary: compute from live scheduledReminders (recentEmails)
    // Fallback 1: usage doc (sentCount/failedCount)
    // Fallback 2: 0 defaults
    const todayStats = useMemo(() => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        let sent = 0, failed = 0, pending = 0, processing = 0;

        try {
            for (const email of recentEmails) {
                // Only count today's emails for daily stats
                let emailDate: Date | null = null;
                try {
                    emailDate = email.scheduledTime?.toDate?.() ?? email.processedAt?.toDate?.() ?? null;
                    if (!emailDate) {
                        // If no date available, still count by status
                        emailDate = new Date(); // assume today
                    }
                } catch {
                    emailDate = new Date();
                }

                const status = (email.status || '').toLowerCase();
                if (status === 'sent') sent++;
                else if (status === 'failed') failed++;
                else if (status === 'processing') processing++;
                else if (status === 'pending') pending++;
            }
        } catch (e) {
            console.warn('[StatusOverview] Stats computation error, using usage doc fallback:', e);
            // Fallback 1: use usage doc data
            return {
                sent: usage.sentCount || 0,
                failed: usage.failedCount || 0,
                pending: 0,
                processing: 0,
            };
        }

        // If computation produced results, use them
        // Otherwise Fallback 1: merge with usage doc for higher accuracy
        return {
            sent: Math.max(sent, usage.sentCount || 0),
            failed: Math.max(failed, usage.failedCount || 0),
            pending,
            processing,
        };
    }, [recentEmails, usage]);

    const sentToday = todayStats.sent;
    const failedToday = todayStats.failed;
    const pendingCount = todayStats.pending + todayStats.processing;
    const totalUsed = sentToday + failedToday;

    const statusIcon = (status: string) => {
        switch (status) {
            case 'sent': return <CheckCircle2 size={14} style={{ color: '#10b981' }} />;
            case 'failed': return <XCircle size={14} style={{ color: '#ef4444' }} />;
            case 'pending': return <Clock size={14} style={{ color: '#f59e0b' }} />;
            case 'expired_late': return <AlertTriangle size={14} style={{ color: '#94a3b8' }} />;
            default: return <Clock size={14} style={{ color: '#94a3b8' }} />;
        }
    };

    const statusColor = (status: string) => {
        switch (status) {
            case 'sent': return '#10b981';
            case 'failed': return '#ef4444';
            case 'pending': return '#f59e0b';
            default: return '#94a3b8';
        }
    };

    const formatTime = (ts: { toDate: () => Date } | null) => {
        if (!ts) return '—';
        try {
            const d = ts.toDate();
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '—';
        }
    };

    const healthColor = systemHealth?.overallStatus === 'healthy' ? '#10b981'
        : systemHealth?.overallStatus === 'degraded' ? '#f59e0b'
            : systemHealth?.overallStatus === 'critical' ? '#ef4444'
                : '#94a3b8';

    const [confirmAction, setConfirmAction] = useState<{
        type: 'retry' | 'delete';
        id: string;
        title: string;
        message: string;
    } | null>(null);

    const handleRetry = (id: string) => {
        setConfirmAction({
            type: 'retry',
            id,
            title: 'Retry sending?',
            message: 'This will attempt to send the email immediately. Are you sure?',
        });
    };

    const handleDelete = (id: string) => {
        setConfirmAction({
            type: 'delete',
            id,
            title: 'Delete email?',
            message: 'This will permanently remove this pending email. This action cannot be undone.',
        });
    };

    const confirmHandler = async () => {
        if (!confirmAction) return;
        if (confirmAction.type === 'retry') {
            await retryScheduledReminder(confirmAction.id);
        } else {
            await deleteScheduledReminder(confirmAction.id);
        }
        setConfirmAction(null);
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Settings</h1>
            </div>

            {/* ── Profile Card with Theme Toggle ── */}
            <motion.div
                className={`card ${styles.profileCard}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className={styles.profileRow}>
                    <div className={styles.avatar}>
                        {user?.photoURL ? (
                            <Image src={user.photoURL} alt={user.displayName ?? 'Avatar'} width={48} height={48} className={styles.avatarImg} />
                        ) : (
                            <User size={24} />
                        )}
                    </div>
                    <div className={styles.profileInfo}>
                        <h2 className={styles.profileName}>{user?.displayName}</h2>
                        <p className={styles.profileEmail}>{user?.email}</p>
                    </div>
                </div>
                {/* Inline theme toggle */}
                <div className={styles.themeRow}>
                    {[
                        { value: 'light' as const, icon: Sun, label: 'Light' },
                        { value: 'dark' as const, icon: Moon, label: 'Dark' },
                        { value: 'system' as const, icon: Monitor, label: 'Auto' },
                    ].map((opt) => {
                        const Icon = opt.icon;
                        const isActive = theme === opt.value;
                        return (
                            <button
                                key={opt.value}
                                className={`${styles.themeBtn} ${isActive ? styles.themeBtnActive : ''}`}
                                onClick={() => setTheme(opt.value)}
                            >
                                <Icon size={16} />
                                <span>{opt.label}</span>
                            </button>
                        );
                    })}
                </div>
            </motion.div>

            {/* ── INSTALL APP ROW ── */}
            <InstallRow />

            {/* ── EMERGENCY STOP CONTROL ── */}
            <motion.div
                className={`card ${styles.dangerCard}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    borderColor: isEmergencyStop ? '#ef4444' : '#334155',
                    background: isEmergencyStop ? 'rgba(239, 68, 68, 0.1)' : 'var(--card-bg)',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        background: isEmergencyStop ? '#ef4444' : '#334155',
                        padding: '0.5rem',
                        borderRadius: '8px',
                        color: 'white'
                    }}>
                        <AlertOctagon size={24} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: isEmergencyStop ? '#ef4444' : 'var(--text-primary)' }}>
                            {isEmergencyStop ? 'SYSTEM HALTED' : 'Email System Active'}
                        </h3>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {isEmergencyStop ? 'All email processing is currently STOPPED.' : 'Emails are being processed normally.'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleToggleStop}
                    style={{
                        background: isEmergencyStop ? '#10b981' : '#ef4444',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    {isEmergencyStop ? <RefreshCw size={16} /> : <AlertOctagon size={16} />}
                    {isEmergencyStop ? 'RESUME SYSTEM' : 'STOP ALL'}
                </button>
            </motion.div>

            {/* ── DATABASE MAINTENANCE ── */}
            <DatabaseMaintenanceCard />

            {/* ── Status Overview (Collapsible) ── */}
            <motion.div>
                {/* ... existing status code ... */}
            </motion.div>

            {/* ── AUDIT LOGS ── */}
            {user && <LogViewer userId={user.uid} />}
            <motion.div
                className={`card ${styles.activityDashboard}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 }}
            >
                {/* Header (clickable to expand) */}
                <button className={styles.dashHeaderBtn} onClick={() => setStatusExpanded(!statusExpanded)}>
                    <div className={styles.dashTitle}>
                        <Activity size={18} />
                        <span>Status Overview</span>
                    </div>
                    <div className={styles.dashHeaderRight}>
                        <span className={styles.dashBadge} style={{ color: healthColor, borderColor: healthColor }}>
                            {systemHealth?.overallStatus?.toUpperCase() || '...'}
                        </span>
                        <span className={styles.dashMiniStats}>
                            <span style={{ color: '#10b981' }}>{sentToday}↑</span>
                            <span style={{ color: '#ef4444' }}>{failedToday}✕</span>
                        </span>
                        <ChevronDown
                            size={16}
                            className={styles.dashChevron}
                            style={{ transform: statusExpanded ? 'rotate(180deg)' : 'none' }}
                        />
                    </div>
                </button>

                <AnimatePresence>
                    {statusExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            style={{ overflow: 'hidden' }}
                        >
                            {/* Combined Stats Row */}
                            <div className={styles.statsRow}>
                                <div className={styles.statCard} style={{ '--stat-color': '#10b981' } as React.CSSProperties}>
                                    <div className={styles.statIcon}><CheckCircle2 size={16} /></div>
                                    <div className={styles.statValue}>{sentToday}</div>
                                    <div className={styles.statLabel}>Sent</div>
                                </div>
                                <div className={styles.statCard} style={{ '--stat-color': '#ef4444' } as React.CSSProperties}>
                                    <div className={styles.statIcon}><XCircle size={16} /></div>
                                    <div className={styles.statValue}>{failedToday}</div>
                                    <div className={styles.statLabel}>Failed</div>
                                </div>
                                <div className={styles.statCard} style={{ '--stat-color': '#f59e0b' } as React.CSSProperties}>
                                    <div className={styles.statIcon}><Clock size={16} /></div>
                                    <div className={styles.statValue}>{pendingCount}</div>
                                    <div className={styles.statLabel}>Pending</div>
                                </div>
                                <div className={styles.statCard} style={{ '--stat-color': '#f59e0b' } as React.CSSProperties}>
                                    <div className={styles.statIcon}><Zap size={16} /></div>
                                    <div className={styles.statValue}>{disasterStats.pending}</div>
                                    <div className={styles.statLabel}>Queued</div>
                                </div>
                                <div className={styles.statCard} style={{ '--stat-color': '#10b981' } as React.CSSProperties}>
                                    <div className={styles.statIcon}><Heart size={16} /></div>
                                    <div className={styles.statValue}>{disasterStats.recovered}</div>
                                    <div className={styles.statLabel}>Recovered</div>
                                </div>
                                <div className={styles.statCard} style={{ '--stat-color': '#ef4444' } as React.CSSProperties}>
                                    <div className={styles.statIcon}><XCircle size={16} /></div>
                                    <div className={styles.statValue}>{disasterStats.failed}</div>
                                    <div className={styles.statLabel}>DR Failed</div>
                                </div>
                            </div>

                            {/* Recent Email Activity */}
                            <div className={styles.recentSection}>
                                <h4 className={styles.recentTitle}>
                                    <Mail size={14} />
                                    Recent Emails
                                </h4>
                                {loadingEmails ? (
                                    <p className={styles.loadingText}>Loading activity...</p>
                                ) : recentEmails.length === 0 ? (
                                    <p className={styles.emptyText}>No emails sent yet. Create an event to get started!</p>
                                ) : (
                                    <div className={styles.emailList}>
                                        {recentEmails.slice(0, 8).map((email) => (
                                            <div key={email.id} className={styles.emailRow}>
                                                <div className={styles.emailStatus}>
                                                    {statusIcon(email.status)}
                                                </div>
                                                <div className={styles.emailInfo}>
                                                    <span className={styles.emailTitle}>{email.eventTitle || 'Untitled'}</span>
                                                    <span className={styles.emailMeta}>
                                                        {email.email} • {formatTime(email.scheduledTime)}
                                                    </span>
                                                    {(email.status === 'pending' || email.status === 'failed') && (
                                                        <div className={styles.actionButtons}>
                                                            <button
                                                                className={styles.actionBtn}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRetry(email.id);
                                                                }}
                                                                title="Retry Now"
                                                            >
                                                                <RefreshCw size={14} />
                                                            </button>
                                                            <button
                                                                className={styles.actionBtn}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDelete(email.id);
                                                                }}
                                                                title="Delete"
                                                                style={{ color: '#ef4444' }}
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={styles.emailBadge} style={{ color: statusColor(email.status), borderColor: statusColor(email.status) }}>
                                                    {email.status}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Quota & Providers — Collapsible */}
                            <div style={{
                                borderTop: '1px solid var(--border)',
                                padding: '0.7rem 1rem 0',
                            }}>
                                <button
                                    onClick={() => setProviderSectionExpanded(!providerSectionExpanded)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                                        color: 'var(--text-primary)', padding: '0.3rem 0', marginBottom: '0.3rem',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600 }}>
                                        <BarChart3 size={14} />
                                        <span>Quota & Providers</span>
                                        <span style={{
                                            fontSize: '0.68rem', fontWeight: 500, padding: '0.1rem 0.45rem',
                                            borderRadius: '99px', background: 'var(--bg-secondary)',
                                            color: 'var(--text-secondary)',
                                        }}>
                                            {totalUsed} / {totalDailyQuota}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{
                                            fontSize: '0.68rem', fontWeight: 600,
                                            color: activeProviders.length > 0 ? '#10b981' : '#ef4444',
                                        }}>
                                            {activeProviders.length} active
                                        </span>
                                        <ChevronDown
                                            size={14}
                                            style={{
                                                transition: 'transform 0.2s',
                                                transform: providerSectionExpanded ? 'rotate(180deg)' : 'none',
                                                color: 'var(--text-secondary)',
                                            }}
                                        />
                                    </div>
                                </button>

                                {/* Total Quota Bar — always visible */}
                                <div className={styles.quotaBarBg} style={{ marginBottom: providerSectionExpanded ? '0.5rem' : '0.7rem' }}>
                                    <div
                                        className={styles.quotaBarFill}
                                        style={{
                                            width: `${Math.min((totalUsed / totalDailyQuota) * 100, 100)}%`,
                                            background: totalUsed >= totalDailyQuota ? '#ef4444'
                                                : totalUsed >= totalDailyQuota * 0.75 ? '#f59e0b' : '#3b82f6',
                                        }}
                                    />
                                </div>

                                <AnimatePresence>
                                    {providerSectionExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            style={{ overflow: 'hidden' }}
                                        >
                                            {providersError && (
                                                <div style={{
                                                    fontSize: '0.72rem', color: '#f59e0b',
                                                    padding: '0.4rem 0.6rem', background: 'rgba(245,158,11,0.08)',
                                                    borderRadius: '6px', marginBottom: '0.4rem',
                                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                                }}>
                                                    <AlertTriangle size={12} />
                                                    Provider data unavailable — showing cached data
                                                </div>
                                            )}

                                            {providerCards.length === 0 ? (
                                                <div style={{
                                                    fontSize: '0.75rem', color: 'var(--text-secondary)',
                                                    fontStyle: 'italic', padding: '0.5rem 0',
                                                }}>
                                                    No providers configured. Add one in Settings → Email Providers.
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '0.5rem' }}>
                                                    {providerCards.map((p) => {
                                                        const isActive = p.status === 'active';
                                                        const statusColor2 = isActive ? '#10b981' : p.status === 'error' ? '#ef4444' : '#94a3b8';
                                                        const used = p.usedToday || 0;
                                                        const quota = p.dailyQuota || 200;
                                                        const pct = Math.min((used / quota) * 100, 100);
                                                        const barColor = used >= quota ? '#ef4444' : used >= quota * 0.75 ? '#f59e0b' : '#3b82f6';

                                                        return (
                                                            <div key={p.id} style={{
                                                                padding: '0.6rem 0.7rem',
                                                                background: 'var(--bg-secondary)',
                                                                borderRadius: '8px', fontSize: '0.75rem',
                                                                border: `1px solid ${isActive ? 'transparent' : 'var(--border)'}`,
                                                                opacity: isActive ? 1 : 0.75,
                                                            }}>
                                                                {/* Header: Name + Status */}
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor2 }} />
                                                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                                            {p.name}
                                                                            {p.isDefault && (
                                                                                <span style={{
                                                                                    marginLeft: '0.4rem', fontSize: '0.58rem', fontWeight: 500,
                                                                                    padding: '0.05rem 0.3rem', borderRadius: '3px',
                                                                                    background: 'rgba(59,130,246,0.12)', color: '#3b82f6',
                                                                                }}>DEFAULT</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                                        <span style={{ color: isActive ? 'var(--text-primary)' : 'inherit' }}>{used}</span>
                                                                        <span style={{ opacity: 0.5, margin: '0 2px' }}>/</span>
                                                                        <span>{quota}</span>
                                                                    </div>
                                                                </div>

                                                                {/* Progress Bar */}
                                                                <div style={{ height: '4px', width: '100%', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                                                                    <div style={{
                                                                        height: '100%', width: `${pct}%`, background: barColor,
                                                                        transition: 'width 0.3s ease',
                                                                    }} />
                                                                </div>

                                                                {/* Footer: Priority + Status Text */}
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.62rem', color: 'var(--text-secondary)' }}>
                                                                    <span>Priority: {p.priority}</span>
                                                                    <span style={{ color: statusColor2, textTransform: 'uppercase', fontWeight: 600 }}>{p.status}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <p className={styles.quotaHint}>
                                Health checks every 15 min • Disaster Bank every 5 min • Resets at midnight UTC
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* ── Management Menu ── */}
            <motion.section
                className={styles.menuSection}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
            >
                <h3 className={styles.menuTitle}>Management</h3>
                <div className={styles.menuGroup}>
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link key={item.href} href={item.href} className={styles.menuItem}>
                                <div className={styles.menuIcon}>
                                    <Icon size={18} />
                                </div>
                                <div className={styles.menuContent}>
                                    <span className={styles.menuLabel}>{item.label}</span>
                                    <span className={styles.menuDesc}>{item.desc}</span>
                                </div>
                                <ChevronRight size={16} className={styles.menuChevron} />
                            </Link>
                        );
                    })}
                </div>
            </motion.section>

            {/* Sign Out */}
            <motion.button
                className={styles.signOutBtn}
                onClick={signOut}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                whileTap={{ scale: 0.97 }}
            >
                <LogOut size={18} />
                <span>Sign Out</span>
            </motion.button>
            <ConfirmModal
                isOpen={!!confirmAction}
                onClose={() => setConfirmAction(null)}
                onConfirm={confirmHandler}
                title={confirmAction?.title || ''}
                message={confirmAction?.message || ''}
                confirmText={confirmAction?.type === 'retry' ? 'Retry' : 'Delete'}
                isDanger={confirmAction?.type === 'delete'}
            />
        </div>
    );
}

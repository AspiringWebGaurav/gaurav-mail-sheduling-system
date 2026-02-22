'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { subscribeProviders, addProvider, updateProvider, toggleProvider, deleteProvider } from '@/services/providerService';
import { useAppStore } from '@/stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Power, PowerOff, Edit3, Save, X, Shield, Zap, Server, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import type { EmailProvider } from '@/types';
import { AuthGuard } from '@/components/AuthGuard';
import LoginScreen from '@/components/LoginScreen';
import { AppShell } from '@/components/layout/AppShell';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from './providers.module.css';

interface ProviderUsageData {
    usedToday: number;
    date: string;
}

function ProvidersContent() {
    const { user } = useAuth();
    const showToast = useAppStore((s) => s.showToast);
    const [providers, setProviders] = useState<EmailProvider[]>([]);
    const [usageMap, setUsageMap] = useState<Record<string, ProviderUsageData>>({});
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formServiceId, setFormServiceId] = useState('');
    const [formTemplateId, setFormTemplateId] = useState('');
    const [formPublicKey, setFormPublicKey] = useState('');
    const [formPrivateKey, setFormPrivateKey] = useState('');
    const [formQuota, setFormQuota] = useState(200);
    const [formPriority, setFormPriority] = useState(10);
    const [showSecrets, setShowSecrets] = useState(false);
    const [saving, setSaving] = useState(false);

    // Real-time provider subscription
    useEffect(() => {
        if (!user) return;
        setLoading(true);
        const unsub = subscribeProviders(user.uid, (items) => {
            // Include system-created providers too
            setProviders(items);
            setLoading(false);
        });
        return () => unsub();
    }, [user]);

    // Stable key for provider IDs — prevents listener churn
    const providerIds = providers.map(p => p.id).join(',');

    // Subscribe to usage for each provider (stable dependency)
    useEffect(() => {
        if (!providerIds) return;
        const ids = providerIds.split(',');
        const today = new Date().toISOString().split('T')[0];
        const unsubs = ids.map((id) =>
            onSnapshot(doc(db, 'providerUsage', id), (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    setUsageMap((prev) => ({
                        ...prev,
                        [id]: {
                            usedToday: data.date === today ? (data.usedToday || 0) : 0,
                            date: data.date || today,
                        },
                    }));
                }
            })
        );
        return () => unsubs.forEach((u) => u());
    }, [providerIds]);

    const resetForm = useCallback(() => {
        setFormName('');
        setFormServiceId('');
        setFormTemplateId('');
        setFormPublicKey('');
        setFormPrivateKey('');
        setFormQuota(200);
        setFormPriority(10);
        setShowSecrets(false);
        setEditId(null);
        setShowAdd(false);
    }, []);

    const startEdit = (p: EmailProvider) => {
        setFormName(p.name);
        setFormServiceId(p.serviceId);
        setFormTemplateId(p.templateId);
        setFormPublicKey(p.publicKey);
        setFormPrivateKey(p.privateKey);
        setFormQuota(p.dailyQuota);
        setFormPriority(p.priority);
        setEditId(p.id);
        setShowAdd(true);
        setShowSecrets(false);
    };

    const handleSave = async () => {
        if (!user || !formName || !formServiceId || !formPublicKey) {
            showToast('Fill in all required fields', 'error');
            return;
        }
        setSaving(true);
        try {
            if (editId) {
                await updateProvider(editId, {
                    name: formName,
                    serviceId: formServiceId,
                    templateId: formTemplateId,
                    publicKey: formPublicKey,
                    privateKey: formPrivateKey,
                    dailyQuota: formQuota,
                    priority: formPriority,
                });
                showToast('Provider updated', 'success');
            } else {
                await addProvider({
                    name: formName,
                    serviceId: formServiceId,
                    templateId: formTemplateId,
                    publicKey: formPublicKey,
                    privateKey: formPrivateKey,
                    dailyQuota: formQuota,
                    priority: formPriority,
                    createdBy: user.uid,
                });
                showToast('Provider added!', 'success');
            }
            resetForm();
        } catch {
            showToast('Failed to save provider', 'error');
        }
        setSaving(false);
    };

    const handleToggle = async (p: EmailProvider) => {
        try {
            await toggleProvider(p.id, p.status !== 'active');
            showToast(`${p.name} ${p.status === 'active' ? 'disabled' : 'enabled'}`, 'success');
        } catch {
            showToast('Failed to toggle provider', 'error');
        }
    };

    const handleDelete = async (p: EmailProvider) => {
        if (p.isDefault) {
            showToast('Cannot delete default providers', 'error');
            return;
        }
        try {
            await deleteProvider(p.id);
            showToast(`${p.name} deleted`, 'success');
        } catch {
            showToast('Failed to delete provider', 'error');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return '#10b981';
            case 'disabled': return '#94a3b8';
            case 'error': return '#ef4444';
            default: return '#94a3b8';
        }
    };

    const getStatusLabel = (p: EmailProvider) => {
        const usage = usageMap[p.id];
        if (p.status !== 'active') return p.status;
        if (usage && usage.usedToday >= p.dailyQuota) return 'exhausted';
        return 'active';
    };

    const totalActive = providers.filter(p => p.status === 'active').length;
    const totalQuota = providers
        .filter(p => p.status === 'active')
        .reduce((sum, p) => sum + p.dailyQuota, 0);
    const totalUsed = providers
        .filter(p => p.status === 'active')
        .reduce((sum, p) => sum + (usageMap[p.id]?.usedToday || 0), 0);

    return (
        <div className="page-container">
            <div className={styles.topBar}>
                <Link href="/settings" className={styles.backBtn}><ArrowLeft size={20} /></Link>
                <h1 className="page-title">Email Providers</h1>
            </div>

            {/* Summary Stats */}
            <motion.div className={styles.statsBar} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className={styles.stat}>
                    <Server size={14} />
                    <span className={styles.statValue}>{totalActive}</span>
                    <span className={styles.statLabel}>Active</span>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.stat}>
                    <Zap size={14} />
                    <span className={styles.statValue}>{totalUsed}</span>
                    <span className={styles.statLabel}>Sent Today</span>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.stat}>
                    <Shield size={14} />
                    <span className={styles.statValue}>{totalQuota}</span>
                    <span className={styles.statLabel}>Total Quota</span>
                </div>
            </motion.div>

            {/* Add Provider Button */}
            <button className={`btn-primary ${styles.addBtn}`} onClick={() => { resetForm(); setShowAdd(true); }}>
                <Plus size={16} /> Add Provider
            </button>

            {/* Add / Edit Form */}
            <AnimatePresence>
                {showAdd && (
                    <motion.div
                        className={`card ${styles.formCard}`}
                        initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <div className={styles.formHeader}>
                            <h3>{editId ? 'Edit Provider' : 'Add New Provider'}</h3>
                            <button className={styles.closeBtn} onClick={resetForm}><X size={16} /></button>
                        </div>

                        <div className={styles.formGrid}>
                            <div className={styles.field}>
                                <label className="label">Provider Name *</label>
                                <input className="input-field" placeholder="e.g. My EmailJS Account" value={formName} onChange={e => setFormName(e.target.value)} />
                            </div>

                            <div className={styles.field}>
                                <label className="label">Service ID *</label>
                                <input className="input-field" placeholder="service_xxxxxxx" value={formServiceId} onChange={e => setFormServiceId(e.target.value)} />
                            </div>

                            <div className={styles.field}>
                                <label className="label">Template ID</label>
                                <input className="input-field" placeholder="template_xxxxxxx" value={formTemplateId} onChange={e => setFormTemplateId(e.target.value)} />
                            </div>

                            <div className={styles.fieldRow}>
                                <div className={styles.field}>
                                    <label className="label">Daily Quota</label>
                                    <input className="input-field" type="number" min={1} max={1000} value={formQuota} onChange={e => setFormQuota(Number(e.target.value))} />
                                </div>
                                <div className={styles.field}>
                                    <label className="label">Priority</label>
                                    <input className="input-field" type="number" min={1} max={100} value={formPriority} onChange={e => setFormPriority(Number(e.target.value))} />
                                    <span className={styles.hint}>Lower = higher priority</span>
                                </div>
                            </div>

                            <div className={styles.field}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label className="label">Public Key *</label>
                                    <button className={styles.toggleSecret} onClick={() => setShowSecrets(!showSecrets)}>
                                        {showSecrets ? <EyeOff size={14} /> : <Eye size={14} />}
                                        {showSecrets ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                                <input className="input-field" type={showSecrets ? 'text' : 'password'} placeholder="Public key" value={formPublicKey} onChange={e => setFormPublicKey(e.target.value)} />
                            </div>

                            <div className={styles.field}>
                                <label className="label">Private Key</label>
                                <input className="input-field" type={showSecrets ? 'text' : 'password'} placeholder="Private key (optional)" value={formPrivateKey} onChange={e => setFormPrivateKey(e.target.value)} />
                            </div>
                        </div>

                        <button className="btn-primary" onClick={handleSave} disabled={saving || !formName || !formServiceId || !formPublicKey} style={{ width: '100%', marginTop: 16 }}>
                            <Save size={16} /> {saving ? 'Saving...' : (editId ? 'Update Provider' : 'Add Provider')}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Provider List */}
            {loading ? (
                <div className="skeleton" style={{ height: 200, marginTop: 16, borderRadius: 'var(--radius-lg)' }} />
            ) : providers.length === 0 ? (
                <div className={styles.emptyState}>
                    <Server size={40} strokeWidth={1.2} />
                    <p>No providers configured</p>
                    <p className={styles.emptyHint}>Add an EmailJS provider to start sending emails</p>
                </div>
            ) : (
                <div className={styles.providerList}>
                    {providers.map((p, i) => {
                        const usage = usageMap[p.id];
                        const usedToday = usage?.usedToday || 0;
                        const quotaPercent = Math.min((usedToday / p.dailyQuota) * 100, 100);
                        const label = getStatusLabel(p);

                        return (
                            <motion.div
                                key={p.id}
                                className={`card ${styles.providerCard}`}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                data-status={label}
                            >
                                <div className={styles.cardHeader}>
                                    <div className={styles.providerMeta}>
                                        <div className={styles.statusDot} style={{ background: getStatusColor(p.status) }} />
                                        <div>
                                            <h3 className={styles.providerName}>{p.name}</h3>
                                            <span className={styles.providerService}>{p.serviceId}</span>
                                        </div>
                                    </div>
                                    <div className={styles.badges}>
                                        {p.isDefault && <span className={styles.defaultBadge}>Default</span>}
                                        <span className={styles.statusBadge} style={{ color: getStatusColor(p.status), borderColor: getStatusColor(p.status) }}>
                                            {label}
                                        </span>
                                    </div>
                                </div>

                                {/* Quota Bar */}
                                <div className={styles.quotaRow}>
                                    <span className={styles.quotaText}>{usedToday} / {p.dailyQuota}</span>
                                    <div className={styles.quotaBarBg}>
                                        <div
                                            className={styles.quotaBarFill}
                                            style={{
                                                width: `${quotaPercent}%`,
                                                background: quotaPercent >= 100 ? '#ef4444' : quotaPercent >= 75 ? '#f59e0b' : '#10b981',
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className={styles.cardActions}>
                                    <button className={styles.actionBtn} onClick={() => handleToggle(p)} title={p.status === 'active' ? 'Disable' : 'Enable'}>
                                        {p.status === 'active' ? <PowerOff size={15} /> : <Power size={15} />}
                                    </button>
                                    <button className={styles.actionBtn} onClick={() => startEdit(p)} title="Edit">
                                        <Edit3 size={15} />
                                    </button>
                                    {!p.isDefault && (
                                        <button className={`${styles.actionBtn} ${styles.deleteAction}`} onClick={() => handleDelete(p)} title="Delete">
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Info Card */}
            <motion.div className={styles.infoCard} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <h4>How Provider Rotation Works</h4>
                <ul>
                    <li><strong>Randomized Weighted Selection</strong> — Providers with more remaining quota are more likely to be selected</li>
                    <li><strong>Auto Failover</strong> — If a provider fails, the system automatically tries another</li>
                    <li><strong>Quota Enforcement</strong> — Each provider&apos;s daily limit is respected independently</li>
                    <li><strong>No Fixed Order</strong> — Selection is non-deterministic to avoid pattern detection</li>
                </ul>
            </motion.div>
        </div>
    );
}

export default function ProvidersPage() {
    return (
        <AuthGuard fallback={<LoginScreen />}>
            <AppShell>
                <ProvidersContent />
            </AppShell>
        </AuthGuard>
    );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    ArrowLeft, Flame, Eye, Pencil, Trash2, TrendingUp,
    AlertTriangle, Shield, Zap, ChevronRight, BarChart3, Activity
} from 'lucide-react';
import { useBurnStore } from '@/stores/burnStore';
import { setBurnUser, FREE_TIER, type WarningLevel } from '@/lib/burnTracker';
import { useAuth } from '@/providers/AuthProvider';
import styles from './BurnMonitor.module.css';

function formatNum(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

function getOverallLevel(w: { reads: WarningLevel; writes: WarningLevel; deletes: WarningLevel }): WarningLevel {
    const levels: WarningLevel[] = [w.reads, w.writes, w.deletes];
    if (levels.includes('critical')) return 'critical';
    if (levels.includes('warning')) return 'warning';
    if (levels.includes('caution')) return 'caution';
    return 'safe';
}

function getQuotaColor(pct: number): string {
    if (pct >= 100) return '#ef4444';
    if (pct >= 90) return '#ef4444';
    if (pct >= 70) return '#f59e0b';
    return '#10b981';
}

// ── SVG Bar Chart Component ──
function BarChart({ data, labels }: { data: { reads: number; writes: number; deletes: number }[]; labels: string[] }) {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
    const maxVal = Math.max(1, ...data.flatMap(d => [d.reads, d.writes, d.deletes]));
    const chartH = 120;
    const chartW = 100; // percentage
    const barGroupWidth = chartW / Math.max(data.length, 1);
    const barWidth = Math.min(barGroupWidth * 0.25, 8);
    const gap = 1;

    return (
        <div className={styles.chartWrap}>
            <svg className={styles.chartSvg} viewBox={`0 0 ${data.length * 20} ${chartH + 20}`} preserveAspectRatio="none">
                {/* Grid lines */}
                {[0.25, 0.5, 0.75].map(pct => (
                    <line
                        key={pct}
                        x1="0"
                        y1={chartH * (1 - pct)}
                        x2={data.length * 20}
                        y2={chartH * (1 - pct)}
                        className={styles.chartGrid}
                    />
                ))}

                {data.map((d, i) => {
                    const x = i * 20 + 4;
                    const rH = (d.reads / maxVal) * chartH;
                    const wH = (d.writes / maxVal) * chartH;
                    const dH = (d.deletes / maxVal) * chartH;

                    return (
                        <g key={i}
                            onMouseEnter={(e) => {
                                const rect = (e.currentTarget as SVGGElement).getBoundingClientRect();
                                setTooltip({
                                    x: rect.left + rect.width / 2,
                                    y: rect.top - 10,
                                    text: `${labels[i]}: R:${d.reads} W:${d.writes} D:${d.deletes}`,
                                });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                        >
                            <rect
                                x={x} y={chartH - rH} width={barWidth} height={Math.max(rH, 0.5)}
                                fill="#6366f1" className={styles.chartBar} rx="1"
                            />
                            <rect
                                x={x + barWidth + gap} y={chartH - wH} width={barWidth} height={Math.max(wH, 0.5)}
                                fill="#10b981" className={styles.chartBar} rx="1"
                            />
                            <rect
                                x={x + (barWidth + gap) * 2} y={chartH - dH} width={barWidth} height={Math.max(dH, 0.5)}
                                fill="#ef4444" className={styles.chartBar} rx="1"
                            />
                            {/* Label */}
                            <text x={x + barWidth * 1.5 + gap} y={chartH + 14} className={styles.chartLabel}>
                                {labels[i]}
                            </text>
                        </g>
                    );
                })}
            </svg>
            {tooltip && (
                <div className={styles.chartTooltip} style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}>
                    {tooltip.text}
                </div>
            )}
            <div className={styles.chartLegend}>
                <span className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: '#6366f1' }} /> Reads
                </span>
                <span className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: '#10b981' }} /> Writes
                </span>
                <span className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: '#ef4444' }} /> Deletes
                </span>
            </div>
        </div>
    );
}

// ── Burn Score Ring ──
function ScoreRing({ score }: { score: number }) {
    const r = 50;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

    return (
        <div className={styles.scoreRing}>
            <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle
                    cx="60" cy="60" r={r} fill="none"
                    stroke={color} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
            </svg>
            <div className={styles.scoreValue}>
                {score}
                <span>/ 100</span>
            </div>
        </div>
    );
}

export default function BurnMonitorPage() {
    const router = useRouter();
    const { user } = useAuth();
    const store = useBurnStore();
    const [chartView, setChartView] = useState<'hourly' | 'daily'>('hourly');

    // Set user for Firestore flush
    useEffect(() => {
        if (user?.uid) setBurnUser(user.uid);
    }, [user?.uid]);

    // ── POWERED BY BURN ENGINE ──
    // Subscribe to server-side authoritative counters
    useEffect(() => {
        if (!user?.uid) return;
        const today = new Date().toISOString().split('T')[0];

        // Lightweight Listener: Only updates when server-side counters change
        const unsub = onSnapshot(doc(db, 'users', user.uid, 'usage', today), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                // Inject server data into store
                useBurnStore.setState(prev => ({
                    todayTotals: {
                        reads: data.reads || 0,
                        writes: data.writes || 0,
                        deletes: data.deletes || 0,
                    },
                    // Map Firestore 'hourly.X' map to store 'hourlyHistory'
                    hourlyHistory: data.hourly || {},
                    // We can also update projection based on this new truth
                    projection: {
                        reads: (data.reads || 0) * 1.5, // Simple projection
                        writes: (data.writes || 0) * 1.5,
                        deletes: (data.deletes || 0) * 1.5,
                    }
                }));
            }
        });

        return () => unsub();
    }, [user?.uid]);

    // Refresh store every 3 seconds (local animations)
    useEffect(() => {
        store.refresh(); // Syncs local interactions
        const interval = setInterval(() => store.refresh(), 3000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const overallLevel = getOverallLevel(store.warnings);
    const readPct = (store.todayTotals.reads / FREE_TIER.READS_PER_DAY) * 100;
    const writePct = (store.todayTotals.writes / FREE_TIER.WRITES_PER_DAY) * 100;
    const deletePct = (store.todayTotals.deletes / FREE_TIER.DELETES_PER_DAY) * 100;

    // Build chart data
    const hourlyData: { reads: number; writes: number; deletes: number }[] = [];
    const hourlyLabels: string[] = [];
    for (let h = 0; h < 24; h++) {
        const slot = store.hourlyHistory[String(h)] || { reads: 0, writes: 0, deletes: 0 };
        hourlyData.push(slot);
        hourlyLabels.push(`${h}h`);
    }

    const dailyData = store.dailyHistory.map(d => ({
        reads: d.reads, writes: d.writes, deletes: d.deletes,
    }));
    const dailyLabels = store.dailyHistory.map(d => {
        const parts = d.date.split('-');
        return `${parts[1]}/${parts[2]}`;
    });

    // Recommendations
    const recommendations: string[] = [];
    if (readPct > 50) recommendations.push('Consider enabling Safe Mode to reduce real-time listener frequency.');
    if (store.anomalies.some(a => a.type === 'loop_detected')) recommendations.push('Loop detected — check for components re-mounting listeners excessively.');
    if (writePct > 30) recommendations.push('Batch operations where possible to reduce write count.');
    if (readPct < 10 && writePct < 10) recommendations.push('Usage is very efficient. All systems nominal. 🟢');

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <motion.button
                    className={styles.backBtn}
                    onClick={() => router.back()}
                    whileTap={{ scale: 0.92 }}
                >
                    <ArrowLeft size={18} />
                </motion.button>
                <div className={styles.headerInfo}>
                    <h1>Burn Monitor</h1>
                    <p className={styles.headerSub}>Firebase Usage Intelligence</p>
                </div>
            </div>

            {/* Burn Efficiency Score */}
            <motion.div
                className={styles.scoreCard}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <ScoreRing score={store.burnScore} />
                <div className={styles.scoreLabel}>Burn Efficiency Score</div>
                <div className={styles.statusBadge} data-level={overallLevel}>
                    {overallLevel === 'safe' && <Shield size={10} />}
                    {overallLevel === 'caution' && <AlertTriangle size={10} />}
                    {overallLevel === 'warning' && <AlertTriangle size={10} />}
                    {overallLevel === 'critical' && <Flame size={10} />}
                    {overallLevel.toUpperCase()}
                </div>
            </motion.div>

            {/* Live Counters */}
            <motion.div
                className={styles.countersGrid}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
            >
                {/* Reads */}
                <div className={styles.counterCard}>
                    <div className={styles.counterIcon} style={{ color: '#6366f1' }}>
                        <Eye size={16} />
                    </div>
                    <div className={styles.counterValue}>{formatNum(store.todayTotals.reads)}</div>
                    <div className={styles.counterLabel}>Reads</div>
                    <div className={styles.counterQuota}>
                        / {formatNum(FREE_TIER.READS_PER_DAY)}
                    </div>
                    <div className={styles.quotaBar}>
                        <div
                            className={styles.quotaFill}
                            style={{
                                width: `${Math.min(readPct, 100)}%`,
                                background: getQuotaColor(readPct),
                            }}
                        />
                    </div>
                </div>

                {/* Writes */}
                <div className={styles.counterCard}>
                    <div className={styles.counterIcon} style={{ color: '#10b981' }}>
                        <Pencil size={16} />
                    </div>
                    <div className={styles.counterValue}>{formatNum(store.todayTotals.writes)}</div>
                    <div className={styles.counterLabel}>Writes</div>
                    <div className={styles.counterQuota}>
                        / {formatNum(FREE_TIER.WRITES_PER_DAY)}
                    </div>
                    <div className={styles.quotaBar}>
                        <div
                            className={styles.quotaFill}
                            style={{
                                width: `${Math.min(writePct, 100)}%`,
                                background: getQuotaColor(writePct),
                            }}
                        />
                    </div>
                </div>

                {/* Deletes */}
                <div className={styles.counterCard}>
                    <div className={styles.counterIcon} style={{ color: '#ef4444' }}>
                        <Trash2 size={16} />
                    </div>
                    <div className={styles.counterValue}>{formatNum(store.todayTotals.deletes)}</div>
                    <div className={styles.counterLabel}>Deletes</div>
                    <div className={styles.counterQuota}>
                        / {formatNum(FREE_TIER.DELETES_PER_DAY)}
                    </div>
                    <div className={styles.quotaBar}>
                        <div
                            className={styles.quotaFill}
                            style={{
                                width: `${Math.min(deletePct, 100)}%`,
                                background: getQuotaColor(deletePct),
                            }}
                        />
                    </div>
                </div>
            </motion.div>

            {/* Hourly / Daily Chart */}
            <motion.div
                className={styles.section}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                        <BarChart3 size={16} />
                        Burn Trends
                    </div>
                    <div className={styles.sectionToggle}>
                        <button
                            className={styles.toggleBtn}
                            data-active={chartView === 'hourly'}
                            onClick={() => setChartView('hourly')}
                        >
                            Hourly
                        </button>
                        <button
                            className={styles.toggleBtn}
                            data-active={chartView === 'daily'}
                            onClick={() => setChartView('daily')}
                        >
                            Daily
                        </button>
                    </div>
                </div>

                {chartView === 'hourly' ? (
                    <BarChart data={hourlyData} labels={hourlyLabels} />
                ) : dailyData.length > 0 ? (
                    <BarChart data={dailyData} labels={dailyLabels} />
                ) : (
                    <div className={styles.emptyState}>No daily history yet. Check back tomorrow.</div>
                )}
            </motion.div>

            {/* End-of-Day Projection */}
            <motion.div
                className={styles.section}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
            >
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                        <TrendingUp size={16} />
                        Projected End-of-Day
                    </div>
                </div>
                <div className={styles.projGrid}>
                    <div className={styles.projItem}>
                        <div className={styles.projValue} style={{ color: '#6366f1' }}>
                            {formatNum(store.projection.reads)}
                        </div>
                        <div className={styles.projLabel}>Reads</div>
                    </div>
                    <div className={styles.projItem}>
                        <div className={styles.projValue} style={{ color: '#10b981' }}>
                            {formatNum(store.projection.writes)}
                        </div>
                        <div className={styles.projLabel}>Writes</div>
                    </div>
                    <div className={styles.projItem}>
                        <div className={styles.projValue} style={{ color: '#ef4444' }}>
                            {formatNum(store.projection.deletes)}
                        </div>
                        <div className={styles.projLabel}>Deletes</div>
                    </div>
                </div>
            </motion.div>

            {/* Anomaly Feed */}
            <motion.div
                className={styles.section}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                        <AlertTriangle size={16} />
                        Anomaly Feed
                    </div>
                </div>
                {store.anomalies.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Shield size={24} style={{ marginBottom: 8, opacity: 0.4 }} /><br />
                        No anomalies detected. All clear.
                    </div>
                ) : (
                    <div className={styles.anomalyList}>
                        {store.anomalies.slice(-5).reverse().map((a, i) => (
                            <div key={i} className={styles.anomalyItem} data-type={a.type}>
                                <div className={styles.anomalyIcon}>
                                    {a.type === 'loop_detected'
                                        ? <Zap size={14} style={{ color: '#ef4444' }} />
                                        : <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
                                    }
                                </div>
                                <div>
                                    <div className={styles.anomalyText}>{a.message}</div>
                                    <div className={styles.anomalyTime}>
                                        {new Date(a.timestamp).toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>

            {/* Safe Mode Toggle */}
            <motion.div
                className={styles.safeToggle}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
            >
                <div className={styles.safeInfo}>
                    <div className={styles.safeIcon}>
                        <Shield size={20} />
                    </div>
                    <div>
                        <div className={styles.safeLabel}>Safe Mode</div>
                        <div className={styles.safeDesc}>Reduce listener frequency to save quota</div>
                    </div>
                </div>
                <label className={styles.switch}>
                    <input
                        type="checkbox"
                        className={styles.switchInput}
                        checked={store.safeMode}
                        onChange={() => store.toggleSafeMode()}
                    />
                    <span className={styles.switchTrack} />
                </label>
            </motion.div>

            {/* Simulation Tools */}
            <motion.div
                className={styles.section}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
            >
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                        <Zap size={16} />
                        Simulation
                    </div>
                </div>
                <motion.button
                    className={styles.backBtn}
                    style={{ width: '100%', borderRadius: '8px', fontSize: '0.85rem', height: '40px', gap: '8px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px dashed #6366f1' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                        // Client-side simulation
                        const reads = Math.floor(Math.random() * 500) + 100;
                        const writes = Math.floor(Math.random() * 50) + 10;
                        useBurnStore.getState().refresh();
                        useBurnStore.setState(prev => ({
                            todayTotals: {
                                reads: prev.todayTotals.reads + reads,
                                writes: prev.todayTotals.writes + writes,
                                deletes: prev.todayTotals.deletes
                            },
                            anomalies: [
                                {
                                    type: 'spike_reads',
                                    message: `Simulated Spike: +${reads} reads detected`,
                                    timestamp: Date.now(),
                                    value: reads,
                                    threshold: 100
                                },
                                ...prev.anomalies
                            ]
                        }));
                    }}
                >
                    <Flame size={16} />
                    Simulate Traffic Spike
                </motion.button>
            </motion.div>

            {/* Recommendations */}
            <motion.div
                className={styles.section}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}>
                        <Activity size={16} />
                        Recommendations
                    </div>
                </div>
                <div className={styles.recList}>
                    {recommendations.map((rec, i) => (
                        <div key={i} className={styles.recItem}>
                            <ChevronRight size={12} className={styles.recBullet} />
                            <span>{rec}</span>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bell, BellOff, Download, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { useInstall } from '@/providers/InstallProvider';
import styles from './InstallPrompt.module.css';

const SNOOZE_OPTIONS = [
    { label: 'Remind me later', icon: Bell, minutes: 0 }, // Just dismisses for now
    { label: 'Silence for 1 hour', icon: BellOff, minutes: 60 },
    { label: 'Silence for 24 hours', icon: BellOff, minutes: 1440 },
    { label: 'Don\'t ask again this session', icon: RotateCcw, minutes: -1 },
] as const;

export function InstallPrompt() {
    const { showPrompt, install, hidePrompt, snoozePrompt } = useInstall();
    const [showSnooze, setShowSnooze] = useState(false);

    const handleSnooze = (minutes: number) => {
        if (minutes === 0) {
            hidePrompt();
        } else {
            snoozePrompt(minutes);
        }
        setShowSnooze(false);
    };

    return (
        <AnimatePresence>
            {showPrompt && (
                <motion.div
                    className={styles.banner}
                    initial={{ opacity: 0, y: '100%' }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: '100%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                    {/* Main Content */}
                    <div className={styles.mainContent}>
                        <div className={styles.iconContainer}>
                            <div className={styles.appIcon}>
                                <Download size={20} color="white" />
                            </div>
                        </div>

                        <div className={styles.textContent}>
                            <h3 className={styles.title}>Install GMSS</h3>
                            <p className={styles.description}>
                                Add to home screen for the best experience
                            </p>
                        </div>

                        <div className={styles.actions}>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                className={styles.installBtn}
                                onClick={install}
                            >
                                Install
                            </motion.button>
                            <button
                                className={styles.closeBtn}
                                onClick={() => setShowSnooze(!showSnooze)}
                                aria-label="Dismiss options"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Snooze Options (Expandable) */}
                    <AnimatePresence>
                        {showSnooze && (
                            <motion.div
                                className={styles.snoozePanel}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className={styles.snoozeDivider} />
                                <div className={styles.snoozeGrid}>
                                    {SNOOZE_OPTIONS.map((opt) => {
                                        const Icon = opt.icon;
                                        return (
                                            <button
                                                key={opt.minutes}
                                                className={styles.snoozeOption}
                                                onClick={() => handleSnooze(opt.minutes)}
                                            >
                                                <Icon size={14} className={styles.snoozeIcon} />
                                                <span>{opt.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

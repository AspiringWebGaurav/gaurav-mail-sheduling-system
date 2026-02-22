'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, CalendarDays, PlusCircle, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import styles from './BottomNav.module.css';

const tabs = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/calendar', icon: CalendarDays, label: 'Calendar' },
    { href: '/create', icon: PlusCircle, label: 'Create', isCenter: true },
    { href: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className={styles.nav}>
            <div className={styles.inner}>
                {tabs.map((tab) => {
                    const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
                    const Icon = tab.icon;

                    if (tab.isCenter) {
                        return (
                            <Link key={tab.href} href={tab.href} className={styles.centerTab}>
                                <motion.div
                                    className={styles.centerBtn}
                                    whileHover={{ scale: 1.05, boxShadow: "0 8px 30px var(--accent-primary-glow)" }}
                                    whileTap={{ scale: 0.9, boxShadow: "0 2px 10px var(--accent-primary-glow)" }}
                                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                                >
                                    <Icon size={26} strokeWidth={2} />
                                </motion.div>
                            </Link>
                        );
                    }

                    return (
                        <Link key={tab.href} href={tab.href} className={`${styles.tab} ${isActive ? styles.active : ''}`}>
                            <motion.div
                                className={styles.iconWrap}
                                whileTap={{ scale: 0.85 }}
                            >
                                <Icon size={24} strokeWidth={isActive ? 2.5 : 1.8} />
                                {isActive && (
                                    <motion.div
                                        className={styles.indicator}
                                        layoutId="nav-indicator"
                                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                    />
                                )}
                            </motion.div>
                            <span className={styles.label}>{tab.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

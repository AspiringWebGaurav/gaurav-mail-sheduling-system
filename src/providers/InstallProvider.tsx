'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallContextType {
    isInstallable: boolean;
    isInstalled: boolean;
    showPrompt: boolean;
    install: () => Promise<void>;
    hidePrompt: () => void;
    snoozePrompt: (minutes: number) => void;
}

const InstallContext = createContext<InstallContextType | undefined>(undefined);

export const STORAGE_KEYS = {
    installed: 'gmss-installed',
    silencedUntil: 'gmss-install-silenced-until',
    sessionHide: 'gmss-install-session-hide',
} as const;

export function InstallProvider({ children }: { children: React.ReactNode }) {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Check if already installed via storage or standalone mode
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        const storedInstalled = localStorage.getItem(STORAGE_KEYS.installed);

        if (isStandalone || storedInstalled) {
            setIsInstalled(true);
        }
    }, []);

    const isSuppressed = useCallback((): boolean => {
        try {
            if (localStorage.getItem(STORAGE_KEYS.installed)) return true;
            if (sessionStorage.getItem(STORAGE_KEYS.sessionHide)) return true;
            const silencedUntil = localStorage.getItem(STORAGE_KEYS.silencedUntil);
            if (silencedUntil) {
                const until = parseInt(silencedUntil, 10);
                if (Date.now() < until) return true;
                localStorage.removeItem(STORAGE_KEYS.silencedUntil);
            }
        } catch { }
        return false;
    }, []);

    useEffect(() => {
        if (!mounted) return;
        if (isInstalled) return;

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);

            // Only show if not suppressed
            if (!isSuppressed()) {
                // Small delay for better UX
                setTimeout(() => setShowPrompt(true), 2000);
            }
        };

        const installedHandler = () => {
            setIsInstalled(true);
            setShowPrompt(false);
            setDeferredPrompt(null);
            localStorage.setItem(STORAGE_KEYS.installed, '1');
        };

        window.addEventListener('beforeinstallprompt', handler);
        window.addEventListener('appinstalled', installedHandler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', installedHandler);
        };
    }, [mounted, isInstalled, isSuppressed]);

    const install = async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setIsInstalled(true);
            setShowPrompt(false);
            setDeferredPrompt(null);
            try { localStorage.setItem(STORAGE_KEYS.installed, '1'); } catch { }
        }
    };

    const hidePrompt = () => {
        setShowPrompt(false);
    };

    const snoozePrompt = (minutes: number) => {
        setShowPrompt(false);
        try {
            if (minutes === -1) {
                sessionStorage.setItem(STORAGE_KEYS.sessionHide, '1');
            } else if (minutes > 0) {
                const until = Date.now() + minutes * 60 * 1000;
                localStorage.setItem(STORAGE_KEYS.silencedUntil, until.toString());
            }
        } catch { }
    };

    return (
        <InstallContext.Provider value={{
            isInstallable: !!deferredPrompt && !isInstalled,
            isInstalled,
            showPrompt,
            install,
            hidePrompt,
            snoozePrompt
        }}>
            {children}
        </InstallContext.Provider>
    );
}

export function useInstall() {
    const context = useContext(InstallContext);
    if (!context) {
        throw new Error('useInstall must be used within an InstallProvider');
    }
    return context;
}

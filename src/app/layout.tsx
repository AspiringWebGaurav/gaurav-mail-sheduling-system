import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { AuthProvider } from '@/providers/AuthProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { ToastWrapper } from '@/components/ui/ToastWrapper';
import { DevModePoller } from '@/components/layout/DevModePoller';
import { SystemControlProvider } from '@/providers/SystemControlProvider';
import { InstallProvider } from '@/providers/InstallProvider';
import { GlobalHaltBanner } from '@/components/ui/GlobalHaltBanner';

const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-inter',
});

const APP_URL = 'https://gmss.vercel.app';

export const metadata: Metadata = {
    title: 'GMSS — Gaurav\'s Mail Scheduler System',
    description: 'Smart, automated email scheduling and reminder system. Multi-provider load balancing, disaster recovery, and precision scheduling — built and engineered by Gaurav Patil.',
    manifest: '/manifest.json',
    applicationName: 'GMSS',
    authors: [{ name: 'Gaurav Patil', url: 'https://www.gauravpatil.online' }],
    creator: 'Gaurav Patil',
    publisher: 'Gaurav Patil',
    keywords: ['email scheduler', 'mail automation', 'GMSS', 'Gaurav Patil', 'email reminders', 'scheduling system'],
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
        },
    },
    alternates: {
        canonical: APP_URL,
    },
    openGraph: {
        type: 'website',
        url: APP_URL,
        title: 'GMSS — Smart Email Scheduling & Automation',
        description: 'Automated email scheduling with multi-provider load balancing, disaster recovery, and precision timing. Built by Gaurav Patil.',
        siteName: 'GMSS',
        images: [
            {
                url: `${APP_URL}/og-image.svg`,
                width: 1200,
                height: 630,
                alt: 'GMSS — Gaurav\'s Mail Scheduler System',
                type: 'image/svg+xml',
            },
        ],
        locale: 'en_US',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'GMSS — Smart Email Scheduling & Automation',
        description: 'Automated email scheduling with multi-provider load balancing and disaster recovery.',
        images: [`${APP_URL}/og-image.svg`],
        creator: '@gauravpatil',
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'GMSS',
    },
    icons: {
        icon: [
            { url: '/icons/icon.svg', type: 'image/svg+xml' },
            { url: '/icons/icon.svg', sizes: '32x32' },
        ],
        apple: '/icons/icon.svg',
    },
    other: {
        'msapplication-TileColor': '#6c5ce7',
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: '#0a0a0f',
    viewportFit: 'cover',
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'GMSS — Gaurav\'s Mail Scheduler System',
    description: 'Smart, automated email scheduling and reminder system with multi-provider load balancing.',
    url: APP_URL,
    applicationCategory: 'Productivity',
    operatingSystem: 'Web',
    author: {
        '@type': 'Person',
        name: 'Gaurav Patil',
        url: 'https://www.gauravpatil.online',
    },
    offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
    },
};

const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('gmss_theme') || 'dark';
    var r = t;
    if (t === 'system') r = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    if (r === 'light') document.documentElement.setAttribute('data-theme', 'light');
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', r === 'light' ? '#f5f5f7' : '#0a0a0f');
  } catch(e) {}
})()
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={inter.variable} suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            </head>
            <body>
                <SystemControlProvider>
                    <ThemeProvider>
                        <AuthProvider>
                            <InstallProvider>
                                <GlobalHaltBanner />
                                {children}
                                <ToastWrapper />
                                {process.env.NODE_ENV === 'development' && <DevModePoller />}
                            </InstallProvider>
                        </AuthProvider>
                    </ThemeProvider>
                </SystemControlProvider>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
                    }}
                />
            </body>
        </html>
    );
}

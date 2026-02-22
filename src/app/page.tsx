'use client';

import { AuthGuard } from '@/components/AuthGuard';
import LoginScreen from '@/components/LoginScreen';
import { AppShell } from '@/components/layout/AppShell';
import dynamic from 'next/dynamic';
import { GlobalLoader } from '@/components/ui/GlobalLoader';

const HomePage = dynamic(() => import('@/components/pages/HomePage'), {
  loading: () => <GlobalLoader />,
});

export default function Page() {
  return (
    <AuthGuard fallback={<LoginScreen />}>
      <AppShell>
        <HomePage />
      </AppShell>
    </AuthGuard>
  );
}

'use client';

import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

function PrivyAuthSync() {
  const { user, ready, authenticated } = usePrivy();
  const router = useRouter();
  const lastSyncedId = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated || !user?.id) return;
    if (lastSyncedId.current === user.id) return;
    lastSyncedId.current = user.id;

    (async () => {
      try {
        const res = await fetch('/api/auth/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privyId: user.id,
            walletAddress: user.wallet?.address,
            email: user.email?.address || user.google?.email || user.apple?.email,
          }),
        });
        const data = await res.json();
        if (data.success) {
          router.refresh();
        }
      } catch (error) {
        console.error('Failed to sync authentication:', error);
      }
    })();
  }, [ready, authenticated, user, router]);

  return null;
}

function isDemoPrivyAppId(appId: string | undefined): boolean {
  if (!appId || appId.trim() === '') return true;
  const lower = appId.toLowerCase();
  if (lower.includes('your-') || lower.includes('your_')) return true;
  if (lower === 'your_privy_app_id_here') return true;
  // Real Privy app IDs are long alphanumeric strings (e.g. clxxxxxxxx...)
  if (appId.length < 20) return true;
  return false;
}

export default function PrivyAuthProvider({ children }: { children: React.ReactNode }) {
  const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (isDemoPrivyAppId(APP_ID)) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={APP_ID as string}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#A37E2C',
          logo: 'https://raw.githubusercontent.com/lucide-react/lucide/main/icons/gem.svg',
          showWalletLoginFirst: true,
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'all-users',
          },
        },
        loginMethods: ['wallet', 'email', 'google', 'apple'],
      }}
    >
      <PrivyAuthSync />
      {children}
    </PrivyProvider>
  );
}

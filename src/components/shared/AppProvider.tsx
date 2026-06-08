'use client';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';

/**
 * AppProvider — top-level client component that hydrates auth state
 * from the server via /api/auth/me on every page load.
 * Must wrap the entire app in layout.tsx.
 * No localStorage ever touched.
 */
export function AppProvider({ children }: { children: React.ReactNode }) {
  const hydrateFromServer = useStore(s => s.hydrateFromServer);

  useEffect(() => {
    // Hydrate auth from the httpOnly session cookie via /api/auth/me
    hydrateFromServer();
  }, [hydrateFromServer]);

  return <>{children}</>;
}

'use client';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';

/**
 * AuthHydrator v2.0 — hydrates auth from /api/auth/me (httpOnly cookie).
 * No localStorage. No XSS risk. Session is validated server-side.
 */
export default function AuthHydrator() {
  const hydrateFromServer = useStore(s => s.hydrateFromServer);
  useEffect(() => {
    void fetch('/api/csrf', { credentials: 'include' }).catch(() => {});
    void hydrateFromServer();
  }, [hydrateFromServer]);
  return null;
}

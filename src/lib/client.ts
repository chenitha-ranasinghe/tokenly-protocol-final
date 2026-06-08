/**
 * Client-side auth helpers — v2.0
 *
 * All auth state lives in the Zustand store, which is hydrated from
 * /api/auth/me. No localStorage reads or writes for auth data.
 */
import { useStore } from './store';
import type { User } from './types';

/** Get current user from Zustand store — always server-hydrated */
export function getUser(): User | null {
  return useStore.getState().user;
}

/** Set auth user in Zustand store (after login response) */
export function setAuthUser(user: User): void {
  useStore.getState().setUser(user);
}

/** Clear auth state (on logout) */
export function clearAuthUser(): void {
  useStore.getState().setUser(null);
}

/** Re-hydrate auth from server — call after login/logout */
export async function refreshAuth(): Promise<User | null> {
  await useStore.getState().hydrateFromServer();
  return useStore.getState().user;
}

/** Backward-compat alias for clearAuthUser */
export const clearAuth = clearAuthUser;

/** Read non-httpOnly cookie for double-submit CSRF (set by GET /api/csrf). */
function readBrowserCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Fetch with credentials (httpOnly cookie) included */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  const csrf = readBrowserCookie('tokenly_csrf');
  if (csrf && !headers.has('x-csrf-token')) {
    headers.set('x-csrf-token', csrf);
  }
  return fetch(url, {
    ...options,
    headers,
    credentials: options.credentials === 'omit' ? 'omit' : 'include',
  });
}

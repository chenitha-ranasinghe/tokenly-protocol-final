/**
 * Tokenly Global State Store — v2.0
 *
 * Auth state is NEVER stored in localStorage. It is always hydrated
 * from /api/auth/me (httpOnly cookie-backed) on mount.
 * localStorage is used only for non-sensitive UI preferences.
 */
import { create } from 'zustand';
import type { User, ToastItem, ToastType } from './types';

interface AppState {
  user: User | null;
  hydrated: boolean;
  toasts: ToastItem[];

  // Auth actions — always server-driven via httpOnly cookie
  setUser: (user: User | null) => void;
  hydrateFromServer: () => Promise<void>;
  logout: () => Promise<void>;

  // Toast actions
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  hydrated: false,
  toasts: [],

  setUser: (user) => set({ user }),

  /**
   * Hydrate auth state from the server via /api/auth/me.
   * The session is validated server-side using the httpOnly cookie.
   * No localStorage involved — cannot be stolen by XSS.
   */
  hydrateFromServer: async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as { user: User | null };
        set({ user: data.user ?? null, hydrated: true });
      } else {
        set({ user: null, hydrated: true });
      }
    } catch {
      set({ user: null, hydrated: true });
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch { /* best-effort */ }
    set({ user: null });
  },

  addToast: (message, type = 'info', duration = 4000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set(s => ({ toasts: [...s.toasts, { id, message, type, duration }] }));
    if (duration > 0) {
      setTimeout(() => get().removeToast(id), duration);
    }
  },

  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

// Backward-compat alias — prefer useStore in new code
export const useAuthStore = useStore;

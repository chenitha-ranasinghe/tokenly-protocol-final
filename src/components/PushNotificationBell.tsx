'use client';

/**
 * PushNotificationBell — Production Web Push UI Component
 *
 * Handles the full push notification subscription lifecycle:
 *  1. Registers the service worker (/sw.js)
 *  2. Requests notification permission from the browser
 *  3. Subscribes to the Web Push API with VAPID public key
 *  4. POSTs the PushSubscription to /api/notifications/subscribe
 *  5. Shows unread notification count badge on the bell icon
 *  6. Provides dropdown with recent notifications + mark-as-read
 *
 * Required env var (client-safe):
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *
 * Generate VAPID keys:
 *   npx web-push generate-vapid-keys
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, BellOff, BellRing, X, CheckCheck, Loader } from 'lucide-react';
import { authFetch } from '@/lib/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Notification {
  id:         string;
  title:      string;
  message:    string;
  type:       string;
  is_read:    number;
  created_at: string;
}

type PushState = 'unsupported' | 'idle' | 'requesting' | 'subscribed' | 'denied' | 'error';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert VAPID public key (base64url) to Uint8Array for the PushManager. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

/** Format relative time string. */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)      return 'just now';
  if (diff < 3_600_000)   return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)  return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const TYPE_COLORS: Record<string, string> = {
  trade:   'text-blue-400',
  alert:   'text-[var(--rolex-gold)]',
  deposit: 'text-green-400',
  quest:   'text-purple-400',
  system:  'text-[var(--text-secondary)]',
  info:    'text-[var(--text-secondary)]',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PushNotificationBell() {
  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [pushState,     setPushState]     = useState<PushState>('idle');
  const [swReg,         setSwReg]         = useState<ServiceWorkerRegistration | null>(null);
  const [loading,       setLoading]       = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pollRef     = useRef<any>(null);

  // ── Check push support + existing subscription ────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setPushState('denied');
    }

    // Register service worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(async (reg) => {
        setSwReg(reg);
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          setPushState('subscribed');
        } else if (Notification.permission === 'granted') {
          setPushState('idle');
        }
      })
      .catch(err => {
        console.warn('[Push] SW registration failed:', err);
        setPushState('unsupported');
      });
  }, []);

  // ── Load notifications ────────────────────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    try {
      const res  = await authFetch('/api/notifications');
      if (!res.ok) return;
      const data = await res.json();
      const list: Notification[] = data.notifications ?? [];
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.is_read).length);
    } catch {
      // Non-fatal — notifications are a nice-to-have
    }
  }, []);

  // Poll every 60s when page is visible
  useEffect(() => {
    loadNotifications();
    const poll = () => {
      if (!document.hidden) loadNotifications();
      pollRef.current = setTimeout(poll, 60_000);
    };
    pollRef.current = setTimeout(poll, 60_000);
    return () => clearTimeout(pollRef.current);
  }, [loadNotifications]);

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Subscribe to push ─────────────────────────────────────────────────────
  const subscribe = useCallback(async () => {
    if (!swReg) return;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.error('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set');
      setPushState('error');
      return;
    }

    setPushState('requesting');
    setLoading(true);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushState('denied');
        return;
      }

      const subscription = await swReg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as any,
      });

      const res = await authFetch('/api/notifications/subscribe', {
        method: 'POST',
        body:   JSON.stringify({ subscription }),
      });

      if (res.ok) {
        setPushState('subscribed');
      } else {
        setPushState('error');
      }
    } catch (err) {
      console.error('[Push] Subscribe error:', err);
      setPushState(Notification.permission === 'denied' ? 'denied' : 'error');
    } finally {
      setLoading(false);
    }
  }, [swReg]);

  // ── Unsubscribe ───────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    if (!swReg) return;
    setLoading(true);
    try {
      const sub = await swReg.pushManager.getSubscription();
      if (sub) {
        await authFetch('/api/notifications/unsubscribe', {
          method: 'POST',
          body:   JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setPushState('idle');
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err);
    } finally {
      setLoading(false);
    }
  }, [swReg]);

  // ── Mark notifications as read ────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    try {
      await authFetch('/api/notifications', {
        method: 'PATCH',
        body:   JSON.stringify({ all: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch { /* non-fatal */ }
  }, []);

  // ── Bell icon based on state ──────────────────────────────────────────────
  const BellIcon = pushState === 'subscribed' && unreadCount > 0
    ? BellRing
    : pushState === 'denied' || pushState === 'unsupported'
      ? BellOff
      : Bell;

  const bellColor = pushState === 'subscribed'
    ? 'text-[var(--rolex-gold)]'
    : pushState === 'denied'
      ? 'text-red-400/50'
      : 'text-[var(--text-muted)] hover:text-white';

  return (
    <div ref={dropdownRef} className="relative">

      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) loadNotifications(); }}
        className={`relative p-2 transition-colors ${bellColor}`}
        aria-label="Notifications"
      >
        <BellIcon size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[var(--rolex-gold)] text-black text-[8px] font-bold font-mono rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] bg-[#050505] border border-[var(--border-dark)] shadow-2xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-dark)]">
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono uppercase tracking-[0.25em] text-[var(--rolex-gold)] font-bold">
                NOTIFICATIONS
              </span>
              {unreadCount > 0 && (
                <span className="text-[8px] font-mono text-[var(--text-muted)]">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--rolex-gold)] transition-colors flex items-center gap-1"
                >
                  <CheckCheck size={10} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)}>
                <X size={14} className="text-[var(--text-muted)] hover:text-white transition-colors" />
              </button>
            </div>
          </div>

          {/* Push status bar */}
          {pushState !== 'unsupported' && (
            <div className="px-4 py-2.5 bg-[#0a0a0a] border-b border-[var(--border-dark)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  pushState === 'subscribed' ? 'bg-green-400 animate-pulse' :
                  pushState === 'denied'     ? 'bg-red-400' : 'bg-[var(--text-muted)]'
                }`} />
                <span className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
                  {pushState === 'subscribed'  ? 'Push: Active'     :
                   pushState === 'denied'      ? 'Push: Blocked'    :
                   pushState === 'requesting'  ? 'Requesting…'      :
                   pushState === 'error'       ? 'Push: Error'      :
                   (pushState as string) === 'unsupported' ? 'Push: Unsupported' : 'Push: Off'}
                </span>
              </div>
              {loading ? (
                <Loader size={12} className="animate-spin text-[var(--text-muted)]" />
              ) : pushState === 'subscribed' ? (
                <button
                  onClick={unsubscribe}
                  className="text-[8px] font-mono uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors"
                >
                  Disable
                </button>
              ) : pushState !== 'denied' && (pushState as string) !== 'unsupported' ? (
                <button
                  onClick={subscribe}
                  className="text-[8px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] hover:underline"
                >
                  Enable
                </button>
              ) : pushState === 'denied' ? (
                <span className="text-[8px] font-mono text-red-400/50">Allow in browser settings</span>
              ) : null}
            </div>
          )}

          {/* Notification list */}
          <div className="max-h-[340px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={24} className="mx-auto mb-3 text-[var(--text-muted)]/30" />
                <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
                  No notifications yet
                </p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-[var(--border-dark)]/50 last:border-b-0 transition-colors ${
                    !n.is_read ? 'bg-[var(--rolex-gold)]/[0.03]' : 'hover:bg-white/[0.015]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`text-[9px] font-mono uppercase tracking-widest font-bold mb-0.5 ${TYPE_COLORS[n.type] ?? TYPE_COLORS.info}`}>
                        {n.title}
                        {!n.is_read && (
                          <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-[var(--rolex-gold)] align-middle" />
                        )}
                      </p>
                      <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                        {n.message}
                      </p>
                    </div>
                    <span className="text-[8px] font-mono text-[var(--text-muted)] whitespace-nowrap flex-shrink-0 mt-0.5">
                      {relativeTime(n.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

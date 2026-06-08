/**
 * Tokenly Protocol — Service Worker v1.0
 *
 * Handles Web Push Notification events from the server.
 * This file must be served from the root path: /sw.js
 * It is registered by PushNotificationBell.tsx on the client.
 *
 * Push payload format expected from src/lib/push.ts:
 * {
 *   title:     string,
 *   body:      string,
 *   url:       string,   // path to open on click (e.g. "/portfolio")
 *   icon?:     string,   // default: /icon-192.png
 *   badge?:    string,   // default: /badge-72.png
 *   tag?:      string,   // deduplication key
 *   type?:     string,   // 'trade' | 'alert' | 'system' | 'deposit'
 * }
 */

/* eslint-disable no-restricted-globals */

const CACHE_NAME   = 'tokenly-sw-v1';
const DEFAULT_ICON  = '/icon-192.png';
const DEFAULT_BADGE = '/badge-72.png';
const APP_NAME      = 'Tokenly Protocol';

// ── Install: skip waiting so new SW activates immediately ────────────────────
self.addEventListener('install', () => {
  self.skipWaiting();
});

// ── Activate: claim all existing clients ────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Push: receive push event, parse payload, show notification ───────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Non-JSON payload — use defaults
    data = { title: APP_NAME, body: event.data?.text() ?? 'You have a new notification.' };
  }

  const {
    title   = APP_NAME,
    body    = 'You have a new notification.',
    url     = '/',
    icon    = DEFAULT_ICON,
    badge   = DEFAULT_BADGE,
    tag     = `tokenly-${Date.now()}`,
    type    = 'info',
  } = data;

  // Notification action buttons per type
  const actions = [];
  if (type === 'trade' || type === 'alert') {
    actions.push({ action: 'view',    title: 'View Portfolio' });
    actions.push({ action: 'dismiss', title: 'Dismiss'        });
  }

  const options = {
    body,
    icon,
    badge,
    tag,                    // If a notification with same tag exists, replace it
    renotify:  true,        // Always vibrate even if replacing same tag
    silent:    false,
    timestamp: Date.now(),
    vibrate:   [100, 50, 100],
    actions,
    data:      { url },     // Store URL for click handler
    dir:       'auto',
    lang:      'en',
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification click: focus app or open the right URL ─────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? '/';
  const action    = event.action;

  // "dismiss" action: just close (already closed above)
  if (action === 'dismiss') return;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Focus existing tab if already open
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            if (client.navigate) client.navigate(targetUrl);
            return;
          }
        }
        // No open tab — open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// ── Push subscription change: re-subscribe if the browser rotates keys ────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true })
      .then((subscription) => {
        // Inform the app to update the stored subscription
        return fetch('/api/notifications/subscribe', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ subscription }),
        });
      })
      .catch((err) => console.error('[SW] pushsubscriptionchange failed:', err))
  );
});

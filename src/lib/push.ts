/**
 * Tokenly Push Notification Service — Production v1.0
 *
 * Sends real Web Push Notifications to all browser subscriptions stored for a user.
 * Uses the webpush protocol (RFC 8030) via the `web-push` npm package.
 *
 * Required env vars:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=BxxxxxxxxxxxxxVAPID_PUBLIC_xxxxxxxxxxxx
 *   VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxVAPID_PRIVATE_xxxxxxxxxxxxxxxxxxxxxxx
 *   VAPID_EMAIL=mailto:admin@yourdomain.com
 *
 * Generate VAPID keys (one-time):
 *   npx web-push generate-vapid-keys
 *
 * Install:
 *   npm install web-push
 *   npm install --save-dev @types/web-push
 */

import webpush from 'web-push';
import { getDb } from '@/lib/db';

// ── VAPID Configuration (initialised lazily) ──────────────────────────────────

let _configured = false;

function ensureConfigured(): boolean {
  if (_configured) return true;

  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email      = process.env.VAPID_EMAIL ?? 'mailto:admin@tokenly.luxury';

  if (!publicKey || !privateKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[PUSH] Missing VAPID keys — push notifications disabled. Run: npx web-push generate-vapid-keys');
    }
    return false;
  }

  webpush.setVapidDetails(email, publicKey, privateKey);
  _configured = true;
  return true;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type PushType = 'trade' | 'alert' | 'system' | 'deposit' | 'quest' | 'info';

export interface PushPayload {
  title: string;
  body:  string;
  url?:  string;
  tag?:  string;
  type?: PushType;
  icon?: string;
}

interface StoredSubscription {
  id:         string;
  user_id:    string;
  endpoint:   string;
  p256dh_key: string;
  auth_key:   string;
}

// ── Core Send Function ────────────────────────────────────────────────────────

/**
 * Sends a push notification to every browser/device subscribed by this user.
 *
 * - Silently no-ops if VAPID keys are not configured
 * - Removes expired/invalid subscriptions from the DB automatically
 * - Never throws — failures are logged and swallowed (non-critical path)
 *
 * @param userId  - User to notify
 * @param payload - Notification content
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;

  const db = await getDb();

  const subscriptions = await db
    .prepare('SELECT * FROM push_subscriptions WHERE user_id = ?')
    .all(userId) as StoredSubscription[];

  if (subscriptions.length === 0) return;

  const content = JSON.stringify({
    title: payload.title,
    body:  payload.body,
    url:   payload.url  ?? '/',
    tag:   payload.tag  ?? `tokenly-${Date.now()}`,
    type:  payload.type ?? 'info',
    icon:  payload.icon ?? '/icon-192.png',
    badge: '/badge-72.png',
  });

  const results = await Promise.allSettled(
    subscriptions.map(sub =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth:   sub.auth_key,
          },
        },
        content,
        {
          TTL:     86400,           // Cache push for 24h if device is offline
          urgency: payload.type === 'alert' ? 'high' : 'normal',
          topic:   payload.tag,     // Collapse duplicate pushes on push service
        }
      ).then(() => {
        // Update last_used timestamp
        db.prepare("UPDATE push_subscriptions SET last_used = datetime('now') WHERE id = ?")
          .run(sub.id);
        return { id: sub.id, ok: true };
      })
    )
  );

  // Clean up any subscriptions that the push service rejected
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'rejected') {
      const err = result.reason;
      const sub = subscriptions[i];
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        // 410 Gone / 404 Not Found: subscription is expired — remove from DB
        await db
          .prepare('DELETE FROM push_subscriptions WHERE id = ?')
          .run(sub.id)
          .catch(() => {}); // Non-fatal
        console.info(`[PUSH] Removed expired subscription ${sub.id} (${err.statusCode})`);
      } else {
        console.warn(`[PUSH] Failed to send to subscription ${sub.id}:`, err?.message ?? err);
      }
    }
  }

  const sent = results.filter(r => r.status === 'fulfilled').length;
  if (sent > 0) {
    console.info(`[PUSH] Sent "${payload.title}" to ${sent}/${subscriptions.length} device(s) for user ${userId}`);
  }
}

/**
 * Convenience function: send push to multiple users at once (e.g. broadcast).
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  await Promise.allSettled(userIds.map(id => sendPushToUser(id, payload)));
}

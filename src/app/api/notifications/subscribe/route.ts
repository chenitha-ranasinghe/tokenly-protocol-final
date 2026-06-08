/**
 * POST /api/notifications/subscribe
 *
 * Stores a browser PushSubscription for the authenticated user.
 * Called by PushNotificationBell.tsx after the user grants permission.
 *
 * Idempotent: if the same endpoint is re-sent (e.g. after SW key rotation),
 * we UPDATE the keys rather than creating a duplicate row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import { jsonError } from '@/lib/api-response';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await authenticateRequest(request);
  if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body', 400, 'BAD_REQUEST');
  }

  // Accept { subscription: PushSubscription } or PushSubscription directly
  const sub: Record<string, unknown> =
    (body.subscription as Record<string, unknown>) ?? body;

  const endpoint   = typeof sub.endpoint === 'string' ? sub.endpoint.trim() : '';
  const keysObj    = (sub.keys ?? {}) as Record<string, string>;
  const p256dhKey  = typeof keysObj.p256dh === 'string' ? keysObj.p256dh.trim() : '';
  const authKey    = typeof keysObj.auth   === 'string' ? keysObj.auth.trim()   : '';

  if (!endpoint || !p256dhKey || !authKey) {
    return jsonError(
      'Invalid PushSubscription. Expected: { endpoint, keys: { p256dh, auth } }',
      400,
      'VALIDATION_ERROR'
    );
  }

  // Basic endpoint URL validation
  if (!endpoint.startsWith('https://')) {
    return jsonError('Push endpoint must use HTTPS.', 400, 'VALIDATION_ERROR');
  }

  const userAgent = request.headers.get('user-agent')?.substring(0, 200) ?? null;
  const db = await getDb();

  // Upsert: update keys if endpoint already exists for this user; insert otherwise
  const existing = await db
    .prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?')
    .get(endpoint) as { id: string } | undefined;

  if (existing) {
    await db
      .prepare(
        `UPDATE push_subscriptions
         SET p256dh_key = ?, auth_key = ?, user_id = ?, last_used = datetime('now')
         WHERE id = ?`
      )
      .run(p256dhKey, authKey, String(user.id), existing.id);
  } else {
    await db
      .prepare(
        `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh_key, auth_key, user_agent)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(uuidv4(), String(user.id), endpoint, p256dhKey, authKey, userAgent);
  }

  const count = (
    await db
      .prepare('SELECT COUNT(*) as c FROM push_subscriptions WHERE user_id = ?')
      .get(String(user.id)) as { c: number }
  ).c;

  return NextResponse.json({
    success: true,
    message: 'Push subscription registered. You will receive real-time notifications.',
    deviceCount: count,
  });
}

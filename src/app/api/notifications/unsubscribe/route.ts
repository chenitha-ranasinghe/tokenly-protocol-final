/**
 * POST /api/notifications/unsubscribe
 *
 * Removes a push subscription (or all subscriptions for this user).
 * Called when the user turns off notifications in PushNotificationBell.
 */

import { NextRequest, NextResponse } from 'next/server';
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
    body = {};
  }

  const db = await getDb();

  if (body.endpoint && typeof body.endpoint === 'string') {
    // Remove specific endpoint
    const res = await db
      .prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?')
      .run(body.endpoint.trim(), String(user.id)) as { changes: number };
    const changes = res?.changes ?? 0;

    return NextResponse.json({
      success:  true,
      removed:  changes,
      message:  changes > 0 ? 'Subscription removed.' : 'Subscription not found.',
    });
  }

  // Remove ALL subscriptions for this user
  const resAll = await db
    .prepare('DELETE FROM push_subscriptions WHERE user_id = ?')
    .run(String(user.id)) as { changes: number };
  const changes = resAll?.changes ?? 0;

  return NextResponse.json({
    success: true,
    removed: changes,
    message: `Removed ${changes} subscription(s). Push notifications disabled.`,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getDb();
    const notifications = await db.prepare(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `).all(user.id);

    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    console.error('Notification GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { notificationId, all } = await request.json();
    const db = await getDb();

    if (all) {
      await db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(user.id);
    } else if (notificationId) {
      await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(notificationId, user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notification PATCH Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { enforceRateLimit } from '@/lib/rate-limit-request';
import { jsonError } from '@/lib/api-response';
import { authenticateRequest } from '@/lib/session';
import crypto from 'crypto';
import type { User } from '@/lib/types';

interface AlertRow { id: string; user_id: string; product_id: string; target_price: number; direction: 'above'|'below'; status: string; created_at: string; product_name?: string; }
interface CountRow { count: number; }

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request) as User | null;
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');

    const db = await getDb();
    const alerts = await db.prepare(`
      SELECT a.*, p.name as product_name 
      FROM alerts a
      JOIN products p ON a.product_id = p.id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
    `).all(user.id);

    return NextResponse.json({ success: true, alerts });
  } catch (error) {
    console.error('[ALERTS_GET]', error);
    return jsonError('Internal Server Error', 500, 'INTERNAL');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request) as User | null;
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');

    const rl = await enforceRateLimit(request, 'alerts:create', 10, 60);
    if (rl) return rl;

    const body = await request.json();

    const { productId, targetPrice, direction } = body;

    if (!productId || typeof productId !== 'string') {
      return jsonError('productId required', 400, 'BAD_REQUEST');
    }
    if (!direction || !['above', 'below'].includes(String(direction))) {
      return jsonError("direction must be 'above' or 'below'", 400, 'BAD_REQUEST');
    }
    if (!targetPrice || typeof targetPrice !== 'number' || targetPrice <= 0 || !isFinite(targetPrice)) {
      return jsonError('targetPrice must be a positive number', 400, 'BAD_REQUEST');
    }

    if (!productId || !targetPrice || !direction) {
      return jsonError('Missing parameters', 400, 'BAD_REQUEST');
    }

    const db = await getDb();
    
    // Check limit: 20 alerts per account
    const count = await db.prepare('SELECT COUNT(*) as count FROM alerts WHERE user_id = ?').get(user.id) as { count: number };
    if (count.count >= 20) {
      return jsonError('Maximum limit of 20 alerts reached.', 400, 'BAD_REQUEST');
    }

    const alertId = crypto.randomUUID();
    await db.prepare('INSERT INTO alerts (id, user_id, product_id, target_price, direction, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(alertId, user.id, productId, targetPrice, direction, 'active');

    return NextResponse.json({ success: true, message: 'Price alert created successfully.' });
  } catch (error) {
    console.error('[ALERTS_POST]', error);
    return jsonError('Internal Server Error', 500, 'INTERNAL');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticateRequest(request) as User | null;
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return jsonError('Alert ID required', 400, 'BAD_REQUEST');

    const db = await getDb();
    await db.prepare('DELETE FROM alerts WHERE id = ? AND user_id = ?').run(id, user.id);

    return NextResponse.json({ success: true, message: 'Alert removed.' });
  } catch (error) {
    console.error('[ALERTS_DELETE]', error);
    return jsonError('Internal Server Error', 500, 'INTERNAL');
  }
}

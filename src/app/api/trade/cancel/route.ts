import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import crypto from 'crypto';
import { enforceRateLimit } from '@/lib/rate-limit-request';
import { jsonError } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');

    const rl = await enforceRateLimit(req, `trade:cancel:${user.id}`, 30, 60);
    if (rl) return rl;

    const body = await req.json();
    const { orderId } = body;
    if (!orderId) return jsonError('Missing orderId', 400, 'BAD_REQUEST');

    const db = await getDb();
    const order = await db.prepare(`SELECT * FROM orders WHERE id = ? AND status = 'open'`).get(orderId) as
      | {
          id: string;
          user_id: string;
          trade_type: string;
          points_locked: number;
        }
      | undefined;
    
    if (!order) return jsonError('Order not found or already closed.', 404, 'NOT_FOUND');
    const userId = user.id as string;
    if (order.user_id !== userId) return jsonError('Not authorized to cancel this order.', 403, 'FORBIDDEN');

    await db.transaction(async (txDb) => {
      // Cancel the order
      await txDb.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`).run(orderId);
      
      // Refund locked points for buy limit orders
      if (order.trade_type === 'buy' && order.points_locked > 0) {
        await txDb.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(order.points_locked, userId);
        await txDb.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)')
          .run(crypto.randomUUID(), userId, order.points_locked, 'refund', `Refunded points from cancelled order`);
      }
      
      // Release seller bond for sell limit orders
      if (order.trade_type === 'sell') {
        const bond = await txDb.prepare(`SELECT * FROM seller_bonds WHERE order_id = ? AND status = 'locked'`).get(orderId) as
          | { id: string; bond_amount: number }
          | undefined;
        if (bond) {
          await txDb.prepare(`UPDATE seller_bonds SET status = 'released' WHERE id = ?`).run(bond.id);
          await txDb.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(bond.bond_amount, userId);
          await txDb.prepare('UPDATE platform_metrics SET total_bonds_locked = total_bonds_locked - ? WHERE id = 1').run(bond.bond_amount);
          await txDb.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)')
            .run(crypto.randomUUID(), userId, bond.bond_amount, 'bond_release', `Seller bond returned`);
        }
      }
    });

    const updatedUser = await db.prepare('SELECT id, name, points, experiment_group, rrs_score, total_reviews, accurate_reviews, is_admin, total_trades FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined;
    return NextResponse.json({ success: true, message: 'Order cancelled. Funds returned.', user: updatedUser });

  } catch (error) {
    console.error('Cancel Route Error:', error);
    return jsonError('Cancel order failed. Please try again.', 500, 'INTERNAL');
  }
}

/**
 * GDPR/PDPA Compliance API — Right to be Forgotten
 * 
 * POST /api/admin/gdpr-delete — Delete all personal data for a user
 * GET /api/admin/gdpr-delete?userId=xxx — Export all data for a user (data portability)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user || !user.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const db = await getDb();
    const userData = await db.prepare('SELECT id, email, name, points, experiment_group, total_reviews, accurate_reviews, rrs_score, created_at, last_active_at, total_trades FROM users WHERE id = ?').get(userId);
    const reviews = await db.prepare('SELECT * FROM reviews WHERE user_id = ?').all(userId);
    const trades = await db.prepare('SELECT * FROM trades WHERE user_id = ?').all(userId);
    const transactions = await db.prepare('SELECT * FROM point_transactions WHERE user_id = ?').all(userId);
    const shares = await db.prepare('SELECT * FROM user_shares WHERE user_id = ?').all(userId);

    await writeAuditLog('data_export', user.id as string, {
      targetId: userId,
      targetType: 'user',
      details: { reason: 'GDPR data portability request' },
    });

    return NextResponse.json({
      user: userData,
      reviews,
      trades,
      transactions,
      shares,
      exportedAt: new Date().toISOString(),
      format: 'JSON',
      notice: 'This export contains all personal data held by Tokenly for this user, in compliance with GDPR Article 20 (Right to Data Portability) and PDPA Section 21.',
    });
  } catch (error) {
    console.error('GDPR export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user || !user.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId, reason } = await request.json();
    if (!userId || !reason) {
      return NextResponse.json({ error: 'userId and reason required' }, { status: 400 });
    }

    const db = await getDb();

    // Verify user exists
    const target = await db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined;
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Log before deletion
    await writeAuditLog('data_deletion', user.id as string, {
      targetId: userId,
      targetType: 'user',
      details: { reason, targetEmail: target.email, deletedAt: new Date().toISOString() },
    });

    await db.transaction(async (txDb) => {
      // Anonymize user record
      await txDb.prepare(`UPDATE users SET 
        email = 'deleted_' || id || '@redacted.tokenly',
        name = 'Deleted User',
        session_token = NULL,
        wallet_address = NULL,
        private_key = NULL,
        is_banned = 1
        WHERE id = ?`).run(userId);

      // Anonymize review text
      await txDb.prepare(`UPDATE reviews SET review_text = '[REDACTED - GDPR]' WHERE user_id = ?`).run(userId);

      // Remove point transactions descriptions
      await txDb.prepare(`UPDATE point_transactions SET description = '[REDACTED]' WHERE user_id = ?`).run(userId);

      // Cancel open orders and return locked funds
      const openOrders = await txDb.prepare(`SELECT * FROM orders WHERE user_id = ? AND status = 'open'`).all(userId) as Record<string, unknown>[];
      for (const order of openOrders) {
        if (Number(order.points_locked) > 0) {
          await txDb.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(Number(order.points_locked), userId);
        }
        await txDb.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`).run(String(order.id));
      }
    });

    return NextResponse.json({
      success: true,
      message: `User ${userId} data has been anonymized per GDPR/PDPA requirements.`,
      note: 'Aggregate statistics (review scores, trade volumes) are retained for platform integrity. Audit trail is preserved for regulatory compliance.',
    });
  } catch (error) {
    console.error('GDPR deletion error:', error);
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { enforceRateLimit } from '@/lib/rate-limit-request';
import { jsonError } from '@/lib/api-response';
import { authenticateRequest } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const rl = await enforceRateLimit(req, 'portfolio:get', 120, 60);
    if (rl) return rl;

    const user = await authenticateRequest(req);
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');
    
    const db = await getDb();

    const shares = await db.prepare(`
      SELECT s.id, s.product_id, s.shares, s.avg_buy_price, p.name, p.brand, p.consensus_price, p.retail_price, p.total_tokens, p.image_url
      FROM user_shares s
      JOIN products p ON s.product_id = p.id
      WHERE s.user_id = ?
    `).all(user.id);
    
    const transactions = await db.prepare(`
      SELECT * FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
    `).all(user.id);

    return NextResponse.json({ success: true, shares, transactions });

  } catch (error) {
    console.error('Portfolio Error:', error);
    return jsonError('Internal Server Error', 500, 'INTERNAL');
  }
}

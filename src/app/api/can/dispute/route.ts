import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { productId } = await request.json();
    if (!productId) return NextResponse.json({ error: 'Missing product ID' }, { status: 400 });

    const db = await getDb();
    const STAKE_AMOUNT = 500;

    if (user.points < STAKE_AMOUNT) {
      return NextResponse.json({ error: 'Insufficient capital for arbitration stake (Requires 500 PTS).' }, { status: 400 });
    }

    const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as Record<string, unknown> | undefined;
    if (!product) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    await db.transaction(async (txDb) => {
      // 1. Deduct Stake
      await txDb.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(STAKE_AMOUNT, user.id);
      
      // 2. Create Point Transaction
      await txDb.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), user.id, -STAKE_AMOUNT, 'dispute_stake', `Arbitration Stake for ${product.brand} ${product.name}`);

      // 3. Flag product for re-audit (reset status to pending but mark as disputed)
      await txDb.prepare("UPDATE products SET verification_status = 'pending' WHERE id = ?").run(productId);

      // 4. Create high-priority task for Gemologists
      const taskId = crypto.randomUUID();
      const ts = new Date().toISOString();
      await txDb.prepare(`INSERT INTO reviews (id, user_id, product_id, rrs_impact, status_code, audit_hash, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(taskId, '00000000-0000-4000-8000-000000000000', productId, 0, 0, 'DISPUTE_PENDING', `[ ARBITRATION ] Challenge initiated by Node ${user.id}. High-priority re-audit required.`, ts);

      console.log(`[ARBITRATION] Challenge initiated for ${productId} by user ${user.id}`);
    });

    return NextResponse.json({ success: true, message: 'Dispute recorded. Certification suspended pending re-audit.' });

  } catch (error) {
    console.error('Dispute API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

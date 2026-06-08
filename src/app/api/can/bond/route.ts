import { NextRequest, NextResponse } from 'next/server';
import { getDb, createNotification } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import crypto from 'crypto';
import type { User } from '@/lib/types';
import { canBondSchema } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/rate-limit-request';
import { jsonError } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const userAuth = await authenticateRequest(request);
    if (!userAuth) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');

    const rl = await enforceRateLimit(request, `can:bond:${userAuth.id}`, 5, 60);
    if (rl) return rl;

    const parsed = canBondSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError('Invalid bond parameters', 400, 'BAD_REQUEST');
    }
    const { tier, cost } = parsed.data;

    const db = await getDb();
    const { isAdmin } = await import('@/lib/session');
    
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userAuth.id) as User | undefined;
    const isGodMode = isAdmin(user);

    if (!user || (!isGodMode && user.points < cost)) {
      return jsonError('Insufficient points to post this bond.', 400, 'BAD_REQUEST');
    }

    // Check for existing active bond for this tier
    const existingBond = await db.prepare("SELECT * FROM seller_bonds WHERE user_id = ? AND order_id = ? AND status = 'locked'")
      .get(user.id, `can_tier_${tier}`);
    
    if (existingBond) {
      return jsonError(`An active bond for Tier ${tier} already exists.`, 400, 'BAD_REQUEST');
    }

    await db.transaction(async (txDb) => {
      // 1. Deduct points
      await txDb.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(cost, user.id);
      
      // 2. Track transaction
      await txDb.prepare(`INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, 'bond_lock', ?)`)
        .run(crypto.randomUUID(), user.id, -cost, `Locked ${cost.toLocaleString()} pts for CAN Tier: ${tier}`);

      // 3. Create Bond Record
      const ts = "datetime('now')";
      const bondId = crypto.randomUUID();
      await txDb.prepare(`INSERT INTO seller_bonds (id, user_id, product_id, order_id, bond_amount, status, created_at) VALUES (?, ?, ?, ?, ?, 'locked', ${ts})`)
        .run(bondId, user.id, 'can_dao_node', `can_tier_${tier}`, cost);
      
      console.log(`[CAN_BACKEND] Bond created: ${bondId} for user ${user.email} (Tier: ${tier})`);
    });

    // 4. Return complete updated user to frontend
    const updatedUser = await db.prepare('SELECT id, email, name, wallet_address, points, experiment_group, total_reviews, accurate_reviews, rrs_score, created_at, is_admin FROM users WHERE id = ?').get(user.id);
    
    // Notify user of successful bond (in-app + push)
    createNotification(
      String(userAuth.id),
      'CAN Bond Pledged',
      `Your Tier ${tier} CAN bond of ${cost.toLocaleString()} PTS has been locked. You are now an active network authenticator.`,
      'system',
      '/vault'
    ).catch(() => {});

    return NextResponse.json({ success: true, message: 'CAN DAO Bond Pledged Successfully', user: updatedUser });

  } catch (error) {
    console.error('CAN Bond Error:', error);
    return jsonError('Internal Server Error', 500, 'INTERNAL');
  }
}

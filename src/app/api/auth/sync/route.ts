import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { isValidEmail, sanitizeName } from '@/lib/sanitize';
import { privySyncSchema } from '@/lib/validation/schemas';
import crypto from 'crypto';
import { enforceRateLimit } from '@/lib/rate-limit-request';
import { jsonError } from '@/lib/api-response';

const SAFE_FIELDS = 'id, email, name, wallet_address, points, experiment_group, total_reviews, accurate_reviews, rrs_score, created_at, is_admin, is_id_verified';

export async function POST(req: NextRequest) {
  try {
    const parsed = privySyncSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonError('Invalid identity payload', 400, 'BAD_REQUEST');
    }
    const { privyId, walletAddress, email } = parsed.data;

    const rl = await enforceRateLimit(req, `auth:sync:${privyId}`, 10, 60);
    if (rl) return rl;

    const db = await getDb();
    let user = await db.prepare(`SELECT ${SAFE_FIELDS} FROM users WHERE privy_did = ?`).get(privyId) as Record<string, unknown> | undefined;

    if (!user) {
      const userId = crypto.randomUUID();
      const cleanEmail = email && isValidEmail(email) ? email.trim().toLowerCase() : `${privyId.slice(0, 12)}@privy.identity`;
      const defaultName = sanitizeName(email ? email.split('@')[0] : `Member-${userId.slice(0, 6)}`);
      await db.prepare(`INSERT INTO users (id, email, name, wallet_address, privy_did, points, experiment_group) VALUES (?, ?, ?, ?, ?, 10000, 'staking')`)
        .run(userId, cleanEmail, defaultName, walletAddress || null, privyId);
      await db.prepare(`INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, 10000, ?, ?)`)
        .run(crypto.randomUUID(), userId, 'signup_bonus', 'Welcome bonus — 10,000 PTS to start reviewing & trading');
      user = await db.prepare(`SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`).get(userId) as Record<string, unknown>;
    } else {
      const ts = process.env.DATABASE_URL ? 'CURRENT_TIMESTAMP' : "datetime('now')";
      await db.prepare(`UPDATE users SET last_active_at = ${ts} WHERE id = ?`).run(String(user.id));
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('[AuthSync] POST error:', error);
    return jsonError('Identity synchronization failed', 500, 'INTERNAL');
  }
}

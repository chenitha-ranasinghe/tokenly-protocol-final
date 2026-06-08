import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import crypto from 'crypto';
import { authenticateRequest } from '@/lib/session';

export async function POST(req: Request) {
  try {
    const user = await authenticateRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = await getDb();

    const body = await req.json();
    const { amountUSD } = body;

    if (!amountUSD || typeof amountUSD !== 'number' || amountUSD < 10 || amountUSD > 10000) {
      return NextResponse.json({ error: 'Deposit must be between $10 and $10,000' }, { status: 400 });
    }

    const pointsAdded = amountUSD * 100;
    const userId = user.id as string;

    await db.transaction(async (txDb) => {
        await txDb.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(pointsAdded, userId);
        
        await txDb.prepare('INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)')
            .run(crypto.randomUUID(), userId, pointsAdded, 'deposit', `Stripe USD Deposit ($${amountUSD}) → ${pointsAdded.toLocaleString()} pts`);
    });

    const updatedUser = await db.prepare('SELECT id, name, points, experiment_group, rrs_score, total_reviews, accurate_reviews, is_admin, total_trades FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined;

    return NextResponse.json({ success: true, message: `Successfully deposited $${amountUSD}. Received ${pointsAdded.toLocaleString()} points.`, user: updatedUser });

  } catch (error) {
    console.error('Deposit Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

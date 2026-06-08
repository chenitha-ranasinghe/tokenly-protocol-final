import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import { calculateRRS } from '@/lib/rrs';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Session expired' }, { status: 401 });

    const userId = user.id as string;
    const db = await getDb();

    const reviews = await db.prepare(`
      SELECT r.*, p.name as product_name, p.consensus_price, p.brand, p.initial_consensus
      FROM reviews r JOIN products p ON r.product_id = p.id
      WHERE r.user_id = ? ORDER BY r.created_at DESC
    `).all(userId) as Record<string, unknown>[];

    const transactions = await db.prepare('SELECT * FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(userId);

    const estimates = reviews.map(r => r.price_estimate as number);
    const consensuses = reviews.map(r => r.consensus_price as number);
    const rrsBreakdown = calculateRRS(user.accurate_reviews as number, user.total_reviews as number, estimates, consensuses, user.created_at as string);

    const rank = await db.prepare('SELECT COUNT(DISTINCT rrs_score) + 1 as rank FROM users WHERE rrs_score > ? AND total_reviews > 0').get(user.rrs_score) as { rank: number };
    const totalReviewers = await db.prepare('SELECT COUNT(*) as c FROM users WHERE total_reviews > 0').get() as { c: number };

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, points: user.points, experiment_group: user.experiment_group, total_reviews: user.total_reviews, accurate_reviews: user.accurate_reviews, rrs_score: user.rrs_score, created_at: user.created_at },
      reviews, transactions, rrsBreakdown,
      rank: rank.rank, totalReviewers: totalReviewers.c,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}

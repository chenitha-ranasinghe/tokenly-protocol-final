import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getTier } from '@/lib/rrs';
import { authenticateRequest } from '@/lib/session';
import type { RRSTier } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const db = await getDb();
    const group = request.nextUrl.searchParams.get('group');
    const search = request.nextUrl.searchParams.get('search')?.toLowerCase() || '';
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    let whereClause = 'total_reviews > 0 AND is_banned = 0';
    const params: unknown[] = [];

    if (group && ['staking', 'control'].includes(group)) {
      whereClause += ' AND experiment_group = ?';
      params.push(group);
    }
    if (search) {
      // GDPR: search by display name only — email never exposed or searched
      whereClause += ' AND LOWER(name) LIKE ?';
      params.push(`%${search}%`);
    }

    const totalResult = await db.prepare(`SELECT COUNT(*) as total FROM users WHERE ${whereClause}`).get(...(params as (string|number)[])) as { total: number };
    const total = totalResult?.total || 0;

    // email intentionally excluded — GDPR/privacy compliance
    const query = `SELECT id, name, points, total_reviews, accurate_reviews, rrs_score, experiment_group, total_trades FROM users WHERE ${whereClause} ORDER BY rrs_score DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    const rows = await db.prepare(query).all(...(params as (string|number)[])) as Record<string, unknown>[];

    return NextResponse.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      leaderboard: rows.map((u, i) => ({
        rank: offset + i + 1,
        id: u.id,
        name: u.name,
        points: u.points,
        total_reviews: u.total_reviews,
        accurate_reviews: u.accurate_reviews,
        rrs_score: u.rrs_score,
        experiment_group: u.experiment_group,
        total_trades: u.total_trades ?? 0,
        tier: getTier(u.rrs_score as number) as RRSTier,
        accuracy: (u.total_reviews as number) > 0
          ? (((u.accurate_reviews as number) / (u.total_reviews as number)) * 100).toFixed(1)
          : '0.0',
      })),
    });
  } catch (error) {
    console.error('[Leaderboard] GET error:', error);
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 });
  }
}

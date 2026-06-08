import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * Lightweight ticker endpoint — returns real-time platform stats
 * Used by GlobalTicker component for live data display
 */
export async function GET() {
  try {
    const db = await getDb();

    const userCount = await db.prepare('SELECT COUNT(*) as c FROM users WHERE id != \'system_ai_trader\'').get() as Record<string, unknown> | undefined;
    const reviewCount = await db.prepare('SELECT COUNT(*) as c FROM reviews').get() as Record<string, unknown> | undefined;
    const tradeCount = await db.prepare('SELECT COUNT(*) as c FROM trades').get() as Record<string, unknown> | undefined;
    const topAsset = await db.prepare('SELECT name FROM products ORDER BY total_reviews DESC LIMIT 1').get() as Record<string, unknown> | undefined;

    return NextResponse.json({
      totalUsers: userCount?.c || 0,
      totalReviews: reviewCount?.c || 0,
      totalTrades: tradeCount?.c || 0,
      topAsset: topAsset?.name || '',
      networkStatus: 'NOMINAL',
    });
  } catch {
    return NextResponse.json({
      totalUsers: 0,
      totalReviews: 0,
      totalTrades: 0,
      topAsset: '',
      networkStatus: 'DEGRADED',
    });
  }
}

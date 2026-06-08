import { NextRequest, NextResponse } from 'next/server';
import { getDb, checkRateLimit } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';

/** Deterministic Alias Generator for Anonymized Trades */
function getTraderAlias(userId: string) {
  const hash = Buffer.from(userId).reduce((acc, char) => acc + char, 0);
  const adjectives = ['Elite', 'Silent', 'Golden', 'Alpha', 'Node', 'Crypto', 'Legacy', 'Vivid'];
  const nouns = ['Guardian', 'Wolf', 'Eagle', 'Whale', 'Oracle', 'Node', 'Sentry', 'Vault'];
  return `${adjectives[hash % adjectives.length]} ${nouns[(hash * 7) % nouns.length]}`;
}

interface FeedRow { id: string; user_id: string; trade_type: 'buy'|'sell'; shares: number; price_per_share: number; total_cost: number; created_at: string; product_name: string; brand: string; category: string; }
interface StatsRow { total_trades: number; total_volume: number; active_traders: number; }

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    if (!await checkRateLimit(`feed:${user.id}`, 30, 60)) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }
    const db = await getDb();
    
    const cacheKey = 'global_feed';
    const cached = (await import('@/lib/cache')).feedCache.get(cacheKey);
    if (cached) return NextResponse.json(cached);
    
    // 1. Get last 50 trades
    const trades = await db.prepare(`
      SELECT t.*, p.name as product_name, p.brand, p.category, p.retail_price, p.image_url
      FROM trades t
      JOIN products p ON t.product_id = p.id
      ORDER BY t.created_at DESC
      LIMIT 50
    `).all() as (FeedRow & { retail_price: number, image_url: string })[];

    const anonymizedTrades = trades.map((t) => ({
      id: t.id,
      alias: getTraderAlias(t.user_id),
      type: t.trade_type,
      shares: t.shares,
      live_price: t.price_per_share || t.retail_price,
      product: t.product_name,
      brand: t.brand,
      category: t.category,
      time: t.created_at,
      image_url: t.image_url
    }));

    // 2. 24h Stats
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as trade_count,
        SUM(shares * price_per_share) as volume,
        COUNT(DISTINCT user_id) as active_traders
      FROM trades
      WHERE created_at >= datetime('now', '-24 hours')
    `).get() as { trade_count: number; volume: number; active_traders: number };

    const responseData = {
      success: true,
      stats: {
        trade_count: stats.trade_count || 0,
        volume: stats.volume || 0,
        active_traders: stats.active_traders || 0
      },
      trades: anonymizedTrades
    };

    (await import('@/lib/cache')).feedCache.set(cacheKey, responseData, 5);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('[FEED_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch live feed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest, isAdmin } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    const hideConsensus = user?.experiment_group === 'staking';
    // L1 Cache check (bypass for admins/staking logic)
    const cacheKey = `products_${hideConsensus}`;
    if (!isAdmin(user)) {
      const cached = (await import('@/lib/cache')).productsCache.get(cacheKey);
      if (cached) return NextResponse.json({ products: cached });
    }

    const db = await getDb();

    const products = await db.prepare(`
      SELECT p.id, p.name, p.brand, p.sku, p.category, p.retail_price,
        p.market_price_low, p.market_price_high, p.total_reviews, p.total_tokens, p.price_confidence,
        p.image_url,
        ${hideConsensus ? 'NULL' : 'p.consensus_price'} as consensus_price,
        p.initial_consensus,
        COUNT(r.id) as review_count,
        AVG(r.condition_grade) as avg_grade,
        SUM(r.points_staked) as total_staked
      FROM products p
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.verification_status = 'certified'
      GROUP BY p.id
      ORDER BY review_count ASC, p.name ASC
    `).all();

    if (!isAdmin(user)) {
      (await import('@/lib/cache')).productsCache.set(cacheKey, products, 15);
    }

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Products error:', error);
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
  }
}

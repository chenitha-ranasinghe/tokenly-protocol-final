import { NextRequest, NextResponse } from 'next/server';
import { getDb, checkRateLimit } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import { computeWisdomPrice } from '@/lib/wisdom-engine';

interface SearchRow { id: string; name: string; brand: string; sku: string; category: string; retail_price: number; consensus_price: number; price_confidence: number; verification_status: string; total_reviews: number; relevance_score: number; }

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!await checkRateLimit(`search:${ip}`, 30, 60)) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ success: true, results: [] });
    }

    const db = await getDb();
    
    // Search with relevance weighting: Name > Brand > SKU > Category
    const results = await db.prepare(`
      SELECT *,
        (CASE 
          WHEN LOWER(name) LIKE ? THEN 10
          WHEN LOWER(brand) LIKE ? THEN 5
          WHEN LOWER(sku) LIKE ? THEN 8
          WHEN LOWER(category) LIKE ? THEN 3
          ELSE 1
        END) as relevance
      FROM products
      WHERE LOWER(name) LIKE ? 
         OR LOWER(brand) LIKE ? 
         OR LOWER(sku) LIKE ?
         OR LOWER(category) LIKE ?
      ORDER BY relevance DESC, name ASC
      LIMIT 10
    `).all(
      `%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`,
      `%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`
    ) as SearchRow[];

    // Add live Wisdom prices to search results
    const resultsWithPrices = await Promise.all(results.map(async (p) => {
      const wisdom = await computeWisdomPrice(p.id);
      return {
        ...p,
        live_price: wisdom?.estimatedPrice || p.retail_price,
        confidence: wisdom?.confidence || 0
      };
    }));

    return NextResponse.json({ success: true, results: resultsWithPrices });
  } catch (error) {
    console.error('[SEARCH_ERROR]', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

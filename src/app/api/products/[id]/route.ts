import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';

interface ProductRow { id: string; name: string; brand: string; sku: string; category: string; consensus_price: number; retail_price: number; total_tokens: number; verification_status: string; vault_location: string; [key: string]: unknown; }

interface PriceHistoryRow { price: number; timestamp: string; created_at: string; volume?: number; }
interface CandleRow { time: number; open: number; high: number; low: number; close: number; volume?: number }

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { id } = await Promise.resolve(context.params);
    const db = await getDb();

    const product = await db.prepare(`SELECT * FROM products WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const price_history_raw = await db.prepare(`SELECT * FROM price_history WHERE product_id = ? ORDER BY created_at ASC`).all(id) as PriceHistoryRow[];
    
    // Feature: Binance-style OHLC Generation (1-hour buckets)
    const candles: CandleRow[] = [];
    if (price_history_raw.length > 0) {
      const bucketSize = 3600 * 1000; // 1 hour
      let currentBucket: CandleRow | null = null;

      price_history_raw.forEach(h => {
        const time = new Date(h.created_at).getTime();
        const bucketTime = Math.floor(time / bucketSize) * bucketSize;
        const price = h.price;

        if (!currentBucket || currentBucket.time !== bucketTime / 1000) {
          if (currentBucket) candles.push(currentBucket);
          currentBucket = {
            time: bucketTime / 1000,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: 0,
          };
        } else {
          currentBucket.high = Math.max(currentBucket.high, price);
          currentBucket.low = Math.min(currentBucket.low, price);
          currentBucket.close = price;
        }
      });
      if (currentBucket) candles.push(currentBucket);
    }

    const orders = await db.prepare(`SELECT * FROM orders WHERE product_id = ? AND status = 'open' ORDER BY price ASC`).all(id) as Record<string, unknown>[];
    
    // PERFECTION: Fetch cryptographic audit trail for the product
    type AuthRow = {
      user_id: string;
      verdict: string;
      rrs_score: number;
      auth_email: string;
      created_at: string;
      grade?: number;
      verification_hash?: string;
      cert_id?: string;
    };
    const auths = await db.prepare(`
      SELECT a.*, u.rrs_score, u.email as auth_email
      FROM authentications a
      JOIN users u ON a.user_id = u.id
      WHERE a.product_id = ? AND a.verdict = 'authentic'
    `).all(id) as AuthRow[];

    const verification_metadata = auths.length > 0 ? {
      authenticator_count: auths.length,
      authenticators: auths.map(a => ({
        id: a.user_id,
        rrs: a.rrs_score,
        grade: a.grade || 1,
        timestamp: a.created_at
      })),
      verification_hash: auths[0].verification_hash || 'PROT-GEN-000',
      cert_id: auths[0].cert_id,
      system: 'Certified Authenticator Network v5.2'
    } : null;

    return NextResponse.json({ product, price_history: price_history_raw, candles, orders, verification_metadata });
  } catch (error) {
    console.error('Product detail error:', error);
    return NextResponse.json({ error: 'Failed to load product' }, { status: 500 });
  }
}

import { computeWisdomPrice } from '@/lib/wisdom-engine';
import type { WisdomPrice } from '@/lib/types';
import { getDb } from '@/lib/db';
import { wisdomEngineCallsTotal } from '@/lib/metrics';

interface CacheEntry {
  value: WisdomPrice;
  expires: number;
}

const memoryCache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 60_000;

export async function getWisdomPriceCached(
  productId: string,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<WisdomPrice | null> {
  const now = Date.now();
  const hit = memoryCache.get(productId);
  if (hit && hit.expires > now) {
    return hit.value;
  }

  try {
    const fresh = await computeWisdomPrice(productId);
    if (fresh) {
      wisdomEngineCallsTotal.inc({ result: 'ok' });
      memoryCache.set(productId, { value: fresh, expires: now + ttlMs });
      return fresh;
    }
    wisdomEngineCallsTotal.inc({ result: 'empty' });
    return await staleWhileRevalidateFallback(productId);
  } catch {
    wisdomEngineCallsTotal.inc({ result: 'error' });
    return await staleWhileRevalidateFallback(productId);
  }
}

/** Last known consensus from DB when engine or external APIs fail. */
async function staleWhileRevalidateFallback(productId: string): Promise<WisdomPrice | null> {
  const db = await getDb();
  const row = (await db
    .prepare(
      'SELECT id, consensus_price, retail_price, price_confidence FROM products WHERE id = ?'
    )
    .get(productId)) as
    | {
        id: string;
        consensus_price: number | null;
        retail_price: number | null;
        price_confidence: number | null;
      }
    | undefined;
  if (!row) return null;
  const price = row.consensus_price ?? row.retail_price ?? 0;
  if (price <= 0) return null;
  return {
    productId: row.id,
    estimatedPrice: Math.round(price),
    confidence: Math.min(40, row.price_confidence ?? 20),
    signals: [
      {
        source: 'external_reference',
        weight: 1,
        value: price,
        label: 'Stale-while-revalidate: last known consensus',
      },
    ],
    lastUpdated: new Date().toISOString(),
    trend: 'stable',
    trendPct: 0,
  };
}

export function invalidateWisdomCache(productId: string): void {
  memoryCache.delete(productId);
}

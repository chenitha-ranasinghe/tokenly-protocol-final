/**
 * Tokenly Wisdom Engine v2.0 — V5.0 Blueprint Aligned
 * 
 * Mathematical pricing consensus model:
 * Price = (0.60 × Internal trade-weighted avg) 
 *       + (0.25 × External reference weighted avg)
 *       + (0.10 × Staked review consensus)
 *       + (0.05 × Recency adjustment)
 * 
 * This file contains the logic to combine platform trades, external market data,
 * and staked review estimates into a single secure consensus price for each asset.
 */

// Import the database connection utility so we can query database tables.
import { getDb } from './db';

// Import type definitions for TypeScript to ensure compiler safety for returned objects.
import type { WisdomPrice, WisdomSignal } from './types';

// Hardcoded Weight: Internal trades count for 60% of the consensus price.
const TRADE_WEIGHT = 0.60;

// Hardcoded Weight: External reference midpoint counts for 25% of the consensus price.
const EXTERNAL_WEIGHT = 0.25;

// Hardcoded Weight: Staked review consensus counts for 10% of the consensus price.
const REVIEW_WEIGHT = 0.10;

// Hardcoded Weight: Recency/momentum trend adjustments count for 5% of the consensus price.
const RECENCY_WEIGHT = 0.05;

// TypeScript Interface: Defines the structure of a row returned when querying trades.
interface TradeRow { 
  price: number;      // Executed price of the trade
  shares: number;     // Number of fractions traded
  created_at: string; // The ISO date string of when the trade was recorded
}

// TypeScript Interface: Defines the structure of a row returned when querying reviews.
interface ReviewRow { 
  price_estimate: number; // The reviewer's estimated USD price for the product
  points_staked: number;  // The amount of currency points locked by the reviewer
}

/**
 * Exponential decay calculation: trades older than 30 days lose weight.
 * This ensures that old market data does not distort today's asset pricing.
 * 
 * @param createdAt - The timestamp of when the trade occurred.
 * @returns A decay multiplier between 0 and 1.
 */
export function recencyWeight(createdAt: string): number {
  // 1. Calculate the age of the trade in milliseconds: current time minus trade time.
  const ageMs = Date.now() - new Date(createdAt).getTime();
  
  // 2. Convert milliseconds into days (86,400,000 milliseconds = 1 day).
  const ageDays = ageMs / 86_400_000;
  
  // 3. Apply exponential decay: Math.exp(-x / 30) gives a half-life of ~20.7 days.
  // When ageDays is 0, Math.exp(0) returns 1.0 (full weight).
  // When ageDays is 30, Math.exp(-1) returns ~0.36.
  return Math.exp(-ageDays / 30);
}

/**
 * Computes the trade-weighted average price of recent internal trades.
 * 
 * @param trades - Array of trade records from the database.
 * @returns The weighted price value and the confidence weight of the signal.
 */
export function computeTradeSignal(trades: TradeRow[]): { value: number; weight: number } {
  // 1. If there are no trades, return zero values (no trade signal exists).
  if (trades.length === 0) return { value: 0, weight: 0 };
  
  let wSum = 0;   // Accumulator for weighted prices (Price * Weight)
  let wTotal = 0; // Accumulator for total weights
  
  // 2. Loop through every trade to calculate its weight and add it to the sums.
  for (const t of trades) {
    // Weight = number of shares traded * recency decay factor.
    // Larger trades and newer trades receive higher weights.
    const w = t.shares * recencyWeight(t.created_at);
    
    // Add the weighted price (price * weight) to the sum.
    wSum += t.price * w;
    
    // Add this trade's weight to the running total.
    wTotal += w;
  }
  
  // 3. Compute the final average (weighted sum / total weights).
  // Prevent division by zero: if wTotal is 0, return 0.
  const value = wTotal > 0 ? wSum / wTotal : 0;
  
  // 4. Calculate signal confidence weight: scales from 0.1 up to 1.0.
  // 1 trade = 0.1 weight; 10+ trades = 1.0 weight (fully trusted).
  const weight = Math.min(1, trades.length / 10);
  
  return { value, weight };
}

/**
 * Computes the staked review average price estimate.
 * 
 * @param reviews - Array of review records from the database.
 * @returns The consensus price from reviews and the confidence weight of the signal.
 */
export function computeReviewSignal(reviews: ReviewRow[]): { value: number; weight: number } {
  // 1. We require at least 3 reviews to form a reliable consensus. If less, return 0.
  if (reviews.length < 3) return { value: 0, weight: 0 };
  
  let wSum = 0;   // Accumulator for weighted estimates (Estimate * Stake)
  let wTotal = 0; // Accumulator for total stakes
  
  // 2. Loop through every review to calculate its stake-weighted estimate.
  for (const r of reviews) {
    // If points_staked is less than 1, treat it as 1 to avoid multiply-by-zero errors.
    const w = Math.max(1, r.points_staked);
    
    // Add weighted estimate (estimate * stake) to the sum.
    wSum += r.price_estimate * w;
    
    // Add this review's stake weight to the running total.
    wTotal += w;
  }
  
  // 3. Calculate final average (weighted sum / total stakes).
  const value = wTotal > 0 ? wSum / wTotal : 0;
  
  // 4. Calculate signal confidence weight: scales from 0.3 up to 1.0 based on review count.
  // 3 reviews = 0.3 weight; 10+ reviews = 1.0 weight (fully trusted).
  const confidence = Math.min(1, reviews.length / 10);
  
  return { value, weight: confidence };
}

/**
 * Fetches the external reference price midpoint from database-seeded product records.
 * In Phase 2, this will connect directly to public eBay Completed Listings APIs.
 * 
 * @param productId - Unique identifier of the product.
 * @returns Midpoint of market low and high prices, or the retail price fallback, or null.
 */
async function fetchExternalReference(productId: string): Promise<number | null> {
  // 1. Establish database client.
  const db = await getDb();
  
  // 2. Query the product's low, high, and retail prices from the database.
  const product = await db.prepare('SELECT market_price_low, market_price_high, retail_price FROM products WHERE id = ?').get(productId) as { market_price_low: number; market_price_high: number; retail_price: number } | undefined;
  
  // 3. If product does not exist, return null.
  if (!product) return null;
  
  // 4. If both market low and high prices are set, return their midpoint.
  if (product.market_price_low && product.market_price_high) {
    return (product.market_price_low + product.market_price_high) / 2;
  }
  
  // 5. Fallback: return the original manufacturer retail price, or null if missing.
  return product.retail_price || null;
}

/**
 * Main Calculation Engine: Computes the consensus price for a product.
 * 
 * @param productId - Unique identifier of the product.
 * @returns A WisdomPrice object containing the calculated price, confidence, and audit signals.
 */
export async function computeWisdomPrice(productId: string): Promise<WisdomPrice | null> {
  // 1. Establish database client.
  const db = await getDb();

  // 2. Check if the product exists in the system.
  const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as Record<string, unknown> | undefined;
  if (!product) return null;

  // 3. Fetch trade history (last 200 records) and verified reviews in parallel to optimize speed.
  const [trades, reviews] = await Promise.all([
    db.prepare('SELECT price, shares, created_at FROM price_history WHERE product_id = ? ORDER BY created_at DESC LIMIT 200').all(productId) as Promise<TradeRow[]>,
    db.prepare('SELECT price_estimate, points_staked FROM reviews WHERE product_id = ? AND is_accurate IS NOT NULL').all(productId) as Promise<ReviewRow[]>,
  ]);

  // 4. Compute individual signal values and confidence weights.
  const tradeSignal = computeTradeSignal(trades as TradeRow[]);
  const reviewSignal = computeReviewSignal(reviews as ReviewRow[]);
  const externalRef = await fetchExternalReference(productId);

  const signals: WisdomSignal[] = [];
  let weightedSum = 0;
  let totalWeight = 0;

  // 5. If trade signal is valid, incorporate it into the consensus calculation.
  if (tradeSignal.value > 0 && tradeSignal.weight > 0) {
    // Effective Weight = Trade Weight (60%) * Confidence Weight (0.1 to 1.0).
    const effectiveWeight = TRADE_WEIGHT * tradeSignal.weight;
    weightedSum += tradeSignal.value * effectiveWeight;
    totalWeight += effectiveWeight;
    // Log the signal details for frontend charts and API transparency.
    signals.push({ source: 'internal_trades', weight: effectiveWeight, value: tradeSignal.value, label: `Internal trades (${(trades as TradeRow[]).length} records)` });
  }

  // 6. If external price midpoint is valid, incorporate it (fully trusted by default).
  if (externalRef && externalRef > 0) {
    const effectiveWeight = EXTERNAL_WEIGHT;
    weightedSum += externalRef * effectiveWeight;
    totalWeight += effectiveWeight;
    signals.push({ source: 'external_reference', weight: effectiveWeight, value: externalRef, label: 'External market reference (mid-market)' });
  }

  // 7. If review signal is valid, incorporate it.
  if (reviewSignal.value > 0 && reviewSignal.weight > 0) {
    // Effective Weight = Review Weight (10%) * Confidence Weight (0.3 to 1.0).
    const effectiveWeight = REVIEW_WEIGHT * reviewSignal.weight;
    weightedSum += reviewSignal.value * effectiveWeight;
    totalWeight += effectiveWeight;
    signals.push({ source: 'review_consensus', weight: effectiveWeight, value: reviewSignal.value, label: `Staked review consensus (${(reviews as ReviewRow[]).length} verified)` });
  }

  // 8. Fallback: If no trades, reviews, or external prices are found, fall back to historical price.
  if (totalWeight === 0) {
    const fallback = (product.consensus_price as number) || (product.retail_price as number) || 0;
    return {
      productId, 
      estimatedPrice: fallback, 
      confidence: 15, // Default low confidence score for unverified assets
      signals: [{ source: 'external_reference', weight: 1, value: fallback, label: 'Retail price (no trade data yet)' }],
      lastUpdated: new Date().toISOString(), 
      trend: 'stable', 
      trendPct: 0,
    };
  }

  // 9. Calculate final consensus price: round the weighted average to the nearest integer dollar.
  const estimatedPrice = Math.round(weightedSum / totalWeight);

  // 10. Recency momentum adjustment: compares the average of the last 5 trades 
  // against the 10 trades before them to determine short-term trends.
  const recentTrades = (trades as TradeRow[]).slice(0, 5);
  const olderTrades = (trades as TradeRow[]).slice(5, 15);
  let trend: 'up' | 'down' | 'stable' = 'stable';
  let trendPct = 0;
  
  if (recentTrades.length >= 3 && olderTrades.length >= 3) {
    const recentAvg = recentTrades.reduce((s, t) => s + t.price, 0) / recentTrades.length;
    const olderAvg = olderTrades.reduce((s, t) => s + t.price, 0) / olderTrades.length;
    trendPct = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (trendPct > 1) trend = 'up';        // Upward trend if price increased by > 1%
    else if (trendPct < -1) trend = 'down'; // Downward trend if price decreased by > 1%
    
    // Add momentum signal to audit log details.
    signals.push({ source: 'recency_adjustment', weight: RECENCY_WEIGHT, value: trendPct, label: `${trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} Recent momentum ${trendPct.toFixed(1)}%` });
  }

  // 11. Calculate overall price confidence score (capped between 15% and 95%).
  // Base is 15%, adding 3% per trade, 5% per review, and 10% if external mid-market exists.
  const confidence = Math.min(95, Math.round(
    15 + ((trades as TradeRow[]).length * 3) + ((reviews as ReviewRow[]).length * 5) + (externalRef ? 10 : 0)
  ));

  return { productId, estimatedPrice, confidence, signals, lastUpdated: new Date().toISOString(), trend, trendPct };
}

/**
 * Updates the database record of a product with its newly calculated consensus price and confidence.
 * 
 * @param productId - Unique identifier of the product.
 * @returns The newly computed consensus price, or null if compilation failed.
 */
export async function updateProductWisdomPrice(productId: string): Promise<number | null> {
  // 1. Run the consensus pricing logic engine.
  const wisdom = await computeWisdomPrice(productId);
  
  // 2. If the engine fails or computes a non-positive price, abort database updates.
  if (!wisdom || wisdom.estimatedPrice <= 0) return null;
  
  // 3. Establish database client.
  const db = await getDb();
  
  // 4. Update the products table with the fresh consensus price and confidence values.
  await db.prepare('UPDATE products SET consensus_price = ?, price_confidence = ? WHERE id = ?')
    .run(wisdom.estimatedPrice, wisdom.confidence, productId);
    
  return wisdom.estimatedPrice;
}


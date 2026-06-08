/**
 * Wash Trading & Gaming Prevention System v1.0
 * Implements Feature 3.4 from the Tokenly Blueprint
 * 
 * This file contains checks that verify if a requested trade is suspicious.
 * It prevents self-trading, enforces a 10-minute cooldown on the same asset,
 * caps sudden price swings to 15%, detects volume spikes, and rate-limits accounts.
 */

// Import the database connection helper.
import { getDb } from './db';

// TypeScript Interface: Defines the structure of the return result of the check.
export interface WashTradingCheck {
  allowed: boolean;        // True if the trade is clean, false if it should be blocked
  reason?: string;         // Explanatory message displayed to the client if blocked
  severity?: 'warning' | 'block'; // Action type: warning only or absolute block
}

/**
 * Check if a trade should be blocked due to wash trading indicators.
 * 
 * @param userId - Unique identifier of the user executing the trade.
 * @param productId - Unique identifier of the asset being traded.
 * @param tradeType - Buy or sell indicator.
 * @param shares - Number of fractional shares.
 * @param executionPrice - Executed execution price per share.
 * @returns WashTradingCheck outcome containing blocking status and description.
 */
export async function checkWashTrading(
  userId: string,
  productId: string,
  tradeType: 'buy' | 'sell',
  shares: number,
  executionPrice: number
): Promise<WashTradingCheck> {
  // 1. Establish database connection.
  const db = await getDb();

  // (Self-trade prevention is handled at the orderbook matching transaction level, not here).

  // 2. Minimum trade interval check: prevents trading the same asset within 10 minutes.
  // Query the timestamp of the last trade executed by this user on this specific product.
  const recentTrade = await db.prepare(`
    SELECT created_at FROM trades 
    WHERE user_id = ? AND product_id = ? 
    ORDER BY created_at DESC LIMIT 1
  `).get(userId, productId) as { created_at: string } | undefined;

  // If a recent trade is found, calculate the elapsed time in seconds.
  if (recentTrade) {
    // Current timestamp minus the trade timestamp, divided by 1000 to convert milliseconds to seconds.
    const elapsed = (Date.now() - new Date(recentTrade.created_at).getTime()) / 1000;
    
    // Check if the elapsed time is less than 600 seconds (10 minutes).
    if (elapsed < 600) { 
      // Calculate remaining minutes to wait (rounded up).
      const remaining = Math.ceil((600 - elapsed) / 60);
      return {
        allowed: false,
        reason: `Trade cooldown active. Wait ${remaining} minute${remaining > 1 ? 's' : ''} before trading this asset again.`,
        severity: 'block'
      };
    }
  }

  // 3. Price movement cap check: blocks trades deviating more than 15% from consensus.
  // Query the current consensus price of the product from the products table.
  const product = await db.prepare('SELECT consensus_price FROM products WHERE id = ?').get(productId) as { consensus_price: number } | undefined;
  
  if (product && product.consensus_price > 0) {
    // Calculate the percentage deviation: absolute price difference divided by consensus price.
    const deviation = Math.abs(executionPrice - product.consensus_price) / product.consensus_price;
    
    // If deviation is greater than 15% (0.15), block the transaction.
    if (deviation > 0.15) {
      return {
        allowed: false,
        reason: `Price $${executionPrice} deviates ${(deviation * 100).toFixed(1)}% from consensus $${product.consensus_price}. Maximum allowed: ±15%.`,
        severity: 'block'
      };
    }
  }

  // 4. Volume spike detection check: alerts if current volume exceeds 3x normal average.
  // SQL Query: Sum the total shares traded for this product in the last 1 hour.
  const hourlySql = "SELECT COALESCE(SUM(shares), 0) as vol FROM trades WHERE product_id = ? AND created_at >= datetime('now', '-1 hour')";
  const hourlyVolume = await db.prepare(hourlySql).get(productId) as { vol: number };

  // SQL Query: Calculate average daily volume using chronological age of the logs.
  // JULIANDAY('now') - JULIANDAY(first trade time) returns total days elapsed.
  // Total shares / total days returns daily average volume.
  const dailyAvgSql = "SELECT COALESCE(SUM(shares) / NULLIF(JULIANDAY('now') - JULIANDAY(MIN(created_at)), 0), 0) as avg_daily FROM trades WHERE product_id = ?";
  const dailyAvgVolume = await db.prepare(dailyAvgSql).get(productId) as { avg_daily: number };

  // Evaluate spike parameters only if historical trades exist.
  if (dailyAvgVolume.avg_daily > 0) {
    // Convert daily average volume to an hourly normal rate (divided by 24 hours).
    const hourlyNormal = dailyAvgVolume.avg_daily / 24;
    
    // Check if current hourly volume is greater than 3x normal hourly volume.
    // Also require at least 500 shares traded in this hour to avoid freezing newly deployed assets.
    if (hourlyNormal > 0 && hourlyVolume.vol > Math.max(500, hourlyNormal * 3)) {
      return {
        allowed: false,
        reason: `Volume spike detected on this asset (${hourlyVolume.vol} shares in 1hr). Trading temporarily restricted.`,
        severity: 'block'
      };
    }
  }

  // 5. Point farming prevention: limits users to a maximum of 20 trades per hour.
  // SQL Query: Count total trades executed by this user in the last hour.
  const recentCountSql = "SELECT COUNT(*) as cnt FROM trades WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')";
  const recentTradeCount = await db.prepare(recentCountSql).get(userId) as { cnt: number };

  // If the count is 20 or more, block additional trade executions.
  if (recentTradeCount.cnt >= 20) {
    return {
      allowed: false,
      reason: 'Trading rate limit exceeded (max 20 trades per hour). Please wait before trading again.',
      severity: 'block'
    };
  }

  // All checks passed: return allowed true.
  return { allowed: true };
}

/**
 * Check if a matched order is a self-trade (same user executing both sides).
 * 
 * @param userId - Unique identifier of the executing buyer/seller.
 * @param matchedOrderUserId - Unique identifier of the target order's owner.
 * @returns True if they are the same user, false otherwise.
 */
export function isSelfTrade(userId: string, matchedOrderUserId: string): boolean {
  return userId === matchedOrderUserId;
}


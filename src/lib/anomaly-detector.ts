import { getDb } from './db';
import { createNotification } from './db';
import { writeAuditLog } from './audit';

export interface AnomalyResult {
  isAnomaly: boolean;
  deviationScore: number;
  expectedPrice: number;
  reason?: string;
}

/**
 * Detects price anomalies using moving average and standard deviation (Z-Score).
 * Anomaly occurs if the trade price deviates by > 3 standard deviations 
 * from the recent moving average, or if there's > 40% sudden price shift.
 */
export async function detectPriceAnomaly(
  productId: string,
  tradePrice: number,
  userId: string
): Promise<AnomalyResult> {
  const db = await getDb();
  
  // Get recent 50 trades for this asset
  const recentTrades = await db.prepare(`
    SELECT price FROM price_history 
    WHERE product_id = ? 
    ORDER BY created_at DESC LIMIT 50
  `).all(productId) as { price: number }[];

  if (recentTrades.length < 5) {
    return { isAnomaly: false, deviationScore: 0, expectedPrice: tradePrice };
  }

  const prices = recentTrades.map(t => t.price);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  
  const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
  const stdDev = Math.sqrt(variance);

  // If variance is extremely low, fallback to percentage check to avoid infinite Z-scores
  const safeStdDev = Math.max(stdDev, mean * 0.05); 
  
  const zScore = Math.abs((tradePrice - mean) / safeStdDev);
  const percentDeviation = Math.abs((tradePrice - mean) / mean);

  const isZScoreAnomaly = zScore > 3.0;
  const isPercentAnomaly = percentDeviation > 0.40; // 40% sudden swing

  if (isZScoreAnomaly || isPercentAnomaly) {
    const reason = `Price $${tradePrice} deviates significantly from mean $${Math.round(mean)} (Z-Score: ${zScore.toFixed(2)}, Shift: ${(percentDeviation*100).toFixed(1)}%)`;
    
    // Log immutable audit event
    await writeAuditLog('security_event', userId, {
      targetId: productId,
      targetType: 'product',
      details: { 
        type: 'price_anomaly',
        tradePrice,
        meanPrice: mean,
        zScore,
        percentDeviation,
        reason
      }
    });

    // Alert administrators
    const admins = await db.prepare("SELECT id FROM users WHERE is_admin = 1").all() as { id: string }[];
    for (const admin of admins) {
      await createNotification(
        admin.id, 
        'Price Anomaly Detected', 
        `Asset ${productId}: ${reason}`, 
        'system'
      );
    }

    return { 
      isAnomaly: true, 
      deviationScore: zScore, 
      expectedPrice: Math.round(mean),
      reason 
    };
  }

  return { isAnomaly: false, deviationScore: zScore, expectedPrice: Math.round(mean) };
}

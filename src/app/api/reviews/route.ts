import { NextRequest, NextResponse } from 'next/server';
import { getDb, logEvent, recalculateConsensus, createNotification } from '@/lib/db';
import { enforceRateLimit } from '@/lib/rate-limit-request';
import { jsonError } from '@/lib/api-response';
import { authenticateRequest } from '@/lib/session';
import { v4 as uuidv4 } from 'uuid';
import { isAccurate, calculateStakeOutcome, calculateRRS, validateStake, getAccuracyBand } from '@/lib/rrs';
import { sanitizeText } from '@/lib/sanitize';
import { writeAuditLog } from '@/lib/audit';
import { getUserCANBenefits } from '@/lib/can';

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const productId = request.nextUrl.searchParams.get('productId');

    if (productId) {
      const reviews = await db.prepare(`
        SELECT r.id, r.condition_grade, r.price_estimate, r.review_text, r.points_staked,
          r.is_accurate, r.accuracy_score, r.reward_amount, r.created_at,
          u.name as reviewer_name, u.rrs_score as reviewer_rrs
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        WHERE r.product_id = ?
        ORDER BY r.points_staked DESC, r.created_at DESC
      `).all(productId);
      return NextResponse.json({ reviews });
    }

    const reviews = await db.prepare(`
      SELECT r.id, r.price_estimate, r.points_staked, r.is_accurate, r.accuracy_score,
        r.created_at, u.name as reviewer_name, p.name as product_name
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      JOIN products p ON r.product_id = p.id
      ORDER BY r.created_at DESC LIMIT 50
    `).all();
    return NextResponse.json({ reviews });
  } catch (error) {
    console.error('Reviews GET error:', error);
    return jsonError('Failed to load reviews', 500, 'INTERNAL');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return jsonError('Session expired. Please log in again.', 401, 'UNAUTHORIZED');

    const userId = user.id as string;
    const rl = await enforceRateLimit(request, `reviews:post:${userId}`, 5, 60);
    if (rl) return rl;

    const { productId, conditionGrade, priceEstimate, reviewText, pointsStaked } = await request.json();

    if (!productId || !conditionGrade || !priceEstimate) return jsonError('Missing fields', 400, 'BAD_REQUEST');
    
    const db = await getDb();
    const experimentGroup = user.experiment_group as string;
    const stakeAmount = experimentGroup === 'staking' ? validateStake(pointsStaked || 0, user.points as number) : 0;

    const existing = await db.prepare('SELECT id FROM reviews WHERE user_id = ? AND product_id = ?').get(userId, productId);
    if (existing) return jsonError('You already reviewed this product', 400, 'BAD_REQUEST');

    const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as Record<string, unknown>;
    if (!product) return jsonError('Product not found', 404, 'NOT_FOUND');

    const consensus = product.consensus_price as number;
    const band = getAccuracyBand(consensus);

    const accurate = isAccurate(priceEstimate, consensus);
    const outcome = calculateStakeOutcome(stakeAmount, priceEstimate, consensus, user.rrs_score as number);
    const reviewId = uuidv4();
    const safeText = sanitizeText(reviewText || '', 2000);

    // Apply CAN Yield Multipliers
    const canBenefits = await getUserCANBenefits(userId);
    const multiplier = canBenefits.multiplier;
    const finalReward = Math.round(outcome.reward * multiplier);
    const finalNetChange = accurate ? finalReward : outcome.netPointsChange;

    await db.transaction(async (txDb) => {
      await txDb.prepare(`
        INSERT INTO reviews (id, user_id, product_id, condition_grade, price_estimate, review_text, points_staked, is_accurate, accuracy_score, reward_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(reviewId, userId, productId, conditionGrade, priceEstimate, safeText, stakeAmount, accurate ? 1 : 0, outcome.accuracyPct, finalNetChange);

      if (stakeAmount > 0) {
        await txDb.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(stakeAmount, userId);
        await txDb.prepare('INSERT INTO point_transactions (id, user_id, amount, type, review_id, description) VALUES (?, ?, ?, ?, ?, ?)')
          .run(uuidv4(), userId, -stakeAmount, 'stake', reviewId, `Staked ${stakeAmount} pts`);

        if (accurate) {
          const returnTotal = outcome.stakeReturned + finalReward;
          await txDb.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(returnTotal, userId);
          await txDb.prepare('INSERT INTO point_transactions (id, user_id, amount, type, review_id, description) VALUES (?, ?, ?, ?, ?, ?)')
            .run(uuidv4(), userId, returnTotal, 'reward', reviewId, `Accurate! Stake returned + ${finalReward} bonus (${multiplier}x CAN Yield)`);
        } else if (outcome.stakeReturned > 0) {
          await txDb.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(outcome.stakeReturned, userId);
          await txDb.prepare('INSERT INTO point_transactions (id, user_id, amount, type, review_id, description) VALUES (?, ?, ?, ?, ?, ?)')
            .run(uuidv4(), userId, outcome.stakeReturned, 'penalty', reviewId, `Missed — returned ${outcome.stakeReturned} of ${stakeAmount}`);
        }
      }

      await txDb.prepare('UPDATE users SET total_reviews = total_reviews + 1 WHERE id = ?').run(userId);
      if (accurate) await txDb.prepare('UPDATE users SET accurate_reviews = accurate_reviews + 1 WHERE id = ?').run(userId);
      await txDb.prepare('UPDATE products SET total_reviews = total_reviews + 1 WHERE id = ?').run(productId);

      await recalculateConsensus(productId);

      const u = await txDb.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
      const allReviews = await txDb.prepare('SELECT r.price_estimate, p.consensus_price FROM reviews r JOIN products p ON r.product_id = p.id WHERE r.user_id = ?')
        .all(userId) as { price_estimate: number; consensus_price: number }[];
      
      const rrs = calculateRRS(u.accurate_reviews as number, u.total_reviews as number,
        allReviews.map(r => r.price_estimate), allReviews.map(r => r.consensus_price), u.created_at as string, u.last_active_at as string);

      const finalRRS = outcome.rrsPenalty > 0 ? Math.max(0, rrs.total - outcome.rrsPenalty) : rrs.total;
      await txDb.prepare('UPDATE users SET rrs_score = ? WHERE id = ?').run(finalRRS, userId);
    });

    await logEvent(userId, 'review', { productId, priceEstimate, consensus, stakeAmount, accurate, accuracyPct: outcome.accuracyPct, experimentGroup, band });

    await writeAuditLog('review_submitted', userId, {
      targetId: productId,
      targetType: 'product',
      details: { priceEstimate, consensus, stakeAmount, accurate, accuracyPct: outcome.accuracyPct, rrsPenalty: outcome.rrsPenalty },
    });

    // Notify reviewer of their result (in-app + push) — non-blocking
    const notifTitle = accurate ? 'Review Accurate ✓' : 'Review Submitted';
    const notifBody  = accurate
      ? `Your review of ${product.name} was accurate! You earned ${finalNetChange > 0 ? '+' + finalNetChange : finalNetChange} PTS.`
      : `Your review of ${product.name} was submitted. ${stakeAmount > 0 ? `Stake: ${outcome.stakeReturned} of ${stakeAmount} PTS returned.` : ''}`;
    createNotification(userId, notifTitle, notifBody, 'yield', '/portfolio').catch(() => {});

    const updatedUser = await db.prepare('SELECT id, email, name, points, experiment_group, total_reviews, accurate_reviews, rrs_score, created_at FROM users WHERE id = ?').get(userId);
    const newProd = await db.prepare('SELECT consensus_price FROM products WHERE id = ?').get(productId) as Record<string, unknown> | undefined;

    return NextResponse.json({
      review: { id: reviewId, accurate, accuracyPct: outcome.accuracyPct, reward: finalReward,
        stakeAmount, stakeReturned: outcome.stakeReturned, netPointsChange: finalNetChange,
        band: Math.round(band * 100), newConsensus: newProd?.consensus_price || consensus, canMultiplier: multiplier },
      user: updatedUser,
    });
  } catch (error) {
    console.error('Review POST error:', error);
    return jsonError('Failed to submit review', 500, 'INTERNAL');
  }
}

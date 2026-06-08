/**
 * POST /api/investor
 *
 * Investor data dashboard — A/B experiment analytics for external stakeholders.
 *
 * Security fixes over the original:
 *  1. No hardcoded fallback password ('Tokenly2026' is gone)
 *  2. Returns 503 if INVESTOR_ACCESS_CODE is not configured in env
 *  3. IP-based rate limiting: 5 attempts per IP per hour
 *  4. Writes audit log on every successful access
 *  5. Constant-time comparison to prevent timing attacks
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, getPlatformMetrics, checkRateLimit } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import crypto from 'crypto';

// ── Constant-time string comparison (prevents timing attacks) ─────────────────
function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    // Still compare to prevent length-based timing leaks
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Check env var is configured ──────────────────────────────────────────────
  const VALID_PASS = process.env.INVESTOR_ACCESS_CODE;
  if (!VALID_PASS || VALID_PASS.length < 8) {
    console.error('[INVESTOR] INVESTOR_ACCESS_CODE env var is not set or too short (min 8 chars)');
    return NextResponse.json(
      { error: 'Investor dashboard is not configured on this instance. Contact the platform operator.' },
      { status: 503 }
    );
  }

  // ── Rate limiting: 5 attempts per IP per hour ─────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';

  const allowed = await checkRateLimit(`investor:${ip}`, 5, 3600);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many access attempts. Please wait 1 hour before trying again.' },
      { status: 429 }
    );
  }

  // ── Authenticate ─────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const submittedPassword = typeof body.password === 'string' ? body.password : '';

  if (!safeCompare(submittedPassword, VALID_PASS)) {
    return NextResponse.json({ error: 'Invalid Access Code' }, { status: 401 });
  }

  // ── Audit log on successful access ───────────────────────────────────────────
  writeAuditLog('investor_dashboard_access', 'system', {
    details:   { ip, userAgent: req.headers.get('user-agent')?.substring(0, 100) },
    ipAddress: ip,
  }).catch(err => console.error('[INVESTOR] Audit log failed:', err));

  // ── Fetch real platform data ──────────────────────────────────────────────────
  try {
    const db = await getDb();

    const users = await db
      .prepare(
        'SELECT id, experiment_group, total_reviews, accurate_reviews, points, rrs_score, total_trades, created_at FROM users'
      )
      .all() as Record<string, unknown>[];

    const stakingGrp = { count: 0, total_reviews: 0, accurate_reviews: 0, accuracy: 0, rrsAvg: 0, avgTrades: 0 };
    const controlGrp = { count: 0, total_reviews: 0, accurate_reviews: 0, accuracy: 0, rrsAvg: 0, avgTrades: 0 };

    users.forEach((raw) => {
      const u = raw as {
        experiment_group?: string;
        total_reviews?: number;
        accurate_reviews?: number;
        rrs_score?: number;
        total_trades?: number;
      };
      const g = u.experiment_group === 'staking' ? stakingGrp : controlGrp;
      g.count++;
      g.total_reviews    += Number(u.total_reviews)   || 0;
      g.accurate_reviews += Number(u.accurate_reviews) || 0;
      g.rrsAvg           += Number(u.rrs_score)       || 0;
      g.avgTrades        += Number(u.total_trades)    || 0;
    });

    if (stakingGrp.count > 0) { stakingGrp.rrsAvg /= stakingGrp.count; stakingGrp.avgTrades /= stakingGrp.count; }
    if (controlGrp.count > 0) { controlGrp.rrsAvg /= controlGrp.count; controlGrp.avgTrades /= controlGrp.count; }
    if (stakingGrp.total_reviews > 0) stakingGrp.accuracy = (stakingGrp.accurate_reviews / stakingGrp.total_reviews) * 100;
    if (controlGrp.total_reviews > 0) controlGrp.accuracy = (controlGrp.accurate_reviews / controlGrp.total_reviews) * 100;

    const trades = await db
      .prepare('SELECT COUNT(*) as count, COALESCE(SUM(total_cost),0) as volume, COALESCE(AVG(total_cost),0) as avg_trade FROM trades')
      .get() as Record<string, unknown> | undefined;

    const consensusShift = await db.prepare(`
      SELECT p.name, p.brand, p.initial_consensus, p.consensus_price,
             p.total_reviews, p.price_confidence,
             ROUND(CAST(ABS(p.consensus_price - p.initial_consensus) * 100.0
               / NULLIF(p.initial_consensus, 0) AS NUMERIC), 1) as shift_pct
      FROM products p
      WHERE p.total_reviews > 0
      ORDER BY p.total_reviews DESC LIMIT 15
    `).all();

    const metrics = await getPlatformMetrics();

    const timeQuery = (days: number) => `datetime('now', '-${days} day')`;
    const dau = await db.prepare(`SELECT COUNT(*) as c FROM users WHERE last_active_at >= ${timeQuery(1)}`).get() as Record<string, unknown> | undefined;
    const mau = await db.prepare(`SELECT COUNT(*) as c FROM users WHERE last_active_at >= ${timeQuery(30)}`).get() as Record<string, unknown> | undefined;

    const stakingDist = await db.prepare(`
      SELECT
        CASE
          WHEN points_staked = 0    THEN '0 (None)'
          WHEN points_staked <= 50  THEN '1-50'
          WHEN points_staked <= 100 THEN '51-100'
          WHEN points_staked <= 200 THEN '101-200'
          ELSE '200+'
        END as range_label,
        COUNT(*) as count_val,
        ROUND(CAST(SUM(CASE WHEN is_accurate = 1 THEN 1 ELSE 0 END) * 100.0
          / NULLIF(COUNT(*), 0) AS NUMERIC), 1) as accuracy_rate
      FROM reviews
      WHERE points_staked > 0
      GROUP BY range_label
      ORDER BY MIN(points_staked)
    `).all();

    const delta      = stakingGrp.accuracy - controlGrp.accuracy;
    let hypothesis   = 'Insufficient data';
    if (stakingGrp.total_reviews >= 3 && controlGrp.total_reviews >= 3) {
      if (delta > 3)      hypothesis = `SUPPORTED — Staking group ${delta.toFixed(1)}pp more accurate`;
      else if (delta < -3) hypothesis = `CHALLENGED — Control group ${Math.abs(delta).toFixed(1)}pp more accurate`;
      else                 hypothesis = `INCONCLUSIVE — Groups within ${Math.abs(delta).toFixed(1)}pp of each other`;
    }

    return NextResponse.json({
      success: true,
      data: {
        stakingData:    stakingGrp,
        controlData:    controlGrp,
        networkVolume:  Number(trades?.volume)    || 0,
        totalTrades:    Number(trades?.count)     || 0,
        avgTradeSize:   Math.round(Number(trades?.avg_trade) || 0),
        totalUsers:     users.length,
        dau:            dau?.c || 0,
        mau:            mau?.c || 0,
        consensusShift,
        stakingDist,
        hypothesis,
        generatedAt:    new Date().toISOString(),
        platformMetrics: {
          totalFeesCollected: (metrics as Record<string, unknown>)?.total_fees_collected || 0,
          totalInsurancePool: (metrics as Record<string, unknown>)?.total_insurance_pool || 0,
          totalBurned:        (metrics as Record<string, unknown>)?.total_burned        || 0,
          totalBondsLocked:   (metrics as Record<string, unknown>)?.total_bonds_locked  || 0,
        },
      },
    });
  } catch (error) {
    console.error('[INVESTOR] Data fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

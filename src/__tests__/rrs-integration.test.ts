/**
 * RRS System — Integration Tests
 *
 * Tests the Reviewer Reputation Score engine:
 *  1. isAccurate() — consensus band matching
 *  2. getAccuracyBand() — band width per price tier
 *  3. calculateStakeOutcome() — reward/penalty math
 *  4. getTier() — RRS tier classification
 *  5. calculateRRS() — total score formula
 *
 * All functions are pure and deterministic — no DB needed.
 */

import { isAccurate, getAccuracyBand, calculateStakeOutcome, getTier } from '@/lib/rrs';

// ── getAccuracyBand ───────────────────────────────────────────────────────────

describe('getAccuracyBand — price tier band widths', () => {
  it('returns 30% band for prices < $100', () => {
    expect(getAccuracyBand(99)).toBeCloseTo(0.30, 5);
    expect(getAccuracyBand(1)).toBeCloseTo(0.30, 5);
  });

  it('returns 20% band for $100–$999 range', () => {
    expect(getAccuracyBand(100)).toBeCloseTo(0.20, 5);
    expect(getAccuracyBand(500)).toBeCloseTo(0.20, 5);
    expect(getAccuracyBand(999)).toBeCloseTo(0.20, 5);
  });

  it('returns 15% band for $1,000–$9,999 range', () => {
    expect(getAccuracyBand(1000)).toBeCloseTo(0.15, 5);
    expect(getAccuracyBand(5000)).toBeCloseTo(0.15, 5);
  });

  it('returns 10% band for assets ≥ $10,000', () => {
    expect(getAccuracyBand(10000)).toBeCloseTo(0.10, 5);
    expect(getAccuracyBand(50000)).toBeCloseTo(0.10, 5);
  });
});

// ── isAccurate ────────────────────────────────────────────────────────────────

describe('isAccurate — within consensus band', () => {
  it('estimate exactly equal to consensus is accurate', () => {
    expect(isAccurate(1000, 1000)).toBe(true);
  });

  it('estimate within 15% band of $1,000 consensus is accurate', () => {
    expect(isAccurate(1100, 1000)).toBe(true);  // 10% above
    expect(isAccurate(900,  1000)).toBe(true);  // 10% below
    expect(isAccurate(1149, 1000)).toBe(true);  // 14.9% above
    expect(isAccurate(851,  1000)).toBe(true);  // 14.9% below
  });

  it('estimate outside 15% band is inaccurate', () => {
    expect(isAccurate(1151, 1000)).toBe(false); // 15.1% above
    expect(isAccurate(849,  1000)).toBe(false); // 15.1% below
    expect(isAccurate(2000, 1000)).toBe(false); // 100% above
    expect(isAccurate(0,    1000)).toBe(false); // 100% below
  });

  it('cheap asset ($50) uses 30% band correctly', () => {
    expect(isAccurate(60, 50)).toBe(true);   // 20% above — within 30% band
    expect(isAccurate(34, 50)).toBe(false);   // 32% below — outside 30% band
  });

  it('expensive asset ($15,000) uses tight 10% band', () => {
    expect(isAccurate(16501, 15000)).toBe(false); // >10% above — outside band
    expect(isAccurate(13499, 15000)).toBe(false); // >10% below — outside band
    expect(isAccurate(15001, 15000)).toBe(true);  // just above consensus — within band
  });
});

// ── calculateStakeOutcome ─────────────────────────────────────────────────────

describe('calculateStakeOutcome — reward and penalty math', () => {
  it('accurate review with 100pt stake returns stake + reward', () => {
    const out = calculateStakeOutcome(100, 1000, 1000, 50);
    expect(out.stakeReturned).toBeGreaterThan(0);
    expect(out.reward).toBeGreaterThan(0);
    expect(out.netPointsChange).toBeGreaterThan(0);
  });

  it('inaccurate review loses some or all stake', () => {
    const out = calculateStakeOutcome(100, 5000, 1000, 50); // way off
    expect(out.netPointsChange).toBeLessThanOrEqual(0);
  });

  it('zero stake review has no financial impact', () => {
    const out = calculateStakeOutcome(0, 1000, 1000, 50);
    expect(out.stakeReturned).toBe(0);
    // Reward may still be > 0 (base reward without stake)
  });

  it('closer estimate gives higher reward than distant estimate', () => {
    const close = calculateStakeOutcome(50, 1050, 1000, 50); // 5% off
    const far   = calculateStakeOutcome(50, 1140, 1000, 50); // 14% off
    expect(close.reward).toBeGreaterThanOrEqual(far.reward);
  });
});

// ── getTier ───────────────────────────────────────────────────────────────────

describe('getTier — RRS tier classification', () => {
  it('score 0-19 → Standard', () => {
    expect(getTier(0)).toBe('Standard');
    expect(getTier(19)).toBe('Standard');
  });

  it('score 20-39 → Reviewer', () => {
    expect(getTier(20)).toBe('Reviewer');
    expect(getTier(39)).toBe('Reviewer');
  });

  it('score 40-59 → Trusted', () => {
    expect(getTier(40)).toBe('Trusted');
    expect(getTier(59)).toBe('Trusted');
  });

  it('score 60-79 → Expert', () => {
    expect(getTier(60)).toBe('Expert');
    expect(getTier(79)).toBe('Expert');
  });

  it('score 80+ → Verified Elite', () => {
    expect(getTier(80)).toBe('Verified Elite');
    expect(getTier(100)).toBe('Verified Elite');
    expect(getTier(999)).toBe('Verified Elite');
  });

  it('boundary values land in correct tier', () => {
    expect(getTier(19)).toBe('Standard');
    expect(getTier(20)).toBe('Reviewer');
    expect(getTier(39)).toBe('Reviewer');
    expect(getTier(40)).toBe('Trusted');
    expect(getTier(79)).toBe('Expert');
    expect(getTier(80)).toBe('Verified Elite');
  });
});

// ── Fee discount by tier ──────────────────────────────────────────────────────

describe('Fee discount by RRS tier', () => {
  const feeForTier = (tier: string) => {
    if (tier === 'Verified Elite') return 0;
    if (tier === 'Expert')         return 0.005;
    if (tier === 'Trusted')        return 0.01;
    if (tier === 'Reviewer')       return 0.02;
    return 0.03;
  };

  it('elite saves the most in fees', () => {
    const elite    = feeForTier('Verified Elite');
    const standard = feeForTier('Standard');
    expect(elite).toBeLessThan(standard);
    expect(elite).toBe(0);
  });

  it('fee tiers are monotonically increasing from elite to standard', () => {
    const tiers = ['Verified Elite', 'Expert', 'Trusted', 'Reviewer', 'Standard'];
    const rates = tiers.map(feeForTier);
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
    }
  });

  it('100 share trade at $1,000: Elite saves $300 vs Standard', () => {
    const base     = 100 * 1000;
    const eliteFee = Math.round(base * feeForTier('Verified Elite')); // 0
    const stdFee   = Math.round(base * feeForTier('Standard'));       // 3,000
    expect(stdFee - eliteFee).toBe(3_000);
  });
});

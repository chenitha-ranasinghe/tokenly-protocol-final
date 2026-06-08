/**
 * RRS Engine v3.0 — Unit Test Suite
 * Tests: Accuracy, Volume (with time decay), Consistency, Longevity,
 *        Stake Outcomes (with Quadratic Slashing), and full RRS calculation.
 */

import {
  calculateAccuracy,
  calculateVolume,
  calculateConsistency,
  calculateLongevity,
  calculateRRS,
  calculateStakeOutcome,
  isAccurate,
  getAccuracyBand,
  validateStake,
  getTier,
} from '@/lib/rrs';

// ===== Accuracy =====
describe('calculateAccuracy', () => {
  it('returns 50 for zero reviews', () => {
    expect(calculateAccuracy(0, 0)).toBe(50);
  });

  it('returns 100% for perfect accuracy', () => {
    expect(calculateAccuracy(10, 10)).toBe(100);
  });

  it('returns 50% for half accuracy', () => {
    expect(calculateAccuracy(5, 10)).toBe(50);
  });

  it('caps at 100', () => {
    expect(calculateAccuracy(200, 100)).toBe(100);
  });
});

// ===== Volume with Time Decay =====
describe('calculateVolume', () => {
  it('returns 0 for zero reviews', () => {
    expect(calculateVolume(0)).toBe(0);
  });

  it('returns a positive value for non-zero reviews', () => {
    expect(calculateVolume(10)).toBeGreaterThan(0);
  });

  it('caps at 100 for very high review counts', () => {
    expect(calculateVolume(500)).toBeLessThanOrEqual(100);
  });

  it('applies time decay for inactive users (3 months)', () => {
    const threeMonthsAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    const withDecay = calculateVolume(100, threeMonthsAgo);
    const withoutDecay = calculateVolume(100);
    expect(withDecay).toBeLessThan(withoutDecay);
  });

  it('does NOT decay for recently active users', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const withRecent = calculateVolume(100, yesterday);
    const withoutDate = calculateVolume(100);
    expect(withRecent).toBe(withoutDate);
  });
});

// ===== Consistency =====
describe('calculateConsistency', () => {
  it('returns 50 for less than 2 data points', () => {
    expect(calculateConsistency([100], [110])).toBe(50);
  });

  it('returns high score for consistent accurate estimates', () => {
    const estimates = [100, 200, 300];
    const consensuses = [102, 198, 305];
    expect(calculateConsistency(estimates, consensuses)).toBeGreaterThan(70);
  });

  it('returns low score for wildly inconsistent estimates', () => {
    const estimates = [100, 500, 50];
    const consensuses = [200, 100, 300];
    expect(calculateConsistency(estimates, consensuses)).toBeLessThan(50);
  });
});

// ===== Accuracy Bands =====
describe('getAccuracyBand', () => {
  it('returns 15% band for high-value items ($1000-$9999)', () => {
    expect(getAccuracyBand(1500)).toBe(0.15);
  });

  it('returns 30% band for low-value items (<$100)', () => {
    expect(getAccuracyBand(50)).toBe(0.30);
  });

  it('returns 20% band for mid-range ($100-$999)', () => {
    expect(getAccuracyBand(300)).toBe(0.20);
  });
});

// ===== isAccurate =====
describe('isAccurate', () => {
  it('returns true when estimate is within band', () => {
    expect(isAccurate(310, 300)).toBe(true); // ~3.3% off, band is 15%
  });

  it('returns false when estimate is outside band', () => {
    expect(isAccurate(500, 300)).toBe(false); // 66% off
  });

  it('returns true for zero consensus', () => {
    expect(isAccurate(100, 0)).toBe(true);
  });
});

// ===== Stake Outcomes + Quadratic Slashing =====
describe('calculateStakeOutcome', () => {
  it('returns full stake + reward for accurate review', () => {
    const result = calculateStakeOutcome(100, 300, 310); // Very close
    expect(result.isAccurate).toBe(true);
    expect(result.stakeReturned).toBe(100);
    expect(result.reward).toBeGreaterThan(0);
    expect(result.rrsPenalty).toBe(0);
  });

  it('burns stake for inaccurate review', () => {
    const result = calculateStakeOutcome(100, 500, 300); // Way off
    expect(result.isAccurate).toBe(false);
    expect(result.stakeReturned).toBeLessThan(100);
    expect(result.reward).toBe(0);
  });

  it('applies Quadratic Slashing for Elite reviewers with extreme deviation', () => {
    // Elite reviewer (RRS=90) who deviates > 50% from consensus
    const result = calculateStakeOutcome(100, 600, 300, 90);
    expect(result.isAccurate).toBe(false);
    expect(result.rrsPenalty).toBe(30); // Static 30-point drop
  });

  it('does NOT apply Quadratic Slashing for non-Elite reviewers', () => {
    // Regular reviewer (RRS=60) with same extreme deviation
    const result = calculateStakeOutcome(100, 600, 300, 60);
    expect(result.rrsPenalty).toBe(0);
  });

  it('does NOT apply Quadratic Slashing for small deviations', () => {
    // Elite reviewer (RRS=90) but only 20% deviation
    const result = calculateStakeOutcome(100, 360, 300, 90);
    expect(result.rrsPenalty).toBe(0);
  });

  it('handles zero stake gracefully', () => {
    const result = calculateStakeOutcome(0, 300, 310);
    expect(result.reward).toBe(0);
    expect(result.stakeReturned).toBe(0);
    expect(result.netPointsChange).toBe(0);
  });
});

// ===== Tiers =====
describe('getTier', () => {
  it('returns Verified Elite for 85+', () => {
    expect(getTier(90)).toBe('Verified Elite');
  });

  it('returns Standard for <20', () => {
    expect(getTier(10)).toBe('Standard');
  });
});

// ===== Validate Stake =====
describe('validateStake', () => {
  it('returns 0 for negative stake', () => {
    expect(validateStake(-10, 1000)).toBe(0);
  });

  it('clamps to user points', () => {
    expect(validateStake(1000, 200)).toBe(200);
  });

  it('clamps to MAX_STAKE (500)', () => {
    expect(validateStake(1000, 10000)).toBe(500);
  });

  it('returns 0 for below MIN_STAKE (10)', () => {
    expect(validateStake(5, 1000)).toBe(0);
  });
});

// ===== Full RRS Calculation =====
describe('calculateRRS', () => {
  it('returns a valid RRS with all components', () => {
    const rrs = calculateRRS(8, 10, [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000], 
      [105, 195, 310, 390, 510, 590, 710, 790, 910, 990], 
      new Date(Date.now() - 15 * 86400000).toISOString());
    
    expect(rrs.total).toBeGreaterThan(0);
    expect(rrs.total).toBeLessThanOrEqual(100);
    expect(rrs.accuracy).toBeGreaterThan(0);
    expect(rrs.volume).toBeGreaterThan(0);
    expect(rrs.consistency).toBeGreaterThan(0);
    expect(rrs.longevity).toBeGreaterThan(0);
    expect(rrs.tier).toBeDefined();
  });

  it('applies time decay when lastActiveAt is provided', () => {
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString();
    const now = new Date().toISOString();

    const rrsActive = calculateRRS(5, 10, [100, 200], [105, 195], now, now);
    const rrsInactive = calculateRRS(5, 10, [100, 200], [105, 195], now, sixMonthsAgo);

    expect(rrsInactive.volume).toBeLessThan(rrsActive.volume);
    expect(rrsInactive.total).toBeLessThan(rrsActive.total);
  });
});

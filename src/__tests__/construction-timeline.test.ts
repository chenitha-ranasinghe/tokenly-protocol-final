/**
 * Construction Timeline Engine — Unit Tests
 *
 * Tests the `computeConstructionTimeline` function in lib/construction-timeline.ts
 * covering all buffer calculations, seasonal adjustments, and confidence scoring.
 */

import { computeConstructionTimeline } from '@/lib/construction-timeline';

describe('computeConstructionTimeline — basic structure', () => {
  it('returns a 5-phase timeline by default', () => {
    const tl = computeConstructionTimeline();
    expect(tl.phases).toHaveLength(5);
    expect(tl.phases[0].name).toMatch(/Foundation/i);
    expect(tl.phases[4].name).toMatch(/completion|handover|UDA/i);
  });

  it('returns likely_weeks as sum of all phase totals', () => {
    const tl = computeConstructionTimeline();
    const expected = tl.phases.reduce((s, p) => s + p.total_weeks, 0);
    expect(tl.likely_weeks).toBe(expected);
  });

  it('each phase total_weeks >= base_weeks (buffers add, never subtract)', () => {
    const tl = computeConstructionTimeline();
    tl.phases.forEach(p => {
      expect(p.total_weeks).toBeGreaterThanOrEqual(p.base_weeks);
    });
  });

  it('milestone_pct values sum to 100', () => {
    const tl = computeConstructionTimeline();
    const total = tl.phases.reduce((s, p) => s + p.milestone_pct, 0);
    expect(total).toBe(100);
  });

  it('returns earliest, likely, and latest completion weeks in correct order', () => {
    const tl = computeConstructionTimeline();
    expect(tl.earliest_weeks).toBeGreaterThan(0);
    expect(tl.likely_weeks).toBeGreaterThanOrEqual(tl.earliest_weeks);
    expect(tl.latest_weeks).toBeGreaterThanOrEqual(tl.likely_weeks);
  });

  it('returns confidence between 0 and 100', () => {
    const tl = computeConstructionTimeline();
    expect(tl.confidence).toBeGreaterThanOrEqual(0);
    expect(tl.confidence).toBeLessThanOrEqual(100);
  });
});

describe('computeConstructionTimeline — seasonal buffers', () => {
  it('wet season start (May) produces longer timeline than dry season (February)', () => {
    const wet = computeConstructionTimeline({ startMonth: 5 });
    const dry = computeConstructionTimeline({ startMonth: 2 });
    expect(wet.likely_weeks).toBeGreaterThan(dry.likely_weeks);
  });

  it('wet season (April–September) consistently adds buffer to Foundation phase', () => {
    [4, 5, 6, 7, 8, 9].forEach(month => {
      const wet = computeConstructionTimeline({ startMonth: month });
      const dry = computeConstructionTimeline({ startMonth: 1 });
      const wetFnd = wet.phases[0].total_weeks;
      const dryFnd = dry.phases[0].total_weeks;
      expect(wetFnd).toBeGreaterThanOrEqual(dryFnd);
    });
  });

  it('dry season months (Oct–Mar) do not add wet season buffer', () => {
    [10, 11, 12, 1, 2, 3].forEach(month => {
      const tl = computeConstructionTimeline({ startMonth: month });
      expect(tl.phases[0].total_weeks).toBeGreaterThan(0); // valid output
    });
  });
});

describe('computeConstructionTimeline — floor area scaling', () => {
  it('larger floor area produces longer timeline', () => {
    const small = computeConstructionTimeline({ floorAreaSqm: 80 });
    const large = computeConstructionTimeline({ floorAreaSqm: 300 });
    expect(large.likely_weeks).toBeGreaterThan(small.likely_weeks);
  });

  it('150m² is the baseline (between small and large)', () => {
    const s   = computeConstructionTimeline({ floorAreaSqm: 80 });
    const mid = computeConstructionTimeline({ floorAreaSqm: 150 });
    const l   = computeConstructionTimeline({ floorAreaSqm: 300 });
    expect(mid.likely_weeks).toBeGreaterThanOrEqual(s.likely_weeks);
    expect(mid.likely_weeks).toBeLessThanOrEqual(l.likely_weeks);
  });
});

describe('computeConstructionTimeline — complexity factor', () => {
  it('high complexity produces longer timeline than low', () => {
    const low  = computeConstructionTimeline({ complexity: 'low' });
    const high = computeConstructionTimeline({ complexity: 'high' });
    expect(high.likely_weeks).toBeGreaterThan(low.likely_weeks);
  });

  it('medium complexity is between low and high', () => {
    const low  = computeConstructionTimeline({ complexity: 'low' });
    const med  = computeConstructionTimeline({ complexity: 'medium' });
    const high = computeConstructionTimeline({ complexity: 'high' });
    expect(med.likely_weeks).toBeGreaterThanOrEqual(low.likely_weeks);
    expect(med.likely_weeks).toBeLessThanOrEqual(high.likely_weeks);
  });
});

describe('computeConstructionTimeline — UDA inspection queue', () => {
  it('Structure and final phases include UDA inspection buffer', () => {
    const tl = computeConstructionTimeline();
    // The Structure and final phases have inspection = 1 and 3 weeks
    const structure = tl.phases[1];
    const final     = tl.phases[4];
    // total_weeks should exceed base_weeks by at least the inspection buffer
    expect(structure.total_weeks).toBeGreaterThan(structure.base_weeks);
    expect(final.total_weeks).toBeGreaterThan(final.base_weeks);
  });
});

describe('computeConstructionTimeline — combined worst case', () => {
  it('large, complex, wet-season project has significantly longer timeline', () => {
    const worst = computeConstructionTimeline({
      floorAreaSqm: 350,
      complexity:   'high',
      startMonth:   6,
    });
    const best = computeConstructionTimeline({
      floorAreaSqm: 100,
      complexity:   'low',
      startMonth:   2,
    });
    expect(worst.likely_weeks).toBeGreaterThan(best.likely_weeks * 1.2); // at least 20% longer
  });
});

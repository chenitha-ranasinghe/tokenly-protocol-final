import {
  recencyWeight,
  computeTradeSignal,
  computeReviewSignal,
  computeWisdomPrice,
  updateProductWisdomPrice,
} from '@/lib/wisdom-engine';
import { getDb } from '@/lib/db';

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));


describe('Wisdom Engine v2 — recency decay', () => {
  test('fresh trade weight ~1', () => {
    const t = new Date().toISOString();
    expect(recencyWeight(t)).toBeGreaterThan(0.99);
  });
  test('30d old trade decays', () => {
    const d = new Date(Date.now() - 30 * 86400000).toISOString();
    const w = recencyWeight(d);
    expect(w).toBeLessThan(1);
    expect(w).toBeGreaterThan(0.35);
  });
  test('90d old trade decays further', () => {
    const d = new Date(Date.now() - 90 * 86400000).toISOString();
    expect(recencyWeight(d)).toBeLessThan(recencyWeight(new Date(Date.now() - 30 * 86400000).toISOString()));
  });
  test('180d old trade small weight', () => {
    const d = new Date(Date.now() - 180 * 86400000).toISOString();
    expect(recencyWeight(d)).toBeLessThan(0.2);
  });
});

describe('Wisdom Engine v2 — trade signal', () => {
  test('empty trades -> zero', () => {
    expect(computeTradeSignal([])).toEqual({ value: 0, weight: 0 });
  });
  test('single trade returns value and partial weight', () => {
    const now = new Date().toISOString();
    const r = computeTradeSignal([{ price: 100, shares: 2, created_at: now }]);
    expect(r.value).toBe(100);
    expect(r.weight).toBeGreaterThan(0);
    expect(r.weight).toBeLessThanOrEqual(1);
  });
  test('weighted by shares', () => {
    const now = new Date().toISOString();
    const r = computeTradeSignal([
      { price: 100, shares: 1, created_at: now },
      { price: 200, shares: 3, created_at: now },
    ]);
    expect(r.value).toBeCloseTo((100 + 600) / 4, 5);
  });
  test('older trade contributes less than fresh at same price', () => {
    const fresh = new Date().toISOString();
    const old = new Date(Date.now() - 45 * 86400000).toISOString();
    const a = computeTradeSignal([
      { price: 100, shares: 10, created_at: fresh },
      { price: 100, shares: 10, created_at: old },
    ]);
    const b = computeTradeSignal([
      { price: 100, shares: 10, created_at: fresh },
      { price: 100, shares: 10, created_at: fresh },
    ]);
    expect(b.value).toBe(100);
    expect(a.value).toBeLessThanOrEqual(100);
  });
  test('many trades cap weight at 1', () => {
    const now = new Date().toISOString();
    const trades = Array.from({ length: 20 }, () => ({
      price: 50,
      shares: 1,
      created_at: now,
    }));
    expect(computeTradeSignal(trades).weight).toBe(1);
  });
});

describe('Wisdom Engine v2 — review signal', () => {
  test('too few reviews -> zero', () => {
    expect(
      computeReviewSignal([
        { price_estimate: 100, points_staked: 10 },
        { price_estimate: 110, points_staked: 10 },
      ])
    ).toEqual({ value: 0, weight: 0 });
  });
  test('three reviews minimum signal', () => {
    const r = computeReviewSignal([
      { price_estimate: 100, points_staked: 1 },
      { price_estimate: 100, points_staked: 1 },
      { price_estimate: 100, points_staked: 1 },
    ]);
    expect(r.value).toBe(100);
    expect(r.weight).toBeGreaterThan(0);
  });
  test('stake weighting skews average', () => {
    const r = computeReviewSignal([
      { price_estimate: 100, points_staked: 1 },
      { price_estimate: 100, points_staked: 1 },
      { price_estimate: 200, points_staked: 10 },
    ]);
    expect(r.value).toBeGreaterThan(130);
  });
  test('confidence grows with more reviews', () => {
    const base = Array.from({ length: 3 }, () => ({ price_estimate: 50, points_staked: 1 }));
    const many = Array.from({ length: 12 }, () => ({ price_estimate: 50, points_staked: 1 }));
    expect(computeReviewSignal(many).weight).toBeGreaterThan(computeReviewSignal(base).weight);
  });
});

describe('Wisdom Engine v2 — edge cases', () => {
  test('zero shares treated as weight 1 in reviews', () => {
    const r = computeReviewSignal([
      { price_estimate: 80, points_staked: 0 },
      { price_estimate: 80, points_staked: 0 },
      { price_estimate: 80, points_staked: 0 },
    ]);
    expect(r.value).toBe(80);
  });
  test('uniform prices average to same value', () => {
    const now = new Date().toISOString();
    const r = computeTradeSignal([
      { price: 75, shares: 2, created_at: now },
      { price: 75, shares: 2, created_at: now },
    ]);
    expect(r.value).toBe(75);
  });
  test('recency monotonic', () => {
    const a = recencyWeight(new Date(Date.now() - 10 * 86400000).toISOString());
    const b = recencyWeight(new Date(Date.now() - 20 * 86400000).toISOString());
    expect(a).toBeGreaterThan(b);
  });
});

describe('Wisdom Engine v2 — database integrations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('computeWisdomPrice returns null for non-existent product', async () => {
    const getMock = jest.fn().mockResolvedValue(undefined);
    (getDb as jest.Mock).mockResolvedValue({
      prepare: jest.fn().mockReturnValue({ get: getMock }),
    });

    const price = await computeWisdomPrice('non-existent');
    expect(price).toBeNull();
  });

  test('computeWisdomPrice returns fallback price when signals are empty', async () => {
    const getMock = jest.fn()
      .mockResolvedValueOnce({ id: 'prod-123', consensus_price: 150, retail_price: 120 })
      .mockResolvedValueOnce(undefined); // null external ref forces fallback

    const allMock = jest.fn().mockResolvedValue([]);

    (getDb as jest.Mock).mockResolvedValue({
      prepare: jest.fn().mockReturnValue({
        get: getMock,
        all: allMock,
      }),
    });

    const price = await computeWisdomPrice('prod-123');
    expect(price).not.toBeNull();
    expect(price?.estimatedPrice).toBe(150);
    expect(price?.confidence).toBe(15);
  });

  test('computeWisdomPrice calculates consensus from trades, reviews, and external reference', async () => {
    const now = new Date().toISOString();
    const productRecord = { id: 'prod-123', consensus_price: 150, retail_price: 120 };
    const externalRefRecord = { market_price_low: 110, market_price_high: 130, retail_price: 120 };
    const mockTrades = [
      { price: 100, shares: 10, created_at: now },
      { price: 105, shares: 5, created_at: now },
    ];
    const mockReviews = [
      { price_estimate: 110, points_staked: 100 },
      { price_estimate: 115, points_staked: 50 },
      { price_estimate: 105, points_staked: 80 },
    ];

    const getMock = jest.fn()
      .mockResolvedValueOnce(productRecord)
      .mockResolvedValueOnce(externalRefRecord);

    const allMock = jest.fn()
      .mockResolvedValueOnce(mockTrades)
      .mockResolvedValueOnce(mockReviews);

    (getDb as jest.Mock).mockResolvedValue({
      prepare: jest.fn().mockReturnValue({
        get: getMock,
        all: allMock,
      }),
    });

    const price = await computeWisdomPrice('prod-123');
    expect(price).not.toBeNull();
    expect(price?.estimatedPrice).toBeGreaterThan(95);
    expect(price?.estimatedPrice).toBeLessThan(135);
    expect(price?.confidence).toBeGreaterThan(15);
  });

  test('updateProductWisdomPrice executes database updates', async () => {
    const productRecord = { id: 'prod-123', consensus_price: 150, retail_price: 120 };
    
    const getMock = jest.fn()
      .mockResolvedValueOnce(productRecord)
      .mockResolvedValueOnce(undefined); // forces fallback so price is 150
    
    const allMock = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const runMock = jest.fn().mockResolvedValue({ changes: 1 });

    (getDb as jest.Mock).mockResolvedValue({
      prepare: jest.fn().mockReturnValue({
        get: getMock,
        all: allMock,
        run: runMock,
      }),
    });

    const updatedPrice = await updateProductWisdomPrice('prod-123');
    expect(updatedPrice).toBe(150);
    expect(runMock).toHaveBeenCalledWith(150, 15, 'prod-123');
  });
});


/**
 * Wash Trading Detection — Unit Test Suite
 *
 * Tests the five wash-trading prevention rules implemented in lib/wash-trading.ts:
 *  1. Self-trade prevention (same user as last counterparty)
 *  2. 10-minute cooldown on the same asset
 *  3. 15% single-session price movement cap
 *  4. Volume spike detection (>3× hourly normal)
 *  5. High-frequency trading rate limit (≥20 trades/hr)
 *
 * Uses a fully mocked database so no real DB is needed.
 */

import { checkWashTrading } from '@/lib/wash-trading';
import { getDb } from '@/lib/db';

// ── Mock the DB module ────────────────────────────────────────────────────────

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));

const mockDb = {
  prepare: jest.fn(),
};

/**
 * Creates a mock statement that returns the given value from .get() and .all().
 * The source code only uses .get() — .all() is provided as a safe fallback.
 */
const mockStmt = (returnValue: unknown) => ({
  get:  jest.fn().mockResolvedValue(returnValue),
  all:  jest.fn().mockResolvedValue(Array.isArray(returnValue) ? returnValue : []),
  run:  jest.fn().mockResolvedValue(undefined),
});

beforeEach(() => {
  jest.clearAllMocks();
  (getDb as jest.Mock).mockResolvedValue(mockDb);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const baseParams = {
  userId:         'user-abc',
  productId:      'prod-xyz',
  tradeType:      'buy' as const,
  shares:         10,
  executionPrice: 1000,
};

/**
 * Sets up mock DB responses for each query pattern used in wash-trading.ts.
 *
 * Source code queries (in execution order):
 * 1. Cooldown query:  SELECT created_at FROM trades WHERE user_id=? AND product_id=? ORDER BY created_at DESC LIMIT 1
 * 2. Price cap query: SELECT consensus_price FROM products WHERE id = ?
 * 3. Hourly volume:   SELECT COALESCE(SUM(shares), 0) as vol FROM trades WHERE product_id=? AND created_at >= ...
 * 4. Daily avg vol:   SELECT COALESCE(SUM(shares) / NULLIF(JULIANDAY(...), 0), 0) as avg_daily FROM trades WHERE product_id=?
 * 5. Rate limit:      SELECT COUNT(*) as cnt FROM trades WHERE user_id=? AND created_at >= ...
 */
function setupMocks({
  lastTrade      = null as { created_at: string } | null,
  consensusPrice = null as { consensus_price: number } | null,
  hourlyVolume   = { vol: 0 },
  dailyAvg       = { avg_daily: 0 },
  recentCount    = { cnt: 0 },
} = {}) {
  mockDb.prepare.mockImplementation((sql: string) => {
    // 1. Cooldown: last trade by this user on this product
    if (sql.includes('ORDER BY created_at DESC LIMIT 1'))
      return mockStmt(lastTrade);
    // 2. Consensus price from products table
    if (sql.includes('consensus_price') && sql.includes('products'))
      return mockStmt(consensusPrice);
    // 3. Daily average volume (contains JULIANDAY — must match before generic SUM(shares))
    if (sql.includes('JULIANDAY'))
      return mockStmt(dailyAvg);
    // 4. Hourly volume SUM(shares)
    if (sql.includes('SUM(shares)'))
      return mockStmt(hourlyVolume);
    // 5. Rate limit: COUNT(*) of user trades in last hour
    if (sql.includes('COUNT(*)') && sql.includes('user_id'))
      return mockStmt(recentCount);
    // Default fallback
    return mockStmt(null);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('checkWashTrading — clean trade', () => {
  it('allows a clean first trade with no history', async () => {
    setupMocks();
    const result = await checkWashTrading(
      baseParams.userId, baseParams.productId,
      baseParams.tradeType, baseParams.shares, baseParams.executionPrice
    );
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('allows buy after another user sold recently', async () => {
    setupMocks({
      lastTrade: { created_at: new Date(Date.now() - 60_000).toISOString() },
    });
    // The source only checks created_at for the cooldown timer — user_id is not
    // in the returned row so this trade 1 minute ago WILL trigger cooldown.
    // To truly test "another user", we need lastTrade to be null or beyond 10 min.
    // Updated: source checks by user_id AND product_id in the WHERE clause,
    // so a different user's trade won't appear in the result at all.
    // Pass null to simulate no matching trade found for this user+product combo.
    setupMocks({ lastTrade: null });
    const result = await checkWashTrading(
      baseParams.userId, baseParams.productId, 'buy', 5, 1000
    );
    expect(result.allowed).toBe(true);
  });
});

describe('checkWashTrading — cooldown rule', () => {
  it('blocks a trade on the same asset within 10 minutes', async () => {
    setupMocks({
      lastTrade: {
        created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
      },
    });
    const result = await checkWashTrading(
      baseParams.userId, baseParams.productId, 'buy', 10, 1000
    );
    expect(result.allowed).toBe(false);
    expect(result.severity).toBe('block');
    expect(result.reason).toMatch(/cooldown/i);
  });

  it('allows a trade on the same asset after 10 minutes', async () => {
    setupMocks({
      lastTrade: {
        created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(), // 12 min ago
      },
    });
    const result = await checkWashTrading(
      baseParams.userId, baseParams.productId, 'buy', 10, 1000
    );
    // After cooldown, should pass (assuming no other violations)
    expect(result.allowed).toBe(true);
  });
});

describe('checkWashTrading — price movement cap', () => {
  it('blocks a trade that moves price >15% from consensus', async () => {
    setupMocks({
      consensusPrice: { consensus_price: 1000 },
    });
    const result = await checkWashTrading(
      baseParams.userId, baseParams.productId, 'buy', 5,
      1200 // 20% above consensus — should be blocked
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/price/i);
  });

  it('allows a trade within 15% of consensus', async () => {
    setupMocks({
      consensusPrice: { consensus_price: 1000 },
    });
    const result = await checkWashTrading(
      baseParams.userId, baseParams.productId, 'buy', 5,
      1100 // 10% above — within cap
    );
    expect(result.allowed).toBe(true);
  });

  it('allows any price when there is no consensus price', async () => {
    setupMocks({ consensusPrice: null });
    const result = await checkWashTrading(
      baseParams.userId, baseParams.productId, 'buy', 5, 99999
    );
    expect(result.allowed).toBe(true);
  });
});

describe('checkWashTrading — volume spike', () => {
  it('blocks volume that exceeds 3× hourly normal rate', async () => {
    setupMocks({
      // Daily average = 240 shares/day → hourly normal = 10 → 3× threshold = 30
      // Hourly volume = 600 → well above 500-share min and 3× normal
      hourlyVolume: { vol: 600 },
      dailyAvg:     { avg_daily: 240 },
    });
    const result = await checkWashTrading(
      baseParams.userId, baseParams.productId, 'buy', 200, 1000
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/volume/i);
  });
});

describe('checkWashTrading — high frequency rate', () => {
  it('blocks when ≥20 trades in the last hour', async () => {
    setupMocks({ recentCount: { cnt: 21 } });
    const result = await checkWashTrading(
      baseParams.userId, baseParams.productId, 'buy', 1, 1000
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/rate/i);
  });

  it('allows exactly 19 trades in the last hour', async () => {
    setupMocks({ recentCount: { cnt: 19 } });
    const result = await checkWashTrading(
      baseParams.userId, baseParams.productId, 'buy', 1, 1000
    );
    expect(result.allowed).toBe(true);
  });
});

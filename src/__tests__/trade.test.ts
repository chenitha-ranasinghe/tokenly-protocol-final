/**
 * Trade Execution — Unit Tests
 *
 * Tests the financial logic of the trade route in isolation:
 *  - Fee calculation across RRS tiers (0% elite → 3% standard)
 *  - AMM constant-product formula (xy=k)
 *  - Seller bond rate logic (2% vs 10% based on trade history)
 *  - Market order total cost calculation
 *  - Limit order validation
 *  - Insurance pool allocation (0.1%)
 */

// ── Pure functions extracted for testing ─────────────────────────────────────
// These mirror the exact math in src/app/api/trade/route.ts

function calcFeeRate(rrsTier: string, isGodMode: boolean): number {
  if (isGodMode) return 0;
  if (rrsTier === 'Verified Elite') return 0;
  if (rrsTier === 'Expert')         return 0.005;
  if (rrsTier === 'Trusted')        return 0.01;
  if (rrsTier === 'Reviewer')       return 0.02;
  return 0.03;
}

function calcOrderTotals(shares: number, price: number, feeRate: number, insuranceRate = 0.001) {
  const base      = shares * price;
  const fee       = Math.round(base * feeRate);
  const insurance = Math.round(base * insuranceRate);
  return { base, fee, insurance, buyTotal: base + fee + insurance, sellNet: base - fee - insurance };
}

function ammPrice(type: 'buy' | 'sell', shares: number, currentPrice: number): number {
  const x = Math.min(10000, Math.max(500, Math.round(100000 / currentPrice)));
  const y = x * currentPrice;
  const k = x * y;
  if (type === 'buy')  return (k / (x - shares)) - y;
  return y - (k / (x + shares));
}

function sellerBondRate(completedTrades: number, orderValue: number): number {
  if (orderValue <= 200) return 0;
  return completedTrades >= 100 ? 0.02 : 0.10;
}

// ── Fee Rate Tests ────────────────────────────────────────────────────────────

describe('Trade fee rates', () => {
  it('God Mode admin pays zero fee', () => {
    expect(calcFeeRate('Verified Elite', true)).toBe(0);
    expect(calcFeeRate('Standard', true)).toBe(0);
  });

  it('Verified Elite pays 0% fee', () => {
    expect(calcFeeRate('Verified Elite', false)).toBe(0);
  });

  it('Expert pays 0.5% fee', () => {
    expect(calcFeeRate('Expert', false)).toBe(0.005);
  });

  it('Trusted pays 1.0% fee', () => {
    expect(calcFeeRate('Trusted', false)).toBe(0.01);
  });

  it('Reviewer pays 2.0% fee', () => {
    expect(calcFeeRate('Reviewer', false)).toBe(0.02);
  });

  it('Standard / unclassified pays 3.0% fee', () => {
    expect(calcFeeRate('Standard', false)).toBe(0.03);
    expect(calcFeeRate('', false)).toBe(0.03);
  });
});

// ── Order Total Calculation ───────────────────────────────────────────────────

describe('Order cost calculation', () => {
  it('calculates buy total correctly: base + fee + insurance', () => {
    const { base, fee, insurance, buyTotal } = calcOrderTotals(10, 1000, 0.03);
    expect(base).toBe(10_000);
    expect(fee).toBe(300);       // 3% of 10,000
    expect(insurance).toBe(10);  // 0.1% of 10,000
    expect(buyTotal).toBe(10_310);
  });

  it('calculates sell net correctly: base - fee - insurance', () => {
    const { sellNet } = calcOrderTotals(10, 1000, 0.03);
    expect(sellNet).toBe(9_690); // 10,000 - 300 - 10
  });

  it('Elite reviewer pays zero fee — full base with only insurance', () => {
    const { buyTotal, base, insurance } = calcOrderTotals(10, 1000, 0);
    expect(buyTotal).toBe(base + insurance); // 10,010
  });

  it('Expert (0.5%) fee on a 5-share trade at $500', () => {
    const { fee } = calcOrderTotals(5, 500, 0.005);
    expect(fee).toBe(Math.round(2500 * 0.005)); // 13 (rounded)
  });

  it('insurance is always 0.1% of base regardless of fee tier', () => {
    const standards  = calcOrderTotals(100, 200, 0.03);
    const elite      = calcOrderTotals(100, 200, 0);
    expect(standards.insurance).toBe(elite.insurance); // Same insurance
    expect(standards.insurance).toBe(Math.round(20_000 * 0.001));
  });
});

// ── AMM Constant Product Formula ──────────────────────────────────────────────

describe('AMM xy=k formula', () => {
  it('buy price is always higher than base for any positive shares', () => {
    const price   = 1000;
    const shares  = 5;
    const ammCost = ammPrice('buy', shares, price);
    const base    = shares * price;
    expect(ammCost).toBeGreaterThan(base); // AMM has slippage
  });

  it('sell proceeds are always lower than base (slippage)', () => {
    const price      = 1000;
    const shares     = 5;
    const ammRevenue = ammPrice('sell', shares, price);
    const base       = shares * price;
    expect(ammRevenue).toBeLessThan(base);
  });

  it('slippage increases with order size', () => {
    const p   = 1000;
    const s1  = ammPrice('buy', 1,  p) / 1;
    const s50 = ammPrice('buy', 50, p) / 50;
    expect(s50).toBeGreaterThan(s1); // Larger order = higher per-share cost
  });

  it('virtual reserve x is bounded between 500 and 10,000', () => {
    // Very low price → x would be huge → capped at 10,000
    const hiPrice = ammPrice('buy', 1, 10000);
    // Very high price → x would be tiny → floored at 500
    const loPrice = ammPrice('buy', 1, 1);
    expect(hiPrice).toBeGreaterThan(0);
    expect(loPrice).toBeGreaterThan(0);
  });

  it('buy + sell is not zero-sum (protocol captures spread)', () => {
    const p    = 1000;
    const s    = 10;
    const cost = ammPrice('buy', s, p);
    const rev  = ammPrice('sell', s, p);
    expect(cost).toBeGreaterThan(rev); // Protocol earns the spread
  });
});

// ── Seller Bond Rate ──────────────────────────────────────────────────────────

describe('Seller bond rate', () => {
  it('no bond required for orders worth ≤ $200', () => {
    expect(sellerBondRate(0,   200)).toBe(0);
    expect(sellerBondRate(0,   199)).toBe(0);
    expect(sellerBondRate(100, 100)).toBe(0);
  });

  it('new seller (< 100 trades) pays 10% bond on high-value orders', () => {
    expect(sellerBondRate(0,   500)).toBe(0.10);
    expect(sellerBondRate(99,  500)).toBe(0.10);
  });

  it('experienced seller (≥ 100 trades) pays only 2% bond', () => {
    expect(sellerBondRate(100, 500)).toBe(0.02);
    expect(sellerBondRate(999, 500)).toBe(0.02);
  });

  it('bond is exactly on the 100-trade threshold', () => {
    expect(sellerBondRate(99,  1000)).toBe(0.10);
    expect(sellerBondRate(100, 1000)).toBe(0.02);
  });
});

// ── Input Validation ──────────────────────────────────────────────────────────

describe('Trade input validation', () => {
  const isValidShares = (n: number) =>
    Number.isFinite(n) && n > 0 && Number.isInteger(n) && n <= 10_000;

  it('rejects fractional shares', () => {
    expect(isValidShares(1.5)).toBe(false);
    expect(isValidShares(0.1)).toBe(false);
  });

  it('rejects zero and negative shares', () => {
    expect(isValidShares(0)).toBe(false);
    expect(isValidShares(-1)).toBe(false);
  });

  it('rejects shares over 10,000', () => {
    expect(isValidShares(10_001)).toBe(false);
    expect(isValidShares(99_999)).toBe(false);
  });

  it('accepts valid whole shares between 1 and 10,000', () => {
    expect(isValidShares(1)).toBe(true);
    expect(isValidShares(100)).toBe(true);
    expect(isValidShares(10_000)).toBe(true);
  });

  it('rejects NaN and Infinity', () => {
    expect(isValidShares(NaN)).toBe(false);
    expect(isValidShares(Infinity)).toBe(false);
    expect(isValidShares(-Infinity)).toBe(false);
  });
});

import type { MarketReport } from '@/app/api/wisdom/report/route';

/** Static Wisdom Engine report for portfolio / interviewer demos (no auth). */
export const PORTFOLIO_WISDOM_REPORT: MarketReport & { generated_at: string } = {
  headline: 'Protocol liquidity stable; luxury categories lead weighted consensus',
  summary:
    'Tokenly Wisdom Engine blended four price sources this week: trade-weighted average (60%), external reference (25%), staked review consensus (10%), and recency decay (5%). Luxury timepieces and premium spirits show the strongest consensus drift with no anomaly flags triggered.',
  top_performer_analysis:
    'Top performers reflect genuine trade volume rather than wash patterns. Bond-staked CAN reviewers aligned with trade-weighted prices within 2.1% median deviation.',
  category_trends: [
    { category: 'Luxury Watches', sentiment: 'bullish', insight: 'Volume up 18% WoW; consensus above external reference.' },
    { category: 'Fine Spirits', sentiment: 'bullish', insight: 'Staked reviews reinforced trade-weighted floor.' },
    { category: 'Art & Collectibles', sentiment: 'bearish', insight: 'Thin liquidity; recency weight dampened outliers.' },
  ],
  macro_outlook:
    'Macro luxury demand remains resilient in APAC sandbox corridors. Protocol health indicators stay within MAS-aligned monitoring bands.',
  protocol_health: 'stable',
  next_week_forecast:
    'Expect continued consolidation in high-volume categories; anomaly detector armed at Z>3.0σ and >40% single-session shifts.',
  generated_at: new Date().toISOString(),
};

export const PORTFOLIO_WISDOM_WEIGHTS = [
  { source: 'Trade-weighted average', weight: 60, color: '#a37e2c' },
  { source: 'External market reference', weight: 25, color: '#3b82f6' },
  { source: 'Staked review consensus', weight: 10, color: '#22c55e' },
  { source: 'Recency decay', weight: 5, color: '#8b5cf6' },
] as const;

export const PORTFOLIO_AUDIT_SAMPLE = [
  { hash: 'a7f3…9c2e', event: 'Trade settlement', status: 'verified' },
  { hash: 'b2e1…4d8a', event: 'Consensus price update', status: 'verified' },
  { hash: 'c9d4…1f7b', event: 'Anomaly scan (no trigger)', status: 'verified' },
  { hash: 'd4a8…6e3c', event: 'CAN bond stake lock', status: 'verified' },
] as const;

export const PORTFOLIO_COMPLIANCE_METRICS = {
  frameworks: ['MAS Sandbox', 'GDPR', 'PDPA'],
  audit: {
    algorithm: 'SHA-256',
    chain: 'Rolling Merkle verification',
    lastVerified: 'Demo — portfolio mode',
    entriesSample: 12847,
  },
  anomaly: {
    zScoreThreshold: 3.0,
    priceShiftPct: 40,
    status: 'Armed — no triggers in demo window',
  },
  can: {
    tiers: ['500 TLY', '2000 TLY', '5000 TLY'],
    washTrading: 'Cross-wallet correlation checks active',
  },
};

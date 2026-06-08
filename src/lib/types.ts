// ===== TOKENLY — SHARED TYPESCRIPT INTERFACES v2.0 =====
// No `any` types. Every shape fully specified.

export interface User {
  id: string;
  name: string;
  email: string;
  points: number;
  experiment_group: 'staking' | 'control';
  total_reviews: number;
  accurate_reviews: number;
  rrs_score: number;
  created_at: string;
  last_active_at?: string;
  wallet_address?: string;
  total_trades?: number;
  is_admin?: number;
  is_banned?: number;
  is_id_verified?: number;
  privy_did?: string;
}

export type ProductCategory = 'Sneakers' | 'Watches' | 'Trading Cards' | 'Handbags' | 'Gold & Precious' | 'Gemstones' | 'Electronics' | 'Art & Collectibles';
export type VerificationStatus = 'certified' | 'pending' | 'rejected';
export type RRSTier = 'Standard' | 'Reviewer' | 'Trusted' | 'Expert' | 'Verified Elite';
export type CANTier = 1 | 2 | 3;
export type ToastType = 'success' | 'error' | 'info';
export type NotificationType = 'info' | 'yield' | 'dispute' | 'trade' | 'system';
export type ProposalStatus = 'active' | 'passed' | 'failed' | 'expired';
export type RedemptionStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type RedemptionMethod = 'physical_delivery' | 'vault_transfer' | 'depin_pickup';
export type BondStatus = 'locked' | 'released' | 'slashed';

export interface Product {
  id: string;
  name: string;
  brand: string;
  sku: string;
  category: ProductCategory;
  retail_price: number;
  market_price_low: number;
  market_price_high: number;
  consensus_price: number | null;
  initial_consensus?: number;
  total_tokens: number;
  total_reviews: number;
  review_count?: number;
  total_staked?: number | null;
  price_confidence: number;
  verification_status: VerificationStatus;
  vault_location?: string;
  insurance_policy?: string;
  digital_deed_hash?: string;
  image_url?: string;
  created_at?: string;
  /** Admin / vault UI: optional liquidity display */
  total_shares_available?: number;
}

export interface Review {
  id: string;
  product_name: string;
  brand: string;
  condition_grade: number;
  price_estimate: number;
  consensus_price: number;
  points_staked: number;
  is_accurate: number | null;
  accuracy_score: number | null;
  reward_amount: number;
  review_text: string;
  created_at: string;
}

export interface ExistingReview {
  id: string;
  reviewer_name: string;
  condition_grade: number;
  price_estimate: number;
  review_text: string;
  points_staked: number;
  is_accurate: number | null;
  accuracy_score: number | null;
  reviewer_rrs: number;
}

export interface ReviewResult {
  id: string;
  accurate: boolean;
  accuracyPct: number;
  reward: number;
  stakeAmount: number;
  stakeReturned: number;
  netPointsChange: number;
  band: number;
  newConsensus: number;
}

export interface Trade {
  id: string;
  user_id: string;
  product_id: string;
  trade_type: 'buy' | 'sell';
  shares: number;
  price_per_share: number;
  total_cost: number;
  fee_paid: number;
  insurance_fee: number;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  product_id: string;
  trade_type: 'buy' | 'sell';
  shares: number;
  price: number;
  status: 'open' | 'filled' | 'cancelled';
  points_locked: number;
  created_at: string;
}

export interface UserShare {
  id: string;
  user_id: string;
  product_id: string;
  shares: number;
  avg_buy_price: number;
  brand?: string;
  name?: string;
  consensus_price?: number;
  retail_price?: number;
  total_tokens?: number;
  category?: ProductCategory;
  image_url?: string;
}

export interface WisdomPrice {
  productId: string;
  estimatedPrice: number;
  confidence: number;
  signals: WisdomSignal[];
  lastUpdated: string;
  trend: 'up' | 'down' | 'stable';
  trendPct: number;
}

export interface WisdomSignal {
  source: 'internal_trades' | 'review_consensus' | 'external_reference' | 'recency_adjustment';
  weight: number;
  value: number;
  label: string;
}

export interface CANStatus {
  isAuthenticator: boolean;
  tier: CANTier | null;
  bondAmount: number;
  bondLocked: number;
  totalAuthentications: number;
  accuracyRate: number;
  feeReduction: number;
  specialties: ProductCategory[];
}

export interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

export interface PlatformMetrics {
  totalFeesCollected: number;
  totalInsurancePool: number;
  totalBurned: number;
  totalBondsLocked: number;
  tradingHalted: boolean;
}

export interface RRSBreakdown {
  accuracy: number;
  volume: number;
  consistency: number;
  longevity: number;
  total: number;
  tier: RRSTier;
}

export interface Quest {
  id: string;
  title: string;
  reward: number;
  type: string;
  completed: boolean;
  eligible: boolean;
}

export interface AnalyticsData {
  overall: Record<string, number>;
  abComparison: ABGroup[];
  consensusShift: ConsensusShiftItem[];
  stakingDistribution: StakingDistItem[];
  accuracyByPrice: AccuracyByPriceItem[];
  tierDistribution: TierDistItem[];
  experimentInsight: string;
}

export interface ABGroup {
  experiment_group: string;
  users: number;
  reviews: number;
  accuracy_rate: number;
  avg_stake: number;
  avg_rrs: number;
}

export interface ConsensusShiftItem {
  name: string;
  brand: string;
  initial_consensus: number;
  consensus_price: number;
  total_reviews: number;
  shift_pct: number;
}

export interface TierDistItem { tier: string; count: number; }
export interface StakingDistItem { range: string; count: number; accuracy_rate: number; }
export interface AccuracyByPriceItem { range: string; accuracy_rate: number; count: number; }

// Leaderboard — NO email field (GDPR compliance)
export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  rrs_score: number;
  total_reviews: number;
  accurate_reviews: number;
  experiment_group: 'staking' | 'control';
  points: number;
  total_trades: number;
  tier: RRSTier;
  accuracy: string;
}

export interface InvestorData {
  stakingData: GroupStats;
  controlData: GroupStats;
  networkVolume: number;
  totalTrades: number;
  avgTradeSize: number;
  totalUsers: number;
  dau: number;
  mau: number;
  consensusShift: ConsensusShiftItem[];
  stakingDist: StakingDistItem[];
  hypothesis: string;
  platformMetrics: PlatformMetrics;
}

export interface GroupStats {
  count: number;
  total_reviews: number;
  accurate_reviews: number;
  accuracy: number;
  rrsAvg: number;
  avgTrades: number;
}

export interface PriceHistoryEntry { price: number; shares: number; created_at: string; }
export interface ToastItem { id: string; message: string; type: ToastType; duration?: number; }
export interface Notification { id: string; user_id: string; title: string; message: string; type: NotificationType; is_read: number; created_at: string; }
export interface Proposal { id: string; creator_id: string; title: string; description: string; status: ProposalStatus; votes_for: number; votes_against: number; expires_at: string; created_at: string; }
export interface Redemption { id: string; user_id: string; product_id: string; status: RedemptionStatus; shipping_address?: string; contact_number?: string; redemption_method: RedemptionMethod; created_at: string; }
export interface SellerBond { id: string; user_id: string; product_id: string; order_id?: string; bond_amount: number; status: BondStatus; created_at: string; expires_at?: string; }
export interface MotionVariant { hidden: Record<string, unknown>; show: Record<string, unknown>; }

// ─── Admin Types ─────────────────────────────────────────────────────────────
export interface AdminRedemption {
  id: string;
  user_id: string;
  product_id: string;
  status: RedemptionStatus;
  shipping_address: string;
  created_at: string;
  user_name: string;
  product_name: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  points: number;
  experiment_group: string;
  total_reviews: number;
  rrs_score: number;
  is_banned: number;
  is_id_verified?: number;
  total_trades: number;
  created_at: string;
}

export interface CANBond {
  id: string;
  user_id: string;
  product_id: string;
  order_id: string;
  bond_amount: number;
  status: BondStatus;
  created_at: string;
  user_name: string;
  user_email: string;
  rrs_score: number;
}

export interface AdminData {
  usersCount: number;
  ordersCount: number;
  redemptionsCount: number;
  totalTrades: number;
  totalReviews: number;
  redemptions: AdminRedemption[];
  recentUsers: AdminUser[];
  tradingHalted: boolean;
  totalSecuredValue: number;
  protocolYield: number;
  authenticatorYield: number;
  platformMetrics: {
    totalFeesCollected: number;
    totalInsurancePool: number;
    totalBurned: number;
    totalBondsLocked: number;
  };
  canBonds: CANBond[];
}

// ─── CAN Verification Task ────────────────────────────────────────────────────
export interface CANTask {
  id: string;
  name: string;
  brand: string;
  sku: string;
  category: ProductCategory;
  retail_price: number;
  consensus_price: number | null;
  verification_status: VerificationStatus;
  total_reviews: number;
  review_count: number;
  /** Present when tasks are loaded from queue APIs */
  created_at?: string;
}

export type VisionVerdict = 'AUTHENTIC' | 'COUNTERFEIT' | 'INCONCLUSIVE';

export interface VisionForensic {
  task: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'N/A' | string;
  detail: string;
  confidence: number;
}

export interface VisionResult {
  success: boolean;
  verdict: VisionVerdict;
  confidence: number;
  notes: string;
  forensics: VisionForensic[];
  powered_by: string;
  disclaimer: string;
  error?: string;
}

// ─── Phase 3: Construction & pre-construction ─────────────────────────────────

export type ConstructionProjectStatus =
  | 'draft'
  | 'design'
  | 'pending_uda'
  | 'approved'
  | 'bidding'
  | 'contracted'
  | 'building'
  | 'complete';

export type LegalApprovalStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface ConstructionCompany {
  id: string;
  user_id: string;
  company_name: string;
  district: string;
  specializations: string;
  crs_score: number;
  on_time_rate: number;
  cost_accuracy: number;
  milestone_adherence: number;
  bond_return_rate: number;
  total_projects: number;
  created_at: string;
}

export interface ConstructionProject {
  id: string;
  owner_id: string;
  title: string;
  land_deed_ref?: string;
  district: string;
  brief?: string;
  status: ConstructionProjectStatus;
  legal_status: LegalApprovalStatus;
  approval_doc_hash?: string;
  floor_plan_json?: string;
  compliance_report_json?: string;
  estimated_land_value?: number;
  estimated_finished_value?: number;
  estimated_build_cost?: number;
  token_minted: number;
  winning_bid_id?: string;
  created_at: string;
  updated_at: string;
  bid_count?: number;
}

export interface ConstructionBid {
  id: string;
  project_id: string;
  company_id: string;
  company_name?: string;
  crs_score?: number;
  fixed_price_lkr: number;
  earliest_weeks: number;
  likely_weeks: number;
  latest_weeks: number;
  confidence: number;
  milestone_schedule_json?: string;
  bond_amount_lkr: number;
  status: 'submitted' | 'accepted' | 'rejected';
  created_at: string;
}

export interface ConstructionTimelinePhase {
  name: string;
  base_weeks: number;
  total_weeks: number;
  milestone_pct: number;
  buffers: Record<string, number>;
}

export interface ConstructionTimeline {
  phases: ConstructionTimelinePhase[];
  earliest_weeks: number;
  likely_weeks: number;
  latest_weeks: number;
  confidence: number;
}

// ─── Phase 4: Second-hand resale ──────────────────────────────────────────────

export type SecondHandGrade = 'DS' | 'VNDS' | 'Used-A' | 'Used-B' | 'Used-C';

export interface SecondHandListing {
  id: string;
  seller_id: string;
  title: string;
  category: string;
  condition_grade?: SecondHandGrade;
  condition_score?: number;
  usability_pct?: number;
  days_owned?: number;
  usage_frequency?: string;
  base_price_lkr: number;
  item_district: string;
  photos_json?: string;
  condition_report_json?: string;
  status: 'active' | 'sold' | 'withdrawn';
  created_at: string;
}

export interface SecondHandPriceQuote {
  floor: number;
  recommended: number;
  ceiling: number;
  confidence: number;
  breakdown: string;
  logistics_adjustment?: number;
}

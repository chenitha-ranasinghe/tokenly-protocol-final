/**
 * Reviewer Reputation Score (RRS) Engine v3.0
 * RRS = (Accuracy × 0.45) + (Volume × 0.25) + (Consistency × 0.20) + (Longevity × 0.10)
 *
 * v3.0 Additions:
 * - Quadratic Slashing: Elite reviewers (RRS > 85) who deviate > 50% from consensus
 *   receive a static 30-point RRS penalty on top of financial stake burn.
 * - Time Decay: Inactive users' volume score decays by 5% per month of inactivity.
 * 
 * This file contains the reputation models that evaluate reviewer predictions,
 * manage reward point distributions, and execute reputation slashing.
 */

// Define structural interface representing the outputs of RRS calculations.
export interface RRSComponents {
  accuracy: number;     // Accuracy rating (0-100) based on dynamic band matches
  volume: number;       // Volume score (0-100) calculated logarithmically with inactivity decay
  consistency: number;  // Deviation consistency score (0-100) using variance and average error
  longevity: number;    // Age factor (0-100) based on account age capped at 30 days
  total: number;        // The final aggregated reputation score (0-100)
  tier: 'Standard' | 'Reviewer' | 'Trusted' | 'Expert' | 'Verified Elite'; // User status tier
}

// Global Config: Minimum stake allowed for any review (10 points).
export const MIN_STAKE = 10;

// Global Config: Maximum stake allowed for any single review (500 points).
export const MAX_STAKE = 500;

// Global Config: Number of days required to reach maximum account age/longevity score (30 days).
const LONGEVITY_CAP_DAYS = 30;

/**
 * Returns the acceptable percentage band (estimation error margin) for an asset.
 * High-value products demand tighter estimate constraints.
 * 
 * @param consensusPrice - Current consensus price of the asset.
 * @returns Decimal representation of the percentage band (e.g. 0.10 for 10%).
 */
export function getAccuracyBand(consensusPrice: number): number {
  if (consensusPrice >= 10000) return 0.10; // $10,000+ items require ±10% accuracy
  if (consensusPrice >= 1000) return 0.15;  // $1,000–$9,999 items require ±15% accuracy
  if (consensusPrice >= 100) return 0.20;   // $100–$999 items require ±20% accuracy
  return 0.30;                              // Under $100 items require ±30% accuracy
}

/**
 * Calculates raw accuracy percentage.
 * 
 * @param accurate - Number of reviews within acceptable accuracy bands.
 * @param total - Total reviews submitted by the user.
 * @returns Raw accuracy score out of 100.
 */
export function calculateAccuracy(accurate: number, total: number): number {
  // If the user has submitted 0 reviews, default their starting accuracy score to 50.
  if (total === 0) return 50;
  // Calculate percentage: (accurate / total) * 100, capped at a maximum of 100.
  return Math.min(100, (accurate / total) * 100);
}

/**
 * Computes a logarithmic volume score with time decay for inactivity.
 * 
 * @param total - Total reviews submitted by the user.
 * @param lastActiveAt - Optional ISO timestamp of the user's last activity.
 * @returns Volume score out of 100.
 */
export function calculateVolume(total: number, lastActiveAt?: string): number {
  // 1. If 0 reviews, volume score is 0.
  if (total === 0) return 0;
  
  // 2. Logarithmic score: scales from 0 to 100, capping contributions at 500 reviews.
  // Using Math.log(total + 1) / Math.log(501) dampens spamming benefits.
  const baseVolume = Math.min(100, (Math.log(Math.min(total, 500) + 1) / Math.log(501)) * 100);

  // 3. Apply Time Decay: reduce volume score by 5% per month of inactivity.
  if (lastActiveAt) {
    // Calculate fractional months inactive (30 days * 86,400,000 milliseconds = 1 month).
    const monthsInactive = Math.max(0, (Date.now() - new Date(lastActiveAt).getTime()) / (30 * 86400000));
    
    // Apply decay if inactive for more than a month.
    if (monthsInactive > 1) {
      // Decay factor = 0.95 raised to the power of full inactive months.
      const decayFactor = Math.pow(0.95, Math.floor(monthsInactive));
      return baseVolume * decayFactor;
    }
  }
  return baseVolume;
}

/**
 * Computes consistency score using variance of deviation error percentages.
 * 
 * @param estimates - Array of reviewer price estimates.
 * @param consensuses - Array of corresponding consensus prices.
 * @returns Consistency score out of 100.
 */
export function calculateConsistency(estimates: number[], consensuses: number[]): number {
  // 1. Match estimates and consensuses, discarding elements with zero prices.
  const pairs = estimates
    .map((e, i) => ({ e, c: consensuses[i] }))
    .filter(p => p.c > 0);
    
  // 2. If less than 2 valid entries exist, return a neutral default of 50.
  if (pairs.length < 2) return 50;

  // 3. Calculate absolute deviation ratios for each pair: |estimate - consensus| / consensus.
  const devs = pairs.map(p => Math.abs(p.e - p.c) / p.c);
  
  // 4. Calculate average deviation: sum of deviations divided by count.
  const avg = devs.reduce((a, b) => a + b, 0) / devs.length;
  
  // 5. Calculate variance: average of squared differences from the mean.
  const variance = devs.reduce((s, d) => s + (d - avg) ** 2, 0) / devs.length;

  // 6. Convert variance to score: lower variance = higher score. Capped between 0 and 100.
  const fromVariance = Math.max(0, Math.min(100, (1 - Math.sqrt(variance) * 4) * 100));
  
  // 7. Convert average error to score: lower average error = higher score. Capped between 0 and 100.
  const fromAccuracy = Math.max(0, Math.min(100, (1 - avg * 2) * 100));
  
  // 8. Final consistency is weighted: 40% variance stability and 60% average error.
  return fromVariance * 0.4 + fromAccuracy * 0.6;
}

/**
 * Computes longevity score based on how many days the account has existed.
 * 
 * @param createdAt - The ISO creation timestamp of the account.
 * @returns Longevity score out of 100.
 */
export function calculateLongevity(createdAt: string): number {
  // 1. Calculate the age of the account in days.
  const days = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 86400000);
  
  // 2. Scale the age relative to the cap: reaches 100 after 30 days.
  return Math.min(100, (days / LONGEVITY_CAP_DAYS) * 100);
}

/**
 * Maps a numerical RRS score to a human-readable reputation tier.
 * 
 * @param rrs - The final aggregated RRS score.
 * @returns String representation of the tier name.
 */
export function getTier(rrs: number): RRSComponents['tier'] {
  if (rrs >= 80) return 'Verified Elite'; // Top 5% of reviewers
  if (rrs >= 60) return 'Expert';         // Experienced reviewers
  if (rrs >= 40) return 'Trusted';        // Consistently accurate reviews
  if (rrs >= 20) return 'Reviewer';       // Standard reviewer status
  return 'Standard';                      // New accounts or unverified history
}

/**
 * Aggregates all components to compute the final RRS score.
 * 
 * @param accurateReviews - Number of accurate reviews.
 * @param totalReviews - Total reviews submitted.
 * @param estimates - Array of estimated prices.
 * @param consensuses - Array of consensus prices.
 * @param createdAt - Account creation timestamp.
 * @param lastActiveAt - Last activity timestamp.
 * @returns RRSComponents details containing raw scores and tier tag.
 */
export function calculateRRS(
  accurateReviews: number, totalReviews: number,
  estimates: number[], consensuses: number[],
  createdAt: string, lastActiveAt?: string
): RRSComponents {
  const accuracy = calculateAccuracy(accurateReviews, totalReviews);
  const volume = calculateVolume(totalReviews, lastActiveAt);
  const consistency = calculateConsistency(estimates, consensuses);
  const longevity = calculateLongevity(createdAt);
  
  // Aggregated Weight: 45% Accuracy + 25% Volume + 20% Consistency + 10% Longevity.
  const total = Math.min(100, accuracy * 0.45 + volume * 0.25 + consistency * 0.20 + longevity * 0.10);
  
  return { accuracy, volume, consistency, longevity, total, tier: getTier(total) };
}

/**
 * Checks if a single estimate falls within the dynamic accuracy band for a product.
 * 
 * @param estimate - The estimated price.
 * @param consensus - The current consensus price of the asset.
 * @returns True if estimate is within tolerance, false otherwise.
 */
export function isAccurate(estimate: number, consensus: number): boolean {
  // If no consensus exists (new product), always classify the estimate as accurate.
  if (consensus <= 0) return true;
  // Check if error deviation percentage is less than or equal to the allowed band.
  return Math.abs(estimate - consensus) / consensus <= getAccuracyBand(consensus);
}

// TypeScript Interface: Details the outcome of staking operations on reviews.
export interface StakeOutcome {
  reward: number;           // The bonus points earned (if accurate)
  isAccurate: boolean;      // True if estimate fell within tolerance bands
  accuracyPct: number;      // Exact accuracy percent: (1 - deviation) * 100
  stakeReturned: number;    // Points returned to the user
  netPointsChange: number;  // The net increase or decrease to the user's balance
  rrsPenalty: number;       // Flat reputation score deduction (if slashed)
}

/**
 * Calculates financial payouts and reputation penalties for a review stake.
 * 
 * @param staked - Amount of points locked on the review.
 * @param estimate - Estimated price submitted.
 * @param consensus - Consensus price evaluated.
 * @param currentRRS - User's current reputation score.
 * @returns StakeOutcome containing rewards, returns, and slashing penalties.
 */
export function calculateStakeOutcome(staked: number, estimate: number, consensus: number, currentRRS?: number): StakeOutcome {
  // If product lacks a consensus price, refund stake with 0 net change.
  if (consensus <= 0) return { reward: 0, isAccurate: true, accuracyPct: 100, stakeReturned: staked, netPointsChange: 0, rrsPenalty: 0 };

  const band = getAccuracyBand(consensus);
  const deviation = Math.abs(estimate - consensus) / consensus;
  const accuracyPct = Math.max(0, (1 - deviation) * 100);
  const accurate = deviation <= band;

  // 1. Quadratic Slashing: Elite reviewers (RRS >= 85) who deviate > 50% from consensus
  // receive a static 30-point RRS penalty to protect feeds from collusive fraud.
  let rrsPenalty = 0;
  if (!accurate && currentRRS && currentRRS >= 85 && deviation > 0.50) {
    rrsPenalty = 30; // Static 30-point deduction
  }

  // If no points were staked on this review, return outcomes with zero rewards.
  if (staked === 0) {
    return { reward: 0, isAccurate: accurate, accuracyPct, stakeReturned: 0, netPointsChange: 0, rrsPenalty };
  }

  let reward: number;
  let stakeReturned: number;

  if (accurate) {
    // 2. Payout Reward: scaled by proximity to consensus.
    // Proximity precision: scales from 0 to 1.0 depending on error relative to band.
    const precision = 1 - deviation / band;
    // Reward multiplier: between 15% and 50% of the staked points.
    reward = Math.round(staked * (0.15 + precision * 0.35));
    // Full stake is returned safely.
    stakeReturned = staked;
  } else {
    // 3. Penalty Burn: scaled by size of deviation overshoot.
    // Overshoot: scales from 0 to 1.0 based on how far outside the band the estimate was.
    const overshoot = Math.min(1, (deviation - band) / band);
    // Penalty rate: user loses between 20% and 80% of their locked stake.
    const penaltyRate = 0.20 + overshoot * 0.60;
    reward = 0;
    // Return remaining points (original stake minus burned penalty).
    stakeReturned = Math.max(0, staked - Math.round(staked * penaltyRate));
  }

  // Net balance change: +reward (if accurate) or -burned amount (if missed).
  const netPointsChange = accurate ? reward : -(staked - stakeReturned);

  return { reward, isAccurate: accurate, accuracyPct, stakeReturned, netPointsChange, rrsPenalty };
}

/**
 * Validates and clamps a requested stake amount against user balances and constraints.
 * 
 * @param requested - The stake amount requested by the user.
 * @param userPoints - User's total point balance.
 * @returns Validated stake amount between MIN_STAKE and MAX_STAKE, or 0.
 */
export function validateStake(requested: number, userPoints: number): number {
  if (requested <= 0) return 0;
  // Clamp requested stake against user's balance and global MAX_STAKE (500).
  const clamped = Math.min(requested, userPoints, MAX_STAKE);
  // Require at least MIN_STAKE (10). If user cannot afford it, return 0.
  return clamped >= MIN_STAKE ? clamped : 0;
}


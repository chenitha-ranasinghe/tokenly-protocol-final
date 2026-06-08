import { getDb } from './db';
import type { CANTier } from './types';

export const CAN_TIERS = {
  INSPECTOR: 'Network Inspector',
  AUTHENTICATOR: 'Master Authenticator',
  GEMOLOGIST: 'Gemologist Partner',
} as const;

export interface CANTierInfo {
  name: string;
  tier: CANTier | null;
  multiplier: number;
  feeReduction: number;
}

/**
 * V5.0 Tiered Bond System:
 * Tier 1 (items <$200): 500 TLY
 * Tier 2 (items $200-$2000): 2,000 TLY
 * Tier 3 (items >$2000): 5,000 TLY
 */
export const CAN_BOND_TIERS: Record<CANTier, { minBondTLY: number; label: string; maxItemValue: number }> = {
  1: { minBondTLY: 500,   label: 'Tier 1 — Items under $200',       maxItemValue: 200 },
  2: { minBondTLY: 2000,  label: 'Tier 2 — Items $200–$2,000',      maxItemValue: 2000 },
  3: { minBondTLY: 5000,  label: 'Tier 3 — Items above $2,000',     maxItemValue: Infinity },
};

export async function getUserCANBenefits(userId: string): Promise<CANTierInfo> {
  const db = await getDb();
  const activeBonds = await db.prepare(
    "SELECT order_id FROM seller_bonds WHERE user_id = ? AND product_id = 'can_dao_node' AND status = 'locked'"
  ).all(userId) as { order_id: string }[];

  const tiers = activeBonds.map(b => b.order_id.replace('can_tier_', ''));

  if (tiers.includes(CAN_TIERS.GEMOLOGIST)) {
    return { name: CAN_TIERS.GEMOLOGIST, tier: 3, multiplier: 2.5, feeReduction: 0.80 };
  }
  if (tiers.includes(CAN_TIERS.AUTHENTICATOR)) {
    return { name: CAN_TIERS.AUTHENTICATOR, tier: 2, multiplier: 1.5, feeReduction: 0.50 };
  }
  if (tiers.includes(CAN_TIERS.INSPECTOR)) {
    return { name: CAN_TIERS.INSPECTOR, tier: 1, multiplier: 1.1, feeReduction: 0.20 };
  }
  return { name: 'None', tier: null, multiplier: 1.0, feeReduction: 0 };
}

export function isAuthorizedForTier(rrs: number, threshold: number): boolean {
  return rrs >= threshold;
}

/** Get required bond TLY for a given item value */
export function getRequiredBond(itemValueUSD: number): { tier: CANTier; minBondTLY: number } {
  if (itemValueUSD < 200) return { tier: 1, minBondTLY: 500 };
  if (itemValueUSD <= 2000) return { tier: 2, minBondTLY: 2000 };
  return { tier: 3, minBondTLY: 5000 };
}

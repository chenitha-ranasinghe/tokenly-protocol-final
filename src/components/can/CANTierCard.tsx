'use client';
import type { CANTier } from '@/lib/types';

interface CANTierCardProps {
  tier: CANTier;
  name: string;
  minBondTLY: number;
  feeReduction: number;
  itemValueLabel: string;
  multiplier: number;
  isActive: boolean;
  onJoin: (tier: CANTier) => void;
}

const TIER_COLORS: Record<CANTier, string> = {
  1: 'border-blue-500/30 bg-blue-500/5',
  2: 'border-[var(--rolex-gold)]/30 bg-[var(--rolex-gold)]/5',
  3: 'border-purple-500/30 bg-purple-500/5',
};
const TIER_TEXT: Record<CANTier, string> = {
  1: 'text-blue-400',
  2: 'text-[var(--rolex-gold)]',
  3: 'text-purple-400',
};

export function CANTierCard({ tier, name, minBondTLY, feeReduction, itemValueLabel, multiplier, isActive, onJoin }: CANTierCardProps) {
  return (
    <div className={`p-6 border ${TIER_COLORS[tier]} relative`}>
      {isActive && (
        <div className="absolute top-3 right-3 px-2 py-1 bg-green-500/20 border border-green-500/40 text-green-400 text-[9px] font-mono uppercase tracking-widest">
          Active
        </div>
      )}
      <div className={`text-xs font-bold uppercase tracking-widest ${TIER_TEXT[tier]} mb-2`}>Tier {tier}</div>
      <div className="text-white font-bold text-lg mb-1">{name}</div>
      <div className="text-[var(--text-muted)] text-[11px] font-mono mb-4">{itemValueLabel}</div>
      <div className="space-y-2 mb-6">
        <div className="flex justify-between text-[11px] font-mono">
          <span className="text-[var(--text-muted)]">Min Bond</span>
          <span className={`font-bold ${TIER_TEXT[tier]}`}>{minBondTLY.toLocaleString()} TLY</span>
        </div>
        <div className="flex justify-between text-[11px] font-mono">
          <span className="text-[var(--text-muted)]">Fee Reduction</span>
          <span className="text-white font-bold">{(feeReduction * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between text-[11px] font-mono">
          <span className="text-[var(--text-muted)]">Yield Multiplier</span>
          <span className="text-white font-bold">{multiplier}x</span>
        </div>
      </div>
      {!isActive && (
        <button
          onClick={() => onJoin(tier)}
          className={`w-full p-3 border ${TIER_COLORS[tier]} ${TIER_TEXT[tier]} text-[10px] font-mono uppercase tracking-widest hover:opacity-80 transition-opacity`}
        >
          Join Tier {tier}
        </button>
      )}
    </div>
  );
}

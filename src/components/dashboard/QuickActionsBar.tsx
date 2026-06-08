'use client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Star, ShoppingCart, BarChart3, Trophy, Shield, Package } from 'lucide-react';

// ── Quick Actions Bar ─────────────────────────────────────────────────────
export function QuickActionsBar() {
  const router = useRouter();

  const ACTIONS = [
    { label: 'Review Asset',    icon: <Star      size={12} />, href: '/products',   color: '#a37e2c' },
    { label: 'Trade Vault',     icon: <ShoppingCart size={12} />, href: '/vault',    color: '#3b82f6' },
    { label: 'View Analytics',  icon: <BarChart3 size={12} />, href: '/analytics',  color: '#22c55e' },
    { label: 'Leaderboard',     icon: <Trophy    size={12} />, href: '/leaderboard',color: '#8b5cf6' },
    { label: 'CAN Network',     icon: <Shield    size={12} />, href: '/can',        color: '#f97316' },
    { label: 'ArchionLabs',     icon: <Package   size={12} />, href: '/archionlabs',color: '#06b6d4' },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-px bg-[var(--border-dark)] border border-[var(--border-dark)]">
      {ACTIONS.map((a, i) => (
        <motion.button
          key={i}
          onClick={() => router.push(a.href)}
          whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)', y: -1 }}
          whileTap={{ scale: 0.97 }}
          className="bg-[#050505] p-3 flex flex-col items-center gap-2 group transition-all"
        >
          <div
            className="w-8 h-8 border flex items-center justify-center transition-all group-hover:scale-110"
            style={{
              color:        a.color,
              borderColor:  a.color + '40',
              background:   a.color + '10',
            }}
          >
            {a.icon}
          </div>
          <span className="text-[7px] font-mono uppercase tracking-widest text-[var(--text-muted)] group-hover:text-white transition-colors font-bold text-center leading-tight">
            {a.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

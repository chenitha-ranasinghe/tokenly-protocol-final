'use client';
import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/client';

// ── Network Activity Pulse ────────────────────────────────────────────────
export function NetworkPulse() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    authFetch('/api/ticker')
      .then(r => r.json())
      .then(d => setCount(d.totalReviews ?? null))
      .catch(() => null);
  }, []);

  if (count === null) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--success)]/5 border border-[var(--success)]/20">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
      <span className="text-[7px] font-mono uppercase tracking-[0.2em] text-[var(--success)] font-bold">
        {count.toLocaleString()} Verified Reviews On-Chain
      </span>
    </div>
  );
}

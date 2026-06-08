'use client';
import { useEffect, useState } from 'react';
import type { WisdomPrice } from '@/lib/types';

export function WisdomPriceCard({ productId }: { productId: string }) {
  const [wisdom, setWisdom] = useState<WisdomPrice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/wisdom?productId=${productId}`, { credentials: 'include' })
      .then(r => r.json() as Promise<{ wisdom: WisdomPrice }>)
      .then(d => setWisdom(d.wisdom))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) return (
    <div className="p-4 border border-[var(--border-dark)] bg-[#0A0A0A] animate-pulse">
      <div className="h-4 bg-white/5 rounded mb-2" />
      <div className="h-8 bg-white/5 rounded" />
    </div>
  );
  if (!wisdom) return null;

  const trendColor = wisdom.trend === 'up' ? 'text-green-400' : wisdom.trend === 'down' ? 'text-red-400' : 'text-[var(--text-muted)]';
  const trendIcon = wisdom.trend === 'up' ? '↑' : wisdom.trend === 'down' ? '↓' : '→';

  return (
    <div className="p-5 border border-[var(--rolex-gold)]/20 bg-[var(--rolex-gold)]/5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] font-bold">Wisdom Engine</span>
        <span className="text-[9px] font-mono text-[var(--text-muted)]">Confidence: {wisdom.confidence}%</span>
      </div>
      <div className="text-2xl font-bold text-white font-mono mb-1">
        {wisdom.estimatedPrice.toLocaleString()} PTS
        <span className={`text-sm ml-2 ${trendColor}`}>{trendIcon} {Math.abs(wisdom.trendPct).toFixed(1)}%</span>
      </div>
      <div className="mt-3 space-y-1.5">
        {wisdom.signals.map((sig, i) => (
          <div key={i} className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-[var(--text-muted)]">{sig.label}</span>
            <span className="text-white">{(sig.weight * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[9px] text-[var(--text-muted)] font-mono opacity-60">
        Updated {new Date(wisdom.lastUpdated).toLocaleTimeString()}
      </div>
    </div>
  );
}

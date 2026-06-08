'use client';
import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { authFetch } from '@/lib/client';

interface TickerData {
  totalUsers: number;
  totalReviews: number;
  totalTrades: number;
  topAsset: string;
  networkStatus: string;
}

export default function GlobalTicker({ className }: { className?: string }) {
  const [data, setData] = useState<TickerData | null>(null);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await authFetch('/api/ticker');
        if (res.ok) setData(await res.json());
      } catch {}
    };
    fetch_();
    const id = setInterval(fetch_, 30000);
    return () => clearInterval(id);
  }, []);

  const items: string[] = data ? [
    `PROTOCOL V5`,
    `NODES: ${data.totalUsers}`,
    `VERIFICATIONS: ${data.totalReviews}`,
    `TRADES: ${data.totalTrades}`,
    data.topAsset ? `TOP ASSET: ${data.topAsset}` : `MARKET OPEN`,
    `NETWORK: ${data.networkStatus}`,
    `ORACLE: NOMINAL`,
    `ENGINE: OPERATIONAL`,
  ] : [
    `PROTOCOL V5`,
    `STATUS: INITIALIZING`,
    `ORACLE: NOMINAL`,
    `ENGINE: OPERATIONAL`,
  ];

  const doubled = useMemo(() => [...items, ...items], [items]);

  return (
    <div
      role="marquee"
      aria-label="Live protocol data"
      className={className || "w-full overflow-hidden bg-black border-b border-[var(--border-gold)] h-7 flex items-center"}
    >
      <div className="flex animate-ticker whitespace-nowrap items-center will-change-transform shrink-0">
        {doubled.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center whitespace-nowrap shrink-0"
          >
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/80 font-bold font-mono">
              {item}
            </span>
            <span className="inline-block mx-8 text-[7px] text-[var(--rolex-gold)]/50">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

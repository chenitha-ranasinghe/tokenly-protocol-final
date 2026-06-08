'use client';
import type { UserShare } from '@/lib/types';

interface PortfolioTableProps {
  shares: UserShare[];
  onTrade: (productId: string) => void;
}

export function PortfolioTable({ shares, onTrade }: PortfolioTableProps) {
  if (shares.length === 0) {
    return (
      <div className="p-12 text-center border border-[var(--border-dark)] bg-[#0A0A0A]">
        <p className="text-[var(--text-muted)] font-mono text-[11px] uppercase tracking-widest">No vault tokens held yet</p>
        <p className="text-[var(--text-muted)] font-mono text-[10px] mt-2 opacity-60">Browse the marketplace to start trading authenticated assets</p>
      </div>
    );
  }
  return (
    <div className="border border-[var(--border-dark)] overflow-hidden">
      <table className="w-full text-[11px] font-mono">
        <thead>
          <tr className="border-b border-[var(--border-dark)] bg-[#0A0A0A]">
            {['Asset','Brand','Tokens','Avg Buy','Market','P&L','Action'].map(h => (
              <th key={h} className="p-4 text-left text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-bold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shares.map((s) => {
            const current = s.consensus_price ?? s.avg_buy_price;
            const pnl = (current - s.avg_buy_price) * s.shares;
            const pnlPct = ((current - s.avg_buy_price) / s.avg_buy_price) * 100;
            const isUp = pnl >= 0;
            return (
              <tr key={s.id} className="border-b border-[var(--border-dark)] hover:bg-white/[0.02] transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {s.image_url ? (
                      <div className="w-8 h-8 border border-[var(--border-dark)] overflow-hidden shrink-0">
                        <img src={s.image_url} alt={s.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-[#050505] border border-[var(--border-dark)] flex items-center justify-center shrink-0">
                        <span className="text-[7px] text-[var(--text-muted)]">?</span>
                      </div>
                    )}
                    <span className="text-white font-bold">{s.name ?? '—'}</span>
                  </div>
                </td>
                <td className="p-4 text-[var(--text-muted)]">{s.brand ?? '—'}</td>
                <td className="p-4 text-[var(--rolex-gold)]">{(s.shares || 0).toLocaleString()}</td>
                <td className="p-4 text-[var(--text-muted)]">{(s.avg_buy_price || 0).toLocaleString()} PTS</td>
                <td className="p-4 text-white">{(current || 0).toLocaleString()} PTS</td>
                <td className={`p-4 font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                  {isUp ? '+' : ''}{(pnl || 0).toFixed(0)} ({pnlPct || 0 ? pnlPct.toFixed(1) : '0.0'}%)
                </td>
                <td className="p-4">
                  <button
                    onClick={() => onTrade(s.product_id)}
                    className="px-3 py-1.5 border border-[var(--rolex-gold)]/30 text-[var(--rolex-gold)] text-[9px] uppercase tracking-widest hover:bg-[var(--rolex-gold)]/10 transition-colors"
                  >
                    Trade
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

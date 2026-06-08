'use client';

export interface OrderEntry {
  id: string;
  trade_type: 'buy' | 'sell';
  price: number;
  shares: number;
  user_id?: string;
}

interface OrderBookProps {
  bids: OrderEntry[];
  asks: OrderEntry[];
  myOrders: OrderEntry[];
  onCancelOrder: (id: string) => void;
}

export function OrderBook({ bids, asks, myOrders, onCancelOrder }: OrderBookProps) {
  return (
    <div className="space-y-6">
      {/* Live Order Book */}
      <div className="bg-[#050505] border border-[var(--border-dark)] p-8">
        <h3 className="text-[11px] font-bold font-mono uppercase tracking-widest text-white mb-6 border-b border-[var(--border-dark)] pb-4">
          LIVE ORDER BOOK
        </h3>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--success)] mb-4 font-bold border-b border-[var(--border-dark)] pb-2">
              BIDS (BUY)
            </div>
            {bids.length === 0 ? (
              <div className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest">NO OPEN BIDS</div>
            ) : bids.map((b, i) => (
              <div key={i} className="flex justify-between text-[11px] font-mono mb-2 p-1 hover:bg-[#0A0A0A] transition-colors">
                <span className="text-[var(--success)] font-bold">{b.price.toLocaleString()} PTS</span>
                <span className="text-[var(--text-secondary)]">{b.shares} sh</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-red-500 mb-4 font-bold border-b border-[var(--border-dark)] pb-2">
              ASKS (SELL)
            </div>
            {asks.length === 0 ? (
              <div className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest">NO OPEN ASKS</div>
            ) : asks.map((a, i) => (
              <div key={i} className="flex justify-between text-[11px] font-mono mb-2 p-1 hover:bg-[#0A0A0A] transition-colors">
                <span className="text-red-500 font-bold">{a.price.toLocaleString()} PTS</span>
                <span className="text-[var(--text-secondary)]">{a.shares} sh</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* My Limit Orders */}
      {myOrders.length > 0 && (
        <div className="bg-[#050505] border border-[var(--border-dark)] p-8">
          <h3 className="text-[11px] font-bold font-mono uppercase tracking-widest text-white mb-6 border-b border-[var(--border-dark)] pb-4">
            MY LIMIT ORDERS
          </h3>
          <div className="flex flex-col gap-3">
            {myOrders.map((o, i) => (
              <div key={i} className="flex justify-between items-center bg-[#0A0A0A] p-4 border border-[var(--border-dark)]">
                <div className="flex items-center gap-4">
                  <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${o.trade_type === 'buy' ? 'text-[var(--success)]' : 'text-red-500'}`}>
                    [{o.trade_type}]
                  </span>
                  <span className="font-mono text-[11px] text-white">
                    {o.shares} sh @ <span className="text-[var(--rolex-gold)]">{o.price.toLocaleString()} PTS</span>
                  </span>
                </div>
                <button
                  className="px-3 py-1.5 border border-red-500/30 text-red-500 text-[9px] font-mono uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors"
                  onClick={() => onCancelOrder(o.id)}
                >
                  CANCEL
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

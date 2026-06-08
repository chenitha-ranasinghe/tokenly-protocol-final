'use client';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useStore } from '@/lib/store';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/client';
import { motion, AnimatePresence } from 'framer-motion';
import { CA_STAGGER, CA_ITEM } from '@/lib/animations';
import type { UserShare, Transaction } from '@/lib/types';

interface PortfolioRiskAnalysis {
  risk_score: number;
  diversification_score: number;
  concentration_risk: string;
  advisor_notes: string;
  rebalancing_actions: Array<{ asset_class: string; reason: string; action: string }>;
}

export default function PortfolioPage() {
  const router = useRouter();
  const user = useStore(s => s.user);
  
  const [data, setData] = useState<{shares: UserShare[], transactions: Transaction[]}>({ shares: [], transactions: [] });
  const [loading, setLoading] = useState(true);
  
  const [giftAsset, setGiftAsset] = useState<UserShare | null>(null);
  const [giftEmail, setGiftEmail] = useState('');
  const [giftShares, setGiftShares] = useState(1);
  const [giftMsg, setGiftMsg] = useState({text:'', type:''});
  const [giftLoading, setGiftLoading] = useState(false);
  const [riskAnalysis, setRiskAnalysis] = useState<PortfolioRiskAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleGift = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!giftAsset) return;
      setGiftLoading(true); setGiftMsg({text: '', type: ''});
      try {
          const res = await authFetch('/api/portfolio/gift', {
              method: 'POST',
              body: JSON.stringify({ productId: giftAsset.product_id, recipientEmail: giftEmail, shares: giftShares })
          });
          const d = await res.json();
          if (!res.ok) throw new Error(d.error);
          setGiftMsg({text: d.message, type: 'success'});
          setTimeout(() => { setGiftAsset(null); loadData(); }, 1500);
      } catch {
          setGiftMsg({text: 'Gift transfer failed. Please try again.', type: 'danger'});
      } finally {
          setGiftLoading(false);
      }
  };

  const loadData = useCallback(async () => {
    try {
      const hRes = await authFetch('/api/portfolio');
      const hData = await hRes.json();
      setData({ shares: hData.shares || [], transactions: hData.transactions || [] });
    } catch { console.error("Failed to load portfolio"); } finally { setLoading(false); }
  }, []);

  const runRiskAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await authFetch('/api/ai/portfolio-risk', { method: 'POST' });
      const d = await res.json();
      if (d.success) setRiskAnalysis(d.analysis as PortfolioRiskAnalysis);
    } catch { } finally { setAnalyzing(false); }
  };

  useEffect(() => { if (user === null) { router.push('/'); return; } loadData(); }, [user, router, loadData]);

  if (loading) return <div className="page-wrapper"><div className="container"><div className="loading-spinner" style={{ borderTopColor: 'var(--emerald-accent)', boxShadow: 'var(--emerald-glow)' }} /></div></div>;

  const liquidPoints = user?.points || 0;
  let totalAssetValue = 0, totalUnrealizedPnL = 0, totalInvested = 0;

  data.shares.forEach((s: UserShare) => {
    const currentPrice = s.consensus_price || s.retail_price || s.avg_buy_price || 0;
    const value = s.shares * currentPrice;
    const spent = s.shares * s.avg_buy_price;
    totalAssetValue += value;
    totalUnrealizedPnL += value - spent;
    totalInvested += spent;
  });

  const netWorth = liquidPoints + totalAssetValue;
  const roiPct = totalInvested > 0 ? ((totalUnrealizedPnL / totalInvested) * 100).toFixed(1) : '0.0';
  const isPositiveROI = parseFloat(roiPct) >= 0;

  return (
    <>
      <div className="min-h-screen bg-[var(--bg-primary)] text-white font-sans">
        <main className="max-w-7xl mx-auto pt-12 pb-12 px-4 sm:px-8">
      
      <motion.div variants={CA_STAGGER} initial="hidden" animate="show">
        {/* ===== HERO HEADERS ===== */}
        <motion.div variants={CA_ITEM} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-[var(--border-dark)] pb-6 mb-8">
          <div>
            <p className="text-[9px] font-mono tracking-[0.25em] text-[var(--rolex-gold)] mb-2 uppercase flex items-center gap-2 font-bold">
                <span className="w-1.5 h-1.5 bg-[var(--rolex-gold)] rounded-full animate-pulse"></span>
                FINANCIAL IDENTITY
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tighter text-white mb-2 uppercase leading-none">Portfolio Manager</h1>
            <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-secondary)] font-semibold">Track your verified holdings, unrealized gains, and protocol standing.</p>
          </div>
          <button 
            onClick={runRiskAnalysis} 
            disabled={analyzing}
            className="px-6 py-3 bg-[var(--rolex-gold)]/10 border border-[var(--rolex-gold)] text-[var(--rolex-gold)] text-[9px] font-mono font-bold tracking-widest uppercase hover:bg-[var(--rolex-gold)]/20 transition-all flex items-center gap-3"
          >
            {analyzing ? 'Processing Analysis...' : 'Generate AI Risk Report'}
            <span className="w-1.5 h-1.5 bg-[var(--rolex-gold)] rounded-full animate-pulse"></span>
          </button>
        </motion.div>

        {/* ===== NET WORTH TERMINAL ===== */}
        <motion.div variants={CA_ITEM} className="bg-[#050505] border border-[var(--border-dark)] border-t-[3px] border-t-[var(--rolex-gold)] p-6 md:p-10 mb-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--rolex-gold)]/5 blur-[80px] rounded-full pointer-events-none transition-opacity duration-1000 group-hover:opacity-100 opacity-50"></div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
            
            <div className="lg:border-r border-[var(--border-dark)] lg:pr-6">
              <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-3 font-bold">Gross Net Worth</div>
              <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }} className="text-3xl lg:text-4xl font-mono font-bold tracking-tighter text-[var(--rolex-gold)]">{netWorth.toLocaleString()}</motion.div>
              <div className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] mt-1 font-bold">Protocol Points</div>
            </div>
            
            <div className="lg:border-r border-[var(--border-dark)] lg:pr-6">
              <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-3 font-bold">Liquid Points</div>
              <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }} className="text-2xl lg:text-3xl font-mono font-bold tracking-tighter text-white">{liquidPoints.toLocaleString()}</motion.div>
              <div className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] mt-1 font-bold">Available Treasury</div>
            </div>
            
            <div className="lg:border-r border-[var(--border-dark)] lg:pr-6">
              <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-3 font-bold">Unrealized Gain/Loss</div>
              <div className={`text-2xl lg:text-3xl font-mono font-bold tracking-tighter ${isPositiveROI ? 'text-[var(--success)]' : 'text-red-500'}`}>
                {isPositiveROI ? '+' : ''}{totalUnrealizedPnL.toLocaleString()}
              </div>
              <div className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] mt-1 font-bold">Market Fluctuation</div>
            </div>
            
            <div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-3 font-bold">Return on Investment</div>
              <div className={`text-2xl lg:text-3xl font-mono font-bold tracking-tighter ${isPositiveROI ? 'text-[var(--success)]' : 'text-red-500'}`}>
                {isPositiveROI ? '+' : ''}{roiPct}%
              </div>
              <div className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] mt-1 font-bold">Yield Metric</div>
            </div>
          </div>
        </motion.div>

        {/* ===== ASSET HOLDINGS ===== */}
        <motion.div variants={CA_ITEM} className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold tracking-tight text-[var(--rolex-gold)] uppercase">VERIFIED VAULT HOLDINGS</h2>
          <div className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-secondary)] border border-[var(--border-dark)] bg-[#0A0A0A] px-3 py-1.5 font-bold">{data.shares.length} ASSETS LOGGED</div>
        </motion.div>

        <motion.div variants={CA_ITEM} className="bg-[#050505] border border-[var(--border-dark)] mb-12">
          {data.shares.length === 0 ? (
            <div className="p-16 text-center bg-[#0A0A0A]">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-6">Zero allocations detected</div>
              <button className="px-6 py-3 text-[9px] font-mono uppercase tracking-widest bg-white text-black font-bold hover:bg-gray-200 transition-colors" onClick={() => router.push('/vault')}>ACCESS MARKET VAULT →</button>
            </div>
          ) : (
            <div className="overflow-x-auto p-4">
              <table className="w-full text-left text-[11px] font-mono border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-dark)] text-[9px] text-[var(--text-muted)] uppercase tracking-widest">
                    <th className="py-4 px-4 font-normal">Commodity</th>
                    <th className="py-4 px-4 font-normal">Volume Log</th>
                    <th className="py-4 px-4 font-normal hidden sm:table-cell">Acquisition</th>
                    <th className="py-4 px-4 font-normal">Current Value</th>
                    <th className="py-4 px-4 font-normal hidden sm:table-cell">Treasury Total</th>
                    <th className="py-4 px-4 font-normal">PnL Index</th>
                    <th className="py-4 px-4 font-normal hidden sm:table-cell text-right">Authority</th>
                  </tr>
                </thead>
                <motion.tbody variants={CA_STAGGER} initial="hidden" animate="show">
                <AnimatePresence>
                  <AnimatePresenceStaggered shares={data.shares} setGiftAsset={setGiftAsset} setGiftShares={setGiftShares} setGiftEmail={setGiftEmail} router={router} setGiftMsg={setGiftMsg} />
                </AnimatePresence>
              </motion.tbody>
            </table></div>
          )}
        </motion.div>

        {/* ===== BLOCKCHAIN-STYLE TRANSACTIONS ===== */}
        <motion.div variants={CA_ITEM} className="mb-4">
          <h2 className="text-lg font-bold tracking-tight text-white uppercase">SYSTEM LEDGER</h2>
        </motion.div>
        
        <motion.div variants={CA_ITEM} className="bg-[#050505] border border-[var(--border-dark)] mb-12">
          {data.transactions.length === 0 ? (
            <div className="p-16 text-center text-[var(--text-muted)] text-[10px] font-mono uppercase tracking-widest bg-[#0A0A0A]">
                [ NO SETTLEMENTS FOUND IN LEDGER ]
            </div>
          ) : (
            <div className="overflow-x-auto p-4">
              <table className="w-full text-left text-[11px] font-mono border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-dark)] text-[9px] text-[var(--text-muted)] uppercase tracking-widest">
                    <th className="py-4 px-4 font-normal">Timestamp (UTC)</th>
                    <th className="py-4 px-4 font-normal">Operation Type</th>
                    <th className="py-4 px-4 font-normal hidden sm:table-cell">Description</th>
                    <th className="py-4 px-4 font-normal text-right">Value Transfer</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((t, i) => (
                    <motion.tr 
                      key={t.id} 
                      whileHover={{ backgroundColor: '#0A0A0A' }} 
                      className="border-b border-[var(--border-dark)] transition-colors">
                      <td className="py-4 px-4 text-[var(--text-muted)]">{new Date(t.created_at).toLocaleString()}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 text-[9px] font-bold tracking-widest uppercase border ${t.amount >= 0 ? 'bg-[var(--success)]/5 border-[var(--success)]/20 text-[var(--success)]' : 'bg-red-500/5 border-red-500/20 text-red-500'}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-[var(--text-secondary)] hidden sm:table-cell">{t.description}</td>
                      <td className={`py-4 px-4 text-right font-bold ${(t.amount ?? 0) >= 0 ? 'text-[var(--success)]' : 'text-red-500'}`}>
                        {(t.amount ?? 0) > 0 ? '+' : ''}{(t.amount ?? 0).toLocaleString()}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </motion.div>
    </main></div>
    
    {/* ===== MODAL ===== */}
    <AnimatePresence>
    {giftAsset && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => !giftLoading && setGiftAsset(null)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-[#050505] border border-[var(--border-dark)] border-t-4 border-t-[var(--rolex-gold)] p-8 w-full max-w-md relative" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 border border-[var(--rolex-gold)]/30 bg-[var(--rolex-gold)]/10 flex items-center justify-center text-[var(--rolex-gold)]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white m-0">INITIATE TRANSFER</h2>
                    <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] mt-1">Peer-to-Peer Settlement</div>
                  </div>
                </div>
                
                <div className="mb-8 text-[11px] font-mono text-[var(--text-secondary)] leading-relaxed uppercase tracking-widest">
                    Authorize transfer of <strong className="text-white">{giftAsset.brand}</strong> allocations to a verified peer node. This irreversible action will settle on the central ledger and bypass OTC fees.
                </div>
                
                <form onSubmit={handleGift} className="flex flex-col gap-6">
                    <div>
                        <label className="block text-[9px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-2">Target Node Identity</label>
                        <input type="email" required className="w-full bg-[#0A0A0A] border border-[var(--border-dark)] p-3 text-white font-mono text-sm focus:outline-none focus:border-[var(--rolex-gold)] transition-colors" placeholder="node@protocol.com" value={giftEmail} onChange={e => setGiftEmail(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-[9px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-2">Allocation Size</label>
                        <input type="number" required min="1" max={giftAsset.shares} step="1" className="w-full bg-[#0A0A0A] border border-[var(--border-dark)] p-3 text-white font-mono text-sm focus:outline-none focus:border-[var(--rolex-gold)] transition-colors" value={giftShares} onChange={e => setGiftShares(parseInt(e.target.value))} />
                        <div className="text-[9px] font-mono text-[var(--rolex-gold)] mt-2 uppercase tracking-widest">Max Authorization: {giftAsset.shares} Units</div>
                    </div>
                    
                    {giftMsg.text && (
                      <div className={`p-4 border-l-2 text-[9px] font-mono uppercase tracking-widest ${giftMsg.type === 'danger' ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-[var(--success)]/10 border-[var(--success)] text-[var(--success)]'}`}>
                        [{giftMsg.type}]: {giftMsg.text}
                      </div>
                    )}
                    
                    <div className="flex gap-4 mt-4">
                        <button type="button" className="flex-1 py-3 text-[9px] font-mono uppercase tracking-widest border border-[var(--border-dark)] bg-[#0A0A0A] text-white hover:bg-white/5 transition-colors" onClick={() => setGiftAsset(null)} disabled={giftLoading}>ABORT</button>
                        <button type="submit" className="flex-1 py-3 text-[9px] font-mono uppercase tracking-widest bg-white text-black font-bold hover:bg-gray-200 transition-colors" disabled={giftLoading}>{giftLoading ? 'SYNCING...' : 'EXECUTE TRANSFER'}</button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    )}
    </AnimatePresence>

    <AnimatePresence>
    {riskAnalysis && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4" onClick={() => setRiskAnalysis(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-[#050505] border border-[var(--rolex-gold)] p-10 w-full max-w-2xl relative max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="text-[10px] font-mono text-[var(--rolex-gold)] uppercase tracking-[0.4em] mb-4">Llama-3.3 70B // Portfolio Risk Vector</div>
                <h2 className="text-3xl font-bold mb-8 uppercase">Intelligence Report</h2>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-white/5 p-6">
                    <div className="text-[9px] font-mono text-[var(--text-muted)] uppercase mb-1">Risk Score</div>
                    <div className="text-3xl font-bold text-[var(--rolex-gold)]">{riskAnalysis.risk_score}/100</div>
                  </div>
                  <div className="bg-white/5 p-6">
                    <div className="text-[9px] font-mono text-[var(--text-muted)] uppercase mb-1">Diversification</div>
                    <div className="text-3xl font-bold text-white">{riskAnalysis.diversification_score}%</div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-mono text-[var(--rolex-gold)] uppercase mb-2">Concentration Analysis</h4>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">{riskAnalysis.concentration_risk}</p>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-mono text-[var(--rolex-gold)] uppercase mb-2">Institutional Advice</h4>
                    <p className="text-sm text-white italic leading-relaxed">
                      <span className="not-italic">&ldquo;</span>
                      {riskAnalysis.advisor_notes}
                      <span className="not-italic">&rdquo;</span>
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="text-[10px] font-mono text-[var(--rolex-gold)] uppercase mb-4">Recommended Rebalancing</h4>
                    <div className="space-y-3">
                      {riskAnalysis.rebalancing_actions.map((act, i) => (
                        <div key={i} className="p-4 border border-white/10 bg-white/5 flex justify-between items-center">
                          <div>
                            <span className="text-[10px] font-bold uppercase">{act.asset_class}</span>
                            <p className="text-[9px] text-[var(--text-muted)] mt-1">{act.reason}</p>
                          </div>
                          <span className={`px-2 py-1 text-[8px] font-bold border ${act.action === 'BUY' ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'}`}>
                            {act.action}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button className="mt-10 w-full py-4 bg-white text-black font-bold text-[10px] uppercase tracking-widest" onClick={() => setRiskAnalysis(null)}>DISMISS REPORT</button>
            </motion.div>
        </motion.div>
    )}
    </AnimatePresence>
    </>
  );
}

// Extracted for clean framer motion mapping
interface Props {
  shares: UserShare[];
  setGiftAsset: (s: UserShare | null) => void;
  setGiftShares: (n: number) => void;
  setGiftEmail: (s: string) => void;
  router: ReturnType<typeof import('next/navigation').useRouter>;
  setGiftMsg: (msg: { text: string; type: string }) => void;
}

const AnimatePresenceStaggered = ({ shares, setGiftAsset, setGiftShares, setGiftEmail, router, setGiftMsg }: Props) => {
  return (
    <>
      {shares.map((s: UserShare, i: number) => {
        const currentPrice = s.consensus_price || s.retail_price || 0;
        const value = s.shares * currentPrice;
        const pnl = value - (s.shares * s.avg_buy_price);
        return (
          <motion.tr variants={CA_ITEM} whileHover={{ backgroundColor: '#0A0A0A' }} key={i} className="border-b border-[var(--border-dark)] transition-colors">
            <td className="py-4 px-4">
              <div className="flex items-center gap-3">
                {s.image_url ? (
                  <div className="w-10 h-10 border border-[var(--border-dark)] overflow-hidden shrink-0">
                    <img src={s.image_url} alt={s.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-[#0A0A0A] border border-[var(--border-dark)] flex items-center justify-center shrink-0">
                    <span className="text-[8px] text-[var(--text-muted)]">?</span>
                  </div>
                )}
                <div>
                  <div className="font-bold text-[11px] tracking-widest text-[var(--rolex-gold)] uppercase">{s.brand || 'UNKNOWN'}</div>
                  <div className="text-[9px] text-[var(--text-secondary)] uppercase">{s.name || 'ASSET'}</div>
                </div>
              </div>
            </td>
            <td className="py-4 px-4">{(s.shares ?? 0).toLocaleString()}</td>
            <td className="py-4 px-4 hidden sm:table-cell">${(s.avg_buy_price ?? 0).toFixed(1)}</td>
            <td className="py-4 px-4">${(currentPrice ?? 0).toFixed(1)}</td>
            <td className="py-4 px-4 hidden sm:table-cell text-[var(--rolex-gold)]">{(value ?? 0).toLocaleString()}</td>
            <td className={`py-4 px-4 font-bold ${(pnl ?? 0) >= 0 ? 'text-[var(--success)]' : 'text-red-500'}`}>{(pnl ?? 0) > 0 ? '+' : ''}{(pnl ?? 0).toLocaleString()}</td>
            <td className="py-4 px-4 hidden sm:table-cell">
              <div className="flex gap-2 justify-end">
                <button className="px-3 py-1 border border-white/10 bg-white/5 text-[9px] uppercase tracking-widest hover:bg-white/10" onClick={() => router.push(`/vault/${s.product_id}`)}>TRADE</button>
                <button className="px-3 py-1 border border-[var(--border-dark)] bg-[#050505] text-[9px] uppercase tracking-widest hover:bg-white/5" onClick={() => { setGiftAsset(s); setGiftShares(1); setGiftEmail(''); setGiftMsg({text:'', type:''}); }}>GIFT</button>
                {s.shares >= (s.total_tokens || 1000) && (
                  <button className="px-3 py-1 border border-[var(--success)] bg-[var(--success)] text-black font-bold text-[9px] uppercase tracking-widest" onClick={() => router.push(`/portfolio/redeem/${s.product_id}`)}>REDEEM</button>
                )}
              </div>
            </td>
          </motion.tr>
        );
      })}
    </>
  );
};

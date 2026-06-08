'use client';
import { WisdomPriceCard } from '@/components/vault/WisdomPriceCard';
import { AlertModal } from '@/components/vault/AlertModal';
import { OrderBook } from '@/components/vault/OrderBook';
import { BinanceChart } from '@/components/vault/BinanceChart';
import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch, setAuthUser } from '@/lib/client';
import { useStore } from '@/lib/store';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, Box } from 'lucide-react';
import type { Order, UserShare } from '@/lib/types';

interface Product {
  id: string; name: string; brand: string; sku: string;
  retail_price: number; market_price_low: number; market_price_high: number;
  consensus_price: number | null; total_tokens: number;
  verification_status?: string;
  cert_id?: string;
  confidence_score?: number;
  vault_location?: string;
  insurance_policy?: string;
  image_url?: string;
}
interface Share { shares: number, avg_buy_price: number }

interface Authenticator { id: string; grade: number; rrs: number; }
interface VerificationMeta { verification_hash: string; authenticator_count: number; authenticators: Authenticator[]; }
interface Prediction { sentiment: string; confidenceScore: number; prediction: Array<{ time: string; price: number }>; }
interface OrderEntry { id: string; trade_type: 'buy'|'sell'; price: number; shares: number; user_id?: string; }

export default function VaultTradePage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const router = useRouter();
  const user = useStore(s => s.user);
  const hydrated = useStore(s => s.hydrated);
  
  const [product, setProduct] = useState<Product | null>(null);
  const [holdings, setHoldings] = useState<Share | null>(null);
  const [priceHistory, setPriceHistory] = useState<{time: string; price: number}[]>([]);
  const [orderbook, setOrderbook] = useState<OrderEntry[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [metadata, setMetadata] = useState<VerificationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [tradeType, setTradeType] = useState<'buy'|'sell'>('buy');
  const [orderType, setOrderType] = useState<'market'|'limit'>('market');
  const [sharesInput, setSharesInput] = useState<number>(1);
  const [limitPrice, setLimitPrice] = useState<number>(0);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  interface CandleRow { time: string | number; open: number; high: number; low: number; close: number; volume?: number }
  const [candles, setCandles] = useState<CandleRow[]>([]);
  const [alertModal, setAlertModal] = useState(false);
  const [alertTarget, setAlertTarget] = useState<number>(0);
  const [alertDir, setAlertDir] = useState<'above' | 'below'>('above');
  interface Alert { id: string; product_id: string; target_price: number; direction: 'above'|'below'; status: string; }
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);

  const loadData = useCallback(async () => {
    try {
      const pRes = await authFetch(`/api/products/${unwrappedParams.id}`);
      const pData = await pRes.json();
      setProduct(pData.product);
      setMetadata(pData.verification_metadata);
      interface PricePoint { timestamp?: string; created_at?: string; price: number }
      const formattedHistory = ((pData.price_history || []) as PricePoint[]).map((h: PricePoint) => ({
        time: new Date(h.created_at ?? h.timestamp ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        price: h.price
      }));
      setPriceHistory(formattedHistory);
      const rawCandles = (pData.candles || []) as Array<{ time?: number | string; open: number; high: number; low: number; close: number; volume?: number }>;
      setCandles(
        rawCandles.map((c, i) => ({
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          time: c.time ?? Math.floor(Date.now() / 1000) - (rawCandles.length - i),
        }))
      );
      setOrderbook(pData.orders || []);
      if (orderType === 'market' && limitPrice === 0) {
        setLimitPrice(pData.product?.consensus_price || pData.product?.retail_price || 0);
      }
      setAlertTarget(pData.product?.consensus_price || pData.product?.retail_price || 0);
      
      const alertRes = await authFetch('/api/alerts');
      const alertData = await alertRes.json();
      if (alertData.success) {
        setActiveAlerts((alertData.alerts as Alert[]).filter(a => a.product_id === unwrappedParams.id));
      }

      const hRes = await authFetch('/api/portfolio');
      const hData = await hRes.json();
      const myShares = hData.shares?.find((s: UserShare) => s.product_id === unwrappedParams.id);
      setHoldings(myShares || null);
      if (!prediction) {
        authFetch('/api/ai-predict', { method: 'POST', body: JSON.stringify({ productId: unwrappedParams.id }) })
          .then(r => r.json()).then(d => { if(d.success) setPrediction(d.forecast) }).catch(()=>{});
      }
    } catch {
      setMsg({ text: 'Failed to load asset data.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [unwrappedParams.id]);

  useEffect(() => { if (user === null) { router.push('/'); return; } loadData(); }, [user, router, loadData]);
  useEffect(() => {
    const int = setInterval(() => { if (user) loadData(); }, 5000);
    return () => clearInterval(int);
  }, [user, loadData]);

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="container">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="page-wrapper">
        <div className="container">
          <div className="empty-state glass-card" style={{ padding: 48 }}>
            <div className="empty-state-icon">❌</div>
            <div className="empty-state-title">Asset not found</div>
          </div>
        </div>
      </div>
    );
  }

  const currentPrice = product.consensus_price || product.retail_price;
  
  // Status definitions for the Perfect Badge
  const getStatusInfo = () => {
    if (product.verification_status === 'certified') return { color: 'var(--success)', label: 'Certified Protocols', sub: 'Multi-Node consensus reached', icon: '✅' };
    if (product.verification_status === 'rejected') return { color: 'var(--danger)', label: 'Protocol Flagged', sub: 'Asset rejected by network', icon: '⚠️' };
    return { color: 'var(--warning)', label: 'Consensus in Progress', sub: 'Nodes are currently verifying', icon: '⏳' };
  };
  const sInfo = getStatusInfo();
  
  let feeRate = 0.03, tierName = 'Standard';
  const rrs = user?.rrs_score || 50;
  if (rrs >= 80) { feeRate = 0; tierName = 'Elite'; }
  else if (rrs >= 60) { feeRate = 0.005; tierName = 'Expert'; }
  else if (rrs >= 40) { feeRate = 0.01; tierName = 'Trusted'; }
  else if (rrs >= 20) { feeRate = 0.02; tierName = 'Reviewer'; }

  // Apply CAN Fee Reductions (CLIENT SIDE SIMULATION FOR UI PREVIEW)
  const canTier = (user?.points || 0) >= 100000 ? 'Gemologist' : (user?.points || 0) >= 50000 ? 'Authenticator' : (user?.points || 0) >= 25000 ? 'Inspector' : 'Standard';
  const canDiscount = canTier === 'Gemologist' ? 0.8 : canTier === 'Authenticator' ? 0.5 : canTier === 'Inspector' ? 0.2 : 0;
  feeRate = Math.max(0, feeRate * (1 - canDiscount));

  const executionPrice = orderType === 'limit' ? limitPrice : currentPrice;
  const baseAmount = sharesInput * executionPrice;
  const feeAmount = Math.round(baseAmount * feeRate);
  const totalCost = tradeType === 'buy' ? baseAmount + feeAmount : baseAmount - feeAmount;

  const handleTrade = async () => {
    if (orderType === 'limit' && limitPrice <= 0) { setMsg({ text: 'Enter a valid limit price', type: 'warning' }); return; }
    setTradeLoading(true); setMsg({ text: '', type: '' });
    try {
      const res = await authFetch('/api/trade', { method: 'POST', body: JSON.stringify({ productId: product.id, type: tradeType, shares: sharesInput, isLimit: orderType === 'limit', targetPrice: limitPrice }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Trade failed');
      setMsg({ text: data.message, type: 'success' });
      if (data.user) setAuthUser(data.user);
      loadData();
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Trade failed', type: 'danger' });
    } finally { setTradeLoading(false); }
  };

  const handleRedeem = async () => {
    setTradeLoading(true); setMsg({ text: '', type: '' });
    try {
      const res = await authFetch('/api/redeem', { method: 'POST', body: JSON.stringify({ productId: product.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Redemption failed');
      setMsg({ text: data.message, type: 'success' }); loadData();
    } catch { setMsg({ text: 'Trade execution failed. Please try again.', type: 'danger' }); } finally { setTradeLoading(false); }
  };

  const handleCancelOrder = async (orderId: string) => {
    setMsg({ text: '', type: '' });
    try {
      const res = await authFetch('/api/trade/cancel', { method: 'POST', body: JSON.stringify({ orderId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cancel failed');
      setMsg({ text: data.message, type: 'success' }); loadData();
    } catch { setMsg({ text: 'Operation failed. Please try again.', type: 'danger' }); }
  };

  const handleSetAlert = async () => {
    try {
      const res = await authFetch('/api/alerts', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id, targetPrice: alertTarget, direction: alertDir })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ text: data.message, type: 'success' });
      setAlertModal(false);
      loadData();
    } catch (e: unknown) { setMsg({ text: e instanceof Error ? e.message : 'Operation failed.', type: 'danger' }); }
  };

  interface OrderEntry { id: string; trade_type: 'buy'|'sell'; price: number; shares: number; user_id?: string; }
  const typedOrderbook = orderbook as OrderEntry[];
  const bids = typedOrderbook.filter(o => o.trade_type === 'buy').sort((a, b) => b.price - a.price);
  const asks = typedOrderbook.filter(o => o.trade_type === 'sell').sort((a, b) => a.price - b.price);
  const myOrders = typedOrderbook.filter(o => user && o.user_id === user.id);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-white font-sans pt-24 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
      <button className="flex items-center gap-2 px-4 py-2 bg-[#0A0A0A] border border-[var(--border-dark)] text-[10px] font-mono tracking-widest uppercase hover:bg-white/5 transition-colors mb-10" onClick={() => router.back()}>
        <span className="text-[var(--rolex-gold)]">←</span> BACK TO VAULT
      </button>
      
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
        {/* LEFT COLUMN: Asset Info */}
        <div className="flex flex-col gap-8">
          <div className="bg-[#050505] border border-[var(--border-dark)] p-8 md:p-12">
            <motion.div 
              initial={{ x: -20, opacity: 0 }} 
              animate={{ x: 0, opacity: 1 }} 
              transition={{ delay: 0.2 }}
              className="flex items-center gap-3 mb-4">
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-[var(--rolex-gold)] shadow-[0_0_10px_var(--rolex-gold)]" />
              <div className="text-[10px] font-bold text-[var(--rolex-gold)] uppercase tracking-widest">{product.brand}</div>
            </motion.div>
            
            <h1 className="text-4xl font-bold tracking-tighter text-white mb-4 leading-tight uppercase">{product.name}</h1>
            
            {/* Visual Asset Preview */}
            <div className="mb-10 aspect-video bg-[#0A0A0A] border border-[var(--border-dark)] overflow-hidden relative group">
              {product.image_url ? (
                <img 
                  src={product.image_url} 
                  alt={product.name} 
                  className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] opacity-20">
                  <Box size={80} strokeWidth={1} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-6 left-6 flex gap-4">
                <div className="px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-mono tracking-widest uppercase text-white font-bold">
                  8K_STUDIO_SCAN
                </div>
                <div className="px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-mono tracking-widest uppercase text-white font-bold">
                  PBR_MATERIALS
                </div>
              </div>
            </div>

            <div className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest bg-[#0A0A0A] border border-[var(--border-dark)] px-4 py-2 inline-block mb-10">
              SKU: {product.sku} <span className="mx-2 text-[var(--border-heavy)]">|</span> {product.total_tokens} SHARES FLOAT
            </div>
            
            {/* Price Hero */}
            <div className="flex items-baseline gap-4 mb-10 pb-8 border-b border-[var(--border-dark)]">
              <span className="text-5xl font-bold font-mono tracking-tighter text-[var(--success)]">${currentPrice}</span>
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">/ SHARE</span>
            </div>
            
            {/* Wisdom Engine Price Card */}
            <div className="mb-6 flex gap-4">
              <WisdomPriceCard productId={unwrappedParams.id} />
              
              <div className="flex flex-col gap-3 justify-center">
                <button 
                  onClick={() => setAlertModal(true)}
                  className="px-6 py-2 border border-[var(--rolex-gold)]/30 bg-[var(--rolex-gold)]/5 text-[var(--rolex-gold)] text-[9px] font-mono tracking-widest uppercase hover:bg-[var(--rolex-gold)]/10"
                >
                  🔔 {activeAlerts.length > 0 ? 'Modify Alerts' : 'Set Price Alert'}
                </button>
                {holdings && holdings.shares > 0 && (
                  <button 
                    onClick={() => window.open(`/api/certificate?productId=${product.id}`)}
                    className="px-6 py-2 border border-[var(--success)]/30 bg-[var(--success)]/5 text-[var(--success)] text-[9px] font-mono tracking-widest uppercase hover:bg-[var(--success)]/10"
                  >
                    📜 Generate COA
                  </button>
                )}
              </div>
            </div>

            {/* Binance-style Candlestick Chart */}
            <div className="h-[340px] w-full mb-10 bg-[#0A0A0A] border border-[var(--border-dark)] p-6 relative">
              <div className="absolute top-4 left-4 text-[9px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] z-10 flex items-center gap-2">
                <span className="w-2 h-2 bg-[var(--rolex-gold)] rounded-full animate-pulse" />
                LIVE_MARKET_DYNAMICAL_DIAGRAM // ALPHA_VECTOR
              </div>
              {candles.length > 0 ? (
                <BinanceChart data={candles} />
              ) : <div className="h-full flex items-center justify-center text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">[ AWAITING BINANCE_LEVEL_DATA ]</div>}
            </div>

            {/* ADVANCED TRUST BADGE (PERFECT STATE) */}
            <div className="mb-10 p-8 bg-[#050505] border border-[var(--border-dark)] border-l-4 relative overflow-hidden" style={{ borderLeftColor: sInfo.color }}>
              <div className="absolute top-4 right-6 text-4xl opacity-10">{sInfo.icon}</div>
              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: sInfo.color }}>{sInfo.label}</div>
                <div className="text-[11px] font-mono uppercase tracking-widest text-[var(--text-secondary)]">{sInfo.sub}</div>
              </div>

              {metadata && (
                <div className="mt-8 pt-6 border-t border-[var(--border-dark)]">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-2">PROTOCOL AUDIT HASH</div>
                      <div className="text-[10px] font-mono text-[var(--rolex-gold)] break-all max-w-[200px]">{metadata.verification_hash}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-2">NETWORK GRADE</div>
                      <div className="text-[11px] font-mono uppercase tracking-widest font-bold text-white">PHASE {metadata.authenticators?.[0]?.grade ?? 1} SECURITY</div>
                    </div>
                  </div>

                  {/* Perfection: Arbitration Hub Challenge */}
                  <div className="mb-6">
                    <motion.button 
                      whileHover={{ backgroundColor: 'rgba(255,165,0,0.1)' }}
                      onClick={async () => {
                        if (!confirm('STAKE 500 PTS TO CHALLENGE CERTIFICATION?\n\nThis will initiate a multi-node re-audit by Gemologist tier authenticators. If you are correct, you earn a 1,000 PTS bounty. If wrong, your stake is burned.')) return;
                        setTradeLoading(true);
                        try {
                          const res = await authFetch('/api/can/dispute', { method: 'POST', body: JSON.stringify({ productId: product.id }) });
                          const d = await res.json();
                          if (!res.ok) throw new Error(d.error);
                          setMsg({ text: 'DISPUTE LODGED: Re-audit task broadcasted to Gemologist nodes.', type: 'warning' });
                        } catch { setMsg({ text: 'Operation failed. Please try again.', type: 'danger' }); }
                        finally { setTradeLoading(false); }
                      }}
                      className="w-full p-4 border border-[var(--warning)] text-[var(--warning)] bg-transparent text-[9px] font-mono font-bold tracking-widest uppercase transition-colors">
                      [ CHALLENGE CERTIFICATION / STAKE 500 PTS ]
                    </motion.button>
                  </div>

                  <div className="pt-4 border-t border-dashed border-[var(--border-dark)]">
                    <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-3">VOUCHED BY {metadata.authenticator_count} NODE(S)</div>
                    <div className="flex gap-2 flex-wrap">
                      {(metadata.authenticators || []).map((a, i) => (
                        <div key={i} className="px-3 py-1.5 bg-[#0A0A0A] border border-[var(--border-dark)] text-[9px] font-mono uppercase tracking-widest text-[var(--text-secondary)]">
                          NODE_{a.id.slice(0, 4)} (RRS: {a.rrs})
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* AI Forecast */}
            {prediction && (
              <div className="p-8 bg-[#050505] border border-[var(--border-dark)] mb-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-2 h-2 rounded-full bg-[var(--emerald-accent)] shadow-[0_0_10px_var(--emerald-accent)]" />
                  <h4 className="text-[10px] font-bold text-[var(--emerald-accent)] uppercase tracking-widest">AI ORACLE 30-DAY FORECAST</h4>
                </div>
                <div className="flex justify-between mb-6 pb-6 border-b border-[var(--border-dark)] text-[11px] font-mono uppercase tracking-widest">
                  <span>SENTIMENT: <strong className={prediction.sentiment.toLowerCase().includes('bull') ? 'text-[var(--success)]' : 'text-red-500'}>{prediction.sentiment}</strong></span>
                  <span>CONFIDENCE: <strong className="text-white">{prediction.confidenceScore}%</strong></span>
                </div>
                <div className="h-[160px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={prediction.prediction}>
                      <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: '#050505', border: '1px solid var(--border-dark)', fontSize: '10px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }} />
                      <Line type="stepAfter" dataKey="price" stroke="var(--emerald-accent)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2, fill: 'var(--emerald-accent)' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* REAL WORLD CUSTODY (LOGISTICS LAYER) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
               <div className="p-6 bg-[#00a86b]/5 border border-[#00a86b]/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield size={12} color="var(--success)" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--success)]">CUSTODY_VERIFIED</span>
                  </div>
                  <div className="text-[11px] font-mono font-bold text-white uppercase tracking-widest mb-1">{product.vault_location || 'Secure Global Vault'}</div>
                  <div className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest">High-Security Logistics Partner</div>
               </div>
               <div className="p-6 bg-[var(--rolex-gold)]/5 border border-[var(--rolex-gold)]/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock size={12} color="var(--rolex-gold)" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--rolex-gold)]">INSURANCE_ACTIVE</span>
                  </div>
                  <div className="text-[11px] font-mono font-bold text-white uppercase tracking-widest mb-1">{product.insurance_policy || 'Protocol Master Policy'}</div>
                  <div className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest">Lloyd&apos;s of London Coverage</div>
               </div>
            </div>

            {/* Your Holdings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-6 bg-[#0A0A0A] border border-[var(--border-dark)] text-center">
                <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-3">TREASURY BALANCE</div>
                <div className="text-3xl font-bold font-mono text-white tracking-tighter">{user?.points?.toLocaleString()} pts</div>
              </div>
              <div className="p-6 bg-[#0A0A0A] border border-[var(--border-dark)] text-center">
                <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-3">SECURED SHARES</div>
                <div className="text-3xl font-bold font-mono text-[var(--success)] tracking-tighter">{holdings ? holdings.shares : 0}</div>
              </div>
            </div>
          </div>

          {/* Redemption Card */}
          {holdings && holdings.shares >= product.total_tokens && (
            <div className="p-8 bg-[#050505] border border-[var(--border-dark)] border-l-4 border-l-[var(--emerald-accent)] text-center">
              <h3 className="text-[var(--emerald-accent)] mb-3 text-xl font-bold uppercase tracking-tight">100% OWNERSHIP ACQUIRED 🏆</h3>
              <p className="mb-6 text-[11px] font-mono text-[var(--text-secondary)] uppercase tracking-widest leading-relaxed max-w-md mx-auto">
                You own all {product.total_tokens} shares. Burn them to redeem the physical asset via Tokenly Logistics.
              </p>
              <button className="px-6 py-3 bg-[var(--emerald-accent)] text-black font-bold text-[10px] font-mono tracking-widest uppercase hover:bg-[var(--emerald-accent)]/80 transition-colors" onClick={handleRedeem} disabled={tradeLoading}>BURN & REDEEM ASSET →</button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Trade Panel */}
        <div className="flex flex-col gap-8">
          <div className="bg-[#050505] border border-[var(--border-dark)] p-8 border-t-4" style={{ borderTopColor: tradeType === 'buy' ? 'var(--success)' : 'var(--danger)' }}>
            <h2 className="text-xl font-bold mb-8 tracking-tight uppercase text-white">[ EXECUTE TRADE ]</h2>
            
            {/* Order Type Toggle */}
            <div className="flex gap-2 mb-6 p-1 bg-[#0A0A0A] border border-[var(--border-dark)]">
              {(['market', 'limit'] as const).map(type => (
                <button 
                  key={type} 
                  className={`flex-1 py-3 text-[9px] font-mono uppercase tracking-widest font-bold transition-colors ${orderType === type ? 'bg-[#050505] border border-[var(--border-dark)] text-[var(--rolex-gold)]' : 'bg-transparent text-[var(--text-muted)] hover:text-white'}`}
                  onClick={() => setOrderType(type)}>
                  {type} ORDER
                </button>
              ))}
            </div>

            {/* Buy/Sell Toggle */}
            <div className="flex gap-4 mb-8">
              <button 
                className={`flex-1 py-3 text-[10px] font-mono uppercase tracking-widest font-bold transition-all border ${tradeType === 'buy' ? 'bg-[var(--success)] text-black border-[var(--success)]' : 'bg-transparent text-[var(--success)] border-[var(--success)]'}`}
                onClick={() => setTradeType('buy')}>
                BUY LONG
              </button>
              <button 
                className={`flex-1 py-3 text-[10px] font-mono uppercase tracking-widest font-bold transition-all border ${tradeType === 'sell' ? 'bg-[var(--danger)] text-white border-[var(--danger)]' : 'bg-transparent text-[var(--danger)] border-[var(--danger)]'}`}
                onClick={() => setTradeType('sell')}>
                SELL SHORT
              </button>
            </div>

            {/* Inputs */}
            <div className="mb-6">
              <label className="block text-[9px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-3">FRACTIONAL SHARES</label>
              <input type="number" min="1" step="1" className="w-full bg-[#0A0A0A] border border-[var(--border-dark)] p-4 text-2xl font-mono font-bold text-white focus:outline-none focus:border-[var(--rolex-gold)] transition-colors" value={sharesInput} onChange={e => setSharesInput(parseInt(e.target.value) || 0)} />
            </div>

            {orderType === 'limit' && (
              <div className="mb-6">
                <label className="block text-[9px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-3">LIMIT PRICE (USD EQUIVALENT)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-[var(--rolex-gold)] font-mono">$</span>
                  <input type="number" min="1" step="1" className="w-full bg-[#0A0A0A] border border-[var(--border-dark)] p-4 pl-10 text-2xl font-mono font-bold text-[var(--rolex-gold)] focus:outline-none focus:border-[var(--rolex-gold)] transition-colors" value={limitPrice} onChange={e => setLimitPrice(parseInt(e.target.value) || 0)} />
                </div>
              </div>
            )}

            {/* Order Summary */}
            <div className="bg-[#0A0A0A] p-6 border border-[var(--border-dark)] mb-8">
              {[
                { label: `MARKET VALUE ($${executionPrice} × ${sharesInput})`, value: `${baseAmount.toLocaleString()} PTS`, color: 'text-white' },
                { label: `PROTOCOL FEE (${tierName})`, value: `${(baseAmount * (feeRate / (1 - canDiscount))).toLocaleString()} PTS`, color: 'text-[var(--warning)]' },
                { label: `CAN REBATE (${canTier})`, value: `-${(canDiscount * 100).toFixed(0)}% (-${feeAmount.toLocaleString()} PTS)`, color: 'text-[var(--success)]' },
              ].map(row => (
                <div key={row.label} className="flex justify-between mb-3 text-[9px] font-mono uppercase tracking-widest">
                  <span className="text-[var(--text-secondary)]">{row.label}</span>
                  <span className={`font-bold ${row.color}`}>{row.value}</span>
                </div>
              ))}
              <div className="flex justify-between pt-4 mt-4 border-t border-[var(--border-dark)]">
                <span className="text-[10px] font-bold font-mono uppercase tracking-widest">FIRM EXECUTION COST</span>
                <span className={`font-mono text-xl font-bold tracking-tighter ${tradeType === 'buy' ? 'text-red-500' : 'text-[var(--success)]'}`}>{totalCost.toLocaleString()} PTS</span>
              </div>
            </div>

            {/* Status */}
            {msg.text && (
              <div className={`mb-6 p-4 border text-[9px] font-mono uppercase tracking-widest font-bold ${msg.type === 'success' ? 'bg-[var(--success)]/10 border-[var(--success)]/30 text-[var(--success)]' : msg.type === 'danger' ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-[var(--warning)]/10 border-[var(--warning)]/30 text-[var(--warning)]'}`}>
                [ {msg.type} ] {msg.text}
              </div>
            )}
            
            <button 
              className={`w-full py-5 text-[11px] font-mono font-bold tracking-widest uppercase transition-colors text-white ${tradeType === 'buy' ? 'bg-[var(--success)] hover:bg-[var(--success)]/80' : 'bg-[var(--danger)] hover:bg-[var(--danger)]/80'}`}
              onClick={handleTrade} 
              disabled={tradeLoading || sharesInput < 1}>
              {tradeLoading ? '[ PROCESSING FIRM... ]' : `[ SUBMIT ${tradeType} ORDER ]`}
            </button>
          </div>

          {/* Order Book */}
          <OrderBook
            bids={bids as import('@/components/vault/OrderBook').OrderEntry[]}
            asks={asks as import('@/components/vault/OrderBook').OrderEntry[]}
            myOrders={myOrders as import('@/components/vault/OrderBook').OrderEntry[]}
            onCancelOrder={handleCancelOrder}
          />
        </div>
      </div>
    </div>
    
    <AnimatePresence>
      <AlertModal
        show={alertModal}
        onClose={() => setAlertModal(false)}
        alertDir={alertDir}
        setAlertDir={setAlertDir}
        alertTarget={alertTarget}
        setAlertTarget={setAlertTarget}
        onSubmit={handleSetAlert}
        activeAlertCount={activeAlerts.length}
      />
    </AnimatePresence>
    </div>
  );
}

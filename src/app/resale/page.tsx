'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CheckCircle2, Navigation, Activity, TrendingUp, AlertCircle, ShoppingCart, Tag, Share2, Eye } from 'lucide-react';
import { authFetch } from '@/lib/client';
import type { SecondHandListing, SecondHandPriceQuote } from '@/lib/types';

const CATEGORIES = ['Sneakers', 'Electronics', 'Watches', 'Handbags'];

const terminalStagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
} as const;
const terminalItem = {
  hidden: { opacity: 0, scale: 0.95, filter: 'blur(4px)' },
  show: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 200, damping: 20 } }
} as const;

export default function ResalePage() {
  const [listings, setListings] = useState<SecondHandListing[]>([]);
  const [buyerDistrict, setBuyerDistrict] = useState('Colombo');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // Terminal Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [itemDistrict, setItemDistrict] = useState('Colombo');
  const [daysOwned, setDaysOwned] = useState('180');
  const [usage, setUsage] = useState('occasional');
  const [conditionScore, setConditionScore] = useState('75');
  const [estimate, setEstimate] = useState<SecondHandPriceQuote | null>(null);
  const [estimating, setEstimating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/resale/listings?buyer_district=${encodeURIComponent(buyerDistrict)}`);
      const data = await res.json();
      setListings(data.listings ?? []);
    } catch {
      setMsg('Could not load listings.');
    } finally {
      setLoading(false);
    }
  }, [buyerDistrict]);

  useEffect(() => { load(); }, [load]);

  async function runEstimate() {
    setEstimating(true);
    setEstimate(null);
    setMsg('');
    try {
      // Simulate API latency for "Terminal Analysis" effect
      await new Promise(r => setTimeout(r, 1200));
      const res = await fetch('/api/resale/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category, item_district: itemDistrict, buyer_district: buyerDistrict,
          days_owned: Number(daysOwned), usage_frequency: usage, condition_score: Number(conditionScore),
          vision_confidence: 0.85,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? 'Estimate failed'); return; }
      setEstimate(data);
    } finally {
      setEstimating(false);
    }
  }

  async function createListing() {
    const res = await authFetch('/api/resale/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, category, item_district: itemDistrict, days_owned: Number(daysOwned),
        usage_frequency: usage, condition_score: Number(conditionScore),
        vision_confidence: 0.85, usability_pct: 70,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error ?? 'Listing failed — Please sign in.'); return; }
    setMsg(`Asset listed successfully at LKR ${data.listing.recommended?.toLocaleString()} (${data.listing.condition_grade})`);
    setTitle(''); setEstimate(null);
    load();
  }

  // Calculating logistics offset for UI feedback
  const diff = estimate?.logistics_adjustment || 0;
  const isPremium = diff > 0;
  const isDiscount = diff < 0;

  return (
    <div className="min-h-screen bg-[#050505] text-white pt-8 pb-24 font-mono">
      {/* Grid Background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-[var(--border-dark)] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2 text-[var(--rolex-gold)]">
              <Activity size={18} className="animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold">Resale Engine V2</span>
            </div>
            <h1 className="text-3xl font-light tracking-tight mb-2">Secondary Market Terminal</h1>
            <p className="text-xs text-[var(--text-secondary)] max-w-xl">
              Algorithmic pricing based on AI condition grading and live logistics topology. 
              Grades adapt dynamically when the system detects uncertainty.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Local Node (Buyer Location)</p>
              <select
                value={buyerDistrict} onChange={e => setBuyerDistrict(e.target.value)}
                className="bg-transparent text-[var(--rolex-gold)] text-sm outline-none border-b border-[var(--rolex-gold)]/30 pb-1 font-mono tracking-widest uppercase cursor-pointer"
              >
                {['Colombo', 'Gampaha', 'Kandy', 'Galle', 'Jaffna'].map(d => (
                  <option key={d} value={d} className="bg-black text-white">{d}</option>
                ))}
              </select>
            </div>
            <Link href="/resale/lobby" className="flex items-center gap-2 px-5 py-3 border border-[var(--rolex-gold)] text-[var(--rolex-gold)] text-[10px] uppercase tracking-widest hover:bg-[var(--rolex-gold)] hover:text-black transition-all">
              <Eye size={14} /> Initialize VR Lobby
            </Link>
          </div>
        </div>

        {/* System Message */}
        <AnimatePresence>
          {msg && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-8">
              <div className="p-4 border border-[var(--rolex-gold)]/30 bg-[var(--rolex-gold)]/5 flex items-center gap-3 text-[11px] text-[var(--rolex-gold)]">
                <CheckCircle2 size={16} /> {msg}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid lg:grid-cols-[450px_1fr] gap-8">
          
          {/* AI Pricing Terminal */}
          <motion.div variants={terminalStagger} initial="hidden" animate="show" className="space-y-4">
            <motion.div variants={terminalItem} className="border border-[var(--border-dark)] bg-black p-1 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-20"><TrendingUp size={64} /></div>
              
              <div className="border border-[var(--border-dark)] p-5 relative z-10 bg-black/80 backdrop-blur">
                <div className="flex items-center justify-between mb-6 border-b border-[var(--border-dark)] pb-4">
                  <h2 className="text-[11px] uppercase tracking-widest text-[var(--rolex-gold)]">Valuation Terminal</h2>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="group">
                    <label className="block text-[8px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Asset Nomenclature</label>
                    <input
                      value={title} onChange={e => setTitle(e.target.value)}
                      className="w-full bg-transparent border-b border-[var(--border-dark)] focus:border-[var(--rolex-gold)] text-white text-sm py-2 transition-colors outline-none placeholder:text-[#333]"
                      placeholder="e.g. Jordan 1 Retro High"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[8px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Asset Class</label>
                      <select
                        value={category} onChange={e => setCategory(e.target.value)}
                        className="w-full bg-transparent border-b border-[var(--border-dark)] focus:border-[var(--rolex-gold)] text-[var(--rolex-gold)] text-xs py-2 transition-colors outline-none"
                      >
                        {CATEGORIES.map(c => <option key={c} value={c} className="bg-black text-white">{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[8px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Source Node</label>
                      <input
                        value={itemDistrict} onChange={e => setItemDistrict(e.target.value)}
                        className="w-full bg-transparent border-b border-[var(--border-dark)] focus:border-[var(--rolex-gold)] text-white text-xs py-2 transition-colors outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[8px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Condition</label>
                      <input
                        value={conditionScore} onChange={e => setConditionScore(e.target.value)} type="number"
                        className="w-full bg-[#111] border border-[var(--border-dark)] focus:border-[var(--rolex-gold)] text-center text-white text-xs py-2 transition-colors outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Age (Days)</label>
                      <input
                        value={daysOwned} onChange={e => setDaysOwned(e.target.value)} type="number"
                        className="w-full bg-[#111] border border-[var(--border-dark)] focus:border-[var(--rolex-gold)] text-center text-white text-xs py-2 transition-colors outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Usage</label>
                      <select
                        value={usage} onChange={e => setUsage(e.target.value)}
                        className="w-full bg-[#111] border border-[var(--border-dark)] focus:border-[var(--rolex-gold)] text-center text-white text-[10px] py-2 transition-colors outline-none"
                      >
                        <option value="none" className="bg-black">None</option>
                        <option value="occasional" className="bg-black">Light</option>
                        <option value="frequent" className="bg-black">Heavy</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={runEstimate} disabled={estimating}
                    className="w-full py-3 mt-4 border border-[var(--rolex-gold)] text-[var(--rolex-gold)] text-[10px] uppercase tracking-widest hover:bg-[var(--rolex-gold)] hover:text-black transition-all flex items-center justify-center gap-2"
                  >
                    {estimating ? <><Activity size={14} className="animate-spin" /> Analyzing...</> : <><Camera size={14} /> Run AI Valuation</>}
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Estimate Results */}
            <AnimatePresence>
              {estimate && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="border border-[var(--rolex-gold)] bg-black p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--rolex-gold)]/10 rounded-full blur-2xl" />
                  
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Algorithmic Target Price</p>
                      <p className="text-3xl text-[var(--rolex-gold)]">LKR {estimate.recommended.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] mb-1">AI Grade</p>
                      <div className="inline-block px-2 py-1 border border-[var(--rolex-gold)] bg-[var(--rolex-gold)]/10 text-[var(--rolex-gold)] text-xs">
                        {estimate.recommended ? 'AUTHENTICATED' : 'UNCERTAIN'}
                      </div>
                    </div>
                  </div>

                  {/* Logistics Map Data */}
                  <div className="flex items-center justify-between p-3 bg-[#0a0a0a] border border-[var(--border-dark)] mb-4 text-[9px] uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                      <Navigation size={12} className={itemDistrict === buyerDistrict ? 'text-green-500' : 'text-blue-500'} />
                      <span>{itemDistrict} <span className="text-[var(--text-muted)]">→</span> {buyerDistrict}</span>
                    </div>
                    {diff !== 0 && (
                      <span className={isPremium ? 'text-red-400' : 'text-green-400'}>
                        {isPremium ? '+' : ''}LKR {diff.toLocaleString()} {isPremium ? '(Logistics Premium)' : '(Proximity Discount)'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 text-[10px] text-[var(--text-secondary)]">
                    <div>Range: LKR {estimate.floor.toLocaleString()} – {estimate.ceiling.toLocaleString()}</div>
                    <div className="text-right">Model Confidence: {estimate.confidence}%</div>
                  </div>

                  <p className="text-[10px] text-[var(--text-muted)] leading-relaxed mb-6 border-l-2 border-[var(--rolex-gold)] pl-3">
                    {estimate.breakdown}
                  </p>

                  <button onClick={createListing} className="w-full py-3 bg-[var(--rolex-gold)] text-black text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--rolex-gold)]/90 transition-all flex items-center justify-center gap-2">
                    <Share2 size={14} /> Inject into Global Orderbook
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Active Orderbook */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
                <ShoppingCart size={14} /> Live Global Orderbook
              </h2>
              <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-1">
                Prices localized for <span className="text-[var(--rolex-gold)]">{buyerDistrict}</span>
              </div>
            </div>
            
            {loading ? (
              <div className="py-20 text-center border border-[var(--border-dark)] border-dashed text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Scanning decentralized nodes...
              </div>
            ) : listings.length === 0 ? (
              <div className="py-20 text-center border border-[var(--border-dark)] border-dashed text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Orderbook empty for this region.
              </div>
            ) : (
              <motion.div variants={terminalStagger} initial="hidden" animate="show" className="grid sm:grid-cols-2 gap-4">
                {listings.map(l => {
                  const displayPrice = (l as SecondHandListing & { display_price_lkr?: number }).display_price_lkr ?? l.base_price_lkr;
                  const isLocal = l.item_district === buyerDistrict;
                  return (
                    <motion.div key={l.id} variants={terminalItem} className="p-4 border border-[var(--border-dark)] bg-black/40 hover:border-[var(--rolex-gold)]/50 transition-colors group relative overflow-hidden">
                      {isLocal && (
                        <div className="absolute top-0 right-0 w-12 h-12 bg-[var(--rolex-gold)]/10 rounded-bl-full pointer-events-none" />
                      )}
                      <h3 className="text-sm tracking-wide mb-1 text-white group-hover:text-[var(--rolex-gold)] transition-colors line-clamp-1">{l.title}</h3>
                      <p className="text-[9px] uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-1.5">
                        <Tag size={10} /> {l.category} · {l.condition_grade}
                      </p>
                      
                      <div className="flex items-end justify-between border-t border-[var(--border-dark)] pt-3">
                        <div>
                          <p className="text-[7px] uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Asset Location</p>
                          <p className={`text-[10px] uppercase tracking-widest ${isLocal ? 'text-[var(--rolex-gold)]' : 'text-[var(--text-secondary)]'}`}>
                            {l.item_district} {isLocal && '(Local)'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[7px] uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Asking Price</p>
                          <p className="text-sm text-[var(--rolex-gold)]">LKR {displayPrice.toLocaleString()}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

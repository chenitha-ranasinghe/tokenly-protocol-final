'use client';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useStore } from '@/lib/store';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/client';
import { motion, AnimatePresence } from 'framer-motion';
import { CA_STAGGER, CA_ITEM, CA_STAGGER_FAST } from '@/lib/animations';
import type { Product } from '@/lib/types';
import { Input } from '@/components/ui/Input';
import { SkeletonGrid } from '@/components/PageSkeleton';

const CATEGORY_COLORS: Record<string, string> = {
  'Watches': 'var(--rolex-gold)',
  'Sneakers': 'var(--rolex-green-light)',
  'Handbags': '#a78bfa',
  'Jewellery': '#f472b6',
  'Art': '#38bdf8',
};

const SORT_OPTIONS = [
  { label: 'Default', value: 'default' },
  { label: 'Price ↑', value: 'price_asc' },
  { label: 'Price ↓', value: 'price_desc' },
  { label: 'Confidence ↑', value: 'conf_asc' },
  { label: 'Confidence ↓', value: 'conf_desc' },
];

export default function VaultPage() {
  const router = useRouter();
  const user = useStore(s => s.user);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('All');
  const [sortBy, setSortBy] = useState('default');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const loadProducts = useCallback(() => {
    authFetch('/api/products').then(r => r.json()).then(d => {
      setProducts(d.products || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { if (!user && user !== undefined) return; if (user === null) { router.push('/'); return; } loadProducts(); }, [user, router, loadProducts]);

  const brands = ['All', ...Array.from(new Set(products.map(p => p.brand)))];

  let filtered = products.filter(p =>
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase())) &&
    (brandFilter === 'All' || p.brand === brandFilter)
  );

  if (sortBy === 'price_asc') filtered = [...filtered].sort((a, b) => (a.consensus_price || a.retail_price) - (b.consensus_price || b.retail_price));
  if (sortBy === 'price_desc') filtered = [...filtered].sort((a, b) => (b.consensus_price || b.retail_price) - (a.consensus_price || a.retail_price));
  if (sortBy === 'conf_asc') filtered = [...filtered].sort((a, b) => (a.price_confidence || 30) - (b.price_confidence || 30));
  if (sortBy === 'conf_desc') filtered = [...filtered].sort((a, b) => (b.price_confidence || 30) - (a.price_confidence || 30));

  const confidenceColor = (c: number) => c >= 70 ? 'var(--rolex-gold)' : c >= 40 ? 'var(--rolex-green-light)' : 'var(--danger)';
  const confidenceBg = (c: number) => c >= 70 ? 'var(--gold-dim)' : c >= 40 ? 'rgba(0,168,107,0.1)' : 'var(--danger-bg)';

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-white font-sans pt-12 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
      <motion.div variants={CA_STAGGER} initial="hidden" animate="show">

        {/* ===== HERO HEADER ===== */}
        <motion.div variants={CA_ITEM} className="border-b border-[var(--border-dark)] pb-6 mb-8">
          <div className="flex justify-between items-end gap-6 flex-wrap">
            <div>
              <p className="text-[9px] font-mono tracking-[0.25em] text-[var(--rolex-gold)] mb-2 uppercase flex items-center gap-2 font-bold">
                <span className="w-1.5 h-1.5 bg-[var(--rolex-gold)] rounded-full animate-pulse"></span>
                SECONDARY MARKET
              </p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tighter text-white mb-2 uppercase leading-none">The Vault</h1>
              <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-secondary)] mt-3 max-w-lg leading-relaxed font-semibold">
                Trade fractionalized physical assets. Every listing is oracle-verified and consensus-priced.
              </p>
            </div>

            {/* Live market intel */}
            <div className="bg-[#050505] border border-[var(--border-dark)] border-t-[3px] border-t-[var(--rolex-gold)] p-4 min-w-[260px] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-10">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="var(--rolex-gold)"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              </div>
              <div className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-3 font-bold flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[var(--rolex-gold)] rounded-full animate-pulse" />
                Protocol Heartbeat
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Network', value: 'MAINNET-V5' },
                  { label: 'Vault TVL', value: '$84.2M' },
                  { label: 'Oracle Conf.', value: '99.9%' },
                  { label: 'Active Nodes', value: '1,248' },
                ].map(s => (
                  <div key={s.label}>
                    <div className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-0.5">{s.label}</div>
                    <div className="text-[10px] font-bold font-mono text-white tracking-tight">{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ===== FILTER + SORT TERMINAL ===== */}
        <motion.div variants={CA_ITEM} className="flex gap-3 mb-8 flex-wrap items-center">
          <div className="flex-1 min-w-[220px] relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
            </span>
            <input type="text" placeholder="SEARCH ASSETS..." value={search} onChange={e => setSearch(e.target.value)} suppressHydrationWarning className="w-full pl-9 pr-3 py-2.5 bg-[#0A0A0A] border border-[var(--border-dark)] text-white text-[9px] font-mono tracking-widest uppercase focus:outline-none focus:border-[var(--rolex-gold)] transition-colors font-bold" />
          </div>
 
          <div className="flex gap-1.5 flex-wrap bg-[#0A0A0A] p-1 border border-[var(--border-dark)]">
            {brands.map(b => (
              <button key={b} onClick={() => setBrandFilter(b)} suppressHydrationWarning className={`px-3 py-1.5 text-[8px] font-mono uppercase tracking-widest font-bold transition-colors ${brandFilter === b ? 'bg-white text-black' : 'bg-transparent text-[var(--text-muted)] hover:bg-white/5'}`}>
                {b}
              </button>
            ))}
          </div>
 
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            suppressHydrationWarning
            className="bg-[#0A0A0A] border border-[var(--border-dark)] text-[var(--text-secondary)] py-2.5 px-3 text-[8px] font-mono uppercase tracking-widest cursor-pointer outline-none focus:border-[var(--rolex-gold)] transition-colors font-bold"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </motion.div>

        {/* ===== RESULTS COUNT ===== */}
        {!loading && (
          <motion.div variants={CA_ITEM} className="mb-6 text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
            [{filtered.length} ASSETS FOUND {search && `FOR "${search}"`}]
          </motion.div>
        )}

        {/* ===== ASSET GRID ===== */}
        {loading ? (
          <SkeletonGrid count={6} />
        ) : filtered.length === 0 ? (
          <motion.div variants={CA_ITEM} className="p-20 border border-[var(--border-dark)] text-center bg-[#050505]">
            <div className="text-3xl text-[var(--rolex-gold)] mb-4">◈</div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">[ NO ASSETS MATCH YOUR QUERY ]</div>
            <button onClick={() => { setSearch(''); setBrandFilter('All'); }} className="mt-6 bg-transparent border border-white/20 px-6 py-2 text-[var(--rolex-gold)] text-[9px] font-mono uppercase tracking-widest hover:bg-white/5 transition-colors">CLEAR FILTERS</button>
          </motion.div>
        ) : (
          <motion.div variants={CA_STAGGER_FAST} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filtered.map(p => {
                const price = p.consensus_price || p.retail_price;
                const confidence = p.price_confidence || 30;
                const catColor = CATEGORY_COLORS[p.category || ''] || 'var(--rolex-gold)';
                const isHovered = hoveredId === p.id;

                return (
                  <motion.div
                    variants={CA_ITEM}
                    layout
                    initial="hidden"
                    animate="show"
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ y: -4 }}
                    key={p.id}
                    onClick={() => router.push(`/vault/${p.id}`)}
                    onMouseEnter={() => setHoveredId(p.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className="cursor-pointer relative overflow-hidden bg-[#050505] border border-[var(--border-dark)] transition-colors group"
                    style={{ borderColor: isHovered ? 'var(--rolex-gold)' : 'var(--border-dark)' }}
                  >
                    {/* Category color strip */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] opacity-80" style={{ background: `linear-gradient(90deg, ${catColor}, transparent)` }} />

                    {/* Image Preview */}
                    <div className="h-48 bg-[#0A0A0A] overflow-hidden relative border-b border-[var(--border-dark)]">
                      {p.image_url ? (
                        <img 
                          src={p.image_url} 
                          alt={p.name} 
                          className={`w-full h-full object-cover transition-transform duration-700 ${isHovered ? 'scale-110' : 'scale-100'}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] opacity-20">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent opacity-60" />
                    </div>

                    {/* Confidence badge — top right */}
                    <div className="absolute top-4 right-4 px-2.5 py-1 text-[9px] font-mono font-bold tracking-widest uppercase border z-10" style={{ background: confidenceBg(confidence), borderColor: `${confidenceColor(confidence)}40`, color: confidenceColor(confidence) }}>
                      {confidence}% CONF
                    </div>

                    <div className="p-6">
                      <div className="mb-6 pr-16">
                        <div className="text-[8px] font-bold uppercase tracking-widest mb-1.5" style={{ color: catColor }}>{p.brand}</div>
                        <div className="text-lg font-bold tracking-tight text-white leading-tight mb-1.5 uppercase">{p.name}</div>
                        <div className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-widest font-bold">SKU: {p.sku}</div>
                      </div>
 
                      <div className="flex justify-between items-end mb-4 pt-4 border-t border-[var(--border-dark)]">
                        <div>
                          <div className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-1.5 font-bold">CONSENSUS PRICE</div>
                          <div className="text-xl font-bold font-mono text-white tracking-tighter">
                            {confidence >= 60 ? `$${price?.toLocaleString()}` : (
                              <span className="text-sm text-[var(--text-secondary)]">${p.market_price_low?.toLocaleString()} – ${p.market_price_high?.toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-1.5 font-bold">FLOAT SUPPLY</div>
                          <div className="text-base font-bold font-mono text-[var(--text-secondary)] tracking-tighter">{p.total_tokens?.toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Confidence bar */}
                      <div className="mb-8">
                        <div className="w-full h-[2px] bg-[#0A0A0A] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${confidence}%` }}
                            transition={{ duration: 1.2, ease: [0.19, 1, 0.22, 1], delay: 0.1 }}
                            className="h-full"
                            style={{ background: confidenceColor(confidence), boxShadow: `0 0 10px ${confidenceColor(confidence)}80` }}
                          />
                        </div>
                      </div>

                      {/* CTA */}
                      <div
                        className={`p-2.5 text-center text-[9px] font-mono font-bold uppercase tracking-widest border transition-colors ${isHovered ? 'bg-[var(--rolex-gold)] text-black border-[var(--rolex-gold)]' : 'bg-[#0A0A0A] text-[var(--rolex-gold)] border-[var(--border-dark)]'}`}
                      >
                        {isHovered ? 'EXECUTE TRADE' : 'VIEW ASSET'}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </motion.div>
    </div></div>
  );
}

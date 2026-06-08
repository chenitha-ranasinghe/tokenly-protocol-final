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
import styles from './Products.module.css';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'needs-reviews' | 'name' | 'price'>('needs-reviews');
  const router = useRouter();
  const user = useStore(s => s.user);
  const isStaking = user?.experiment_group === 'staking';

  const loadProducts = useCallback(() => {
    authFetch('/api/products').then(r => r.json()).then(d => { setProducts(d.products || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { if (user === null) { router.push('/'); return; } loadProducts(); }, [user, router, loadProducts]);

  const brands = ['All', ...Array.from(new Set(products.map(p => p.brand)))];
  const filtered = products
    .filter(p => (p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())) && (brandFilter === 'All' || p.brand === brandFilter))
    .sort((a, b) => sortBy === 'needs-reviews' ? (a.review_count || 0) - (b.review_count || 0) : sortBy === 'price' ? (b.consensus_price || b.retail_price) - (a.consensus_price || a.retail_price) : a.name.localeCompare(b.name));

  const totalReviewed = products.filter(p => (p.review_count || 0) > 0).length;
  const progressPct = (totalReviewed / Math.max(products.length, 1)) * 100;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-white font-sans pt-12 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <motion.div variants={CA_STAGGER} initial="hidden" animate="show">
          
          {/* ===== HERO HEADERS ===== */}
          <motion.div variants={CA_ITEM} className={styles.pageHeader}>
            <div>
              <p className="page-label">ORACLE VERIFICATION</p>
              <h1 className="page-title">Asset Catalog</h1>
              <p className="page-subtitle">Target an asset. Submit intelligence. Earn yield.</p>
            </div>
            
            <motion.div variants={CA_ITEM} className="glass-card" style={{ flex: '1 1 240px', maxWidth: 360, borderTop: '1px solid var(--rolex-gold)' }}>
              <div className="flex justify-between items-center mb-4">
                <span className="micro-label mb-0">Verification Progress</span>
                <span className="text-[10px] font-mono text-[var(--rolex-gold)] bg-[var(--rolex-gold)]/10 px-2 py-0.5 font-bold uppercase">{totalReviewed} / {products.length}</span>
              </div>
              <div className="h-1 bg-white/5 overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 1.5, ease: "easeOut" }} className="h-full bg-[var(--rolex-gold)] shadow-[0_0_10px_rgba(163,126,44,0.3)]" />
              </div>
              <div className="text-right mt-2 text-xl font-mono font-bold text-white tracking-tighter">{Math.round(progressPct)}%</div>
            </motion.div>
          </motion.div>

          {/* ===== EXPERIMENT BANNER ===== */}
          <motion.div variants={CA_ITEM} className={`${styles.experimentBanner} ${isStaking ? styles.stakingBanner : styles.controlBanner}`}>
            <div className="text-[10px] font-mono text-[var(--rolex-gold)] font-bold tracking-widest uppercase">
              [{isStaking ? 'STAKING ORACLE' : 'CONTROL ANCHOR'}]
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-widest font-medium">
              {isStaking ? 'Deploy capital against your market estimates. Yield relies on true accuracy.' : 'Submit base estimates. Accuracy mathematically indexed for the global record.'}
            </div>
          </motion.div>

          {/* ===== FILTER TERMINAL ===== */}
          <motion.div variants={CA_ITEM} className={styles.filterTerminal}>
            <div className="flex-1 min-w-[280px] relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 opacity-30">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
              </span>
              <Input type="text" placeholder="Query asset database by SKU or name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-12 w-full" />
            </div>
            
            <div className={styles.brandTabs}>
              {brands.map(b => (
                <button 
                  key={b} 
                  onClick={() => setBrandFilter(b)} 
                  className={`${styles.brandTab} ${brandFilter === b ? styles.brandTabActive : ''}`}
                >
                  {b}
                </button>
              ))}
            </div>
            
            <select 
              className="input-field w-auto min-w-[200px]" 
              value={sortBy} 
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="needs-reviews">Sort: Urgent Review</option>
              <option value="name">Sort: Alpha A–Z</option>
              <option value="price">Sort: Valuation High–Low</option>
            </select>
          </motion.div>

          {/* ===== GRID ===== */}
          {loading ? <SkeletonGrid count={6} /> : filtered.length === 0 ? (
            <motion.div variants={CA_ITEM} className="p-20 border border-dashed border-[var(--border-dark)] text-center bg-[#050505]">
              <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">[ ZERO ASSETS DETECTED MATCHING QUERY ]</div>
            </motion.div>
          ) : (
            <motion.div variants={CA_STAGGER_FAST} initial="hidden" animate="show" className={styles.productGrid}>
              <AnimatePresence mode='popLayout'>
                {filtered.map(p => (
                  <motion.div 
                    key={p.id} 
                    variants={CA_ITEM}
                    layout
                    initial="hidden"
                    animate="show"
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ y: -8 }}
                    onClick={() => router.push(`/review/${p.id}`)} 
                    className={`${styles.productCard} ${p.review_count === 0 ? styles.productCardPriority : ''}`}
                  >
                    {p.review_count === 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={styles.priorityBadge}
                      >
                        Priority Target
                      </motion.div>
                    )}

                    <div className={styles.imageWrapper}>
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className={styles.productImage} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-[0.3em]">
                          No Image Available
                        </div>
                      )}
                      <div className={styles.imageOverlay} />
                    </div>

                    <div className="mb-6">
                      <div className="text-[9px] font-bold text-[var(--rolex-gold)] uppercase tracking-[0.25em] mb-1">{p.brand}</div>
                      <div className="text-lg font-bold text-white uppercase tracking-tight mb-1 line-clamp-1">{p.name}</div>
                      <div className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest">SKU: {p.sku}</div>
                    </div>

                    <div className="flex gap-2 mb-4">
                      <div className="bg-white/5 border border-white/10 px-2 py-1 flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-[var(--rolex-green-light)]" />
                        <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase">{p.vault_location || 'Secured Vault'}</span>
                      </div>
                      <div className="bg-white/5 border border-white/10 px-2 py-1">
                        <span className="text-[8px] font-bold text-[var(--rolex-gold)] uppercase">{p.insurance_policy || "Lloyd's Covered"}</span>
                      </div>
                    </div>

                    <div className={styles.cardFooter}>
                      <div>
                        <div className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Market Range</div>
                        <div className="text-[11px] font-mono font-bold text-[var(--rolex-green-light)] tracking-tighter">${(p.market_price_low ?? 0).toLocaleString()} — ${(p.market_price_high ?? 0).toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">Logs</div>
                        <div className="text-[11px] font-mono font-bold text-white tracking-tighter">{p.review_count}</div>
                      </div>
                    </div>

                    {p.total_staked != null && p.total_staked > 0 && (
                      <div className="mt-4 pt-4 border-t border-[var(--border-dark)] text-[9px] font-mono text-[var(--rolex-gold)] font-bold uppercase tracking-widest">
                        [ {p.total_staked.toLocaleString()} PTS STAKED ]
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

'use client';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import type { User } from '@/lib/types';
import { authFetch, setAuthUser } from '@/lib/client';
import { motion, AnimatePresence } from 'framer-motion';
import { CA_STAGGER, CA_ITEM } from '@/lib/animations';

interface Product { id: string; name: string; brand: string; sku: string; retail_price: number; market_price_low: number; market_price_high: number; consensus_price: number; total_reviews: number; }
interface ReviewResult { id: string; accurate: boolean; accuracyPct: number; reward: number; stakeAmount: number; stakeReturned: number; netPointsChange: number; band: number; newConsensus: number; }
interface ExistingReview { id: string; reviewer_name: string; condition_grade: number; price_estimate: number; review_text: string; points_staked: number; is_accurate: number; accuracy_score: number; reviewer_rrs: number; }

const gradeLabels: Record<number, string> = { 1: 'Trashed', 2: 'Heavily Used', 3: 'Used-B', 4: 'Used-A', 5: 'Lightly Used', 6: 'Very Good', 7: 'Excellent', 8: 'Near DS', 9: 'VNDS', 10: 'Deadstock' };

export default function ReviewPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [existingReviews, setExistingReviews] = useState<ExistingReview[]>([]);
  const [conditionGrade, setConditionGrade] = useState(8);
  const [priceEstimate, setPriceEstimate] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [pointsStaked, setPointsStaked] = useState(100);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState('');
  const [showConsensus, setShowConsensus] = useState(false);
  const storeUser = useStore(s => s.user);
  const user = storeUser as User | null;
  const router = useRouter();

  const isStaking = user?.experiment_group === 'staking';
  const userPoints = (user?.points ?? 0);
  const maxStake = Math.min(userPoints, 500);

  useEffect(() => {
    if (!user) { router.push('/'); return; }
    setShowConsensus(!isStaking);
    authFetch('/api/products').then(r => r.json()).then(d => {
      const p = d.products?.find((pr: Product) => pr.id === productId);
      if (p) setProduct(p);
      setLoading(false);
    });
    fetch(`/api/reviews?productId=${productId}`).then(r => r.json()).then(d => setExistingReviews(d.reviews || []));
  }, [productId, router, user, isStaking]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !priceEstimate) return;
    setSubmitting(true); setError('');
    try {
      const res = await authFetch('/api/reviews', { method: 'POST', body: JSON.stringify({ productId, conditionGrade, priceEstimate: parseFloat(priceEstimate), reviewText, pointsStaked: isStaking ? pointsStaked : 0 }) });
      const data = await res.json();
      if (data.error) { if (res.status === 401) { router.push('/'); return; } setError(data.error); setSubmitting(false); return; }
      setResult(data.review);
      setShowConsensus(true);
      setAuthUser(data.user);
    } catch { setError('Network anomaly. Reconnect.'); } finally { setSubmitting(false); }
  };

  if (loading) return <div className="page-wrapper"><div className="container"><div className="loading-spinner" /></div></div>;
  if (!product) return <div className="page-wrapper"><div className="container"><div style={{ padding: 60, border: '1px solid var(--danger)', textAlign: 'center' }}>[ FATAL: ASSET RECORD NOT FOUND ]</div></div></div>;

  return (
    <>
      <div className="page-wrapper"><div className="container">
      
      <motion.div variants={CA_STAGGER} initial="hidden" animate="show">
        <motion.button 
          whileHover={{ x: -6, color: 'var(--rolex-gold)', borderColor: 'var(--rolex-gold)' }}
          className="btn btn-outline btn-sm" 
          onClick={() => router.push('/products')} 
          style={{ marginBottom: 40, padding: '10px 24px', background: 'var(--bg-secondary)' }}>
          [ ← RETURN TO CATALOG ]
        </motion.button>

        <div className="review-layout">
          
          {/* Left: Product Information Terminal */}
          <motion.div variants={CA_ITEM} className="glass-card" style={{ padding: 32, background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--rolex-gold)', boxShadow: '0 0 8px var(--rolex-gold)' }} />
              <div style={{ fontSize: '0.65rem', color: 'var(--rolex-gold)', textTransform: 'uppercase', letterSpacing: '0.25em', fontWeight: 800 }}>{product.brand}</div>
            </div>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.1 }}>{product.name}</h2>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 24, background: 'rgba(255,255,255,0.05)', padding: '4px 10px', display: 'inline-block', borderRadius: '4px', fontWeight: 800 }}>ID: {product.sku}</div>
            
            {/* Product Image */}
            <div style={{ width: '100%', height: 300, marginBottom: 32, background: '#000', border: '1px solid var(--border-dark)', overflow: 'hidden', position: 'relative' }}>
              {(product as any).image_url ? (
                <img 
                  src={(product as any).image_url} 
                  alt={product.name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                  Reference Image Securely Stored
                </div>
              )}
              <div style={{ position: 'absolute', inset: 0, border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none' }} />
            </div>
            
            {/* Market Intelligence */}
            <div style={{ marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid var(--border-dark)' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 800 }}>Market Spread Analysis</div>
              <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden', marginBottom: 12, borderRadius: '1px' }}>
                <motion.div 
                   initial={{ left: '50%', right: '50%' }}
                   animate={{ left: '10%', right: '10%' }}
                   transition={{ delay: 0.5, duration: 1.2, ease: "circOut" }}
                   style={{ position: 'absolute', height: '100%', background: 'var(--rolex-gold)', opacity: 0.6, boxShadow: '0 0 8px rgba(163,126,44,0.4)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 700 }}>MIN: ${product.market_price_low}</span>
                {showConsensus
                   ? <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ color: 'var(--rolex-gold)', fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>${product.consensus_price}</motion.span>
                   : <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 800 }}>[ DECRYPTING ]</span>}
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 700 }}>MAX: ${product.market_price_high}</span>
              </div>
            </div>
 
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ border: '1px solid var(--border-dark)', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 800 }}>Retail Valuation</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', letterSpacing: '-0.05em' }}>${product.retail_price}</div>
              </div>
              <div style={{ border: '1px solid var(--border-dark)', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 800 }}>Total Proofs</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', letterSpacing: '-0.05em' }}>{product.total_reviews}</div>
              </div>
            </div>

            {/* Network History */}
            {existingReviews.length > 0 && (
              <div style={{ marginTop: 40 }}>
                <h3 style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--rolex-gold)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 20, borderBottom: '1px solid var(--border-dark)', paddingBottom: 10 }}>Latest Verified Intelligence</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {existingReviews.slice(0, 3).map(rev => (
                    <motion.div variants={CA_ITEM} key={rev.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-dark)', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', justifyItems: 'flex-start', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{rev.reviewer_name}</div>
                        <div style={{ fontSize: '0.55rem', padding: '3px 6px', border: `1px solid ${rev.is_accurate ? 'var(--emerald-accent)' : 'var(--danger)'}`, color: rev.is_accurate ? 'var(--emerald-accent)' : 'var(--danger)', fontWeight: 800, borderRadius: '3px', letterSpacing: '0.1em' }}>
                          {rev.is_accurate ? 'ACCURATE' : 'DEVIATED'}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginBottom: 12, fontWeight: 700 }}>
                        GRADE: {rev.condition_grade}/10 · VALUATION: ${rev.price_estimate}
                      </div>
                      {rev.review_text && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 12, fontStyle: 'italic', lineHeight: 1.4 }}>&ldquo;{rev.review_text.slice(0, 80)}...&rdquo;</div>}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Right: Submission Terminal */}
          <motion.div variants={CA_ITEM} className="glass-card" style={{ padding: 32, background: 'linear-gradient(135deg, rgba(20,20,20,0.8) 0%, rgba(5,5,5,0.9) 100%)', borderTop: '2px solid var(--rolex-gold)', borderRadius: 4 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 32, letterSpacing: '0.1em', color: 'var(--rolex-gold)' }}>[ EXECUTE VERIFICATION ]</h2>
            <form onSubmit={handleSubmit}>
              
              <div style={{ marginBottom: 32 }}>
                <label style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-secondary)', display: 'block', marginBottom: 16, fontWeight: 800 }}>
                  Asset Condition Assessment
                </label>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
                  <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{conditionGrade}<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/10</span></div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--rolex-gold)', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 800 }}>{gradeLabels[conditionGrade]}</div>
                </div>
                <input type="range" min={1} max={10} value={conditionGrade} onChange={e => setConditionGrade(parseInt(e.target.value))} className="grade-slider" style={{ marginTop: 8 }} />
              </div>
 
              <div className="input-group" style={{ marginBottom: 32 }}>
                <label style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-secondary)', display: 'block', marginBottom: 12, fontWeight: 800 }}>Quantitative Intelligence (USD)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: '1.2rem', color: 'var(--rolex-gold)', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>$</span>
                  <input type="number" className="input-field" placeholder={`0.00`} value={priceEstimate} onChange={e => setPriceEstimate(e.target.value)} min={1} step="1" required style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, padding: '16px 16px 16px 44px', width: '100%', color: 'var(--rolex-gold)', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', border: '1px solid var(--border-dark)' }} />
                </div>
              </div>
 
              <div className="input-group" style={{ marginBottom: 32 }}>
                <label style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-secondary)', display: 'block', marginBottom: 12, fontWeight: 800 }}>Qualitative Logic</label>
                <textarea className="input-field" placeholder="Provide assessment logic..." value={reviewText} onChange={e => setReviewText(e.target.value)} maxLength={2000} style={{ minHeight: 100, fontSize: '0.85rem', padding: '16px', width: '100%', lineHeight: 1.5, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-dark)', borderRadius: 4 }} />
              </div>
 
              {isStaking && (
                <div style={{ marginBottom: 32 }}>
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} style={{ padding: 24, background: 'rgba(163,126,44,0.03)', border: '1px solid var(--rolex-gold)', borderRadius: 4 }}>
                    <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--rolex-gold)', marginBottom: 16, textAlign: 'center', fontWeight: 800 }}>Staking Authority Pledge</div>
                    <div style={{ fontSize: '3rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginBottom: 8, textAlign: 'center' }}>{pointsStaked}</div>
                    
                    <input type="range" min={10} max={maxStake} step={10} value={pointsStaked} onChange={e => setPointsStaked(parseInt(e.target.value))} className="grade-slider" />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 12, fontWeight: 800 }}>
                      <span>MIN: 10</span><span>AVAIL: {maxStake}</span>
                    </div>
                  </motion.div>
                </div>
              )}
 
              {error && <div style={{ marginBottom: 24, padding: '12px', borderLeft: '4px solid var(--danger)', color: 'var(--danger)', fontSize: '0.75rem', background: 'var(--danger-bg)', fontWeight: 800 }}>[ ERROR ] {error}</div>}
 
              <motion.button 
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit" 
                className="btn btn-primary" 
                disabled={submitting || !priceEstimate} 
                style={{ width: '100%', padding: 20, fontSize: '0.9rem', letterSpacing: '0.2em', fontWeight: 800, textTransform: 'uppercase' }}>
                {submitting ? 'PROCESSING...' : 'AUTHORIZE SUBMISSION'}
              </motion.button>
            </form>
          </motion.div>
        </div>
      </motion.div>
    </div></div>

    <AnimatePresence>
      {result && (
        <div className="modal-overlay" onClick={() => { setResult(null); router.push('/products'); }} style={{ backdropFilter: 'blur(12px)' }}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            className="glass-card modal-content" 
            onClick={e => e.stopPropagation()} 
            style={{ maxWidth: 560, background: 'var(--bg-primary)', borderTop: result.accurate ? '6px solid var(--success)' : '6px solid var(--danger)', padding: 60, textAlign: 'center', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}>
            
            <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: result.accurate ? 'var(--success)' : 'var(--danger)', marginBottom: 24, fontWeight: 700 }}>
              {result.accurate ? '[ ANALYSIS VERIFIED ]' : '[ ANALYSIS REJECTED ]'}
            </div>
            
            <h2 style={{ fontSize: '3.5rem', fontWeight: 600, letterSpacing: '-0.04em', color: 'var(--text-primary)', marginBottom: 40 }}>
              {result.accurate ? 'Market Synergy' : 'System Outlier'}
            </h2>
            
            <div style={{ padding: 48, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-dark)', marginBottom: 40, borderRadius: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16 }}>Treasury Outcome</div>
              <div style={{ fontSize: '4rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: (result.netPointsChange ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {(result.netPointsChange ?? 0) >= 0 ? '+' : ''}{(result.netPointsChange ?? 0).toLocaleString()}
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, textAlign: 'left', marginBottom: 48 }}>
              <div style={{ background: 'var(--bg-card)', padding: '24px', border: '1px solid var(--border-dark)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>Variance Log</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>{(result.accuracyPct ?? 0).toFixed(1)}%</div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '24px', border: '1px solid var(--border-dark)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>Protocol Consensus</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 600, color: 'var(--rolex-gold)' }}>${result.newConsensus}</div>
              </div>
            </div>

            <button className="btn btn-outline" onClick={() => { setResult(null); router.push('/products'); }} style={{ width: '100%', padding: '20px 24px', fontSize: '1rem', letterSpacing: '0.15em' }}>PROCEED TO HUB</button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}

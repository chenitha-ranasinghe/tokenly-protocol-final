'use client';
import { useStore } from '@/lib/store';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/client';
import type { AdminData, AdminUser, CANBond, Product, VisionResult } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { CA_STAGGER, CA_ITEM, CA_STAGGER_FAST } from '@/lib/animations';
import { 
  ShieldAlert, 
  Activity, 
  Database, 
  Terminal, 
  Cpu, 
  FolderEdit, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle,
  Zap,
  Globe,
  Settings
} from 'lucide-react';
import { showToast } from '@/components/Toast';

export default function AdminDashboard() {
  const router = useRouter();
  const user = useStore(s => s.user);
  const hydrated = useStore(s => s.hydrated);
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [visionImg, setVisionImg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [visionRes, setVisionRes] = useState<VisionResult | null>(null);
  const [activeTab, setActiveTab] = useState<'command' | 'neural' | 'content' | 'can'>('command');
  
  // Content Management State
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const load = async () => {
    try {
      const r = await authFetch('/api/admin');
      if (!r.ok) { router.push('/'); return; }
      const d = await r.json();
      setData(d);
      setLoading(false);
    } catch { 
      router.push('/');
    }
  };

  const loadProducts = async () => {
    try {
      const r = await authFetch('/api/products');
      const d = await r.json();
      setProducts(d.products || []);
    } catch { console.error("CMS load failed"); }
  };

  useEffect(() => {
    if (!user) { router.push('/'); return; }
    load();
    loadProducts();
  }, [router]);

  const doAction = async (action: string, extra: Record<string, unknown> = {}) => {
    try {
      const res = await authFetch('/api/admin', { method: 'POST', body: JSON.stringify({ action, ...extra }) });
      const d = await res.json();
      if (!res.ok) { showToast(d.error, 'error'); return; }
      showToast(d.message, 'success');
      load();
    } catch { showToast('Network failure', 'error'); }
  };

  const handleVisionScan = async () => {
    if (!visionImg) return;
    setScanning(true); setVisionRes(null);
    try {
      const r = await fetch('/api/ai-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: visionImg, productId: 'test_id' })
      });
      const d = await r.json();
      setVisionRes(d);
    } catch {
      setVisionRes({ 
        success: false,
        verdict: 'INCONCLUSIVE',
        confidence: 0,
        notes: '[ FATAL ] Oracle Connection Severed',
        forensics: [],
        powered_by: 'Oracle',
        disclaimer: 'Connection failed',
        error: '[ FATAL ] Oracle Connection Severed' 
      });
    }
    setScanning(false);
  };

  if (loading || !data) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505' }}>
      <div className="loading-spinner" />
    </div>
  );

  return (
    <div className="page-wrapper" style={{ paddingBottom: 60 }}>
      
      <main className="container" style={{ paddingTop: 40 }}>
        
        <motion.div variants={CA_STAGGER} initial="hidden" animate="show">
          
          {/* ===== HEADER ===== */}
          <motion.div variants={CA_ITEM} className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 24, borderBottom: '1px solid var(--border-dark)', paddingBottom: '24px', marginBottom: '32px' }}>
            <div>
              <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.4em', color: 'var(--danger)', marginBottom: 8, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={12} /> [ CLEARANCE LEVEL 5 REQUIRED ]
              </div>
              <h1 className="page-title" style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>Network Control</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}>Centralized authority portal for global liquidity and neural ingestion.</p>
            </div>

            <div style={{ display: 'flex', gap: 12, background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-dark)' }}>
              {(['command', 'neural', 'content', 'can'] as const).map(t => (
                <button 
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`btn btn-sm ${activeTab === t ? 'btn-primary' : 'btn-outline'}`}
                  style={{ 
                    fontSize: '0.65rem', padding: '10px 20px', borderRadius: '8px',
                    background: activeTab === t ? 'var(--text-primary)' : 'transparent',
                    color: activeTab === t ? '#000' : 'var(--text-muted)',
                    border: 'none', fontWeight: 700
                  }}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            
            {/* ##### TAB: COMMAND CENTER ##### */}
            {activeTab === 'command' && (
              <motion.div key="command" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                {/* Killswitch & Quick Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 16, marginBottom: 24 }}>
                   <div className="glass-card" style={{ 
                     padding: 24, border: data.tradingHalted ? '2px solid var(--danger)' : '1px solid var(--border-dark)', 
                     background: data.tradingHalted ? 'rgba(207,79,79,0.05)' : 'var(--bg-secondary)',
                     display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                   }}>
                     <div>
                       <h3 style={{ fontSize: '0.9rem', fontWeight: 800, margin: '0 0 4px', color: data.tradingHalted ? 'var(--danger)' : 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Protocol Trading Engine</h3>
                       <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Master switch for global liquid transfers</p>
                     </div>
                     <div style={{ display: 'flex', gap: 12 }}>
                       <button 
                          onClick={() => doAction(data.tradingHalted ? 'resume_trading' : 'halt_trading')}
                          className="btn" 
                          style={{ background: data.tradingHalted ? 'var(--success)' : 'var(--danger)', color: '#000', padding: '12px 24px', fontWeight: 800, fontSize: '0.7rem', letterSpacing: '0.1em' }}>
                          {data.tradingHalted ? 'INITIALIZE ENGINE' : 'HALT ALL TRADING'}
                       </button>
                       <button 
                          onClick={() => { if(confirm('SYNC GENESIS CATALOGUE? This will ingest institutional assets into the ledger.')) doAction('seed_genesis'); }}
                          className="btn btn-outline" 
                          style={{ borderColor: 'var(--rolex-gold)', color: 'var(--rolex-gold)', padding: '12px 20px', fontWeight: 800, fontSize: '0.7rem', letterSpacing: '0.1em' }}>
                          GENESIS SYNC
                       </button>
                     </div>
                   </div>

                   <div className="glass-card" style={{ padding: 24, borderLeft: '4px solid var(--rolex-gold)' }}>
                      <div className="micro-label" style={{ fontSize: '0.55rem', letterSpacing: '0.2em' }}>Vault Insurance Pool</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--rolex-gold)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
                         {(data.platformMetrics.totalInsurancePool || 0).toLocaleString()} <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0' }}>PTS</span>
                      </div>
                   </div>
                </div>

                {/* subsystem Ticker */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
                  {[
                    { label: 'Total Secured Value', value: data.totalSecuredValue, unit: 'USD', color: 'var(--rolex-gold)' },
                    { label: 'Protocol Yield (30%)', value: data.protocolYield, unit: 'PTS', color: 'var(--success)' },
                    { label: 'CAN Yield (70%)', value: data.authenticatorYield, unit: 'PTS', color: 'var(--text-secondary)' },
                  ].map(stat => (
                    <div key={stat.label} className="glass-card" style={{ padding: 20, borderTop: `1px solid ${stat.color}` }}>
                       <div className="micro-label" style={{ marginBottom: 8, fontSize: '0.55rem', letterSpacing: '0.2em' }}>{stat.label}</div>
                       <div style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: stat.color }}>
                         {(stat.value || 0).toLocaleString()} <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>{stat.unit}</span>
                       </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, marginBottom: 60 }}>
                  {[
                    { label: 'Network Nodes', value: data.usersCount, icon: <Globe size={16} /> },
                    { label: 'Total Logs', value: data.totalReviews, icon: <Database size={16} /> },
                    { label: 'Blockchain TXs', value: data.totalTrades, icon: <Activity size={16} /> },
                    { label: 'Burned Capital', value: data.platformMetrics.totalBurned, icon: <Zap size={16} />, color: 'var(--danger)' },
                  ].map(stat => (
                    <div key={stat.label} className="glass-card" style={{ padding: 32 }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                        {stat.icon} {stat.label}
                      </div>
                      <div style={{ fontSize: '2rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: stat.color || '#fff' }}>{(stat.value || 0).toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                {/* User Matrix */}
                <h2 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.25em', marginBottom: 16, color: 'var(--rolex-gold)' }}>User Matrix Override</h2>
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                   <div className="leaderboard-responsive"><table className="leaderboard-table">
                     <thead style={{ background: 'rgba(255,255,255,0.02)' }}><tr><th style={{ padding: '12px 24px', fontSize: '0.6rem' }}>Node Index</th><th style={{ fontSize: '0.6rem' }}>Reputation</th><th style={{ fontSize: '0.6rem' }}>Capital</th><th style={{ fontSize: '0.6rem' }}>Group</th><th style={{ paddingRight: 24, textAlign: 'right', fontSize: '0.6rem' }}>Access Command</th></tr></thead>
                     <tbody>
                       {(data.recentUsers || []).map((u: AdminUser) => (
                         <tr key={u.id} style={{ opacity: u.is_banned ? 0.4 : 1, borderBottom: '1px solid var(--border-dark)' }}>
                           <td style={{ padding: '12px 24px' }}>
                              <div style={{ fontWeight: 800, fontSize: '0.8rem', letterSpacing: '-0.01em' }}>{u.name}</div>
                              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{u.email}</div>
                           </td>
                           <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--rolex-gold)', fontSize: '0.8rem' }}>{u.rrs_score?.toFixed(1)}</td>
                           <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{u.points?.toLocaleString()}</td>
                           <td><span style={{ fontSize: '0.55rem', border: '1px solid var(--border-dark)', padding: '2px 6px', borderRadius: '2px', fontWeight: 700, opacity: 0.7 }}>{u.experiment_group.toUpperCase()}</span></td>
                           <td style={{ textAlign: 'right', paddingRight: 24 }}>
                             <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                               {!u.is_id_verified && (
                                 <button onClick={() => doAction('verify_id', { targetUserId: u.id })} className="btn btn-sm btn-outline" style={{ borderColor: 'var(--success)', color: 'var(--success)', fontSize: '0.55rem', padding: '4px 10px' }}>
                                   VERIFY
                                 </button>
                               )}
                               <button onClick={() => doAction(u.is_banned ? 'unban_user' : 'ban_user', { targetUserId: u.id })} className={`btn btn-sm ${u.is_banned ? 'btn-primary' : 'btn-outline'}`} style={{ color: u.is_banned ? '#000' : 'var(--danger)', borderColor: u.is_banned ? 'transparent' : 'var(--danger)', fontSize: '0.55rem', padding: '4px 10px' }}>
                                 {u.is_banned ? 'RESTORE' : 'BURN'}
                               </button>
                             </div>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table></div>
                </div>
              </motion.div>
            )}

            {/* ##### TAB: NEURAL ANALYSIS ##### */}
            {activeTab === 'neural' && (
              <motion.div key="neural" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--rolex-gold)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1.2, padding: 48, borderRight: '1px solid var(--border-dark)' }}>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--rolex-gold)', marginBottom: 12 }}>Llama-Vision 3.2 Oracle</h2>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 40, lineHeight: 1.6 }}>Direct neural override for physical asset validation. Ingest optical data to flag synthetic logic signatures.</p>
                      
                      <div style={{ padding: 40, border: '1px dashed var(--rolex-gold)', background: 'rgba(0,0,0,0.3)', borderRadius: 12, textAlign: 'center', marginBottom: 40 }}>
                         <input type="file" accept="image/*" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const r = new FileReader();
                              r.onload = (ev) => { setVisionImg(ev.target?.result as string); };
                              r.readAsDataURL(file);
                            }
                         }} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} />
                      </div>

                      <button 
                        disabled={!visionImg || scanning}
                        onClick={handleVisionScan}
                        className="btn btn-primary" 
                        style={{ width: '100%', padding: '20px', fontWeight: 800 }}>
                        {scanning ? '[ EXECUTING NEURAL TRACE... ]' : '[ INITIALIZE VISION OVERRIDE ]'}
                      </button>
                    </div>

                    <div style={{ flex: 0.8, padding: 48, background: 'rgba(5,5,5,0.95)', borderLeft: '1px solid #111' }}>
                       <div style={{ color: 'var(--rolex-gold)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.2em', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Terminal size={14} /> ORACLE_OUTPUT_LOG
                       </div>
                       
                       <AnimatePresence mode="wait">
                         {visionRes ? (
                           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                              <div style={{ marginBottom: 24 }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 8 }}>PRELIMINARY VERDICT:</div>
                                <div style={{ fontSize: '1.5rem', color: visionRes.success ? 'var(--success)' : 'var(--danger)', fontWeight: 800 }}>{visionRes.verdict}</div>
                              </div>
                              <div style={{ marginBottom: 24 }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 8 }}>CONFIDENCE INDEX:</div>
                                <div style={{ fontSize: '1.2rem', color: '#fff', fontFamily: 'var(--font-mono)' }}>{visionRes.confidence}%</div>
                              </div>
                              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: 8, borderLeft: '2px solid var(--rolex-gold)' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 8 }}>TRACE DATA:</div>
                                <div style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{visionRes.notes}</div>
                              </div>
                           </motion.div>
                         ) : (
                           <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', fontStyle: 'italic' }}>
                             AWAITING OPTICAL PAYLOAD...
                           </div>
                         )}
                       </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ##### TAB: CONTENT MANAGEMENT ##### */}
            {activeTab === 'content' && (
              <motion.div key="content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                   <h2 style={{ fontSize: '1.2rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0, color: 'var(--rolex-gold)' }}>Asset Ingestion Ledger</h2>
                   <button onClick={() => setEditingProduct({ 
                     id: 'new', name: '', brand: '', sku: '', category: 'Sneakers', 
                     retail_price: 0, market_price_low: 0, market_price_high: 0, 
                     consensus_price: 0, total_tokens: 1000, total_reviews: 0, 
                     price_confidence: 0, verification_status: 'pending' 
                   })} className="btn btn-sm btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Plus size={16} /> INGEST NEW ASSET
                   </button>
                </div>

                <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                   <div className="leaderboard-responsive"><table className="leaderboard-table">
                     <thead><tr><th>Asset Brand</th><th>Designation</th><th>Basis Value</th><th>Supply Index</th><th>Logs</th><th>Command</th></tr></thead>
                     <tbody>
                       {products.map(p => (
                         <tr key={p.id}>
                           <td style={{ paddingLeft: 32, color: 'var(--rolex-gold)', fontWeight: 800, fontSize: '0.8rem' }}>{p.brand}</td>
                           <td style={{ fontWeight: 600 }}>{p.name}</td>
                           <td style={{ fontFamily: 'var(--font-mono)' }}>${p.retail_price?.toLocaleString()}</td>
                           <td style={{ color: 'var(--text-muted)' }}>{p.total_shares_available?.toLocaleString()}</td>
                           <td style={{ fontFamily: 'var(--font-mono)' }}>{p.total_reviews || 0}</td>
                           <td style={{ textAlign: 'right', paddingRight: 32 }}>
                             <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                               <button onClick={() => setEditingProduct(p)} className="btn btn-sm btn-outline"><FolderEdit size={14} /></button>
                               <button onClick={() => { if(confirm("Terminate asset record?")) doAction('delete_product', { productId: p.id }); }} className="btn btn-sm btn-outline" style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                             </div>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table></div>
                </div>

                <AnimatePresence>
                  {editingProduct && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" style={{ backdropFilter: 'blur(10px)' }}>
                       <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="glass-card" style={{ width: '100%', maxWidth: 600, padding: 48, borderTop: '4px solid var(--rolex-gold)' }}>
                          <h2 style={{ fontSize: '1.5rem', marginBottom: 8 }}>{editingProduct.id === 'new' ? 'Initialize Ingestion' : 'Modify Asset Record'}</h2>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 40 }}>Direct Ledger Mutation Interface</p>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
                             <div style={{ gridColumn: 'span 2' }}>
                               <label className="tiny-label">Product Full Designation</label>
                               <input type="text" className="input-field" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
                             </div>
                             <div>
                               <label className="tiny-label">Luxury Brand</label>
                               <input type="text" className="input-field" value={editingProduct.brand} onChange={e => setEditingProduct({...editingProduct, brand: e.target.value})} />
                             </div>
                             <div>
                               <label className="tiny-label">Retail Basis ($)</label>
                               <input type="number" className="input-field" value={editingProduct.retail_price} onChange={e => setEditingProduct({...editingProduct, retail_price: parseInt(e.target.value)})} />
                             </div>
                          </div>

                          <div style={{ display: 'flex', gap: 16 }}>
                             <button onClick={() => setEditingProduct(null)} className="btn btn-outline" style={{ flex: 1 }}>ABORT</button>
                             <button onClick={() => {
                               doAction(editingProduct.id === 'new' ? 'add_product' : 'update_product', { product: editingProduct });
                               setEditingProduct(null);
                             }} className="btn btn-primary" style={{ flex: 1 }}>COMMIT RECORD</button>
                          </div>
                       </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ##### TAB: CAN MANAGEMENT ##### */}
            {activeTab === 'can' && (
              <motion.div key="can" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                   <h2 style={{ fontSize: '1.2rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0, color: 'var(--rolex-gold)' }}>CAN Node Ledger</h2>
                   <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: 8 }}>
                     ACTIVE BONDS: {data.canBonds?.filter((b: CANBond) => b.status === 'locked').length || 0}
                   </div>
                </div>

                <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="leaderboard-responsive">
                      <table className="leaderboard-table">
                        <thead>
                          <tr>
                            <th style={{ paddingLeft: 32 }}>Node Identity</th>
                            <th>Clearance Level</th>
                            <th>Staked Bond</th>
                            <th>Status</th>
                            <th style={{ paddingRight: 32, textAlign: 'right' }}>Governance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.canBonds || []).map((b: CANBond) => (
                            <tr key={b.id} style={{ opacity: b.status === 'slashed' ? 0.4 : 1 }}>
                              <td style={{ paddingLeft: 32 }}>
                                <div style={{ fontWeight: 700 }}>{b.user_name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{b.user_email}</div>
                                {b.status !== 'slashed' && (
                                  <button 
                                    onClick={() => {
                                      const t = prompt('Enter Tier (Network Inspector, Master Authenticator, Gemologist Partner):');
                                      if (t) doAction('grant_can', { userId: b.user_id, tier: t });
                                    }}
                                    className="btn btn-sm" style={{ fontSize: '0.5rem', padding: '2px 6px', marginTop: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--rolex-gold)' }}>
                                    + UPGRADE 
                                  </button>
                                )}
                              </td>
                              <td>
                                <span style={{ 
                                  fontSize: '0.65rem', 
                                  background: b.status === 'slashed' ? 'rgba(207,79,79,0.1)' : 'rgba(163,126,44,0.1)', 
                                  color: b.status === 'slashed' ? 'var(--danger)' : 'var(--rolex-gold)', 
                                  padding: '4px 10px', 
                                  borderRadius: 4,
                                  fontWeight: 700 
                                }}>
                                  {b.order_id.replace('can_tier_', '').toUpperCase()}
                                </span>
                              </td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{b.bond_amount?.toLocaleString()} PTS</td>
                              <td>
                                <span style={{ 
                                }}>
                                  {b.status}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', paddingRight: 32 }}>
                                {b.status === 'locked' && (
                                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                    <button 
                                      onClick={() => { if(confirm('Settle bond and return capital?')) doAction('release_bond', { bondId: b.id }); }}
                                      className="btn btn-sm btn-outline" style={{ fontSize: '0.6rem' }}>
                                      RELEASE
                                    </button>
                                    <button 
                                      onClick={() => { if(confirm('!! CRITICAL !! Slash node and burn 100% capital?')) doAction('slash_node', { bondId: b.id }); }}
                                      className="btn btn-sm" style={{ background: 'var(--danger)', color: '#000', fontSize: '0.6rem', fontWeight: 800 }}>
                                      SLASH
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                          {(!data.canBonds || data.canBonds.length === 0) && (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No CAN nodes registered in ledger.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

        </motion.div>
      </main>
    </div>
  );
}

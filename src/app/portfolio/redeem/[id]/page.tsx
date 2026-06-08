'use client';
import { useStore } from '@/lib/store';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/client';
import type { Product } from '@/lib/types';
import { motion } from 'framer-motion';
import { CA_STAGGER, CA_ITEM } from '@/lib/animations';
import { MapPin, Truck, ShieldCheck, ChevronLeft, Package, User } from 'lucide-react';
import { showToast } from '@/components/Toast';

export default function RedemptionGateway({ params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = use(params);
  const router = useRouter();
  const user = useStore(s => s.user);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    shippingAddress: '',
    contactNumber: '',
    method: 'physical_delivery'
  });

  useEffect(() => {
    if (user === null) { router.push('/'); return; }
    authFetch(`/api/products/${productId}`)
      .then(r => r.json())
      .then(d => { setProduct(d.product); setLoading(false); })
      .catch(() => setLoading(false));
  }, [productId, router, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await authFetch('/api/redeem', {
        method: 'POST',
        body: JSON.stringify({ ...formData, productId })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        router.push('/portfolio');
      } else {
        showToast(data.error, 'error');
      }
    } catch {
      showToast('Logistics synchronization failure.', 'error');
    }
    setSubmitting(false);
  };

  if (loading) return <div className="loading-spinner" />;

  if (!product) {
    return (
      <div style={{ background: '#050505', minHeight: '100vh', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Product not found or failed to load.</p>
      </div>
    );
  }

  return (
    <div style={{ background: '#050505', minHeight: '100vh', color: '#fff' }}>
      
      <main className="container" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 32, fontSize: '0.9rem' }}>
          <ChevronLeft size={16} /> RETURN TO PORTFOLIO
        </button>

        <motion.div variants={CA_STAGGER} initial="hidden" animate="show">
          <motion.div variants={CA_ITEM} className="page-header">
            <p className="page-label">RWA BRIDGE LOGISTICS</p>
            <h1 className="page-title">Redemption Gateway</h1>
            <p className="page-subtitle">Transition your digital allocations into physical possession. Our white-glove logistics partners handle the rest.</p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 350px)', gap: 40 }}>
            <motion.div variants={CA_ITEM}>
              <form onSubmit={handleSubmit} className="glass-card" style={{ padding: 48, borderTop: '4px solid var(--rolex-gold)' }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 32 }}>Logistics Intent Form</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Redemption Method</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <button 
                        type="button" 
                        onClick={() => setFormData({...formData, method: 'physical_delivery'})}
                        style={{ 
                          padding: '20px', borderRadius: 12, border: formData.method === 'physical_delivery' ? '1px solid var(--rolex-gold)' : '1px solid var(--border-dark)',
                          background: formData.method === 'physical_delivery' ? 'rgba(163,126,44,0.1)' : 'transparent', textAlign: 'left', cursor: 'pointer', transition: 'all 0.3s ease'
                        }}
                      >
                        <Truck size={20} color={formData.method === 'physical_delivery' ? 'var(--rolex-gold)' : 'var(--text-muted)'} style={{ marginBottom: 12 }} />
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: formData.method === 'physical_delivery' ? '#fff' : 'var(--text-secondary)' }}>Physical Delivery</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Doorstep logistics.</div>
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setFormData({...formData, method: 'vault_transfer'})}
                        style={{ 
                          padding: '20px', borderRadius: 12, border: formData.method === 'vault_transfer' ? '1px solid var(--rolex-gold)' : '1px solid var(--border-dark)',
                          background: formData.method === 'vault_transfer' ? 'rgba(163,126,44,0.1)' : 'transparent', textAlign: 'left', cursor: 'pointer', transition: 'all 0.3s ease'
                        }}
                      >
                        <MapPin size={20} color={formData.method === 'vault_transfer' ? 'var(--rolex-gold)' : 'var(--text-muted)'} style={{ marginBottom: 12 }} />
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: formData.method === 'vault_transfer' ? '#fff' : 'var(--text-secondary)' }}>Vault Transfer</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Keep at Malca-Amit.</div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Delivery Terminal / Shipping Address</label>
                    <textarea 
                      required 
                      className="input-field" 
                      rows={4}
                      placeholder="Enter full shipping details including suite/apartment number..." 
                      value={formData.shippingAddress} 
                      onChange={e => setFormData({...formData, shippingAddress: e.target.value})} 
                      style={{ width: '100%', resize: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Encrypted Contact Number</label>
                    <input 
                      type="tel" 
                      required 
                      className="input-field" 
                      placeholder="+1 (555) 000-0000" 
                      value={formData.contactNumber} 
                      onChange={e => setFormData({...formData, contactNumber: e.target.value})} 
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div style={{ padding: '24px', background: 'rgba(0,168,107,0.05)', borderRadius: 12, border: '1px solid rgba(0,168,107,0.2)' }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <ShieldCheck size={24} color="var(--success)" />
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Secure Custody Handover</div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>Your 100% digital stake will be burned and replaced with a legal physical deed. Insurance coverage remains active during transit.</p>
                      </div>
                    </div>
                  </div>

                  <button 
                    disabled={submitting}
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ width: '100%', padding: '20px', fontSize: '1rem', fontWeight: 800, letterSpacing: '0.1em' }}
                  >
                    {submitting ? 'PROCESSING CUSTODY TRANSFER...' : '[ EXECUTE REDEMPTION ]'}
                  </button>
                </div>
              </form>
            </motion.div>

            <motion.div variants={CA_ITEM} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="glass-card" style={{ padding: 24 }}>
                <label className="micro-label">Asset to Redeem</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
                  <div style={{ background: 'rgba(163,126,44,0.1)', padding: 12, borderRadius: 12 }}>
                    <Package size={32} color="var(--rolex-gold)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{product.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{product.brand} &bull; {product.sku}</div>
                  </div>
                </div>
              </div>

              <div className="glass-card" style={{ padding: 24, borderLeft: '4px solid var(--rolex-gold)' }}>
                <label className="micro-label">Verification Score</label>
                <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: 12, color: 'var(--rolex-gold)', fontFamily: 'var(--font-mono)' }}>100%</div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>Minimum stake required for redemption reached.</p>
              </div>

              <div className="glass-card" style={{ padding: 24 }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                   <MapPin size={16} color="var(--success)" />
                   <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Vault Location</div>
                 </div>
                 <div style={{ fontSize: '0.9rem', color: '#fff' }}>{product.vault_location || 'Malca-Amit Changi, Singapore'}</div>
                 <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 12 }}>Custody will be transferred from this terminal to your target address.</p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

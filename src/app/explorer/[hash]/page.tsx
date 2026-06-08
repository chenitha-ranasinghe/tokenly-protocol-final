'use client';
import { useEffect, useState, use } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, CheckCircle, Clock, Fingerprint, User, Package, ChevronLeft, ExternalLink } from 'lucide-react';
import { CA_STAGGER, CA_ITEM } from '@/lib/animations';
import Link from 'next/link';

interface ExplorerRecord {
  cert_id?: string;
  hash: string;
  timestamp: string | number;
  grade?: number;
  asset: { name: string; brand: string; sku: string };
  validator: { name: string; rrs: number };
}

export default function ExplorerDetail({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = use(params);
  const [record, setRecord] = useState<ExplorerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetch(`/api/explorer/${hash}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setRecord(data.record as ExplorerRecord);
        else setError(data.error);
        setLoading(false);
      })
      .catch(() => {
        setError('Network synchronization failure.');
        setLoading(false);
      });
  }, [hash]);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505', color: 'var(--rolex-gold)' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff', padding: '60px 24px', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <Link href="/explorer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.8rem', marginBottom: 40 }}>
          <ChevronLeft size={16} /> BACK TO EXPLORER
        </Link>

        {error ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '80px 40px', background: 'rgba(207, 79, 79, 0.05)', border: '1px solid rgba(207, 79, 79, 0.2)', borderRadius: 24 }}>
            <ShieldAlert size={48} color="var(--danger)" style={{ marginBottom: 24 }} />
            <h2 style={{ fontSize: '1.5rem', marginBottom: 12 }}>Invalid Audit Signature</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>{error}</p>
            <Link href="/explorer" className="btn btn-primary">
              RETRY SEARCH
            </Link>
          </motion.div>
        ) : !record ? (
          <p style={{ color: 'var(--text-muted)' }}>No audit record returned.</p>
        ) : (
          <motion.div variants={CA_STAGGER} initial="hidden" animate="show">
            <motion.div variants={CA_ITEM} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4, letterSpacing: '-0.03em', textTransform: 'uppercase' }}>Audit Certificate</h1>
                <p style={{ color: 'var(--rolex-gold)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.1em', fontWeight: 800 }}>ID: {record.cert_id || 'PROT-AUTH-8821'}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <CheckCircle size={32} color="var(--success)" />
                <div style={{ fontSize: '0.55rem', fontWeight: 900, color: 'var(--success)', marginTop: 4, letterSpacing: '0.1em' }}>VERIFIED AUTHENTIC</div>
              </div>
            </motion.div>

            <motion.div variants={CA_ITEM} className="glass-card" style={{ padding: 24, border: '1px solid var(--border-heavy)', position: 'relative', overflow: 'hidden', marginBottom: 24 }}>
              <div style={{ position: 'absolute', top: -10, right: -10, opacity: 0.05 }}>
                <Fingerprint size={120} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 8, fontWeight: 800 }}>Asset Identity</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8 }}>
                      <Package size={18} color="var(--rolex-gold)" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>{record.asset.name}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>
                        {record.asset.brand} • {record.asset.sku}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 8, fontWeight: 800 }}>Authority Node</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8 }}>
                      <User size={18} color="var(--rolex-gold)" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase' }}>{record.validator.name}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--rolex-gold)', fontWeight: 800, letterSpacing: '0.1em' }}>RRS: {record.validator.rrs.toFixed(1)}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 8, fontWeight: 800 }}>Temporal Stamp</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8 }}>
                      <Clock size={18} color="var(--rolex-gold)" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>{isMounted ? new Date(record.timestamp).toLocaleDateString() : '---'}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                        {isMounted ? new Date(record.timestamp).toLocaleTimeString() : '---'} UTC
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div variants={CA_ITEM} className="glass-card" style={{ padding: 24, background: 'rgba(255,255,255,0.01)' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 8, fontWeight: 800 }}>Ledger Fingerprint</label>
                <div
                  style={{
                    background: '#000',
                    padding: 12,
                    borderRadius: 4,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: 'var(--rolex-gold)',
                    border: '1px solid var(--border-dark)',
                    wordBreak: 'break-all',
                    lineHeight: 1.4,
                    fontWeight: 700,
                  }}
                >
                  {record.hash}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 }}>
                  Condition Index:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{record.grade ?? '—'}/10</strong>
                </div>
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: 4,
                    fontSize: '0.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                  }}
                >
                  ON-CHAIN LOGS <ExternalLink size={10} />
                </button>
              </div>
            </motion.div>

            <motion.div variants={CA_ITEM} style={{ marginTop: 48, textAlign: 'center', opacity: 0.5 }}>
              <p style={{ fontSize: '0.7rem', letterSpacing: '0.1em' }}>This document is a cryptographic proof of the Tokenly Certified Network.</p>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

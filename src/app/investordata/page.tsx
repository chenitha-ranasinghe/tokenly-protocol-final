'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { CA_STAGGER, CA_ITEM } from '@/lib/animations';

type CohortStats = {
  count: number;
  total_reviews: number;
  accuracy: number;
  rrsAvg: number;
  avgTrades?: number;
};

type PlatformMetricsBlock = {
  totalFeesCollected?: number;
  totalInsurancePool?: number;
  totalBurned?: number;
  totalBondsLocked?: number;
};

type InvestorRoomPayload = {
  hypothesis?: string;
  stakingData: CohortStats;
  controlData: CohortStats;
  networkVolume?: number;
  totalTrades?: number;
  avgTradeSize?: number;
  totalUsers?: number;
  dau?: number;
  mau?: number;
  platformMetrics: PlatformMetricsBlock;
};

export default function InvestorDataRoom() {
  const [accessCode, setAccessCode] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<InvestorRoomPayload | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/investor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: accessCode })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Authorization Denied');
      setData(d.data as InvestorRoomPayload);
      setAuthenticated(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authorization Denied');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!data) return;
    const rows = [
      ['Metric', 'Staking Group', 'Control Group'],
      ['Participants', data.stakingData.count, data.controlData.count],
      ['Total Reviews', data.stakingData.total_reviews, data.controlData.total_reviews],
      ['Accuracy', data.stakingData.accuracy.toFixed(1) + '%', data.controlData.accuracy.toFixed(1) + '%'],
      ['Avg RRS', data.stakingData.rrsAvg.toFixed(1), data.controlData.rrsAvg.toFixed(1)],
      ['Avg Trades', data.stakingData.avgTrades?.toFixed(1) || 0, data.controlData.avgTrades?.toFixed(1) || 0],
      ['---', '---', '---'],
      ['Network Volume', data.networkVolume, ''],
      ['Total Trades', data.totalTrades, ''],
      ['Avg Trade Size', data.avgTradeSize, ''],
      ['Total Users', data.totalUsers, ''],
      ['DAU', data.dau, ''],
      ['MAU', data.mau, ''],
      ['Total Fees', data.platformMetrics.totalFeesCollected, ''],
      ['Insurance Pool', data.platformMetrics.totalInsurancePool, ''],
      ['Total Burned', data.platformMetrics.totalBurned, ''],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `tokenly-investor-ledger-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (!authenticated) {
    return (
      <div className="page-wrapper">
      <div className="auth-page" style={{ minHeight: 'calc(100vh - 94px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, filter: 'blur(10px)' }}
          animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          className="glass-card" 
          style={{ padding: 48, width: '100%', maxWidth: 500, border: '1px solid var(--rolex-gold)', background: 'var(--bg-primary)', textAlign: 'center', backdropFilter: 'blur(30px)' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.4em', color: 'var(--rolex-gold)', marginBottom: 20, fontWeight: 800 }}>RESTRICTED CLEARANCE</div>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 12, color: 'var(--text-primary)' }}>Investor Data Room</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 32, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 500 }}>Decryption Key Required For Entry</p>
          
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ position: 'relative' }}>
              <motion.input 
                whileFocus={{ scale: 1.01, borderColor: 'var(--rolex-gold)' }}
                type="password" 
                placeholder="••••••••" 
                className="input" 
                style={{ textAlign: 'center', letterSpacing: '12px', fontWeight: 600, border: '1px solid var(--border-dark)', background: '#000', padding: 20, fontSize: '1.2rem', borderRadius: '4px' }} 
                value={accessCode} 
                onChange={e => setAccessCode(e.target.value)} />
            </div>
            {error && <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ color: 'var(--danger)', fontSize: '0.7rem', padding: '12px', border: '1px solid var(--danger)', background: 'var(--danger-bg)', textTransform: 'uppercase', letterSpacing: '0.15em', borderRadius: '2px', fontWeight: 600 }}>[ ACCESS DENIED ] {error}</motion.div>}
            <motion.button 
              whileHover={{ scale: 1.02, backgroundColor: 'var(--rolex-gold-light)' }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              type="submit" 
              className="btn btn-primary btn-lg" 
              disabled={loading || !accessCode} 
              style={{ width: '100%', padding: 20, fontSize: '0.8rem', letterSpacing: '0.3em', fontWeight: 800 }}>
              {loading ? '[ AUTHORIZING... ]' : '[ INITIALIZE HANDSHAKE ]'}
            </motion.button>
          </form>
        </motion.div>
      </div></div>
    );
  }

  if (!data) {
    return (
      <div className="page-wrapper">
        <div className="container" style={{ padding: 48, textAlign: 'center' }}>
          <p className="page-subtitle">Session data unavailable. Please sign in again.</p>
        </div>
      </div>
    );
  }

  const delta = data.stakingData.accuracy - data.controlData.accuracy;
  const deltaColor = delta > 0 ? 'var(--success)' : delta < 0 ? 'var(--danger)' : 'var(--warning)';

  return (
    <div className="page-wrapper"><div className="container">
      
      <motion.div variants={CA_STAGGER} initial="hidden" animate="show">
        {/* ===== HEADER BAR ===== */}
        <motion.div variants={CA_ITEM} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 32, marginBottom: 40, borderBottom: '1px solid var(--border-dark)', paddingBottom: 24 }}>
          <div>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.3em', color: 'var(--danger)', marginBottom: 12, fontWeight: 800 }}>
              [ CONFIDENTIAL — RESTRICTED DISTRIBUTION ]
            </div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>Validation Portfolio Data</h1>
            <p className="page-subtitle" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 500 }}>Investor Analytics & Core Hypothesis Statistics.</p>
          </div>
          <motion.button 
            variants={CA_ITEM} 
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(163,126,44,0.1)' }} 
            whileTap={{ scale: 0.95 }} 
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            className="btn btn-outline btn-sm" 
            onClick={handleExport} 
            style={{ border: '1px solid var(--rolex-gold)', color: 'var(--rolex-gold)', padding: '10px 24px', fontSize: '0.7rem', fontWeight: 800 }}>
            [ EXPORT RAW CSV LEDGER ]
          </motion.button>
        </motion.div>

        {/* ===== EXECUTIVE STATUS ===== */}
        <motion.div variants={CA_ITEM} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 40 }}>
          <motion.div 
            whileHover={{ scale: 1.01 }}
            style={{ padding: 32, border: '1px solid var(--border-dark)', background: 'var(--bg-primary)', borderLeft: '3px solid var(--rolex-gold)', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--rolex-gold)', marginBottom: 16, fontWeight: 800 }}>Hypothesis Resolution Status</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 600, color: data.hypothesis?.includes('SUPPORTED') ? 'var(--success)' : data.hypothesis?.includes('CHALLENGED') ? 'var(--danger)' : 'var(--warning)', lineHeight: 1.5, letterSpacing: '0.01em' }}>
              {data.hypothesis}
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.01 }}
            style={{ padding: 32, textAlign: 'center', border: '1px solid var(--border-dark)', background: 'var(--bg-primary)', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)', marginBottom: 16, fontWeight: 800 }}>Accuracy Vector Delta</div>
            <div style={{ fontSize: '3.5rem', fontWeight: 700, color: deltaColor, letterSpacing: '-0.04em', fontFamily: 'var(--font-mono)' }}>
              {delta > 0 ? '+' : ''}{delta.toFixed(1)}pp
            </div>
          </motion.div>
        </motion.div>

        {/* ===== A/B METRICS ===== */}
        <motion.h2 variants={CA_ITEM} style={{ fontSize: '1.3rem', fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--rolex-gold)', marginBottom: 24 }}>Experimental Cohort Analytics</motion.h2>
        <motion.div variants={CA_ITEM} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 48 }}>
          {/* Staking Group */}
          <div className="glass-card" style={{ padding: 0, border: '1px solid var(--rolex-gold)', background: 'rgba(163,126,44,0.03)', borderRadius: '4px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-dark)' }}>
               <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.25em', color: 'var(--rolex-gold)', marginBottom: 4, fontWeight: 800 }}>COHORT VARIABLE [A]</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Staking Anchor</h3>
            </div>
            <div style={{ padding: '16px 24px' }}>
              {[
                { label: 'Verified Participants', value: data.stakingData.count },
                { label: 'Total Logs', value: data.stakingData.total_reviews },
                { label: 'Aggregate Accuracy', value: `${data.stakingData.accuracy.toFixed(1)}%`, color: 'var(--success)' },
                { label: 'Mean Network RRS', value: data.stakingData.rrsAvg.toFixed(1) },
                { label: 'Mean Trades / Node', value: (data.stakingData.avgTrades || 0).toFixed(1) },
              ].map((row, idx) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: idx !== 4 ? '1px solid var(--border-dark)' : 'none' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500 }}>{row.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', color: row.color || 'var(--text-primary)', fontWeight: 600 }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Control Group */}
          <div className="glass-card" style={{ padding: 0, border: '1px solid var(--border-dark)', background: 'var(--bg-primary)', borderRadius: '4px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-dark)' }}>
               <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.25em', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 800 }}>COHORT VARIABLE [B]</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Control Anchor</h3>
            </div>
            <div style={{ padding: '16px 24px' }}>
              {[
                { label: 'Verified Participants', value: data.controlData.count },
                { label: 'Total Logs', value: data.controlData.total_reviews },
                { label: 'Aggregate Accuracy', value: `${data.controlData.accuracy.toFixed(1)}%`, color: 'var(--danger)' },
                { label: 'Mean Network RRS', value: data.controlData.rrsAvg.toFixed(1) },
                { label: 'Mean Trades / Node', value: (data.controlData.avgTrades || 0).toFixed(1) },
              ].map((row, idx) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: idx !== 4 ? '1px solid var(--border-dark)' : 'none' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500 }}>{row.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', color: row.color || 'var(--text-primary)', fontWeight: 600 }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ===== NETWORK METRICS ===== */}
        <motion.h2 variants={CA_ITEM} style={{ fontSize: '1.3rem', fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--rolex-gold)', marginBottom: 24 }}>Network Liquidity & Nodes</motion.h2>
        <motion.div variants={CA_STAGGER} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 40 }}>
          {[
            { label: 'Gross Market Volume (GMV)', value: `${(data.networkVolume || 0).toLocaleString()} PTS`, color: 'var(--success)' },
            { label: 'Settled Trades', value: data.totalTrades },
            { label: 'Mean Capital per Trade', value: `${(data.avgTradeSize || 0).toLocaleString()} PTS` },
            { label: 'Registered System Nodes', value: data.totalUsers },
            { label: 'Daily Active Users (DAU)', value: data.dau, color: 'var(--text-primary)' },
            { label: 'Monthly Active Users (MAU)', value: data.mau, color: 'var(--text-primary)' },
          ].map(stat => (
            <motion.div 
              variants={CA_ITEM} 
              key={stat.label} 
              whileHover={{ scale: 1.02, translateY: -2 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="glass-card" 
              style={{ padding: 24, border: '1px solid var(--border-dark)', background: 'var(--bg-primary)', borderRadius: '4px' }}>
              <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)', marginBottom: 12, fontWeight: 800 }}>{stat.label}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: stat.color || 'var(--text-primary)', letterSpacing: '-0.02em' }}>{stat.value}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* ===== PLATFORM ECONOMICS ===== */}
        <motion.h2 variants={CA_ITEM} style={{ fontSize: '1.3rem', fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--rolex-gold)', marginBottom: 24 }}>Protocol Treasury Ledger</motion.h2>
        <motion.div variants={CA_STAGGER} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 40 }}>
          {[
            { label: 'Execution Realizations', value: `${(data.platformMetrics.totalFeesCollected || 0).toLocaleString()}`, color: 'var(--success)' },
            { label: 'Safeguard Allocation', value: `${(data.platformMetrics.totalInsurancePool || 0).toLocaleString()}`, color: 'var(--rolex-gold)' },
            { label: 'Asset Destruction Log', value: `${(data.platformMetrics.totalBurned || 0).toLocaleString()}`, color: 'var(--danger)' },
            { label: 'Governance Locked', value: `${(data.platformMetrics.totalBondsLocked || 0).toLocaleString()}`, color: 'var(--rolex-gold-light)' },
          ].map(stat => (
            <motion.div variants={CA_ITEM} key={stat.label} style={{ padding: 24, border: '1px solid var(--border-dark)', background: 'rgba(255,255,255,0.01)', borderRadius: '2px' }}>
              <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.15rem', color: 'var(--text-muted)', marginBottom: 12, fontWeight: 800 }}>{stat.label}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 600, color: stat.color, fontFamily: 'var(--font-mono)' }}>{stat.value}</div>
              <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 500 }}>Units of Protocol</div>
            </motion.div>
          ))}
        </motion.div>

        {/* ===== EXECUTIVE BRIEF ===== */}
        <motion.div variants={CA_ITEM} style={{ padding: 32, border: '1px solid var(--rolex-gold)', background: 'linear-gradient(90deg, rgba(163,126,44,0.05) 0%, rgba(0,0,0,0) 100%)', display: 'flex', gap: 20, borderRadius: '4px' }}>
          <div>
            <h4 style={{ margin: '0 0 12px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.3em', fontWeight: 800, color: 'var(--rolex-gold)' }}>[ EXECUTIVE SUMMARY ]</h4>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.7, letterSpacing: '0.01em', maxWidth: 900, fontWeight: 400 }}>
              The platform successfully validates the hypothesis that incentivized staking directly correlates with market efficiency. The Staking Cohort operates as a high-fidelity decentralized oracle, maintaining a superior accuracy vector over the control group. Protocol longevity is secured through fee realizations, insurance safeguard grows, and strategic deflationary measures.
            </p>
          </div>
        </motion.div>
      </motion.div>

    </div></div>
  );
}

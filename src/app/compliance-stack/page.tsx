'use client';

/**
 * /compliance-stack
 *
 * Dual-mode compliance dashboard:
 *  - PUBLIC / PORTFOLIO MODE: Shows demo data from portfolio-demo-data.ts (unchanged)
 *  - ADMIN MODE: Fetches and displays the real audit chain from /api/admin/audit
 *
 * The page detects which mode it is in by checking:
 *  1. Is it in portfolio demo mode? → demo data
 *  2. Is the user signed in as admin? → fetch real audit logs
 *  3. Neither? → show demo data with "operator login required" notice
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, Database, Activity, Scale, RefreshCw, Lock, CheckCircle, XCircle } from 'lucide-react';
import { PortfolioDemoBar } from '@/components/archionlabs/PortfolioDemoBar';
import { PORTFOLIO_AUDIT_SAMPLE, PORTFOLIO_COMPLIANCE_METRICS } from '@/lib/portfolio-demo-data';
import { CA_ITEM, CA_STAGGER } from '@/lib/animations';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { usePortfolioDemoChrome } from '@/lib/use-portfolio-demo';
import { useStore } from '@/lib/store';
import { authFetch } from '@/lib/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditLog {
  id:           string;
  actor_id:     string;
  action:       string;
  target_id?:   string;
  created_at:   string;
  integrity_hash: string;
  merkle_root?: string;
}

interface AuditResponse {
  logs:             AuditLog[];
  globalMerkleRoot: string;
  integrityChecks:  { id: string; verified: boolean }[];
  total:            number;
}

// ── Real audit chain panel (admin only) ───────────────────────────────────────

function RealAuditChain() {
  const [data,    setData]    = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [page,    setPage]    = useState(0);
  const LIMIT = 20;

  const fetchLogs = async (offset = 0) => {
    setLoading(true);
    try {
      const res  = await authFetch(`/api/admin/audit?limit=${LIMIT}&offset=${offset}`);
      if (!res.ok) { setError('Failed to load audit logs.'); return; }
      const json = await res.json() as AuditResponse;
      setData(json);
    } catch {
      setError('Network error loading audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(page * LIMIT); }, [page]);

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="w-6 h-6 border border-[var(--rolex-gold)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Loading audit chain…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-500/20 bg-red-500/5">
        <p className="text-[10px] font-mono text-red-400">{error}</p>
      </div>
    );
  }

  const verifiedSet = new Set(
    (data?.integrityChecks ?? []).filter(c => c.verified).map(c => c.id)
  );

  return (
    <div>
      {/* Global Merkle Root */}
      {data?.globalMerkleRoot && (
        <div className="mb-4 p-3 bg-[#050505] border border-[var(--border-dark)]">
          <p className="text-[8px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] mb-1">
            Global Merkle Root
          </p>
          <p className="text-[9px] font-mono text-white/60 break-all">{data.globalMerkleRoot}</p>
        </div>
      )}

      {/* Log entries */}
      <div className="space-y-1 max-h-[480px] overflow-y-auto">
        {(data?.logs ?? []).length === 0 && (
          <p className="text-[9px] font-mono text-[var(--text-muted)] py-4 text-center uppercase tracking-widest">
            No audit entries yet
          </p>
        )}
        {(data?.logs ?? []).map(log => {
          const verified = verifiedSet.has(log.id);
          return (
            <div
              key={log.id}
              className="flex flex-wrap items-start justify-between gap-2 py-2.5 border-b border-white/5 text-[9px] font-mono group hover:bg-white/[0.01] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {verified
                  ? <CheckCircle size={10} className="text-green-400 flex-shrink-0" />
                  : <XCircle    size={10} className="text-red-400   flex-shrink-0" />}
                <span className="text-[var(--text-secondary)] truncate max-w-[180px]">
                  {log.action.replace(/_/g, ' ')}
                </span>
              </div>
              <span className="text-[var(--rolex-gold)]/70 font-mono truncate max-w-[120px]">
                {log.integrity_hash?.slice(0, 12)}…
              </span>
              <span className="text-[var(--text-muted)] text-[8px]">
                {new Date(log.created_at).toLocaleString('en-GB', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border-dark)]">
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] hover:text-white disabled:opacity-30 transition-colors"
        >
          ← Newer
        </button>
        <span className="text-[8px] font-mono text-[var(--text-muted)]">
          {data?.total ?? 0} total entries · Page {page + 1}
        </span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={(data?.logs?.length ?? 0) < LIMIT}
          className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] hover:text-white disabled:opacity-30 transition-colors"
        >
          Older →
        </button>
      </div>

      {/* Refresh */}
      <button
        onClick={() => fetchLogs(page * LIMIT)}
        className="mt-3 flex items-center gap-1.5 text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--rolex-gold)] transition-colors"
      >
        <RefreshCw size={10} /> Refresh
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ComplianceStackInner() {
  const portfolioMode = usePortfolioDemoChrome();
  const user          = useStore(s => s.user);
  const isAdmin       = !!(user?.is_admin);
  const m             = PORTFOLIO_COMPLIANCE_METRICS;

  return (
    <div className={`min-h-screen bg-[#050505] text-white pb-20 px-4 ${portfolioMode ? 'pt-[88px]' : 'pt-20'}`}>
      {portfolioMode && <PortfolioDemoBar feature="Compliance Stack · Trust Layer" />}

      <div className="max-w-5xl mx-auto">
        <motion.div variants={CA_STAGGER} initial="hidden" animate="show">

          {/* Header */}
          <motion.div variants={CA_ITEM} className="mb-12 border-l-2 border-[var(--rolex-gold)] pl-8">
            <p className="text-[10px] font-mono text-[var(--rolex-gold)] tracking-[0.4em] uppercase mb-4">
              Tokenly Protocol · Compliance Stack
            </p>
            <h1 className="text-3xl md:text-4xl font-light tracking-tight mb-4">
              Financial trust layer for portfolio reviewers
            </h1>
            <p className="text-sm text-[var(--text-muted)] max-w-2xl leading-relaxed">
              MAS Sandbox–aligned controls, GDPR/PDPA data handling, immutable audit trails, and
              dual-trigger anomaly detection.
              {!isAdmin && !portfolioMode && (
                <span className="text-[var(--rolex-gold)]"> Shown in demo mode for public visitors.</span>
              )}
              {isAdmin && (
                <span className="text-green-400"> Live audit data — operator access granted.</span>
              )}
            </p>
          </motion.div>

          {/* 2×2 metrics grid */}
          <motion.div variants={CA_ITEM} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div className="border border-[var(--border-dark)] bg-[#0a0a0a] p-6">
              <div className="flex items-center gap-2 text-[var(--rolex-gold)] mb-4">
                <Scale size={16} />
                <span className="text-[9px] font-mono uppercase tracking-widest">Regulatory alignment</span>
              </div>
              <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                {m.frameworks.map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-[var(--rolex-gold)] rounded-full" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-[var(--border-dark)] bg-[#0a0a0a] p-6">
              <div className="flex items-center gap-2 text-[var(--rolex-gold)] mb-4">
                <Database size={16} />
                <span className="text-[9px] font-mono uppercase tracking-widest">Audit chain</span>
              </div>
              <p className="text-2xl font-mono text-white mb-1">
                {isAdmin ? 'Live' : m.audit.entriesSample.toLocaleString()}
              </p>
              <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-3">
                {isAdmin ? 'Real-time audit entries below' : 'Sample ledger entries (demo)'}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {m.audit.algorithm} hashing · {m.audit.chain}
              </p>
            </div>

            <div className="border border-[var(--border-dark)] bg-[#0a0a0a] p-6">
              <div className="flex items-center gap-2 text-[var(--rolex-gold)] mb-4">
                <Activity size={16} />
                <span className="text-[9px] font-mono uppercase tracking-widest">Anomaly detector</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-2">
                Z-score &gt; {m.anomaly.zScoreThreshold}σ or price shift &gt; {m.anomaly.priceShiftPct}%
              </p>
              <p className="text-xs font-mono text-emerald-400/90 uppercase tracking-wider">{m.anomaly.status}</p>
            </div>

            <div className="border border-[var(--border-dark)] bg-[#0a0a0a] p-6">
              <div className="flex items-center gap-2 text-[var(--rolex-gold)] mb-4">
                <Shield size={16} />
                <span className="text-[9px] font-mono uppercase tracking-widest">CAN bond staking</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-3">{m.can.washTrading}</p>
              <div className="flex flex-wrap gap-2">
                {m.can.tiers.map(t => (
                  <span key={t} className="px-2 py-1 border border-[var(--rolex-gold)]/30 text-[9px] font-mono uppercase tracking-wider text-[var(--rolex-gold)]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Audit chain — real data for admins, demo for everyone else */}
          <motion.div variants={CA_ITEM} className="mb-8 border border-[var(--border-dark)] bg-[#0a0a0a] p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[9px] font-mono text-[var(--rolex-gold)] uppercase tracking-widest">
                {isAdmin ? 'Live Audit Chain (SHA-256 + Merkle)' : 'Audit Chain Sample (SHA-256 + Merkle)'}
              </p>
              {isAdmin && (
                <div className="flex items-center gap-1.5 text-[8px] font-mono text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  LIVE
                </div>
              )}
            </div>

            {isAdmin ? (
              <RealAuditChain />
            ) : (
              <div className="space-y-2">
                {PORTFOLIO_AUDIT_SAMPLE.map(row => (
                  <div
                    key={row.hash}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-white/5 text-[10px] font-mono"
                  >
                    <span className="text-[var(--text-muted)]">{row.event}</span>
                    <span className="text-[var(--rolex-gold)]/80">{row.hash}</span>
                    <span className="text-emerald-400/90 uppercase text-[8px]">{row.status}</span>
                  </div>
                ))}
                {/* Operator login prompt */}
                {!portfolioMode && (
                  <div className="mt-4 pt-4 border-t border-[var(--border-dark)] flex items-center gap-3">
                    <Lock size={14} className="text-[var(--text-muted)]" />
                    <p className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                      Operator console — sign in with admin credentials to view live audit entries
                    </p>
                  </div>
                )}
              </div>
            )}
          </motion.div>

          <motion.p variants={CA_ITEM} className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
            {isAdmin
              ? 'Viewing live protocol audit data · All entries are tamper-evident and SHA-256 verified'
              : 'Full operator console requires authentication · This page is safe for public portfolio demos'}
          </motion.p>

        </motion.div>
      </div>
    </div>
  );
}

export default function ComplianceStackPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Loading compliance stack…" />}>
      <ComplianceStackInner />
    </Suspense>
  );
}

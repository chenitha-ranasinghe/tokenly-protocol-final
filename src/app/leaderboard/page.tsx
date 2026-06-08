'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CA_STAGGER, CA_ITEM_HERO, CA_ITEM, CA_STAGGER_FAST } from '@/lib/animations';
import { Activity, Search, ChevronLeft, ChevronRight, Crown, Shield, Users, TrendingUp, Zap } from 'lucide-react';
import { SkeletonTable } from '@/components/PageSkeleton';
import { authFetch } from '@/lib/client';
import { useStore } from '@/lib/store';

// ─── Types ─────────────────────────────────────────────────────────────────
interface LeaderboardEntry {
  id:               string;
  name:             string;
  email:            string;
  rrs_score:        number;
  tier:             string;
  total_reviews:    number;
  accurate_reviews: number;
  points:           number;
  experiment_group: string;
  rank:             number;
  accuracy:         string; // e.g. "82.5"
}

interface NetworkSummary {
  totalNodes: number;
  avgRRS:     number;
  topTier:    number; // count of Verified Elite
  totalPts:   number;
}

// ─── Tier colour map ────────────────────────────────────────────────────────
const TIER_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  'Verified Elite': { color: '#a37e2c', bg: 'rgba(163,126,44,0.1)',  border: 'rgba(163,126,44,0.5)' },
  'Senior Node':    { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.35)' },
  'Active Oracle':  { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.35)' },
  'Junior Reviewer':{ color: '#6b7280', bg: 'rgba(107,114,128,0.07)',border: 'rgba(107,114,128,0.3)' },
  'Initiate':       { color: '#374151', bg: 'transparent',            border: 'rgba(55,65,81,0.5)'   },
};

function getTierConfig(tier: string) {
  return TIER_CONFIG[tier] ?? TIER_CONFIG['Initiate'];
}

// ─── RRS colour helper ──────────────────────────────────────────────────────
function getRRSColor(score: number): string {
  if (score >= 85) return '#a37e2c';
  if (score >= 70) return '#22c55e';
  if (score >= 50) return '#3b82f6';
  return '#6b7280';
}

// ─── Rank icon / display ────────────────────────────────────────────────────
function RankDisplay({ rank }: { rank: number }) {
  if (rank === 1) return <Crown size={14} className="text-[var(--rolex-gold)]" />;
  if (rank === 2) return <span className="text-[11px] font-mono font-bold text-[#adb5bd]">02</span>;
  if (rank === 3) return <span className="text-[11px] font-mono font-bold text-[#8b7355]">03</span>;
  return <span className="text-[10px] font-mono text-[var(--text-muted)]">{String(rank).padStart(2, '0')}</span>;
}

// ─── Mini RRS Progress Bar ──────────────────────────────────────────────────
function RRSBar({ score }: { score: number }) {
  const color = getRRSColor(score);
  const pct   = Math.min((score / 100) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1 bg-[#0A0A0A] overflow-hidden flex-shrink-0">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
          className="h-full"
          style={{ background: color }}
        />
      </div>
      <span className="text-sm font-mono font-bold tracking-tighter" style={{ color }}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

const PAGE_SIZE = 15;

export default function LeaderboardPage() {
  const [entries,  setEntries]  = useState<LeaderboardEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [gf,       setGf]       = useState('all');
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);
  const [summary,  setSummary]  = useState<NetworkSummary | null>(null);
  const router = useRouter();
  const user   = useStore(s => s.user);

  useEffect(() => {
    if (!user) { router.push('/'); return; }
    authFetch('/api/leaderboard')
      .then(r => { if (r.status === 401) { router.push('/'); return null; } return r.json(); })
      .then(d => {
        if (!d) return;
        const all: LeaderboardEntry[] = d.leaderboard || [];
        setEntries(all);
        // Derive network summary from data
        if (all.length > 0) {
          setSummary({
            totalNodes: all.length,
            avgRRS:     parseFloat((all.reduce((sum, e) => sum + (e.rrs_score ?? 0), 0) / all.length).toFixed(1)),
            topTier:    all.filter(e => e.tier === 'Verified Elite').length,
            totalPts:   all.reduce((sum, e) => sum + (e.points ?? 0), 0),
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user, router]);

  const filtered = useMemo(() => {
    let list = entries;
    if (gf !== 'all') list = list.filter(e => e.experiment_group === gf);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q));
    }
    return list;
  }, [entries, gf, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white pt-20 pb-20 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto"><SkeletonTable rows={12} /></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pt-8 pb-16 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div variants={CA_STAGGER} initial="hidden" animate="show">

          {/* ── Page header ─────────────────────────────────────────── */}
          <motion.div variants={CA_ITEM_HERO}
            className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-dark)] pb-8 mb-8"
          >
            <div className="max-w-2xl">
              <p className="text-[8px] font-mono tracking-[0.25em] text-[var(--rolex-gold)] mb-3 font-bold uppercase flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[var(--rolex-gold)] rounded-full animate-pulse" />
                Global Governance Rankings
              </p>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tighter text-white mb-3 uppercase leading-none">
                Leaderboard Index
              </h1>
              <p className="text-[9px] font-mono tracking-widest uppercase text-[var(--text-muted)] leading-relaxed">
                Ranked strictly by verified Node Reputation Score (RRS) and Proof of Fidelity.
              </p>
            </div>
            <div className="bg-[#0A0A0A] border border-[var(--border-dark)] border-l-2 border-l-[var(--rolex-gold)] p-5 max-w-xs w-full flex-shrink-0">
              <p className="text-[7px] font-mono uppercase tracking-[0.2em] text-[var(--rolex-gold)] mb-2 font-bold">Algorithm Architecture</p>
              <p className="text-[10px] font-mono text-white/65 leading-relaxed tracking-wide">
                RRS = (ACC × 0.45) + (VOL × 0.25) + (CONS × 0.30)
              </p>
            </div>
          </motion.div>

          {/* ── Network summary strip ────────────────────────────── */}
          {summary && (
            <motion.div variants={CA_ITEM} className="mb-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border-dark)] border border-[var(--border-dark)]">
                {[
                  { icon: <Users size={12}/>,    label: 'Active Nodes',    value: summary.totalNodes.toLocaleString() },
                  { icon: <Activity size={12}/>,  label: 'Network Avg RRS', value: summary.avgRRS.toFixed(1), color: getRRSColor(summary.avgRRS) },
                  { icon: <Shield size={12}/>,    label: 'Verified Elite',  value: String(summary.topTier), color: '#a37e2c' },
                  { icon: <Zap size={12}/>,       label: 'Total Treasury',  value: summary.totalPts.toLocaleString() + ' PTS', color: '#a37e2c' },
                ].map((s, i) => (
                  <div key={i} className="bg-[#050505] p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-[7px] font-mono uppercase tracking-widest text-[var(--text-muted)] font-bold">
                      <span className={s.color ? '' : 'text-[var(--text-muted)]'} style={{ color: s.color }}>{s.icon}</span>
                      {s.label}
                    </div>
                    <p className="text-xl font-mono font-bold tracking-tighter"
                      style={{ color: s.color || 'white' }}>
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Filters ─────────────────────────────────────────── */}
          <motion.div variants={CA_ITEM} className="flex flex-col md:flex-row justify-between gap-4 mb-6">
            <div className="flex flex-wrap gap-0 bg-[#0A0A0A] border border-[var(--border-dark)]">
              {[
                { id: 'all',     label: 'Global Index' },
                { id: 'staking', label: 'Staking Arm'  },
                { id: 'control', label: 'Control Arm'  },
              ].map(g => (
                <button key={g.id}
                  suppressHydrationWarning
                  onClick={() => { setGf(g.id); setPage(1); }}
                  className={`px-6 py-3 text-[9px] font-bold font-mono tracking-widest uppercase transition-all ${
                    gf === g.id ? 'bg-white text-black' : 'text-[var(--text-muted)] hover:text-white'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div className="relative w-full md:max-w-xs">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                suppressHydrationWarning
                placeholder="Search node / identity..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full bg-[#0A0A0A] border border-[var(--border-dark)] pl-11 pr-4 py-3 text-[10px] font-mono text-white placeholder-[var(--text-muted)] uppercase tracking-widest focus:outline-none focus:border-[var(--rolex-gold)] transition-colors"
              />
            </div>
          </motion.div>

          {/* ── Table ───────────────────────────────────────────── */}
          {filtered.length === 0 ? (
            <motion.div variants={CA_ITEM}
              className="py-28 text-center border border-dashed border-[var(--border-dark)]"
            >
              <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-[0.3em]">
                [ No verified oracles detected ]
              </p>
            </motion.div>
          ) : (
            <motion.div variants={CA_ITEM}
              className="border border-[var(--border-dark)] bg-[#050505] overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0A0A0A] border-b border-[var(--border-dark)]">
                      {['Rank', 'Node Identity', 'Authority Tier', 'RRS Index', 'Reviews', 'Accuracy', 'Treasury'].map((h, i) => (
                        <th key={h} className={`px-5 py-4 text-[8px] font-mono font-bold tracking-[0.18em] text-[var(--text-muted)] uppercase ${
                          i === 0 ? 'text-center w-20' : i === 6 ? 'text-right' : ''
                        }`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {paginated.map((e, i) => {
                        const tierCfg    = getTierConfig(e.tier);
                        const isAdmin    = e.email?.toLowerCase() === 'admin@tokenly.luxury';
                        const isTop      = e.rank === 1;
                        const isCurrentUser = e.email === user?.email;
                        const accNum     = parseFloat(e.accuracy) || 0;

                        return (
                          <motion.tr
                            layout
                            key={e.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: i * 0.025, type: 'spring', stiffness: 280, damping: 28 }}
                            className={`border-b border-[var(--border-dark)] transition-colors ${
                              isCurrentUser ? 'bg-[var(--rolex-gold)]/5' :
                              isTop         ? 'bg-[var(--rolex-gold)]/3' :
                              'hover:bg-white/[0.02]'
                            }`}
                          >
                            {/* Rank */}
                            <td className="px-5 py-5 text-center align-middle">
                              <div className={`inline-flex items-center justify-center w-8 h-8 border ${
                                isTop
                                  ? 'bg-[var(--rolex-gold)] border-[var(--rolex-gold)] text-black'
                                  : 'bg-[#0A0A0A] border-[var(--border-dark)]'
                              }`}>
                                <RankDisplay rank={e.rank} />
                              </div>
                            </td>

                            {/* Identity */}
                            <td className="px-5 py-5">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 flex items-center justify-center text-[10px] font-bold font-mono border flex-shrink-0 ${
                                  isAdmin
                                    ? 'bg-red-500/10 border-red-500/30 text-red-500'
                                    : 'bg-[#0A0A0A] border-[var(--border-dark)] text-[var(--rolex-gold)]'
                                }`}>
                                  {e.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className={`text-[12px] font-bold font-mono tracking-tight ${
                                    isAdmin ? 'text-red-500' :
                                    isTop   ? 'text-[var(--rolex-gold)]' :
                                    isCurrentUser ? 'text-[var(--rolex-gold)]/80' : 'text-white'
                                  }`}>
                                    {e.name}
                                    {isCurrentUser && <span className="ml-2 text-[7px] text-[var(--rolex-gold)] font-mono">YOU</span>}
                                  </p>
                                  <p className="text-[8px] text-[var(--text-muted)] font-mono uppercase tracking-widest mt-0.5">
                                    {isAdmin ? 'Administrator' : `${e.experiment_group} Class`}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Tier badge */}
                            <td className="px-5 py-5">
                              <span
                                className="text-[8px] font-bold font-mono tracking-widest uppercase border px-2.5 py-1"
                                style={{ color: tierCfg.color, background: tierCfg.bg, borderColor: tierCfg.border }}
                              >
                                {e.tier.toUpperCase()}
                              </span>
                            </td>

                            {/* RRS with progress bar */}
                            <td className="px-5 py-5">
                              <RRSBar score={e.rrs_score ?? 0} />
                            </td>

                            {/* Review volume */}
                            <td className="px-5 py-5 text-[10px] font-mono text-[var(--text-muted)] tracking-widest">
                              {e.total_reviews}
                            </td>

                            {/* Accuracy with bar */}
                            <td className="px-5 py-5">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1 bg-[#0A0A0A] overflow-hidden flex-shrink-0 hidden sm:block">
                                  <div
                                    className={`h-full ${accNum >= 80 ? 'bg-[var(--success)]' : 'bg-white/20'}`}
                                    style={{ width: `${accNum}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold font-mono tracking-widest">
                                  {e.accuracy}%
                                </span>
                              </div>
                            </td>

                            {/* Treasury */}
                            <td className="px-5 py-5 text-right">
                              <p className="text-sm font-bold font-mono tracking-tighter text-white">
                                {(e.points ?? 0).toLocaleString()}
                              </p>
                              <p className="text-[7px] font-mono text-[var(--text-muted)] uppercase tracking-widest">PTS</p>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center px-5 py-4 border-t border-[var(--border-dark)] bg-[#0A0A0A]">
                  <p className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                    Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex gap-2">
                    <button suppressHydrationWarning
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 border border-[var(--border-dark)] text-white disabled:opacity-30 hover:bg-white/5 transition-colors"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <button suppressHydrationWarning
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 border border-[var(--border-dark)] text-white disabled:opacity-30 hover:bg-white/5 transition-colors"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Bottom CTA ──────────────────────────────────────── */}
          <motion.div variants={CA_ITEM} className="mt-14 text-center border-t border-[var(--border-dark)] pt-14">
            <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-8">
              Your rank is governed by the Protocol Integrity Index — earned, never purchased.
            </p>
            <button suppressHydrationWarning
              onClick={() => router.push('/dashboard')}
              className="px-12 py-5 bg-white text-black text-[10px] font-bold font-mono tracking-[0.3em] uppercase hover:bg-[var(--rolex-gold)] transition-all duration-300"
            >
              Elevate My Rank →
            </button>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
}

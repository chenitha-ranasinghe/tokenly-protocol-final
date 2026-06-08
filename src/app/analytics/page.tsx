'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar,
  AreaChart, Area,
} from 'recharts';
import {
  CA_STAGGER, CA_ITEM, CA_ITEM_HERO,
} from '@/lib/animations';
import {
  Activity, Globe, Database, Zap, TrendingUp, PieChart as PieIcon,
  ArrowRight, Download, Cpu,
} from 'lucide-react';
import { SkeletonTable } from '@/components/PageSkeleton';
import { authFetch } from '@/lib/client';
import { useStore } from '@/lib/store';

// ─── Types ─────────────────────────────────────────────────────────────────
interface GroupStats {
  users: number; reviews: number; accuracy_rate: number;
  avg_stake?: number; avg_rrs: number;
}
interface ConsensusShift {
  brand: string; name: string;
  initial_consensus: number; consensus_price: number; shift_pct: number;
  total_reviews: number;
}
interface TierEntry { tier: string; count: number; }
interface Overall {
  total_users: number; total_reviews: number;
  products_reviewed: number; total_points_staked: number;
}

// ─── Chart colour tokens ────────────────────────────────────────────────────
const GOLD   = '#a37e2c';
const SILVER = '#374151';
const SUCCESS= '#22c55e';
const BLUE   = '#3b82f6';
const PURPLE = '#8b5cf6';
const TIER_COLORS = ['#a37e2c', '#6b7280', '#22c55e', '#3b82f6', '#8b5cf6'];

// ─── Custom recharts tooltip ────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0A0A0A] border border-[var(--border-dark)] px-4 py-3 shadow-xl">
      {label && <p className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-2">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-3 text-[10px] font-mono">
          <span className="w-2 h-2 inline-block flex-shrink-0" style={{ background: p.fill }} />
          <span className="text-[var(--text-muted)]">{p.name}:</span>
          <span className="text-white font-bold">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Section divider ────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div>
        <h2 className="text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-white m-0">{title}</h2>
        {subtitle && <p className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-widest mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex-1 h-px bg-[var(--border-dark)]" />
    </div>
  );
}

export default function AnalyticsPage() {
  const [overall, setOverall]   = useState<Partial<Overall>>({});
  const [s, setS]               = useState<GroupStats | null>(null);
  const [c, setC]               = useState<GroupStats | null>(null);
  const [consensusShift, setCS] = useState<ConsensusShift[]>([]);
  const [tierDist, setTierDist] = useState<TierEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [insight, setInsight]   = useState('');
  const router = useRouter();
  const user   = useStore(st => st.user);

  useEffect(() => {
    if (!user) { router.push('/'); return; }
    authFetch('/api/analytics')
      .then(r => { if (r.status === 401) { router.push('/'); return null; } return r.json(); })
      .then(d => {
        if (!d) return;
        setOverall(d.overall || {});
        setS(d.staking || null);
        setC(d.control || null);
        setCS(d.consensusShift || []);
        setTierDist(d.tierDistribution || []);
        setInsight(d.experimentInsight || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user, router]);

  const handleExport = () => {
    const csv = [
      ['metric', 'staking_arm', 'control_arm'],
      ['oracle_density', s?.users ?? 0, c?.users ?? 0],
      ['log_volume',     s?.reviews ?? 0, c?.reviews ?? 0],
      ['accuracy_rate',  s?.accuracy_rate ?? 0, c?.accuracy_rate ?? 0],
      ['avg_rrs',        s?.avg_rrs ?? 0, c?.avg_rrs ?? 0],
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: 'tokenly_analytics.csv' }).click();
    URL.revokeObjectURL(url);
  };

  // ── Derived chart datasets ─────────────────────────────────────────────
  const abComparisonData = useMemo(() => {
    if (!s && !c) return [];
    return [
      {
        metric:   'Accuracy %',
        Staking:  parseFloat((s?.accuracy_rate ?? 0).toFixed(1)),
        Control:  parseFloat((c?.accuracy_rate ?? 0).toFixed(1)),
      },
      {
        metric:   'Avg RRS',
        Staking:  parseFloat((s?.avg_rrs ?? 0).toFixed(2)),
        Control:  parseFloat((c?.avg_rrs ?? 0).toFixed(2)),
      },
      {
        metric:   'Reviews (÷10)',
        Staking:  Math.round((s?.reviews ?? 0) / 10),
        Control:  Math.round((c?.reviews ?? 0) / 10),
      },
      {
        metric:   'Nodes',
        Staking:  s?.users ?? 0,
        Control:  c?.users ?? 0,
      },
    ];
  }, [s, c]);

  const tierChartData = useMemo(() =>
    tierDist.map((t, i) => ({ name: t.tier, value: t.count, fill: TIER_COLORS[i % TIER_COLORS.length] })),
  [tierDist]);

  const shiftAreaData = useMemo(() =>
    consensusShift.slice(0, 10).map(p => ({
      name:    p.name.slice(0, 18),
      initial: p.initial_consensus,
      current: p.consensus_price,
      shift:   Math.abs(p.shift_pct),
    })),
  [consensusShift]);

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white pt-24 pb-20 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto">
        <SkeletonTable rows={6} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pt-8 pb-20 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div variants={CA_STAGGER} initial="hidden" animate="show" className="space-y-8">

          {/* ── Page header ─────────────────────────────────────────── */}
          <motion.div variants={CA_ITEM_HERO}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-dark)] pb-8">
              <div>
                <p className="text-[8px] font-mono tracking-[0.3em] text-[var(--rolex-gold)] mb-3 font-bold uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[var(--rolex-gold)] rounded-full animate-pulse" />
                  NETWORK INTELLIGENCE MATRIX
                </p>
                <h1 className="text-4xl md:text-6xl font-bold tracking-tighter text-white mb-3 uppercase leading-none">
                  Analytics Hub
                </h1>
                <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                  Real-time protocol data · A/B oracle experiment · Consensus fluidity analysis
                </p>
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleExport}
                  className="flex items-center gap-2 px-5 py-2.5 border border-[var(--rolex-gold)]/40 text-[var(--rolex-gold)] text-[9px] font-mono font-bold uppercase tracking-widest hover:bg-[var(--rolex-gold)]/10 transition-colors"
                >
                  <Download size={12} /> Export CSV
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* ── Neural synthesis verdict ──────────────────────────── */}
          {insight && (
            <motion.div variants={CA_ITEM}
              className="border border-[var(--border-dark)] border-l-4 border-l-[var(--rolex-gold)] bg-gradient-to-r from-[var(--rolex-gold)]/5 to-transparent p-6 relative overflow-hidden"
            >
              <Cpu size={40} className="absolute top-4 right-4 text-[var(--rolex-gold)] opacity-8" />
              <p className="text-[7px] font-mono uppercase tracking-[0.3em] text-[var(--rolex-gold)] mb-3 font-bold">Neural Synthesis Verdict</p>
              <p className="text-base font-medium text-white leading-relaxed max-w-4xl">{insight}</p>
              <div className="flex gap-8 mt-5 pt-5 border-t border-[var(--border-dark)]">
                {[
                  { label: 'Consensus Agreement',
                    value: overall.total_reviews ? `${((Number(overall.products_reviewed||0)/Math.max(Number(overall.total_reviews),1))*100).toFixed(1)}%` : '—' },
                  { label: 'Oracle Density',
                    value: `${Number(overall.total_users||0)} Nodes` },
                  { label: 'Network Status',
                    value: Number(overall.total_users||0) > 0 ? 'OPERATIONAL' : 'IDLE' },
                  { label: 'Total Staked',
                    value: Number(overall.total_points_staked||0).toLocaleString() + ' PTS' },
                ].map(stat => (
                  <div key={stat.label}>
                    <p className="text-[7px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-1 font-bold">{stat.label}</p>
                    <p className="text-sm font-mono font-bold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Global aggregate stats ────────────────────────────── */}
          <motion.div variants={CA_ITEM}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border-dark)] border border-[var(--border-dark)]">
              {[
                { label: 'Network Nodes',      value: Number(overall.total_users||0).toLocaleString(),         icon: <Globe size={13}/> },
                { label: 'Verification Logs',  value: Number(overall.total_reviews||0).toLocaleString(),       icon: <Activity size={13}/> },
                { label: 'Protocol Coverage',  value: `${Number(overall.products_reviewed||0)}/30`,             icon: <Database size={13}/> },
                { label: 'Total Staked Value', value: Number(overall.total_points_staked||0).toLocaleString(), icon: <Zap size={13}/>, highlight: true },
              ].map((stat, i) => (
                <div key={i} className="bg-[#050505] p-5 flex flex-col justify-between gap-3">
                  <div className="flex items-center gap-2 text-[7px] font-mono uppercase tracking-widest text-[var(--text-muted)] font-bold">
                    <span className={stat.highlight ? 'text-[var(--rolex-gold)]' : 'text-[var(--text-muted)]'}>{stat.icon}</span>
                    {stat.label}
                  </div>
                  <p className={`text-2xl font-mono font-bold tracking-tighter ${stat.highlight ? 'text-[var(--rolex-gold)]' : 'text-white'}`}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── A/B GROUP COMPARISON BAR CHART ───────────────────── */}
          <motion.div variants={CA_ITEM}>
            <SectionHeader title="Behavioral Vectors · A/B Experiment" subtitle="Staking Oracle arm vs Control Node arm" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Bar chart */}
              <div className="bg-[#050505] border border-[var(--border-dark)] p-5">
                <p className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-4 font-bold">Key Metric Comparison</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={abComparisonData} barGap={4} barCategoryGap="30%"
                    margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="metric" tick={{ fill: '#6b7280', fontSize: 8, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 8, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                    <Bar dataKey="Staking" name="Staking Oracle" fill={GOLD}    radius={[2,2,0,0]} />
                    <Bar dataKey="Control" name="Control Node"   fill={SILVER}  radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-3">
                  <span className="flex items-center gap-1.5 text-[8px] font-mono text-[var(--text-muted)]">
                    <span className="w-3 h-2 inline-block" style={{ background: GOLD }} /> Staking Oracle [A]
                  </span>
                  <span className="flex items-center gap-1.5 text-[8px] font-mono text-[var(--text-muted)]">
                    <span className="w-3 h-2 inline-block bg-[#374151]" /> Control Node [B]
                  </span>
                </div>
              </div>

              {/* Detailed metric cards */}
              <div className="grid grid-cols-1 gap-px bg-[var(--border-dark)] border border-[var(--border-dark)]">
                {[
                  { label: 'Accuracy Index', sVal: `${Number(s?.accuracy_rate ?? 0).toFixed(1)}%`, cVal: `${Number(c?.accuracy_rate ?? 0).toFixed(1)}%`, highlight: true },
                  { label: 'Avg RRS Score',  sVal: Number(s?.avg_rrs ?? 0).toFixed(2),            cVal: Number(c?.avg_rrs ?? 0).toFixed(2) },
                  { label: 'Oracle Density', sVal: String(s?.users ?? '—'),                        cVal: String(c?.users ?? '—') },
                  { label: 'Log Volume',     sVal: String(s?.reviews ?? '—'),                      cVal: String(c?.reviews ?? '—') },
                  { label: 'Mean Stake',     sVal: `${Math.round(Number(s?.avg_stake ?? 0))} PTS`, cVal: 'N/A' },
                ].map((row, i) => (
                  <div key={i} className="bg-[#050505] grid grid-cols-3 items-center px-4 py-3">
                    <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest font-bold">{row.label}</span>
                    <span className={`text-[10px] font-mono font-bold text-center ${row.highlight ? 'text-[var(--rolex-gold)]' : 'text-white'}`}>{row.sVal}</span>
                    <span className="text-[10px] font-mono font-bold text-white text-right">{row.cVal}</span>
                  </div>
                ))}
                {/* Column labels */}
                <div className="bg-[#0A0A0A] grid grid-cols-3 px-4 py-2">
                  <span />
                  <span className="text-[7px] font-mono text-[var(--rolex-gold)] uppercase tracking-widest text-center font-bold">STAKING [A]</span>
                  <span className="text-[7px] font-mono text-[var(--text-muted)] uppercase tracking-widest text-right font-bold">CONTROL [B]</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── AUTHORITY DISTRIBUTION PIE CHART ─────────────────── */}
          {tierChartData.length > 0 && (
            <motion.div variants={CA_ITEM}>
              <SectionHeader title="Authority Distribution" subtitle="Node tier concentration across the network" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Pie chart */}
                <div className="bg-[#050505] border border-[var(--border-dark)] p-5">
                  <p className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-4 font-bold">Tier Distribution</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={tierChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={95}
                        dataKey="value" paddingAngle={3} strokeWidth={0}>
                        {tierChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} opacity={0.85} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280' }}
                        formatter={(value) => value.toString().toUpperCase()}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Tier breakdown cards */}
                <div className="grid grid-cols-1 gap-px bg-[var(--border-dark)] border border-[var(--border-dark)]">
                  {tierDist.map((t, i) => {
                    const total = tierDist.reduce((sum, x) => sum + x.count, 0) || 1;
                    const pct   = ((t.count / total) * 100).toFixed(1);
                    const col   = TIER_COLORS[i % TIER_COLORS.length];
                    return (
                      <div key={i} className="bg-[#050505] p-4 flex items-center gap-4">
                        <div className="w-2 h-8 flex-shrink-0" style={{ background: col }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-mono uppercase tracking-widest text-white font-bold mb-1">{t.tier}</p>
                          <div className="w-full h-1 bg-[#0A0A0A] overflow-hidden">
                            <div className="h-full transition-all" style={{ width: `${pct}%`, background: col }} />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-mono font-bold text-white">{t.count}</p>
                          <p className="text-[7px] font-mono text-[var(--text-muted)] uppercase">{pct}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── CONSENSUS SHIFT AREA CHART ───────────────────────── */}
          {shiftAreaData.length > 0 && (
            <motion.div variants={CA_ITEM}>
              <SectionHeader title="Consensus Fluidity Index" subtitle="Initial thesis vs oracle crowd price discovery" />
              <div className="bg-[#050505] border border-[var(--border-dark)] p-5">
                <p className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-4 font-bold">Price Convergence — Top 10 Assets</p>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={shiftAreaData} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={GOLD} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={BLUE} stopOpacity={0.18} />
                        <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 7, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 8, fontFamily: 'monospace' }} axisLine={false} tickLine={false}
                      tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="initial" name="Initial Price"   stroke="#374151" strokeWidth={1.5} fill="url(#blueGrad)" dot={false} />
                    <Area type="monotone" dataKey="current" name="Consensus Price" stroke={GOLD}    strokeWidth={2}   fill="url(#goldGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex gap-6 mt-3">
                  <span className="flex items-center gap-1.5 text-[8px] font-mono text-[var(--text-muted)]">
                    <span className="w-3 h-0.5 bg-[#374151] inline-block" /> Initial Price
                  </span>
                  <span className="flex items-center gap-1.5 text-[8px] font-mono text-[var(--text-muted)]">
                    <span className="w-3 h-0.5 inline-block" style={{ background: GOLD }} /> Oracle Consensus Price
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── CONSENSUS SHIFT TABLE ─────────────────────────────── */}
          {consensusShift.length > 0 && (
            <motion.div variants={CA_ITEM}>
              <SectionHeader title="Shift Vector Registry" subtitle="Asset-level consensus movement log" />
              <div className="bg-[#050505] border border-[var(--border-dark)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#0A0A0A] border-b border-[var(--border-dark)]">
                        {['Asset Class', 'Initial Thesis', 'Oracle Consensus', 'Shift Vector', 'Active Oracles'].map(h => (
                          <th key={h} className="px-6 py-3.5 text-[8px] font-mono font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {consensusShift.map((p, i) => (
                        <tr key={i} className="border-b border-[var(--border-dark)] hover:bg-white/[0.015] transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-[8px] font-mono text-[var(--rolex-gold)] font-bold uppercase mb-0.5">{p.brand}</p>
                            <p className="text-[11px] font-bold text-white">{p.name.slice(0, 32)}{p.name.length > 32 ? '…' : ''}</p>
                          </td>
                          <td className="px-6 py-4 font-mono text-[11px] text-[var(--text-muted)]">
                            ${p.initial_consensus.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 font-mono text-[11px] text-white font-bold">
                            ${p.consensus_price.toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`flex items-center gap-1.5 text-[10px] font-mono font-bold ${
                              p.shift_pct > 10 ? 'text-[var(--rolex-gold)]' :
                              p.shift_pct > 0  ? 'text-[var(--success)]' : 'text-[#ef4444]'
                            }`}>
                              <ArrowRight size={12} className={p.shift_pct >= 0 ? '' : 'rotate-180'} />
                              {Math.abs(p.shift_pct)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[10px] font-mono text-[var(--text-muted)]">
                            {p.total_reviews} Nodes
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

        </motion.div>
      </div>
    </div>
  );
}

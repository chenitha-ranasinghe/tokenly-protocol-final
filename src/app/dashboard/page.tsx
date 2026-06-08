'use client';
import { useStore } from '@/lib/store';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch, setAuthUser } from '@/lib/client';
import { motion, AnimatePresence } from 'framer-motion';
import { CA_STAGGER, CA_ITEM, CA_ITEM_HERO } from '@/lib/animations';
import {
  Shield, Zap, BarChart3, TrendingUp, Award, History, Database,
  Hexagon, CheckCircle2, Clock, ArrowUpRight, User as UserIcon,
  Crown, Star, Activity, Package, ShoppingCart, Trophy,
} from 'lucide-react';
import type { User, Review, Transaction, RRSBreakdown, Quest, UserShare } from '@/lib/types';
import { showToast } from '@/components/Toast';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { PortfolioTable } from '@/components/dashboard/PortfolioTable';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Skeleton } from '@/components/shared/Skeleton';
import TradeFeed from '@/components/TradeFeed';
import { PortfolioSparkline } from '@/components/dashboard/PortfolioSparkline';
import { QuickActionsBar } from '@/components/dashboard/QuickActionsBar';
import { NetworkPulse } from '@/components/dashboard/NetworkPulse';

// ── Time greeting ─────────────────────────────────────────────────────────
const getGreeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'MORNING' : h < 18 ? 'AFTERNOON' : 'EVENING';
};

// ── Main Dashboard Page ───────────────────────────────────────────────────
export default function DashboardPage() {
  const [reviews,      setReviews]      = useState<Review[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rrs,          setRrs]          = useState<RRSBreakdown | null>(null);
  const [rank,         setRank]         = useState(0);
  const [totalR,       setTotalR]       = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState<'reviews' | 'transactions'>('reviews');
  const [quests,       setQuests]       = useState<Quest[]>([]);
  const [shares,       setShares]       = useState<UserShare[]>([]);
  const [openOrders,   setOpenOrders]   = useState(0);

  const router   = useRouter();
  const user     = useStore(s => s.user);
  const hydrated = useStore(s => s.hydrated);

  const loadQuests = () => {
    authFetch('/api/quests/claim')
      .then(r => r.json())
      .then(d => setQuests(d.quests || []))
      .catch(() => {});
  };

  const handleClaimQuest = async (questId: string) => {
    try {
      const res  = await authFetch('/api/quests/claim', {
        method: 'POST',
        body:   JSON.stringify({ questId }),
      });
      const data = await res.json() as { error?: string; message?: string; user?: User };
      if (!res.ok) { showToast(data.error ?? 'Error', 'error'); return; }
      showToast(data.message ?? 'Quest claimed!', 'success');
      if (data.user) setAuthUser(data.user);
      loadQuests();
    } catch { showToast('Network error', 'error'); }
  };

  useEffect(() => {
    if (!user) { router.push('/'); return; }

    Promise.all([
      authFetch('/api/dashboard').then(r => {
        if (r.status === 401) { router.push('/'); return null; }
        return r.json();
      }),
      authFetch('/api/portfolio')
        .then(r => r.json())
        .catch(() => ({ shares: [], transactions: [] })),
    ]).then(([d, p]) => {
      if (!d) return;
      setReviews(d.reviews      || []);
      setTransactions(d.transactions || []);
      setRrs(d.rrsBreakdown);
      setRank(d.rank            || 0);
      setTotalR(d.totalReviewers || 0);
      setAuthUser(d.user);
      setShares((p?.shares as UserShare[]) || []);
      setLoading(false);
    }).catch(() => setLoading(false));

    authFetch('/api/trade?status=open')
      .then(r => r.json())
      .then(d => setOpenOrders((d.orders as unknown[])?.length || 0))
      .catch(() => {});

    loadQuests();
  }, [router]);

  // ── Loading skeletons ───────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-white font-sans">
      <main className="max-w-7xl mx-auto pt-12 pb-12 px-4 sm:px-8">
        <div className="space-y-6">
          <div className="bg-[#050505] border border-[var(--border-dark)] p-8">
            <Skeleton height="10px" width="120px" className="mb-4" />
            <Skeleton height="40px" width="300px" className="mb-6" />
            <div className="flex gap-4">
              <Skeleton height="20px" width="150px" />
              <Skeleton height="20px" width="150px" />
            </div>
          </div>
          <Skeleton height="56px" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Skeleton height="100px" />
            <Skeleton height="100px" />
            <Skeleton height="100px" />
            <Skeleton height="100px" />
          </div>
          <Skeleton height="150px" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7"><Skeleton height="300px" /></div>
            <div className="lg:col-span-5"><Skeleton height="300px" /></div>
          </div>
        </div>
      </main>
    </div>
  );

  if (!hydrated) return <LoadingSpinner label="Syncing protocol data..." />;
  if (!user)     return null;

  // ── Derived values ────────────────────────────────────────────────────
  const acc = (user?.total_reviews || 0) > 0
    ? (((user?.accurate_reviews || 0) / (user?.total_reviews || 1)) * 100).toFixed(1)
    : '---';

  const portfolioValue = shares.reduce((sum, s) => {
    const price = s.consensus_price ?? s.avg_buy_price;
    return sum + s.shares * price;
  }, 0);

  const rrsVal       = rrs?.total  || 0;
  const circumference = 2 * Math.PI * 54;
  const rrsOffset     = circumference - (rrsVal / 100) * circumference;
  const isAdmin       = user.email?.toLowerCase() === 'admin@tokenly.luxury';

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-white font-sans">
      <main className="max-w-7xl mx-auto pt-12 pb-16 px-4 sm:px-8">
        <motion.div variants={CA_STAGGER} initial="hidden" animate="show">

          {/* ━━━━━ HERO GREETING ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <motion.div
            variants={CA_ITEM_HERO}
            className="mb-4 bg-[#050505] border border-[var(--border-dark)] p-5 md:p-8 relative overflow-hidden group"
          >
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-[var(--rolex-gold)]/5 blur-[100px] rounded-full pointer-events-none opacity-50 group-hover:opacity-80 transition-opacity duration-700" />

            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <p suppressHydrationWarning className="text-[8px] font-mono tracking-[0.3em] text-[var(--rolex-gold)] mb-2 uppercase flex items-center gap-2 font-bold">
                  <span className="w-1 h-1 bg-[var(--rolex-gold)] rounded-full animate-pulse" />
                  {getGreeting()} COMMAND ACCESS
                </p>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tighter text-white mb-3 flex items-center gap-2 uppercase">
                  {user.name}
                  <Hexagon size={18} className="text-[var(--rolex-gold)] opacity-30" />
                </h1>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className={`px-3 py-1 text-[7px] font-mono font-bold tracking-[0.2em] uppercase border ${
                    isAdmin
                      ? 'bg-red-500/10 border-red-500/30 text-red-500'
                      : 'bg-[var(--rolex-gold)]/10 border-[var(--rolex-gold)]/30 text-[var(--rolex-gold)]'
                  }`}>
                    {isAdmin
                      ? 'ADMINISTRATOR'
                      : user.experiment_group === 'staking'
                        ? 'STAKING ORACLE'
                        : 'CONTROL ANCHOR'}
                  </div>
                  <div suppressHydrationWarning className="flex items-center gap-1.5 text-[7px] font-mono text-[var(--text-muted)] bg-[#0A0A0A] px-3 py-1 border border-[var(--border-dark)] uppercase tracking-[0.2em] font-bold">
                    <Clock size={10} /> ESTABLISHED {new Date(user.created_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Network pulse badge */}
                <NetworkPulse />
              </div>

              <div className="hidden md:block text-right flex-shrink-0">
                <div className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-1 font-bold">
                  Authority Rank
                </div>
                <div className="text-3xl font-mono font-bold text-white tracking-tighter">
                  #{rank}
                  <span className="text-sm text-[var(--text-muted)] font-normal ml-1">/ {totalR}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ━━━━━ QUICK ACTIONS BAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <motion.div variants={CA_ITEM} className="mb-4">
            <QuickActionsBar />
          </motion.div>

          {/* ━━━━━ STATS SUMMARY BAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <motion.div variants={CA_ITEM} className="mb-4">
            <DashboardStats user={user} totalValue={portfolioValue} openOrders={openOrders} />
          </motion.div>

          {/* ━━━━━ CORE METRICS GRID ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

            {/* Level Progression HUD — full width */}
            <motion.div
              variants={CA_ITEM}
              className="md:col-span-3 bg-[#050505] border border-[var(--rolex-gold)]/30 p-6 relative flex flex-col justify-between overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--rolex-gold)]/5 to-transparent pointer-events-none" />
              <div className="relative z-10 flex justify-between items-end mb-4">
                <div>
                  <div className="text-[9px] font-mono text-[var(--rolex-gold)] tracking-[0.2em] uppercase mb-2 font-bold">
                    Protocol Clearance Level
                  </div>
                  <h3 className="text-2xl font-bold text-white tracking-tight m-0">
                    LEVEL {rrsVal >= 85 ? 5 : rrsVal >= 70 ? 4 : rrsVal >= 55 ? 3 : rrsVal >= 40 ? 2 : 1}
                    <span className="text-[10px] font-mono text-[var(--text-muted)] font-normal ml-3 tracking-[0.15em] uppercase">
                      — {rrs?.tier || 'Reviewer'} CLEARANCE
                    </span>
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-mono font-bold text-white tracking-tighter">
                    {Math.round(((rrsVal % 15) / 15) * 100)}%
                  </span>
                  <div className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-widest mt-0.5 font-bold">To Next Rank</div>
                </div>
              </div>
              <div className="w-full h-1 bg-[#0A0A0A] border border-white/5 overflow-hidden relative z-10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round(((rrsVal % 15) / 15) * 100)}%` }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                  className="h-full bg-[var(--rolex-gold)] shadow-[0_0_10px_rgba(163,126,44,0.4)]"
                />
              </div>
            </motion.div>

            {/* Reputation Dial */}
            <motion.div
              variants={CA_ITEM}
              className="bg-[#050505] border border-[var(--border-dark)] p-6 flex flex-col items-center justify-center relative"
            >
              <div className="absolute top-4 left-5 text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest font-bold flex items-center gap-2">
                <Shield size={12} className="text-[var(--rolex-gold)]" /> REPUTATION
              </div>
              <div className="relative w-32 h-32 my-4">
                <svg width="128" height="128" viewBox="0 0 120 120" className="-rotate-90">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="3" />
                  <motion.circle
                    cx="60" cy="60" r="54" fill="none"
                    stroke="var(--rolex-gold)" strokeWidth="5" strokeLinecap="square"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: rrsOffset }}
                    transition={{ duration: 2, ease: 'easeOut', delay: 0.5 }}
                    className="drop-shadow-[0_0_8px_rgba(163,126,44,0.3)]"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-mono font-bold text-white tracking-tighter">{rrsVal.toFixed(1)}</span>
                </div>
              </div>
              <div className="px-4 py-1.5 bg-[var(--rolex-gold)]/10 border border-[var(--rolex-gold)]/30 text-[8px] font-mono tracking-widest uppercase text-[var(--rolex-gold)] font-bold">
                {rrs?.tier || 'INITIALIZING...'}
              </div>
            </motion.div>

            {/* Treasury Balance — with sparkline */}
            <motion.div
              variants={CA_ITEM}
              className="bg-[#050505] border border-[var(--border-dark)] border-t-[2px] border-t-[var(--rolex-gold)] p-6 flex flex-col justify-between"
            >
              <div>
                <div className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-4 font-bold flex items-center gap-2">
                  <TrendingUp size={12} className="text-[var(--rolex-gold)]" /> DEPLOYMENT CAPITAL
                </div>
                <div className={`font-mono font-bold text-[var(--rolex-gold)] tracking-tighter mb-2 ${isAdmin ? 'text-3xl' : 'text-4xl'}`}>
                  {isAdmin ? 'UNLIMITED' : (user.points ?? 0).toLocaleString()}
                </div>
                {/* Portfolio sparkline */}
                {!isAdmin && portfolioValue > 0 && (
                  <div className="mt-2 mb-3">
                    <PortfolioSparkline value={portfolioValue} />
                    <p className="text-[7px] font-mono text-[var(--text-muted)] uppercase tracking-widest mt-1 font-bold">
                      PORTFOLIO: {portfolioValue.toLocaleString()} PTS
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-end mt-2">
                <div className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-widest font-semibold">
                  Liquid Protocol Assets
                </div>
                <button
                  onClick={() => router.push('/portfolio')}
                  className="px-3 py-1.5 text-[8px] font-mono tracking-widest uppercase border border-[var(--border-dark)] bg-[#0A0A0A] hover:bg-white/5 text-white transition-colors font-bold"
                >
                  ALLOCATE →
                </button>
              </div>
            </motion.div>

            {/* Accuracy Vector */}
            <motion.div
              variants={CA_ITEM}
              className="bg-[#050505] border border-[var(--border-dark)] p-6 flex flex-col justify-between"
            >
              <div>
                <div className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-6 font-bold flex items-center gap-2">
                  <BarChart3 size={12} className="text-[var(--rolex-gold)]" /> ACCURACY VECTOR
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-4xl lg:text-5xl font-mono font-bold text-white tracking-tighter">{acc}</div>
                  {acc !== '---' && <div className="text-xl font-mono text-[var(--text-muted)]">%</div>}
                </div>
              </div>
              <div className="pt-4 border-t border-[var(--border-dark)] mt-4">
                <div className="w-full h-1 bg-[#0A0A0A] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: acc === '---' ? '0%' : `${acc}%` }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    className="h-full bg-[var(--rolex-gold)]"
                  />
                </div>
                <div className="flex justify-between mt-3 text-[8px] font-mono text-[var(--text-muted)] tracking-widest uppercase font-bold">
                  <span>VERIFIED: {user.accurate_reviews}</span>
                  <span>TOTAL: {user.total_reviews}</span>
                </div>
              </div>
            </motion.div>

          </div>

          {/* ━━━━━ DIRECTIVES & ACHIEVEMENTS ━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-8">

            {/* Active Directives (Quests) */}
            <motion.div
              variants={CA_ITEM}
              className="lg:col-span-7 bg-[#050505] border border-[var(--border-dark)] flex flex-col"
            >
              <div className="px-6 py-4 border-b border-[var(--border-dark)] flex justify-between items-center bg-[#0A0A0A]">
                <h3 className="m-0 text-[10px] font-mono uppercase tracking-widest text-white font-bold flex items-center gap-3">
                  <Zap size={14} className="text-[var(--rolex-gold)]" /> ACTIVE DIRECTIVES
                </h3>
                <span className="text-[9px] font-mono tracking-widest uppercase text-[var(--text-muted)] font-bold">
                  {quests.filter(q => !q.completed).length} PENDING
                </span>
              </div>
              <div className="p-4 flex flex-col gap-2 flex-grow">
                {quests.length === 0 ? (
                  <div className="p-8 text-center text-[10px] font-mono text-[var(--text-muted)] tracking-widest uppercase flex-grow flex items-center justify-center">
                    Synching global directives...
                  </div>
                ) : quests.map(q => (
                  <motion.div
                    whileHover={{ scale: 1.005, backgroundColor: '#0A0A0A' }}
                    key={q.id}
                    className={`p-4 border border-[var(--border-dark)] bg-[#0A0A0A]/50 flex items-center justify-between transition-colors ${q.completed ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 flex items-center justify-center border ${
                        q.completed
                          ? 'bg-[var(--success)]/5 border-[var(--success)]/20 text-[var(--success)]'
                          : 'bg-[var(--rolex-gold)]/5 border-[var(--rolex-gold)]/20 text-[var(--rolex-gold)]'
                      }`}>
                        {q.completed ? <CheckCircle2 size={14} /> : <Database size={14} />}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-white uppercase tracking-widest mb-1">{q.title}</div>
                        <div className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                          Reward: {q.reward} PTS
                        </div>
                      </div>
                    </div>
                    {q.completed ? (
                      <div className="text-[9px] font-mono text-[var(--success)] font-bold tracking-widest uppercase">[ RESOLVED ]</div>
                    ) : q.eligible ? (
                      <button
                        onClick={() => handleClaimQuest(q.id)}
                        className="px-5 py-2.5 text-[9px] font-mono bg-white text-black font-bold tracking-widest uppercase hover:bg-[var(--rolex-gold)] transition-colors border border-white"
                      >
                        EXECUTE →
                      </button>
                    ) : (
                      <div className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-1.5 border border-[var(--border-dark)] px-3 py-1 bg-[#050505]">
                        <Clock size={10} /> SECURED
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Prestige Vault (Achievements) */}
            <motion.div
              variants={CA_ITEM}
              className="lg:col-span-5 bg-[#050505] border border-[var(--border-dark)] flex flex-col"
            >
              <div className="px-6 py-4 border-b border-[var(--border-dark)] bg-[#0A0A0A]">
                <h3 className="m-0 text-[10px] font-mono uppercase tracking-widest text-white font-bold flex items-center gap-3">
                  <Award size={14} className="text-[var(--rolex-gold)]" /> PRESTIGE VAULT
                </h3>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4 flex-grow items-center">
                {[
                  { icon: <UserIcon size={16} />, label: 'PIONEER', active: true },
                  { icon: <Crown    size={16} />, label: 'ELITE',   active: rrsVal >= 85 },
                  { icon: <Hexagon  size={16} />, label: 'TITAN',   active: (user.points ?? 0) >= 50000 },
                  { icon: <TrendingUp size={16}/>, label: 'PROFIT',  active: (user.accurate_reviews ?? 0) >= 5 },
                ].map((m, i) => (
                  <motion.div
                    key={i}
                    whileHover={m.active ? { scale: 1.05 } : {}}
                    className={`flex flex-col items-center gap-3 ${m.active ? 'opacity-100' : 'opacity-20 grayscale'}`}
                  >
                    <div className={`w-12 h-12 border flex items-center justify-center ${
                      m.active
                        ? 'border-[var(--rolex-gold)] bg-[var(--rolex-gold)]/5 text-[var(--rolex-gold)] shadow-[0_0_10px_rgba(163,126,44,0.1)]'
                        : 'border-[var(--border-dark)] bg-[#0A0A0A] text-white'
                    }`}>
                      {m.icon}
                    </div>
                    <span className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] font-bold">{m.label}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ━━━━━ VAULT POSITIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <motion.div variants={CA_ITEM} className="mb-8">
            <div className="bg-[#050505] border border-[var(--border-dark)]">
              <div className="px-6 py-4 border-b border-[var(--border-dark)] bg-[#0A0A0A] flex justify-between items-center">
                <h3 className="m-0 text-[10px] font-mono uppercase tracking-widest text-white font-bold flex items-center gap-3">
                  <Database size={14} className="text-[var(--rolex-gold)]" /> VAULT POSITIONS
                </h3>
                {shares.length > 0 && (
                  <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest font-bold">
                    {shares.length} POSITIONS · {portfolioValue.toLocaleString()} PTS
                  </span>
                )}
              </div>
              <div className="p-4">
                <PortfolioTable shares={shares} onTrade={(id) => router.push(`/vault/${id}`)} />
              </div>
            </div>
          </motion.div>

          {/* ━━━━━ LIVE TRADE FEED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <motion.div variants={CA_ITEM} className="mb-8">
            <TradeFeed />
          </motion.div>

          {/* ━━━━━ LEDGER / TABBED HISTORY ━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <motion.div variants={CA_ITEM} className="bg-[#050505] border border-[var(--border-dark)] mb-8">
            <div className="flex flex-wrap gap-6 border-b border-[var(--border-dark)] px-6 bg-[#0A0A0A]">
              {[
                { id: 'reviews'      as const, label: `VERIFICATION LOG (${reviews.length})` },
                { id: 'transactions' as const, label: `TREASURY LEDGER (${transactions.length})` },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`py-4 text-[9px] font-mono font-bold tracking-widest uppercase transition-colors border-b-2 ${
                    tab === t.id
                      ? 'text-[var(--rolex-gold)] border-[var(--rolex-gold)]'
                      : 'text-[var(--text-muted)] border-transparent hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {tab === 'reviews' ? (
                <motion.div
                  key="reviews"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="overflow-x-auto p-4"
                >
                  {reviews.length === 0 ? (
                    <div className="p-16 text-center text-[var(--text-muted)] bg-[#0A0A0A] border border-[var(--border-dark)]">
                      <History size={32} className="mx-auto mb-6 opacity-20" />
                      <p className="text-[10px] font-mono uppercase tracking-widest">
                        No verification records found in this sequence.
                      </p>
                      <button
                        onClick={() => router.push('/products')}
                        className="mt-6 px-6 py-3 border border-[var(--border-dark)] bg-[#050505] text-[9px] font-mono uppercase tracking-widest text-white hover:bg-white/5 transition-colors"
                      >
                        ACCESS PRODUCTS →
                      </button>
                    </div>
                  ) : (
                    <table className="w-full text-left text-[11px] font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--border-dark)] text-[9px] text-[var(--text-muted)] uppercase tracking-widest">
                          <th className="py-4 px-4 font-normal">Asset</th>
                          <th className="py-4 px-4 font-normal">Grade</th>
                          <th className="py-4 px-4 font-normal">Estimate</th>
                          <th className="py-4 px-4 font-normal">Consensus</th>
                          <th className="py-4 px-4 font-normal">Accuracy</th>
                          <th className="py-4 px-4 text-right font-normal">Yield Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviews.map((r, i) => (
                          <motion.tr
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.04 }}
                            key={r.id}
                            className="border-b border-[var(--border-dark)] hover:bg-[#0A0A0A] transition-colors"
                          >
                            <td className="py-4 px-4">
                              <strong className="text-white uppercase tracking-widest">{r.brand}</strong>
                              <span className="text-[var(--text-muted)] ml-2">{r.product_name}</span>
                            </td>
                            <td className="py-4 px-4 text-white">{r.condition_grade}/10</td>
                            <td className="py-4 px-4 text-[var(--text-secondary)]">${(r.price_estimate ?? 0).toLocaleString()}</td>
                            <td className="py-4 px-4 text-[var(--text-secondary)]">${(r.consensus_price ?? 0).toLocaleString()}</td>
                            <td className="py-4 px-4">
                              <span className={`px-2.5 py-1 text-[9px] font-bold tracking-widest uppercase border ${
                                r.is_accurate
                                  ? 'bg-[var(--success)]/5 border-[var(--success)]/20 text-[var(--success)]'
                                  : 'bg-red-500/5 border-red-500/20 text-red-500'
                              }`}>
                                {r.accuracy_score?.toFixed(1)}%
                              </span>
                            </td>
                            <td className={`py-4 px-4 text-right font-bold ${(r.reward_amount ?? 0) >= 0 ? 'text-[var(--success)]' : 'text-red-500'}`}>
                              {(r.reward_amount ?? 0) > 0 ? '+' : ''}{(r.reward_amount ?? 0).toLocaleString()}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="transactions"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="overflow-x-auto p-4"
                >
                  {transactions.length === 0 ? (
                    <div className="p-16 text-center text-[var(--text-muted)] bg-[#0A0A0A] border border-[var(--border-dark)]">
                      <History size={32} className="mx-auto mb-6 opacity-20" />
                      <p className="text-[10px] font-mono uppercase tracking-widest">No ledger entries found.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-[11px] font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--border-dark)] text-[9px] text-[var(--text-muted)] uppercase tracking-widest">
                          <th className="py-4 px-4 font-normal">Timestamp</th>
                          <th className="py-4 px-4 font-normal">Operation</th>
                          <th className="py-4 px-4 font-normal">Trace Log</th>
                          <th className="py-4 px-4 text-right font-normal">Capital Flow</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t, i) => (
                          <motion.tr
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.04 }}
                            key={t.id}
                            className="border-b border-[var(--border-dark)] hover:bg-[#0A0A0A] transition-colors"
                          >
                            <td suppressHydrationWarning className="py-4 px-4 text-[var(--text-muted)]">
                              {new Date(t.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-4 px-4">
                              <span className="px-2.5 py-1 bg-white/5 border border-white/10 text-white text-[9px] font-bold tracking-widest uppercase">
                                {t.type}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-[var(--text-secondary)]">{t.description}</td>
                            <td className={`py-4 px-4 text-right font-bold ${(t.amount ?? 0) >= 0 ? 'text-[var(--success)]' : 'text-red-500'}`}>
                              {(t.amount ?? 0) > 0 ? '+' : ''}{(t.amount ?? 0).toLocaleString()}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

        </motion.div>
      </main>
    </div>
  );
}

'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, Variants, useInView } from 'framer-motion';
import { usePrivy } from '@privy-io/react-auth';
import { Shield, Zap, Cpu, Lock, ArrowRight, Users, Activity, Globe } from 'lucide-react';

// ── Animation variants ──────────────────────────────────────────────────────
const STAGGER: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};
const FADE_UP: Variants = {
  hidden: { opacity: 0, y: 48, filter: 'blur(12px)' },
  show:   { opacity: 1, y: 0,  filter: 'blur(0px)',  transition: { type: 'spring', mass: 0.5, stiffness: 80, damping: 18 } },
};

// ── Count-up hook ───────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1800) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  useEffect(() => {
    if (!inView) return;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      setValue(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target, duration]);
  return { value, ref };
}

function AnimatedStat({ target, label, suffix = '' }: { target: number; label: string; suffix?: string }) {
  const { value, ref } = useCountUp(target);
  return (
    <div ref={ref} className="flex flex-col gap-2">
      <span className="text-3xl md:text-4xl font-black font-mono text-white tracking-tight">
        {value.toLocaleString()}{suffix}
      </span>
      <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</span>
    </div>
  );
}

// ── Features ────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: <Shield size={22}/>, label: 'CAN Network',   title: 'Certified Authenticator Nodes', desc: 'Experts bond capital before reviewing. If they lie, they lose it. Pure economic accountability — not reputation theatre.', color: '#A37E2C', glow: 'rgba(163,126,44,0.12)' },
  { icon: <Activity size={22}/>, label: 'RRS Oracle',  title: 'Reputation Score Engine',       desc: 'A live composite trust score built from accuracy, volume, and consistency. Cannot be gamed — only earned through verified outcomes.', color: '#3b82f6', glow: 'rgba(59,130,246,0.12)' },
  { icon: <Zap size={22}/>, label: 'Vault Trading',    title: 'Fractional Asset Ownership',    desc: 'Buy and sell fractional shares of authenticated physical assets. Consensus price set by staked reviewers — not sellers.', color: '#22c55e', glow: 'rgba(34,197,94,0.12)' },
  { icon: <Cpu size={22}/>, label: 'AI Vision',        title: 'Neural Authentication Layer',   desc: 'Llama 4 Vision scans stitching, serial numbers, hardware finish, and material texture before any human touches the asset.', color: '#8b5cf6', glow: 'rgba(139,92,246,0.12)' },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Bond & Certify',  desc: 'CAN authenticators lock capital before reviewing. Skin in the game ensures every review is truthful.' },
  { step: '02', title: 'AI Pre-Screen',   desc: 'Our vision model runs a forensic check on item imagery. Humans then confirm with a final verdict.' },
  { step: '03', title: 'List & Trade',    desc: 'Verified assets enter the vault. Anyone can buy fractional shares at the crowd-consensus price.' },
];

interface TickerData { totalUsers: number; totalReviews: number; totalTrades: number; topAsset: string; networkStatus: string; }

// ── Page ────────────────────────────────────────────────────────────────────
export default function Home() {
  const { login, ready, authenticated } = usePrivy();
  const router = useRouter();
  const [ticker, setTicker] = useState<TickerData | null>(null);

  useEffect(() => { if (ready && authenticated) router.push('/dashboard'); }, [ready, authenticated, router]);
  useEffect(() => { fetch('/api/ticker').then(r => r.json()).then(setTicker).catch(() => null); }, []);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[var(--bg-primary)] text-white">

      {/* ── Premium animated background ─────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle, rgba(163,126,44,0.10) 1px, transparent 1px)',
          backgroundSize: '38px 38px',
        }}/>
        <div className="absolute -top-[30%] -left-[15%] w-[80vw] h-[80vw] rounded-full blur-[200px]" style={{ background: 'radial-gradient(circle, rgba(163,126,44,0.08) 0%, transparent 60%)' }}/>
        <div className="absolute -bottom-[30%] -right-[15%] w-[70vw] h-[70vw] rounded-full blur-[180px]" style={{ background: 'radial-gradient(circle, rgba(0,96,57,0.07) 0%, transparent 60%)' }}/>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vw] rounded-full blur-[150px]" style={{ background: 'radial-gradient(circle, rgba(163,126,44,0.04) 0%, transparent 60%)' }}/>
      </div>

      {/* Top gold accent */}
      <div className="fixed top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--rolex-gold)]/50 to-transparent z-10"/>

      {/* ━━━━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative z-10 flex-1 flex items-center min-h-screen pt-28 pb-20 px-6 md:px-10 lg:px-16">
        <motion.div
          variants={STAGGER} initial="hidden" animate="show"
          className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 xl:gap-28 items-center"
        >
          {/* LEFT */}
          <motion.div variants={FADE_UP} className="flex flex-col">

            {/* Protocol badge */}
            <div className="inline-flex items-center gap-3 mb-10 self-start px-4 py-2.5 rounded-full border border-[var(--rolex-green-light)]/20 bg-[var(--rolex-green-light)]/6">
              <span className="w-2 h-2 rounded-full bg-[var(--rolex-green-light)] animate-pulse"/>
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--rolex-green-light)] font-mono">
                Protocol V5.0 — Live
              </span>
            </div>

            {/* Hero headline */}
            <h1 className="text-[clamp(3.2rem,8vw,6.5rem)] font-black leading-[0.88] tracking-[-0.04em] mb-8 uppercase">
              Skin In<br/>The Game.
              <br/>
              <span className="bg-gradient-to-br from-[var(--rolex-gold)] via-[var(--rolex-gold-light)] to-[var(--rolex-gold)] bg-clip-text text-transparent">
                Truth In<br/>The Market.
              </span>
            </h1>

            {/* Body copy */}
            <p className="text-base md:text-lg text-[var(--text-secondary)] leading-relaxed max-w-lg mb-12 font-light">
              The trust layer for physical asset tokenization. Every item CAN-authenticated before listing. Price set by staked reviewers — not sellers. Sell in minutes without shipping.
            </p>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-8 mb-12 pb-12 border-b border-[var(--border-dark)]">
              {[
                { target: ticker?.totalUsers   ?? 0, label: 'Network Nodes'      },
                { target: ticker?.totalReviews ?? 0, label: 'Verified Reviews'   },
                { target: ticker?.totalTrades  ?? 0, label: 'Vault Trades'       },
                { target: 10000,                     label: 'PTS Welcome Capital', suffix: '+' },
              ].map((s, i) => <AnimatedStat key={i} target={s.target} label={s.label} suffix={s.suffix}/>)}
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-2.5">
              {[
                { icon: '◈', label: 'CAN Verified' },
                { icon: '⬡', label: 'DAO Governed' },
                { icon: '◆', label: 'Audit Logged' },
                { icon: '⚑', label: 'RRS Scored'   },
              ].map((b, i) => (
                <span key={i} className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border-dark)] bg-[rgba(255,255,255,0.02)] text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] hover:border-[var(--rolex-gold)]/30 hover:text-[var(--rolex-gold)] transition-all duration-200 cursor-default">
                  <span className="text-[var(--rolex-gold)]">{b.icon}</span>
                  {b.label}
                </span>
              ))}
            </div>
          </motion.div>

          {/* RIGHT — premium glass auth card */}
          <motion.div variants={FADE_UP} className="flex justify-center lg:justify-end">
            <div className="w-full max-w-[460px] relative">

              {/* Ambient glow */}
              <div className="absolute -inset-10 bg-[var(--rolex-gold)]/[0.07] blur-[80px] rounded-full pointer-events-none"/>

              {/* Glass card */}
              <div className="relative rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.09)] shadow-2xl" style={{ background: 'rgba(10,10,10,0.88)', backdropFilter: 'blur(40px)' }}>

                {/* Gold accent line */}
                <div className="h-px bg-gradient-to-r from-transparent via-[var(--rolex-gold)]/60 to-transparent"/>

                {/* Traffic lights header */}
                <div className="flex items-center gap-2 px-6 py-4 border-b border-[rgba(255,255,255,0.05)]">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]"/>
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"/>
                  <div className="w-3 h-3 rounded-full bg-[#28c840]"/>
                  <span className="ml-3 text-xs font-mono text-[var(--text-muted)] tracking-widest uppercase">tokenly:// secure-link</span>
                </div>

                {/* Body */}
                <div className="p-8 sm:p-10">
                  {/* Icon */}
                  <div className="flex justify-center mb-8">
                    <div className="relative">
                      <div className="absolute inset-0 bg-[var(--rolex-gold)]/20 blur-2xl rounded-full scale-150"/>
                      <div className="relative w-20 h-20 rounded-2xl border border-[var(--rolex-gold)]/30 bg-[var(--rolex-gold)]/8 flex items-center justify-center text-[var(--rolex-gold)]">
                        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-white tracking-tight mb-3">Join the Protocol</h2>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                      Connect your wallet or social identity to start reviewing, trading, and earning.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={login}
                      disabled={!ready}
                      className="w-full py-4 px-6 bg-white text-black font-bold text-sm tracking-wider uppercase rounded-xl flex items-center justify-center gap-3 disabled:opacity-50 transition-all duration-200 hover:bg-[var(--rolex-gold)] hover:shadow-[0_0_40px_rgba(163,126,44,0.35)]"
                    >
                      {!ready ? <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"/> : <Lock size={14}/>}
                      Connect Wallet / Social
                    </button>

                    <button
                      onClick={() => router.push('/explorer')}
                      className="w-full py-4 px-6 border border-[rgba(255,255,255,0.1)] text-sm font-medium text-white rounded-xl flex items-center justify-center gap-3 hover:bg-[rgba(255,255,255,0.04)] hover:border-[var(--rolex-gold)]/25 transition-all duration-200"
                    >
                      <Globe size={14} className="text-[var(--rolex-gold)]"/>
                      View Public Proof-of-Trust Ledger
                    </button>

                    {process.env.NODE_ENV === 'development' && (
                      <button
                        onClick={async () => { const r = await fetch('/api/auth/demo', { method: 'POST' }); if (r.ok) window.location.href = '/dashboard'; }}
                        className="w-full py-3 px-6 border border-[var(--rolex-gold)]/35 text-[var(--rolex-gold)] text-xs font-bold font-mono tracking-widest uppercase rounded-xl hover:bg-[var(--rolex-gold)]/10 transition-colors"
                      >
                        [ DEV ] God Mode / Admin Bypass
                      </button>
                    )}
                  </div>

                  {/* Welcome note */}
                  <div className="mt-6 p-4 rounded-xl border border-[var(--rolex-gold)]/12 bg-[var(--rolex-gold)]/5 text-center">
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                      Every new member receives{' '}
                      <strong className="text-[var(--rolex-gold)]">10,000 PTS</strong>{' '}
                      welcome capital. No seed phrase required.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ━━━━━ PROTOCOL FEATURES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative z-10 px-6 md:px-10 lg:px-16 pb-28">
        <div className="max-w-7xl mx-auto">

          <motion.div
            initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.7 }}
            className="mb-16"
          >
            <p className="text-xs font-mono font-bold uppercase tracking-[0.3em] text-[var(--rolex-gold)] mb-5">Protocol Architecture</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase leading-[0.9]">
              Four Pillars<br/>of Trust
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1, type: 'spring', stiffness: 160, damping: 22 }}
                className="group relative p-7 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.14)] transition-all duration-300 overflow-hidden cursor-default"
              >
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"
                  style={{ background: `radial-gradient(circle at 40% 0%, ${f.glow} 0%, transparent 65%)` }}/>

                {/* Icon */}
                <div className="relative mb-5 w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-300"
                  style={{ color: f.color, borderColor: f.color + '30', background: f.color + '12' }}>
                  {f.icon}
                </div>

                <p className="text-xs font-mono font-bold uppercase tracking-widest mb-3" style={{ color: f.color }}>{f.label}</p>
                <h3 className="text-base font-bold text-white mb-3 leading-snug">{f.title}</h3>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━ HOW IT WORKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative z-10 px-6 md:px-10 lg:px-16 pb-36">
        <div className="max-w-7xl mx-auto">

          <motion.div
            initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <p className="text-xs font-mono font-bold uppercase tracking-[0.3em] text-[var(--rolex-gold)] mb-5">The Three-Step Protocol</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase">How It Works</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {HOW_IT_WORKS.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.14, type: 'spring', stiffness: 160, damping: 22 }}
                className="relative p-8 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] hover:border-[var(--rolex-gold)]/18 hover:bg-[rgba(255,255,255,0.03)] transition-all duration-300 group overflow-hidden"
              >
                {/* Large step number (decorative) */}
                <div className="text-[6rem] font-black font-mono leading-none mb-5 select-none text-[var(--rolex-gold)]/10 group-hover:text-[var(--rolex-gold)]/18 transition-colors">
                  {s.step}
                </div>
                <h3 className="text-xl font-bold text-white mb-4 tracking-tight">{s.title}</h3>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{s.desc}</p>

                {/* Step connector arrow (desktop) */}
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-8 h-8 rounded-full bg-[var(--bg-primary)] border border-[var(--border-dark)] items-center justify-center z-10">
                    <ArrowRight size={12} className="text-[var(--rolex-gold)]"/>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Final CTA */}
          <motion.div
            initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-16 text-center"
          >
            <button
              onClick={login}
              disabled={!ready}
              className="inline-flex items-center gap-4 px-10 py-5 bg-[var(--rolex-gold)] text-black text-sm font-black uppercase tracking-widest rounded-xl transition-all duration-200 disabled:opacity-50 hover:bg-[var(--rolex-gold-light)] hover:shadow-[0_0_60px_rgba(163,126,44,0.4)] hover:scale-[1.01] group"
            >
              <Users size={16}/>
              Initialize Protocol Access
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform"/>
            </button>
          </motion.div>
        </div>
      </section>

      {/* ━━━━━ BOTTOM TICKER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="fixed bottom-0 left-0 w-full h-9 bg-black/95 border-t border-[var(--border-dark)] overflow-hidden z-[100] flex items-center backdrop-blur-xl">
        <div className="flex whitespace-nowrap font-mono text-[10px] text-[var(--rolex-gold)]/55 font-bold uppercase tracking-[0.18em]"
          style={{ animation: 'marquee 44s linear infinite' }}>
          {[0, 1].map(k => (
            <span key={k} className="flex items-center">
              {ticker ? (
                <>
                  <span className="mx-8">◆ NODES: {(ticker.totalUsers ?? 0).toLocaleString()}</span>
                  <span className="mx-8">◆ VERIFIED REVIEWS: {(ticker.totalReviews ?? 0).toLocaleString()}</span>
                  <span className="mx-8">◆ VAULT TRADES: {(ticker.totalTrades ?? 0).toLocaleString()}</span>
                  {ticker.topAsset && <span className="mx-8">◆ TOP ASSET: {ticker.topAsset}</span>}
                  <span className="mx-8 text-green-400/55">◆ NETWORK: {ticker.networkStatus}</span>
                  <span className="mx-8">◆ TOKENLY PROTOCOL V5.0</span>
                </>
              ) : (
                <>
                  <span className="mx-8">◆ TOKENLY PROTOCOL V5.0 — PHYSICAL ASSET TOKENIZATION PLATFORM</span>
                  <span className="mx-8">◆ CAN AUTHENTICATION NETWORK</span>
                  <span className="mx-8">◆ REPUTATION ORACLE SYSTEM</span>
                </>
              )}
            </span>
          ))}
        </div>
      </div>
      <div className="h-9"/>

      <style>{`
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>
    </div>
  );
}

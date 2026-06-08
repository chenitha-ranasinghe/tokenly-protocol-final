'use client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, Zap, Cpu, Lock, ArrowRight } from 'lucide-react';
import { CA_STAGGER, CA_ITEM, CA_ITEM_HERO } from '@/lib/animations';

// ── Protocol stats (these would ideally come from an API) ──────────────────
const STATS = [
  { label: 'Founded',           value: '2024'          },
  { label: 'Protocol Version',  value: 'V5.0'          },
  { label: 'Authentication AI', value: 'Llama 4 Vision' },
  { label: 'Staking Model',     value: 'Bond-and-Slash' },
  { label: 'Governance',        value: 'DAO Weighted'   },
  { label: 'Token Standard',    value: 'ERC-20 / SBT'  },
];

// ── Protocol pillars ────────────────────────────────────────────────────────
const PILLARS = [
  {
    number: '01',
    icon:   <Shield size={18} />,
    color:  '#a37e2c',
    title:  'Certified Authenticator Nodes',
    tagline:'Skin in the Game, Not Reputation Theatre',
    body:   'Every CAN node bonds capital before submitting a review. If their verdict proves dishonest against the crowd consensus, their bond is slashed and redistributed to accurate reviewers. This single mechanism eliminates the fundamental problem with reputation-based systems: people do not change behaviour until money is at risk.',
  },
  {
    number: '02',
    icon:   <Zap size={18} />,
    color:  '#3b82f6',
    title:  'Reputation Reputation Score',
    tagline:'Earned Through Verified Outcomes, Never Purchased',
    body:   'The RRS is a live, composite score derived from accuracy rate (45%), review volume (25%), and consistency across categories (30%). It cannot be boosted by paying fees, buying followers, or appealing to administrators. It rises only when the market confirms your verdicts were correct — and falls when they were not.',
  },
  {
    number: '03',
    icon:   <Cpu size={18} />,
    color:  '#22c55e',
    title:  'Neural Authentication Layer',
    tagline:'Machine Vision as the First Line of Defence',
    body:   'Before any human CAN node touches an item, our Llama 4 Vision model scans stitching regularity, serial number font spacing, hardware finish tolerances, and material texture gradients. The AI does not issue a verdict — it provides an anomaly probability score that informs the human consensus and flags items needing heightened scrutiny.',
  },
  {
    number: '04',
    icon:   <Lock size={18} />,
    color:  '#8b5cf6',
    title:  'Fractional Vault Trading',
    tagline:'Own a Share of Any Authenticated Asset',
    body:   'Once an asset clears authentication, it enters the vault. Fractional shares are issued at the crowd-consensus price, not the seller\'s asking price. Any holder can exit their position in minutes without arranging a physical sale. Price discovery happens continuously as new review data arrives, meaning the market is always informed by the latest expert consensus.',
  },
];

// ── Technical stack ─────────────────────────────────────────────────────────
const TECH_STACK = [
  ['Authentication Model',  'Llama 4 Scout Vision (via Groq)'],
  ['Reasoning Engine',      'Llama 3.3 70B (via Groq)'],
  ['Frontend Framework',    'Next.js 15 (App Router)'],
  ['Authentication Layer',  'Privy (MPC Wallet + Social)'],
  ['State Management',      'Zustand'],
  ['Database',              'PostgreSQL (Supabase)'],
  ['Animation Engine',      'Framer Motion'],
  ['Architectural Suite',   'ArchionLabs v4.0 (MARL + ISO 21542:2011)'],
  ['Governance',            'DAO-weighted token voting'],
  ['Smart Contracts',       'EVM-compatible (ERC-20 shares, SBT badges)'],
];

export default function AboutPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pt-8 pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-8">
        <motion.div variants={CA_STAGGER} initial="hidden" animate="show">

          {/* ── HERO ─────────────────────────────────────────────── */}
          <motion.div variants={CA_ITEM_HERO} className="mb-20 border-b border-[var(--border-dark)] pb-16">
            <p className="text-[8px] font-mono uppercase tracking-[0.35em] text-[var(--rolex-gold)] mb-4 font-bold flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[var(--rolex-gold)] rounded-full animate-pulse" />
              Protocol Documentation v5.0
            </p>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white uppercase leading-none mb-6">
              Built on<br />
              <span className="text-[var(--rolex-gold)]">Fidelity.</span>
            </h1>

            <p className="text-base text-[var(--text-secondary)] leading-relaxed max-w-2xl mb-10 font-light">
              Tokenly is not a marketplace. It is a trust protocol. The marketplace is a byproduct of getting trust right. Every design decision, every algorithmic weight, every economic incentive has been engineered around a single axiom: <strong className="text-white font-medium">when people have something real to lose, they tell the truth.</strong>
            </p>

            {/* Protocol stats strip */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-px bg-[var(--border-dark)] border border-[var(--border-dark)]">
              {STATS.map(s => (
                <div key={s.label} className="bg-[#050505] p-4">
                  <p className="text-[7px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-1.5 font-bold">{s.label}</p>
                  <p className="text-[10px] font-mono font-bold text-white">{s.value}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── THE PROBLEM ──────────────────────────────────────── */}
          <motion.div variants={CA_ITEM} className="mb-20">
            <div className="border-l-2 border-[var(--rolex-gold)] pl-8">
              <p className="text-[8px] font-mono uppercase tracking-[0.3em] text-[var(--rolex-gold)] font-bold mb-4">
                01 — The Problem
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-white uppercase mb-6 leading-tight">
                Every Authentication System Has Been Compromised by Incentive Misalignment.
              </h2>
              <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed max-w-3xl">
                <p>
                  The global market for counterfeit luxury goods exceeds $500 billion annually. The standard response has been certification bodies, expert authenticators, and third-party verification services. All of these approaches share the same fatal flaw: the authenticator has no financial skin in the game. They are paid a fee regardless of whether their verdict is correct. Their reputation may suffer from errors, but reputation is easily managed, gamed, and recovered from.
                </p>
                <p>
                  Existing digital authentication platforms compound this problem. They use star ratings, review counts, and follower numbers as proxies for trust — mechanisms that are trivially gameable and historically compromised within months of launch. A high star rating tells you nothing about whether the reviewer had anything at stake when they gave it.
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── THE PROTOCOL PILLARS ─────────────────────────────── */}
          <motion.div variants={CA_ITEM} className="mb-20">
            <p className="text-[8px] font-mono uppercase tracking-[0.3em] text-[var(--rolex-gold)] font-bold mb-4">
              02 — Architecture
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-white uppercase mb-10 leading-tight">
              Four Pillars of Enforced Truth.
            </h2>

            <div className="space-y-4">
              {PILLARS.map((pillar, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, type: 'spring', stiffness: 200, damping: 24 }}
                  className="border border-[var(--border-dark)] bg-[#050505] p-7 group hover:border-white/10 transition-colors relative overflow-hidden"
                >
                  {/* Number watermark */}
                  <div className="absolute top-4 right-6 text-[4rem] font-mono font-bold leading-none text-white/[0.025] select-none pointer-events-none group-hover:text-white/[0.04] transition-colors">
                    {pillar.number}
                  </div>

                  <div className="flex items-start gap-5 relative z-10">
                    <div
                      className="w-10 h-10 border flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ color: pillar.color, borderColor: pillar.color + '44', background: pillar.color + '10' }}
                    >
                      {pillar.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[7px] font-mono uppercase tracking-[0.25em] font-bold mb-1.5" style={{ color: pillar.color }}>
                        {pillar.tagline}
                      </p>
                      <h3 className="text-base font-bold text-white uppercase tracking-tight mb-3">{pillar.title}</h3>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{pillar.body}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ── MISSION STATEMENT ────────────────────────────────── */}
          <motion.div variants={CA_ITEM} className="mb-20">
            <div className="bg-gradient-to-br from-[var(--rolex-gold)]/8 to-transparent border border-[var(--rolex-gold)]/20 p-10 text-center">
              <p className="text-[8px] font-mono uppercase tracking-[0.35em] text-[var(--rolex-gold)] font-bold mb-6">
                Protocol Mission
              </p>
              <blockquote className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight max-w-3xl mx-auto mb-6">
                "To make honesty the economically rational choice — not by appeal to conscience, but by making dishonesty materially expensive."
              </blockquote>
              <p className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                — Tokenly Protocol Charter, Article I
              </p>
            </div>
          </motion.div>

          {/* ── TECHNICAL STACK ──────────────────────────────────── */}
          <motion.div variants={CA_ITEM} className="mb-20">
            <p className="text-[8px] font-mono uppercase tracking-[0.3em] text-[var(--rolex-gold)] font-bold mb-4">
              03 — Technical Foundation
            </p>
            <h2 className="text-3xl font-bold tracking-tighter text-white uppercase mb-8">
              Protocol Stack.
            </h2>

            <div className="border border-[var(--border-dark)] overflow-hidden">
              {TECH_STACK.map(([layer, impl], i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-6 py-4 border-b border-[var(--border-dark)] last:border-b-0 hover:bg-white/[0.02] transition-colors ${
                    i % 2 === 0 ? 'bg-[#050505]' : 'bg-[#070707]'
                  }`}
                >
                  <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] font-bold">{layer}</span>
                  <span className="text-[10px] font-mono text-white font-medium">{impl}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── CTA ──────────────────────────────────────────────── */}
          <motion.div variants={CA_ITEM} className="border-t border-[var(--border-dark)] pt-16 text-center">
            <p className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-8 max-w-sm mx-auto leading-relaxed">
              The protocol is open. Every decision is logged. Every verdict is staked. Join as a node.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-3 px-10 py-4 bg-[var(--rolex-gold)] text-black text-[10px] font-bold font-mono tracking-[0.25em] uppercase hover:bg-white transition-colors"
              >
                Access Protocol <ArrowRight size={14} />
              </button>
              <button
                onClick={() => router.push('/explorer')}
                className="flex items-center gap-3 px-10 py-4 border border-[var(--border-dark)] text-white text-[10px] font-mono tracking-[0.2em] uppercase hover:bg-white/5 hover:border-white/20 transition-colors"
              >
                View Public Ledger
              </button>
            </div>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
}

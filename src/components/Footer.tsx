'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';

// ── Live protocol status check ──────────────────────────────────────────────
function ProtocolStatusDot() {
  const [status, setStatus] = useState<'online' | 'degraded' | 'checking'>('checking');

  useEffect(() => {
    // Ping the ticker endpoint; if it responds, protocol is online
    const check = () =>
      fetch('/api/ticker', { method: 'HEAD', cache: 'no-store' })
        .then(() => setStatus('online'))
        .catch(() => setStatus('degraded'));
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);

  const cfg = {
    online:   { label: 'ALL SYSTEMS OPERATIONAL', color: '#22c55e', pulse: true  },
    degraded: { label: 'DEGRADED PERFORMANCE',    color: '#f97316', pulse: false },
    checking: { label: 'CONNECTING...',            color: '#6b7280', pulse: true  },
  }[status];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-1.5 h-1.5 rounded-full ${cfg.pulse ? 'animate-pulse' : ''}`}
        style={{ background: cfg.color }}
      />
      <span className="text-[7px] font-mono uppercase tracking-[0.22em] font-bold" style={{ color: cfg.color }}>
        {cfg.label}
      </span>
    </div>
  );
}

// ── Navigation columns ──────────────────────────────────────────────────────
const NAV_COLUMNS = [
  {
    heading: 'Protocol',
    links: [
      { href: '/dashboard',   label: 'Command Hub'        },
      { href: '/products',    label: 'Asset Registry'      },
      { href: '/vault',       label: 'Vault Positions'     },
      { href: '/market',      label: 'Market Orders'       },
      { href: '/portfolio',   label: 'Portfolio'           },
    ],
  },
  {
    heading: 'Intelligence',
    links: [
      { href: '/analytics',   label: 'Analytics Hub'       },
      { href: '/leaderboard', label: 'Leaderboard Index'   },
      { href: '/can',         label: 'CAN Network'         },
      { href: '/archionlabs?portfolio=1', label: 'Tokenly Build Suite' },
      { href: '/explorer',    label: 'Public Ledger'       },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/about',       label: 'About Protocol'      },
      { href: '/terms',       label: 'Terms of Service'    },
      { href: '/explorer',    label: 'Proof-of-Trust Log'  },
    ],
  },
];

export default function Footer() {
  const pathname = usePathname();

  // No footer on the landing page — it has its own bottom strip
  if (pathname === '/') return null;

  return (
    <footer className="relative z-20 border-t border-[var(--border-dark)] mt-auto">
      {/* Top gold accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-[var(--rolex-gold)]/25 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-14 pb-8">

        {/* ── Main footer grid ──────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-12 mb-12">

          {/* Left — brand block */}
          <div className="max-w-sm">
            {/* Wordmark */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 border border-[var(--rolex-gold)]/40 bg-[var(--rolex-gold)]/8 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 21L3 12L12 3L21 12L12 21Z" stroke="#a37e2c" strokeWidth="1.5"/>
                  <path d="M12 17L8 12L12 7L16 12L12 17Z" fill="#a37e2c" fillOpacity="0.3"/>
                </svg>
              </div>
              <div>
                <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-white font-bold leading-none">
                  TOKENLY PROTOCOL
                </p>
                <p className="text-[7px] font-mono uppercase tracking-[0.2em] text-[var(--text-muted)] mt-0.5">
                  V5.0 — INSTITUTIONAL
                </p>
              </div>
            </div>

            <p className="text-[10px] font-mono text-[var(--text-muted)] leading-relaxed mb-5 max-w-[280px]">
              The trust infrastructure for physical asset tokenization. Every item authenticated before listing. Price set by staked reviewers — not sellers.
            </p>

            {/* Live protocol status */}
            <ProtocolStatusDot />
          </div>

          {/* Right — navigation columns */}
          <div className="grid grid-cols-3 gap-10">
            {NAV_COLUMNS.map(col => (
              <div key={col.heading}>
                <p className="text-[7px] font-mono uppercase tracking-[0.3em] text-[var(--rolex-gold)] font-bold mb-4">
                  {col.heading}
                </p>
                <ul className="space-y-2.5">
                  {col.links.map(link => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-[9px] font-mono uppercase tracking-[0.18em] text-[var(--text-muted)] hover:text-white transition-colors font-medium flex items-center gap-1.5 group"
                      >
                        {link.label}
                        {link.href === '/archionlabs' && (
                          <ExternalLink
                            size={9}
                            className="opacity-0 group-hover:opacity-60 transition-opacity"
                          />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ── Protocol philosophy divider ─────────────────────── */}
        <div className="border-t border-[var(--border-dark)] pt-8 mb-8">
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-[0.25em] text-center leading-relaxed max-w-2xl mx-auto"
          >
            "Authenticity is not a feature — it is the foundation. Capital bonded, reputation staked, truth enforced by economic consequence."
          </motion.p>
        </div>

        {/* ── Bottom bar ───────────────────────────────────────── */}
        <div className="border-t border-[var(--border-dark)] pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-[8px] font-mono uppercase tracking-[0.2em] text-[var(--text-muted)]">
            © {new Date().getFullYear()} Tokenly Luxury · All rights reserved · Institutional use only
          </p>

          <div className="flex items-center gap-6">
            {/* Protocol version badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 border border-[var(--border-dark)] bg-[#0A0A0A]">
              <span className="w-1 h-1 bg-[var(--rolex-gold)] rounded-full" />
              <span className="text-[7px] font-mono uppercase tracking-[0.22em] text-[var(--text-muted)] font-bold">
                Protocol V5.0
              </span>
            </div>
            {/* Legal links */}
            {[{ href: '/terms', label: 'Terms' }, { href: '/about', label: 'About' }].map(l => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[8px] font-mono uppercase tracking-[0.2em] text-[var(--text-muted)] hover:text-[var(--rolex-gold)] transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ExternalLink, ArrowLeft, Sparkles } from 'lucide-react';
import { PORTFOLIO_DEMO_LINKS } from '@/lib/portfolio-demo-seeds';

const PORTFOLIO_URL =
  process.env.NEXT_PUBLIC_PORTFOLIO_URL ?? 'https://chenitha.net';

const APP_BASE =
  typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

function activeDemoId(pathname: string, tab: string | null): string | null {
  if (pathname.startsWith('/market')) return 'wisdom';
  if (pathname.startsWith('/compliance-stack')) return 'compliance_stack';
  if (!pathname.startsWith('/archionlabs')) return null;
  if (tab === 'sim') return 'sim';
  if (tab === 'compliance') return 'compliance';
  if (tab === 'viewer') return 'viewer';
  return 'build';
}

function PortfolioDemoBarInner({ feature }: { feature?: string }) {
  const pathname = usePathname();
  const tab = useSearchParams().get('tab');
  const current = activeDemoId(pathname, tab);

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] border-b border-[var(--rolex-gold)]/50 bg-[#050505]/97 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--rolex-gold)]/15 border border-[var(--rolex-gold)]/40 text-[7px] font-mono uppercase tracking-[0.2em] text-[var(--rolex-gold)] font-bold shrink-0">
              <Sparkles size={10} />
              Live Demo
            </span>
            <span className="text-[9px] font-mono text-[var(--text-muted)] truncate">
              Chenitha Ranasinghe · chenitha.net
              {feature ? ` · ${feature}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href={PORTFOLIO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 border border-[var(--border-dark)] text-[7px] font-mono uppercase tracking-widest text-[var(--text-secondary)] hover:text-white hover:border-[var(--rolex-gold)]/50 transition-colors"
            >
              <ArrowLeft size={11} />
              Portfolio
            </Link>
            <a
              href={`${PORTFOLIO_URL}/#projects`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--rolex-gold)]/12 border border-[var(--rolex-gold)]/45 text-[var(--rolex-gold)] text-[7px] font-mono uppercase tracking-widest hover:bg-[var(--rolex-gold)]/22 transition-colors"
            >
              <ExternalLink size={11} />
              All Demos
            </a>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {PORTFOLIO_DEMO_LINKS.map((d) => {
            const href = `${APP_BASE || ''}${d.href}`;
            const isActive = current === d.id;
            return (
              <a
                key={d.id}
                href={href}
                className={`shrink-0 px-2.5 py-1 text-[7px] font-mono uppercase tracking-wider border transition-colors ${
                  isActive
                    ? 'bg-[var(--rolex-gold)]/20 border-[var(--rolex-gold)]/60 text-[var(--rolex-gold)]'
                    : 'border-[var(--border-dark)] text-[var(--text-muted)] hover:text-white hover:border-white/20'
                }`}
              >
                {d.label}
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PortfolioDemoBar({ feature }: { feature?: string }) {
  return (
    <Suspense
      fallback={
        <div className="fixed top-0 left-0 right-0 z-[200] h-14 border-b border-[var(--rolex-gold)]/30 bg-[#050505]/95" />
      }
    >
      <PortfolioDemoBarInner feature={feature} />
    </Suspense>
  );
}

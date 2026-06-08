'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PortfolioDemoBar } from '@/components/archionlabs/PortfolioDemoBar';
import { motion } from 'framer-motion';
import { CA_STAGGER, CA_ITEM } from '@/lib/animations';
import { BarChart3, TrendingUp, Shield, Globe, Cpu } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Skeleton } from '@/components/shared/Skeleton';
import { authFetch } from '@/lib/client';
import { PORTFOLIO_WISDOM_WEIGHTS } from '@/lib/portfolio-demo-data';
import { usePortfolioDemoChrome } from '@/lib/use-portfolio-demo';

interface MarketReport {
  headline: string;
  summary: string;
  top_performer_analysis: string;
  category_trends: Array<{
    category: string;
    sentiment: 'bullish' | 'bearish';
    insight: string;
  }>;
  macro_outlook: string;
  protocol_health: 'stable' | 'expanding' | 'contracting';
  next_week_forecast: string;
  generated_at?: string;
}

function MarketReportPage() {
  const portfolioMode = usePortfolioDemoChrome();
  const [report, setReport] = useState<MarketReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = portfolioMode ? '/api/wisdom/report?portfolio=1' : '/api/wisdom/report';
    const fetcher = portfolioMode ? fetch : authFetch;
    fetcher(url)
      .then(r => r.json())
      .then(d => {
        if (d.success) setReport(d.report);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [portfolioMode]);

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white pt-20 pb-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-12 border-l-2 border-[var(--rolex-gold)]/20 pl-8">
          <Skeleton height="10px" width="200px" className="mb-4" />
          <Skeleton height="60px" width="80%" className="mb-4" />
          <Skeleton height="20px" width="60%" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Skeleton height="150px" />
          <Skeleton height="150px" />
          <Skeleton height="150px" />
        </div>
        <Skeleton height="300px" className="mb-12" />
        <Skeleton height="200px" />
      </div>
    </div>
  );

  if (!report) {
    return (
      <div className="min-h-screen bg-[#050505] text-white pt-20 pb-20 px-4 flex items-center justify-center">
        <p className="text-sm font-mono text-[var(--text-muted)] uppercase tracking-widest">No intelligence report available.</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[#050505] text-white pb-20 px-4 ${portfolioMode ? 'pt-[88px]' : 'pt-20'}`}>
      {portfolioMode && <PortfolioDemoBar feature="Wisdom Engine · Market Report" />}
      <div className="max-w-5xl mx-auto">
        <motion.div variants={CA_STAGGER} initial="hidden" animate="show">
          
          <motion.div variants={CA_ITEM} className="mb-12 border-l-2 border-[var(--rolex-gold)] pl-8">
            <div className="text-[10px] font-mono text-[var(--rolex-gold)] tracking-[0.4em] uppercase mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-[var(--rolex-gold)] rounded-full animate-pulse" />
              Intelligence Report // SEC-ALPHA-01
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 uppercase">
              {report.headline}
            </h1>
            <p className="text-xl text-[var(--text-muted)] max-w-3xl leading-relaxed">
              {report.summary}
            </p>
          </motion.div>

          {portfolioMode && (
            <motion.div variants={CA_ITEM} className="mb-10 border border-[var(--rolex-gold)]/20 bg-[#0A0A0A] p-8">
              <h3 className="text-[10px] font-mono text-[var(--rolex-gold)] uppercase tracking-[0.3em] mb-6">
                Wisdom Engine · Four-Source Weight Model
              </h3>
              <div className="space-y-4">
                {PORTFOLIO_WISDOM_WEIGHTS.map(w => (
                  <div key={w.source}>
                    <div className="flex justify-between text-[9px] font-mono uppercase tracking-wider mb-1.5">
                      <span className="text-[var(--text-secondary)]">{w.source}</span>
                      <span style={{ color: w.color }}>{w.weight}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${w.weight}%`, backgroundColor: w.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                Dual-trigger anomaly: Z &gt; 3.0σ · price shift &gt; 40% · MAS / GDPR / PDPA aligned
              </p>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <motion.div variants={CA_ITEM} className="bg-[#0A0A0A] border border-white/5 p-8">
              <Shield className="text-[var(--rolex-gold)] mb-4" size={24} />
              <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase mb-2">Protocol Health</div>
              <div className="text-2xl font-bold uppercase tracking-widest">{report.protocol_health}</div>
            </motion.div>
            <motion.div variants={CA_ITEM} className="bg-[#0A0A0A] border border-white/5 p-8">
              <Globe className="text-[var(--rolex-gold)] mb-4" size={24} />
              <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase mb-2">Market Sentiment</div>
              <div className="text-2xl font-bold uppercase tracking-widest">Bullish</div>
            </motion.div>
            <motion.div variants={CA_ITEM} className="bg-[#0A0A0A] border border-white/5 p-8">
              <Cpu className="text-[var(--rolex-gold)] mb-4" size={24} />
              <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase mb-2">Next Week Forecast</div>
              <div className="text-sm font-mono text-[var(--text-muted)] mt-2">{report.next_week_forecast}</div>
            </motion.div>
          </div>

          <motion.div variants={CA_ITEM} className="bg-[#0A0A0A] border border-white/5 p-10 mb-12">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-3">
              <TrendingUp className="text-[var(--rolex-gold)]" size={20} />
              Institutional Trend Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {report.category_trends.map((t, i) => (
                <div key={i} className="border-l border-white/10 pl-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-mono text-[var(--rolex-gold)] uppercase tracking-widest">{t.category}</span>
                    <span className={`text-[8px] font-mono uppercase px-2 py-0.5 border ${t.sentiment === 'bullish' ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'}`}>
                      {t.sentiment}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed">{t.insight}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={CA_ITEM} className="bg-[var(--rolex-gold)]/5 border border-[var(--rolex-gold)]/20 p-10">
            <h3 className="text-lg font-bold mb-4">Llama-3.3 70B Global Insight</h3>
            <p className="text-[var(--text-muted)] leading-loose italic">
              <span className="not-italic">&ldquo;</span>
              {report.macro_outlook}
              <span className="not-italic">&rdquo;</span>
            </p>
            <div className="mt-8 text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-[0.2em]">
              Generated at {new Date(report.generated_at ?? Date.now()).toLocaleString()}
              {' '}
              <span className="text-[var(--text-muted)]">— Tokenly Wisdom Engine V5</span>
            </div>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
}

export default function MarketPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Loading market intelligence…" />}>
      <MarketReportPage />
    </Suspense>
  );
}

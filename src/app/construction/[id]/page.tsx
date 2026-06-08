'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, ChevronLeft, MapPin, Box, ArrowRight, ShieldCheck, Hammer, Clock, AlertCircle } from 'lucide-react';
import { authFetch } from '@/lib/client';
import { Building3DView } from '@/components/archionlabs/Building3DView';
import type { ConstructionProject } from '@/lib/types';

interface BidRow {
  id: string;
  company_name: string;
  crs_score: number;
  fixed_price_lkr: number;
  earliest_weeks: number;
  latest_weeks: number;
  confidence: number;
  status: string;
}

interface MilestoneRow {
  id: string;
  name: string;
  pct_value: number;
  status: string;
}

const CA_STAGGER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
} as const;

const CA_ITEM = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
} as const;



export default function ConstructionProjectPage() {
  const params = useParams();
  const id = String(params.id ?? '');
  const [project, setProject] = useState<ConstructionProject | null>(null);
  const [bids, setBids] = useState<BidRow[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/construction/projects/${id}`);
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? 'Not found'); return; }
      setProject(data.project);
      setBids(data.bids ?? []);
      setMilestones(data.milestones ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function acceptBid(bidId: string) {
    const res = await authFetch(`/api/construction/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept_bid', bid_id: bidId }),
    });
    const data = await res.json();
    setMsg(res.ok ? 'Winning bid accepted. Contract initiated.' : data.error ?? 'Failed');
    load();
  }

  async function verifyMilestone(milestoneId: string) {
    const res = await authFetch(`/api/construction/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_milestone', milestone_id: milestoneId }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Milestone verified. ${data.unlocked_pct}% value unlocked.` : data.error ?? 'Failed');
    load();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-[var(--text-muted)] text-[10px] font-mono uppercase tracking-widest animate-pulse">Syncing Block Data...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] p-10 flex flex-col items-center justify-center">
        <p className="text-[12px] font-mono text-[var(--rolex-gold)] uppercase tracking-widest mb-6">{msg || 'Project not found'}</p>
        <Link href="/construction" className="px-6 py-3 border border-[var(--border-dark)] hover:border-[var(--rolex-gold)] hover:text-[var(--rolex-gold)] text-[10px] font-mono uppercase tracking-widest transition-colors flex items-center gap-2">
          <ChevronLeft size={12} /> Return to Marketplace
        </Link>
      </div>
    );
  }

  const hasModel = !!project.floor_plan_json;
  let parsedPlan = null;
  if (hasModel) {
    try { parsedPlan = JSON.parse(project.floor_plan_json!); } catch(e) {}
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-white pt-8 pb-24 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        
        <Link href="/construction" className="inline-flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--rolex-gold)] mb-8 transition-colors">
          <ChevronLeft size={12} /> Pre-Construction Market
        </Link>

        <motion.div variants={CA_STAGGER} initial="hidden" animate="show" className="grid lg:grid-cols-[1fr_400px] gap-8">
          
          {/* Main Content Area */}
          <div className="space-y-8">
            <motion.div variants={CA_ITEM}>
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-3xl font-light tracking-wide">{project.title}</h1>
                <div className="px-3 py-1 bg-[#050505] border border-[var(--border-dark)] text-[10px] font-mono text-[var(--rolex-gold)] uppercase tracking-widest">
                  {project.status.replace('_', ' ')}
                </div>
              </div>
              <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-4">
                <span className="flex items-center gap-1.5"><MapPin size={12} /> {project.district}</span>
                <span className="flex items-center gap-1.5"><Box size={12} /> Tokenized: {project.token_minted ? 'Yes' : 'No'}</span>
                <span className={`flex items-center gap-1.5 ${project.legal_status === 'approved' ? 'text-green-500' : 'text-orange-500'}`}>
                  <ShieldCheck size={12} /> UDA: {project.legal_status}
                </span>
              </p>
            </motion.div>

            {msg && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 border border-[var(--rolex-gold)]/30 bg-[var(--rolex-gold)]/5 flex items-center gap-3 text-[11px] font-mono text-[var(--rolex-gold)]">
                <CheckCircle2 size={16} /> {msg}
              </motion.div>
            )}

            {/* 3D Visualizer */}
            <motion.div variants={CA_ITEM} className="border border-[var(--border-dark)] bg-black/40 overflow-hidden relative h-[450px]">
              {parsedPlan ? (
                <Building3DView result={parsedPlan} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text-muted)] gap-4">
                  <Box size={48} strokeWidth={1} />
                  <p className="text-[10px] font-mono uppercase tracking-widest">No 3D Model Attached</p>
                  <Link href={`/archionlabs?constructionProject=${project.id}`} className="px-4 py-2 border border-[var(--rolex-gold)] text-[var(--rolex-gold)] text-[9px] font-mono uppercase tracking-widest hover:bg-[var(--rolex-gold)] hover:text-black transition-colors">
                    Initialize in ArchionLabs
                  </Link>
                </div>
              )}
            </motion.div>

            {/* Bids Section */}
            <motion.div variants={CA_ITEM}>
              <h2 className="text-[11px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] flex items-center gap-2 mb-4">
                <Hammer size={14} /> Submitted Bids ({bids.length})
              </h2>
              {bids.length === 0 ? (
                <div className="p-8 border border-dashed border-[var(--border-dark)] text-center text-[10px] font-mono uppercase tracking-widest text-[var(--text-secondary)]">
                  Awaiting institutional contractor bids.
                </div>
              ) : (
                <div className="space-y-3">
                  {bids.map(b => (
                    <div key={b.id} className="p-5 border border-[var(--border-dark)] bg-black/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-[var(--rolex-gold)]/50 transition-colors">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium tracking-wide">{b.company_name}</h3>
                          {b.status === 'accepted' && (
                            <span className="px-2 py-0.5 bg-green-500/10 text-green-500 border border-green-500/20 text-[8px] font-mono uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={10} /> Contracted</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-[9px] font-mono uppercase tracking-widest text-[var(--text-secondary)]">
                          <span>CRS Score: <span className="text-[var(--rolex-gold)]">{b.crs_score}</span></span>
                          <span className="flex items-center gap-1"><Clock size={10} /> {b.earliest_weeks} – {b.latest_weeks} wks</span>
                          <span className="flex items-center gap-1"><AlertCircle size={10} /> {b.confidence}% Confidence</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="text-[8px] font-mono uppercase text-[var(--text-muted)] mb-1">Fixed Quote</p>
                          <p className="text-lg font-mono">LKR {b.fixed_price_lkr.toLocaleString()}</p>
                        </div>
                        {b.status === 'submitted' && project.status === 'bidding' && (
                          <button onClick={() => acceptBid(b.id)} className="w-10 h-10 flex items-center justify-center border border-[var(--border-dark)] hover:border-green-500 text-green-500 bg-green-500/5 transition-colors">
                            <ArrowRight size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-8">
            <motion.div variants={CA_ITEM} className="p-6 border border-[var(--border-dark)] bg-black/40">
              <h2 className="text-[11px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-6">Financial Overview</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-1">Base Land Value</p>
                  <p className="text-xl font-mono text-white">LKR {project.estimated_land_value?.toLocaleString() ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-1">Est. Build Cost</p>
                  <p className="text-xl font-mono text-white">LKR {project.estimated_build_cost?.toLocaleString() ?? '—'}</p>
                </div>
                <div className="pt-4 border-t border-[var(--border-dark)]">
                  <p className="text-[9px] font-mono text-[var(--rolex-gold)] uppercase tracking-widest mb-1">Target Yield Value</p>
                  <p className="text-2xl font-mono text-[var(--rolex-gold)]">LKR {project.estimated_finished_value?.toLocaleString() ?? '—'}</p>
                </div>
              </div>
            </motion.div>

            {/* Milestones */}
            <motion.div variants={CA_ITEM} className="p-6 border border-[var(--border-dark)] bg-black/40">
              <h2 className="text-[11px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-6">Construction Milestones</h2>
              {milestones.length === 0 ? (
                <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest text-center py-4">Awaiting Legal Approval</p>
              ) : (
                <div className="relative">
                  <div className="absolute top-0 bottom-0 left-[11px] w-px bg-[var(--border-dark)]" />
                  <ul className="space-y-6">
                    {milestones.map((m, i) => (
                      <li key={m.id} className="relative pl-8">
                        <div className={`absolute left-0 top-1 w-[23px] h-[23px] rounded-full flex items-center justify-center bg-black border ${m.status === 'verified' ? 'border-green-500' : 'border-[var(--border-dark)]'}`}>
                          {m.status === 'verified' ? <CheckCircle2 size={12} className="text-green-500" /> : <div className="w-1.5 h-1.5 rounded-full bg-[var(--border-dark)]" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium tracking-wide mb-1 flex justify-between">
                            <span>{m.name}</span>
                            <span className="text-[10px] font-mono text-[var(--rolex-gold)]">{m.pct_value}%</span>
                          </p>
                          {m.status === 'pending' ? (
                            <button onClick={() => verifyMilestone(m.id)} className="text-[8px] font-mono uppercase border border-[var(--rolex-gold)] text-[var(--rolex-gold)] px-2 py-1 mt-1 hover:bg-[var(--rolex-gold)] hover:text-black transition-colors">
                              Simulate Verification
                            </button>
                          ) : (
                            <span className="text-[8px] font-mono text-green-500 uppercase tracking-widest">Unlocked & Paid</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          </div>

        </motion.div>
      </div>
    </div>
  );
}

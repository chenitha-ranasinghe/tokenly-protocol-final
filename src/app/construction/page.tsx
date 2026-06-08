'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Building, Hammer, MapPin, CheckCircle2, AlertCircle, TrendingUp, Clock, ShieldCheck, ChevronRight } from 'lucide-react';
import { authFetch } from '@/lib/client';
import type { ConstructionCompany, ConstructionProject } from '@/lib/types';
import { Building3DView } from '@/components/archionlabs/Building3DView';

const DISTRICTS = ['Colombo', 'Gampaha', 'Kandy', 'Galle', 'Jaffna'];

const CA_STAGGER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
} as const;
const CA_ITEM = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
} as const;

export default function ConstructionPage() {
  const [tab, setTab] = useState<'marketplace' | 'mine' | 'company'>('marketplace');
  const [projects, setProjects] = useState<ConstructionProject[]>([]);
  const [myProjects, setMyProjects] = useState<ConstructionProject[]>([]);
  const [company, setCompany] = useState<ConstructionCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const [newTitle, setNewTitle] = useState('');
  const [newDistrict, setNewDistrict] = useState('Colombo');
  const [companyName, setCompanyName] = useState('');
  
  // Bidding form state
  const [bidProjectId, setBidProjectId] = useState('');
  const [bidPrice, setBidPrice] = useState('');
  const [biddingProjectName, setBiddingProjectName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mkt, mine, co] = await Promise.all([
        fetch('/api/construction/projects?marketplace=1').then((r) => r.json()),
        authFetch('/api/construction/projects?mine=1').then((r) => r.json()),
        authFetch('/api/construction/companies?mine=1').then((r) => r.json()),
      ]);
      setProjects(mkt.projects ?? []);
      setMyProjects(mine.projects ?? []);
      setCompany(co.company ?? null);
    } catch {
      setMsg('Failed to load data. Sign in for full access.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createProject() {
    setMsg('');
    const res = await authFetch('/api/construction/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, district: newDistrict }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error ?? 'Create failed'); return; }
    setNewTitle('');
    setMsg('Project created. Open ArchionLabs to add design & compliance.');
    load();
    setTab('mine');
  }

  async function registerCompany() {
    const res = await authFetch('/api/construction/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name: companyName, district: newDistrict }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error ?? 'Registration failed'); return; }
    setCompany(data.company);
    setMsg('Construction company registered.');
  }

  async function submitBid() {
    if (!company) { setMsg('Register your company first.'); return; }
    const res = await authFetch('/api/construction/bids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: bidProjectId,
        company_id: company.id,
        fixed_price_lkr: Number(bidPrice),
      }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error ?? 'Bid failed'); return; }
    setMsg(`Bid submitted. Timeline: ${data.bid.earliest_weeks}–${data.bid.latest_weeks} weeks (${data.bid.confidence}% confidence).`);
    setBidProjectId(''); setBidPrice(''); setBiddingProjectName('');
    load();
  }

  async function projectAction(id: string, action: string) {
    const res = await authFetch(`/api/construction/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error ?? 'Action failed'); return; }
    setMsg(`OK: ${action.replace('_', ' ')}`);
    load();
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-white pt-8 pb-24 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[700px] h-[400px] bg-[var(--rolex-gold)]/[0.03] blur-[120px] rounded-full" />
        <div className="absolute bottom-40 right-1/4 w-[500px] h-[350px] bg-blue-500/[0.03] blur-[100px] rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <motion.div variants={CA_STAGGER} initial="hidden" animate="show">
          
          {/* Header */}
          <motion.div variants={CA_ITEM} className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 flex items-center justify-center border border-[var(--rolex-gold)]/30 bg-[var(--rolex-gold)]/5 text-[var(--rolex-gold)] shadow-[0_0_20px_rgba(163,126,44,0.15)]">
                <Building size={24} />
              </div>
              <div>
                <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-[var(--rolex-gold)] mb-1 font-bold">Tokenly Real Estate</p>
                <h1 className="text-3xl font-light tracking-tight leading-none">Pre-Construction Market</h1>
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
              Where physical land meets tokenized capital. Landowners list UDA-approved designs directly from <Link href="/archionlabs" className="text-[var(--rolex-gold)] underline hover:text-[var(--rolex-gold)]/80 transition-colors">ArchionLabs</Link>. Verified construction companies submit transparent bids with algorithmically protected timelines.
            </p>
          </motion.div>

          {/* Navigation Tabs */}
          <motion.div variants={CA_ITEM} className="flex border-b border-[var(--border-dark)] mb-8 overflow-x-auto hide-scrollbar">
            {([
              { id: 'marketplace', label: 'Open Projects', icon: MapPin },
              { id: 'mine', label: 'My Land Assets', icon: Building },
              { id: 'company', label: 'Contractor Hub', icon: Hammer }
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-6 py-4 text-[10px] font-mono uppercase tracking-widest transition-all whitespace-nowrap relative ${
                  tab === t.id ? 'text-[var(--rolex-gold)]' : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                <t.icon size={14} /> {t.label}
                {tab === t.id && (
                  <motion.div layoutId="const-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--rolex-gold)]" />
                )}
              </button>
            ))}
          </motion.div>

          {/* Notifications */}
          <AnimatePresence>
            {msg && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 p-4 border border-[var(--rolex-gold)]/30 bg-[var(--rolex-gold)]/5 flex items-center gap-3 text-[11px] font-mono text-[var(--rolex-gold)]">
                <CheckCircle2 size={16} /> {msg}
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="py-20 text-center text-[var(--text-muted)] text-[10px] font-mono uppercase tracking-widest animate-pulse">
              Syncing Ledger...
            </div>
          ) : (
            <motion.div variants={CA_STAGGER} initial="hidden" animate="show" className="min-h-[400px]">
              
              {/* === TAB 1: MARKETPLACE === */}
              {tab === 'marketplace' && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {projects.length === 0 ? (
                    <div className="col-span-full py-16 text-center border border-dashed border-[var(--border-dark)] text-[var(--text-secondary)] text-[11px] font-mono uppercase tracking-widest">
                      No open projects currently available for bidding.
                    </div>
                  ) : projects.map(p => (
                    <MarketProjectCard key={p.id} project={p} onBid={() => { setTab('company'); setBidProjectId(p.id); setBiddingProjectName(p.title); }} />
                  ))}
                </div>
              )}

              {/* === TAB 2: MY LAND === */}
              {tab === 'mine' && (
                <div className="grid md:grid-cols-[350px_1fr] gap-8">
                  {/* Create Project Form */}
                  <div className="space-y-4">
                    <div className="p-6 border border-[var(--border-dark)] bg-black/40 backdrop-blur-md">
                      <h2 className="text-[11px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] flex items-center gap-2 mb-6">
                        <PlusSquareIcon /> Initialize Project
                      </h2>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[9px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">Project Designation</label>
                          <input
                            value={newTitle} onChange={e => setNewTitle(e.target.value)}
                            className="w-full bg-black/50 border border-[var(--border-dark)] focus:border-[var(--rolex-gold)] text-white text-sm px-4 py-2.5 transition-colors outline-none"
                            placeholder="e.g. Skyline Residence Phase 1"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">Jurisdiction</label>
                          <select
                            value={newDistrict} onChange={e => setNewDistrict(e.target.value)}
                            className="w-full bg-black/50 border border-[var(--border-dark)] focus:border-[var(--rolex-gold)] text-white text-sm px-4 py-2.5 transition-colors outline-none"
                          >
                            {DISTRICTS.map(d => <option key={d} value={d} className="bg-black">{d}</option>)}
                          </select>
                        </div>
                        <button
                          onClick={createProject}
                          disabled={!newTitle}
                          className="w-full py-3 bg-[var(--rolex-gold)] text-black text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-[var(--rolex-gold)]/90 transition-colors disabled:opacity-50 mt-2"
                        >
                          Initialize Asset →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* My Projects List */}
                  <div className="space-y-4">
                    {myProjects.length === 0 ? (
                      <div className="py-16 text-center border border-dashed border-[var(--border-dark)] text-[var(--text-secondary)] text-[11px] font-mono uppercase tracking-widest">
                        You have not initialized any land assets.
                      </div>
                    ) : myProjects.map(p => (
                      <OwnerProjectCard key={p.id} project={p} onAction={a => projectAction(p.id, a)} />
                    ))}
                  </div>
                </div>
              )}

              {/* === TAB 3: CONTRACTOR === */}
              {tab === 'company' && (
                <div className="grid lg:grid-cols-[1fr_380px] gap-8">
                  {company ? (
                    <div className="space-y-6">
                      <div className="p-6 border border-[var(--rolex-gold)]/20 bg-black/40 backdrop-blur-md">
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <h2 className="text-xl font-light tracking-wide mb-1">{company.company_name}</h2>
                            <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-2">
                              <MapPin size={10} /> {company.district} · Verified Entity
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-mono text-[var(--text-secondary)] uppercase tracking-widest mb-1">CRS Score</p>
                            <p className="text-2xl font-mono text-[var(--rolex-gold)]">{company.crs_score}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-[var(--border-dark)]">
                          <StatBox label="On-Time Rate" value={`${company.on_time_rate}%`} icon={Clock} />
                          <StatBox label="Cost Accuracy" value={`${company.cost_accuracy}%`} icon={TrendingUp} />
                          <StatBox label="Milestones" value={`${company.milestone_adherence}%`} icon={CheckCircle2} />
                          <StatBox label="Projects" value={`${company.total_projects}`} icon={Building} />
                        </div>
                      </div>
                      
                      {/* Active Bids / Dashboard would go here */}
                      <div className="p-6 border border-[var(--border-dark)] bg-black/20">
                        <h3 className="text-[11px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-4">Active Contracting Operations</h3>
                        <p className="text-xs text-[var(--text-muted)]">No active construction phases. Submit bids to secure projects.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 border border-[var(--border-dark)] bg-black/40 max-w-md">
                      <h2 className="text-[11px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] mb-6">Register Construction Firm</h2>
                      <div className="space-y-4">
                        <input
                          value={companyName} onChange={e => setCompanyName(e.target.value)}
                          className="w-full bg-black/50 border border-[var(--border-dark)] focus:border-[var(--rolex-gold)] text-white text-sm px-4 py-2.5 transition-colors outline-none"
                          placeholder="Registered Company Name"
                        />
                        <select
                          value={newDistrict} onChange={e => setNewDistrict(e.target.value)}
                          className="w-full bg-black/50 border border-[var(--border-dark)] focus:border-[var(--rolex-gold)] text-white text-sm px-4 py-2.5 transition-colors outline-none"
                        >
                          {DISTRICTS.map(d => <option key={d} value={d} className="bg-black">{d}</option>)}
                        </select>
                        <button
                          onClick={registerCompany} disabled={!companyName}
                          className="w-full py-3 bg-[var(--rolex-gold)] text-black text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-[var(--rolex-gold)]/90 disabled:opacity-50 mt-4"
                        >
                          Register Firm (Requires Staking) →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Bid Submission Form */}
                  <div className="p-6 border border-[var(--border-dark)] bg-[#050505] self-start relative overflow-hidden">
                    {/* Top accent line */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--rolex-gold)]/50 to-transparent" />
                    
                    <h2 className="text-[11px] font-mono uppercase tracking-widest text-white mb-6 flex items-center gap-2">
                      <AlertCircle size={14} className="text-[var(--rolex-gold)]" /> Submit Secure Bid
                    </h2>
                    
                    <div className="space-y-4">
                      {biddingProjectName && (
                         <div className="p-3 bg-[var(--rolex-gold)]/5 border border-[var(--rolex-gold)]/20 mb-2">
                           <p className="text-[9px] font-mono text-[var(--rolex-gold)] uppercase tracking-widest mb-1">Target Project</p>
                           <p className="text-sm">{biddingProjectName}</p>
                         </div>
                      )}
                      <div>
                        <label className="block text-[9px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">Project ID Reference</label>
                        <input
                          value={bidProjectId} onChange={e => setBidProjectId(e.target.value)}
                          className="w-full bg-black border border-[var(--border-dark)] focus:border-[var(--rolex-gold)] text-white text-sm px-4 py-2 text-center font-mono tracking-widest transition-colors outline-none"
                          placeholder="PROJ-..."
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">Fixed Price (LKR)</label>
                        <input
                          value={bidPrice} onChange={e => setBidPrice(e.target.value)} type="number"
                          className="w-full bg-black border border-[var(--border-dark)] focus:border-[var(--rolex-gold)] text-white text-sm px-4 py-2 font-mono transition-colors outline-none"
                          placeholder="e.g. 15000000"
                        />
                      </div>
                      <div className="pt-2 text-[9px] font-mono text-[var(--text-muted)] leading-relaxed">
                        Notice: Timelines are automatically generated by the Tokenly Construction Engine based on your CRS score and historical velocity. A 5% performance bond will be locked upon acceptance.
                      </div>
                      <button
                        onClick={submitBid} disabled={!bidProjectId || !bidPrice}
                        className="w-full py-3 mt-4 border border-[var(--rolex-gold)] text-[var(--rolex-gold)] text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-[var(--rolex-gold)] hover:text-black transition-all disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--rolex-gold)]"
                      >
                        Submit Institutional Bid
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          )}

        </motion.div>
      </div>
    </div>
  );
}

// --- Subcomponents ---

function MarketProjectCard({ project, onBid }: { project: ConstructionProject, onBid: () => void }) {
  const hasModel = !!project.floor_plan_json;
  let parsedPlan = null;
  if (hasModel) {
    try { parsedPlan = JSON.parse(project.floor_plan_json!); } catch(e) {}
  }

  return (
    <motion.div variants={CA_ITEM} className="flex flex-col border border-[var(--border-dark)] bg-black/40 hover:border-[var(--rolex-gold)]/40 transition-colors group overflow-hidden">
      {/* 3D Visualizer or Placeholder */}
      <div className="h-48 bg-[#080808] border-b border-[var(--border-dark)] relative">
        {parsedPlan ? (
          <div className="absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity">
            <Building3DView result={parsedPlan} />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--border-dark)]">
            <Building size={48} strokeWidth={1} />
          </div>
        )}
        <div className="absolute top-3 right-3 px-2 py-1 bg-black/80 border border-[var(--border-dark)] backdrop-blur text-[8px] font-mono uppercase tracking-widest flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> {project.status.replace('_', ' ')}
        </div>
      </div>
      
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="text-lg font-medium tracking-wide mb-1 line-clamp-1">{project.title}</h3>
        <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest mb-4 flex items-center gap-2">
          <MapPin size={10} /> {project.district}
        </p>
        
        <div className="grid grid-cols-2 gap-3 mb-5 mt-auto">
          <div className="bg-[#050505] border border-[var(--border-dark)] p-2">
            <p className="text-[7px] font-mono uppercase text-[var(--text-muted)] mb-1">Legal Status</p>
            <p className={`text-[9px] font-mono uppercase truncate ${project.legal_status === 'approved' ? 'text-green-400' : 'text-orange-400'}`}>
              {project.legal_status}
            </p>
          </div>
          <div className="bg-[#050505] border border-[var(--border-dark)] p-2">
            <p className="text-[7px] font-mono uppercase text-[var(--text-muted)] mb-1">Bids Received</p>
            <p className="text-[10px] font-mono text-white">{project.bid_count ?? 0}</p>
          </div>
        </div>

        <button onClick={onBid} className="w-full py-2.5 text-[9px] font-mono uppercase tracking-widest border border-[var(--border-dark)] hover:border-[var(--rolex-gold)] hover:text-[var(--rolex-gold)] transition-colors flex justify-center items-center gap-2">
          Place Bid <ChevronRight size={10} />
        </button>
      </div>
    </motion.div>
  );
}

function OwnerProjectCard({ project, onAction }: { project: ConstructionProject, onAction: (a: string) => void }) {
  const hasModel = !!project.floor_plan_json;
  const isApproved = project.legal_status === 'approved';
  
  return (
    <motion.div variants={CA_ITEM} className="border border-[var(--border-dark)] bg-black/40 flex flex-col md:flex-row overflow-hidden relative">
      {/* Decorative vertical bar based on status */}
      <div className={`w-1 absolute left-0 top-0 bottom-0 ${isApproved ? 'bg-green-500' : 'bg-orange-500'}`} />
      
      <div className="p-6 flex-1">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-light tracking-wide pl-2">{project.title}</h3>
          <span className="text-[9px] font-mono bg-[#050505] border border-[var(--border-dark)] px-2 py-1 uppercase tracking-widest text-[var(--text-secondary)]">
            ID: {project.id.substring(0, 8)}...
          </span>
        </div>
        
        <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest mb-6 pl-2">
          {project.district} · Created {new Date(project.created_at).toLocaleDateString()}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 pl-2">
          <div>
            <p className="text-[8px] font-mono uppercase text-[var(--text-muted)] mb-1">Status</p>
            <p className="text-xs font-mono uppercase">{project.status.replace('_', ' ')}</p>
          </div>
          <div>
            <p className="text-[8px] font-mono uppercase text-[var(--text-muted)] mb-1">Legal Clearance</p>
            <p className={`text-xs font-mono uppercase flex items-center gap-1.5 ${isApproved ? 'text-green-400' : 'text-orange-400'}`}>
              {isApproved && <ShieldCheck size={12} />} {project.legal_status}
            </p>
          </div>
          <div>
            <p className="text-[8px] font-mono uppercase text-[var(--text-muted)] mb-1">Design Model</p>
            <p className={`text-xs font-mono uppercase ${hasModel ? 'text-[var(--rolex-gold)]' : 'text-[var(--text-secondary)]'}`}>
              {hasModel ? 'Archion 3D Attached' : 'Missing'}
            </p>
          </div>
          <div>
            <p className="text-[8px] font-mono uppercase text-[var(--text-muted)] mb-1">Bids</p>
            <p className="text-xs font-mono">{project.bid_count ?? 0}</p>
          </div>
        </div>

        {/* Action Pipeline */}
        <div className="pl-2 pt-4 border-t border-[var(--border-dark)]">
          <p className="text-[8px] font-mono uppercase text-[var(--text-muted)] mb-3 tracking-widest">Workflow Pipeline</p>
          <div className="flex flex-wrap gap-2">
            {!hasModel && (
              <Link href={`/archionlabs?constructionProject=${project.id}`} className="px-4 py-2 text-[9px] font-mono uppercase bg-[var(--rolex-gold)] text-black font-bold tracking-widest hover:bg-[var(--rolex-gold)]/90 transition-colors">
                Design in ArchionLabs
              </Link>
            )}
            {hasModel && project.legal_status === 'none' && (
              <ActionBtn label="Submit Legal Pack" onClick={() => onAction('submit_legal')} primary />
            )}
            {project.legal_status === 'pending' && (
              <ActionBtn label="Simulate UDA Approval (Demo)" onClick={() => onAction('approve_legal')} primary />
            )}
            {project.legal_status === 'approved' && project.status === 'design' && (
              <ActionBtn label="Open Marketplace Bidding" onClick={() => onAction('open_bidding')} primary />
            )}
            {project.status === 'bidding' && (
               <Link href={`/construction/${project.id}`} className="px-4 py-2 text-[9px] font-mono uppercase border border-[var(--border-dark)] hover:border-[var(--rolex-gold)] text-[var(--rolex-gold)] tracking-widest transition-colors flex items-center gap-1.5">
                 View Bids <ChevronRight size={10} />
               </Link>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ActionBtn({ label, onClick, primary = false }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-[9px] font-mono uppercase tracking-widest transition-colors ${
        primary 
          ? 'border border-[var(--rolex-gold)] text-[var(--rolex-gold)] hover:bg-[var(--rolex-gold)] hover:text-black' 
          : 'border border-[var(--border-dark)] text-[var(--text-secondary)] hover:text-white hover:border-white/40'
      }`}
    >
      {label}
    </button>
  );
}

function StatBox({ label, value, icon: Icon }: { label: string, value: string, icon: any }) {
  return (
    <div>
      <p className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-1 flex items-center gap-1.5">
        <Icon size={8} /> {label}
      </p>
      <p className="text-sm font-mono text-white">{value}</p>
    </div>
  );
}

function PlusSquareIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
      <rect x="3" y="3" width="18" height="18" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

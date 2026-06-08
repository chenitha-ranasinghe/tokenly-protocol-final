'use client';
import { CANTierCard } from '@/components/can/CANTierCard';
import { useStore } from '@/lib/store';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch, setAuthUser } from '@/lib/client';
import { showToast } from '@/components/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import { CA_STAGGER, CA_ITEM } from '@/lib/animations';
import { Shield, Zap, Lock, AlertTriangle, CheckCircle, Radio, Cpu, X } from 'lucide-react';

import type { Proposal } from '@/lib/types';

const TIERS = [
  {
    name: 'Network Inspector',
    id: 'inspector',
    rrs: 60,
    bond: 2500,
    earning: 'BASE YIELD',
    desc: 'Entry-level verification parameters. Valid for standard catalog verifications.',
    color: 'var(--text-secondary)',
    borderColor: 'var(--border-dark)',
  },
  {
    name: 'Master Authenticator',
    id: 'master',
    rrs: 80,
    bond: 5000,
    earning: 'ENHANCED YIELD',
    desc: 'Advanced clearance. Granted authority over high-risk physical asset allocations.',
    color: 'var(--rolex-gold)',
    borderColor: 'var(--rolex-gold)',
    featured: true,
  },
  {
    name: 'Gemologist Partner',
    id: 'gemologist',
    rrs: 95,
    bond: 10000,
    earning: 'MAXIMUM EXECUTION YIELD',
    desc: 'Ultra-premium clearance. Exclusive handling of highest-tier allocations and raw resources.',
    color: '#00F0A8',
    borderColor: 'var(--border-dark)',
  },
];

export default function CanPortal() {
  const user = useStore(s => s.user);
  const [activeTiers, setActiveTiers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [bonding, setBonding] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalDesc, setProposalDesc] = useState('');
  const [submittingProposal, setSubmittingProposal] = useState(false);
  const router = useRouter();

  const fetchStatus = async () => {
    try {
      const res = await authFetch('/api/can/status');
      if (res.ok) {
        const data = await res.json();
        setActiveTiers(data.activeTiers || []);
      }
    } catch (err) {
      console.error('CAN status fetch failed', err);
    }
  };

  const fetchProposals = async () => {
    try {
      const res = await authFetch('/api/can/proposals');
      if (res.ok) {
        const data = await res.json();
        setProposals(data.proposals || []);
      }
    } catch (err) {
      console.error('Proposals fetch failed', err);
    }
  };

  const castVote = async (proposalId: string, voteType: 'for' | 'against') => {
    try {
      const res = await authFetch('/api/can/vote', {
        method: 'POST',
        body: JSON.stringify({ proposalId, voteType })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Vote registered in the network ledger.', 'success');
        fetchProposals();
      } else {
        showToast(data.error || 'Voting failed', 'error');
      }
    } catch {
      showToast('Consensus synchronization failure.', 'error');
    }
  };

  useEffect(() => {
    if (!user) { router.push('/'); return; }
        fetchStatus().finally(() => setLoading(false));
    fetchProposals();
  }, [router]);

  const handleBond = async (tierName: string, cost: number) => {
    const isAdmin = user?.email === 'admin@tokenly.luxury';
    if (!isAdmin && (!user || user.points < cost)) {
      showToast(`[ INSUFFICIENT CAPITAL ] Access restricted. Requires ${cost.toLocaleString()} PTS.`, 'error');
      return;
    }
    setBonding(true);
    try {
      const res = await authFetch('/api/can/bond', {
        method: 'POST',
        body: JSON.stringify({ tier: tierName, cost: isAdmin ? 0 : cost })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`[ AUTHORITY UPGRADED ] Pledged to ${tierName}.`, 'success');
        setAuthUser(data.user);
                fetchStatus();
      } else {
        showToast(data.error || 'Protocol Error', 'error');
      }
    } catch {
      showToast('Network synchronization failure.', 'error');
    }
    setBonding(false);
  };

  const isTierUnlocked = (score: number) => {
    if ((user?.email || '').toLowerCase() === 'admin@tokenly.luxury') return true;
    return (user?.rrs_score || 0) >= score;
  };

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505' }}>
      <div className="loading-spinner" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      
      <main className="max-w-7xl mx-auto pt-12 pb-12 px-4 sm:px-8">
        <motion.div variants={CA_STAGGER} initial="hidden" animate="show">
          
          <motion.div variants={CA_ITEM} className="border-b border-[var(--border-dark)] pb-6 mb-8">
            <p className="text-[9px] font-mono tracking-[0.25em] text-[var(--rolex-gold)] mb-2 uppercase flex items-center gap-2 font-bold">
              <span className="w-1.5 h-1.5 bg-[var(--rolex-gold)] rounded-full animate-pulse"></span>
              GOVERNANCE & CERTIFICATION
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tighter text-white mb-2 uppercase leading-none">C.A.N. Protocol</h1>
            <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-secondary)] mt-3 max-w-lg leading-relaxed font-semibold">The Certified Authenticator Network. Stake capital to acquire Node Clearance and validate real-world physical assets.</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-12">
            {/* PERFECTION: Autonomous Governance (DAO) */}
            <motion.div variants={CA_ITEM} className="lg:col-span-3 bg-[#050505] border border-[var(--border-dark)] p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                   <span className="text-[8px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] font-bold">[ 03 ] NETWORK GOVERNANCE BOARD</span>
                   <h3 className="text-lg font-bold text-white mt-2 tracking-tight uppercase">Active DAO Proposals</h3>
                </div>
                <button 
                  onClick={() => { setShowProposalModal(true); setProposalTitle(''); setProposalDesc(''); }}
                  className="px-5 py-2.5 bg-white text-black text-[9px] font-mono font-bold tracking-widest uppercase hover:bg-gray-200 transition-colors">+ NEW PROPOSAL</button>
              </div>
 
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {proposals.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', background: 'rgba(255,255,255,0.01)', borderRadius: 4, fontWeight: 700 }}>
                    [ NO ACTIVE PROPOSALS IN CURRENT CYCLE ]
                  </div>
                ) : (
                  proposals.map((p) => (
                    <div key={p.id} className="glass-card" style={{ padding: 20, border: '1px solid var(--border-dark)', background: 'var(--bg-primary)', borderRadius: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, textTransform: 'uppercase' }}>{p.title}</h4>
                        <div suppressHydrationWarning style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>EXP: {new Date(p.expires_at).toLocaleDateString()}</div>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: 16, lineHeight: 1.5 }}>{p.description}</p>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: 6 }}>
                            <span style={{ color: 'var(--success)', fontWeight: 800 }}>FOR: {(p.votes_for ?? 0).toLocaleString()}</span>
                            <span style={{ color: 'var(--danger)', fontWeight: 800 }}>AGAINST: {(p.votes_against ?? 0).toLocaleString()}</span>
                          </div>
                          <div style={{ height: 2, background: '#111', borderRadius: 1, overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${(p.votes_for / (p.votes_for + p.votes_against + 0.1)) * 100}%`, height: '100%', background: 'var(--success)' }} />
                            <div style={{ width: `${(p.votes_against / (p.votes_for + p.votes_against + 0.1)) * 100}%`, height: '100%', background: 'var(--danger)' }} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => castVote(p.id, 'for')} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.65rem', color: 'var(--success)', borderColor: 'var(--success)' }}>VOTE FOR</button>
                          <button onClick={() => castVote(p.id, 'against')} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.65rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}>AGAINST</button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

            <motion.div variants={CA_ITEM} className="bg-[#050505] border border-[var(--border-dark)] border-l-4 border-l-[var(--rolex-gold)] p-6">
              <div className="flex justify-between items-center mb-5">
                <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] font-bold">Node Integrity</span>
                <Radio size={16} color="var(--rolex-gold)" className="animate-pulse" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <div className="tiny-label">Approved RRS Score</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--rolex-gold)' }}>
                  {user?.rrs_score?.toFixed(1) || '0.0'}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                 <div className="tiny-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Clearance Progress</span>
                    <span>{Math.round((( (user?.rrs_score || 0) % 15) / 15) * 100)}%</span>
                 </div>
                 <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${Math.round((( (user?.rrs_score || 0) % 15) / 15) * 100)}%` }}
                     transition={{ duration: 1, delay: 0.5 }}
                     style={{ height: '100%', background: 'var(--rolex-gold)' }} 
                   />
                 </div>
              </div>
              <div>
                <div className="tiny-label">Treasury Balance</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                  {(user?.email || '').toLowerCase() === 'admin@tokenly.luxury' ? 'UNLIMITED' : user?.points?.toLocaleString() || '0'} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PTS</span>
                </div>
              </div>
            </motion.div>

            <motion.div variants={CA_ITEM} className="glass-card" style={{ 
              border: '1px solid var(--rolex-gold)',
              background: 'linear-gradient(135deg, rgba(163,126,44,0.05) 0%, transparent 100%)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              gap: 12,
              padding: 24
            }}>
               <div style={{ background: 'rgba(163,126,44,0.1)', padding: 12, borderRadius: '50%' }}>
                 <Cpu size={24} color="var(--rolex-gold)" />
               </div>
               <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 600 }}>Verification Pipeline</h3>
                  <p className="text-muted" style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700 }}>[ AUTHENTICATED LUXURY AWAITS CERTIFICATION ]</p>
               </div>
               <button 
                disabled={activeTiers.length === 0 && (user?.email || '').toLowerCase() !== 'admin@tokenly.luxury'}
                onClick={() => router.push('/verify')}
                className="btn btn-primary" 
                style={{ width: '100%', padding: '10px', fontSize: '0.7rem', fontWeight: 800 }}>
                 {activeTiers.length > 0 || (user?.email || '').toLowerCase() === 'admin@tokenly.luxury' ? 'ENTER VERIFICATION HUB' : 'NODE ACCESS LOCKED'}
               </button>
            </motion.div>

            <motion.div variants={CA_ITEM} className="glass-card" style={{ border: user?.is_banned ? '2px solid var(--danger)' : '1px solid rgba(255,255,255,0.1)' }}>
               {user?.is_banned ? (
                 <div style={{ height: '100%', display: 'flex', alignItems: 'center', gap: 24 }}>
                   <div style={{ background: 'rgba(207, 79, 79, 0.1)', padding: 20, borderRadius: '50%' }}>
                     <AlertTriangle size={40} color="var(--danger)" />
                   </div>
                   <div>
                     <div style={{ color: 'var(--danger)', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>!! NETWORK EXCLUSION ACTIVE !!</div>
                     <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                       This node has been permanently slashed due to integrity failure. All bonded capital has been forfeited.
                     </p>
                   </div>
                 </div>
               ) : (
                 <div style={{ height: '100%', display: 'flex', alignItems: 'center', gap: 24 }}>
                   <div style={{ background: 'rgba(163, 126, 44, 0.1)', padding: 20, borderRadius: '50%' }}>
                     <Shield size={40} color="var(--rolex-gold)" />
                   </div>
                   <div>
                     <div style={{ color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Protocol Governance Clause</div>
                     <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                       Nodes acting maliciously will be slashed. Forfeit 100% of bonded capital and suffer permanent network exclusion.
                     </p>
                   </div>
                 </div>
               )}
            </motion.div>
          </div>

          <motion.div variants={CA_ITEM} style={{ marginBottom: 24 }}>
            <h2 className="section-title">Node Clearance Levels</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
              {TIERS.map((tier, idx) => {
                const tierAdminCheck = (user as unknown as Record<string,unknown>)?.email?.toString().toLowerCase() === 'admin@tokenly.luxury';
                const unlocked = isTierUnlocked(tier.rrs);
                const isActive = activeTiers.includes(tier.name) || tierAdminCheck;
                const canAfford = tierAdminCheck || ((user as unknown as Record<string,unknown>)?.points as number || 0) >= tier.bond;
                const tierNum = (idx + 1) as 1 | 2 | 3;
                return (
                  <div key={tier.name} className="relative">
                    <CANTierCard
                      tier={tierNum}
                      name={tier.name}
                      minBondTLY={tier.bond}
                      feeReduction={tierNum === 1 ? 0.1 : tierNum === 2 ? 0.2 : 0.35}
                      itemValueLabel={tierNum === 1 ? 'Items under $500' : tierNum === 2 ? 'Items $500–$5,000' : 'Items above $5,000'}
                      multiplier={tierNum === 1 ? 1 : tierNum === 2 ? 1.5 : 2.5}
                      isActive={isActive}
                      onJoin={() => { if (canAfford && !isActive) handleBond(tier.name, tier.bond); }}
                    />
                    {!unlocked && !tierAdminCheck && (
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center rounded">
                        <div className="text-[9px] font-mono tracking-widest uppercase text-[var(--text-muted)] flex items-center gap-2">
                          <Lock size={12} /> RRS {tier.rrs}+ required
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
</div>
          </motion.div>
        </motion.div>
      </main>

      {/* ===== PROPOSAL MODAL ===== */}
      <AnimatePresence>
        {showProposalModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => !submittingProposal && setShowProposalModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-[#050505] border border-[var(--border-dark)] border-t-4 border-t-[var(--rolex-gold)] p-8 w-full max-w-lg relative"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setShowProposalModal(false)}
                className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:text-white transition-colors"
                disabled={submittingProposal}
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 border border-[var(--rolex-gold)]/30 bg-[var(--rolex-gold)]/10 flex items-center justify-center text-[var(--rolex-gold)]">
                  <Cpu size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white m-0 uppercase">New Proposal</h2>
                  <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--rolex-gold)] mt-1">Network Governance Submission</div>
                </div>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!proposalTitle.trim() || !proposalDesc.trim()) return;
                setSubmittingProposal(true);
                try {
                  const res = await authFetch('/api/can/proposals', {
                    method: 'POST',
                    body: JSON.stringify({ title: proposalTitle, description: proposalDesc })
                  });
                  const d = await res.json();
                  if (!res.ok) throw new Error(d.error);
                  showToast('Proposal broadcasted to the network.', 'success');
                  setShowProposalModal(false);
                  fetchProposals();
                } catch (e: unknown) {
                  showToast(e instanceof Error ? e.message : 'Broadcast failure', 'error');
                } finally {
                  setSubmittingProposal(false);
                }
              }} className="flex flex-col gap-5">
                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-2 font-bold">Proposal Title</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-[#0A0A0A] border border-[var(--border-dark)] p-3 text-white font-mono text-sm focus:outline-none focus:border-[var(--rolex-gold)] transition-colors uppercase"
                    placeholder="E.g. INCREASE BOND MINIMUM..."
                    value={proposalTitle}
                    onChange={e => setProposalTitle(e.target.value)}
                    maxLength={120}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-2 font-bold">Description</label>
                  <textarea
                    required
                    rows={4}
                    className="w-full bg-[#0A0A0A] border border-[var(--border-dark)] p-3 text-white font-mono text-sm focus:outline-none focus:border-[var(--rolex-gold)] transition-colors resize-none"
                    placeholder="Describe the proposal rationale and expected impact..."
                    value={proposalDesc}
                    onChange={e => setProposalDesc(e.target.value)}
                    maxLength={500}
                  />
                  <div className="text-[8px] font-mono text-[var(--text-muted)] mt-1 text-right">{proposalDesc.length}/500</div>
                </div>

                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    className="flex-1 py-3 text-[9px] font-mono uppercase tracking-widest border border-[var(--border-dark)] bg-[#0A0A0A] text-white hover:bg-white/5 transition-colors font-bold"
                    onClick={() => setShowProposalModal(false)}
                    disabled={submittingProposal}
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 text-[9px] font-mono uppercase tracking-widest bg-white text-black font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
                    disabled={submittingProposal || !proposalTitle.trim() || !proposalDesc.trim()}
                  >
                    {submittingProposal ? 'BROADCASTING...' : 'SUBMIT PROPOSAL'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

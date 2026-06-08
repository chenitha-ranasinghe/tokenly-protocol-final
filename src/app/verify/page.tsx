'use client';
import { useStore } from '@/lib/store';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch, setAuthUser } from '@/lib/client';
import type { CANTask, VisionResult, VisionForensic } from '@/lib/types';
import { showToast } from '@/components/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import { CA_STAGGER, CA_ITEM, CA_STAGGER_FAST } from '@/lib/animations';
import { Shield, Search, Zap, CheckCircle, AlertTriangle, Terminal, Cpu, Camera, Eye } from 'lucide-react';

export default function VerificationHub() {
  const [tasks, setTasks] = useState<CANTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<CANTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [visionScanning, setVisionScanning] = useState(false);
  const [visionVerdict, setVisionVerdict] = useState<VisionResult | null>(null);
  const [notes, setNotes] = useState('');
  const router = useRouter();
  const user = useStore(s => s.user);
  const hydrated = useStore(s => s.hydrated);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await authFetch('/api/can/tasks');
      const data = await res.json();
      if (res.ok) {
        setTasks(data.tasks || []);
      } else {
        showToast(data.error || 'Access Denied', 'error');
        if (res.status === 403) router.push('/can');
      }
    } catch {
      showToast('Network sync failure.', 'error');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!user) { router.push('/'); return; }
    void fetchTasks();
  }, [user, router, fetchTasks]);

  const handleVisionOracle = async () => {
    if (!selectedTask) return;
    setVisionScanning(true);
    setVisionVerdict(null);
    try {
      // Simulate neural trace for asset
      const res = await authFetch('/api/ai-vision', {
        method: 'POST',
        body: JSON.stringify({ 
          productId: selectedTask.id,
          imageBase64: 'placeholder_no_image_uploaded'
        })
      });
      const data = await res.json();
      setVisionVerdict(data);
    } catch {
      setVisionVerdict({ 
        verdict: 'INCONCLUSIVE', 
        confidence: 0, 
        notes: 'Direct link to Oracle severed.',
        success: false,
        forensics: [],
        powered_by: 'Protocol Failure',
        disclaimer: 'Connection lost'
      });
    } finally {
      setVisionScanning(false);
    }
  };

  const submitVerdict = async (verdict: 'authentic' | 'synthetic') => {
    if (!selectedTask || verifying) return;
    setVerifying(true);
    try {
      const res = await authFetch('/api/can/verify', {
        method: 'POST',
        body: JSON.stringify({ 
          productId: selectedTask.id,
          verdict,
          notes: notes + (visionVerdict ? `\n\nAI Oracle Analysis: ${visionVerdict.verdict} (${visionVerdict.confidence}% confidence)` : '')
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`[ VERDICT RECORDED ] Earned ${data.reward} yield pts.`, 'success');
        if (data.user) setAuthUser(data.user);
        setSelectedTask(null);
        setVisionVerdict(null);
        setNotes('');
        fetchTasks();
      } else {
        showToast(data.error || 'Submission failed.', 'error');
      }
    } catch {
      showToast('Network error during submission.', 'error');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505' }}>
      <div className="loading-spinner" />
    </div>
  );

  return (
    <div className="bg-[#050505] min-h-screen text-white font-sans pt-8 pb-12 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div variants={CA_STAGGER} initial="hidden" animate="show">
          
          <motion.div variants={CA_ITEM} className="mb-12 border-b border-[var(--border-dark)] pb-8">
            <div className="flex items-center gap-3 text-[var(--rolex-gold)] mb-4">
              <Shield size={12} className="animate-pulse" />
              <span className="text-[9px] font-bold font-mono tracking-[0.25em] uppercase">CLEARANCE LEVEL: CERTIFIED AUTHENTICATOR</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-4 uppercase leading-none">Verification Hub</h1>
            <p className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-secondary)] max-w-2xl leading-relaxed font-semibold">
              Verify physical asset submissions. Use neural optical traces to detect synthetic logic signatures.
            </p>
          </motion.div>

          <div className={`grid gap-12 transition-all duration-500 ${selectedTask ? 'lg:grid-cols-[400px_1fr]' : 'grid-cols-1'}`}>
            
            {/* Task List */}
            <motion.div variants={CA_ITEM} className="flex flex-col">
              <div className="flex justify-between items-end mb-8 border-b border-[var(--border-dark)] pb-4">
                <h3 className="text-[10px] font-bold font-mono tracking-[0.2em] text-[var(--text-muted)] uppercase">PENDING QUEUE ({tasks.length})</h3>
                <div className="text-[9px] font-mono text-[var(--rolex-gold)] font-bold tracking-widest animate-pulse flex items-center gap-2">
                  <div className="w-1 h-1 bg-[var(--rolex-gold)] rounded-full"></div>
                  SYNC: LIVE
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                {tasks.map(task => (
                  <button 
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`text-left p-5 border transition-all duration-300 relative group ${selectedTask?.id === task.id ? 'bg-[#0A0A0A] border-[var(--rolex-gold)]' : 'bg-transparent border-[var(--border-dark)] hover:border-white/20'}`}
                  >
                    {selectedTask?.id === task.id && <div className="absolute left-0 top-0 w-1 h-full bg-[var(--rolex-gold)]" />}
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[9px] font-bold font-mono tracking-widest text-[var(--rolex-gold)] uppercase">{task.brand}</span>
                      <span suppressHydrationWarning className="text-[8px] font-mono text-[var(--text-muted)] uppercase font-bold">{task.created_at ? new Date(task.created_at).toLocaleDateString() : '—'}</span>
                    </div>
                    <div className="text-[12px] font-bold font-mono tracking-tight text-white mb-3 group-hover:text-[var(--rolex-gold)] transition-colors uppercase leading-none">{task.name}</div>
                    <div className="flex justify-between items-center pt-3 border-t border-[var(--border-dark)]/50">
                      <div className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-widest font-bold">BASIS: ${task.retail_price.toLocaleString()}</div>
                      <div className="text-[8px] font-mono text-[var(--rolex-gold)] font-bold tracking-widest flex items-center gap-1">
                        <Zap size={9} /> 50 YIELD
                      </div>
                    </div>
                  </button>
                ))}
                {tasks.length === 0 && (
                  <div className="py-24 text-center border border-dashed border-[var(--border-dark)] bg-[#0A0A0A]/50">
                    <Search size={32} className="mx-auto mb-6 opacity-20" />
                    <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-[0.2em]">No assets awaiting verification. Network is clean.</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Task Detail / Verification Terminal */}
            <AnimatePresence mode="wait">
              {selectedTask && (
                <motion.div 
                  key={selectedTask.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-[#050505] border border-[var(--border-dark)] p-6 md:p-8 relative overflow-hidden flex flex-col"
                >
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--rolex-gold)] to-transparent opacity-50" />
                  
                  <div className="flex justify-between items-start mb-8">
                    <div className="text-[9px] font-mono tracking-[0.25em] text-[var(--rolex-gold)] font-bold uppercase">SELECTED PAYLOAD</div>
                    <button onClick={() => setSelectedTask(null)} className="text-[8px] font-mono text-[var(--text-muted)] hover:text-white transition-colors tracking-widest font-bold border border-[var(--border-dark)] px-3 py-1.5 hover:border-white/20 uppercase">
                      [ CLOSE ]
                    </button>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 xl:gap-12 h-full">
                    <div className="flex flex-col">
                      <div className="mb-8">
                        <h2 className="text-2xl font-bold tracking-tighter text-white mb-3 uppercase leading-none">{selectedTask.name}</h2>
                        <div className="text-[10px] font-mono font-bold tracking-widest text-[var(--rolex-gold)] uppercase flex items-center gap-2">
                          {selectedTask.brand} <span className="text-white/20">/</span> SKU: {selectedTask.sku}
                        </div>
                      </div>

                      <div className="bg-[#0A0A0A] border border-[var(--border-dark)] p-5 mb-8 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] font-bold">CATEGORY</span>
                          <span className="text-[9px] font-mono text-white font-bold tracking-wider">{selectedTask.category.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-[var(--border-dark)] pt-3">
                          <span className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] font-bold">RETAIL BASIS</span>
                          <span className="text-[10px] font-mono text-white font-bold tracking-widest">${selectedTask.retail_price.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="mb-8 flex-grow flex flex-col">
                        <label className="text-[8px] font-bold font-mono tracking-widest text-[var(--text-muted)] mb-3 uppercase block">VERIFICATION_LOGS</label>
                        <textarea 
                          className="w-full bg-black border border-[var(--border-dark)] p-4 text-[10px] font-mono text-white placeholder:text-white/10 focus:outline-none focus:border-[var(--rolex-gold)] transition-colors flex-grow uppercase tracking-wider leading-relaxed"
                          rows={4} 
                          placeholder="Evidence of authenticity or synthetic markers..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => submitVerdict('synthetic')}
                          disabled={verifying}
                          className="px-4 py-4 border border-red-500/50 text-red-500 text-[9px] font-bold font-mono tracking-widest uppercase hover:bg-red-500 hover:text-white transition-all disabled:opacity-50">
                          REJECT / SYNTHETIC
                        </button>
                        <button 
                          onClick={() => submitVerdict('authentic')}
                          disabled={verifying}
                          className="px-4 py-4 bg-[var(--rolex-gold)] text-black text-[9px] font-bold font-mono tracking-widest uppercase hover:bg-white transition-all disabled:opacity-50">
                          {verifying ? 'VERIFYING...' : 'CERTIFY AUTHENTIC'}
                        </button>
                      </div>
                    </div>

                    <div className="border-t xl:border-t-0 xl:border-l border-[var(--border-dark)] pt-12 xl:pt-0 xl:pl-12 flex flex-col">
                       <div className="mb-8 flex items-center gap-3">
                         <Terminal size={14} className="text-[var(--rolex-gold)]" />
                         <span className="text-[10px] font-bold font-mono tracking-widest uppercase text-white">Neural Oracle Interface</span>
                       </div>

                       <div className="bg-black border border-[var(--border-dark)] p-8 flex-grow flex flex-col justify-center min-h-[300px]">
                         {visionScanning ? (
                            <div className="text-center py-12">
                              <Cpu size={32} className="text-[var(--rolex-gold)] animate-spin mx-auto mb-6" />
                              <div className="text-[9px] font-bold font-mono text-[var(--rolex-gold)] tracking-[0.3em] uppercase animate-pulse">EXTRACTING OPTICAL SIGNATURES...</div>
                            </div>
                         ) : visionVerdict ? (
                             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col">
                               <div className="flex justify-between items-center mb-8 pb-4 border-b border-[var(--border-dark)]">
                                 <span className="text-[9px] font-bold font-mono tracking-widest text-[var(--text-muted)] uppercase">ORACLE VERDICT</span>
                                 <span className={`text-xs font-bold font-mono tracking-widest uppercase ${visionVerdict.verdict === 'AUTHENTIC' ? 'text-[var(--success)]' : 'text-red-500'}`}>
                                   [ {visionVerdict.verdict} ]
                                 </span>
                               </div>
                               
                               <div className="bg-[#050505] border border-[var(--border-dark)]/50 p-6 mb-8 flex-grow overflow-y-auto max-h-[250px] custom-scrollbar">
                                 <div className="text-[8px] font-bold font-mono tracking-[0.2em] text-[var(--rolex-gold)] mb-6 uppercase flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-[var(--rolex-gold)] rounded-full"></div>
                                    FORENSIC_DIAGNOSTIC_LOG
                                 </div>
                                 <div className="space-y-4">
                                    {(visionVerdict.forensics || []).map((f: VisionForensic, idx: number) => (
                                      <motion.div 
                                        initial={{ opacity: 0, x: -5 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        key={idx} 
                                        className="flex gap-4 items-start border-b border-white/[0.03] pb-3"
                                      >
                                         <span className={`text-[8px] font-bold font-mono min-w-[60px] ${f.status === 'PASS' || f.status === 'STABLE' || f.status.includes('%') ? 'text-[var(--success)]' : 'text-yellow-500'}`}>
                                           [{f.status}]
                                         </span>
                                         <div className="flex flex-col gap-1">
                                            <div className="text-[10px] font-bold font-mono text-white tracking-wider uppercase">{f.task}</div>
                                            <div className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-tight">{f.detail}</div>
                                         </div>
                                      </motion.div>
                                    ))}
                                 </div>
                               </div>

                               <div className="mt-auto">
                                 <div className="flex justify-between items-center mb-2">
                                   <span className="text-[9px] font-bold font-mono tracking-widest text-[var(--text-muted)] uppercase">CONFIDENCE INDEX</span>
                                   <span className="text-[10px] font-bold font-mono text-[var(--rolex-gold)]">{visionVerdict.confidence}%</span>
                                 </div>
                                 <div className="h-[2px] bg-white/5 w-full mb-8 relative overflow-hidden">
                                   <div className="absolute top-0 left-0 h-full bg-[var(--rolex-gold)] shadow-[0_0_10px_rgba(163,126,44,0.5)] transition-all duration-1000" style={{ width: `${visionVerdict.confidence}%` }} />
                                 </div>
                                 <div className="text-[10px] font-mono text-[var(--text-secondary)] italic border-l-2 border-[var(--rolex-gold)] pl-4 py-1 leading-relaxed uppercase tracking-wider">
                                   <span className="not-italic">&ldquo;</span>
                                   {visionVerdict.notes}
                                   <span className="not-italic">&rdquo;</span>
                                 </div>
                               </div>
                             </motion.div>
                         ) : (
                            <div className="text-center py-12">
                              <Camera size={32} className="text-white/10 mx-auto mb-8" />
                              <button 
                                onClick={handleVisionOracle}
                                className="px-8 py-3 border border-dashed border-[var(--border-dark)] text-[10px] font-bold font-mono tracking-widest text-[var(--text-muted)] uppercase hover:border-[var(--rolex-gold)] hover:text-[var(--rolex-gold)] transition-all">
                                INITIALIZE LLAMA-VISION SCAN
                              </button>
                            </div>
                         )}
                       </div>

                       <div className="mt-8 space-y-4">
                          <div className="flex gap-4 items-start text-[var(--text-muted)] bg-[#0A0A0A] p-4 border border-[var(--border-dark)]">
                            <Eye size={14} className="mt-0.5 shrink-0" />
                            <p className="text-[9px] font-mono uppercase tracking-widest leading-relaxed">The AI Oracle scans for sub-millimeter inconsistencies in manufacturing threads and serial engravings.</p>
                          </div>
                          <div className="flex gap-4 items-start text-[var(--text-muted)] bg-[#0A0A0A] p-4 border border-[var(--border-dark)] border-l-[var(--rolex-gold)]">
                            <Zap size={14} className="mt-0.5 shrink-0 text-[var(--rolex-gold)]" />
                            <p className="text-[9px] font-mono uppercase tracking-widest leading-relaxed">Verifications from Gemologist tiers carry <strong className="text-white">2.5x weight</strong> in the consensus engine.</p>
                          </div>
                       </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

        </motion.div>
      </div>
    </div>
  );
}

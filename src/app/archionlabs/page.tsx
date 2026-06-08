'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authFetch } from '@/lib/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, Activity, Lock, ShieldAlert, Upload,
  ChevronRight, Cpu, Zap, Save, FolderOpen, Plus,
  MessageSquare, Command, ArrowRight, X,
} from 'lucide-react';

import type { ComplianceResult } from '@/components/archionlabs/CompliancePanel';
import type { BuildResult }      from '@/components/archionlabs/BuildPanel';
import type { MARLSimResult }    from '@/components/archionlabs/SimulationPanel';
import type { ViewerResult }     from '@/components/archionlabs/ViewerPanel';

import { CompliancePanel, PanelLoader } from '@/components/archionlabs/CompliancePanel';
import { PortfolioDemoBar } from '@/components/archionlabs/PortfolioDemoBar';
import { usePortfolioDemoChrome } from '@/lib/use-portfolio-demo';

const BuildPanel = dynamic(
  () => import('@/components/archionlabs/BuildPanel').then(m => ({ default: m.BuildPanel })),
  { ssr: false, loading: () => <PanelLoader label="Loading Tokenly Build…" /> },
);
const SimulationPanel = dynamic(
  () => import('@/components/archionlabs/SimulationPanel').then(m => ({ default: m.SimulationPanel })),
  { ssr: false, loading: () => <PanelLoader label="Loading simulation engine…" /> },
);
const ViewerPanel = dynamic(
  () => import('@/components/archionlabs/ViewerPanel').then(m => ({ default: m.ViewerPanel })),
  { ssr: false, loading: () => <PanelLoader label="Loading secure 3D viewer…" /> },
);
const ArchionChat = dynamic(() => import('@/components/archionlabs/ArchionChat'), {
  ssr: false,
  loading: () => <PanelLoader label="Loading AI assistant…" />,
});
import { ARCHION_PORTFOLIO_DEMO_BUILD } from '@/lib/archion-demo-seed';
import {
  PORTFOLIO_SIM_RESULT,
  PORTFOLIO_COMPLIANCE_RESULT,
  buildPortfolioViewerResult,
} from '@/lib/portfolio-demo-seeds';

import { CA_STAGGER, CA_ITEM } from '@/lib/animations';

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'build' | 'sim' | 'viewer' | 'compliance';

interface ArchionProject {
  id: string;
  name: string;
  updatedAt: string;
  buildResult: BuildResult | null;
  simResult: MARLSimResult | null;
  complianceResult: ComplianceResult | null;
  viewerResult: ViewerResult | null;
}

const STORAGE_KEY = 'archionlabs_v4_projects';

// ─── Module definitions ───────────────────────────────────────────────────────
const TABS = [
  {
    id:       'build'      as Tab,
    label:    'Tokenly Build',
    sub:      'AI-Powered Modeling',
    icon:     '⬡',
    tag:      'NLP → 2D + 3D',
    color:    '#a37e2c',
    features: ['Natural Language → Floor Plan', '2D Canvas + Zoom/Pan', 'Interactive 3D Model', 'SVG / DXF Export'],
  },
  {
    id:       'sim'        as Tab,
    label:    'Tokenly Build · Sim',
    sub:      'MARL Pedestrian Simulation',
    icon:     '◎',
    tag:      'MARL + ISO 21542',
    color:    '#3b82f6',
    features: ['Social Force MARL Engine', 'Real-time Density Heatmap', 'Agent Type + Speed Control', 'SL UDA 2023 + ISO 21542:2011'],
  },
  {
    id:       'viewer'     as Tab,
    label:    'Tokenly Build · Viewer',
    sub:      'Secure 3D Sharing',
    icon:     '◆',
    tag:      'Token-Based',
    color:    '#22c55e',
    features: ['Interactive 3D Orbit Controls', 'Token + Password + Expiry', 'Dual-Layer Watermarks', 'Embed Code Generator'],
  },
  {
    id:       'compliance' as Tab,
    label:    'Tokenly Build · Compliance',
    sub:      'Automated Rule Checking',
    icon:     '◈',
    tag:      'SL UDA 2023',
    color:    '#ef4444',
    features: ['Sri Lankan UDA 2023', 'ISO 21542:2011 Accessibility', 'SLNBC Fire Safety', 'AI Remediation Advice'],
  },
] as const;

const PIPELINE_STEPS = [
  { label: 'NLP Parsed',  key: 'build'  },
  { label: 'Floor Plan',  key: 'build'  },
  { label: '3D Model',    key: 'build'  },
  { label: 'Simulation',  key: 'sim'    },
  { label: 'Compliance',  key: 'compliance' },
  { label: 'Shared',      key: 'viewer' },
];

const panelVariant = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 28 } },
  exit:   { opacity: 0, y: -8, transition: { duration: 0.12 } },
};

const TAB_IDS: Tab[] = ['build', 'sim', 'viewer', 'compliance'];

// ─── Main page ────────────────────────────────────────────────────────────────
function ArchionLabsDashboard() {
  const searchParams = useSearchParams();
  const portfolioMode = usePortfolioDemoChrome();
  const constructionProjectId = searchParams.get('constructionProject');
  const tabParam = searchParams.get('tab');
  const initialTab: Tab = TAB_IDS.includes(tabParam as Tab) ? (tabParam as Tab) : 'build';

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [loading,   setLoading]   = useState(false);

  const [buildResult,      setBuildResult]      = useState<BuildResult | null>(null);
  const [simResult,        setSimResult]        = useState<MARLSimResult | null>(null);
  const [viewerResult,     setViewerResult]     = useState<ViewerResult | null>(null);
  const [complianceResult, setComplianceResult] = useState<ComplianceResult | null>(null);

  const [projectName,  setProjectName]  = useState('Untitled Project');
  const [saveStatus,   setSaveStatus]   = useState<'idle' | 'saved' | 'saving'>('idle');
  const [projects,     setProjects]     = useState<ArchionProject[]>([]);
  const [showProjects, setShowProjects] = useState(false);

  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [chatOpen,    setChatOpen]    = useState(false);

  const projectsRef = useRef<HTMLDivElement>(null);

  // ── Portfolio deep-link: tab + seeded floor plan ─────────────────────────────
  useEffect(() => {
    if (tabParam && TAB_IDS.includes(tabParam as Tab)) {
      setActiveTab(tabParam as Tab);
    }
  }, [tabParam]);

  useEffect(() => {
    if (!portfolioMode) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    setBuildResult(ARCHION_PORTFOLIO_DEMO_BUILD);
    setSimResult(PORTFOLIO_SIM_RESULT);
    setComplianceResult(PORTFOLIO_COMPLIANCE_RESULT);
    setViewerResult(buildPortfolioViewerResult(origin));
    setProjectName('Portfolio Demo · Chenitha Ranasinghe');
  }, [portfolioMode]);

  // ── Load saved projects on mount ─────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setProjects(JSON.parse(raw));
    } catch { /* ignore parse errors */ }
  }, []);

  // ── Close project dropdown when clicking outside ──────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (projectsRef.current && !projectsRef.current.contains(e.target as Node)) {
        setShowProjects(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Keyboard shortcuts: 1-4 → tabs, ⌘S → save ─────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;

      const tabMap: Record<string, Tab> = { '1': 'build', '2': 'sim', '3': 'viewer', '4': 'compliance' };
      if (tabMap[e.key]) { setActiveTab(tabMap[e.key]); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(); }
      if (e.key === 'Escape') { setShowProjects(false); setChatOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildResult, simResult, viewerResult, complianceResult, projectName]);

  // ── Project save ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    const project: ArchionProject = {
      id:          Date.now().toString(),
      name:        projectName,
      updatedAt:   new Date().toISOString(),
      buildResult, simResult, complianceResult, viewerResult,
    };
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as ArchionProject[];
      const updated  = [project, ...existing.filter(p => p.name !== projectName)].slice(0, 12);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setProjects(updated);

      if (constructionProjectId && buildResult && !portfolioMode) {
        await authFetch(`/api/construction/projects/${constructionProjectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: projectName,
            floor_plan_json: buildResult,
            compliance_report_json: complianceResult ?? simResult ?? null,
            estimated_build_cost: buildResult.estimated_cost_usd
              ? buildResult.estimated_cost_usd * 320
              : undefined,
          }),
        });
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2200);
    } catch { setSaveStatus('idle'); }
  }, [
    buildResult,
    simResult,
    complianceResult,
    viewerResult,
    projectName,
    constructionProjectId,
    portfolioMode,
  ]);

  const handleLoadProject = (proj: ArchionProject) => {
    setProjectName(proj.name);
    setBuildResult(proj.buildResult);
    setSimResult(proj.simResult);
    setComplianceResult(proj.complianceResult);
    setViewerResult(proj.viewerResult);
    setShowProjects(false);
  };

  const handleNewProject = () => {
    setBuildResult(null); setSimResult(null);
    setViewerResult(null); setComplianceResult(null);
    setProjectName('Untitled Project'); setImageBase64(null);
  };

  // ── API handlers ─────────────────────────────────────────────────────────────
  const demoHeaders: Record<string, string> = portfolioMode
    ? { 'X-Portfolio-Demo': 'true' }
    : {};

  const handleBuildGenerate = async (description: string, style: string) => {
    setLoading(true);
    try {
      const res  = await authFetch('/api/archionlabs/build', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...demoHeaders,
        },
        credentials: 'include',
        body: JSON.stringify({ description, style }),
      });
      const data = await res.json() as BuildResult;
      if (res.ok && !(data as any).error) setBuildResult(data);
      else console.error('[Build Error]', data);
    } catch (e) { console.error('[Build]', e); }
    finally { setLoading(false); }
  };

  const handleRunSim = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/archionlabs/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...demoHeaders },
        body: JSON.stringify({
          modelId:         buildResult ? 'custom_model' : 'demo_model',
          agentCount:      60,
          durationSeconds: 120,
          rooms:           buildResult?.rooms       ?? [],
          connections:     buildResult?.connections ?? [],
        }),
      });
      const data = await res.json() as MARLSimResult;
      if (res.ok) setSimResult(data);
      else if (portfolioMode) setSimResult(PORTFOLIO_SIM_RESULT);
    } catch (e) {
      console.error('[Sim]', e);
      if (portfolioMode) setSimResult(PORTFOLIO_SIM_RESULT);
    }
    finally { setLoading(false); }
  };

  const handleShare = async (opts: {
    password: string; expiryHours: number; watermark: boolean; clientName: string;
  }) => {
    setLoading(true);
    try {
      const res = await authFetch('/api/archionlabs/viewer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...demoHeaders },
        body: JSON.stringify({
          modelId: buildResult ? 'custom_model' : 'demo_model',
          rooms:   buildResult?.rooms ?? [],
          ...opts,
        }),
      });
      const data = await res.json() as ViewerResult;
      if (res.ok && data.success !== false) setViewerResult(data);
      else if (portfolioMode) setViewerResult(buildPortfolioViewerResult(window.location.origin));
    } catch (e) {
      console.error('[Viewer]', e);
      if (portfolioMode) setViewerResult(buildPortfolioViewerResult(window.location.origin));
    }
    finally { setLoading(false); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 1200, scale = MAX / img.width;
        canvas.width = MAX; canvas.height = img.height * scale;
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setImageBase64(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRunCompliance = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/archionlabs/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...demoHeaders },
        body: JSON.stringify({
          propertyId:   'AL-PROP-001',
          modelType:    'ifc_model',
          jurisdiction: 'SL_UDA_2023',
          rooms:        buildResult?.rooms ?? [],
          imageBase64:  imageBase64 ?? undefined,
        }),
      });
      const data = await res.json() as ComplianceResult;
      if (res.ok) setComplianceResult(data);
      else if (portfolioMode) setComplianceResult(PORTFOLIO_COMPLIANCE_RESULT);
    } catch (e) {
      console.error('[Compliance]', e);
      if (portfolioMode) setComplianceResult(PORTFOLIO_COMPLIANCE_RESULT);
    }
    finally { setLoading(false); }
  };

  // ── Derived state ─────────────────────────────────────────────────────────────
  const pipelineActive = [
    !!buildResult, !!buildResult, !!buildResult,
    !!simResult, !!complianceResult, !!viewerResult,
  ];

  const ACTION: Record<Tab, { label: string; handler: () => void; disabled?: boolean }> = {
    build:      { label: 'Generate Floor Plan', handler: () => {},           disabled: true },
    sim:        { label: 'Run MARL Simulation', handler: handleRunSim },
    viewer:     { label: 'Generate Share Link', handler: () => {},           disabled: true },
    compliance: { label: 'Run Compliance Scan', handler: handleRunCompliance },
  };

  const currentAction = ACTION[activeTab];

  // ─────────────────────────────────────────────────────────────────────────────
  const tabLabels: Record<Tab, string> = {
    build: 'Tokenly Build',
    sim: 'Tokenly Build · Sim',
    viewer: 'Tokenly Build · Viewer',
    compliance: 'Tokenly Build · Compliance',
  };

  return (
    <div className={`min-h-screen bg-[var(--bg-primary)] text-white pb-24 relative overflow-x-hidden ${portfolioMode ? 'pt-[88px]' : 'pt-8'}`}>
      {portfolioMode && <PortfolioDemoBar feature={tabLabels[activeTab]} />}

      {portfolioMode && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 mb-3">
          <div className="border border-[var(--rolex-gold)]/25 bg-[var(--rolex-gold)]/[0.06] px-4 py-2.5 flex flex-wrap items-center gap-2 text-[8px] font-mono uppercase tracking-widest text-[var(--rolex-gold)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--rolex-gold)] animate-pulse" />
            Full Tokenly Build pipeline pre-loaded for portfolio review — Build · Sim · Compliance · Viewer
          </div>
        </div>
      )}

      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-0 left-1/4 w-[700px] h-[400px] bg-[var(--rolex-gold)]/[0.04] blur-[130px] rounded-full" />
        <div className="absolute bottom-40 right-1/5 w-[500px] h-[350px] bg-blue-500/[0.04] blur-[110px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        <motion.div variants={CA_STAGGER} initial="hidden" animate="show">

          {/* ━━━━━ HERO HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <motion.div variants={CA_ITEM} className="mb-5">
            <div className="border border-[var(--border-dark)] bg-[#050505] relative overflow-hidden">
              {/* Top accent line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--rolex-gold)]/50 to-transparent" />

              <div className="p-5 md:p-7 flex flex-col md:flex-row md:items-center gap-5 md:gap-10">
                {/* Logo + identity */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="w-14 h-14 border border-[var(--rolex-gold)]/30 flex items-center justify-center text-[var(--rolex-gold)] text-2xl flex-shrink-0"
                       style={{ background: 'rgba(163,126,44,0.07)', boxShadow: '0 0 28px rgba(163,126,44,0.12)' }}>
                    ⚗
                  </div>
                  <div>
                    <p className="text-[7px] font-mono uppercase tracking-[0.35em] text-[var(--rolex-gold)] mb-1 font-bold">
                      TOKENLY PROTOCOL · BUILDING INTELLIGENCE SUITE
                    </p>
                    <h1 className="text-xl md:text-2xl font-bold tracking-tighter text-white uppercase leading-none mb-1">
                      Tokenly Build v4.0
                    </h1>
                    <p className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                      AI Design · MARL Simulation · SL UDA Compliance · Secure Sharing
                    </p>
                  </div>
                </div>

                {/* Live module status strip */}
                <div className="flex gap-px bg-[var(--border-dark)] border border-[var(--border-dark)] md:ml-auto flex-1 md:max-w-[480px]">
                  {[
                    { label: 'Plans',      value: buildResult ? '1' : '—',        ok: !!buildResult,      color: '#a37e2c' },
                    { label: 'Sim Agents', value: simResult ? `${simResult.simulation_metrics.total_agents}` : '—', ok: !!simResult, color: '#3b82f6' },
                    { label: 'Compliance', value: complianceResult ? `${complianceResult.overall_compliance_score}%` : '—', ok: !!complianceResult, color: '#22c55e' },
                    { label: 'Share Links',value: viewerResult ? '1' : '—',       ok: !!viewerResult,     color: '#a37e2c' },
                  ].map(s => (
                    <div key={s.label} className="flex-1 p-3 bg-[#050505]">
                      <p className="text-[7px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-1.5">{s.label}</p>
                      <p className="text-base font-mono font-bold leading-none" style={{ color: s.ok ? s.color : 'rgba(255,255,255,0.15)' }}>
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {constructionProjectId && !portfolioMode && (
            <motion.div variants={CA_ITEM} className="mb-3 px-4 py-2 border border-[var(--rolex-gold)]/30 bg-[var(--rolex-gold)]/5 text-[9px] font-mono">
              Linked to pre-construction project — Save (⌘S) syncs floor plan & compliance to marketplace.{' '}
              <Link href={`/construction/${constructionProjectId}`} className="text-[var(--rolex-gold)] underline">
                View project →
              </Link>
            </motion.div>
          )}

          {/* ━━━━━ PROJECT MANAGER BAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {!portfolioMode && (
          <motion.div variants={CA_ITEM} className="mb-4">
            <div className="flex items-center gap-3 px-4 py-2.5 border border-[var(--border-dark)] bg-[#030303] flex-wrap">
              <span className="text-[7px] font-mono text-[var(--text-muted)] uppercase tracking-widest flex-shrink-0">Project:</span>

              <input
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                className="bg-transparent border-b border-[var(--border-dark)] focus:border-[var(--rolex-gold)] text-white text-[10px] font-mono outline-none px-1 py-0.5 min-w-0 w-40"
              />

              {/* Save */}
              <button
                onClick={handleSave}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-mono uppercase tracking-widest border transition-colors flex-shrink-0 ${
                  saveStatus === 'saved'
                    ? 'border-green-500/40 text-green-400 bg-green-500/10'
                    : 'border-[var(--rolex-gold)]/40 text-[var(--rolex-gold)] hover:bg-[var(--rolex-gold)]/10'
                }`}
              >
                <Save size={8} />
                {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : 'Save  ⌘S'}
              </button>

              {/* Load */}
              <div className="relative flex-shrink-0" ref={projectsRef}>
                <button
                  onClick={() => setShowProjects(!showProjects)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-mono uppercase tracking-widest border border-[var(--border-dark)] text-[var(--text-muted)] hover:text-white hover:border-white/20 transition-colors"
                >
                  <FolderOpen size={8} /> Load ({projects.length})
                </button>

                <AnimatePresence>
                  {showProjects && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0,  scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-1 w-72 bg-[#0A0A0A] border border-[var(--border-dark)] z-50 shadow-2xl"
                    >
                      {projects.length === 0 ? (
                        <p className="p-4 text-[9px] font-mono text-[var(--text-muted)]">No saved projects yet.</p>
                      ) : projects.map(p => (
                        <div
                          key={p.id}
                          onClick={() => handleLoadProject(p)}
                          className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-dark)] hover:bg-white/[0.03] cursor-pointer group transition-colors"
                        >
                          <div>
                            <p className="text-[10px] font-mono text-white font-bold">{p.name}</p>
                            <p className="text-[8px] font-mono text-[var(--text-muted)]">
                              {new Date(p.updatedAt).toLocaleDateString()} · {p.buildResult?.rooms?.length ?? 0} rooms
                              {p.buildResult ? ` · ${p.buildResult.total_area_sqm}m²` : ''}
                            </p>
                          </div>
                          <ArrowRight size={10} className="text-[var(--text-muted)] group-hover:text-[var(--rolex-gold)] transition-colors flex-shrink-0" />
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* New project */}
              <button
                onClick={handleNewProject}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-mono uppercase tracking-widest border border-[var(--border-dark)] text-[var(--text-muted)] hover:text-white hover:border-white/20 transition-colors flex-shrink-0"
              >
                <Plus size={8} /> New
              </button>

              {/* Keyboard hint */}
              <div className="ml-auto flex items-center gap-1.5 text-[7px] font-mono text-[var(--text-muted)] flex-shrink-0">
                <Command size={8} />
                <span className="hidden lg:inline">1–4 modules · ⌘S save · ESC close</span>
              </div>
            </div>
          </motion.div>
          )}

          {/* ━━━━━ PIPELINE VISUALIZATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <motion.div variants={CA_ITEM} className="mb-4 overflow-x-auto">
            <div className="flex items-stretch border border-[var(--border-dark)] bg-[#030303] min-w-max">
              {PIPELINE_STEPS.map((step, i) => {
                const active = pipelineActive[i];
                return (
                  <React.Fragment key={step.label}>
                    <div className={`flex items-center gap-2 px-4 py-2.5 transition-colors ${active ? 'bg-[var(--rolex-gold)]/5' : ''}`}>
                      {/* State dot */}
                      <div className={`w-3.5 h-3.5 border flex items-center justify-center flex-shrink-0 transition-colors ${
                        active ? 'border-[var(--rolex-gold)] bg-[var(--rolex-gold)]/20' : 'border-[var(--border-dark)]'
                      }`}>
                        {active && <div className="w-1.5 h-1.5 bg-[var(--rolex-gold)]" />}
                      </div>
                      <span className={`text-[8px] font-mono uppercase tracking-widest whitespace-nowrap transition-colors ${
                        active ? 'text-[var(--rolex-gold)]' : 'text-[var(--text-muted)]'
                      }`}>{step.label}</span>
                    </div>
                    {i < PIPELINE_STEPS.length - 1 && (
                      <div className="flex items-center px-1">
                        <ChevronRight size={10} className={`transition-colors ${active && pipelineActive[i+1] ? 'text-[var(--rolex-gold)]/50' : 'text-[var(--border-dark)]'}`} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Contextual data pill */}
              {buildResult && (
                <div className="ml-auto flex items-center gap-1.5 px-4 text-[8px] font-mono text-[var(--rolex-gold)] whitespace-nowrap border-l border-[var(--border-dark)]">
                  <Zap size={9} />
                  {buildResult.rooms?.length} rooms · {buildResult.total_area_sqm}m² · {buildResult.building_name}
                </div>
              )}
            </div>
          </motion.div>

          {/* ━━━━━ TAB NAVIGATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <motion.div variants={CA_ITEM} className="border border-[var(--border-dark)] border-b-0 bg-[#050505] overflow-x-auto">
            <div className="flex min-w-max">
              {TABS.map((tab, i) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-start gap-3 px-5 py-4 text-left transition-all flex-shrink-0 border-b-2 border-r border-[var(--border-dark)] last:border-r-0 group ${
                    activeTab === tab.id
                      ? 'border-b-[var(--rolex-gold)] bg-[var(--rolex-gold)]/5'
                      : 'border-b-transparent hover:bg-white/[0.015] hover:border-b-white/10'
                  }`}
                >
                  <span className={`text-lg mt-0.5 flex-shrink-0 transition-all ${activeTab === tab.id ? '' : 'opacity-35 group-hover:opacity-60'}`}
                        style={{ color: tab.color }}>
                    {tab.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`text-[9px] font-mono font-bold uppercase tracking-widest leading-none transition-colors ${
                        activeTab === tab.id ? 'text-white' : 'text-[var(--text-muted)] group-hover:text-white/70'
                      }`}>{tab.label}</p>
                      {/* Keyboard shortcut hint */}
                      <kbd className="text-[7px] font-mono px-1 py-0.5 bg-white/4 border border-[var(--border-dark)] text-[var(--text-muted)]">
                        {i + 1}
                      </kbd>
                    </div>
                    <p className="text-[8px] font-mono text-[var(--text-muted)] mb-1.5">{tab.sub}</p>
                    <span className="inline-block text-[7px] font-mono px-1.5 py-0.5 border"
                          style={{ color: tab.color, borderColor: tab.color + '40', background: tab.color + '10' }}>
                      {tab.tag}
                    </span>
                  </div>

                  {/* Active dot */}
                  {activeTab === tab.id && (
                    <motion.span
                      layoutId="active-tab-dot"
                      className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-[var(--rolex-gold)]"
                    />
                  )}
                </button>
              ))}
            </div>
          </motion.div>

          {/* ━━━━━ ACTION BAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <motion.div variants={CA_ITEM}
            className="border border-[var(--border-dark)] border-t-0 mb-0 px-4 py-3 bg-[#030303] flex flex-wrap gap-3 items-center"
          >
            {/* Primary action (Sim + Compliance only — Build/Viewer handle internally) */}
            {!currentAction.disabled && (
              <button
                onClick={currentAction.handler}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 bg-[var(--rolex-gold)] text-black text-[9px] font-mono font-bold uppercase tracking-widest hover:bg-[var(--rolex-gold)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Cpu size={10} />
                {loading ? 'PROCESSING…' : `${currentAction.label} →`}
              </button>
            )}

            {/* Compliance: floor plan image upload */}
            {activeTab === 'compliance' && (
              <>
                <input type="file" id="fp-image-upload" accept="image/*" className="hidden" onChange={handleImageUpload} />
                <label
                  htmlFor="fp-image-upload"
                  className="flex items-center gap-2 px-4 py-2 border border-[var(--rolex-gold)]/40 text-[var(--rolex-gold)] text-[9px] font-mono uppercase tracking-widest cursor-pointer hover:bg-[var(--rolex-gold)]/10 transition-colors"
                >
                  <Upload size={9} />
                  {imageBase64 ? 'Image Uploaded ✓' : 'Upload Floor Plan (Vision)'}
                </label>
                {imageBase64 && (
                  <span className="text-[9px] font-mono text-green-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Vision Model Active
                  </span>
                )}
              </>
            )}

            {/* Cross-module contextual hints */}
            {portfolioMode && (
              <span className="text-[8px] font-mono text-emerald-400/90 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                Portfolio demo data loaded — use Re-run to refresh with live API
              </span>
            )}
            {!portfolioMode && activeTab === 'sim' && !buildResult && (
              <span className="text-[8px] font-mono text-[var(--text-muted)] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                Tip: Generate a floor plan in Archion Build first for accurate simulation
              </span>
            )}
            {!portfolioMode && activeTab === 'viewer' && !buildResult && (
              <span className="text-[8px] font-mono text-[var(--text-muted)] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                Tip: Viewer will use your generated floor plan as the 3D model
              </span>
            )}

            {/* Right: Chat toggle + engine badge */}
            <div className="ml-auto flex items-center gap-3">
              {!portfolioMode && (
              <button
                onClick={() => setChatOpen(o => !o)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-mono uppercase tracking-widest border transition-colors ${
                  chatOpen
                    ? 'border-[var(--rolex-gold)]/40 text-[var(--rolex-gold)] bg-[var(--rolex-gold)]/8'
                    : 'border-[var(--border-dark)] text-[var(--text-muted)] hover:text-white'
                }`}
              >
                <MessageSquare size={9} /> AI Chat
                {chatOpen && <X size={8} className="ml-0.5" />}
              </button>
              )}
              <span className="text-[7px] font-mono text-[var(--text-muted)] uppercase tracking-widest hidden md:block">
                Llama 3.3 70B · Groq Inference
              </span>
            </div>
          </motion.div>

          {/* ━━━━━ MAIN LAYOUT: panel + optional chat ━━━━━━━━━━━━━━━━ */}
          <motion.div
            variants={CA_ITEM}
            className={`grid gap-4 mt-0 transition-all duration-300 ${chatOpen ? 'md:grid-cols-[1fr_340px]' : 'grid-cols-1'}`}
          >
            {/* ── Panel content ───────────────────────────────────── */}
            <div className="bg-[#080808] border border-[var(--border-dark)] border-t-0 p-5 md:p-6 min-h-[500px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  variants={panelVariant}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                >
                  {activeTab === 'build' && (
                    <BuildPanel result={buildResult} loading={loading} onGenerate={handleBuildGenerate} />
                  )}
                  {activeTab === 'sim' && (
                    <SimulationPanel result={simResult} loading={loading} rooms={buildResult?.rooms ?? []} />
                  )}
                  {activeTab === 'viewer' && (
                    <ViewerPanel result={viewerResult} loading={loading} buildResult={buildResult} onShare={handleShare} />
                  )}
                  {activeTab === 'compliance' && (
                    <CompliancePanel result={complianceResult} loading={loading} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── ArchionChat sidebar ──────────────────────────────── */}
            <AnimatePresence>
              {chatOpen && !portfolioMode && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                  className="border border-[var(--border-dark)] border-t-0 min-h-[500px] flex flex-col"
                >
                  <ArchionChat
                    buildResult={buildResult}
                    simResult={simResult}
                    complianceResult={complianceResult}
                    onClose={() => setChatOpen(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ━━━━━ MODULE OVERVIEW GRID ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <motion.div
            variants={CA_ITEM}
            className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border-dark)] border border-[var(--border-dark)]"
          >
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`bg-[#050505] p-5 text-left hover:bg-[#0A0A0A] transition-colors group ${activeTab === tab.id ? 'bg-[var(--rolex-gold)]/4' : ''}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base" style={{ color: tab.color }}>{tab.icon}</span>
                  <p className="text-[8px] font-mono font-bold uppercase tracking-widest text-white">{tab.label}</p>
                </div>
                <ul className="space-y-1.5">
                  {tab.features.map(item => (
                    <li key={item} className="flex items-start gap-2 text-[8px] font-mono text-[var(--text-muted)] group-hover:text-white/50 transition-colors">
                      <span className="mt-0.5 flex-shrink-0" style={{ color: tab.color }}>·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </motion.div>

          {/* Footer line */}
          <motion.div variants={CA_ITEM} className="mt-4 flex items-center justify-between text-[7px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
            <span>Tokenly Build Engine v4.0 · Tokenly Protocol</span>
            <span className="hidden md:block">
              Llama 3.3 70B · MARL Social Force · AES-256-GCM · SL UDA 2023 · ISO 21542:2011
            </span>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
}

export default function ArchionLabsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-[var(--rolex-gold)]">
            Loading Tokenly Build…
          </p>
        </div>
      }
    >
      <ArchionLabsDashboard />
    </Suspense>
  );
}

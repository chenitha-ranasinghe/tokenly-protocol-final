'use client';

import React, {
  useState, useRef, useEffect, useCallback,
} from 'react';
import {
  Activity, Users, AlertTriangle, ShieldCheck,
  FileText, Play, Pause, RefreshCw, Download, Camera,
  Zap,
} from 'lucide-react';
import { PanelLoader, PanelEmpty } from './CompliancePanel';
import type { Room } from './BuildPanel';

// ─────────────────────────────────────────────────────────────────────────────
// Exported types
// ─────────────────────────────────────────────────────────────────────────────
interface AccessibilityCheck {
  standard: string; clause: string; requirement: string;
  required_value: string; measured_value: string;
  status: 'PASS' | 'FAIL' | 'WARN'; severity: string;
  description: string; remediation: string | null;
}

export interface MARLSimResult {
  success: boolean; powered_by: string; model_id: string;
  simulation_metrics: {
    total_agents: number; simulation_duration_s: number; avg_travel_time_s: number;
    max_density_m2: number; bottleneck_risk: string; egress_score: number;
    flow_rate_agents_per_min: number; evacuation_time_s: number; congestion_zones: string[];
  };
  accessibility: {
    score: number; standards_checked: string[];
    pass_count: number; fail_count: number; warn_count: number;
    checks: AccessibilityCheck[];
  };
  executive_summary: string;
  recommendations: string[];
  evacuation_assessment: string;
  report_available: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent type definitions
// ─────────────────────────────────────────────────────────────────────────────
type AgentType = 'normal' | 'elderly' | 'wheelchair' | 'child';

const AGENT_TYPE_CONFIG: Record<AgentType, {
  label: string; speed: number; r: number; color: string; ratio: number; symbol: string;
}> = {
  normal:     { label: 'Normal',     speed: 1.00, r: 0.28, color: '#22c55e', ratio: 0.70, symbol: '●' },
  elderly:    { label: 'Elderly',    speed: 0.50, r: 0.30, color: '#f59e0b', ratio: 0.15, symbol: '◆' },
  wheelchair: { label: 'Wheelchair', speed: 0.40, r: 0.38, color: '#3b82f6', ratio: 0.08, symbol: '■' },
  child:      { label: 'Child',      speed: 1.30, r: 0.22, color: '#f97316', ratio: 0.07, symbol: '▲' },
};

const SPEED_OPTIONS: { label: string; value: number }[] = [
  { label: '0.5×', value: 0.5 },
  { label: '1×',   value: 1   },
  { label: '2×',   value: 2   },
  { label: '4×',   value: 4   },
];

// ─────────────────────────────────────────────────────────────────────────────
// Agent interface
// ─────────────────────────────────────────────────────────────────────────────
interface Agent {
  x: number; y: number; vx: number; vy: number;
  goalX: number; goalY: number; goalIdx: number;
  type: AgentType; baseSpeed: number; r: number; color: string;
}

interface Bounds { minX: number; minY: number; maxX: number; maxY: number; }

function getBounds(rooms: Room[]): Bounds {
  if (!rooms.length) return { minX: 0, minY: 0, maxX: 20, maxY: 15 };
  return {
    minX: Math.min(...rooms.map(r => r.x)),
    minY: Math.min(...rooms.map(r => r.y)),
    maxX: Math.max(...rooms.map(r => r.x + r.width)),
    maxY: Math.max(...rooms.map(r => r.y + r.height)),
  };
}

function makeAgents(count: number, rooms: Room[], bounds: Bounds, enabledTypes: Set<AgentType>): Agent[] {
  const waypoints = rooms.length
    ? rooms.map(r => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 }))
    : [{ x:5,y:5 }, { x:10,y:5 }, { x:15,y:10 }, { x:5,y:12 }];

  const types      = (Object.keys(AGENT_TYPE_CONFIG) as AgentType[]).filter(t => enabledTypes.has(t));
  const totalRatio = types.reduce((s, t) => s + AGENT_TYPE_CONFIG[t].ratio, 0) || 1;

  return Array.from({ length: count }, (_, i) => {
    // Pick type by weighted ratio
    let pick = types[0] ?? 'normal';
    let rand = Math.random() * totalRatio;
    for (const t of types) {
      rand -= AGENT_TYPE_CONFIG[t].ratio;
      if (rand <= 0) { pick = t; break; }
    }
    const cfg = AGENT_TYPE_CONFIG[pick];

    // Start position inside a random room (or anywhere in bounds if no rooms)
    let sx: number, sy: number;
    if (rooms.length) {
      const r = rooms[Math.floor(Math.random() * rooms.length)];
      sx = r.x + Math.random() * r.width;
      sy = r.y + Math.random() * r.height;
    } else {
      sx = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      sy = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
    }

    const goalIdx = Math.floor(Math.random() * waypoints.length);
    return {
      x: sx, y: sy, vx: 0, vy: 0,
      goalX: waypoints[goalIdx].x,
      goalY: waypoints[goalIdx].y,
      goalIdx,
      type:      pick,
      baseSpeed: cfg.speed * (0.85 + Math.random() * 0.3), // slight individual variance
      r:         cfg.r,
      color:     cfg.color,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MARL Canvas — live Social-Force Model simulation
// ─────────────────────────────────────────────────────────────────────────────
function MARLCanvas({
  rooms, agentCount, running, speedMultiplier,
  enabledTypes, emergency, resetKey,
}: {
  rooms: Room[]; agentCount: number; running: boolean;
  speedMultiplier: number; enabledTypes: Set<AgentType>;
  emergency: boolean; resetKey: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // All simulation state lives in a single ref object so the render loop can
  // read it without stale closures and without triggering React re-renders.
  const simRef = useRef<{
    agents: Agent[];
    heatmap: Float32Array;
    waypoints: { x: number; y: number }[];
    exitPoints: { x: number; y: number }[];
    bounds: Bounds;
    elapsed: number;
  }>({
    agents: [], heatmap: new Float32Array(80 * 60),
    waypoints: [], exitPoints: [],
    bounds: { minX:0, minY:0, maxX:20, maxY:15 },
    elapsed: 0,
  });

  // Control refs — mutated by React state without stopping the loop
  const runRef   = useRef(running);
  const speedRef = useRef(speedMultiplier);
  const emergRef = useRef(emergency);
  useEffect(() => { runRef.current  = running;         }, [running]);
  useEffect(() => { speedRef.current = speedMultiplier; }, [speedMultiplier]);
  useEffect(() => { emergRef.current = emergency;       }, [emergency]);

  // Reinitialise agents whenever key inputs change
  useEffect(() => {
    const bounds = getBounds(rooms);
    const waypoints = rooms.length
      ? rooms.map(r => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 }))
      : [{ x:5,y:5 }, { x:10,y:5 }, { x:15,y:10 }, { x:5,y:12 }];

    // Approximate exit points from egress: use far corners as fallback
    const exitPoints = waypoints.length ? [waypoints[waypoints.length - 1]] : [{ x: bounds.maxX, y: bounds.maxY }];

    simRef.current = {
      agents:      makeAgents(agentCount, rooms, bounds, enabledTypes),
      heatmap:     new Float32Array(80 * 60),
      waypoints,
      exitPoints,
      bounds,
      elapsed:     0,
    };
  }, [rooms, agentCount, enabledTypes, resetKey]);

  // One-shot render loop — never re-created. It reads everything through refs.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    ro.observe(canvas);
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const HM_W = 80, HM_H = 60;
    let rafId = 0;

    const loop = () => {
      rafId = requestAnimationFrame(loop);
      const { agents, heatmap, waypoints, exitPoints, bounds } = simRef.current;
      const DT = 0.05 * speedRef.current;

      // ── Physics step ──────────────────────────────────────────────────────
      if (runRef.current && waypoints.length) {
        simRef.current.elapsed += DT;

        agents.forEach(a => {
          // Goal: emergency → rush to exit, otherwise cycle waypoints
          const target = emergRef.current
            ? exitPoints[0]
            : { x: a.goalX, y: a.goalY };

          const dx   = target.x - a.x, dy = target.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

          // Self-drive force (desired velocity → current velocity)
          a.vx += ((dx / dist) * a.baseSpeed - a.vx) * 0.13;
          a.vy += ((dy / dist) * a.baseSpeed - a.vy) * 0.13;

          // Agent–agent repulsion (Social Force)
          agents.forEach(b => {
            if (b === a) return;
            const rx = a.x - b.x, ry = a.y - b.y;
            const rd = Math.sqrt(rx * rx + ry * ry) || 0.001;
            if (rd < 1.1) {
              const f = 0.035 / (rd * rd);
              a.vx += (rx / rd) * f;
              a.vy += (ry / rd) * f;
            }
          });

          // Boundary repulsion (building walls)
          const M = 0.5;
          if (a.x - bounds.minX < M) a.vx += 0.12;
          if (bounds.maxX - a.x < M) a.vx -= 0.12;
          if (a.y - bounds.minY < M) a.vy += 0.12;
          if (bounds.maxY - a.y < M) a.vy -= 0.12;

          // Speed clamp
          const spd = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
          if (spd > a.baseSpeed * 1.5) {
            a.vx *= a.baseSpeed * 1.5 / spd;
            a.vy *= a.baseSpeed * 1.5 / spd;
          }

          // Integrate
          a.x = Math.max(bounds.minX + 0.05, Math.min(bounds.maxX - 0.05, a.x + a.vx * DT));
          a.y = Math.max(bounds.minY + 0.05, Math.min(bounds.maxY - 0.05, a.y + a.vy * DT));

          // Advance goal waypoint when reached
          if (!emergRef.current && dist < 0.55) {
            a.goalIdx = (a.goalIdx + 1) % waypoints.length;
            a.goalX   = waypoints[a.goalIdx].x;
            a.goalY   = waypoints[a.goalIdx].y;
          }

          // Accumulate heatmap
          const planW = bounds.maxX - bounds.minX || 1;
          const planH = bounds.maxY - bounds.minY || 1;
          const hx = Math.floor(((a.x - bounds.minX) / planW) * HM_W);
          const hy = Math.floor(((a.y - bounds.minY) / planH) * HM_H);
          if (hx >= 0 && hx < HM_W && hy >= 0 && hy < HM_H) {
            heatmap[hy * HM_W + hx] += 0.55;
          }
        });

        // Heatmap temporal decay
        for (let i = 0; i < heatmap.length; i++) heatmap[i] *= 0.9965;
      }

      // ── Render ─────────────────────────────────────────────────────────────
      const W = canvas.width, H = canvas.height;
      if (!W || !H) return;
      ctx.clearRect(0, 0, W, H);

      // Dot grid
      ctx.fillStyle = 'rgba(255,255,255,0.018)';
      for (let x = 0; x < W; x += 22) for (let y = 0; y < H; y += 22) ctx.fillRect(x, y, 1, 1);

      const planW = bounds.maxX - bounds.minX || 1;
      const planH = bounds.maxY - bounds.minY || 1;
      const pad   = 26;
      const s     = Math.min((W - pad * 2) / planW, (H - pad * 2) / planH);
      const ox    = pad + (W - pad * 2 - planW * s) / 2;
      const oy    = pad + (H - pad * 2 - planH * s) / 2;
      const cv    = (x: number) => ox + (x - bounds.minX) * s;
      const cy2   = (y: number) => oy + (y - bounds.minY) * s;

      // Room outlines
      rooms.forEach(r => {
        ctx.fillStyle   = 'rgba(100,116,139,0.07)';
        ctx.fillRect(cv(r.x), cy2(r.y), r.width * s, r.height * s);
        ctx.strokeStyle = 'rgba(100,116,139,0.4)';
        ctx.lineWidth   = 1;
        ctx.strokeRect(cv(r.x), cy2(r.y), r.width * s, r.height * s);
        if (r.width * s > 36 && r.height * s > 20) {
          ctx.fillStyle    = 'rgba(148,163,184,0.28)';
          const fs         = Math.max(6.5, Math.min(9, r.width * s / 7));
          ctx.font         = `${fs}px monospace`;
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(r.name.toUpperCase(), cv(r.x + r.width / 2), cy2(r.y + r.height / 2));
        }
      });

      // Heatmap overlay
      const maxHeat = Math.max(...Array.from(heatmap), 0.01);
      const cW = planW / HM_W * s, cH = planH / HM_H * s;
      for (let hy = 0; hy < HM_H; hy++) {
        for (let hx = 0; hx < HM_W; hx++) {
          const v = heatmap[hy * HM_W + hx];
          if (v < 0.08) continue;
          const t = Math.min(v / maxHeat, 1);
          // Low→green, mid→orange, high→red
          const r2 = Math.floor(255 * t);
          const g2 = Math.floor(140 * (1 - t) * 0.6);
          ctx.fillStyle = `rgba(${r2},${g2},0,${t * 0.62})`;
          ctx.fillRect(ox + hx * cW, oy + hy * cH, cW + 0.5, cH + 0.5);
        }
      }

      // Agents
      agents.forEach(a => {
        const ax = cv(a.x), ay = cy2(a.y);
        const ar = Math.max(2.5, a.r * s);

        // Body
        ctx.beginPath();
        ctx.arc(ax, ay, ar, 0, Math.PI * 2);
        ctx.fillStyle   = a.color + 'CC';
        ctx.fill();
        ctx.strokeStyle = a.color;
        ctx.lineWidth   = 0.8;
        ctx.stroke();

        // Velocity vector
        const vl = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
        if (vl > 0.1) {
          ctx.strokeStyle = a.color + '55';
          ctx.lineWidth   = 0.5;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax + (a.vx / vl) * ar * 3.5, ay + (a.vy / vl) * ar * 3.5);
          ctx.stroke();
        }
      });

      // Emergency flash border
      if (emergRef.current) {
        ctx.strokeStyle = 'rgba(239,68,68,0.6)';
        ctx.lineWidth   = 3;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(2, 2, W - 4, H - 4);
        ctx.setLineDash([]);
        ctx.fillStyle    = 'rgba(239,68,68,0.85)';
        ctx.font         = 'bold 9px monospace';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('⚠ EMERGENCY EGRESS MODE', W / 2, 8);
      }

      // ── Live stats overlay (top-left) ─────────────────────────────────────
      const totalArea = planW * planH;
      const density   = agents.length / totalArea;
      const avgSpd    = agents.reduce((s2, a) => s2 + Math.sqrt(a.vx * a.vx + a.vy * a.vy), 0) / (agents.length || 1);
      const elapsed   = simRef.current.elapsed;

      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(10, 10, 162, 82);
      ctx.strokeStyle = 'rgba(163,126,44,0.4)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(10, 10, 162, 82);

      ctx.fillStyle    = '#a37e2c';
      ctx.font         = 'bold 7px monospace';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('▸ LIVE SIMULATION', 17, 18);

      const stats = [
        [`Agents:`,  `${agents.length}`],
        [`Density:`, `${density.toFixed(3)}/m²`],
        [`Avg Spd:`, `${(avgSpd * 1.4).toFixed(2)} m/s`],
        [`Elapsed:`, `${elapsed.toFixed(0)}s`],
        [`Speed:`,   `×${speedRef.current}`],
      ];
      ctx.font = '7px monospace';
      stats.forEach(([k, v], i) => {
        ctx.fillStyle = '#6b7280';
        ctx.fillText(k, 17, 32 + i * 11);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(v, 72, 32 + i * 11);
      });

      // Heatmap legend
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(W - 100, H - 50, 90, 42);
      ctx.font      = '6.5px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#a37e2c';
      ctx.fillText('DENSITY', W - 94, H - 43);
      const lgGrad = ctx.createLinearGradient(W - 94, 0, W - 22, 0);
      lgGrad.addColorStop(0, 'rgba(0,120,0,0.8)');
      lgGrad.addColorStop(0.5, 'rgba(255,140,0,0.8)');
      lgGrad.addColorStop(1, 'rgba(255,0,0,0.8)');
      ctx.fillStyle = lgGrad;
      ctx.fillRect(W - 94, H - 32, 78, 7);
      ctx.fillStyle = '#6b7280';
      ctx.fillText('LOW', W - 94, H - 20);
      ctx.fillText('HIGH', W - 47, H - 20);
    };

    loop();
    return () => { cancelAnimationFrame(rafId); ro.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — loop never re-creates; reads everything via refs

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ imageRendering: 'crisp-edges' }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ s }: { s: 'PASS' | 'FAIL' | 'WARN' }) {
  const cls = {
    PASS: 'text-[#22c55e] border-[#22c55e]/40 bg-[#22c55e]/10',
    FAIL: 'text-[#ef4444] border-[#ef4444]/40 bg-[#ef4444]/10',
    WARN: 'text-[#f97316] border-[#f97316]/40 bg-[#f97316]/10',
  };
  return (
    <span className={`text-[8px] font-mono font-bold px-2 py-0.5 border flex-shrink-0 ${cls[s]}`}>
      {s}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main SimulationPanel
// ─────────────────────────────────────────────────────────────────────────────
export function SimulationPanel({
  result, loading, rooms = [],
}: {
  result: MARLSimResult | null; loading: boolean; rooms?: Room[];
}) {
  const [running,        setRunning]        = useState(true);
  const [agentCount,     setAgentCount]     = useState(45);
  const [speedMultiplier,setSpeedMultiplier]= useState(1);
  const [emergency,      setEmergency]      = useState(false);
  const [resetKey,       setResetKey]       = useState(0);
  const [enabledTypes,   setEnabledTypes]   = useState<Set<AgentType>>(
    new Set(['normal', 'elderly', 'wheelchair', 'child'] as AgentType[])
  );
  const [activeTab,      setActiveTab]      = useState<'sim' | 'accessibility' | 'report'>('sim');
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  const toggleType = (t: AgentType) => {
    setEnabledTypes(prev => {
      const next = new Set(prev);
      if (next.has(t) && next.size > 1) next.delete(t); // keep at least one
      else next.add(t);
      return next;
    });
    setResetKey(k => k + 1);
  };

  const handleReset = useCallback(() => {
    setRunning(false);
    setTimeout(() => { setResetKey(k => k + 1); setRunning(true); }, 80);
  }, []);

  const handleSnapshot = () => {
    const canvas = canvasWrapperRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link  = document.createElement('a');
    link.href     = (canvas as HTMLCanvasElement).toDataURL('image/png');
    link.download = `archion-sim-heatmap-${Date.now()}.png`;
    link.click();
  };

  const handlePdfReport = () => {
    if (!result) return;
    const { simulation_metrics: sm, accessibility: acc } = result;
    const checksHtml = acc.checks
      .map(
        (c) =>
          `<tr><td>${c.standard}</td><td>${c.clause}</td><td>${c.status}</td><td>${c.measured_value}</td><td>${c.remediation ?? '—'}</td></tr>`
      )
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Archion Sim Report</title>
<style>body{font-family:Georgia,serif;padding:40px;color:#111}h1{font-size:22px}table{width:100%;border-collapse:collapse;font-size:11px;margin-top:16px}
th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f5f5f5}.meta{font-family:monospace;font-size:10px;color:#666;margin-bottom:24px}</style></head>
<body><h1>Archion Sim — Compliance &amp; Pedestrian Report</h1>
<p class="meta">ArchionLabs · UDA 2023 · ISO 21542:2011 · ${new Date().toLocaleString()}</p>
<p><strong>Executive summary:</strong> ${result.executive_summary}</p>
<p><strong>Egress score:</strong> ${sm.egress_score}/100 · <strong>Evacuation:</strong> ${sm.evacuation_time_s}s · <strong>Accessibility:</strong> ${acc.score}/100</p>
<p><strong>Evacuation assessment:</strong> ${result.evacuation_assessment}</p>
<h2>Accessibility checks</h2><table><thead><tr><th>Standard</th><th>Clause</th><th>Status</th><th>Measured</th><th>Remediation</th></tr></thead><tbody>${checksHtml}</tbody></table>
<h2>Recommendations</h2><ul>${result.recommendations.map((r) => `<li>${r}</li>`).join('')}</ul>
<p class="meta">11-page institutional report — condensed print view · ArchionLabs Protocol</p></body></html>`;
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  // ── Live demo canvas (always visible, even without API result) ────────────
  const liveCanvas = (
    <div ref={canvasWrapperRef} className="bg-black border border-[var(--border-dark)] relative overflow-hidden" style={{ height: 340 }}>
      <MARLCanvas
        rooms={rooms}
        agentCount={agentCount}
        running={running}
        speedMultiplier={speedMultiplier}
        enabledTypes={enabledTypes}
        emergency={emergency}
        resetKey={resetKey}
      />

      {/* Canvas controls — top-left status */}
      <div className="absolute top-3 left-[180px] z-10 flex flex-col gap-1.5">
        <div className="px-2.5 py-1.5 bg-black/75 border border-white/10 backdrop-blur-sm">
          <p className="text-[7px] font-mono text-[var(--rolex-gold)] uppercase tracking-[0.2em] mb-0.5 font-bold">
            MARL_v4 · SOCIAL_FORCE
          </p>
          <div className="flex items-center gap-2 text-[8px] font-mono text-white">
            <span className={`w-1.5 h-1.5 rounded-full ${running ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {running ? 'RUNNING' : 'PAUSED'} · {agentCount} agents
          </div>
        </div>

        {result && (
          <div className="px-2.5 py-1.5 bg-black/75 border border-white/10 text-[8px] font-mono">
            <div className="text-[var(--text-muted)] mb-0.5">BOTTLENECK RISK</div>
            <div className={`font-bold ${
              result.simulation_metrics.bottleneck_risk==='HIGH' ? 'text-red-400'
              : result.simulation_metrics.bottleneck_risk==='MEDIUM' ? 'text-orange-400'
              : 'text-green-400'
            }`}>
              {result.simulation_metrics.bottleneck_risk}
            </div>
          </div>
        )}
      </div>

      {/* Play/pause + reset + snapshot buttons */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
        <button onClick={() => setRunning(r => !r)}
          className="p-2 bg-black/75 border border-white/10 hover:border-[var(--rolex-gold)]/50 transition-colors"
          title={running ? 'Pause' : 'Resume'}
        >
          {running ? <Pause size={12} className="text-[var(--rolex-gold)]"/> : <Play size={12} className="text-[var(--rolex-gold)]"/>}
        </button>
        <button onClick={handleReset} className="p-2 bg-black/75 border border-white/10 hover:border-[var(--rolex-gold)]/50 transition-colors" title="Reset agents">
          <RefreshCw size={12} className="text-[var(--text-muted)]"/>
        </button>
        <button onClick={handleSnapshot} className="p-2 bg-black/75 border border-white/10 hover:border-green-500/50 transition-colors" title="Save heatmap PNG">
          <Camera size={12} className="text-[var(--text-muted)]"/>
        </button>
      </div>

      {/* Bottom control strip */}
      <div className="absolute bottom-3 left-3 right-3 z-10 space-y-2">
        {/* Agent count slider */}
        <div className="flex items-center gap-3 px-3 py-2 bg-black/75 border border-white/10 backdrop-blur-sm">
          <span className="text-[7px] font-mono text-[var(--text-muted)] uppercase whitespace-nowrap">
            Agents: <span className="text-[var(--rolex-gold)]">{agentCount}</span>
          </span>
          <input
            type="range" min={8} max={120} value={agentCount}
            onChange={e => { setAgentCount(+e.target.value); setResetKey(k => k + 1); }}
            className="flex-1 accent-[var(--rolex-gold)]"
          />
          {/* Speed multiplier */}
          <div className="flex gap-1 flex-shrink-0">
            {SPEED_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSpeedMultiplier(opt.value)}
                className={`text-[7px] font-mono px-1.5 py-0.5 border transition-colors ${
                  speedMultiplier === opt.value
                    ? 'border-[var(--rolex-gold)] text-[var(--rolex-gold)] bg-[var(--rolex-gold)]/10'
                    : 'border-white/10 text-white/40 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Emergency toggle */}
          <button
            onClick={() => setEmergency(e => !e)}
            className={`text-[7px] font-mono px-2 py-0.5 border transition-colors flex-shrink-0 ${
              emergency
                ? 'border-red-500/60 text-red-400 bg-red-500/15'
                : 'border-white/10 text-white/40 hover:text-orange-400 hover:border-orange-400/40'
            }`}
          >
            ⚠ EMERGENCY
          </button>
        </div>

        {/* Agent type filters */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/75 border border-white/10 backdrop-blur-sm flex-wrap">
          <span className="text-[7px] font-mono text-[var(--text-muted)] uppercase whitespace-nowrap">Types:</span>
          {(Object.entries(AGENT_TYPE_CONFIG) as [AgentType, typeof AGENT_TYPE_CONFIG[AgentType]][]).map(([type, cfg]) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`flex items-center gap-1 text-[7px] font-mono px-2 py-0.5 border transition-colors ${
                enabledTypes.has(type)
                  ? 'border-opacity-50 bg-opacity-10'
                  : 'border-white/10 text-white/25'
              }`}
              style={enabledTypes.has(type) ? {
                borderColor: cfg.color + '70',
                color:        cfg.color,
                background:   cfg.color + '18',
              } : {}}
            >
              <span>{cfg.symbol}</span>
              {cfg.label} ({Math.round(cfg.ratio * 100)}%)
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) return <PanelLoader label="Initialising MARL Pedestrian Simulation…" />;

  if (!result) {
    return (
      <div className="space-y-4">
        {liveCanvas}
        <PanelEmpty
          label="ARCHION SIM"
          description="Generate a floor plan with Archion Build then click 'Run MARL Simulation'. The simulation above is a live demo using the current floor plan (or a default layout)."
        />
      </div>
    );
  }

  const { simulation_metrics: sm, accessibility: acc } = result;

  return (
    <div className="space-y-4">
      {liveCanvas}

      {/* ── Key metrics strip ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border-dark)] border border-[var(--border-dark)]">
        {[
          { label:'Egress Score',  value:`${sm.egress_score}/100`,                color:sm.egress_score>=80?'#22c55e':sm.egress_score>=60?'#f97316':'#ef4444' },
          { label:'Flow Rate',     value:`${sm.flow_rate_agents_per_min}/min`,    color:'#a37e2c' },
          { label:'Evacuation',    value:`${sm.evacuation_time_s}s`,              color:sm.evacuation_time_s<180?'#22c55e':'#f97316' },
          { label:'Access. Score', value:`${acc.score}/100`,                      color:acc.score>=80?'#22c55e':acc.score>=60?'#f97316':'#ef4444' },
        ].map(s => (
          <div key={s.label} className="bg-[#050505] p-4">
            <p className="text-[7px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-2">{s.label}</p>
            <p className="text-xl font-mono font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Tab navigation ─────────────────────────────────────── */}
      <div className="flex border border-[var(--border-dark)] overflow-x-auto">
        {([
          ['sim'           as const, 'Simulation Results', Activity    ],
          ['accessibility' as const, 'Accessibility Audit', ShieldCheck],
          ['report'        as const, 'PDF Report',          FileText   ],
        ] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-5 py-3 text-[8px] font-mono uppercase tracking-widest transition-colors flex-shrink-0 border-r border-[var(--border-dark)] last:border-r-0 ${
              activeTab===id ? 'bg-[var(--rolex-gold)]/8 text-[var(--rolex-gold)]' : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            <Icon size={10}/> {label}
          </button>
        ))}
      </div>

      {/* ── Simulation Results ──────────────────────────────────── */}
      {activeTab==='sim' && (
        <div className="space-y-4">
          <div className="bg-[#050505] border border-[var(--border-dark)] p-5">
            <p className="text-[7px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-2 font-bold">Executive Summary</p>
            <p className="text-[11px] text-white/70 leading-relaxed">{result.executive_summary}</p>
          </div>

          {sm.congestion_zones?.length > 0 && (
            <div className="bg-[#050505] border border-[var(--border-dark)] p-5">
              <p className="text-[7px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-3 font-bold flex items-center gap-2">
                <AlertTriangle size={9} className="text-orange-400"/> Congestion Zones
              </p>
              <div className="flex flex-wrap gap-2">
                {sm.congestion_zones.map((z, i) => (
                  <span key={i} className="text-[9px] font-mono px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 text-orange-400">{z}</span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#050505] border border-[var(--border-dark)]">
            <div className="px-5 py-3 border-b border-[var(--border-dark)] bg-[#0A0A0A]">
              <p className="text-[8px] font-mono uppercase tracking-widest text-white font-bold flex items-center gap-2">
                <Users size={11} className="text-[var(--rolex-gold)]"/> Simulation Metrics
              </p>
            </div>
            <div className="divide-y divide-[var(--border-dark)]">
              {[
                ['Total Agents',    `${sm.total_agents}`],
                ['Duration',        `${sm.simulation_duration_s}s`],
                ['Avg Travel Time', `${sm.avg_travel_time_s}s`],
                ['Peak Density',    `${sm.max_density_m2} agents/m²`],
                ['Flow Rate',       `${sm.flow_rate_agents_per_min} agents/min`],
                ['Evacuation Time', `${sm.evacuation_time_s}s`],
              ].map(([k, v]) => (
                <div key={k} className="px-5 py-3 flex justify-between text-[9px] font-mono">
                  <span className="text-[var(--text-muted)]">{k}</span>
                  <span className="text-white font-bold">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {result.recommendations?.length > 0 && (
            <div className="bg-[#050505] border border-[var(--border-dark)] p-5">
              <p className="text-[7px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-4 font-bold flex items-center gap-2">
                <Zap size={9} className="text-[var(--rolex-gold)]"/> AI Remediation Advice
              </p>
              <ul className="space-y-2.5">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-3 text-[11px] text-white/70">
                    <span className="text-[var(--rolex-gold)] font-mono text-[8px] flex-shrink-0 mt-0.5 font-bold">
                      {String(i+1).padStart(2,'0')}
                    </span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Accessibility Audit ─────────────────────────────────── */}
      {activeTab==='accessibility' && (
        <div className="space-y-4">
          <div className="flex items-center gap-6 p-5 bg-[#050505] border border-[var(--border-dark)]">
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg viewBox="0 0 80 80" className="-rotate-90 w-full h-full">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4"/>
                <circle cx="40" cy="40" r="34" fill="none"
                  stroke={acc.score>=80?'#22c55e':acc.score>=60?'#f97316':'#ef4444'}
                  strokeWidth="5" strokeLinecap="square"
                  strokeDasharray={`${(acc.score/100)*213.6} 213.6`}/>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-mono font-bold text-white">{acc.score}</span>
              </div>
            </div>
            <div>
              <p className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-2">Accessibility Compliance Score</p>
              <div className="flex gap-3 text-[9px] font-mono mb-3">
                <span className="text-green-400">{acc.pass_count} PASS</span>
                <span className="text-orange-400">{acc.warn_count} WARN</span>
                <span className="text-red-400">{acc.fail_count} FAIL</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {acc.standards_checked.map(st => (
                  <span key={st} className="text-[7px] font-mono px-2 py-0.5 bg-[var(--rolex-gold)]/10 border border-[var(--rolex-gold)]/20 text-[var(--rolex-gold)] uppercase tracking-wider">{st}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[#050505] border border-[var(--border-dark)]">
            <div className="px-5 py-3 border-b border-[var(--border-dark)] bg-[#0A0A0A]">
              <p className="text-[8px] font-mono uppercase tracking-widest text-white font-bold flex items-center gap-2">
                <ShieldCheck size={11} className="text-[var(--rolex-gold)]"/> Compliance Checks — SL UDA 2023 · ISO 21542:2011
              </p>
            </div>
            <div className="divide-y divide-[var(--border-dark)]">
              {acc.checks.map((chk, i) => (
                <div key={i} className="p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <StatusBadge s={chk.status}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-bold text-white">{chk.requirement}</span>
                        <span className="text-[7px] font-mono text-[var(--text-muted)]">{chk.standard} · {chk.clause}</span>
                      </div>
                      <div className="flex gap-4 text-[8px] font-mono mb-1.5">
                        <span className="text-[var(--text-muted)]">Required: <span className="text-white">{chk.required_value}</span></span>
                        <span className="text-[var(--text-muted)]">Measured: <span className={chk.status==='PASS'?'text-green-400':chk.status==='FAIL'?'text-red-400':'text-orange-400'}>{chk.measured_value}</span></span>
                      </div>
                      <p className="text-[9px] text-white/55 leading-relaxed">{chk.description}</p>
                    </div>
                  </div>
                  {chk.remediation && (
                    <div className="ml-14 mt-2 px-3 py-2 bg-[var(--rolex-gold)]/5 border-l-2 border-[var(--rolex-gold)]/40">
                      <p className="text-[7px] font-mono text-[var(--rolex-gold)] font-bold uppercase tracking-wider mb-0.5">Remediation</p>
                      <p className="text-[9px] text-white/55">{chk.remediation}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PDF Report ──────────────────────────────────────────── */}
      {activeTab==='report' && (
        <div className="space-y-4">
          <div className="bg-[#050505] border border-[var(--border-dark)] p-6">
            <div className="flex items-start gap-5">
              <div className="w-16 h-20 bg-[#0A0A0A] border border-[var(--border-dark)] flex flex-col items-center justify-center gap-1 flex-shrink-0">
                <FileText size={20} className="text-[var(--rolex-gold)]"/>
                <span className="text-[7px] font-mono text-[var(--text-muted)] uppercase">PDF</span>
              </div>
              <div>
                <p className="text-white font-bold text-sm mb-1">ArchionSim Full Compliance Report</p>
                <p className="text-[10px] text-white/50 mb-3 leading-relaxed">
                  11-page report with MARL density heatmaps, egress flow charts, SL UDA 2023 + ISO 21542:2011
                  compliance audit, AI remediation plans, and technical appendices.
                </p>
                <div className="flex flex-wrap gap-3 text-[8px] font-mono text-[var(--text-muted)]">
                  {['Density Heatmaps','Egress Flow Rates','Compliance Checklist','AI Recommendations','Technical Appendix'].map(item => (
                    <span key={item} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 bg-[var(--rolex-gold)] rounded-full"/>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-px bg-[var(--border-dark)] border border-[var(--border-dark)]">
            {[['Pages','11'],['Standards','3'],['Checks',`${acc.checks.length}`]].map(([l,v]) => (
              <div key={l} className="bg-[#050505] p-4">
                <p className="text-[7px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-1">{l}</p>
                <p className="text-lg font-mono font-bold text-white">{v}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handlePdfReport}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-[var(--rolex-gold)] text-black text-[9px] font-mono font-bold uppercase tracking-widest hover:bg-[var(--rolex-gold)]/90 transition-colors"
            >
              <Download size={13}/> Generate &amp; Download PDF Report
            </button>
            <button onClick={handleSnapshot} className="flex items-center gap-2 px-4 py-3.5 border border-[var(--border-dark)] text-[var(--text-muted)] text-[9px] font-mono uppercase tracking-widest hover:text-white hover:border-white/20 transition-colors">
              <Camera size={13}/> Save Heatmap PNG
            </button>
          </div>
          <p className="text-[8px] font-mono text-[var(--text-muted)] text-center">
            Report includes digital watermarking · Formatted for professional client delivery
          </p>
        </div>
      )}
    </div>
  );
}

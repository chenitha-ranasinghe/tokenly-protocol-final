'use client';

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Exported types
// ─────────────────────────────────────────────────────────────────────────────
export interface Violation {
  id:                 string;
  severity:           'critical' | 'major' | 'minor';
  jurisdiction:       string;
  clause:             string;
  description:        string;
  confidence_score:   number;
  estimated_cost_lkr?: number;
  estimated_cost_sgd?: number;
  fix_type?:          string;
}

export interface ComplianceResult {
  overall_compliance_score: number;
  violations:               Violation[];
  summary:                  string;
  jurisdictions_checked:    string[];
  confidence?:              number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Colour map for severity levels
// ─────────────────────────────────────────────────────────────────────────────
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  major:    '#f97316',
  minor:    '#eab308',
};

// ─────────────────────────────────────────────────────────────────────────────
// CompliancePanel
// ─────────────────────────────────────────────────────────────────────────────
export function CompliancePanel({
  result, loading,
}: {
  result:  ComplianceResult | null;
  loading: boolean;
}) {
  if (loading) return <PanelLoader label="Running SL UDA 2023 + ISO 21542:2011 Compliance Scan…" />;
  if (!result) return (
    <PanelEmpty
      label="COMPLIANCE ORACLE"
      description="Run a compliance scan to audit your floor plan against Sri Lankan Urban Development Authority 2023 regulations, ISO 21542:2011 accessibility standards, and SLNBC fire safety codes. Upload a floor plan image or generate one with Archion Build first."
    />
  );

  const score = result.overall_compliance_score;
  const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#f97316' : '#ef4444';

  // Count violations by severity for the summary strip
  const critCount  = result.violations?.filter(v => v.severity === 'critical').length ?? 0;
  const majorCount = result.violations?.filter(v => v.severity === 'major').length   ?? 0;
  const minorCount = result.violations?.filter(v => v.severity === 'minor').length   ?? 0;

  // Prepare chart data — one bar per violation, coloured by severity
  const chartData = (result.violations ?? [])
    .filter(v => (v.estimated_cost_lkr ?? v.estimated_cost_sgd ?? 0) > 0)
    .map((v, i) => ({
      name:  `V${i + 1}`,
      cost:  v.estimated_cost_lkr ?? (v.estimated_cost_sgd ?? 0) * 330, // rough LKR conversion
      color: SEVERITY_COLORS[v.severity] ?? '#888',
      label: v.severity,
    }));

  return (
    <div className="space-y-6">

      <div className="p-4 border border-amber-500/40 bg-amber-500/10 text-amber-200/90 text-xs leading-relaxed">
        <strong>Professional disclaimer:</strong> This is an AI pre-screen only — not a substitute for
        licensed architect or UDA certification. Verify all results with a qualified professional before
        statutory submission. Tokenly is not liable for approval outcomes based on this report alone.
      </div>

      {/* ── Score header ──────────────────────────────────────── */}
      <div className="flex items-center gap-6 p-6 bg-[#050505] border border-[var(--border-dark)] relative overflow-hidden">
        {/* Subtle background glow matching score colour */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ background: `radial-gradient(circle at 10% 50%, ${scoreColor}, transparent 60%)` }}
        />

        {/* Circular score ring */}
        <div className="relative w-22 h-22 flex-shrink-0" style={{ width: 88, height: 88 }}>
          <svg viewBox="0 0 88 88" className="-rotate-90 w-full h-full">
            {/* Track */}
            <circle cx="44" cy="44" r="38" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
            {/* Progress arc */}
            <circle
              cx="44" cy="44" r="38" fill="none"
              stroke={scoreColor} strokeWidth="6"
              strokeLinecap="square"
              strokeDasharray={`${(score / 100) * 238.76} 238.76`}
            />
          </svg>
          {/* Score label centred over the ring */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-mono font-bold text-white leading-none">{score}</span>
            <span className="text-[7px] font-mono text-[var(--text-muted)] uppercase tracking-widest mt-0.5">/100</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-1.5 font-bold">
            Compliance Score
          </p>
          <p className="text-white text-[11px] leading-relaxed mb-3">{result.summary}</p>

          {/* Severity breakdown chips */}
          <div className="flex gap-2 flex-wrap mb-3">
            {[
              { label: `${critCount} Critical`,  color: '#ef4444' },
              { label: `${majorCount} Major`,    color: '#f97316' },
              { label: `${minorCount} Minor`,    color: '#eab308' },
            ].map(chip => (
              <span
                key={chip.label}
                className="text-[8px] font-mono font-bold px-2.5 py-0.5 border"
                style={{ color: chip.color, borderColor: chip.color + '40', background: chip.color + '12' }}
              >
                {chip.label}
              </span>
            ))}
          </div>

          {/* Standards checked badges */}
          <div className="flex gap-2 flex-wrap">
            {result.jurisdictions_checked?.map(j => (
              <span
                key={j}
                className="text-[7px] font-mono px-2 py-0.5 bg-[var(--rolex-gold)]/10 border border-[var(--rolex-gold)]/20 text-[var(--rolex-gold)] uppercase tracking-wider"
              >
                {j}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Violations list ───────────────────────────────────── */}
      {result.violations?.length > 0 && (
        <div className="bg-[#050505] border border-[var(--border-dark)]">
          <div className="px-5 py-3 border-b border-[var(--border-dark)] bg-[#0A0A0A]">
            <p className="text-[9px] font-mono uppercase tracking-widest text-white font-bold flex items-center gap-2">
              <ShieldAlert size={12} className="text-red-400" />
              Violations ({result.violations.length})
            </p>
          </div>

          <div className="divide-y divide-[var(--border-dark)]">
            {result.violations.map(v => {
              const col  = SEVERITY_COLORS[v.severity] ?? '#888';
              const cost = v.estimated_cost_lkr
                ? `LKR ${v.estimated_cost_lkr.toLocaleString()}`
                : v.estimated_cost_sgd
                  ? `S$ ${v.estimated_cost_sgd.toLocaleString()}`
                  : null;

              return (
                <div key={v.id} className="p-4 flex items-start gap-4 hover:bg-white/[0.015] transition-colors">
                  {/* Severity icon */}
                  <AlertTriangle
                    size={14}
                    style={{ color: col, flexShrink: 0, marginTop: 2 }}
                  />

                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {/* Severity badge */}
                      <span
                        className="text-[8px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 border flex-shrink-0"
                        style={{ color: col, borderColor: col + '40', background: col + '12' }}
                      >
                        {v.severity}
                      </span>
                      {/* Jurisdiction + clause */}
                      <span className="text-[8px] font-mono text-[var(--text-muted)]">
                        {v.jurisdiction} · {v.clause}
                      </span>
                      {/* Confidence */}
                      <span className="ml-auto text-[7px] font-mono text-[var(--text-muted)] flex-shrink-0">
                        {v.confidence_score}% confidence
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-[11px] text-white/75 leading-relaxed mb-1">{v.description}</p>

                    {/* Cost + fix type */}
                    <div className="flex gap-4 flex-wrap mt-1">
                      {cost && (
                        <p className="text-[8px] font-mono text-[var(--text-muted)]">
                          Est. remediation: <span className="text-white">{cost}</span>
                        </p>
                      )}
                      {v.fix_type && (
                        <p className="text-[8px] font-mono text-[var(--rolex-gold)]/75">
                          Fix: {v.fix_type}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Remediation cost chart ─────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="bg-[#050505] border border-[var(--border-dark)] p-5">
          <p className="text-[8px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-4 font-bold">
            Estimated Remediation Cost by Violation (LKR)
          </p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -18, bottom: 0 }}>
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'Courier New, monospace' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'Courier New, monospace' }}
                axisLine={false} tickLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip
                contentStyle={{
                  background: '#0A0A0A',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: 10,
                  fontFamily: 'Courier New, monospace',
                  color: '#fff',
                }}
                formatter={(value: any, _name: any, item: any) => [
                  `LKR ${Number(value).toLocaleString()}`,
                  item?.payload?.label ?? '',
                ]}
              />
              <Bar dataKey="cost" radius={[2, 2, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[7px] font-mono text-[var(--text-muted)] mt-2">
            * Cost estimates are indicative and based on standard Sri Lankan construction rates.
          </p>
        </div>
      )}

      {/* Empty state when no violations */}
      {result.violations?.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <ShieldCheck size={40} className="text-green-400 opacity-60" />
          <div>
            <p className="text-[9px] font-mono uppercase tracking-widest text-green-400 mb-1.5 font-bold">
              No Violations Found
            </p>
            <p className="text-[10px] text-white/40 max-w-sm">
              The floor plan fully complies with all checked standards: {result.jurisdictions_checked?.join(', ')}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Shared UI primitives — used by ALL four panels ────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A full-panel spinner with a descriptive loading message.
 * The dual-ring animation gives it visual depth consistent with the luxury aesthetic.
 */
export function PanelLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      {/* Outer ring spins clockwise, inner spins counter-clockwise */}
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 border-4 border-t-[var(--rolex-gold)] border-[var(--border-dark)] rounded-full animate-spin" />
        <div className="absolute inset-2 border-4 border-b-[#3b82f6] border-transparent rounded-full animate-[spin_1.5s_reverse_infinite]" />
        {/* Centre dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="w-2 h-2 bg-[var(--rolex-gold)] rounded-full animate-pulse" />
        </div>
      </div>
      <p className="text-[var(--rolex-gold)] font-mono text-[10px] tracking-[0.22em] animate-pulse uppercase text-center max-w-xs">
        {label}
      </p>
    </div>
  );
}

/**
 * A placeholder shown when a panel has no data yet.
 * Gives users a clear description of what will appear once they take action.
 */
export function PanelEmpty({
  label, description,
}: {
  label: string; description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <ShieldCheck size={42} className="text-[var(--rolex-gold)] opacity-18" />
      <div>
        <p className="text-[8px] font-mono tracking-[0.3em] uppercase text-[var(--text-muted)] mb-2 font-bold">
          {label}
        </p>
        <p className="text-[10px] text-white/35 max-w-md leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

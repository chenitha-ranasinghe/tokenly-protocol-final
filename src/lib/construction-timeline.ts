/**
 * Construction timeline engine — range-based estimates with explicit buffers (Sri Lanka).
 */
import type { ConstructionTimeline, ConstructionTimelinePhase } from './types';

const DEFAULT_PHASES = [
  { name: 'Foundation', base: 6, weather: 0.15, material: 0.05, labour: 0.08, inspection: 0, milestone_pct: 20 },
  { name: 'Structure', base: 10, weather: 0.1, material: 0.1, labour: 0.1, inspection: 1, milestone_pct: 20 },
  { name: 'Roof & envelope', base: 5, weather: 0.12, material: 0.08, labour: 0.08, inspection: 0, milestone_pct: 20 },
  { name: 'Finishing', base: 8, weather: 0.08, material: 0.05, labour: 0.12, inspection: 0, milestone_pct: 20 },
  { name: 'UDA completion & handover', base: 3, weather: 0, material: 0, labour: 0.05, inspection: 3, milestone_pct: 20 },
];

function isWetSeasonMonth(month: number): boolean {
  return month >= 4 && month <= 9;
}

export function computeConstructionTimeline(opts?: {
  floorAreaSqm?: number;
  district?: string;
  complexity?: 'low' | 'medium' | 'high';
  startMonth?: number;
}): ConstructionTimeline {
  const area = opts?.floorAreaSqm ?? 150;
  const complexity = opts?.complexity ?? 'medium';
  const month = opts?.startMonth ?? new Date().getMonth() + 1;
  const wetBoost = isWetSeasonMonth(month) ? 0.05 : 0;
  const areaFactor = area > 250 ? 1.15 : area > 180 ? 1.08 : 1;
  const complexityFactor = complexity === 'high' ? 1.2 : complexity === 'low' ? 0.92 : 1;

  const phases: ConstructionTimelinePhase[] = DEFAULT_PHASES.map((p) => {
    const weather = p.weather + wetBoost;
    const mult = 1 + weather + p.material + p.labour;
    const base = Math.ceil(p.base * areaFactor * complexityFactor);
    const total = Math.ceil(base * mult) + p.inspection;
    return {
      name: p.name,
      base_weeks: base,
      total_weeks: total,
      milestone_pct: p.milestone_pct,
      buffers: {
        weather_risk: weather,
        material_lead: p.material,
        labour_availability: p.labour,
        inspection_queue: p.inspection,
      },
    };
  });

  const likely = phases.reduce((s, p) => s + p.total_weeks, 0);
  const earliest = Math.ceil(likely * 0.88);
  const latest = Math.ceil(likely * 1.22);
  const confidence = Math.min(92, Math.max(55, 82 - (complexity === 'high' ? 12 : 0) - (wetBoost > 0 ? 8 : 0)));

  return {
    phases,
    earliest_weeks: earliest,
    likely_weeks: likely,
    latest_weeks: latest,
    confidence,
  };
}

export function defaultMilestoneSchedule(): { name: string; pct_value: number; sort_order: number }[] {
  return DEFAULT_PHASES.map((p, i) => ({
    name: p.name,
    pct_value: p.milestone_pct,
    sort_order: i,
  }));
}

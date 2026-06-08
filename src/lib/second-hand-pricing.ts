/**
 * Second-hand token pricing — condition, usability, location, market signals.
 */
import type { SecondHandGrade, SecondHandPriceQuote } from './types';

const DISTRICT_LOGISTICS_LKR: Record<string, number> = {
  Colombo: 500,
  Gampaha: 800,
  Kandy: 3500,
  Galle: 4000,
  Jaffna: 6000,
  default: 4500,
};

const CATEGORY_BASE: Record<string, number> = {
  Sneakers: 45000,
  Watches: 120000,
  Electronics: 35000,
  Handbags: 55000,
  default: 25000,
};

const GRADE_MULT: Record<SecondHandGrade, number> = {
  DS: 1.0,
  VNDS: 0.92,
  'Used-A': 0.78,
  'Used-B': 0.58,
  'Used-C': 0.38,
};

const USAGE_DECAY: Record<string, number> = {
  daily: 0.82,
  weekly: 0.9,
  occasional: 0.95,
  stored: 0.98,
};

export function estimateSecondHandPrice(params: {
  category: string;
  condition_grade: SecondHandGrade;
  condition_score?: number;
  usability_pct?: number;
  days_owned?: number;
  usage_frequency?: string;
  item_district: string;
  buyer_district?: string;
  retail_hint?: number;
}): SecondHandPriceQuote {
  const base = params.retail_hint ?? CATEGORY_BASE[params.category] ?? CATEGORY_BASE.default;
  const gradeMult = GRADE_MULT[params.condition_grade] ?? 0.7;
  const condScore = (params.condition_score ?? 75) / 100;
  const usability = (params.usability_pct ?? 70) / 100;
  const usageMult = USAGE_DECAY[params.usage_frequency ?? 'occasional'] ?? 0.9;
  const agePenalty = Math.min(0.25, (params.days_owned ?? 0) / 365 * 0.12);

  let recommended = base * gradeMult * (0.5 + 0.3 * condScore + 0.2 * usability) * usageMult * (1 - agePenalty);

  const buyer = params.buyer_district ?? params.item_district;
  const logistics =
    buyer === params.item_district
      ? 0
      : (DISTRICT_LOGISTICS_LKR[buyer] ?? DISTRICT_LOGISTICS_LKR.default) -
        (DISTRICT_LOGISTICS_LKR[params.item_district] ?? DISTRICT_LOGISTICS_LKR.default) * 0.3;

  const logisticsAdj = Math.max(0, Math.round(logistics));
  recommended = Math.round(recommended);

  const floor = Math.round(recommended * 0.88);
  const ceiling = Math.round(recommended * 1.12) + logisticsAdj;
  const confidence = Math.min(90, 55 + condScore * 25 + (params.condition_grade === 'Used-C' ? -5 : 10));

  return {
    floor,
    recommended: recommended + logisticsAdj,
    ceiling,
    confidence: Math.round(confidence),
    breakdown: `Condition ${Math.round(condScore * 100)}% · Usability ${Math.round(usability * 100)}% · Grade ${params.condition_grade}`,
    logistics_adjustment: logisticsAdj,
  };
}

/** Conservative grade from vision confidence — under-grade when uncertain. */
export function gradeFromVisionScore(score: number, confidence: number): SecondHandGrade {
  const adj = confidence < 0.75 ? score - 12 : score;
  if (adj >= 92) return 'DS';
  if (adj >= 85) return 'VNDS';
  if (adj >= 72) return 'Used-A';
  if (adj >= 55) return 'Used-B';
  return 'Used-C';
}

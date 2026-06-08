/**
 * Construction Reliability Score (CRS) — 0–100 composite for contractor reputation.
 */
export interface CRSInputs {
  on_time_rate: number;
  cost_accuracy: number;
  milestone_adherence: number;
  client_rating: number;
  bond_return_rate: number;
}

export function computeCRS(input: CRSInputs): number {
  const onTime = clamp(input.on_time_rate, 0, 100);
  const costAcc = clamp(100 - Math.abs(input.cost_accuracy), 0, 100);
  const milestone = clamp(input.milestone_adherence, 0, 100);
  const client = clamp(input.client_rating, 0, 100);
  const bond = clamp(input.bond_return_rate, 0, 100);

  const score =
    onTime * 0.3 +
    costAcc * 0.25 +
    milestone * 0.2 +
    client * 0.15 +
    bond * 0.1;

  return Math.round(clamp(score, 0, 100) * 10) / 10;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function crsTierLabel(score: number): string {
  if (score >= 85) return 'Elite';
  if (score >= 70) return 'Trusted';
  if (score >= 55) return 'Standard';
  return 'Developing';
}

import { NextRequest, NextResponse } from 'next/server';
import { jsonError } from '@/lib/api-response';
import { estimateSecondHandPrice, gradeFromVisionScore } from '@/lib/second-hand-pricing';
import type { SecondHandGrade } from '@/lib/types';

/** Public price check — no auth required (acquisition funnel). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const category = String(body.category ?? 'Electronics');
    const itemDistrict = String(body.item_district ?? 'Colombo');
    const buyerDistrict = body.buyer_district ? String(body.buyer_district) : itemDistrict;
    const visionScore = Number(body.condition_score ?? 72);
    const visionConf = Number(body.vision_confidence ?? 0.75);
    const grade = (body.condition_grade as SecondHandGrade) ?? gradeFromVisionScore(visionScore, visionConf);

    const quote = estimateSecondHandPrice({
      category,
      condition_grade: grade,
      condition_score: visionScore,
      usability_pct: Number(body.usability_pct ?? 70),
      days_owned: Number(body.days_owned ?? 180),
      usage_frequency: String(body.usage_frequency ?? 'occasional'),
      item_district: itemDistrict,
      buyer_district: buyerDistrict,
      retail_hint: body.retail_hint ? Number(body.retail_hint) : undefined,
    });

    return NextResponse.json({
      condition_grade: grade,
      ...quote,
      disclaimer:
        'AI estimate only. Final grade may change after CAN review. Conservative grading applied when confidence is low.',
    });
  } catch (e) {
    console.error('resale estimate', e);
    return jsonError('Estimate failed', 500, 'INTERNAL');
  }
}

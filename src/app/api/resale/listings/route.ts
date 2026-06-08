import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import { jsonError } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';
import { estimateSecondHandPrice, gradeFromVisionScore } from '@/lib/second-hand-pricing';
import type { SecondHandGrade, SecondHandListing } from '@/lib/types';

type ListingRow = SecondHandListing & { base_price_lkr: number };

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const district = request.nextUrl.searchParams.get('district');
    const buyerDistrict = request.nextUrl.searchParams.get('buyer_district');

    let rows = (await db
      .prepare(
        `SELECT * FROM second_hand_listings WHERE status = 'active' ORDER BY created_at DESC LIMIT 50`
      )
      .all()) as ListingRow[];

    if (district) {
      rows = rows.filter((r) => r.item_district === district);
    }

    if (buyerDistrict) {
      rows = rows.map((row) => {
        const quote = estimateSecondHandPrice({
          category: String(row.category),
          condition_grade: row.condition_grade as SecondHandGrade,
          condition_score: Number(row.condition_score),
          usability_pct: Number(row.usability_pct),
          days_owned: Number(row.days_owned),
          usage_frequency: String(row.usage_frequency),
          item_district: String(row.item_district),
          buyer_district: buyerDistrict,
          retail_hint: Number(row.base_price_lkr),
        });
        return { ...row, display_price_lkr: quote.recommended, price_quote: quote };
      });
    }

    return NextResponse.json({ listings: rows });
  } catch (e) {
    console.error('resale listings GET', e);
    return jsonError('Failed to load listings', 500, 'INTERNAL');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');

    const body = await request.json();
    const title = String(body.title ?? '').trim();
    const category = String(body.category ?? 'Electronics').trim();
    const itemDistrict = String(body.item_district ?? 'Colombo').trim();

    if (!title) return jsonError('title required', 400, 'VALIDATION_ERROR');

    const visionScore = Number(body.condition_score ?? 70);
    const visionConf = Number(body.vision_confidence ?? 0.8);
    const grade = (body.condition_grade as SecondHandGrade) ?? gradeFromVisionScore(visionScore, visionConf);

    const quote = estimateSecondHandPrice({
      category,
      condition_grade: grade,
      condition_score: visionScore,
      usability_pct: Number(body.usability_pct ?? 75),
      days_owned: Number(body.days_owned ?? 0),
      usage_frequency: String(body.usage_frequency ?? 'occasional'),
      item_district: itemDistrict,
      retail_hint: body.retail_hint ? Number(body.retail_hint) : undefined,
    });

    const id = uuidv4();
    const db = await getDb();
    await db
      .prepare(
        `INSERT INTO second_hand_listings (
          id, seller_id, title, category, condition_grade, condition_score,
          usability_pct, days_owned, usage_frequency, base_price_lkr,
          item_district, photos_json, condition_report_json, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
      )
      .run(
        id,
        user.id,
        title,
        category,
        grade,
        visionScore,
        body.usability_pct ?? 75,
        body.days_owned ?? 0,
        body.usage_frequency ?? 'occasional',
        quote.recommended,
        itemDistrict,
        JSON.stringify(body.photos ?? []),
        JSON.stringify({ grade, quote, vision_confidence: visionConf })
      );

    await writeAuditLog('resale_listing_created', user.id, {
      targetId: id,
      targetType: 'second_hand_listing',
      details: { grade, price: quote.recommended },
    });

    return NextResponse.json({ listing: { id, ...quote, condition_grade: grade } }, { status: 201 });
  } catch (e) {
    console.error('resale listings POST', e);
    return jsonError('Failed to create listing', 500, 'INTERNAL');
  }
}

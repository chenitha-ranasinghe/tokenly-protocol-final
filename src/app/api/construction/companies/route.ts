import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import { jsonError } from '@/lib/api-response';
import { computeCRS } from '@/lib/crs';

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const user = await authenticateRequest(request);
    if (request.nextUrl.searchParams.get('mine') === '1') {
      if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');
      const company = await db
        .prepare('SELECT * FROM construction_companies WHERE user_id = ?')
        .get(user.id);
      return NextResponse.json({ company: company ?? null });
    }
    const district = request.nextUrl.searchParams.get('district');
    let rows;
    if (district) {
      rows = await db
        .prepare(
          'SELECT * FROM construction_companies WHERE district = ? ORDER BY crs_score DESC LIMIT 30'
        )
        .all(district);
    } else {
      rows = await db
        .prepare('SELECT * FROM construction_companies ORDER BY crs_score DESC LIMIT 50')
        .all();
    }
    return NextResponse.json({ companies: rows });
  } catch (e) {
    console.error('construction companies GET', e);
    return jsonError('Failed to load companies', 500, 'INTERNAL');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');

    const body = await request.json();
    const companyName = String(body.company_name ?? '').trim();
    const district = String(body.district ?? 'Colombo').trim();
    if (!companyName) return jsonError('company_name required', 400, 'VALIDATION_ERROR');

    const db = await getDb();
    const existing = await db
      .prepare('SELECT id FROM construction_companies WHERE user_id = ?')
      .get(user.id);
    if (existing) return jsonError('Company profile already exists', 400, 'VALIDATION_ERROR');

    const crs = computeCRS({
      on_time_rate: 50,
      cost_accuracy: 10,
      milestone_adherence: 50,
      client_rating: 50,
      bond_return_rate: 100,
    });

    const id = uuidv4();
    const specs = JSON.stringify(body.specializations ?? ['residential']);
    await db
      .prepare(
        `INSERT INTO construction_companies (
          id, user_id, company_name, district, specializations, crs_score
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, user.id, companyName, district, specs, crs);

    const company = await db.prepare('SELECT * FROM construction_companies WHERE id = ?').get(id);
    return NextResponse.json({ company }, { status: 201 });
  } catch (e) {
    console.error('construction companies POST', e);
    return jsonError('Failed to register company', 500, 'INTERNAL');
  }
}

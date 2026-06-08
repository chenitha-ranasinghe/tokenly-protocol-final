import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import { jsonError } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';
import { canOpenPublicBidding } from '@/lib/legal-gate';
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    const db = await getDb();
    const mine = request.nextUrl.searchParams.get('mine') === '1';
    const marketplace = request.nextUrl.searchParams.get('marketplace') === '1';

    if (marketplace) {
      const rows = await db
        .prepare(
          `SELECT p.*, COUNT(b.id) as bid_count
           FROM construction_projects p
           LEFT JOIN construction_bids b ON b.project_id = p.id
           WHERE p.legal_status = 'approved' AND p.status IN ('approved', 'bidding')
           GROUP BY p.id
           ORDER BY p.updated_at DESC
           LIMIT 50`
        )
        .all();
      return NextResponse.json({ projects: rows });
    }

    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');
    const rows = mine
      ? await db
          .prepare(
            `SELECT p.*, COUNT(b.id) as bid_count FROM construction_projects p
             LEFT JOIN construction_bids b ON b.project_id = p.id
             WHERE p.owner_id = ? GROUP BY p.id ORDER BY p.updated_at DESC`
          )
          .all(user.id)
      : await db
          .prepare(
            `SELECT p.*, COUNT(b.id) as bid_count FROM construction_projects p
             LEFT JOIN construction_bids b ON b.project_id = p.id
             WHERE p.status != 'draft' GROUP BY p.id ORDER BY p.updated_at DESC LIMIT 30`
          )
          .all();

    return NextResponse.json({ projects: rows });
  } catch (e) {
    console.error('construction projects GET', e);
    return jsonError('Failed to load projects', 500, 'INTERNAL');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return jsonError('Unauthorized', 401, 'UNAUTHORIZED');

    const body = await request.json();
    const title = String(body.title ?? '').trim();
    const district = String(body.district ?? 'Colombo').trim();
    if (!title) return jsonError('Title required', 400, 'VALIDATION_ERROR');

    const id = uuidv4();
    const db = await getDb();
    await db
      .prepare(
        `INSERT INTO construction_projects (
          id, owner_id, title, land_deed_ref, district, brief,
          floor_plan_json, compliance_report_json,
          estimated_land_value, estimated_finished_value, estimated_build_cost,
          status, legal_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'none')`
      )
      .run(
        id,
        user.id,
        title,
        body.land_deed_ref ?? null,
        district,
        body.brief ?? null,
        body.floor_plan_json ? JSON.stringify(body.floor_plan_json) : null,
        body.compliance_report_json ? JSON.stringify(body.compliance_report_json) : null,
        body.estimated_land_value ?? null,
        body.estimated_finished_value ?? null,
        body.estimated_build_cost ?? null
      );

    await writeAuditLog('construction_project_created', user.id, {
      targetId: id,
      targetType: 'construction_project',
      details: { title },
    });

    const project = await db.prepare('SELECT * FROM construction_projects WHERE id = ?').get(id);
    return NextResponse.json({ project }, { status: 201 });
  } catch (e) {
    console.error('construction projects POST', e);
    return jsonError('Failed to create project', 500, 'INTERNAL');
  }
}

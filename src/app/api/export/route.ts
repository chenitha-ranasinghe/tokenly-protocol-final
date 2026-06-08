import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 });
    const db = await getDb();
    const rows = await db.prepare(`SELECT r.id as review_id,u.name as reviewer,u.experiment_group,p.name as product,p.brand,p.sku,p.consensus_price,p.initial_consensus,r.condition_grade,r.price_estimate,r.points_staked,r.is_accurate,r.accuracy_score,r.reward_amount,r.created_at,u.rrs_score FROM reviews r JOIN users u ON r.user_id=u.id JOIN products p ON r.product_id=p.id ORDER BY r.created_at DESC`).all() as Record<string,unknown>[];
    if (rows.length===0) return new NextResponse('No data yet',{status:200,headers:{'Content-Type':'text/plain'}});
    const hdrs = Object.keys(rows[0]);
    const csv = [hdrs.join(','), ...rows.map(row=>hdrs.map(h=>{const v=row[h];if(typeof v==='string'&&(v.includes(',')||v.includes('"')))return `"${String(v).replace(/"/g,'""')}"`;return v??'';}).join(','))].join('\n');
    return new NextResponse(csv,{status:200,headers:{'Content-Type':'text/csv','Content-Disposition':`attachment; filename="tokenly-${new Date().toISOString().split('T')[0]}.csv"`}});
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

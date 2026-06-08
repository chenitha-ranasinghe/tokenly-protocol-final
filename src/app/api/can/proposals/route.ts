import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const proposals = await db.prepare(`
      SELECT p.*, u.name as creator_name 
      FROM proposals p
      JOIN users u ON p.creator_id = u.id
      ORDER BY p.created_at DESC
    `).all();

    return NextResponse.json({ success: true, proposals });
  } catch (error) {
    console.error('Proposals GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { title, description } = await request.json();
    if (!title || !description) return NextResponse.json({ error: 'Title and description required' }, { status: 400 });

    const db = await getDb();
    const proposalId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days from now

    await db.prepare(`
      INSERT INTO proposals (id, creator_id, title, description, status, votes_for, votes_against, expires_at)
      VALUES (?, ?, ?, ?, 'active', 0, 0, ?)
    `).run(proposalId, user.id, title, description, expiresAt);

    return NextResponse.json({ success: true, proposalId });
  } catch (error) {
    console.error('Proposals POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

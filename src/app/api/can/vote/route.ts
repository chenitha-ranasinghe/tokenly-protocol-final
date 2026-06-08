import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { authenticateRequest } from '@/lib/session';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { proposalId, voteType } = await request.json();
    if (!proposalId || !['for', 'against'].includes(voteType)) {
      return NextResponse.json({ error: 'Invalid vote parameters' }, { status: 400 });
    }

    const db = await getDb();
    
    // Check if proposal exists and is active
    const proposal = await db.prepare('SELECT * FROM proposals WHERE id = ?').get(proposalId) as Record<string, unknown> | undefined;
    if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    if (proposal.status !== 'active') return NextResponse.json({ error: 'Proposal is no longer active' }, { status: 400 });
    const exp = proposal.expires_at;
    const expDate = exp instanceof Date ? exp : new Date(typeof exp === 'string' || typeof exp === 'number' ? exp : 0);
    if (expDate < new Date()) {
      await db.prepare("UPDATE proposals SET status = 'expired' WHERE id = ?").run(proposalId);
      return NextResponse.json({ error: 'Proposal has expired' }, { status: 400 });
    }

    // Weight is the user's RRS score (Min 0.1 for accountability)
    const weight = Math.max(0.1, user.rrs_score || 0);

    try {
      await db.transaction(async (txDb) => {
        // Record the vote (Unique constraint handles double voting)
        await txDb.prepare(`
          INSERT INTO proposal_votes (id, proposal_id, user_id, vote_type, weight)
          VALUES (?, ?, ?, ?, ?)
        `).run(crypto.randomUUID(), proposalId, user.id, voteType, weight);

        // Update proposal totals
        if (voteType === 'for') {
          await txDb.prepare('UPDATE proposals SET votes_for = votes_for + ? WHERE id = ?').run(weight, proposalId);
        } else {
          await txDb.prepare('UPDATE proposals SET votes_against = votes_against + ? WHERE id = ?').run(weight, proposalId);
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE')) return NextResponse.json({ error: 'You have already voted on this proposal.' }, { status: 400 });
      throw err;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Voting Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

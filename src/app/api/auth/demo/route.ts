import { NextResponse } from 'next/server';
import { DEV_BYPASS_ENABLED } from '@/lib/env';

// SECURITY: This route is invisible in production.
// Only active when NODE_ENV=development AND ENABLE_DEV_BYPASS=true.
export async function POST() {
  if (!DEV_BYPASS_ENABLED) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const { getDb, generateSessionToken } = await import('@/lib/db');
    const { v4: uuidv4 } = await import('uuid');
    const db = await getDb();
    const adminEmail = 'admin@tokenly.luxury';
    let user = await db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail) as Record<string, unknown> | undefined;
    if (!user) {
      const id = uuidv4();
      await db.prepare(`INSERT INTO users (id, email, name, points, experiment_group, rrs_score, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(id, adminEmail, 'Dev Admin', 1_000_000, 'staking', 100.0, 1);
      user = await db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;
    }
    const sessionToken = generateSessionToken();
    const ts = process.env.DATABASE_URL ? 'CURRENT_TIMESTAMP' : "datetime('now')";
    await db.prepare(`UPDATE users SET session_token = ?, last_active_at = ${ts} WHERE email = ?`).run(sessionToken, adminEmail);
    const res = NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name, points: user.points, experiment_group: user.experiment_group, rrs_score: user.rrs_score, is_admin: 1 } });
    res.cookies.set('tokenly_session', sessionToken, { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 86400 });
    return res;
  } catch (error) {
    console.error('[DevBypass]', error);
    return NextResponse.json({ error: 'Dev auth failed' }, { status: 500 });
  }
}

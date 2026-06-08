/**
 * POST /api/auth/forgot-password
 *
 * Accepts an email address. If a matching account exists, generates a
 * cryptographically secure single-use password-reset token, stores its
 * SHA-256 hash in the DB (plaintext never stored), and emails the user
 * a link valid for 15 minutes.
 *
 * Always returns 200 regardless of whether the email exists — this prevents
 * user-enumeration attacks (an attacker cannot tell which emails are registered).
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb, checkRateLimit } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';

const RESET_TTL_MINUTES = 15;
// Generic response — always identical whether email exists or not
const ALWAYS_OK = NextResponse.json(
  { message: 'If that email is registered, a reset link has been sent.' },
  { status: 200 }
);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ── Rate limit: max 5 attempts per IP per 15 min ──────────────────────────
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    const allowed = await checkRateLimit(`forgot-pw:${ip}`, 5, 900);
    if (!allowed) {
      // Return generic 200 — still don't leak info, but slow down attackers
      return ALWAYS_OK;
    }

    // ── Parse + validate body ─────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return ALWAYS_OK; // malformed body → silently succeed
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !email.includes('@')) return ALWAYS_OK;

    // ── Look up user ──────────────────────────────────────────────────────────
    const db = await getDb();
    const user = await db
      .prepare('SELECT id, name, email, is_banned FROM users WHERE email = ?')
      .get(email) as { id: string; name: string; email: string; is_banned: number } | undefined;

    // No user or banned → return generic success (no leak)
    if (!user || user.is_banned) return ALWAYS_OK;

    // ── Invalidate any existing unused tokens for this user ───────────────────
    await db
      .prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL")
      .run(user.id);

    // ── Generate token ────────────────────────────────────────────────────────
    // 32 random bytes → 64 hex chars. The plaintext goes in the email; only
    // the SHA-256 hash is stored in the database.
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000).toISOString();

    await db
      .prepare(
        'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)'
      )
      .run(uuidv4(), user.id, tokenHash, expiresAt);

    // ── Send email (fire-and-forget — don't block the response) ──────────────
    sendPasswordResetEmail({
      email:           user.email,
      name:            user.name,
      resetToken:      rawToken,
      expiresInMinutes: RESET_TTL_MINUTES,
    }).catch(err => console.error('[FORGOT_PW] Email send failed:', err));

    return ALWAYS_OK;
  } catch (err) {
    console.error('[FORGOT_PW] Unhandled error:', err);
    // Even on internal errors return 200 — no information leakage
    return ALWAYS_OK;
  }
}

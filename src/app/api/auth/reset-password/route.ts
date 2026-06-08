/**
 * POST /api/auth/reset-password
 *
 * Validates a password-reset token (from the email link), hashes the new
 * password, updates the user record, invalidates the token, and rotates
 * the session cookie so the user is immediately logged in.
 *
 * Security properties:
 *  - Token is looked up by its SHA-256 hash (plaintext never stored)
 *  - Token has a 15-minute TTL enforced in the DB
 *  - Token is single-use (used_at is set immediately on consumption)
 *  - All operations run inside a transaction — partial writes are impossible
 *  - Old session is invalidated (rotated to new token) on success
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb, generateSessionToken, checkRateLimit } from '@/lib/db';
import { jsonError } from '@/lib/api-response';

const SAFE_FIELDS =
  'id, email, name, wallet_address, points, experiment_group, total_reviews, accurate_reviews, rrs_score, created_at, is_admin, is_id_verified';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ── Rate limit: 10 attempts per IP per 15 min ─────────────────────────────
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (!(await checkRateLimit(`reset-pw:${ip}`, 10, 900))) {
      return jsonError('Too many requests. Please wait before trying again.', 429, 'RATE_LIMITED');
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return jsonError('Invalid request body', 400, 'BAD_REQUEST');
    }

    const rawToken   = typeof body.token    === 'string' ? body.token.trim()    : '';
    const newPassword = typeof body.password === 'string' ? body.password        : '';

    if (!rawToken) {
      return jsonError('Reset token is required', 400, 'VALIDATION_ERROR');
    }
    if (newPassword.length < 8) {
      return jsonError('Password must be at least 8 characters', 400, 'VALIDATION_ERROR');
    }
    if (newPassword.length > 128) {
      return jsonError('Password too long', 400, 'VALIDATION_ERROR');
    }

    // ── Look up token by hash ─────────────────────────────────────────────────
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const db = await getDb();

    const tokenRow = await db
      .prepare(
        `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at,
                u.email, u.name, u.is_banned
         FROM password_reset_tokens prt
         JOIN users u ON u.id = prt.user_id
         WHERE prt.token_hash = ?`
      )
      .get(tokenHash) as {
        id: string;
        user_id: string;
        expires_at: string;
        used_at: string | null;
        email: string;
        name: string;
        is_banned: number;
      } | undefined;

    // ── Validate token state ──────────────────────────────────────────────────
    if (!tokenRow) {
      return jsonError('Invalid or expired reset link. Please request a new one.', 400, 'BAD_REQUEST');
    }
    if (tokenRow.used_at) {
      return jsonError('This reset link has already been used. Please request a new one.', 400, 'BAD_REQUEST');
    }
    if (tokenRow.is_banned) {
      return jsonError('Account suspended. Contact support.', 403, 'FORBIDDEN');
    }
    if (new Date(tokenRow.expires_at) < new Date()) {
      return jsonError('This reset link has expired. Please request a new one.', 400, 'BAD_REQUEST');
    }

    // ── Hash new password + rotate session ───────────────────────────────────
    const [passwordHash, newSession] = await Promise.all([
      bcrypt.hash(newPassword, 12),
      Promise.resolve(generateSessionToken()),
    ]);

    // ── Apply all changes atomically ──────────────────────────────────────────
    await db.transaction(async (txDb) => {
      // 1. Mark token as used (single-use enforcement)
      await txDb
        .prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?")
        .run(tokenRow.id);

      // 2. Update password and rotate session
      await txDb
        .prepare(
          "UPDATE users SET password_hash = ?, session_token = ?, last_active_at = datetime('now') WHERE id = ?"
        )
        .run(passwordHash, newSession, tokenRow.user_id);

      // 3. Invalidate ALL other existing reset tokens for this user (safety)
      await txDb
        .prepare(
          "UPDATE password_reset_tokens SET used_at = datetime('now') WHERE user_id = ? AND id != ? AND used_at IS NULL"
        )
        .run(tokenRow.user_id, tokenRow.id);
    });

    // ── Return fresh user + set new session cookie ────────────────────────────
    const user = await db
      .prepare(`SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`)
      .get(tokenRow.user_id);

    const res = NextResponse.json({
      success: true,
      message: 'Password updated successfully. You are now signed in.',
      user,
    });

    res.cookies.set('tokenly_session', newSession, {
      httpOnly:  true,
      secure:    process.env.NODE_ENV === 'production',
      sameSite:  'lax',
      path:      '/',
      maxAge:    60 * 60 * 24 * 7, // 7 days
    });

    console.info(`[RESET_PW] Password reset successful for user ${tokenRow.user_id}`);
    return res;
  } catch (err) {
    console.error('[RESET_PW] Unhandled error:', err);
    return jsonError('An unexpected error occurred. Please try again.', 500, 'INTERNAL');
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getDb, generateSessionToken, checkRateLimit, logEvent } from '@/lib/db';
import { getEncryptionKey } from '@/lib/env';
import { authEmailPasswordSchema } from '@/lib/validation/schemas';
import { v4 as uuidv4 } from 'uuid';
import { Wallet } from 'ethers';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

function encryptKey(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

const SAFE_FIELDS = 'id, email, name, wallet_address, points, experiment_group, total_reviews, accurate_reviews, rrs_score, created_at, is_admin, is_id_verified';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!await checkRateLimit(`auth:${ip}`, 10, 60)) {
      return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 });
    }
    const parsed = authEmailPasswordSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid credentials payload', issues: parsed.error.flatten() }, { status: 400 });
    }
    const { email, password, name } = parsed.data;
    const cleanEmail = email.trim().toLowerCase();

    const db = await getDb();
    const existing = await db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as Record<string, unknown> | undefined;

    if (existing) {
      if (existing.is_banned) return NextResponse.json({ error: 'Account suspended. Contact support.' }, { status: 403 });
      if (existing.password_hash) {
        const valid = await bcrypt.compare(password, existing.password_hash as string);
        if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      } else {
        const hash = await bcrypt.hash(password, 12);
        await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, existing.id as string);
      }
      const sessionToken = generateSessionToken();
      const ts = process.env.DATABASE_URL ? 'CURRENT_TIMESTAMP' : "datetime('now')";
      await db.prepare(`UPDATE users SET session_token = ?, last_active_at = ${ts} WHERE id = ?`).run(sessionToken, existing.id as string);
      await logEvent(existing.id as string, 'login', { returning: true });
      const user = await db.prepare(`SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`).get(existing.id as string);
      const res = NextResponse.json({ user });
      res.cookies.set('tokenly_session', sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
      return res;
    }

    const id = uuidv4();
    const displayName = (name || '').trim() || cleanEmail.split('@')[0];
    const sessionToken = generateSessionToken();
    const experimentGroup = Math.random() < 0.5 ? 'staking' : 'control';
    const randomWallet = Wallet.createRandom();
    const walletAddress = randomWallet.address;
    const privateKey = encryptKey(randomWallet.privateKey);
    const passwordHash = await bcrypt.hash(password, 12);

    await db.prepare(`INSERT INTO users (id, email, password_hash, name, session_token, wallet_address, private_key, points, experiment_group) VALUES (?, ?, ?, ?, ?, ?, ?, 10000, ?)`)
      .run(id, cleanEmail, passwordHash, displayName, sessionToken, walletAddress, privateKey, experimentGroup);
    await db.prepare(`INSERT INTO point_transactions (id, user_id, amount, type, description) VALUES (?, ?, 10000, ?, ?)`)
      .run(uuidv4(), id, 'signup_bonus', 'Welcome bonus — 10,000 PTS to start reviewing & trading');
    await logEvent(id, 'signup', { experimentGroup, displayName });

    // Send welcome email asynchronously — never block the auth response for email delivery
    const _walletForEmail = walletAddress;
    const _emailForWelcome = cleanEmail;
    const _nameForWelcome = displayName;
    const _groupForWelcome = experimentGroup as 'staking' | 'control';
    import('@/lib/email').then(({ sendWelcomeEmail }) => {
      sendWelcomeEmail({
        email:           _emailForWelcome,
        name:            _nameForWelcome,
        walletAddress:   _walletForEmail,
        points:          10000,
        experimentGroup: _groupForWelcome,
      }).catch(err => console.error('[WELCOME_EMAIL] Failed:', err));
    }).catch(err => console.error('[WELCOME_EMAIL] Module import failed:', err));

    const user = await db.prepare(`SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`).get(id);
    const res = NextResponse.json({ user });
    res.cookies.set('tokenly_session', sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
    return res;
  } catch (error) {
    console.error('[Auth] POST error:', error);
    return NextResponse.json({ error: 'Authentication failed. Please try again.' }, { status: 500 });
  }
}

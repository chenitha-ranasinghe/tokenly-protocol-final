import { NextRequest } from 'next/server';
import { getUserBySession, getUserByPrivyId } from './db';
import type { User } from './types';

export function extractSession(request: NextRequest | Request): string | null {
  // Safely extract using Next.js native cookies API when available
  if ('cookies' in request && typeof (request as any).cookies.get === 'function') {
    const sessionCookie = (request as any).cookies.get('tokenly_session');
    if (sessionCookie) return sessionCookie.value;
  }
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)tokenly_session=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function authenticateRequest(request: NextRequest | Request): Promise<User | null> {
  const token = extractSession(request);
  const user = await getUserBySession(token);
  if (user) return user as User;

  const privyId = (request as NextRequest).headers?.get('x-privy-id');
  if (privyId) return await getUserByPrivyId(privyId) as User | null;

  return null;
}

/**
 * SECURITY FIX: Admin check now requires BOTH is_admin=1 AND an email in ADMIN_EMAILS.
 * Single email match is not sufficient — is_admin column is the authoritative gate.
 * This prevents privilege escalation if email matching were ever bypassed.
 */
export function isAdmin(user: User | Record<string, unknown> | null | undefined): boolean {
  if (!user) return false;
  const hasAdminFlag = Number(user.is_admin) === 1;
  
  const adminEmailsRaw = process.env.ADMIN_EMAILS || 'admin@tokenly.luxury';
  const adminEmails = adminEmailsRaw.split(',').map(e => e.trim().toLowerCase());
  const userEmail = (user.email as string || '').toLowerCase();
  
  const hasAdminEmail = adminEmails.includes(userEmail);
  
  // Both conditions must be true — defense in depth
  return hasAdminFlag && hasAdminEmail;
}

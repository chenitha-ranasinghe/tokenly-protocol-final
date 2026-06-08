import type { BuildResult } from '@/components/archionlabs/BuildPanel';

export interface ArchionSharePayload {
  token: string;
  passwordHash?: string;
  expiresAt: number;
  watermark: boolean;
  watermarkText: string;
  clientName: string;
  rooms: BuildResult['rooms'];
  buildingName: string;
  complianceScore?: number;
}

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** In-memory share payloads (per Node process). Use Redis/Upstash in multi-instance production. */
const store = new Map<string, ArchionSharePayload>();

function prune(): void {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expiresAt < now) store.delete(k);
  }
}

export function saveSharePayload(payload: ArchionSharePayload): void {
  prune();
  store.set(payload.token, payload);
}

export function getSharePayload(token: string): ArchionSharePayload | null {
  prune();
  const row = store.get(token);
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    store.delete(token);
    return null;
  }
  return row;
}

export function hashPortfolioPassword(password: string): string {
  if (!password) return '';
  let h = 0;
  for (let i = 0; i < password.length; i++) {
    h = (Math.imul(31, h) + password.charCodeAt(i)) | 0;
  }
  return `p${h}`;
}

export function verifySharePassword(payload: ArchionSharePayload, password: string): boolean {
  if (!payload.passwordHash) return true;
  return payload.passwordHash === hashPortfolioPassword(password);
}

export const SHARE_TTL_MS = TTL_MS;

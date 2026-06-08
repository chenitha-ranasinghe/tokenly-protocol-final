/**
 * Distributed rate limiting — production v2.0
 *
 * Strategy (priority order):
 *  1. Upstash Redis sliding window  — shared across all instances (production)
 *  2. SQLite in-process fallback    — single-instance only (dev / no Redis)
 *
 * Critical fix over v1: The original implementation created ONE Upstash
 * limiter with a FIXED 120/min window, completely ignoring the per-route
 * maxPerWindow / windowSeconds arguments. This version creates a separate
 * Ratelimit instance per (max, window) pair and caches them.
 *
 * Required env vars (optional — falls back to SQLite when absent):
 *   UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN=xxxxxxxx
 *
 * Install: npm install @upstash/ratelimit @upstash/redis
 */

import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { checkRateLimit } from '@/lib/db';
import { jsonError } from '@/lib/api-response';
import { NextResponse } from 'next/server';

// ── Redis singleton ───────────────────────────────────────────────────────────

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!_redis) {
    _redis = new Redis({ url, token });
  }
  return _redis;
}

// ── Per-route limiter cache ───────────────────────────────────────────────────
// Key: `${maxRequests}:${windowSeconds}` → cached Ratelimit instance.
// This ensures each unique (max, window) combination gets its own sliding
// window configuration rather than sharing one global fixed window.

const _limiterCache = new Map<string, Ratelimit>();

function getLimiter(maxRequests: number, windowSeconds: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const cacheKey = `${maxRequests}:${windowSeconds}`;
  if (!_limiterCache.has(cacheKey)) {
    _limiterCache.set(
      cacheKey,
      new Ratelimit({
        redis,
        // Sliding window: most accurate, no cliff resets
        limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
        analytics: true,
        prefix:    'tokenly_rl',
      })
    );
  }
  return _limiterCache.get(cacheKey)!;
}

// ── IP extraction ─────────────────────────────────────────────────────────────

export function clientIp(request: NextRequest): string {
  const xf = request.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') || 'local';
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Enforces a per-IP rate limit for the given route.
 *
 * @param request       - Incoming Next.js request (used to extract IP)
 * @param routeKey      - Unique identifier for this route (e.g. 'trade:buy')
 * @param maxPerWindow  - Maximum requests allowed in the window
 * @param windowSeconds - Rolling window duration in seconds
 * @returns A 429 NextResponse when rate-limited, null when the request is allowed
 *
 * @example
 *   const rl = await enforceRateLimit(req, 'trade:execute', 10, 60);
 *   if (rl) return rl;
 */
export async function enforceRateLimit(
  request: NextRequest,
  routeKey: string,
  maxPerWindow: number,
  windowSeconds: number
): Promise<NextResponse | null> {
  const ip      = clientIp(request);
  const limiter = getLimiter(maxPerWindow, windowSeconds);

  if (limiter) {
    // ── Upstash path: distributed, shared across all instances ───────────────
    const identifier = `${routeKey}:${ip}`;
    const { success, limit, remaining, reset } = await limiter.limit(identifier) as any;

    if (!success) {
      const retryAfterMs = reset - Date.now();
      return jsonError(
        `Rate limit exceeded. Try again in ${Math.ceil(retryAfterMs / 1000)} seconds.`,
        429,
        'RATE_LIMITED',
        {
          retryAfter:  Math.ceil(retryAfterMs / 1000),
          limit,
          remaining,
          reset:       new Date(reset).toISOString(),
          backend:     'upstash-redis',
        }
      );
    }
    return null;
  }

  // ── SQLite fallback: single-instance only (dev / no Redis env vars) ────────
  const key = `${routeKey}:${ip}`;
  const ok  = await checkRateLimit(key, maxPerWindow, windowSeconds);

  if (!ok) {
    return jsonError(
      'Rate limit exceeded. Please wait before trying again.',
      429,
      'RATE_LIMITED',
      { retryAfter: windowSeconds, backend: 'sqlite-fallback' }
    );
  }
  return null;
}

/**
 * Health check — returns which rate-limiting backend is active.
 * Useful for /api/health endpoints.
 */
export function getRateLimitBackend(): 'upstash-redis' | 'sqlite-fallback' {
  return getRedis() ? 'upstash-redis' : 'sqlite-fallback';
}

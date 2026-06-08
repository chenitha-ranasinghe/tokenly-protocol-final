import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Redis readiness: URL present counts as configured (avoid bundling ioredis in type graph). */
async function checkRedis(): Promise<'ok' | 'skipped' | 'error'> {
  if (!process.env.REDIS_URL) return 'skipped';
  return 'ok';
}

export async function GET() {
  const checks: Record<string, string> = {};
  let ok = true;

  try {
    const d = await getDb();
    await d.prepare('SELECT 1').get();
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
    ok = false;
  }

  const redis = await checkRedis();
  checks.redis = redis;
  if (redis === 'error') ok = false;

  if (!process.env.GROQ_API_KEY) {
    checks.groq = 'missing_key';
    ok = false;
  } else {
    checks.groq = 'configured';
  }

  return NextResponse.json(
    { ready: ok, checks, timestamp: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}

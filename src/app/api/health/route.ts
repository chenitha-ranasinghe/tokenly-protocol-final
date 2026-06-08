import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  let dbStatus: 'connected' | 'error' = 'connected';
  let merkleRoot = 'unverified';
  let dbLatency = 0;

  try {
    const t0 = Date.now();
    const d = await getDb();
    await d.prepare('SELECT 1').get();
    dbLatency = Date.now() - t0;
    
    // Feature 4.3: Merkle Audit Check
    const { generateGlobalMerkleRoot } = await import('@/lib/audit');
    merkleRoot = await generateGlobalMerkleRoot(50); 
  } catch (err) {
    dbStatus = 'error';
  }

  // Check Memory Cache 
  let cacheActive = false;
  try {
    const cache = (await import('@/lib/cache'));
    cacheActive = !!cache.feedCache && !!cache.productsCache;
  } catch {
    // Ignored
  }

  return NextResponse.json(
    {
      status: dbStatus === 'connected' ? 'SECURE' : 'COMPROMISED',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      diagnostics: {
        database_latency_ms: dbLatency,
        l1_memory_cache: cacheActive ? 'active' : 'offline',
        merkle_root: merkleRoot,
      },
      node_version: process.version
    },
    {
      status: dbStatus === 'connected' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

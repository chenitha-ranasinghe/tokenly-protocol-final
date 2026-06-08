import { NextResponse } from 'next/server';
import { getMetricsRegister } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const token = process.env.METRICS_SCRAPE_TOKEN;
  if (token) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${token}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const body = await getMetricsRegister().metrics();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': getMetricsRegister().contentType,
      'Cache-Control': 'no-store',
    },
  });
}

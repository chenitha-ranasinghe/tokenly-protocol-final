import type { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';

export function getCorrelationId(request: NextRequest): string {
  const existing =
    request.headers.get('x-request-id') ||
    request.headers.get('x-correlation-id');
  return existing && existing.trim().length > 0 ? existing.trim() : randomUUID();
}

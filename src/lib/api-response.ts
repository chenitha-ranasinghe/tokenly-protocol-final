import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'CONFLICT'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'INTERNAL';

export function jsonError(
  message: string,
  status: number,
  code: ApiErrorCode,
  extras?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    { error: message, code, ...extras },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

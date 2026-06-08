// Import NextRequest and NextResponse types from Next.js server module.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Configuration: List of public API endpoints that do not require login authentication.
const PUBLIC_API_ROUTES = [
  '/api/health',
  '/api/ready',
  '/api/metrics',
  '/api/csrf',
  '/api/auth',
  '/api/ticker',
  '/api/products',
  '/api/leaderboard',
  '/api/explorer',
  '/api/archionlabs/viewer/share',
  '/api/archionlabs/viewer/unlock',
  '/api/resale/estimate',
];

/** Read-only marketplace APIs (GET only — POST still requires session + CSRF). */
const PUBLIC_GET_API_PREFIXES = [
  '/api/construction/projects',
  '/api/construction/companies',
  '/api/resale/listings',
];

// Configuration: CSRF check is skipped for public endpoints.
const CSRF_SKIP_PREFIXES = PUBLIC_API_ROUTES;

/**
 * Checks if a specific incoming request path and method requires CSRF protection.
 * 
 * @param pathname - The request URL path.
 * @param method - The HTTP method (GET, POST, etc.).
 * @returns True if CSRF check is required, false otherwise.
 */
function needsCsrfCheck(pathname: string, method: string): boolean {
  // If CSRF is disabled globally in the environment variables, skip the check.
  if (process.env.DISABLE_CSRF === 'true') return false;
  
  // CSRF check only applies to API routes (starts with /api/).
  if (!pathname.startsWith('/api/')) return false;
  
  // CSRF check only applies to mutating requests (POST, PUT, PATCH, DELETE). GET requests are read-only.
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return false;
  
  // Skip the check if the route prefix matches the public routes list.
  return !CSRF_SKIP_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Next.js Middleware: Runs on every single incoming HTTP request to verify security.
 * 
 * @param request - Incoming NextRequest object.
 * @returns NextResponse containing security headers or blocking error payloads.
 */
export function middleware(request: NextRequest) {
  // Extract URL pathname from the request.
  const { pathname } = request.nextUrl;
  
  // Create a response object to continue the request chain.
  const response = NextResponse.next();

  // 1. Enforce Web Security Headers to protect client browsers from common attacks.
  
  // Disable DNS prefetching to protect user privacy.
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  
  // Prevent browser MIME-sniffing vulnerability (nosniff blocks executing text as scripts).
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // Clickjacking Mitigation: Block embedding the site inside foreign iFrame tags.
  response.headers.set('X-Frame-Options', 'DENY');
  
  // Cross-Site Scripting (XSS) Filter: Enforce block mode in old browsers.
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy: Send referrers only during same-origin navigations.
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy: Block browser access to sensitive devices like camera/mic.
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // HSTS (Strict Transport Security): Force all browser connections to use SSL (HTTPS) for 2 years.
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  
  // Content Security Policy (CSP): Restrict script execution, styles, images, and network domains to trusted hosts.
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://privy.io https://*.privy.io",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://api.groq.com https://*.privy.io https://*.supabase.co wss:",
      "frame-ancestors 'none'",
    ].join('; ')
  );

  // 2. Execute Double-Submit CSRF check on mutating requests.
  if (needsCsrfCheck(pathname, request.method)) {
    // Read the secret CSRF token stored inside the cookie.
    const cookie = request.cookies.get('tokenly_csrf')?.value;
    
    // Read the CSRF token submitted in the HTTP header from frontend JavaScript.
    const header = request.headers.get('x-csrf-token');
    
    // Verify cookie and header match. If not, block the write operation immediately (403 Forbidden).
    if (request.method !== 'GET' && (!cookie || !header || cookie !== header)) {
      return NextResponse.json({ error: 'CSRF validation failed', code: 'FORBIDDEN' }, { status: 403 });
    }
  }

  // 3. Resolve Protected API Access.
  const isProtectedAPI = pathname.startsWith('/api/') && !PUBLIC_API_ROUTES.some((r) => pathname.startsWith(r));
  
  if (isProtectedAPI && request.method === 'GET') {
    if (PUBLIC_GET_API_PREFIXES.some((p) => pathname.startsWith(p))) {
      return response;
    }
  }

  if (isProtectedAPI) {
    // Resolve if demo features are active.
    const portfolioDemo =
      request.nextUrl.searchParams.get('portfolio') === '1' ||
      request.headers.get('x-portfolio-demo') === 'true';

    const portfolioDemoApi =
      portfolioDemo &&
      (pathname.startsWith('/api/wisdom/report') ||
        pathname.startsWith('/api/archionlabs/'));

    // Read the session token from cookies.
    const sessionCookie = request.cookies.get('tokenly_session')?.value;
    
    // Reject request if session cookie is missing (unless accessing public review pages or demo APIs).
    if (!sessionCookie && !portfolioDemoApi) {
      if (pathname === '/api/reviews' && request.method === 'GET') return response;
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
  }

  // 4. Block local credential synchronization routes when running in production environment.
  if (pathname === '/api/auth/demo' && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return response;
}

// Config: Matcher pattern defines which routes trigger this middleware execution.
export const config = {
  // Runs middleware on all paths except static assets, images, and icons.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

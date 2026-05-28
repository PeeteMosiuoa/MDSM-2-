/**
 * middleware.js  (Edge runtime — runs before every matched request)
 *
 * Responsibilities
 * ─────────────────
 * 1. Auth gate  — protect /kyc and /dashboards routes
 * 2. KYC gate   — redirect unapproved users away from /dashboards → /kyc
 * 3. Cache-Control headers on read-heavy GET API routes so the Next.js
 *    data cache / CDN edge can serve stale-while-revalidate responses
 *    instead of hitting Postgres or the Besu RPC on every request.
 *
 * NOTE: the old file was named "middleleware.js" (triple-l) which Next.js
 * ignores. This file at the correct path is the live middleware.
 */

import { NextResponse } from 'next/server';

// ── Read-route cache policy ──────────────────────────────────────────────────
// Each entry: regex to match the pathname, s-maxage (CDN fresh TTL in seconds),
// stale-while-revalidate (SWR window in seconds).
//
// These values are conservative — tune upward once you measure real latency.
const READ_CACHE_RULES = [
  // Live market feed — relatively short fresh window
  { pattern: /^\/api\/market(\/|$)/,              maxAge: 20,  swr: 40  },
  // Securities list changes only on admin approval
  { pattern: /^\/api\/securities(\/|$)/,           maxAge: 60,  swr: 120 },
  // Blockchain records are immutable once written
  { pattern: /^\/api\/blockchain-records(\/|$)/,   maxAge: 300, swr: 600 },
  // Aggregate trade list (new trades trickle in)
  { pattern: /^\/api\/trades$/,                    maxAge: 20,  swr: 60  },
  // Clearing house stats — regulator read, update infrequently
  { pattern: /^\/api\/clearings(\/|$)/,            maxAge: 60,  swr: 180 },
];

function buildCacheHeader(pathname) {
  for (const rule of READ_CACHE_RULES) {
    if (rule.pattern.test(pathname)) {
      return `public, s-maxage=${rule.maxAge}, stale-while-revalidate=${rule.swr}`;
    }
  }
  return null;
}

// ── Middleware ───────────────────────────────────────────────────────────────

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const method       = request.method;

  // ── 1. Cache-Control injection for idempotent read routes ────────────────
  if (method === 'GET') {
    const directive = buildCacheHeader(pathname);
    if (directive) {
      const res = NextResponse.next();
      // s-maxage targets Vercel Edge / CDN; browsers respect max-age if present.
      // We keep no-store OFF so responses CAN be cached at the edge.
      res.headers.set('Cache-Control', directive);
      return res;
    }
  }

  // ── 2. Auth + KYC gates ───────────────────────────────────────────────────
  const needsAuth =
    pathname.startsWith('/kyc') || pathname.startsWith('/dashboards');

  if (needsAuth) {
    let user = null;
    try {
      const raw = request.cookies.get('user_session')?.value;
      if (raw) user = JSON.parse(raw);
    } catch {
      // Malformed cookie → treat as logged out
    }

    if (!user?.id) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Require KYC approval before reaching any dashboard
    if (
      pathname.startsWith('/dashboards') &&
      user.kyc_status !== 'approved'
    ) {
      return NextResponse.redirect(new URL('/kyc', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Auth-gated pages
    '/kyc/:path*',
    '/dashboards/:path*',
    // Cache-eligible read APIs
    '/api/market/:path*',
    '/api/securities/:path*',
    '/api/blockchain-records/:path*',
    '/api/trades',
    '/api/clearings/:path*',
  ],
};

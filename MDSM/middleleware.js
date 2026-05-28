import { NextResponse } from 'next/server';

export function middleware(request) {
  const cookie = request.cookies.get('user_session')?.value;
  const user = cookie ? JSON.parse(cookie) : null;

  const pathname = request.nextUrl.pathname;

  // Protect KYC and dashboard routes
  if (
    pathname.startsWith('/kyc') ||
    pathname.startsWith('/dashboards')
  ) {
    if (!user?.id) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // KYC enforcement before dashboard
  if (
    pathname.startsWith('/dashboards') &&
    user?.kyc_status !== 'approved'
  ) {
    return NextResponse.redirect(new URL('/kyc', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/kyc/:path*', '/dashboards/:path*'],
};
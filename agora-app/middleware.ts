import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Access Control Middleware
 *
 * Intercepts requests to /dashboard and redirects unauthenticated visitors
 * to /officer-login.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/dashboard')) {
    const officerSession = request.cookies.get('officer_session');
    if (officerSession?.value !== 'authenticated') {
      const loginUrl = new URL('/officer-login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};

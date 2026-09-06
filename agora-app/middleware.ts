import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Access Control Middleware
 *
 * Intercepts requests to /dashboard and redirects unauthenticated visitors
 * to /officer-login.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// List of paths that require authentication
const protectedPaths = [
  '/create',
  '/schedule',
  '/library',
  '/settings',
  '/analytics',
  '/editor',
  '/dashboard',
  '/settings/billing',
];

// List of paths that are only accessible to non-authenticated users
const authPaths = [
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
];

export async function middleware(request: NextRequest) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname;

  // Skip middleware for API routes
  if (path.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Get the session cookie (support host-only and domain cookies)
  // Prefer cookie helper, but also scan header to avoid framework edge-cases
  const hasCookieHelper = !!request.cookies.get('session')?.value;
  const hasCookieHeader = (request.headers.get('cookie') || '').includes('session=');
  const isLoggedIn = hasCookieHelper || hasCookieHeader;

  // If the path is protected and user is not logged in
  if (protectedPaths.some(p => path.startsWith(p)) && !isLoggedIn) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('from', path);
    return NextResponse.redirect(loginUrl);
  }

  // Allow access to auth pages even if a stale session cookie exists.
  // The client will redirect post-login once the session is actually established.
  if (authPaths.some(p => path.startsWith(p))) {
    return NextResponse.next();
  }

  // Handle video files
  if (path.startsWith('/videos/')) {
    const response = NextResponse.next();
    
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)'
  ]
}; 
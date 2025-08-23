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
  const session = request.cookies.get('session')?.value || request.headers.get('cookie')?.includes('session=') ? '1' : '';
  const isLoggedIn = !!session;

  // If the path is protected and user is not logged in
  if (protectedPaths.some(p => path.startsWith(p)) && !isLoggedIn) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('from', path);
    return NextResponse.redirect(loginUrl);
  }

  // If the path is for non-authenticated users and user is logged in
  if (authPaths.some(p => path.startsWith(p)) && isLoggedIn) {
    return NextResponse.redirect(new URL('/create', request.url));
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
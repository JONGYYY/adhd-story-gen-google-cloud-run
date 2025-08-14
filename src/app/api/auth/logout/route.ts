import { NextResponse } from 'next/server';

function determineCookieDomain(hostHeader: string | null): string | undefined {
  if (!hostHeader) return undefined;
  const host = hostHeader.split(':')[0];
  if (host === 'localhost' || /^(\d+\.){3}\d+$/.test(host)) return undefined;
  const parts = host.split('.');
  if (parts.length >= 2) {
    const root = parts.slice(-2).join('.');
    return `.${root}`;
  }
  return undefined;
}

export async function POST(request: Request) {
  const response = new NextResponse(JSON.stringify({ status: 'success' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const hostHeader = new Headers(request.headers).get('host');
  const cookieDomain = process.env.NODE_ENV === 'production' ? determineCookieDomain(hostHeader) : undefined;

  // Clear the session cookie
  response.cookies.set({
    name: 'session',
    value: '',
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    domain: cookieDomain,
  } as any);

  return response;
} 
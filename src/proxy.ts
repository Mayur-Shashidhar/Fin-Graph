import { NextResponse, type NextRequest } from 'next/server';
import { authorizeRequest, readSession, SESSION_COOKIE } from './lib/auth';

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === '/login' || path.startsWith('/api/auth/') || path === '/api/health' || path === '/api/graph/health') return NextResponse.next();
  if (path.startsWith('/api/')) return authorizeRequest(request) ?? NextResponse.next();
  if (!readSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ['/', '/transactions/:path*', '/alerts/:path*', '/detection-rules/:path*', '/graph-analysis/:path*', '/api/:path*'] };

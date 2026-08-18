import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { AUTH_COOKIE } from '@/lib/constants';

const PUBLIC_PATHS = [
  '/',
  '/home',
  '/info',
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/session',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === '/' ||
    PUBLIC_PATHS.some((p) => p !== '/' && (pathname === p || pathname.startsWith(`${p}/`)));

  if (
    isPublic ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/v1/')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

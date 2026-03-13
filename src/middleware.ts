import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PATHS = ['/my', '/agenda', '/admin'];
const ADMIN_PATHS = ['/admin'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if path needs auth
  const needsAuth = PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (!needsAuth) return NextResponse.next();

  const sessionToken = request.cookies.get('session')?.value;
  if (!sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // For admin paths, check role cookie
  const isAdmin = ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (isAdmin) {
    const role = request.cookies.get('role')?.value;
    if (role !== 'parent') {
      return NextResponse.redirect(new URL('/my', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/my/:path*', '/agenda/:path*', '/admin/:path*'],
};

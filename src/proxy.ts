import { NextResponse, type NextRequest } from 'next/server';

function normalizedAdminPath() {
  const raw = process.env.ADMIN_PATH || '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('/') ? trimmed.replace(/\/+$/, '') || '/' : `/${trimmed.replace(/\/+$/, '')}`;
}

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  const adminPath = normalizedAdminPath();

  if (adminPath && request.nextUrl.pathname === adminPath) {
    requestHeaders.set('x-admin-original-path', request.nextUrl.pathname);
    const url = request.nextUrl.clone();
    url.pathname = '/admin-internal';
    return NextResponse.rewrite(url, {
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.svg).*)'],
};

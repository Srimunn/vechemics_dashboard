import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * Protects /dashboard/*. In demo/mock mode (NEXT_PUBLIC_USE_MOCK) the gate is
 * skipped so the UI can be previewed without a backend + login.
 */
export default auth((req) => {
  if (process.env.NEXT_PUBLIC_USE_MOCK === 'true') return NextResponse.next();
  if (!req.auth) {
    const url = new URL('/login', req.nextUrl.origin);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*'],
};

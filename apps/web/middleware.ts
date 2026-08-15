import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Must stay in sync with `SESSION_COOKIE_NAME` in
// apps/api/src/platform/auth/auth.constants.ts. Duplicated here (rather
// than imported) because apps/web is a separate deployable that cannot
// depend on apps/api's source — there is no shared package between the two
// apps for this constant in this slice.
const SESSION_COOKIE_NAME = 'clensy_admin_session';

// UX-hint-only gate (spec §4.8/§5.6): checks ONLY whether the session
// cookie is present, never its validity. It does not decode the JWT and
// makes no role decision — an expired, invalid, or disabled-account session
// still has a present cookie and will pass through here. That case is
// caught downstream by `/admin`'s `currentAdmin` query (a GraphQL error or
// missing principal), which is the actual point of authentication
// enforcement on this side; the API's guards remain the sole source of
// authorization truth regardless.
export function middleware(request: NextRequest) {
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);

  if (!hasSessionCookie) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/customers', '/customers/:path*'],
};

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Must stay in sync with `SESSION_COOKIE_NAME` in
// apps/api/src/platform/auth/auth.constants.ts. Duplicated here (rather
// than imported) because apps/web is a separate deployable that cannot
// depend on apps/api's source — there is no shared package between the two
// apps for this constant in this slice.
const SESSION_COOKIE_NAME = 'clensy_admin_session';

// UX-hint-only gate (spec §4.1): checks ONLY whether the session cookie is
// present, never its validity. It does not decode the JWT and makes no
// role decision — an expired, invalid, or disabled-account session still
// has a present cookie and will pass through here. On `/app/admin`
// specifically, that case is caught downstream by its `currentAdmin` query
// (a GraphQL error or missing principal); other `/app/*` routes have no
// equivalent downstream redirect-on-invalid-session logic yet.
//
// The matcher is a single `/app/:path*` pattern covering every route in
// the shell — Admin, Customers, Cleaners/Teams, and Catalog/Add-ons all
// live under `/app/*` now, so there are no legacy pre-migration paths left
// unmatched here. This has no security impact either way (this gate was
// never a security boundary, only a UX hint; the API's guards remain the
// sole source of authorization truth regardless of what this file does).
export function middleware(request: NextRequest) {
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);

  if (!hasSessionCookie) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*'],
};

// Single source of truth for the HttpOnly session-cookie name (spec §4.8).
// `JwtStrategy`'s custom cookie extractor reads it here; Task 5's `login`
// mutation resolver will set the cookie under this same name; Task 8's
// `apps/web` route-group middleware will read it (as a UX-only routing
// hint, never as proof of authentication — spec §5.6) under this same name
// too. Keeping it as one exported constant, rather than a string literal
// repeated in each of those places, is what makes that sharing safe.
export const SESSION_COOKIE_NAME = 'clensy_admin_session';

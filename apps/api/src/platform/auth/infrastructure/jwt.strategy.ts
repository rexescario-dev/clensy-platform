import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { ADMIN_IDENTITY_LOOKUP } from '../application/admin-identity-lookup.port';
import type { AdminIdentityLookupPort } from '../application/admin-identity-lookup.port';
import { SESSION_COOKIE_NAME } from '../auth.constants';
import { AuthenticatedPrincipal } from '../domain/authenticated-principal';

// A stand-in used only when `JWT_SECRET` is unset AND we're inside a test
// environment — mirrors `TokenService`'s fail-fast check (see there for
// rationale); never reachable outside tests.
const TEST_ONLY_FALLBACK_SECRET = 'test-only-placeholder-secret';

interface JwtPayload {
  sub: string;
}

// Reads the JWT from the named HttpOnly session cookie (spec §4.8) rather
// than the default Authorization-bearer-header extractor — the whole point
// of the cookie mechanism is that the token is never exposed to page
// JavaScript, so nothing should also be sending it as a bearer header.
// `req.cookies` requires `cookie-parser` middleware ahead of this in the
// request pipeline (wired at the composition root, Task 6).
function cookieExtractor(req: Request): string | null {
  const cookies = (req as unknown as { cookies?: Record<string, string> })
    .cookies;
  return cookies?.[SESSION_COOKIE_NAME] ?? null;
}

// Passport strategy consumed by `AuthGuard` (`PassportAuthGuard('jwt')`,
// matched by passport-jwt's default strategy name). Verifies the JWT's
// signature/expiry (Passport's own `Strategy` machinery, before `validate`
// is ever called), then re-derives the current principal from
// `ADMIN_IDENTITY_LOOKUP` on every single call — never caches, never trusts
// a role from the token, because the token never carries one (spec §4.1).
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject(ADMIN_IDENTITY_LOOKUP)
    private readonly adminIdentityLookup: AdminIdentityLookupPort,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret && process.env.NODE_ENV !== 'test') {
      throw new Error(
        'JWT_SECRET must be set — platform/auth JwtStrategy refuses to start without it.',
      );
    }
    super({
      jwtFromRequest: cookieExtractor,
      secretOrKey: secret ?? TEST_ONLY_FALLBACK_SECRET,
      ignoreExpiration: false,
    });
  }

  // A request is authenticated only when both (a) the JWT verified above
  // and (b) the AdminUser identified by `sub` currently exists and is
  // active (spec §4.1) — a `null` lookup result covers both "no such id"
  // and "disabled," and both are rejected identically here, exactly like a
  // failed signature/expiry check. This is how a disabled account's
  // previously-issued, still-unexpired JWT gets rejected on its very next
  // request.
  async validate(payload: JwtPayload): Promise<AuthenticatedPrincipal> {
    const principal = await this.adminIdentityLookup.findActiveAdminById(
      payload.sub,
    );
    if (!principal) {
      throw new UnauthorizedException();
    }
    return principal;
  }
}

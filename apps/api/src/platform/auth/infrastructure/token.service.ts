import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';

// A stand-in used only when `JWT_SECRET` is unset AND we're inside a test
// environment (see the fail-fast check below) — never reachable outside
// tests, since the constructor throws first in every other environment.
const TEST_ONLY_FALLBACK_SECRET = 'test-only-placeholder-secret';

// Issues session JWTs. Payload is `sub` (the AdminUser id) only — no `role`
// claim (spec §4.1): the JWT is never trusted for authorization, so there is
// nothing to gain by putting a role in it, and doing so would create a
// second, staler source of truth for the role `AuthGuard`/`JwtStrategy`
// otherwise always re-derive from the database on every request.
//
// `secret`/`expiresIn` are read once, at construction, from `ConfigService`
// (matching `DatabaseModule`'s `ConfigService.get(...)` pattern for `DB_*`)
// rather than re-read per call.
@Injectable()
export class TokenService {
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    // Fail fast at startup instead of the tempting-but-forbidden
    // `process.env.JWT_SECRET || 'fallback'` pattern: a running instance
    // must never silently sign tokens with a fallback secret. The one
    // exception is the test environment, where individual specs supply
    // their own explicit secret via a `ConfigService` stub — this branch
    // only ever engages when a spec deliberately omits one.
    if (!secret && process.env.NODE_ENV !== 'test') {
      throw new Error(
        'JWT_SECRET must be set — platform/auth TokenService refuses to start without it.',
      );
    }
    this.secret = secret ?? TEST_ONLY_FALLBACK_SECRET;
    this.expiresIn = configService.get<string>('JWT_EXPIRES_IN', '8h');
  }

  // `expiresIn` is the single shared `JWT_EXPIRES_IN` config value (spec
  // §4.1's 8h default) — the same value Task 5/8 will read again for the
  // session cookie's `Max-Age`, so the two never drift independently.
  issue(adminId: string): string {
    return this.jwtService.sign(
      { sub: adminId },
      {
        secret: this.secret,
        // `JwtSignOptions['expiresIn']` is typed against the `ms` package's
        // template-literal `StringValue` union (e.g. `'8h'`), which a
        // config-sourced `string` can't statically satisfy — the value
        // still comes from `JWT_EXPIRES_IN` at runtime, this cast only
        // relaxes the compile-time check.
        expiresIn: this.expiresIn as JwtSignOptions['expiresIn'],
      },
    );
  }
}

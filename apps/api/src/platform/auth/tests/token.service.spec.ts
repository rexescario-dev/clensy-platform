import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TokenService } from '../infrastructure/token.service';

// Not listed among the brief's explicit "Files (new)" test files, but the
// TDD list under Task 4 explicitly requires two `TokenService` cases (the
// fail-fast-on-missing-secret behavior and the exact-payload-shape
// regression guard) that need a home — this is that home.
describe('TokenService', () => {
  const buildConfigStub = (overrides: Record<string, unknown>) => ({
    get: (key: string, fallback?: unknown) =>
      key in overrides ? overrides[key] : fallback,
  });

  const buildModule = (
    configStub: Partial<ConfigService>,
  ): Promise<TestingModule> =>
    Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        TokenService,
        { provide: ConfigService, useValue: configStub },
      ],
    }).compile();

  it('throws when JWT_SECRET is unset outside a test environment', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const configStub = buildConfigStub({ JWT_SECRET: undefined });
      await expect(buildModule(configStub)).rejects.toThrow(/JWT_SECRET/);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('issues a token whose decoded payload has exactly sub, iat, exp — no role, nothing else', async () => {
    const configStub = buildConfigStub({
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '8h',
    });
    const moduleRef = await buildModule(configStub);
    const tokenService = moduleRef.get(TokenService);
    const jwtService = moduleRef.get(JwtService);

    const token = tokenService.issue('admin-1');
    const decoded = jwtService.decode<Record<string, unknown>>(token);

    expect(Object.keys(decoded).sort()).toEqual(['exp', 'iat', 'sub']);
    expect(decoded.sub).toBe('admin-1');
  });
});

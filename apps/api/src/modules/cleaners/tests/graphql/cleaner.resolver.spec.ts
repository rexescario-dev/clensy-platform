import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GraphQLObjectType } from 'graphql';
// @ptc-org/nestjs-query-graphql 9.5.0 does not re-export getAuthorizer from
// the package root, so this deep import is required.
import { getAuthorizer } from '@ptc-org/nestjs-query-graphql/src/decorators';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CleanersService } from '../../application/services/cleaners.service';
import { Cleaner } from '../../domain/cleaner';
import { CleanerResolver } from '../../presentation/graphql/cleaner.resolver';
import { CleanerReadResolver } from '../../presentation/graphql/cleaner-read.resolver';
import { CleanerType } from '../../presentation/graphql/cleaner.type';
import { TeamResolver } from '../../presentation/graphql/team.resolver';
import { TeamReadResolver } from '../../presentation/graphql/team-read.resolver';

type ResolverMethod =
  'assignCleanerToTeam' | 'cleaner' | 'createCleaner' | 'updateCleaner';

// View matrix per spec §4.3: Customer Support and Finance excluded (unlike
// the Customers module) — this module's RBAC matrix is deliberately
// different, not copied from `property.resolver.ts`.
const VIEW_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.ANALYST,
];

const WRITE_ROLES = [Role.TENANT_OWNER, Role.OPS_MANAGER];

// Same technique as `customer.resolver.spec.ts`/`property.resolver.spec.ts`:
// reads the method's own function value off `CleanerResolver.prototype` —
// the exact function reference Nest's `@UseGuards()`/`@Roles()` attach
// `Reflect` metadata to.
function methodRef(method: ResolverMethod): (...args: unknown[]) => unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    CleanerResolver.prototype,
    method,
  );
  return descriptor!.value as (...args: unknown[]) => unknown;
}

describe('CleanerResolver', () => {
  const reflector = new Reflector();

  function guardsOn(method: ResolverMethod): unknown[] {
    const guards = Reflect.getMetadata(GUARDS_METADATA, methodRef(method)) as
      unknown[] | undefined;
    return guards ?? [];
  }

  function rolesOn(method: ResolverMethod): Role[] | undefined {
    return reflector.get<Role[] | undefined>(ROLES_KEY, methodRef(method));
  }

  describe.each([['cleaner', VIEW_ROLES]] as const)(
    '%s',
    (method, expectedRoles) => {
      it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — view matrix`, () => {
        expect(guardsOn(method)).toContain(AuthGuard);
        expect(rolesOn(method)).toEqual(expectedRoles);
      });
    },
  );

  describe.each([
    ['createCleaner', WRITE_ROLES],
    ['updateCleaner', WRITE_ROLES],
    ['assignCleanerToTeam', WRITE_ROLES],
  ] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — write matrix`, () => {
      expect(guardsOn(method)).toContain(AuthGuard);
      expect(rolesOn(method)).toEqual(expectedRoles);
    });
  });

  // Builds the actual GraphQL schema from both resolvers' decorator metadata
  // (same `GraphQLSchemaFactory` recipe as `customer.resolver.spec.ts`) —
  // both are needed because `CleanerType.team` references `TeamType` and
  // `TeamType.cleaners` references `CleanerType`.
  describe('CleanerType (schema field set)', () => {
    it('exposes exactly id, fullName, phone, email, notes, team, createdAt, updatedAt', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [GraphQLSchemaBuilderModule],
      }).compile();
      const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
      const schema = await schemaFactory.create([
        CleanerReadResolver,
        CleanerResolver,
        TeamReadResolver,
        TeamResolver,
      ]);

      const cleanerType = schema.getType('Cleaner') as GraphQLObjectType;
      expect(cleanerType).toBeDefined();

      const fieldNames = Object.keys(cleanerType.getFields()).sort();
      expect(fieldNames).toEqual(
        [
          'id',
          'fullName',
          'phone',
          'email',
          'notes',
          'team',
          'createdAt',
          'updatedAt',
        ].sort(),
      );
      // Belt-and-suspenders (task brief): `teamId` must never appear in the
      // public schema, even though `toCleanerType()` puts it on the runtime
      // object for `team`'s `@ResolveField()` to read.
      expect(fieldNames).not.toContain('teamId');
    });
  });

  // Proves the short-circuit exists in code, not just happens to work
  // because DataLoader tolerates a null key (task brief).
  describe('team', () => {
    it('returns null synchronously and never calls loaders.teamLoaderFor when cleaner.teamId is null', async () => {
      const loaders = {
        teamLoaderFor: jest.fn(),
      };
      const resolver = new CleanerResolver({} as never, loaders as never);

      const result = resolver.team(
        { id: 'cleaner-1', teamId: null },
        undefined,
      );

      await expect(result).resolves.toBeNull();
      expect(loaders.teamLoaderFor).not.toHaveBeenCalled();
    });

    it('Cleaner.team uses the loader for the caller tenant', async () => {
      const team = {
        id: 'team-1',
        createdAt: new Date(),
        name: 'Team A',
        updatedAt: new Date(),
      };
      const load = jest.fn().mockResolvedValue(team);
      const loaders = {
        teamLoaderFor: jest.fn().mockReturnValue({ load }),
      };
      const resolver = new CleanerResolver({} as never, loaders as never);
      const principal: AuthenticatedPrincipal = {
        id: 'u',
        tenantId: 't-a',
        role: Role.OPS_MANAGER,
        scope: AdminScope.TENANT,
      };

      const result = await resolver.team(
        { id: 'c-1', teamId: 'team-a' },
        principal,
      );

      expect(loaders.teamLoaderFor).toHaveBeenCalledWith('t-a');
      expect(load).toHaveBeenCalledWith('team-a');
      expect(result).toMatchObject({ id: 'team-1', name: 'Team A' });
    });

    it('Cleaner.team with no principal uses the null-tenant loader', async () => {
      const load = jest.fn().mockResolvedValue(null);
      const loaders = {
        teamLoaderFor: jest.fn().mockReturnValue({ load }),
      };
      const resolver = new CleanerResolver({} as never, loaders as never);

      await resolver.team({ id: 'c-1', teamId: 'team-a' }, undefined);

      expect(loaders.teamLoaderFor).toHaveBeenCalledWith(null);
      expect(load).toHaveBeenCalledWith('team-a');
    });
  });
});

// Tenant isolation (#83, multi-tenant spec §4.5, controller ruling 2): the
// tenant comes only from the DB-loaded principal. Reads pass it through
// (the service fails closed on `null`); writes require it. A command's
// `tenantId` is set after `...input` so no input key can override it.
describe('CleanerResolver tenant scoping', () => {
  const principal: AuthenticatedPrincipal = {
    id: 'u',
    tenantId: 't-a',
    role: Role.OPS_MANAGER,
    scope: AdminScope.TENANT,
  };

  function makeCleaner(): Cleaner {
    return {
      id: 'c-1',
      teamId: null,
      tenantId: 't-a',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      email: 'jane@example.com',
      fullName: 'Jane',
      notes: null,
      phone: '555',
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };
  }

  let cleanersService: {
    assignCleanerToTeam: jest.Mock;
    createCleaner: jest.Mock;
    getCleaner: jest.Mock;
    updateCleaner: jest.Mock;
  };
  let resolver: CleanerResolver;

  beforeEach(() => {
    cleanersService = {
      assignCleanerToTeam: jest.fn().mockResolvedValue(makeCleaner()),
      createCleaner: jest.fn().mockResolvedValue(makeCleaner()),
      getCleaner: jest.fn().mockResolvedValue(makeCleaner()),
      updateCleaner: jest.fn().mockResolvedValue(makeCleaner()),
    };
    resolver = new CleanerResolver(
      cleanersService as unknown as CleanersService,
      { teamLoaderFor: jest.fn() } as never,
    );
  });

  it('cleaner(id) passes the caller tenant', async () => {
    cleanersService.getCleaner.mockResolvedValue(null);
    await resolver.cleaner('c-1', principal);
    expect(cleanersService.getCleaner).toHaveBeenCalledWith('c-1', 't-a');
  });

  it('createCleaner passes requireTenantId(principal)', async () => {
    await resolver.createCleaner(
      { fullName: 'Jane', phone: '555', email: 'jane@example.com' },
      principal,
    );
    expect(cleanersService.createCleaner).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't-a' }),
    );
  });

  it('updateCleaner passes requireTenantId(principal)', async () => {
    await resolver.updateCleaner('c-1', { fullName: 'Janet' }, principal);
    expect(cleanersService.updateCleaner).toHaveBeenCalledWith(
      'c-1',
      expect.objectContaining({ tenantId: 't-a' }),
    );
  });

  it('assignCleanerToTeam passes requireTenantId(principal)', async () => {
    await resolver.assignCleanerToTeam('c-1', 'team-1', principal);
    expect(cleanersService.assignCleanerToTeam).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't-a' }),
    );
  });
});

// @Authorize metadata (mirrors #82's property-read.resolver.spec.ts).
describe('CleanerType tenant authorizer', () => {
  it('is registered on CleanerType and constrains reads to the principal tenant', async () => {
    const Authorizer = getAuthorizer(CleanerType);
    expect(Authorizer).toBeDefined();
    const authorizer = new Authorizer!({}, undefined);
    await expect(
      authorizer.authorize(
        {
          req: {
            user: {
              id: 'u',
              tenantId: 't-a',
              role: Role.OPS_MANAGER,
              scope: AdminScope.TENANT,
            },
          },
        },
        { operationGroup: 'read' } as never,
      ),
    ).resolves.toEqual({ tenantId: { eq: 't-a' } });
  });
});

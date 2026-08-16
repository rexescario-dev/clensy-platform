import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GraphQLObjectType } from 'graphql';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CleanerResolver } from '../../presentation/graphql/cleaner.resolver';
import { TeamResolver } from '../../presentation/graphql/team.resolver';

type ResolverMethod =
  | 'cleaner'
  | 'cleaners'
  | 'createCleaner'
  | 'updateCleaner'
  | 'assignCleanerToTeam';

// View matrix per spec §4.3: Customer Support and Finance excluded (unlike
// the Customers module) — this module's RBAC matrix is deliberately
// different, not copied from `property.resolver.ts`.
const VIEW_ROLES = [Role.OWNER, Role.OPS_MANAGER, Role.SCHEDULER, Role.ANALYST];

const WRITE_ROLES = [Role.OWNER, Role.OPS_MANAGER];

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

  describe.each([
    ['cleaner', VIEW_ROLES],
    ['cleaners', VIEW_ROLES],
  ] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — view matrix`, () => {
      expect(guardsOn(method)).toContain(AuthGuard);
      expect(rolesOn(method)).toEqual(expectedRoles);
    });
  });

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
        CleanerResolver,
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
    it('returns null synchronously and never calls loaders.teamLoader.load when cleaner.teamId is null', async () => {
      const loaders = {
        teamLoader: { load: jest.fn() },
        teamCleanersLoader: { load: jest.fn() },
      };
      const resolver = new CleanerResolver({} as never, loaders as never);

      const result = resolver.team({ id: 'cleaner-1', teamId: null });

      await expect(result).resolves.toBeNull();
      expect(loaders.teamLoader.load).not.toHaveBeenCalled();
    });

    it('loads the team via loaders.teamLoader when cleaner.teamId is set', async () => {
      const team = {
        id: 'team-1',
        name: 'Team A',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const loaders = {
        teamLoader: { load: jest.fn().mockResolvedValue(team) },
        teamCleanersLoader: { load: jest.fn() },
      };
      const resolver = new CleanerResolver({} as never, loaders as never);

      const result = await resolver.team({
        id: 'cleaner-1',
        teamId: 'team-1',
      });

      expect(loaders.teamLoader.load).toHaveBeenCalledWith('team-1');
      expect(result).toMatchObject({ id: 'team-1', name: 'Team A' });
    });
  });
});

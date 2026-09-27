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
import { Team } from '../../domain/team';
import { TeamsService } from '../../application/services/teams.service';
import { CleanerResolver } from '../../presentation/graphql/cleaner.resolver';
import { CleanerReadResolver } from '../../presentation/graphql/cleaner-read.resolver';
import { TeamResolver } from '../../presentation/graphql/team.resolver';
import { TeamReadResolver } from '../../presentation/graphql/team-read.resolver';
import { TeamType } from '../../presentation/graphql/team.type';

type ResolverMethod = 'createTeam' | 'team';

// View matrix per spec §4.3: Customer Support and Finance excluded.
const VIEW_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.ANALYST,
];

const WRITE_ROLES = [Role.TENANT_OWNER, Role.OPS_MANAGER];

function methodRef(method: ResolverMethod): (...args: unknown[]) => unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    TeamResolver.prototype,
    method,
  );
  return descriptor!.value as (...args: unknown[]) => unknown;
}

describe('TeamResolver', () => {
  const reflector = new Reflector();

  function guardsOn(method: ResolverMethod): unknown[] {
    const guards = Reflect.getMetadata(GUARDS_METADATA, methodRef(method)) as
      unknown[] | undefined;
    return guards ?? [];
  }

  function rolesOn(method: ResolverMethod): Role[] | undefined {
    return reflector.get<Role[] | undefined>(ROLES_KEY, methodRef(method));
  }

  describe.each([['team', VIEW_ROLES]] as const)(
    '%s',
    (method, expectedRoles) => {
      it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — view matrix`, () => {
        expect(guardsOn(method)).toContain(AuthGuard);
        expect(rolesOn(method)).toEqual(expectedRoles);
      });
    },
  );

  describe.each([['createTeam', WRITE_ROLES]] as const)(
    '%s',
    (method, expectedRoles) => {
      it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — write matrix`, () => {
        expect(guardsOn(method)).toContain(AuthGuard);
        expect(rolesOn(method)).toEqual(expectedRoles);
      });
    },
  );

  // No `updateTeam` mutation exists (task brief) — belt-and-suspenders
  // against one being reintroduced without an explicit spec/plan decision.
  it('has no updateTeam method', () => {
    expect(
      Object.getOwnPropertyDescriptor(TeamResolver.prototype, 'updateTeam'),
    ).toBeUndefined();
  });

  describe('TeamType (schema field set)', () => {
    it('exposes exactly id, name, cleaners, createdAt, updatedAt', async () => {
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

      const teamType = schema.getType('Team') as GraphQLObjectType;
      expect(teamType).toBeDefined();

      const fieldNames = Object.keys(teamType.getFields()).sort();
      expect(fieldNames).toEqual(
        ['id', 'name', 'cleaners', 'createdAt', 'updatedAt'].sort(),
      );
    });
  });

  describe('cleaners', () => {
    it('is a nested offset connection field, not a Clensy ResolveField array', () => {
      expect(
        Object.getOwnPropertyDescriptor(TeamResolver.prototype, 'cleaners'),
      ).toBeUndefined();
    });
  });
});

// Tenant isolation (#83, multi-tenant spec §4.5, controller ruling 2): the
// tenant comes only from the DB-loaded principal. Reads pass it through
// (the service fails closed on `null`); writes require it. A command's
// `tenantId` is set after `...input` so no input key can override it.
describe('TeamResolver tenant scoping', () => {
  const principal: AuthenticatedPrincipal = {
    id: 'u',
    tenantId: 't-a',
    role: Role.OPS_MANAGER,
    scope: AdminScope.TENANT,
  };

  function makeTeam(): Team {
    return {
      id: 'team-1',
      tenantId: 't-a',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      name: 'Alpha',
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };
  }

  let teamsService: { createTeam: jest.Mock; getTeam: jest.Mock };
  let resolver: TeamResolver;

  beforeEach(() => {
    teamsService = {
      createTeam: jest.fn().mockResolvedValue(makeTeam()),
      getTeam: jest.fn().mockResolvedValue(makeTeam()),
    };
    resolver = new TeamResolver(teamsService as unknown as TeamsService);
  });

  it('team(id) passes the caller tenant', async () => {
    teamsService.getTeam.mockResolvedValue(null);
    await expect(resolver.team('team-1', principal)).resolves.toBeNull();
    expect(teamsService.getTeam).toHaveBeenCalledWith('team-1', 't-a');
  });

  it('createTeam takes tenantId from the principal, after the input spread', async () => {
    teamsService.createTeam.mockResolvedValue(makeTeam());
    await resolver.createTeam(
      { name: 'Alpha', tenantId: 'evil' } as never,
      principal,
    );
    expect(teamsService.createTeam).toHaveBeenCalledWith({
      name: 'Alpha',
      actorId: 'u',
      tenantId: 't-a',
    });
  });
});

// @Authorize metadata (mirrors #82's property-read.resolver.spec.ts).
describe('TeamType tenant authorizer', () => {
  it('is registered on TeamType and constrains reads to the principal tenant', async () => {
    const Authorizer = getAuthorizer(TeamType);
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

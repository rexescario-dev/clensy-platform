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
import { CleanerReadResolver } from '../../presentation/graphql/cleaner-read.resolver';
import { TeamResolver } from '../../presentation/graphql/team.resolver';
import { TeamReadResolver } from '../../presentation/graphql/team-read.resolver';

type ResolverMethod = 'team' | 'createTeam';

// View matrix per spec §4.3: Customer Support and Finance excluded.
const VIEW_ROLES = [Role.OWNER, Role.OPS_MANAGER, Role.SCHEDULER, Role.ANALYST];

const WRITE_ROLES = [Role.OWNER, Role.OPS_MANAGER];

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

  describe.each([['team', VIEW_ROLES]] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — view matrix`, () => {
      expect(guardsOn(method)).toContain(AuthGuard);
      expect(rolesOn(method)).toEqual(expectedRoles);
    });
  });

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

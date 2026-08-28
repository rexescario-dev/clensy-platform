import { readFileSync } from 'fs';
import { join } from 'path';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GraphQLObjectType } from 'graphql';
import { PLATFORM_PAGE_DEFAULT } from '../../../../platform/graphql/paging';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CleanerResolver } from '../../presentation/graphql/cleaner.resolver';
import { CleanerReadResolver } from '../../presentation/graphql/cleaner-read.resolver';
import { TeamResolver } from '../../presentation/graphql/team.resolver';
import { TeamReadResolver } from '../../presentation/graphql/team-read.resolver';
import { BookingReadResolver } from '../../../bookings/presentation/graphql/booking-read.resolver';

type ReadMethod = 'queryMany';

const VIEW_ROLES = [Role.OWNER, Role.OPS_MANAGER, Role.SCHEDULER, Role.ANALYST];

function readMethodRef(
  ctor: { prototype: object },
  method: ReadMethod,
): (...args: unknown[]) => unknown {
  let proto: object | null = ctor.prototype;
  while (proto) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, method);
    if (descriptor?.value) {
      return descriptor.value as (...args: unknown[]) => unknown;
    }
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  throw new Error(`Read method ${method} not found`);
}

describe('Cleaner and Team GraphQL collections', () => {
  const reflector = new Reflector();

  describe.each([
    [CleanerReadResolver, VIEW_ROLES],
    [TeamReadResolver, VIEW_ROLES],
  ] as const)('%s queryMany', (ctor, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — view matrix`, () => {
      const method = readMethodRef(ctor, 'queryMany');
      const guards = Reflect.getMetadata(GUARDS_METADATA, method) as
        | unknown[]
        | undefined;
      expect(guards ?? []).toContain(AuthGuard);
      expect(reflector.get<Role[] | undefined>(ROLES_KEY, method)).toEqual(
        expectedRoles,
      );
    });
  });

  async function buildSchema() {
    const moduleRef = await Test.createTestingModule({
      imports: [GraphQLSchemaBuilderModule],
    }).compile();
    const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
    return schemaFactory.create([
      CleanerReadResolver,
      CleanerResolver,
      TeamReadResolver,
      TeamResolver,
      BookingReadResolver,
    ]);
  }

  it('exposes cleaners and teams as root connections with totalCount and nested team.cleaners without totalCount', async () => {
    const schema = await buildSchema();

    const cleanersQuery = schema.getQueryType()!.getFields().cleaners;
    expect(cleanersQuery.type.toString()).toBe('CleanerConnection!');
    expect(cleanersQuery.args.map((arg) => arg.name)).toEqual(
      expect.arrayContaining(['paging']),
    );
    const cleanersPaging = cleanersQuery.args.find(
      (arg) => arg.name === 'paging',
    );
    expect(cleanersPaging?.type.toString()).toMatch(/OffsetPaging/);
    expect(cleanersPaging?.defaultValue).toEqual({
      limit: PLATFORM_PAGE_DEFAULT,
    });
    const cleanerConnection = schema.getType(
      'CleanerConnection',
    ) as GraphQLObjectType;
    expect(Object.keys(cleanerConnection.getFields()).sort()).toEqual(
      ['nodes', 'pageInfo', 'totalCount'].sort(),
    );

    const teamsQuery = schema.getQueryType()!.getFields().teams;
    expect(teamsQuery.type.toString()).toBe('TeamConnection!');
    expect(teamsQuery.args.map((arg) => arg.name)).toEqual(
      expect.arrayContaining(['paging']),
    );
    const teamConnection = schema.getType('TeamConnection') as GraphQLObjectType;
    expect(Object.keys(teamConnection.getFields()).sort()).toEqual(
      ['nodes', 'pageInfo', 'totalCount'].sort(),
    );

    const teamType = schema.getType('Team') as GraphQLObjectType;
    const cleanersField = teamType.getFields().cleaners;
    expect(cleanersField.type.toString()).toMatch(/Connection!$/);
    expect(cleanersField.args.map((arg) => arg.name)).toContain('paging');
    const nestedTypeName = cleanersField.type.toString().replace(/!$/, '');
    expect(nestedTypeName).not.toBe('CleanerConnection');
    const nestedConnection = schema.getType(
      nestedTypeName,
    ) as GraphQLObjectType;
    expect(Object.keys(nestedConnection.getFields())).toEqual(
      expect.arrayContaining(['nodes', 'pageInfo']),
    );
    expect(Object.keys(nestedConnection.getFields())).not.toContain(
      'totalCount',
    );

    expect(schema.getQueryType()!.getFields().cleaner.type.toString()).toBe(
      'Cleaner',
    );
    expect(schema.getQueryType()!.getFields().team.type.toString()).toBe(
      'Team',
    );
  });

  it('does not enable nested cleaners totalCount or leave collections on library cursor/10/50/-1', () => {
    const teamSrc = readFileSync(
      join(__dirname, '../../presentation/graphql/team.type.ts'),
      'utf8',
    );
    expect(teamSrc).toMatch(/@OffsetConnection\(\s*'cleaners'/);
    expect(teamSrc).toMatch(/enableTotalCount:\s*false/);
    expect(teamSrc).toMatch(/enableTotalCount:\s*true/);
    expect(teamSrc).not.toMatch(/maxResultsSize:\s*-1/);
    expect(teamSrc).not.toMatch(/PagingStrategies\.CURSOR/);
  });
});

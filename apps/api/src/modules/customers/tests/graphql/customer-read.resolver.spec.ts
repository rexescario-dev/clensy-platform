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
import { CustomerResolver } from '../../presentation/graphql/customer.resolver';
import { CustomerReadResolver } from '../../presentation/graphql/customer-read.resolver';
import { PropertyResolver } from '../../presentation/graphql/property.resolver';
import { PropertyReadResolver } from '../../presentation/graphql/property-read.resolver';
import { ServiceResolver } from '../../../catalog/presentation/graphql/service.resolver';
import { TeamResolver } from '../../../cleaners/presentation/graphql/team.resolver';
import { BookingReadResolver } from '../../../bookings/presentation/graphql/booking-read.resolver';

type MutationMethod = 'createCustomer' | 'updateCustomer';
type ReadMethod = 'queryMany';

const VIEW_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.ANALYST,
];
const WRITE_ROLES = [Role.OWNER, Role.OPS_MANAGER, Role.CUSTOMER_SUPPORT];

function mutationMethodRef(
  method: MutationMethod,
): (...args: unknown[]) => unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    CustomerResolver.prototype,
    method,
  );
  return descriptor!.value as (...args: unknown[]) => unknown;
}

function readMethodRef(method: ReadMethod): (...args: unknown[]) => unknown {
  let proto: object | null = CustomerReadResolver.prototype;
  while (proto) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, method);
    if (descriptor?.value) {
      return descriptor.value as (...args: unknown[]) => unknown;
    }
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  throw new Error(`Read method ${method} not found on CustomerReadResolver`);
}

describe('Customer GraphQL collections', () => {
  const reflector = new Reflector();

  describe.each([['queryMany', VIEW_ROLES]] as const)(
    '%s',
    (method, expectedRoles) => {
      it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — view matrix`, () => {
        const guards = Reflect.getMetadata(
          GUARDS_METADATA,
          readMethodRef(method),
        ) as unknown[] | undefined;
        expect(guards ?? []).toContain(AuthGuard);
        expect(
          reflector.get<Role[] | undefined>(ROLES_KEY, readMethodRef(method)),
        ).toEqual(expectedRoles);
      });
    },
  );

  describe.each([
    ['createCustomer', WRITE_ROLES],
    ['updateCustomer', WRITE_ROLES],
  ] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — write matrix`, () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        mutationMethodRef(method),
      ) as unknown[] | undefined;
      expect(guards ?? []).toContain(AuthGuard);
      expect(
        reflector.get<Role[] | undefined>(
          ROLES_KEY,
          mutationMethodRef(method),
        ),
      ).toEqual(expectedRoles);
    });
  });

  async function buildSchema() {
    const moduleRef = await Test.createTestingModule({
      imports: [GraphQLSchemaBuilderModule],
    }).compile();
    const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
    return schemaFactory.create([
      CustomerReadResolver,
      CustomerResolver,
      PropertyReadResolver,
      PropertyResolver,
      BookingReadResolver,
      ServiceResolver,
      TeamResolver,
    ]);
  }

  it('exposes customers as a root connection with totalCount and nested properties without totalCount', async () => {
    const schema = await buildSchema();

    const customersQuery = schema.getQueryType()!.getFields().customers;
    expect(customersQuery.type.toString()).toBe('CustomerConnection!');
    expect(customersQuery.args.map((arg) => arg.name)).toEqual(
      expect.arrayContaining(['paging']),
    );
    const pagingArg = customersQuery.args.find((arg) => arg.name === 'paging');
    expect(pagingArg?.type.toString()).toMatch(/OffsetPaging/);
    expect(pagingArg?.defaultValue).toEqual({
      limit: PLATFORM_PAGE_DEFAULT,
    });

    const customerConnection = schema.getType(
      'CustomerConnection',
    ) as GraphQLObjectType;
    expect(Object.keys(customerConnection.getFields()).sort()).toEqual(
      ['nodes', 'pageInfo', 'totalCount'].sort(),
    );

    const customerType = schema.getType('Customer') as GraphQLObjectType;
    const propertiesField = customerType.getFields().properties;
    expect(propertiesField.type.toString()).toMatch(/Connection!$/);
    expect(propertiesField.args.map((arg) => arg.name)).toContain('paging');
    const nestedTypeName = propertiesField.type.toString().replace(/!$/, '');
    const nestedConnection = schema.getType(
      nestedTypeName,
    ) as GraphQLObjectType;
    expect(Object.keys(nestedConnection.getFields())).toEqual(
      expect.arrayContaining(['nodes', 'pageInfo']),
    );
    expect(Object.keys(nestedConnection.getFields())).not.toContain(
      'totalCount',
    );

    const customerQuery = schema.getQueryType()!.getFields().customer;
    expect(customerQuery.type.toString()).toBe('Customer');
    expect(schema.getQueryType()!.getFields().properties).toBeUndefined();

    const customerProperties =
      schema.getQueryType()!.getFields().customerProperties;
    expect(customerProperties.type.toString()).toMatch(/Connection!$/);
    expect(customerProperties.args.map((arg) => arg.name)).toEqual(
      expect.arrayContaining(['customerId', 'paging']),
    );
    const rootPropertyTypeName = customerProperties.type
      .toString()
      .replace(/!$/, '');
    expect(rootPropertyTypeName).not.toBe(nestedTypeName);
    const rootPropertyConnection = schema.getType(
      rootPropertyTypeName,
    ) as GraphQLObjectType;
    expect(Object.keys(rootPropertyConnection.getFields()).sort()).toEqual(
      ['nodes', 'pageInfo', 'totalCount'].sort(),
    );
  });

  it('does not enable nested properties totalCount or leave collections on library cursor/10/50/-1', () => {
    const customerSrc = readFileSync(
      join(__dirname, '../../presentation/graphql/customer.type.ts'),
      'utf8',
    );
    expect(customerSrc).toMatch(/@OffsetConnection\(\s*'properties'/);
    expect(customerSrc).toMatch(/enableTotalCount:\s*false/);
    expect(customerSrc).toMatch(/enableTotalCount:\s*true/);
    expect(customerSrc).not.toMatch(/maxResultsSize:\s*-1/);
    expect(customerSrc).not.toMatch(/PagingStrategies\.CURSOR/);
  });
});

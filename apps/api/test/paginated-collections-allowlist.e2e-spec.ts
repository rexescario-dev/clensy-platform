import { INestApplication } from '@nestjs/common';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import {
  GraphQLEnumType,
  GraphQLObjectType,
  GraphQLSchema,
  isObjectType,
} from 'graphql';
import { App } from 'supertest/types';
import { AppModule } from '../src/app/app.module';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import { PLATFORM_PAGE_DEFAULT } from '../src/platform/graphql/paging';

const ROOT_CONNECTIONS: Array<{
  field: string;
  connection: string;
  sortFields: string;
  sortColumns: string[];
}> = [
  {
    field: 'bookings',
    connection: 'BookingConnection',
    sortFields: 'BookingSortFields',
    sortColumns: ['scheduledAt', 'id'],
  },
  {
    field: 'customers',
    connection: 'CustomerConnection',
    sortFields: 'CustomerSortFields',
    sortColumns: ['createdAt', 'id'],
  },
  {
    field: 'customerProperties',
    connection: 'PropertyConnection',
    sortFields: 'PropertySortFields',
    sortColumns: ['createdAt', 'id'],
  },
  {
    field: 'cleaners',
    connection: 'CleanerConnection',
    sortFields: 'CleanerSortFields',
    sortColumns: ['createdAt', 'id'],
  },
  {
    field: 'teams',
    connection: 'TeamConnection',
    sortFields: 'TeamSortFields',
    sortColumns: ['createdAt', 'id'],
  },
  {
    field: 'services',
    connection: 'ServiceConnection',
    sortFields: 'ServiceSortFields',
    sortColumns: ['createdAt', 'id'],
  },
  {
    field: 'addOns',
    connection: 'AddOnConnection',
    sortFields: 'AddOnSortFields',
    sortColumns: ['createdAt', 'id'],
  },
  {
    field: 'jobs',
    connection: 'CleaningJobConnection',
    sortFields: 'CleaningJobSortFields',
    sortColumns: ['scheduledAt', 'id'],
  },
];

const NESTED_CONNECTIONS: Array<{
  parent: string;
  field: string;
  sortFields: string;
  sortColumns: string[];
}> = [
  {
    parent: 'Customer',
    field: 'properties',
    sortFields: 'PropertySortFields',
    sortColumns: ['createdAt', 'id'],
  },
  {
    parent: 'Property',
    field: 'bookings',
    sortFields: 'BookingSortFields',
    sortColumns: ['scheduledAt', 'id'],
  },
  {
    parent: 'Team',
    field: 'cleaners',
    sortFields: 'CleanerSortFields',
    sortColumns: ['createdAt', 'id'],
  },
  {
    parent: 'Checklist',
    field: 'items',
    sortFields: 'ChecklistItemSortFields',
    sortColumns: ['position', 'id'],
  },
];

const GENERATED_CRUD = /^(create|update|delete)(One|Many)[A-Z]/;
const GENERATED_RELATION = /^(add|set|remove)[A-Z].+(To|On|From)[A-Z]/;

function connectionType(
  schema: GraphQLSchema,
  typeName: string,
): GraphQLObjectType {
  const type = schema.getType(typeName);
  expect(type).toBeDefined();
  expect(isObjectType(type)).toBe(true);
  return type as GraphQLObjectType;
}

function enumValues(schema: GraphQLSchema, typeName: string): string[] {
  const type = schema.getType(typeName) as GraphQLEnumType | undefined;
  expect(type).toBeDefined();
  return type!.getValues().map((value) => value.name);
}

describe('paginated collection schema allowlist (Task 8)', () => {
  let app: INestApplication<App>;
  let schema: GraphQLSchema;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyPlatformPipes(app);
    await app.init();
    schema = app.get(GraphQLSchemaHost).schema;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('exposes every §4.2 root as an offset connection with totalCount and paging', () => {
    const queryFields = schema.getQueryType()!.getFields();
    for (const row of ROOT_CONNECTIONS) {
      const field = queryFields[row.field];
      expect(field).toBeDefined();
      expect(field.type.toString()).toBe(`${row.connection}!`);
      expect(field.args.map((arg) => arg.name).sort()).toEqual(
        expect.arrayContaining(['paging']),
      );
      const paging = field.args.find((arg) => arg.name === 'paging');
      expect(paging?.type.toString()).toMatch(/OffsetPaging/);
      expect(paging?.defaultValue).toEqual({ limit: PLATFORM_PAGE_DEFAULT });

      const connection = connectionType(schema, row.connection);
      expect(Object.keys(connection.getFields()).sort()).toEqual(
        ['nodes', 'pageInfo', 'totalCount'].sort(),
      );
      expect(connection.getFields()).not.toHaveProperty('edges');
    }
  });

  it('exposes every §4.2 nest as an offset connection without totalCount', () => {
    for (const row of NESTED_CONNECTIONS) {
      const parent = connectionType(schema, row.parent);
      const field = parent.getFields()[row.field];
      expect(field).toBeDefined();
      expect(field.type.toString()).toMatch(/Connection!$/);
      expect(field.type.toString()).not.toMatch(/^\[/);
      expect(field.args.map((arg) => arg.name)).toContain('paging');
      const paging = field.args.find((arg) => arg.name === 'paging');
      expect(paging?.type.toString()).toMatch(/OffsetPaging/);
      expect(paging?.defaultValue).toEqual({ limit: PLATFORM_PAGE_DEFAULT });

      const nestedTypeName = field.type.toString().replace(/!$/, '');
      const nested = connectionType(schema, nestedTypeName);
      const nestedFields = Object.keys(nested.getFields()).sort();
      expect(nestedFields).toEqual(expect.arrayContaining(['nodes', 'pageInfo']));
      expect(nestedFields).not.toContain('totalCount');
      expect(nestedFields).not.toContain('edges');
    }
  });

  it('accepts default-sort columns as generated SortFields', () => {
    for (const row of ROOT_CONNECTIONS) {
      expect(enumValues(schema, row.sortFields)).toEqual(
        expect.arrayContaining(row.sortColumns),
      );
    }
    for (const row of NESTED_CONNECTIONS) {
      expect(enumValues(schema, row.sortFields)).toEqual(
        expect.arrayContaining(row.sortColumns),
      );
    }
  });

  it('keeps leftover array collections and generated CRUD off the schema', () => {
    const queryFields = schema.getQueryType()!.getFields();
    expect(queryFields.allBookings).toBeUndefined();
    expect(queryFields.properties).toBeUndefined();
    expect(queryFields.checklists).toBeUndefined();
    expect(queryFields.pricings).toBeUndefined();

    for (const name of [
      'customers',
      'customerProperties',
      'cleaners',
      'teams',
      'services',
      'addOns',
      'jobs',
      'bookings',
    ]) {
      expect(queryFields[name].type.toString()).not.toMatch(/^\[/);
    }

    expect(queryFields.admins.type.toString()).toBe('[Admin!]!');
    expect(queryFields.customer.type.toString()).toBe('Customer');
    expect(queryFields.property.type.toString()).toBe('Property');
    expect(queryFields.cleaner.type.toString()).toBe('Cleaner');
    expect(queryFields.team.type.toString()).toBe('Team');
    expect(queryFields.service.type.toString()).toBe('Service');
    expect(queryFields.job.type.toString()).toBe('CleaningJob');
    expect(queryFields.booking.type.toString()).toBe('Booking!');
    expect(queryFields.addOn).toBeUndefined();

    expect(schema.getType('PageInfo')).toBeUndefined();
    expect(schema.getType('CursorPaging')).toBeUndefined();
    expect(schema.getType('OffsetPageInfo')).toBeDefined();

    const mutationNames = Object.keys(schema.getMutationType()!.getFields());
    for (const name of mutationNames) {
      expect(name).not.toMatch(GENERATED_CRUD);
      expect(name).not.toMatch(GENERATED_RELATION);
    }
  });
});

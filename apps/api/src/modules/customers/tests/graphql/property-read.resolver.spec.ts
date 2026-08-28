import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GraphQLObjectType } from 'graphql';
import { PLATFORM_PAGE_DEFAULT } from '../../../../platform/graphql/paging';
import { CustomerResolver } from '../../presentation/graphql/customer.resolver';
import { PropertyResolver } from '../../presentation/graphql/property.resolver';
import { PropertyReadResolver } from '../../presentation/graphql/property-read.resolver';
import { ServiceResolver } from '../../../catalog/presentation/graphql/service.resolver';
import { TeamResolver } from '../../../cleaners/presentation/graphql/team.resolver';
import { BookingReadResolver } from '../../../bookings/presentation/graphql/booking-read.resolver';
import { BookingMutationResolver } from '../../../bookings/presentation/graphql/booking.resolver';

describe('Property.bookings nested connection (Task 3 hard gate)', () => {
  async function buildSchema() {
    const moduleRef = await Test.createTestingModule({
      imports: [GraphQLSchemaBuilderModule],
    }).compile();
    const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
    return schemaFactory.create([
      PropertyReadResolver,
      PropertyResolver,
      CustomerResolver,
      BookingReadResolver,
      BookingMutationResolver,
      ServiceResolver,
      TeamResolver,
    ]);
  }

  it('exposes Property.bookings as a non-null offset connection without totalCount, while root BookingConnection keeps totalCount', async () => {
    const schema = await buildSchema();

    const propertyType = schema.getType('Property') as GraphQLObjectType;
    expect(propertyType).toBeDefined();
    const bookingsField = propertyType.getFields().bookings;
    expect(bookingsField).toBeDefined();
    expect(bookingsField.type.toString()).toMatch(/Connection!$/);
    expect(bookingsField.type.toString()).not.toMatch(/^\[/);

    const argNames = bookingsField.args.map((arg) => arg.name);
    expect(argNames).toContain('paging');
    const pagingArg = bookingsField.args.find((arg) => arg.name === 'paging');
    expect(pagingArg?.type.toString()).toMatch(/OffsetPaging/);
    expect(pagingArg?.defaultValue).toEqual({
      limit: PLATFORM_PAGE_DEFAULT,
    });

    const nestedTypeName = bookingsField.type.toString().replace(/!$/, '');
    const nestedConnection = schema.getType(
      nestedTypeName,
    ) as GraphQLObjectType;
    expect(nestedConnection).toBeDefined();
    const nestedFields = Object.keys(nestedConnection.getFields()).sort();
    expect(nestedFields).toEqual(expect.arrayContaining(['nodes', 'pageInfo']));
    expect(nestedFields).not.toContain('totalCount');
    expect(nestedFields).not.toContain('edges');

    const bookingsQuery = schema.getQueryType()!.getFields().bookings;
    expect(bookingsQuery.type.toString()).toBe('BookingConnection!');
    const rootConnection = schema.getType(
      'BookingConnection',
    ) as GraphQLObjectType;
    expect(Object.keys(rootConnection.getFields()).sort()).toEqual(
      ['nodes', 'pageInfo', 'totalCount'].sort(),
    );

    const propertyQuery = schema.getQueryType()!.getFields().property;
    expect(propertyQuery.type.toString()).toBe('Property');
    expect(schema.getQueryType()!.getFields().properties).toBeUndefined();
    expect(schema.getQueryType()!.getFields().allBookings).toBeUndefined();
  });

  it('does not enable nested totalCount or leave the nest on library cursor/10/50/-1', () => {
    const dtoSrc = readFileSync(
      join(__dirname, '../../presentation/graphql/property.type.ts'),
      'utf8',
    );
    expect(dtoSrc).toMatch(/@OffsetConnection\(\s*'bookings'/);
    expect(dtoSrc).toMatch(/enableTotalCount:\s*false/);
    expect(dtoSrc).toMatch(/defaultResultSize:\s*PLATFORM_PAGE_DEFAULT/);
    expect(dtoSrc).toMatch(/maxResultsSize:\s*PLATFORM_PAGE_MAX/);
    expect(dtoSrc).not.toMatch(/maxResultsSize:\s*-1/);
    expect(dtoSrc).not.toMatch(/PagingStrategies\.CURSOR/);
    expect(dtoSrc).not.toMatch(/defaultResultSize:\s*10\b/);
    expect(dtoSrc).not.toMatch(/maxResultsSize:\s*50\b/);

    const readSrc = readFileSync(
      join(__dirname, '../../presentation/graphql/property-read.resolver.ts'),
      'utf8',
    );
    expect(readSrc).toMatch(/enableTotalCount:\s*false/);
    expect(readSrc).toMatch(/one:\s*\{\s*disabled:\s*true/);
    expect(readSrc).toMatch(/many:\s*\{\s*disabled:\s*true/);
  });

  it('does not register BookingEntity on CustomersModule forFeature', () => {
    const src = readFileSync(
      join(__dirname, '../../customers.module.ts'),
      'utf8',
    )
      .split('\n')
      .filter((line) => !/^\s*\/\//.test(line))
      .join('\n');
    expect(src).not.toMatch(/BookingEntity/);
  });

  it('application/domain layers do not read or assign Property.bookings', () => {
    const roots = [
      join(__dirname, '../../domain'),
      join(__dirname, '../../application'),
    ];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (full.endsWith('.ts')) {
          files.push(full);
        }
      }
    };
    for (const root of roots) {
      walk(root);
    }

    const relationProp = /\b(?:property|entity|existing|row|record)\.bookings\b/;
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|import\s)/.test(line))
        .join('\n');
      expect(src).not.toMatch(relationProp);
    }
  });
});

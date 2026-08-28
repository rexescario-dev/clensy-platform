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
import { CustomerResolver } from '../../../customers/presentation/graphql/customer.resolver';
import { PropertyResolver } from '../../../customers/presentation/graphql/property.resolver';
import { ServiceResolver } from '../../../catalog/presentation/graphql/service.resolver';
import { PropertyReadResolver } from '../../../customers/presentation/graphql/property-read.resolver';
import { ServiceReadResolver } from '../../../catalog/presentation/graphql/service-read.resolver';
import { TeamReadResolver } from '../../../cleaners/presentation/graphql/team-read.resolver';
import { TeamResolver } from '../../../cleaners/presentation/graphql/team.resolver';
import { BookingReadResolver } from '../../../bookings/presentation/graphql/booking-read.resolver';
import { BookingMutationResolver } from '../../../bookings/presentation/graphql/booking.resolver';
import { ChecklistReadResolver } from '../../presentation/graphql/checklist-read.resolver';
import { JobReadResolver } from '../../presentation/graphql/job-read.resolver';
import { JobResolver } from '../../presentation/graphql/job.resolver';

type ResolverMethod =
  | 'job'
  | 'createJobFromBooking'
  | 'assignTeamToJob'
  | 'completeChecklistItem'
  | 'completeJob';

const VIEW_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];
const CREATE_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
];
const EXECUTE_ROLES = [Role.OWNER, Role.OPS_MANAGER, Role.SCHEDULER];

function methodRef(method: ResolverMethod): (...args: unknown[]) => unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    JobResolver.prototype,
    method,
  );
  return descriptor!.value as (...args: unknown[]) => unknown;
}

describe('JobResolver', () => {
  const reflector = new Reflector();

  function guardsOn(method: ResolverMethod): unknown[] {
    const guards = Reflect.getMetadata(GUARDS_METADATA, methodRef(method)) as
      unknown[] | undefined;
    return guards ?? [];
  }

  function rolesOn(method: ResolverMethod): Role[] | undefined {
    return reflector.get<Role[] | undefined>(ROLES_KEY, methodRef(method));
  }

  describe.each([['job', VIEW_ROLES]] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — view matrix`, () => {
      expect(guardsOn(method)).toContain(AuthGuard);
      expect(rolesOn(method)).toEqual(expectedRoles);
    });
  });

  it('createJobFromBooking is guarded by AuthGuard and the create matrix (includes CS)', () => {
    expect(guardsOn('createJobFromBooking')).toContain(AuthGuard);
    expect(rolesOn('createJobFromBooking')).toEqual(CREATE_ROLES);
  });

  describe.each([
    ['assignTeamToJob', EXECUTE_ROLES],
    ['completeChecklistItem', EXECUTE_ROLES],
    ['completeJob', EXECUTE_ROLES],
  ] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — execute matrix`, () => {
      expect(guardsOn(method)).toContain(AuthGuard);
      expect(rolesOn(method)).toEqual(expectedRoles);
    });
  });

  describe('schema', () => {
    it('exposes exactly the six Jobs operations and the specified CleaningJob/Checklist nullability', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [GraphQLSchemaBuilderModule],
      }).compile();
      const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
      const schema = await schemaFactory.create([
        JobReadResolver,
        JobResolver,
        ChecklistReadResolver,
        BookingReadResolver,
        BookingMutationResolver,
        CustomerResolver,
        PropertyReadResolver,
        PropertyResolver,
        ServiceReadResolver,
        ServiceResolver,
        TeamReadResolver,
        TeamResolver,
      ]);

      const queryFields = Object.keys(schema.getQueryType()!.getFields());
      expect(
        queryFields.filter((name) => name === 'job' || name === 'jobs').sort(),
      ).toEqual(['job', 'jobs']);
      expect(schema.getQueryType()!.getFields().job.type.toString()).toBe(
        'CleaningJob',
      );
      expect(schema.getQueryType()!.getFields().jobs.type.toString()).toBe(
        'CleaningJobConnection!',
      );
      expect(
        schema.getQueryType()!.getFields().jobs.args.map((arg) => arg.name),
      ).toEqual(expect.arrayContaining(['paging', 'filter']));
      const filterArg = schema
        .getQueryType()!
        .getFields()
        .jobs.args.find((arg) => arg.name === 'filter');
      expect(filterArg?.type.toString()).toMatch(/CleaningJobFilter/);

      const jobConnection = schema.getType(
        'CleaningJobConnection',
      ) as GraphQLObjectType;
      expect(Object.keys(jobConnection.getFields()).sort()).toEqual(
        ['nodes', 'pageInfo', 'totalCount'].sort(),
      );

      const mutationFields = Object.keys(schema.getMutationType()!.getFields());
      const jobsMutations = mutationFields.filter((name) =>
        [
          'createJobFromBooking',
          'assignTeamToJob',
          'completeChecklistItem',
          'completeJob',
        ].includes(name),
      );
      expect(jobsMutations.sort()).toEqual(
        [
          'assignTeamToJob',
          'completeChecklistItem',
          'completeJob',
          'createJobFromBooking',
        ].sort(),
      );
      for (const name of jobsMutations) {
        expect(
          schema.getMutationType()!.getFields()[name].type.toString(),
        ).toBe('CleaningJob!');
      }

      const jobType = schema.getType('CleaningJob') as GraphQLObjectType;
      const fieldNames = Object.keys(jobType.getFields()).sort();
      expect(fieldNames).toEqual(
        [
          'id',
          'scheduledAt',
          'status',
          'createdAt',
          'updatedAt',
          'booking',
          'team',
          'checklist',
        ].sort(),
      );
      expect(fieldNames).not.toContain('bookingId');
      expect(fieldNames).not.toContain('teamId');
      expect(jobType.getFields().booking.type.toString()).toBe('Booking!');
      expect(jobType.getFields().team.type.toString()).toBe('Team');
      expect(jobType.getFields().checklist.type.toString()).toBe('Checklist!');

      const checklistType = schema.getType('Checklist') as GraphQLObjectType;
      const itemsField = checklistType.getFields().items;
      expect(itemsField.type.toString()).toMatch(/Connection!$/);
      expect(itemsField.args.map((arg) => arg.name)).toContain('paging');
      const nestedItemsType = schema.getType(
        itemsField.type.toString().replace(/!$/, ''),
      ) as GraphQLObjectType;
      expect(Object.keys(nestedItemsType.getFields())).toEqual(
        expect.arrayContaining(['nodes', 'pageInfo']),
      );
      expect(Object.keys(nestedItemsType.getFields())).not.toContain(
        'totalCount',
      );

      const itemType = schema.getType('ChecklistItem') as GraphQLObjectType;
      expect(itemType.getFields().completedAt.type.toString()).toBe('DateTime');
    });
  });
});

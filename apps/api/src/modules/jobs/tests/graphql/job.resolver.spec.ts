import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GraphQLObjectType } from 'graphql';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
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
  | 'assignTeamToJob'
  | 'completeChecklistItem'
  | 'completeJob'
  | 'createJobFromBooking'
  | 'job';

const VIEW_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];
const CREATE_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
];
const EXECUTE_ROLES = [Role.TENANT_OWNER, Role.OPS_MANAGER, Role.SCHEDULER];

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

  describe.each([['job', VIEW_ROLES]] as const)(
    '%s',
    (method, expectedRoles) => {
      it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — view matrix`, () => {
        expect(guardsOn(method)).toContain(AuthGuard);
        expect(rolesOn(method)).toEqual(expectedRoles);
      });
    },
  );

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
        schema
          .getQueryType()!
          .getFields()
          .jobs.args.map((arg) => arg.name),
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

// Tenant isolation (#83 Slice decision 6): the tenant comes only from the
// DB-loaded principal, never from GraphQL input or the parent row.
describe('JobResolver tenant scoping', () => {
  const principal: AuthenticatedPrincipal = {
    id: 'u',
    tenantId: 't-a',
    role: Role.OPS_MANAGER,
    scope: AdminScope.TENANT,
  };

  it('assignTeamToJob passes requireTenantId(principal)', async () => {
    const jobsService = {
      assignTeam: jest.fn().mockResolvedValue({
        id: 'job-1',
        bookingId: 'booking-1',
        teamId: 'team-a',
        createdAt: new Date(),
        scheduledAt: new Date(),
        status: 'PENDING',
        updatedAt: new Date(),
      }),
    };
    const loaders = { teamLoaderFor: jest.fn() };
    const resolver = new JobResolver(jobsService as never, loaders as never);

    await resolver.assignTeamToJob(
      { jobId: 'j-1', teamId: 'team-a' },
      principal,
    );

    expect(jobsService.assignTeam).toHaveBeenCalledWith({
      actorId: 'u',
      jobId: 'j-1',
      teamId: 'team-a',
      tenantId: 't-a',
    });
  });

  it('createJobFromBooking passes requireTenantId(principal)', async () => {
    const jobsService = {
      createFromBooking: jest.fn().mockResolvedValue({
        id: 'job-1',
        bookingId: 'booking-1',
        teamId: 'team-a',
        createdAt: new Date(),
        scheduledAt: new Date(),
        status: 'PENDING',
        updatedAt: new Date(),
      }),
    };
    const loaders = { teamLoaderFor: jest.fn() };
    const resolver = new JobResolver(jobsService as never, loaders as never);

    await resolver.createJobFromBooking({ bookingId: 'booking-1' }, principal);

    expect(jobsService.createFromBooking).toHaveBeenCalledWith({
      actorId: 'u',
      bookingId: 'booking-1',
      tenantId: 't-a',
    });
  });

  // Defense in depth (#85 Slice decision 11 / require-tenant-id.ts):
  // `createJobFromBooking` sits behind `@Roles(...CREATE_ROLES)`, which
  // excludes SUPER_ADMIN — the only role that can carry `tenantId: null`.
  // A null tenant here is unreachable in practice; this guards against
  // that invariant breaking silently, mirroring booking.resolver.spec.ts.
  it('createJobFromBooking is forbidden without a principal tenant', async () => {
    const jobsService = { createFromBooking: jest.fn() };
    const loaders = { teamLoaderFor: jest.fn() };
    const resolver = new JobResolver(jobsService as never, loaders as never);
    const noTenant: AuthenticatedPrincipal = {
      id: 'u',
      tenantId: null,
      role: Role.TENANT_OWNER,
      scope: AdminScope.PLATFORM,
    };

    await expect(
      resolver.createJobFromBooking({ bookingId: 'booking-1' }, noTenant),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(jobsService.createFromBooking).not.toHaveBeenCalled();
  });

  const jobRow = {
    id: 'job-1',
    tenantId: 't-a',
    bookingId: 'booking-1',
    teamId: null,
    createdAt: new Date(),
    scheduledAt: new Date(),
    status: 'PENDING',
    updatedAt: new Date(),
  };
  const noTenant: AuthenticatedPrincipal = {
    id: 'u',
    tenantId: null,
    role: Role.TENANT_OWNER,
    scope: AdminScope.PLATFORM,
  };

  // #86 Slice decision 5: nullable read, #83 `team(id)` precedent.
  it("job(id) looks the job up in the caller's tenant", async () => {
    const jobsService = { getJob: jest.fn().mockResolvedValue(null) };
    const resolver = new JobResolver(jobsService as never, {} as never);

    await expect(resolver.job('job-1', principal)).resolves.toBeNull();
    expect(jobsService.getJob).toHaveBeenCalledWith('job-1', 't-a');
  });

  it('job(id) passes a null tenant through (the service returns null)', async () => {
    const jobsService = { getJob: jest.fn().mockResolvedValue(null) };
    const resolver = new JobResolver(jobsService as never, {} as never);

    await expect(resolver.job('job-1', noTenant)).resolves.toBeNull();
    expect(jobsService.getJob).toHaveBeenCalledWith('job-1', null);
  });

  it('completeChecklistItem passes requireTenantId(principal)', async () => {
    const jobsService = {
      completeChecklistItem: jest.fn().mockResolvedValue(jobRow),
    };
    const resolver = new JobResolver(jobsService as never, {} as never);

    await resolver.completeChecklistItem(
      { jobId: 'job-1', itemId: 'item-1' },
      principal,
    );

    expect(jobsService.completeChecklistItem).toHaveBeenCalledWith({
      actorId: 'u',
      itemId: 'item-1',
      jobId: 'job-1',
      tenantId: 't-a',
    });
  });

  it('completeJob passes requireTenantId(principal)', async () => {
    const jobsService = { completeJob: jest.fn().mockResolvedValue(jobRow) };
    const resolver = new JobResolver(jobsService as never, {} as never);

    await resolver.completeJob({ id: 'job-1' }, principal);

    expect(jobsService.completeJob).toHaveBeenCalledWith({
      actorId: 'u',
      jobId: 'job-1',
      tenantId: 't-a',
    });
  });

  // Defense in depth (#86 Slice decision 9 / require-tenant-id.ts), as for
  // createJobFromBooking above.
  it.each([
    [
      'assignTeamToJob',
      'assignTeam',
      (r: JobResolver) =>
        r.assignTeamToJob({ jobId: 'job-1', teamId: 'team-a' }, noTenant),
    ],
    [
      'completeChecklistItem',
      'completeChecklistItem',
      (r: JobResolver) =>
        r.completeChecklistItem({ jobId: 'job-1', itemId: 'i' }, noTenant),
    ],
    [
      'completeJob',
      'completeJob',
      (r: JobResolver) => r.completeJob({ id: 'job-1' }, noTenant),
    ],
  ] as const)(
    '%s is forbidden without a principal tenant',
    async (_name, serviceMethod, call) => {
      const jobsService = { [serviceMethod]: jest.fn() };
      const resolver = new JobResolver(jobsService as never, {} as never);

      await expect(call(resolver)).rejects.toBeInstanceOf(ForbiddenException);
      expect(jobsService[serviceMethod]).not.toHaveBeenCalled();
    },
  );

  // #86 Slice decision 5: the checklist loader is per tenant, the tenant
  // taken from the principal (never the parent row).
  it("CleaningJob.checklist uses the checklist loader for the caller's tenant", async () => {
    const load = jest.fn().mockResolvedValue({
      id: 'c-1',
      jobId: 'job-1',
      tenantId: 't-a',
      createdAt: new Date(),
    });
    const loaders = { checklistLoaderFor: jest.fn().mockReturnValue({ load }) };
    const resolver = new JobResolver({} as never, loaders as never);

    await expect(resolver.checklist({ id: 'job-1' }, principal)).resolves.toEqual(
      { id: 'c-1' },
    );
    expect(loaders.checklistLoaderFor).toHaveBeenCalledWith('t-a');
    expect(load).toHaveBeenCalledWith('job-1');
  });

  it('CleaningJob.checklist with no principal uses the null-tenant loader', async () => {
    const load = jest.fn().mockResolvedValue({ id: 'c-1' });
    const loaders = { checklistLoaderFor: jest.fn().mockReturnValue({ load }) };
    const resolver = new JobResolver({} as never, loaders as never);

    await resolver.checklist({ id: 'job-1' }, undefined);
    expect(loaders.checklistLoaderFor).toHaveBeenCalledWith(null);
  });

  it('CleaningJob.team uses the loader for the caller tenant', async () => {
    const jobsService = {};
    const load = jest.fn().mockResolvedValue(null);
    const loaders = { teamLoaderFor: jest.fn().mockReturnValue({ load }) };
    const resolver = new JobResolver(jobsService as never, loaders as never);

    await expect(
      resolver.team({ teamId: 'team-a' }, principal),
    ).resolves.toBeNull();

    expect(loaders.teamLoaderFor).toHaveBeenCalledWith('t-a');
    expect(load).toHaveBeenCalledWith('team-a');
  });

  it('CleaningJob.team with no principal uses the null-tenant loader', async () => {
    const jobsService = {};
    const load = jest.fn().mockResolvedValue(null);
    const loaders = { teamLoaderFor: jest.fn().mockReturnValue({ load }) };
    const resolver = new JobResolver(jobsService as never, loaders as never);

    await resolver.team({ teamId: 'team-a' }, undefined);

    expect(loaders.teamLoaderFor).toHaveBeenCalledWith(null);
    expect(load).toHaveBeenCalledWith('team-a');
  });
});

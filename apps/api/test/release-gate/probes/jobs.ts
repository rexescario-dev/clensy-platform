import { JobStatus } from '../../../src/modules/jobs/domain/job-status';
import { gqlCall, Prepared, Probe } from '../probe';
import type { Fixtures, TenantWorld } from '../two-tenant-world';
import { connectionProbe, getByIdProbe } from './shapes';

const CREATE_FROM_BOOKING = `mutation Gate($input: CreateJobFromBookingInput!) { createJobFromBooking(input: $input) { id } }`;
const ASSIGN_TEAM = `mutation Gate($input: AssignTeamToJobInput!) { assignTeamToJob(input: $input) { id } }`;
const COMPLETE_ITEM = `mutation Gate($input: CompleteChecklistItemInput!) { completeChecklistItem(input: $input) { id } }`;
const COMPLETE_JOB = `mutation Gate($input: CompleteJobInput!) { completeJob(input: $input) { id } }`;

// Fresh jobs per call: execution mutations change job state (Jobs §4.1).
const freshJob =
  (options: { itemsCompleted: boolean; status?: JobStatus }) =>
  async (fixtures: Fixtures, tenant: TenantWorld): Promise<Prepared> => {
    const { itemIds, jobId } = await fixtures.job(tenant, options);
    return { itemId: itemIds[0], jobId };
  };

export const JOB_PROBES: readonly Probe[] = [
  getByIdProbe({
    id: (t) => t.jobId,
    field: 'job',
    key: 'Query.job',
    missing: { kind: 'null' },
  }),
  connectionProbe({
    id: (t) => t.jobId,
    field: 'jobs',
    filterType: 'CleaningJobFilter',
    key: 'Query.jobs',
    table: 'cleaning_job_entity',
  }),
  {
    crossTenant: [
      {
        call: ({ foreign }) =>
          gqlCall('createJobFromBooking', CREATE_FROM_BOOKING, {
            input: { bookingId: foreign[0] },
          }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.bookingId],
        missing: { kind: 'error', status: 404 },
        name: 'reference bookingId belongs to the other tenant',
      },
    ],
    key: 'Mutation.createJobFromBooking',
    ok: { kind: 'createdInOwnTenant', table: 'cleaning_job_entity' },
    prepare: async (fixtures, tenant) => ({
      bookingId: await fixtures.booking(tenant),
    }),
    sameTenant: ({ prepared }) =>
      gqlCall('createJobFromBooking', CREATE_FROM_BOOKING, {
        input: { bookingId: prepared.bookingId },
      }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign, own }) =>
          gqlCall('assignTeamToJob', ASSIGN_TEAM, {
            input: { jobId: foreign[0], teamId: own.teamId },
          }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.jobId],
        missing: { kind: 'error', status: 404 },
        name: 'target jobId belongs to the other tenant',
      },
      {
        call: ({ foreign, prepared }) =>
          gqlCall('assignTeamToJob', ASSIGN_TEAM, {
            input: { jobId: prepared.jobId, teamId: foreign[0] },
          }),
        foreignIds: (victim) => [victim.teamId],
        missing: { kind: 'error', status: 404 },
        name: 'reference teamId belongs to the other tenant',
      },
    ],
    key: 'Mutation.assignTeamToJob',
    ok: { id: ({ prepared }) => prepared.jobId, kind: 'returnsId' },
    prepare: freshJob({ itemsCompleted: false }),
    sameTenant: ({ own, prepared }) =>
      gqlCall('assignTeamToJob', ASSIGN_TEAM, {
        input: { jobId: prepared.jobId, teamId: own.teamId },
      }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) =>
          gqlCall('completeChecklistItem', COMPLETE_ITEM, {
            input: { itemId: foreign[1], jobId: foreign[0] },
          }),
        foreignIds: (_victim, preparedVictim) => [
          preparedVictim.jobId,
          preparedVictim.itemId,
        ],
        missing: { kind: 'error', status: 404 },
        name: 'target job and item belong to the other tenant',
      },
      {
        call: ({ foreign, prepared }) =>
          gqlCall('completeChecklistItem', COMPLETE_ITEM, {
            input: { itemId: foreign[0], jobId: prepared.jobId },
          }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.itemId],
        missing: { kind: 'error', status: 404 },
        name: 'reference itemId belongs to the other tenant',
      },
    ],
    key: 'Mutation.completeChecklistItem',
    ok: { id: ({ prepared }) => prepared.jobId, kind: 'returnsId' },
    prepare: freshJob({ itemsCompleted: false }),
    sameTenant: ({ prepared }) =>
      gqlCall('completeChecklistItem', COMPLETE_ITEM, {
        input: { itemId: prepared.itemId, jobId: prepared.jobId },
      }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) =>
          gqlCall('completeJob', COMPLETE_JOB, { input: { id: foreign[0] } }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.jobId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
    ],
    key: 'Mutation.completeJob',
    ok: { id: ({ prepared }) => prepared.jobId, kind: 'returnsId' },
    // Jobs §4.1: CompleteJob needs IN_PROGRESS with every item complete.
    prepare: freshJob({
      itemsCompleted: true,
      status: JobStatus.IN_PROGRESS,
    }),
    sameTenant: ({ prepared }) =>
      gqlCall('completeJob', COMPLETE_JOB, { input: { id: prepared.jobId } }),
  },
];

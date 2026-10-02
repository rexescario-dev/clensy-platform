import { gqlCall, Probe } from '../probe';
import { connectionProbe, getByIdProbe } from './shapes';

const NO_TENANT_INPUT =
  'input carries no tenant-owned id; the tenant comes only from the principal (RFC §4.5), pinned by createdInOwnTenant';
const UPDATE_CLEANER = `mutation Gate($id: ID!, $input: UpdateCleanerInput!) { updateCleaner(id: $id, input: $input) { id } }`;
const ASSIGN = `mutation Gate($cleanerId: ID!, $teamId: ID!) { assignCleanerToTeam(cleanerId: $cleanerId, teamId: $teamId) { id } }`;

export const CLEANER_PROBES: readonly Probe[] = [
  getByIdProbe({
    id: (t) => t.teamId,
    field: 'team',
    key: 'Query.team',
    missing: { kind: 'null' },
  }),
  connectionProbe({
    id: (t) => t.teamId,
    field: 'teams',
    filterType: 'TeamFilter',
    key: 'Query.teams',
    table: 'team_entity',
  }),
  getByIdProbe({
    id: (t) => t.cleanerId,
    field: 'cleaner',
    key: 'Query.cleaner',
    missing: { kind: 'null' },
  }),
  connectionProbe({
    id: (t) => t.cleanerId,
    field: 'cleaners',
    filterType: 'CleanerFilter',
    key: 'Query.cleaners',
    table: 'cleaner_entity',
  }),
  {
    crossTenant: [],
    key: 'Mutation.createTeam',
    noCrossTenantInput: NO_TENANT_INPUT,
    ok: { kind: 'createdInOwnTenant', table: 'team_entity' },
    sameTenant: ({ unique }) =>
      gqlCall(
        'createTeam',
        `mutation Gate($input: CreateTeamInput!) { createTeam(input: $input) { id } }`,
        { input: { name: `Gate New Team ${unique}` } },
      ),
  },
  {
    crossTenant: [],
    key: 'Mutation.createCleaner',
    noCrossTenantInput: NO_TENANT_INPUT,
    ok: { kind: 'createdInOwnTenant', table: 'cleaner_entity' },
    sameTenant: ({ unique }) =>
      gqlCall(
        'createCleaner',
        `mutation Gate($input: CreateCleanerInput!) { createCleaner(input: $input) { id } }`,
        {
          input: {
            email: `gate-new-cleaner-${unique}@example.com`,
            fullName: `Gate New Cleaner ${unique}`,
            phone: '555-0103',
          },
        },
      ),
  },
  {
    crossTenant: [
      {
        call: ({ foreign, unique }) =>
          gqlCall('updateCleaner', UPDATE_CLEANER, {
            id: foreign[0],
            input: { notes: `gate ${unique}` },
          }),
        foreignIds: (victim) => [victim.cleanerId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
    ],
    key: 'Mutation.updateCleaner',
    ok: { id: ({ own }) => own.cleanerId, kind: 'returnsId' },
    sameTenant: ({ own, unique }) =>
      gqlCall('updateCleaner', UPDATE_CLEANER, {
        id: own.cleanerId,
        input: { notes: `gate ${unique}` },
      }),
  },
  {
    // Same-team reassignment is an unconditional success (Cleaners & Teams §4.4, M3 round 2).
    crossTenant: [
      {
        call: ({ foreign, own }) =>
          gqlCall('assignCleanerToTeam', ASSIGN, {
            cleanerId: foreign[0],
            teamId: own.teamId,
          }),
        foreignIds: (victim) => [victim.cleanerId],
        missing: { kind: 'error', status: 404 },
        name: 'target cleanerId belongs to the other tenant',
      },
      {
        call: ({ foreign, own }) =>
          gqlCall('assignCleanerToTeam', ASSIGN, {
            cleanerId: own.cleanerId,
            teamId: foreign[0],
          }),
        foreignIds: (victim) => [victim.teamId],
        missing: { kind: 'error', status: 404 },
        name: 'reference teamId belongs to the other tenant',
      },
    ],
    key: 'Mutation.assignCleanerToTeam',
    ok: { id: ({ own }) => own.cleanerId, kind: 'returnsId' },
    sameTenant: ({ own }) =>
      gqlCall('assignCleanerToTeam', ASSIGN, {
        cleanerId: own.cleanerId,
        teamId: own.teamId,
      }),
  },
];

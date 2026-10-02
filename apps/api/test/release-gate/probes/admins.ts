import { Role } from '../../../src/platform/auth/domain/role';
import { gqlCall, Probe } from '../probe';

const DISABLE = `mutation Gate($id: ID!) { disableAdmin(id: $id) { id } }`;
const ADMINS = `query Gate { admins { id } }`;

export const ADMIN_PROBES: readonly Probe[] = [
  {
    // RFC §4.9 example 3: only that tenant's admins — never another
    // tenant's, never the Super Admin. The own-count check catches both.
    crossTenant: [
      {
        call: () => gqlCall('admins', ADMINS, {}),
        foreignIds: (victim) => victim.adminIds,
        missing: { kind: 'excludes', table: 'admin_user_entity' },
        name: 'unfiltered list',
      },
    ],
    key: 'Query.admins',
    ok: {
      id: ({ own }) => own.principals[Role.TENANT_OWNER].id,
      kind: 'listIncludes',
    },
    sameTenant: () => gqlCall('admins', ADMINS, {}),
  },
  {
    crossTenant: [],
    key: 'Mutation.createAdmin',
    noCrossTenantInput:
      "input carries no tenant-owned id; the new admin's tenant comes only from the Tenant Owner principal (RFC §4.3, §4.5), pinned by createdInOwnTenant",
    ok: { kind: 'createdInOwnTenant', table: 'admin_user_entity' },
    sameTenant: ({ unique }) =>
      gqlCall(
        'createAdmin',
        `mutation Gate($input: CreateAdminInput!) { createAdmin(createAdminInput: $input) { id } }`,
        {
          input: {
            email: `gate-staff-${unique}@example.com`,
            password: `gate-${unique}`,
            role: 'SCHEDULER',
          },
        },
      ),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) =>
          gqlCall('disableAdmin', DISABLE, { id: foreign[0] }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.adminId],
        missing: { kind: 'error', status: 404 },
        name: 'target admin belongs to the other tenant',
      },
    ],
    key: 'Mutation.disableAdmin',
    ok: { id: ({ prepared }) => prepared.adminId, kind: 'returnsId' },
    prepare: async (fixtures, tenant) => ({
      adminId: await fixtures.staffAdmin(tenant.tenantId),
    }),
    sameTenant: ({ prepared }) =>
      gqlCall('disableAdmin', DISABLE, { id: prepared.adminId }),
  },
];

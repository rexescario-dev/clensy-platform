import { gqlCall, LIST_PAGE_LIMIT, MissingForm, Probe } from '../probe';
import type { TenantWorld } from '../two-tenant-world';

// get-by-id: one target variant (RFC §4.9 example 1).
export function getByIdProbe(options: {
  field: string;
  id: (tenant: TenantWorld) => string;
  key: string;
  missing: MissingForm;
}): Probe {
  const document = `query Gate($id: ID!) { ${options.field}(id: $id) { id } }`;
  return {
    crossTenant: [
      {
        call: ({ foreign }) =>
          gqlCall(options.field, document, { id: foreign[0] }),
        foreignIds: (victim) => [options.id(victim)],
        missing: options.missing,
        name: 'target id belongs to the other tenant',
      },
    ],
    key: options.key,
    ok: { id: ({ own }) => options.id(own), kind: 'returnsId' },
    sameTenant: ({ own }) =>
      gqlCall(options.field, document, { id: options.id(own) }),
  };
}

// nestjs-query connection: a filter that names the other tenant's id must
// return nothing, and an unfiltered list must exclude it and count only
// own-tenant rows (RFC §4.5 "filters MUST NOT widen"; §4.9 example 2).
export function connectionProbe(options: {
  field: string;
  filterType: string;
  id: (tenant: TenantWorld) => string;
  key: string;
  table: string;
}): Probe {
  const document = `query Gate($filter: ${options.filterType}!) {
    ${options.field}(filter: $filter, paging: { limit: ${LIST_PAGE_LIMIT} }, sorting: []) { totalCount nodes { id } }
  }`;
  return {
    crossTenant: [
      {
        call: ({ foreign }) =>
          gqlCall(options.field, document, { filter: { id: { in: foreign } } }),
        foreignIds: (victim) => [options.id(victim)],
        missing: { kind: 'emptyConnection' },
        name: 'filter asserts the other tenant’s id',
      },
      {
        call: () => gqlCall(options.field, document, { filter: {} }),
        foreignIds: (victim) => [options.id(victim)],
        missing: { kind: 'excludes', table: options.table },
        name: 'unfiltered list',
      },
    ],
    key: options.key,
    ok: { id: ({ own }) => options.id(own), kind: 'listIncludes' },
    sameTenant: ({ own }) =>
      gqlCall(options.field, document, {
        filter: { id: { in: [options.id(own)] } },
      }),
  };
}

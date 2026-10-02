import type { Fixtures, TenantWorld } from './two-tenant-world';

// #92 probe contract (decision 9). One probe per tenant GraphQL operation
// or REST route; the gate's Phase 1b requires probe keys to equal the
// tenant inventory exactly.
export type Call =
  | {
      body?: Record<string, unknown>;
      kind: 'rest';
      method: 'DELETE' | 'GET' | 'PATCH' | 'POST';
      path: string;
    }
  | {
      document: string;
      field: string;
      kind: 'graphql';
      variables: Record<string, unknown>;
    };

// Ids of rows a probe's `prepare` inserted for one call.
export type Prepared = Readonly<Record<string, string>>;

export interface ProbeArgs {
  own: TenantWorld;
  prepared: Prepared;
  unique: string;
}

// `foreign`: the victim ids for the actual call, or fresh random UUIDs
// (same length) for the never-existed control.
export interface VariantArgs extends ProbeArgs {
  foreign: readonly string[];
}

export type OkExpectation =
  | { id: (args: ProbeArgs) => string; kind: 'listIncludes' }
  | { id: (args: ProbeArgs) => string; kind: 'returnsId' }
  | { kind: 'createdInOwnTenant'; table: string };

export type MissingForm =
  | { kind: 'emptyConnection' }
  | { kind: 'error'; status: 400 | 404 }
  | { kind: 'excludes'; table: string }
  | { kind: 'null' };

export interface CrossTenantVariant {
  call: (args: VariantArgs) => Call;
  foreignIds: (victim: TenantWorld, preparedVictim: Prepared) => string[];
  missing: MissingForm;
  name: string;
}

export interface Probe {
  crossTenant: readonly CrossTenantVariant[];
  domainRejected?: { message: RegExp; status: number };
  key: string;
  noCrossTenantInput?: string;
  ok: OkExpectation;
  prepare?: (fixtures: Fixtures, tenant: TenantWorld) => Promise<Prepared>;
  sameTenant: (args: ProbeArgs) => Call;
}

export function gqlCall(
  field: string,
  document: string,
  variables: Record<string, unknown>,
): Call {
  return { document, field, kind: 'graphql', variables };
}

export function restCall(
  method: 'DELETE' | 'GET' | 'PATCH' | 'POST',
  path: string,
  body?: Record<string, unknown>,
): Call {
  return { body, kind: 'rest', method, path };
}

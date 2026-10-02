import { DataSource } from 'typeorm';

// #92 tenant snapshot (decisions 7, 12). Every table with a "tenantId"
// column is discovered from the live schema (so a new tenant-owned table is
// covered automatically); tables without tenantId that reference one by FK
// must be declared as children here, or the fixture check fails closed.
export interface ChildTable {
  column: string;
  parent: string;
  table: string;
}

export const CHILD_TABLES: readonly ChildTable[] = [
  // Owned through its checklist (README: "items are owned through their checklist").
  {
    column: 'checklistId',
    parent: 'checklist_entity',
    table: 'checklist_item_entity',
  },
  // Owned through its invoice (README: "invoice lines are owned through their invoice").
  {
    column: 'invoiceId',
    parent: 'invoice_entity',
    table: 'invoice_line_entity',
  },
];

// Tables the repository-built world cannot populate; a row appearing in one
// is still caught by the snapshot comparison ([] vs [row]).
export const LAZILY_WRITTEN_TABLES: Readonly<Record<string, string>> = {
  audit_event_entity:
    'written only by audited actions; the world is inserted directly',
  invoice_number_counter:
    'created on the first generateInvoiceFromOrder for a tenant',
};

export interface TenantTables {
  children: readonly ChildTable[];
  owned: readonly string[];
  undeclaredChildren: readonly string[];
}

export type TenantSnapshot = Record<string, string[]>;

export async function discoverTenantTables(
  dataSource: DataSource,
): Promise<TenantTables> {
  const owned = (
    await dataSource.query(
      `SELECT table_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'tenantId'
       ORDER BY table_name`,
    )
  ).map((row) => row.table_name);
  const referencing = await dataSource.query(
    `SELECT DISTINCT conrelid::regclass::text AS child, confrelid::regclass::text AS parent
     FROM pg_constraint
     WHERE contype = 'f'
       AND confrelid::regclass::text = ANY($1)
       AND NOT (conrelid::regclass::text = ANY($1))`,
    [owned],
  );
  const undeclaredChildren = referencing
    .filter(
      ({ child, parent }) =>
        !CHILD_TABLES.some((c) => c.table === child && c.parent === parent),
    )
    .map(({ child, parent }) => `${child} → ${parent}`);
  return { children: CHILD_TABLES, owned, undeclaredChildren };
}

export async function snapshotTenant(
  dataSource: DataSource,
  tables: TenantTables,
  tenantId: string,
): Promise<TenantSnapshot> {
  const snapshot: TenantSnapshot = {};
  for (const table of tables.owned) {
    const rows = await dataSource.query(
      `SELECT to_jsonb(t)::text AS row FROM "${table}" t WHERE t."tenantId"::text = $1 ORDER BY 1`,
      [tenantId],
    );
    snapshot[table] = rows.map((r) => r.row);
  }
  for (const { column, parent, table } of tables.children) {
    const rows = await dataSource.query(
      `SELECT to_jsonb(c)::text AS row FROM "${table}" c
       JOIN "${parent}" p ON c."${column}" = p.id
       WHERE p."tenantId"::text = $1 ORDER BY 1`,
      [tenantId],
    );
    snapshot[table] = rows.map((r) => r.row);
  }
  return snapshot;
}

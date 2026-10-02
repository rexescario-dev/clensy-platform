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
  // Every FK edge in the schema, followed transitively from the
  // tenant-owned tables and tenant_entity: a table without tenantId that is
  // reachable — directly, through a declared child, or by any column into
  // tenant_entity — must be a declared child, or Phase 6 cannot snapshot it.
  const edges = await dataSource.query<{ child: string; parent: string }[]>(
    `SELECT DISTINCT conrelid::regclass::text AS child, confrelid::regclass::text AS parent
     FROM pg_constraint WHERE contype = 'f'`,
  );
  const reached = new Set<string>([...owned, 'tenant_entity']);
  const seen = new Set<string>();
  const undeclaredChildren: string[] = [];
  for (let grew = true; grew;) {
    grew = false;
    for (const { child, parent } of edges) {
      const edge = `${child} → ${parent}`;
      if (!reached.has(parent) || owned.includes(child) || seen.has(edge)) {
        continue;
      }
      seen.add(edge);
      if (!CHILD_TABLES.some((c) => c.table === child && c.parent === parent)) {
        undeclaredChildren.push(edge);
      }
      if (!reached.has(child)) {
        reached.add(child);
        grew = true;
      }
    }
  }
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

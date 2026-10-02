import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app/app.module';
import { discoverTenantTables } from './tenant-snapshot';

// #92 follow-up: undeclared-child detection follows foreign keys
// transitively — through declared child tables and into tenant_entity by
// any column — so a table Phase 6 cannot snapshot fails the gate.
describe('release-gate tenant table discovery (#92)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('declares every child of the live schema', async () => {
    expect((await discoverTenantTables(dataSource)).undeclaredChildren).toEqual(
      [],
    );
  });

  it('reports a table below a declared child and one referencing tenant_entity by another column', async () => {
    const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
    const grandchild = `gate_probe_grandchild_${suffix}`;
    const tenantRef = `gate_probe_tenant_ref_${suffix}`;
    try {
      await dataSource.query(
        `CREATE TABLE "${grandchild}" (id uuid PRIMARY KEY, "itemId" uuid REFERENCES "checklist_item_entity"(id))`,
      );
      await dataSource.query(
        `CREATE TABLE "${tenantRef}" (id uuid PRIMARY KEY, "ownerTenant" uuid REFERENCES "tenant_entity"(id))`,
      );
      const { undeclaredChildren } = await discoverTenantTables(dataSource);
      expect(undeclaredChildren).toEqual(
        expect.arrayContaining([
          `${grandchild} → checklist_item_entity`,
          `${tenantRef} → tenant_entity`,
        ]),
      );
    } finally {
      await dataSource.query(`DROP TABLE IF EXISTS "${grandchild}"`);
      await dataSource.query(`DROP TABLE IF EXISTS "${tenantRef}"`);
    }
  });
});

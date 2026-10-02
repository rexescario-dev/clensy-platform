import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app/app.module';
import {
  createTestTenant,
  removeTestTenants,
} from '../helpers/seed-tenant-admin';
import { checkUnfilteredList } from './engine';
import { Fixtures } from './two-tenant-world';

// #92 follow-up: the unfiltered-list (`excludes`) check must reject any
// returned row that is not the caller's own, not only the declared victim
// id, and a connection page must be as full as its totalCount allows.
describe('release-gate unfiltered-list check (#92)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let tenantA: string;
  let tenantB: string;
  let customerA: string;
  let customerB: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    const fixtures = new Fixtures(dataSource, randomUUID());
    tenantA = await createTestTenant(dataSource);
    tenantB = await createTestTenant(dataSource);
    customerA = await fixtures.customer(tenantA);
    customerB = await fixtures.customer(tenantB);
  });

  afterAll(async () => {
    try {
      if (dataSource) await removeTestTenants(dataSource, [tenantA, tenantB]);
    } finally {
      await app?.close();
    }
  });

  const check = (ids: string[], totalCount: number | null) =>
    checkUnfilteredList(dataSource, {
      tenantId: tenantA,
      foreign: [],
      outcome: { ids, kind: 'OK', totalCount },
      table: 'customer_entity',
    });

  it('accepts a list of exactly the caller’s own rows', async () => {
    expect(await check([customerA], 1)).toBeNull();
    expect(await check([customerA], null)).toBeNull();
  });

  it('rejects a returned row of another tenant even when it is not the declared victim id', async () => {
    expect(await check([customerA, customerB], 1)).toContain(customerB);
  });

  it('rejects a returned id that is not a row of the table at all', async () => {
    const stranger = randomUUID();
    expect(await check([customerA, stranger], null)).toContain(stranger);
  });

  it('rejects a connection page smaller than min(totalCount, 100)', async () => {
    expect(await check([customerA], 2)).toMatch(/page/);
  });
});

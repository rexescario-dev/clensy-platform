import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app/app.module';
import type { GateClient } from './client';
import { buildGateWorld } from './two-tenant-world';

// #92 M7 finding: a world build that fails partway must not leave test
// tenants or an active SUPER_ADMIN in the shared e2e database.
describe('release-gate two-tenant world (#92)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  async function leftovers(): Promise<{
    superAdmins: number;
    tenants: number;
  }> {
    const [tenants] = await dataSource.query(
      `SELECT count(*)::int AS count FROM "tenant_entity" WHERE name LIKE 'test-tenant-%'`,
    );
    const [superAdmins] = await dataSource.query(
      `SELECT count(*)::int AS count FROM "admin_user_entity" WHERE role = 'SUPER_ADMIN'`,
    );
    return { superAdmins: superAdmins.count, tenants: tenants.count };
  }

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

  it.each([
    ['in tenant B', 8],
    ['at the Super Admin login', 13],
  ])(
    'removes everything it created when the build fails %s',
    async (_label, failingLogin) => {
      const before = await leftovers();
      let logins = 0;
      const client = {
        login: () => {
          logins += 1;
          return logins === failingLogin
            ? Promise.reject(new Error('simulated login failure'))
            : Promise.resolve('session=gate');
        },
      } as unknown as GateClient;

      await expect(buildGateWorld(dataSource, client)).rejects.toThrow(
        'simulated login failure',
      );
      expect(await leftovers()).toEqual(before);
    },
  );
});

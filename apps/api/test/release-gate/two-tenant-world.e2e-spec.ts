import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app/app.module';
import type { GateClient } from './client';
import { JOB_PROBES } from './probes/jobs';
import { buildGateWorld, destroyGateWorld } from './two-tenant-world';

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

  // Jobs §4.1: CompleteJob is legal only from IN_PROGRESS with every item
  // complete — the state the API reaches before it. The probe must prepare
  // exactly that, never an API-unreachable PENDING job.
  it('prepares completeJob targets as IN_PROGRESS jobs with every item complete', async () => {
    const client = {
      login: () => Promise.resolve('session=gate'),
    } as unknown as GateClient;
    const world = await buildGateWorld(dataSource, client);
    try {
      const probe = JOB_PROBES.find((p) => p.key === 'Mutation.completeJob');
      const prepared = await probe!.prepare!(world.fixtures, world.a);
      const [job] = await dataSource.query<
        { incomplete: number; status: string }[]
      >(
        `SELECT j.status::text AS status,
                count(i.id) FILTER (WHERE NOT i.completed)::int AS incomplete
         FROM "cleaning_job_entity" j
         JOIN "checklist_entity" c ON c."jobId" = j.id
         JOIN "checklist_item_entity" i ON i."checklistId" = c.id
         WHERE j.id = $1 GROUP BY j.status`,
        [prepared.jobId],
      );
      expect(job).toEqual({ incomplete: 0, status: 'IN_PROGRESS' });
    } finally {
      await destroyGateWorld(dataSource, world);
    }
  });
});

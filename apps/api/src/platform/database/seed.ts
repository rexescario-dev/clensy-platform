import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../app/app.module';
import { AdminUserEntity } from '../../modules/admins/infrastructure/persistence/admin-user.entity';
import { BookingSeeder } from '../../modules/bookings/infrastructure/persistence/seed/booking.seeder';
import { Role } from '../auth/domain/role';
import dataSource from './data-source';

const BCRYPT_SALT_ROUNDS = 10;

// Dev-only convenience — separate from Task 9's e2e fixture (which seeds its
// own Owner deterministically for the acceptance flow). Reads credentials
// from the environment (mirroring `.env.example`'s `DB_*` pattern) rather
// than hardcoding any — and no-ops, with a log message, if either variable
// is unset, so `pnpm db:seed` stays safe to run in an environment that
// hasn't opted into this seed.
//
// Uses `data-source.ts`'s plain CLI `DataSource` (which already lists
// `AdminUserEntity` for migrations) instead of the Nest application's own
// `DataSource`/`AdminsService`: `AdminsModule` isn't imported into
// `AppModule` until Task 6, so `AdminUserEntity` has no metadata registered
// on the app's `autoLoadEntities` connection yet. This keeps the seed
// runnable today without depending on that later wiring.
async function seedDevOwner(): Promise<void> {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!email || !password) {
    console.log(
      'Skipping dev Owner seed: ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD not set.',
    );
    return;
  }

  const normalizedEmail = email.toLowerCase();
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  await dataSource.initialize();
  try {
    await dataSource.getRepository(AdminUserEntity).upsert(
      [
        {
          email: normalizedEmail,
          passwordHash,
          role: Role.OWNER,
          isActive: true,
        },
      ],
      ['email'],
    );
    console.log(`Seeded dev Owner admin: ${normalizedEmail}`);
  } finally {
    await dataSource.destroy();
  }
}

// Entrypoint for `pnpm db:seed`. Calls each module's seeder directly — add a
// line here per module as more seeders exist, rather than pre-building an
// orchestrator class for a single seeder.
async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    await app.get(BookingSeeder).seed();
  } finally {
    await app.close();
  }
  await seedDevOwner();
}

run()
  .then(() => {
    console.log('Seed complete.');
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });

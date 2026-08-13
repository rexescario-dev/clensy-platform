import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app/app.module';
import { BookingSeeder } from '../../modules/bookings/infrastructure/persistence/seed/booking.seeder';

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

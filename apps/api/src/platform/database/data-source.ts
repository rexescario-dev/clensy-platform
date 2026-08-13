import 'dotenv/config';
import { DataSource } from 'typeorm';
import { BookingEntity } from '../../modules/bookings/infrastructure/persistence/booking.entity';

// Plain DataSource for the TypeORM CLI (migration:generate/run/revert) — kept
// separate from database.module.ts, which is Nest-wrapped (ConfigService,
// autoLoadEntities) and not something the CLI can consume directly.
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'clensy',
  password: process.env.DB_PASSWORD ?? 'clensy_dev',
  database: process.env.DB_NAME ?? 'clensy',
  entities: [BookingEntity],
  migrations: [__dirname + '/migrations/*.ts'],
});

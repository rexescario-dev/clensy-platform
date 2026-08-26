import 'dotenv/config';
import { DataSource } from 'typeorm';
import { BookingEntity } from '../../modules/bookings/infrastructure/persistence/booking.entity';
import { CleaningJobEntity } from '../../modules/jobs/infrastructure/persistence/cleaning-job.entity';
import { ChecklistEntity } from '../../modules/jobs/infrastructure/persistence/checklist.entity';
import { ChecklistItemEntity } from '../../modules/jobs/infrastructure/persistence/checklist-item.entity';
import { AdminUserEntity } from '../../modules/admins/infrastructure/persistence/admin-user.entity';
import { CustomerEntity } from '../../modules/customers/infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../../modules/customers/infrastructure/persistence/property.entity';
import { TeamEntity } from '../../modules/cleaners/infrastructure/persistence/team.entity';
import { CleanerEntity } from '../../modules/cleaners/infrastructure/persistence/cleaner.entity';
import { AddOnEntity } from '../../modules/catalog/infrastructure/persistence/add-on.entity';
import { PricingRuleEntity } from '../../modules/catalog/infrastructure/persistence/pricing-rule.entity';
import { ServiceEntity } from '../../modules/catalog/infrastructure/persistence/service.entity';
import { AuditEventEntity } from '../audit/infrastructure/persistence/audit-event.entity';

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
  entities: [
    BookingEntity,
    AuditEventEntity,
    AdminUserEntity,
    CustomerEntity,
    PropertyEntity,
    TeamEntity,
    CleanerEntity,
    ServiceEntity,
    AddOnEntity,
    PricingRuleEntity,
    CleaningJobEntity,
    ChecklistEntity,
    ChecklistItemEntity,
  ],
  migrations: [__dirname + '/migrations/*.ts'],
});

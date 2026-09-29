import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantEntity } from '../../../admins/infrastructure/persistence/tenant.entity';
import { BookingEntity } from '../../../bookings/infrastructure/persistence/booking.entity';
import { CleaningJob } from '../../domain/cleaning-job';
import { JobStatus } from '../../domain/job-status';

// Dual UUID `bookingId` + `@ManyToOne` so Relatable can filter
// `jobs(filter: { booking: { id: { eq } } })` (plan §3.6 mechanism 1).
// Application writes keep using the scalar. No inverse on BookingEntity
// (`booking.jobs` is out of inventory). Non-eager, no cascade, no lazy.
//
// Tenant ownership (#86): `tenantId` + `fk_cleaning_job_tenant` are
// expressed here. `booking` keeps the relation for Relatable but sets
// `createForeignKeyConstraints: false`. `teamId` stays a plain column with
// no relation, so TypeORM owns no team FK. The composite
// `fk_cleaning_job_booking_tenant` / `fk_cleaning_job_team_tenant` FKs and
// `uq_cleaning_job_id_tenant` / `idx_cleaning_job_tenant_scheduled` are
// hand-written in `AddJobChecklistTenant`. `migration:generate` may
// propose dropping them or re-adding id-only FKs — do not apply that.
@Entity()
export class CleaningJobEntity implements CleaningJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantEntity, {
    nullable: false,
    eager: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'tenantId',
    foreignKeyConstraintName: 'fk_cleaning_job_tenant',
  })
  tenant!: TenantEntity;

  @Column({ type: 'uuid' })
  bookingId!: string;

  @ManyToOne(() => BookingEntity, {
    nullable: false,
    eager: false,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'bookingId' })
  booking!: BookingEntity;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  teamId!: string | null;

  @Column({ type: 'timestamptz' })
  scheduledAt!: Date;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.PENDING })
  status!: JobStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

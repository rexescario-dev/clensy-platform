import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CleaningJob } from '../../domain/cleaning-job';
import { JobStatus } from '../../domain/job-status';

// `bookingId`/`teamId` carry no TypeORM relation decorator — each is a
// plain `@Column`, with the FK constraint hand-added in the migration's
// raw SQL (spec §4.1), matching `BookingEntity.teamId` / `CleanerEntity
// .teamId`. Do not add a relation decorator here; that would let a future
// `migration:generate` regenerate the FK from entity metadata.
//
// No `@Column({ unique: true })` on `bookingId` — the unique constraint
// name `UQ_cleaning_job_booking_id` is spec-mandated and is hand-added in
// the migration. `unique: true` would let TypeORM invent a different name.
@Entity()
export class CleaningJobEntity implements CleaningJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  bookingId!: string;

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

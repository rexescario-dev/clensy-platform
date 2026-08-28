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
import { BookingEntity } from '../../../bookings/infrastructure/persistence/booking.entity';
import { CleaningJob } from '../../domain/cleaning-job';
import { JobStatus } from '../../domain/job-status';

// Dual UUID `bookingId` + `@ManyToOne` so Relatable can filter
// `jobs(filter: { booking: { id: { eq } } })` (plan §3.6 mechanism 1).
// Application writes keep using the scalar. No inverse on BookingEntity
// (`booking.jobs` is out of inventory). Non-eager, no cascade, no lazy.
@Entity()
export class CleaningJobEntity implements CleaningJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  bookingId!: string;

  @ManyToOne(() => BookingEntity, {
    nullable: false,
    eager: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'bookingId',
    foreignKeyConstraintName: 'fk_cleaning_job_booking',
  })
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

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Checklist } from '../../domain/checklist';

// `jobId` is a plain column with no relation decorator — the 1:1 unique
// constraint `UQ_checklist_job_id` and FK `fk_checklist_job` are
// hand-added in the migration (spec §4.1 / plan §3).
@Entity()
export class ChecklistEntity implements Checklist {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  jobId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

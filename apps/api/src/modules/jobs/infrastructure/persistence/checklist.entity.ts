import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Checklist } from '../../domain/checklist';
import { ChecklistItemEntity } from './checklist-item.entity';

// `items` is persistence-only inverse metadata for Relatable nested
// GraphQL. Not on the domain object. Non-eager, no cascade, no lazy.
@Entity()
export class ChecklistEntity implements Checklist {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  jobId!: string;

  @OneToMany(() => ChecklistItemEntity, (item) => item.checklist)
  items!: ChecklistItemEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

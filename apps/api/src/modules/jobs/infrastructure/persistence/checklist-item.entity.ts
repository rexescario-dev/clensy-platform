import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChecklistItem } from '../../domain/checklist-item';
import { ChecklistEntity } from './checklist.entity';

@Entity()
export class ChecklistItemEntity implements ChecklistItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  checklistId!: string;

  @ManyToOne(() => ChecklistEntity, (checklist) => checklist.items, {
    nullable: false,
    eager: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'checklistId',
    foreignKeyConstraintName: 'fk_checklist_item_checklist',
  })
  checklist!: ChecklistEntity;

  @Column()
  label!: string;

  @Column({ type: 'integer' })
  position!: number;

  @Column({ default: false })
  completed!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}

import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ChecklistItem } from '../../domain/checklist-item';

// `checklistId` is a plain column with no relation decorator — FK
// `fk_checklist_item_checklist` is hand-added in the migration (spec §4.1).
// No unique on `(checklistId, position)` — uniqueness is the creation
// algorithm (spec §4.1).
@Entity()
export class ChecklistItemEntity implements ChecklistItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  checklistId!: string;

  @Column()
  label!: string;

  @Column({ type: 'integer' })
  position!: number;

  @Column({ default: false })
  completed!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}

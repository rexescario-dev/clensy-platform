import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Cleaner } from '../../domain/cleaner';

// `teamId` is a plain column with no relation decorator — the FK constraint
// is enforced at the database layer entirely via the hand-edited migration
// (spec §3), not via TypeORM relation metadata. Do not add a `@ManyToOne`
// here; that would let a future `migration:generate` regenerate the FK from
// entity metadata, contradicting the migration being the sole authoritative
// source of it. Mirrors `PropertyEntity.customerId`'s precedent exactly.
@Entity()
export class CleanerEntity implements Cleaner {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  fullName!: string;

  @Column()
  phone!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  teamId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

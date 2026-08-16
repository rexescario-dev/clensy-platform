import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Property } from '../../domain/property';

// `customerId` is a plain column with no relation decorator — the FK
// constraint is enforced at the database layer entirely via the hand-edited
// migration (spec §3), not via TypeORM relation metadata. Do not add a
// `@ManyToOne` here; that would let a future `migration:generate` regenerate
// the FK from entity metadata, contradicting the migration being the sole
// authoritative source of it.
@Entity()
export class PropertyEntity implements Property {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  customerId!: string;

  @Column()
  label!: string;

  @Column()
  addressLine1!: string;

  @Column({ type: 'text', nullable: true })
  addressLine2!: string | null;

  @Column()
  city!: string;

  @Column()
  region!: string;

  @Column()
  postalCode!: string;

  @Column({ type: 'text', nullable: true })
  accessNotes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

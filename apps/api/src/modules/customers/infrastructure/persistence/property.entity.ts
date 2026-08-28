import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BookingEntity } from '../../../bookings/infrastructure/persistence/booking.entity';
import { Property } from '../../domain/property';

// `customerId` is a plain column with no relation decorator — the FK
// constraint is enforced at the database layer entirely via the hand-edited
// migration (spec §3), not via TypeORM relation metadata. Do not add a
// `@ManyToOne` here; that would let a future `migration:generate` regenerate
// the FK from entity metadata, contradicting the migration being the sole
// authoritative source of it.
//
// `bookings` is persistence-only inverse metadata for Relatable nested
// GraphQL (collections spec §4.3). Not on the domain object; application
// writes MUST NOT read or assign it. Non-eager, no cascade, no lazy: true.
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

  @OneToMany(() => BookingEntity, (booking) => booking.property)
  bookings!: BookingEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

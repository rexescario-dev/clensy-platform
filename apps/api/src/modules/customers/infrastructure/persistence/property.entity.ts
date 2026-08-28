import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BookingEntity } from '../../../bookings/infrastructure/persistence/booking.entity';
import { CustomerEntity } from './customer.entity';
import { Property } from '../../domain/property';

// Dual UUID `customerId` + `@ManyToOne` (Booking pattern). Application
// writes keep using the scalar. `bookings` / `customer` are persistence-only
// inverse metadata for Relatable. Non-eager, no cascade, no lazy: true.
@Entity()
export class PropertyEntity implements Property {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  customerId!: string;

  @ManyToOne(() => CustomerEntity, (customer) => customer.properties, {
    nullable: false,
    eager: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'customerId',
    foreignKeyConstraintName: 'fk_property_customer',
  })
  customer!: CustomerEntity;

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

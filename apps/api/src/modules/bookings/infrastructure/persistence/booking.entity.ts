import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CustomerEntity } from '../../../customers/infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../../../customers/infrastructure/persistence/property.entity';
import { ServiceEntity } from '../../../catalog/infrastructure/persistence/service.entity';
import { TeamEntity } from '../../../cleaners/infrastructure/persistence/team.entity';
import { Booking } from '../../domain/booking';
import { BookingStatus } from '../../domain/booking-status';
import { BookingPricingSnapshotEmbeddable } from './booking-pricing-snapshot.embeddable';

// Dual UUID columns + unidirectional @ManyToOne (nestjs-query GraphQL Reads
// spec §4.1). Application/REST/commands keep writing customerId (etc.)
// scalars. GraphQL relation reads use the ORM relations. Relations are
// persistence metadata only — BookingEntity may import foreign entities;
// BookingsModule MUST NOT register them on forFeature. Non-eager, no
// cascade, no inverses, no TypeORM lazy: true.
@Entity()
export class BookingEntity implements Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  customerId!: string;

  @ManyToOne(() => CustomerEntity, {
    nullable: false,
    eager: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'customerId',
    foreignKeyConstraintName: 'fk_booking_customer',
  })
  customer!: CustomerEntity;

  @Column({ type: 'uuid' })
  @Index()
  propertyId!: string;

  @ManyToOne(() => PropertyEntity, {
    nullable: false,
    eager: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'propertyId',
    foreignKeyConstraintName: 'fk_booking_property',
  })
  property!: PropertyEntity;

  @Column({ type: 'uuid' })
  @Index()
  serviceId!: string;

  @ManyToOne(() => ServiceEntity, {
    nullable: false,
    eager: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'serviceId',
    foreignKeyConstraintName: 'fk_booking_service',
  })
  service!: ServiceEntity;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  teamId!: string | null;

  @ManyToOne(() => TeamEntity, {
    nullable: true,
    eager: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'teamId', foreignKeyConstraintName: 'fk_booking_team' })
  team!: TeamEntity | null;

  @Column({ type: 'timestamptz' })
  scheduledAt!: Date;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status!: BookingStatus;

  // First use of a TypeORM embedded column in this codebase (spec §4.1) —
  // persists the value object without promoting it to its own table.
  // `prefix: false` — verified directly (not assumed) against this
  // codebase's actual installed TypeORM version: its default embedded-
  // column naming strategy runs the prefixed name through `titleCase()`,
  // which (per `util/StringUtils.js`) capitalizes only the very first
  // character and lowercases the rest of the whole string — it does not
  // preserve inner camelCase the way earlier TypeORM versions' embedded
  // naming did. Left at its default, the generated column would be
  // `pricingSnapshotPriceminorunits`, inconsistent with every other
  // camelCase column in this schema (`durationMinutes`, `priceMinorUnits`,
  // etc.). `prefix: false` disables that prefixing/case-mangling entirely,
  // so `BookingPricingSnapshotEmbeddable.priceMinorUnits`'s own explicit
  // `name: 'pricingSnapshotPriceMinorUnits'` (see that class) is used
  // verbatim.
  @Column(() => BookingPricingSnapshotEmbeddable, { prefix: false })
  pricingSnapshot!: BookingPricingSnapshotEmbeddable;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

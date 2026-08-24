import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Booking } from '../../domain/booking';
import { BookingStatus } from '../../domain/booking-status';
import { BookingPricingSnapshotEmbeddable } from './booking-pricing-snapshot.embeddable';

// `customerId`/`propertyId`/`serviceId`/`teamId` carry no TypeORM relation
// decorator — each is a plain `@Column`, with the FK constraint hand-added
// in the migration's raw SQL (spec §4.1), matching `PropertyEntity
// .customerId`/`PricingRuleEntity.serviceId`/`CleanerEntity.teamId`'s
// precedent exactly. Do not add a relation decorator here; that would let
// a future `migration:generate` regenerate the FK from entity metadata.
@Entity()
export class BookingEntity implements Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  customerId!: string;

  @Column({ type: 'uuid' })
  @Index()
  propertyId!: string;

  @Column({ type: 'uuid' })
  @Index()
  serviceId!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  teamId!: string | null;

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

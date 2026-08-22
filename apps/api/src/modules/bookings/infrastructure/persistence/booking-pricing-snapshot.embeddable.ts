import { Column } from 'typeorm';
import { BookingPricingSnapshot } from '../../domain/booking-pricing-snapshot';

// TypeORM-decorated embeddable class implementing the plain domain
// interface — the entity-layer counterpart, mirroring the
// domain-interface/infrastructure-entity split every other domain object
// in this codebase already follows (`BookingEntity implements Booking`,
// etc.). A real class is required (not just the interface) so
// `BookingEntity` can use it as a TypeORM embedded column
// (`@Column(() => BookingPricingSnapshotEmbeddable)`, spec §4.1).
//
// `priceMinorUnits` carries its own `@Column()` decorator — verified
// directly (not assumed): TypeORM's embedded-column mechanism only wraps
// an object under a column-name prefix; it does not implicitly persist an
// embedded class's undecorated fields. Omitting this decorator silently
// drops the field (empty `EntityMetadata.embeddeds[].columns`), producing
// a NOT NULL violation at insert time despite the migration's generated
// column existing.
export class BookingPricingSnapshotEmbeddable implements BookingPricingSnapshot {
  // Explicit `name` — required because the parent `@Column(() => ...,
  // { prefix: false })` (booking.entity.ts) disables the naming
  // strategy's own prefix/case computation entirely; without an explicit
  // name here the column would just be `priceMinorUnits`, colliding in
  // spirit (though not literally) with `PricingRule`'s own column of the
  // same name and losing the `pricingSnapshot` association in the schema.
  @Column({ type: 'integer', name: 'pricingSnapshotPriceMinorUnits' })
  priceMinorUnits!: number;
}

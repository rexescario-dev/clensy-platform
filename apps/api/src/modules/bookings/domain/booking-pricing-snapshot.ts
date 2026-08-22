// A `Booking`-owned value object capturing the `Service`'s active price at
// the moment of booking creation (spec §4.1) — never mutated afterward.
// Not itself a persisted, independently addressable entity. Plain TS, no
// framework dependency (spec §2) — the TypeORM-decorated embeddable class
// used to persist this shape lives in
// `infrastructure/persistence/booking-pricing-snapshot.embeddable.ts`,
// mirroring the domain-interface/infrastructure-entity split every other
// domain object in this codebase already follows.
export interface BookingPricingSnapshot {
  priceMinorUnits: number;
}

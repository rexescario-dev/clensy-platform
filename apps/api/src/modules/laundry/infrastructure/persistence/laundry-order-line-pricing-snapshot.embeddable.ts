import { Column } from 'typeorm';
import { PricingUnit } from '../../../catalog/domain/pricing-unit';
import { LaundryOrderLinePricingSnapshot } from '../../domain/laundry-order-line-pricing-snapshot';

// TypeORM-decorated embeddable implementing the plain domain interface —
// the entity-layer counterpart, mirroring `BookingPricingSnapshotEmbeddable`
// exactly (spec §4.2). A real class is required so `LaundryOrderLineEntity`
// can use it as an embedded column (`@Column(() => …, { prefix: false })`).
//
// Every field carries its own `@Column` — TypeORM's embedded-column
// mechanism does not implicitly persist undecorated fields. Each column name
// is explicit because the parent `@Column(() => …, { prefix: false })`
// disables the naming strategy's prefix/case computation entirely (the
// `BookingPricingSnapshotEmbeddable` header documents the `titleCase()`
// pitfall this avoids).
//
// `pricingSnapshotUnit` is a MODULE-LOCAL Postgres enum
// (`laundry_order_line_unit_enum`) — the `PricingUnit` TypeScript enum is
// shared from catalog's domain, but the database type is this module's own,
// never catalog's `pricing_rule_entity_unit_enum` (spec §4.10, §5).
//
// `pricingSnapshotPricingRuleId` is a plain `uuid` column with NO foreign
// key — a soft traceability pointer; the snapshot, not the rule, is
// authoritative for what was charged (spec §4.2, §4.8).
export class LaundryOrderLinePricingSnapshotEmbeddable implements LaundryOrderLinePricingSnapshot {
  @Column({ type: 'integer', name: 'pricingSnapshotRateMinorUnits' })
  rateMinorUnits!: number;

  @Column({
    type: 'enum',
    enum: PricingUnit,
    enumName: 'laundry_order_line_unit_enum',
    name: 'pricingSnapshotUnit',
  })
  unit!: PricingUnit;

  @Column({ type: 'integer', name: 'pricingSnapshotQuantity' })
  quantity!: number;

  @Column({ type: 'integer', name: 'pricingSnapshotAmountMinorUnits' })
  amountMinorUnits!: number;

  @Column({
    type: 'integer',
    name: 'pricingSnapshotMinimumChargeMinorUnits',
    nullable: true,
  })
  minimumChargeMinorUnits!: number | null;

  @Column({ type: 'boolean', name: 'pricingSnapshotMinimumChargeApplied' })
  minimumChargeApplied!: boolean;

  @Column({
    type: 'uuid',
    name: 'pricingSnapshotPricingRuleId',
    nullable: true,
  })
  pricingRuleId!: string | null;
}

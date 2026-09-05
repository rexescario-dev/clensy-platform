import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PricingRule } from '../../domain/pricing-rule';
import { PricingUnit } from '../../domain/pricing-unit';

// `serviceId`/`addOnId` are plain columns with no relation decorators — their
// FK constraints (`fk_pricing_rule_service`, `fk_pricing_rule_addon`) are
// hand-added SQL in this module's migrations, not TypeORM relation metadata.
// Do not add a `@ManyToOne` — same established pattern as
// `Cleaner.teamId → Team.id`. Exactly one of the two is non-null on any row
// — a hand-added `CHECK (num_nonnulls("serviceId", "addOnId") = 1)`
// constraint, not expressible in entity metadata (Laundry Architecture &
// Catalog Foundation spec §4.2, §4.7).
//
// No `@UpdateDateColumn`/`updatedAt` — see `pricing-rule.ts`'s header comment.
// This entity is append-only: `PricingRulesService#createPricingRule`
// deactivates the currently-active row (a bulk `UPDATE` of `active` only,
// never touching this entity's other columns) and inserts a new row rather
// than mutating an existing one in place.
//
// At most one row per `serviceId` may have `active: true` at a time — enforced
// by a hand-added Postgres PARTIAL unique index (`uq_pricing_rule_active_service`,
// `WHERE active = true`, see the `AddPricingRule` migration), not by anything
// expressible in entity metadata. This mechanism is untouched by the
// `effectiveFrom`/`effectiveTo` fields below — it remains the legacy,
// `Service`-only mechanism `getActivePricing` reads. Separately, at most one
// row per target (`serviceId` OR `addOnId`) may have `effectiveTo: null` at a
// time — enforced by two more hand-added partial unique indexes,
// `uq_pricing_rule_open_service`/`uq_pricing_rule_open_addon`
// (`WHERE "effectiveTo" IS NULL`), added by the
// `ExtendPricingRuleEffectiveDating` migration. Two independent invariants
// on the same table, deliberately not unified — see that migration's and
// `pricing-rules.service.ts`'s comments for why.
@Entity()
export class PricingRuleEntity implements PricingRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index('IDX_c22f021ac1046f25883817f8f9')
  serviceId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index('IDX_pricing_rule_addon_id')
  addOnId!: string | null;

  @Column({ type: 'integer' })
  priceMinorUnits!: number;

  @Column({ type: 'enum', enum: PricingUnit, default: PricingUnit.PER_SERVICE })
  unit!: PricingUnit;

  @Column({ type: 'timestamptz' })
  effectiveFrom!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  effectiveTo!: Date | null;

  @Column({ type: 'integer', nullable: true })
  minimumChargeMinorUnits!: number | null;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

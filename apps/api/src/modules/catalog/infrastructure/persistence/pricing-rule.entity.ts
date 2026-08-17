import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PricingRule } from '../../domain/pricing-rule';

// `serviceId` is a plain column with no relation decorator — the FK
// constraint (`fk_pricing_rule_service`) is hand-added SQL in this module's
// migration (spec §3), not TypeORM relation metadata. Do not add a
// `@ManyToOne` — same established pattern as `Cleaner.teamId → Team.id`.
//
// No `@UpdateDateColumn`/`updatedAt` — see `pricing-rule.ts`'s header comment.
// This entity is append-only: `PricingRulesService#createPricingRule`
// deactivates the currently-active row (a bulk `UPDATE` of `active` only,
// never touching this entity's other columns) and inserts a new row rather
// than mutating an existing one in place.
//
// At most one row per `serviceId` may have `active: true` at a time — enforced
// by a hand-added Postgres PARTIAL unique index (`uq_pricing_rule_active_service`,
// `WHERE active = true`, see this module's migration), not by anything
// expressible in entity metadata.
@Entity()
export class PricingRuleEntity implements PricingRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  serviceId!: string;

  @Column({ type: 'integer' })
  priceMinorUnits!: number;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

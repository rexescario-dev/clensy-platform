import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AddOn } from '../../domain/add-on';

// `name` deliberately has NO `unique` option here (spec §3) — case-insensitive
// uniqueness is enforced by a hand-added Postgres expression index
// (`uq_add_on_name_lower`, see this module's migration) plus an
// application-layer pre-check (`AddOnsService#assertNameAvailable`), not by
// a plain column-level unique constraint, since Postgres's own `UNIQUE`
// constraint is case-sensitive and can't express "case-insensitively unique"
// on its own. Same reasoning as `ServiceEntity`.
@Entity()
export class AddOnEntity implements AddOn {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'integer' })
  priceMinorUnits!: number;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

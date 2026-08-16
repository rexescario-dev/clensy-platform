import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Service } from '../../domain/service';

// `name` deliberately has NO `unique` option here (spec §3) — case-insensitive
// uniqueness is enforced by a hand-added Postgres expression index
// (`uq_service_name_lower`, see this module's migration) plus an
// application-layer pre-check (`ServicesService#assertNameAvailable`), not by
// a plain column-level unique constraint, since Postgres's own `UNIQUE`
// constraint is case-sensitive and can't express "case-insensitively unique"
// on its own.
@Entity()
export class ServiceEntity implements Service {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'integer' })
  durationMinutes!: number;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

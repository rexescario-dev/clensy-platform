import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Team } from '../../domain/team';

// No relation decorator to `CleanerEntity` (spec §3) — `Team.cleaners`, if
// ever surfaced, is presentation-layer computed data only, not a domain- or
// ORM-level relation, mirroring `CustomerEntity`'s precedent exactly.
@Entity()
export class TeamEntity implements Team {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

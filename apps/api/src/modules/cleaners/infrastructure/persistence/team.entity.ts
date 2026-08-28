import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Team } from '../../domain/team';
import { CleanerEntity } from './cleaner.entity';

// `cleaners` is persistence-only inverse metadata for Relatable nested
// GraphQL. Not on the domain object; application writes MUST NOT read or
// assign it. Non-eager, no cascade, no lazy: true.
@Entity()
export class TeamEntity implements Team {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @OneToMany(() => CleanerEntity, (cleaner) => cleaner.team)
  cleaners!: CleanerEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Cleaner } from '../../domain/cleaner';
import { TeamEntity } from './team.entity';

// Dual UUID `teamId` + `@ManyToOne` (Booking / Property pattern). Application
// writes keep using the scalar. `team` is persistence-only metadata for
// Relatable. Non-eager, no cascade, no lazy: true.
@Entity()
export class CleanerEntity implements Cleaner {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  fullName!: string;

  @Column()
  phone!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  teamId!: string | null;

  @ManyToOne(() => TeamEntity, (team) => team.cleaners, {
    nullable: true,
    eager: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'teamId',
    foreignKeyConstraintName: 'fk_cleaner_team',
  })
  team!: TeamEntity | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

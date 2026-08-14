import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditEvent } from '../../domain/audit-event';
import { JsonValue } from '../../domain/json-value';

// TypeORM entity for the append-only audit trail. No update/delete
// repository method exists anywhere in this module (spec §4.6) — this class
// only ever participates in `create`/`save` calls from
// `AuditLoggerService.log()`.
@Entity()
export class AuditEventEntity implements AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Not a Postgres `uuid` column: `actorId`/`entityId` reference whatever id
  // format the emitting module uses, kept generic on purpose so this table
  // never has to change shape as new modules start logging to it.
  @Column({ type: 'varchar', nullable: true })
  actorId!: string | null;

  @Column()
  action!: string;

  @Column({ type: 'varchar', nullable: true })
  entityType!: string | null;

  @Column({ type: 'varchar', nullable: true })
  entityId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, JsonValue> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  occurredAt!: Date;
}

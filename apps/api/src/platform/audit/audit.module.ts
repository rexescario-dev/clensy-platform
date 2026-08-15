import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AUDIT_LOGGER } from './application/audit-logger.port';
import { AuditEventEntity } from './infrastructure/persistence/audit-event.entity';
import { AuditLoggerService } from './infrastructure/audit-logger.service';

// Exports the `AuditLogger` port binding only — calling modules depend on
// the `AUDIT_LOGGER` token, never on `AuditLoggerService` directly (spec
// §5.3). `AuditLoggerService` stays in `providers` (required for the
// `useExisting` binding below) but is deliberately not in `exports`: Nest's
// `exports` array only governs DI visibility for constructor injection by
// modules that `imports: [AuditModule]`, and putting the concrete class
// there would make it injectable elsewhere, which §5.3 prohibits. A caller
// that owns a transaction (Task 3's `AdminsService`) reaches
// `runAuditInTransaction` via a plain TypeScript import from
// `./infrastructure/audit-logger.service` — an ordinary module import, not
// Nest DI, so it needs no entry in this array.
@Module({
  imports: [TypeOrmModule.forFeature([AuditEventEntity])],
  providers: [
    Logger,
    AuditLoggerService,
    { provide: AUDIT_LOGGER, useExisting: AuditLoggerService },
  ],
  exports: [AUDIT_LOGGER],
})
export class AuditModule {}

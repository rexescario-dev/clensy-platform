import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AUDIT_LOGGER } from './application/audit-logger.port';
import { AuditEventEntity } from './infrastructure/persistence/audit-event.entity';
import { AuditLoggerService } from './infrastructure/audit-logger.service';

// Exports the `AuditLogger` port binding only — calling modules depend on
// the `AUDIT_LOGGER` token, never on `AuditLoggerService` directly (spec
// §5.3). `AuditLoggerService` itself is also exported so a caller that owns
// a transaction (Task 3's `AdminsService`) can import
// `runAuditInTransaction` alongside it; that helper is a plain function
// export from the service's module, not part of the port.
@Module({
  imports: [TypeOrmModule.forFeature([AuditEventEntity])],
  providers: [
    Logger,
    AuditLoggerService,
    { provide: AUDIT_LOGGER, useExisting: AuditLoggerService },
  ],
  exports: [AUDIT_LOGGER, AuditLoggerService],
})
export class AuditModule {}

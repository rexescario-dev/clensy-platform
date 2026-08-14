import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditLogEvent, AuditLogger } from '../application/audit-logger.port';
import { AuditEventEntity } from './persistence/audit-event.entity';

// --- Ambient-transaction detection (M6 implementation choice) --------------
//
// `AuditLoggerService#log()` is context-sensitive per spec §4.6: outside a
// state-changing transaction (e.g. a login event) a persistence failure is
// best-effort — caught, logged, never rethrown; inside the transaction a
// state-changing operation opens (e.g. Task 3's `AdminsService` create /
// disable), a persistence failure MUST propagate so the surrounding
// transaction rolls back. The public `AuditLogger` port stays a single
// `log(event): Promise<void>` method — callers never choose a mode; this
// class detects which one applies.
//
// Mechanism: Node's `AsyncLocalStorage` holds the ambient transaction's
// `EntityManager` for the duration of the async call chain that opened it.
// A caller that owns a transaction wraps its work in
// `runAuditInTransaction(manager, fn)`; any `log()` call made anywhere
// inside `fn` (including through further awaits/other services) observes
// that `EntityManager` via `auditTransactionStorage.getStore()` and switches
// to the propagating path, using the transaction's own manager instead of
// this service's injected repository. Outside any such wrapper the store is
// empty and `log()` falls back to its injected repository in best-effort
// mode. This is intentionally private to this file — it is not part of the
// `AuditLogger` port's public contract.
const auditTransactionStorage = new AsyncLocalStorage<EntityManager>();

export function runAuditInTransaction<T>(
  manager: EntityManager,
  fn: () => Promise<T>,
): Promise<T> {
  return auditTransactionStorage.run(manager, fn);
}

@Injectable()
export class AuditLoggerService implements AuditLogger {
  constructor(
    @InjectRepository(AuditEventEntity)
    private readonly auditEventRepository: Repository<AuditEventEntity>,
    private readonly logger: Logger,
  ) {}

  async log(event: AuditLogEvent): Promise<void> {
    const entity = this.auditEventRepository.create({
      actorId: event.actorId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      metadata: event.metadata ?? null,
    });

    const ambientManager = auditTransactionStorage.getStore();
    if (ambientManager) {
      // Inside an ambient transaction: propagate failures so the caller's
      // transaction rolls back with them.
      await ambientManager.save(AuditEventEntity, entity);
      return;
    }

    try {
      await this.auditEventRepository.save(entity);
    } catch (error) {
      this.logger.error(
        `Failed to persist audit event "${event.action}": ${(error as Error).message}`,
        (error as Error).stack,
        AuditLoggerService.name,
      );
    }
  }
}

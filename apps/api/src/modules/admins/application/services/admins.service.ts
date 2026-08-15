import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import type { AuditLogger } from '../../../../platform/audit/application/audit-logger.port';
import { runAuditInTransaction } from '../../../../platform/audit/infrastructure/audit-logger.service';
import { Role } from '../../../../platform/auth/domain/role';
import { AdminUser } from '../../domain/admin-user';
import { AdminUserEntity } from '../../infrastructure/persistence/admin-user.entity';
import { CreateAdminCommand } from '../commands/create-admin.command';
import { DisableAdminCommand } from '../commands/disable-admin.command';

const BCRYPT_SALT_ROUNDS = 10;

// Postgres unique_violation — see
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class AdminsService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  // Opens its own transaction and wraps the work in `runAuditInTransaction`
  // (the mechanism established by Task 1/`platform/audit`): entity writes go
  // through the transaction's own `manager` rather than an injected
  // `Repository`, and the `AuditLogger.log()` call made inside `fn`
  // automatically detects the ambient transaction and uses that same
  // `manager`, so a persistence failure there rolls back the `AdminUser`
  // insert with it (spec §4.6's transactional guarantee for `admin.created`).
  async create(command: CreateAdminCommand): Promise<AdminUser> {
    const email = command.email.toLowerCase();
    const passwordHash = await bcrypt.hash(
      command.password,
      BCRYPT_SALT_ROUNDS,
    );

    try {
      return await this.dataSource.transaction((manager) =>
        runAuditInTransaction(manager, async () => {
          const entity = manager.create(AdminUserEntity, {
            email,
            passwordHash,
            role: command.role,
            isActive: true,
          });
          await manager.save(entity);

          await this.auditLogger.log({
            actorId: command.actorId,
            action: 'admin.created',
            entityType: 'AdminUser',
            entityId: entity.id,
            metadata: { role: entity.role },
          });

          return entity;
        }),
      );
    } catch (error) {
      if ((error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
        throw new ConflictException('Email is already in use');
      }
      throw error;
    }
  }

  list(): Promise<AdminUser[]> {
    return this.dataSource.getRepository(AdminUserEntity).find();
  }

  // Self-disable check (spec §4.4) is a pure id comparison with no
  // concurrent-mutation risk — done before opening the transaction. The
  // last-active-Owner check MUST run inside the transaction, as a locking
  // read on the active Owner rows themselves (not a locked aggregate/COUNT),
  // so concurrent disable-Owner requests serialize against each other rather
  // than racing a check-then-act window.
  async disable(command: DisableAdminCommand): Promise<AdminUser> {
    if (command.targetId === command.actorId) {
      throw new ForbiddenException('An admin cannot disable their own account');
    }

    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const target = await manager.findOneBy(AdminUserEntity, {
          id: command.targetId,
        });
        if (!target) {
          throw new NotFoundException(`Admin ${command.targetId} not found`);
        }

        if (target.role === Role.OWNER && target.isActive) {
          // `SELECT id FROM admin_user_entity WHERE role = 'OWNER' AND
          // "isActive" = true FOR UPDATE` — locks the matching rows
          // themselves, not a count. Two concurrent disable-Owner
          // transactions both run this query; the second blocks until the
          // first commits or rolls back, so they can never both observe
          // "more than one active Owner" and both proceed.
          const activeOwners = await manager
            .getRepository(AdminUserEntity)
            .createQueryBuilder('admin_user')
            .setLock('pessimistic_write')
            .where('admin_user.role = :role', { role: Role.OWNER })
            .andWhere('admin_user.isActive = true')
            .getMany();

          if (activeOwners.length <= 1) {
            throw new ConflictException('Cannot disable the last active Owner');
          }
        }

        target.isActive = false;
        await manager.save(target);

        await this.auditLogger.log({
          actorId: command.actorId,
          action: 'admin.disabled',
          entityType: 'AdminUser',
          entityId: target.id,
        });

        return target;
      }),
    );
  }
}

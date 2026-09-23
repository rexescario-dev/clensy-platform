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
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AdminUser } from '../../domain/admin-user';
import { AdminUserEntity } from '../../infrastructure/persistence/admin-user.entity';
import { CreateAdminCommand } from '../commands/create-admin.command';
import { DisableAdminCommand } from '../commands/disable-admin.command';

const BCRYPT_SALT_ROUNDS = 10;

// Postgres unique_violation — see
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const POSTGRES_UNIQUE_VIOLATION = '23505';

// Staff lifecycle is Tenant-Owner-only and confined to the actor's own tenant
// (multi-tenant spec §4.3). `@Roles(TENANT_OWNER)` already gates the
// resolver; this re-check keeps the service itself from ever running with a
// platform or non-owner actor, and yields the tenant every query is scoped
// to.
function requireTenantOwnerTenant(actor: AuthenticatedPrincipal): string {
  if (
    actor.scope !== AdminScope.TENANT ||
    actor.role !== Role.TENANT_OWNER ||
    actor.tenantId === null
  ) {
    throw new ForbiddenException('Only a Tenant Owner can manage staff');
  }
  return actor.tenantId;
}

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
    const tenantId = requireTenantOwnerTenant(command.actor);
    if (command.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('A Tenant Owner cannot create a Super Admin');
    }

    const email = command.email.toLowerCase();
    const passwordHash = await bcrypt.hash(
      command.password,
      BCRYPT_SALT_ROUNDS,
    );

    try {
      return await this.dataSource.transaction((manager) =>
        runAuditInTransaction(manager, async () => {
          const entity = manager.create(AdminUserEntity, {
            tenantId,
            email,
            isActive: true,
            passwordHash,
            role: command.role,
            scope: AdminScope.TENANT,
          });
          await manager.save(entity);

          await this.auditLogger.log({
            actorId: command.actor.id,
            entityId: entity.id,
            tenantId,
            action: 'admin.created',
            entityType: 'AdminUser',
            metadata: { role: entity.role },
            scope: AdminScope.TENANT,
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

  // Never returns another tenant's staff or any platform Super Admin.
  list(actor: AuthenticatedPrincipal): Promise<AdminUser[]> {
    const tenantId = requireTenantOwnerTenant(actor);
    return this.dataSource
      .getRepository(AdminUserEntity)
      .find({ where: { tenantId } });
  }

  // Self-disable check (spec §4.4) is a pure id comparison with no
  // concurrent-mutation risk — done before opening the transaction. The
  // last-active-Tenant-Owner check MUST run inside the transaction, as a
  // locking read on that tenant's active Tenant Owner rows themselves (not a
  // locked aggregate/COUNT), so concurrent disable-owner requests serialize
  // against each other rather than racing a check-then-act window.
  //
  // A target outside the actor's tenant (including any Super Admin) is
  // reported as not found — missing-row semantics, never a 403 that would
  // confirm the row exists (multi-tenant spec §4.5).
  async disable(command: DisableAdminCommand): Promise<AdminUser> {
    const tenantId = requireTenantOwnerTenant(command.actor);
    if (command.targetId === command.actor.id) {
      throw new ForbiddenException('An admin cannot disable their own account');
    }

    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const target = await manager.findOneBy(AdminUserEntity, {
          id: command.targetId,
          tenantId,
        });
        if (!target) {
          throw new NotFoundException(`Admin ${command.targetId} not found`);
        }

        if (target.role === Role.TENANT_OWNER && target.isActive) {
          // `SELECT ... WHERE role = 'TENANT_OWNER' AND "tenantId" = $1 AND
          // "isActive" = true FOR UPDATE` — locks the matching rows
          // themselves, not a count. Two concurrent disable-owner
          // transactions for the same tenant both run this query; the second
          // blocks until the first commits or rolls back, so they can never
          // both observe "more than one active Tenant Owner" and both
          // proceed. Other tenants' owners are never counted or locked.
          const activeOwners = await manager
            .getRepository(AdminUserEntity)
            .createQueryBuilder('admin_user')
            .setLock('pessimistic_write')
            .where('admin_user.role = :role', { role: Role.TENANT_OWNER })
            .andWhere('admin_user.tenantId = :tenantId', { tenantId })
            .andWhere('admin_user.isActive = true')
            .getMany();

          if (activeOwners.length <= 1) {
            throw new ConflictException(
              'Cannot disable the last active Tenant Owner',
            );
          }
        }

        target.isActive = false;
        await manager.save(target);

        await this.auditLogger.log({
          actorId: command.actor.id,
          entityId: target.id,
          tenantId,
          action: 'admin.disabled',
          entityType: 'AdminUser',
          scope: AdminScope.TENANT,
        });

        return target;
      }),
    );
  }
}

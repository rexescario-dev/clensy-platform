import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import type { AuditLogger } from '../../../../platform/audit/application/audit-logger.port';
import { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { AdminUserEntity } from '../../infrastructure/persistence/admin-user.entity';

// Fixed bcrypt hash with no corresponding password, compared against on an
// unknown-email lookup so that path performs a hash comparison too (roughly
// matching a real lookup's cost) — otherwise an unknown email would return
// faster than a known one, giving a timing side-channel that would leak
// exactly the "no such account" fact spec §4.3's indistinguishability
// requirement exists to hide, even though every code path's *response* is
// already identical.
const DUMMY_PASSWORD_HASH =
  '$2b$10$HzHWu13c7cbqrhUGAY8ZQuR/0fU0nMVVyF.arX4XT1W4GgolPRC3u';

// Login has no accompanying state change, so its audit call is a plain
// best-effort write (spec §4.6's differentiated guarantee) — no transaction,
// no `runAuditInTransaction` wrapping, unlike `AdminsService.create`/
// `disable`.
@Injectable()
export class LoginService {
  constructor(
    @InjectRepository(AdminUserEntity)
    private readonly adminUserRepository: Repository<AdminUserEntity>,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  // Unknown email, wrong password, and disabled account all return `null`
  // through this exact same code path (spec §4.3) — there is no internal
  // branch that records *why* it failed anywhere a caller could observe it,
  // including in the audit metadata (spec §4.6: a fixed, non-discriminating
  // `reason`).
  async login(
    email: string,
    password: string,
  ): Promise<AuthenticatedPrincipal | null> {
    const normalizedEmail = email.toLowerCase();
    const admin = await this.adminUserRepository.findOneBy({
      email: normalizedEmail,
    });

    const passwordMatches = await bcrypt.compare(
      password,
      admin?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    const isValid = admin !== null && admin.isActive && passwordMatches;

    if (!isValid) {
      await this.auditLogger.log({
        actorId: null,
        action: 'admin.login.failed',
        entityType: null,
        entityId: null,
        metadata: { email: normalizedEmail, reason: 'invalid_credentials' },
      });
      return null;
    }

    await this.auditLogger.log({
      actorId: admin.id,
      action: 'admin.login.succeeded',
      entityType: 'AdminUser',
      entityId: admin.id,
    });

    return { id: admin.id, role: admin.role };
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminIdentityLookupPort } from '../../../platform/auth/application/admin-identity-lookup.port';
import { AuthenticatedPrincipal } from '../../../platform/auth/domain/authenticated-principal';
import { AdminUserEntity } from './persistence/admin-user.entity';

// Implements Task 2's `AdminIdentityLookupPort` (spec §5.2's cross-module
// dependency direction: `platform/auth` depends on this abstraction,
// `modules/admins` implements it — never the reverse). Not bound to the
// `ADMIN_IDENTITY_LOOKUP` token here; `AdminsModule` only exports this class
// so Task 6's composition root can wire the token binding.
@Injectable()
export class AdminIdentityLookupService implements AdminIdentityLookupPort {
  constructor(
    @InjectRepository(AdminUserEntity)
    private readonly adminUserRepository: Repository<AdminUserEntity>,
  ) {}

  // Filters on `isActive` at the query level (not "fetch then check") so a
  // disabled admin is never findable via this method at all — matching spec
  // §4.1's "authorization decision always uses current database values"
  // requirement.
  async findActiveAdminById(
    id: string,
  ): Promise<AuthenticatedPrincipal | null> {
    const admin = await this.adminUserRepository.findOneBy({
      id,
      isActive: true,
    });
    return admin ? { id: admin.id, role: admin.role } : null;
  }
}

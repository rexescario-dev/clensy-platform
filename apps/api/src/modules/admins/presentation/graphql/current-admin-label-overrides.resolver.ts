import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { TenantLabelOverridesService } from '../../application/services/tenant-label-overrides.service';
import {
  RoleLabels,
  TENANT_LABEL_LOCALE,
} from '../../domain/tenant-label-overrides';
import { CurrentAdminType } from './current-admin.type';
import {
  RoleLabelOverridesType,
  TenantLabelOverridesType,
} from './tenant-label-overrides.type';

// Spec §4.3, §4.7 items 1–2. No arguments and no request input: the parent
// `CurrentAdmin` is built only by `toCurrentAdminType(principal)` — from the
// AuthGuard'd `currentAdmin` query or the credential-verified `login` — so
// `parent.tenantId` is the principal's own tenant. Never reads TenantEntity;
// TenantLabelOverridesService is the column's only reader (§4.2).
@Resolver(() => CurrentAdminType)
export class CurrentAdminLabelOverridesResolver {
  constructor(
    private readonly tenantLabelOverridesService: TenantLabelOverridesService,
  ) {}

  @ResolveField('tenantLabelOverrides', () => TenantLabelOverridesType, {
    nullable: true,
  })
  async tenantLabelOverrides(
    @Parent() admin: CurrentAdminType,
  ): Promise<TenantLabelOverridesType | null> {
    if (admin.scope === AdminScope.PLATFORM || admin.tenantId === null) {
      return null;
    }
    const labels = await this.tenantLabelOverridesService.labelsFor(
      admin.tenantId,
    );
    return labels
      ? { locale: TENANT_LABEL_LOCALE, roles: toRoleLabelOverrides(labels) }
      : null;
  }
}

function toRoleLabelOverrides(labels: RoleLabels): RoleLabelOverridesType {
  return {
    ANALYST: labels.ANALYST ?? null,
    CUSTOMER_SUPPORT: labels.CUSTOMER_SUPPORT ?? null,
    FINANCE: labels.FINANCE ?? null,
    OPS_MANAGER: labels.OPS_MANAGER ?? null,
    SCHEDULER: labels.SCHEDULER ?? null,
    TENANT_OWNER: labels.TENANT_OWNER ?? null,
  };
}

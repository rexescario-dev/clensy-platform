import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RoleLabels,
  validateTenantLabelOverrides,
} from '../../domain/tenant-label-overrides';
import { TenantEntity } from '../../infrastructure/persistence/tenant.entity';

// Tenant label overrides spec §4.2, §4.7 item 3: the ONLY application code
// that reads `TenantEntity.labelOverrides` (a `select: false` column), and
// it always passes the raw value through the validator. One warning per
// rejected node or leaf, at its own path, never with the stored value.
@Injectable()
export class TenantLabelOverridesService {
  private readonly logger = new Logger(TenantLabelOverridesService.name);

  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
  ) {}

  async labelsFor(tenantId: string): Promise<RoleLabels | null> {
    const tenant = await this.tenantRepository
      .createQueryBuilder('tenant')
      .select('tenant.id')
      .addSelect('tenant.labelOverrides')
      .where('tenant.id = :tenantId', { tenantId })
      .getOne();
    const { labels, rejections } = validateTenantLabelOverrides(
      tenant?.labelOverrides ?? null,
    );
    for (const { path, reason } of rejections) {
      this.logger.warn(
        `tenant ${tenantId}: dropped label override at ${path} (${reason})`,
      );
    }
    return labels;
  }
}

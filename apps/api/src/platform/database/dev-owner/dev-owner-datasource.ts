import type { DataSourceOptions } from 'typeorm';
import { AdminUserEntity } from '../../../modules/admins/infrastructure/persistence/admin-user.entity';
import { TenantEntity } from '../../../modules/admins/infrastructure/persistence/tenant.entity';
import type { EffectiveConnectionSettings } from '../effective-connection-settings';

// E2E isolation spec §4.7: the dev-owner connection is opened only from the
// validated settings. installExtensions is false, so connecting writes
// nothing; there is no synchronize, migration run, url or extra.

export function devOwnerDataSourceOptions(
  settings: EffectiveConnectionSettings,
): Extract<DataSourceOptions, { type: 'postgres' }> {
  return {
    database: settings.database,
    entities: [AdminUserEntity, TenantEntity],
    host: settings.host,
    installExtensions: false,
    password: settings.password,
    port: settings.port,
    type: 'postgres',
    username: settings.username,
  };
}

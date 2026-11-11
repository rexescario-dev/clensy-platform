import { AdminUserEntity } from '../../../modules/admins/infrastructure/persistence/admin-user.entity';
import { TenantEntity } from '../../../modules/admins/infrastructure/persistence/tenant.entity';
import { devOwnerDataSourceOptions } from '../dev-owner/dev-owner-datasource';

// E2E isolation spec §4.7 boundaries: the entrypoint's connection is built
// from the validated settings only, and writes nothing but admin rows
// (installExtensions false; no synchronize, migrations or extra).
describe('devOwnerDataSourceOptions', () => {
  const settings = {
    database: 'clensy',
    host: 'localhost',
    password: 'pw',
    port: 5432,
    username: 'clensy',
  };

  it('has exactly the expected keys', () => {
    expect(Object.keys(devOwnerDataSourceOptions(settings)).sort()).toEqual([
      'database',
      'entities',
      'host',
      'installExtensions',
      'password',
      'port',
      'type',
      'username',
    ]);
  });

  it('uses the validated settings, the two entities and no extension install', () => {
    const options = devOwnerDataSourceOptions(settings);
    expect(options).toMatchObject({
      ...settings,
      installExtensions: false,
      type: 'postgres',
    });
    expect(options.entities).toEqual([AdminUserEntity, TenantEntity]);
  });
});

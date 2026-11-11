import { DataSource } from 'typeorm';
import {
  devOwnerEnvFilePath,
  DevOwnerRefusal,
  parseDevOwnerArgs,
  resolveDevOwnerConfig,
} from './dev-owner/dev-owner-config';
import { devOwnerDataSourceOptions } from './dev-owner/dev-owner-datasource';
import {
  formatDevOwnerResult,
  isFailure,
  seedDevOwner,
} from './dev-owner/dev-owner-seeder';
import { parseEnvFile } from './effective-connection-settings';

// `pnpm db:seed:dev-owner [--reset-password]` (E2E isolation spec §4.7).
// Explicit operation only: nothing runs it automatically (invariant 10).
// It never imports data-source.ts or the application module; its
// connection comes only from the validated settings.

async function run(): Promise<number> {
  let dataSource: DataSource | undefined;
  try {
    const { resetPassword } = parseDevOwnerArgs(process.argv.slice(2));
    const config = resolveDevOwnerConfig(
      process.env,
      parseEnvFile(devOwnerEnvFilePath()),
    );
    dataSource = new DataSource(devOwnerDataSourceOptions(config.settings));
    await dataSource.initialize();
    const result = await seedDevOwner(dataSource, {
      email: config.email,
      password: config.password,
      resetPassword,
    });
    console.log(
      formatDevOwnerResult(result, {
        database: config.settings.database,
        emailSource: config.emailSource,
        host: config.settings.host,
        passwordSource: config.passwordSource,
      }),
    );
    return isFailure(result) ? 1 : 0;
  } catch (error) {
    // Message only: never `parameters`, `detail` or a stack, which can
    // carry the email or a hash.
    console.log(
      error instanceof DevOwnerRefusal
        ? error.message
        : `dev-owner: error: ${(error as Error).message}`,
    );
    return 1;
  } finally {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  }
}

void run().then((code) => {
  process.exitCode = code;
});

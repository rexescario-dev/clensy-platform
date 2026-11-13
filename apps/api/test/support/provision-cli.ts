import {
  publishE2eTarget,
  readApiEnvFile,
  resolveE2eTarget,
} from './e2e-target';
import {
  provisionTestDatabase,
  runMigrationCli,
} from './provision-test-database';

// Child-process entrypoint for the §7 globalSetup tests (plan Task 5). It
// runs outside any Jest test environment. Only this file parses the
// test-only flag that skips migrations.

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const skip = args.length === 1 && args[0] === '--skip-migrations';
  if (args.length > 0 && !skip) {
    process.stderr.write(
      `provision-cli: unknown arguments ${args.join(' ')}\n`,
    );
    return 2;
  }
  try {
    const target = resolveE2eTarget(process.env, readApiEnvFile());
    publishE2eTarget(target);
    const result = await provisionTestDatabase(
      target,
      skip ? () => Promise.resolve() : runMigrationCli,
    );
    process.stdout.write(`PROVISION_RESULT ${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 1;
  }
}

void main().then((code) => {
  process.exitCode = code;
});

import {
  publishE2eTarget,
  readApiEnvFile,
  resolveE2eTarget,
} from './support/e2e-target';
import { provisionTestDatabase } from './support/provision-test-database';

// Jest globalSetup (E2E isolation spec §4.4). It resolves and publishes the
// E2E target, then creates, migrates and checks it. It runs outside every
// test environment, so its maintenance connection never opens in one.

export default async function globalSetup(): Promise<void> {
  const target = resolveE2eTarget(process.env, readApiEnvFile());
  publishE2eTarget(target);
  const result = await provisionTestDatabase(target);
  process.stdout.write(
    `e2e target ${target.database}@${target.host}:${target.port}: created=${result.created}, applied=${result.applied}, pending=0, unknown=${result.unknown}\n`,
  );
}

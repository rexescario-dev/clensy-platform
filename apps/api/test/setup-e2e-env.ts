import {
  publishE2eTarget,
  readApiEnvFile,
  resolveE2eTarget,
} from './support/e2e-target';

// Jest setupFiles (E2E isolation spec §4.2 ordering contract): resolve and
// publish the E2E target before any application code loads in the test
// environment, so ConfigModule and dotenv never overwrite it.
publishE2eTarget(resolveE2eTarget(process.env, readApiEnvFile()));

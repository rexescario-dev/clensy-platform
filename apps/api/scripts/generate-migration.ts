// Wrapper for `migration:generate` — accepts a plain phrase ("add customer
// phone number"), an already-PascalCase name ("AddCustomerPhoneNumber"), or
// anything in between, and turns it into TypeORM's required
// <migrations-dir>/<PascalCaseName> path argument.
import { execSync } from 'child_process';

const MIGRATIONS_DIR = 'src/platform/database/migrations';

const phrase = process.argv.slice(2).join(' ').trim();
if (!phrase) {
  console.error('Usage: pnpm migration:generate <name or short phrase>');
  console.error('Example: pnpm migration:generate add customer phone number');
  process.exit(1);
}

function toPascalCase(input: string): string {
  return input
    // split camelCase/PascalCase boundaries into separate words first, so an
    // already-PascalCase name passes through unchanged instead of getting
    // lowercased into one long word
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

const name = toPascalCase(phrase);
const migrationPath = `${MIGRATIONS_DIR}/${name}`;

console.log(`Generating migration: ${migrationPath}`);
try {
  execSync(`pnpm typeorm migration:generate ${migrationPath}`, {
    stdio: 'inherit',
  });
} catch (error) {
  // TypeORM already printed the real reason (e.g. "No changes in database
  // schema were found") — just propagate the exit code, not a Node stack trace.
  const status = (error as { status?: number }).status;
  process.exit(typeof status === 'number' ? status : 1);
}

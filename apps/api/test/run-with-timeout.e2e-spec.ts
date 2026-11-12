import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runWithTimeout } from './support/run-with-timeout';

// M7 observation 2: on timeout, the migration child's whole process tree is
// killed and awaited, so no grandchild (ts-node under pnpm) keeps running.
// These cases need no database.

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitUntilDead(pid: number, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) {
      return true;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  return !isAlive(pid);
}

describe('runWithTimeout', () => {
  const env = { PATH: process.env.PATH };

  it('resolves with exit code 0 and the stderr tail on success', async () => {
    const run = await runWithTimeout(
      process.execPath,
      ['-e', "process.stderr.write('done'); process.exit(0)"],
      { cwd: tmpdir(), env, timeoutMs: 20_000 },
    );
    expect(run).toEqual({ code: 0, stderr: 'done', timedOut: false });
  });

  it('resolves with a non-zero exit code without a timeout', async () => {
    const run = await runWithTimeout(
      process.execPath,
      ['-e', 'process.exit(3)'],
      { cwd: tmpdir(), env, timeoutMs: 20_000 },
    );
    expect(run).toEqual({ code: 3, stderr: '', timedOut: false });
  });

  it('keeps only the last 2 KB of stderr', async () => {
    const run = await runWithTimeout(
      process.execPath,
      ['-e', "process.stderr.write('a'.repeat(5000) + 'END')"],
      { cwd: tmpdir(), env, timeoutMs: 20_000 },
    );
    expect(run.stderr).toHaveLength(2048);
    expect(run.stderr.endsWith('END')).toBe(true);
  });

  it('on timeout kills the child and its grandchild, and waits for the child to exit', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'run-with-timeout-'));
    const pidFile = join(dir, 'grandchild.pid');
    try {
      const started = Date.now();
      const run = await runWithTimeout(
        'sh',
        ['-c', `sleep 300 & echo $! > '${pidFile}'; wait`],
        { cwd: dir, env, timeoutMs: 1_000 },
      );
      expect(run.timedOut).toBe(true);
      expect(run.code).toBeNull();
      expect(Date.now() - started).toBeLessThan(20_000);
      const grandchild = Number(readFileSync(pidFile, 'utf8').trim());
      expect(grandchild).toBeGreaterThan(0);
      expect(await waitUntilDead(grandchild, 5_000)).toBe(true);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  }, 30_000);
});

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apiRoot } from './support/migration-files';
import { runChild } from './support/run-child';

// Focused-review observation g: e2e-isolation's runChild SIGKILLed the
// provision-cli child at its own timeout. The child's migration runs in a
// separate, detached process group (runWithTimeout), so SIGKILL left that
// group running. runChild must let the child clean up (SIGTERM first), then
// force it (SIGKILL), report the timeout, and never wait on inherited pipes.
// These cases need no database; each is bounded by its Jest timeout.

function readPid(pidFile: string): number {
  return existsSync(pidFile) ? Number(readFileSync(pidFile, 'utf8').trim()) : 0;
}

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

function killIfAlive(pid: number): void {
  if (pid > 0) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already gone.
    }
  }
}

const tsNode = join(apiRoot, 'node_modules/ts-node/register');
const helper = JSON.stringify(join(apiRoot, 'test/support/run-with-timeout'));
const env = {
  PATH: process.env.PATH,
  TS_NODE_PROJECT: join(apiRoot, 'tsconfig.json'),
};

describe('runChild', () => {
  let dir: string;
  let pidFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'run-child-'));
    pidFile = join(dir, 'grandchild.pid');
  });

  afterEach(() => {
    killIfAlive(readPid(pidFile));
    rmSync(dir, { force: true, recursive: true });
  });

  it('returns the exit status and output when the child finishes in time', async () => {
    const run = await runChild(
      process.execPath,
      ['-e', "process.stdout.write('out'); process.stderr.write('err')"],
      env,
      20_000,
      { cwd: dir },
    );
    expect(run).toEqual({
      status: 0,
      stderr: 'err',
      stdout: 'out',
      timedOut: false,
    });
  }, 30_000);

  // The provision-cli shape: a Node child whose runWithTimeout (long
  // timeout) runs a detached group holding a grandchild.
  it('on timeout, the child cleans up its detached migration group', async () => {
    const script = `
      const { runWithTimeout } = require(${helper});
      runWithTimeout('sh', ['-c', ${JSON.stringify(`sleep 300 & echo $! > '${pidFile}'; wait`)}], {
        cwd: ${JSON.stringify(dir)}, env: { PATH: process.env.PATH }, timeoutMs: 600000,
      });
      setInterval(() => {}, 1000);
    `;
    const started = Date.now();
    const run = await runChild(
      process.execPath,
      ['-r', tsNode, '-e', script],
      env,
      4_000,
      { cwd: dir, graceMs: 5_000 },
    );
    const grandchild = readPid(pidFile);
    expect(grandchild).toBeGreaterThan(0);
    expect(run.timedOut).toBe(true);
    expect(run.status).toBeNull();
    expect(Date.now() - started).toBeLessThan(15_000);
    expect(await waitUntilDead(grandchild, 5_000)).toBe(true);
  }, 40_000);

  it('a child that ignores SIGTERM is killed after the grace period', async () => {
    const started = Date.now();
    const run = await runChild(
      process.execPath,
      [
        '-e',
        "process.on('SIGTERM', () => {}); process.stdout.write('ready'); setInterval(() => {}, 1000);",
      ],
      env,
      1_000,
      { cwd: dir, graceMs: 1_000 },
    );
    expect(run.timedOut).toBe(true);
    expect(run.stdout).toBe('ready');
    expect(Date.now() - started).toBeLessThan(10_000);
  }, 30_000);

  // A process that left the child's group still holds the pipes; the
  // timed-out run must settle anyway.
  const hasSetsid = (() => {
    try {
      execFileSync('sh', ['-c', 'command -v setsid'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();
  (hasSetsid ? it : it.skip)(
    'settles at the timeout when an escaped process holds the pipes',
    async () => {
      const started = Date.now();
      const run = await runChild(
        'sh',
        ['-c', `setsid sleep 300 & echo $! > '${pidFile}'; sleep 300`],
        env,
        1_000,
        { cwd: dir, graceMs: 1_000 },
      );
      expect(run.timedOut).toBe(true);
      expect(Date.now() - started).toBeLessThan(10_000);
    },
    30_000,
  );

  // Ctrl-C still reaches the work although runChild's child is detached: a
  // SIGINT to the outer process's group (a stand-in for Jest) ends the
  // migration grandchild. Every wait here is bounded.
  it('a Ctrl-C to the parent process group also ends the migration grandchild', async () => {
    const runChildModule = JSON.stringify(
      join(apiRoot, 'test/support/run-child'),
    );
    const innerPidFile = join(dir, 'inner.pid');
    const inner = `
      require('node:fs').writeFileSync(${JSON.stringify(innerPidFile)}, String(process.pid));
      const { runWithTimeout } = require(${helper});
      runWithTimeout('sh', ['-c', ${JSON.stringify(`sleep 300 & echo $! > '${pidFile}'; wait`)}], {
        cwd: ${JSON.stringify(dir)}, env: { PATH: process.env.PATH }, timeoutMs: 600000,
      });
      setInterval(() => {}, 1000);
    `;
    const outer = `
      const { runChild } = require(${runChildModule});
      runChild(process.execPath, ['-r', ${JSON.stringify(tsNode)}, '-e', ${JSON.stringify(inner)}],
        { PATH: process.env.PATH, TS_NODE_PROJECT: process.env.TS_NODE_PROJECT }, 600000,
        { cwd: ${JSON.stringify(dir)} });
    `;
    const parent = spawn(process.execPath, ['-r', tsNode, '-e', outer], {
      cwd: dir,
      detached: true,
      env,
      stdio: 'ignore',
    });
    const parentExited = new Promise<void>((resolveExit) =>
      parent.on('exit', () => resolveExit()),
    );
    try {
      const deadline = Date.now() + 20_000;
      while (readPid(pidFile) === 0 && Date.now() < deadline) {
        await new Promise((resolveWait) => setTimeout(resolveWait, 50));
      }
      const grandchild = readPid(pidFile);
      expect(grandchild).toBeGreaterThan(0);
      process.kill(-(parent.pid as number), 'SIGINT');
      await Promise.race([
        parentExited,
        new Promise((resolveWait) => setTimeout(resolveWait, 10_000)),
      ]);
      expect(parent.exitCode !== null || parent.signalCode !== null).toBe(true);
      expect(await waitUntilDead(grandchild, 5_000)).toBe(true);
    } finally {
      // Clean up even when the property fails: the outer group, and the
      // inner child's own (detached) group.
      for (const leader of [parent.pid as number, readPid(innerPidFile)]) {
        if (leader > 0) {
          try {
            process.kill(-leader, 'SIGKILL');
          } catch {
            // Already gone.
          }
        }
      }
    }
  }, 60_000);
});

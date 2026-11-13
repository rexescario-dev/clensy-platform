import { execFileSync, spawn } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
    expect(run.status).toBeNull();
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
        ['-c', `setsid sleep 300 & echo $! > '${pidFile}'; exec sleep 300`],
        env,
        1_000,
        { cwd: dir, graceMs: 1_000 },
      );
      expect(run.timedOut).toBe(true);
      expect(Date.now() - started).toBeLessThan(10_000);
    },
    30_000,
  );

  // Review B-1: inside a Jest test environment `process` is Jest's sandboxed
  // copy, so signal listeners registered there never fire. This test runs a
  // REAL Jest process whose test calls runChild on a provision-cli-shaped
  // child, then sends SIGINT to Jest's whole process group, as a terminal's
  // Ctrl-C does. Nothing may survive. Every wait is bounded, and cleanup
  // kills every recorded group and pid whatever the outcome.
  it('a Ctrl-C to a real Jest run ends the child and its migration grandchild', async () => {
    const innerPidFile = join(dir, 'inner.pid');
    const inner = `
      require('node:fs').writeFileSync(${JSON.stringify(innerPidFile)}, String(process.pid));
      const { runWithTimeout } = require(${helper});
      runWithTimeout('sh', ['-c', ${JSON.stringify(`sleep 300 & echo $! > '${pidFile}'; wait`)}], {
        cwd: ${JSON.stringify(dir)}, env: { PATH: process.env.PATH }, timeoutMs: 600000,
      });
      setInterval(() => {}, 1000);
    `;
    writeFileSync(
      join(dir, 'ctrlc.probe.js'),
      `const { runChild } = require(${JSON.stringify(join(apiRoot, 'test/support/run-child.ts'))});
test('runChild under Jest', async () => {
  await runChild(process.execPath, ['-r', ${JSON.stringify(tsNode)}, '-e', ${JSON.stringify(inner)}],
    { PATH: process.env.PATH, TS_NODE_PROJECT: ${JSON.stringify(env.TS_NODE_PROJECT)} }, 600000,
    { cwd: ${JSON.stringify(dir)} });
}, 600000);
`,
    );
    writeFileSync(
      join(dir, 'jest.json'),
      JSON.stringify({
        maxWorkers: 1,
        moduleFileExtensions: ['js', 'json', 'ts'],
        rootDir: dir,
        testEnvironment: 'node',
        testRegex: '\\.probe\\.js$',
        transform: {
          '^.+\\.ts$': [
            require.resolve('ts-jest', { paths: [apiRoot] }),
            { diagnostics: false, tsconfig: join(apiRoot, 'tsconfig.json') },
          ],
        },
      }),
    );
    // Detached: the Jest run gets its own process group, as a terminal job.
    const jest = spawn(
      process.execPath,
      [
        require.resolve('jest/bin/jest', { paths: [apiRoot] }),
        '--config',
        join(dir, 'jest.json'),
      ],
      { cwd: apiRoot, detached: true, env: { ...process.env } },
    );
    let output = '';
    jest.stdout.on('data', (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-2048);
    });
    jest.stderr.on('data', (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-2048);
    });
    let jestExited = false;
    const jestExit = new Promise<void>((resolveExit) =>
      jest.on('exit', () => {
        jestExited = true;
        resolveExit();
      }),
    );
    const innerPid = (): number => readPid(innerPidFile);
    try {
      const readyBy = Date.now() + 60_000;
      while (readPid(pidFile) === 0 && !jestExited && Date.now() < readyBy) {
        await new Promise((resolveWait) => setTimeout(resolveWait, 100));
      }
      const grandchild = readPid(pidFile);
      if (grandchild === 0) {
        throw new Error(
          `the migration grandchild never started (Jest ${jestExited ? 'exited' : 'still running'}); Jest output: ${JSON.stringify(output)}`,
        );
      }
      const inner = innerPid();
      process.kill(-(jest.pid as number), 'SIGINT');
      let raceTimer: NodeJS.Timeout | undefined;
      await Promise.race([
        jestExit,
        new Promise((resolveWait) => {
          raceTimer = setTimeout(resolveWait, 15_000);
        }),
      ]);
      // Cleared so no timer outlives the test (re-review N-11).
      clearTimeout(raceTimer);
      expect(jestExited).toBe(true);
      expect(await waitUntilDead(inner, 5_000)).toBe(true);
      expect(await waitUntilDead(grandchild, 5_000)).toBe(true);
    } finally {
      for (const leader of [jest.pid as number, innerPid()]) {
        if (leader > 0) {
          try {
            process.kill(-leader, 'SIGKILL');
          } catch {
            // Not a group leader, or already gone.
          }
          killIfAlive(leader);
        }
      }
    }
  }, 120_000);
});

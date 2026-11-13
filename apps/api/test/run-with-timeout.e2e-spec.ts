import { execFileSync, spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apiRoot } from './support/migration-files';
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

/** A grandchild that holds the inherited pipes open, its pid in pidFile. */
function treeScript(pidFile: string): string {
  return `sleep 300 & echo $! > '${pidFile}'; wait`;
}

function readPid(pidFile: string): number {
  return existsSync(pidFile) ? Number(readFileSync(pidFile, 'utf8').trim()) : 0;
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

/**
 * Runs `runWithTimeout` inside a separate Node process, so a broken
 * implementation cannot hang this test: the child is killed at `limitMs`.
 * `detached` puts the child in its own process group, as a terminal job.
 */
function runInNode(
  script: string,
  env: Record<string, string | undefined>,
  limitMs: number,
  onSpawn?: (pid: number, hasExited: () => boolean) => void,
): Promise<{
  elapsedMs: number;
  killedAtLimit: boolean;
  stderr: string;
  stdout: string;
}> {
  return new Promise((resolveRun) => {
    const started = Date.now();
    const child = spawn(
      process.execPath,
      ['-r', join(apiRoot, 'node_modules/ts-node/register'), '-e', script],
      {
        cwd: apiRoot,
        detached: true,
        env: { ...env, TS_NODE_PROJECT: join(apiRoot, 'tsconfig.json') },
      },
    );
    let stdout = '';
    let stderr = '';
    let killedAtLimit = false;
    let exited = false;
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2048);
    });
    const timer = setTimeout(() => {
      killedAtLimit = true;
      try {
        process.kill(-(child.pid as number), 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }, limitMs);
    if (onSpawn !== undefined && child.pid !== undefined) {
      onSpawn(child.pid, () => exited);
    }
    child.on('exit', () => {
      exited = true;
      clearTimeout(timer);
      child.stdout.destroy();
      child.stderr.destroy();
      resolveRun({
        elapsedMs: Date.now() - started,
        killedAtLimit,
        stderr,
        stdout,
      });
    });
  });
}

const helper = JSON.stringify(join(apiRoot, 'test/support/run-with-timeout'));

/**
 * Waits for the grandchild's pid file, polling every 50 ms. It always ends:
 * it resolves with the pid, or rejects with a diagnostic at the deadline or
 * as soon as the helper process has exited without writing the file.
 */
function waitForPidFile(
  pidFile: string,
  options: { deadlineMs: number; hasExited: () => boolean },
): Promise<number> {
  const deadline = Date.now() + options.deadlineMs;
  return new Promise((resolveWait, rejectWait) => {
    const poll = (): void => {
      const pid = readPid(pidFile);
      if (pid > 0) {
        resolveWait(pid);
      } else if (options.hasExited()) {
        rejectWait(
          new Error(
            `the helper process exited before writing the grandchild pid file ${pidFile}`,
          ),
        );
      } else if (Date.now() >= deadline) {
        rejectWait(
          new Error(
            `the grandchild pid file ${pidFile} was not written within ${options.deadlineMs} ms`,
          ),
        );
      } else {
        setTimeout(poll, 50);
      }
    };
    poll();
  });
}

// Focused-review observation c: the Ctrl-C test's readiness poll had no stop
// condition. The poll must end, with a diagnostic, on a deadline or as soon
// as the helper process has exited.
describe('waitForPidFile (readiness poll of the Ctrl-C test)', () => {
  it('fails with a diagnostic when the pid file never appears', async () => {
    const started = Date.now();
    await expect(
      waitForPidFile(join(tmpdir(), 'never-written-', String(process.pid)), {
        deadlineMs: 300,
        hasExited: () => false,
      }),
    ).rejects.toThrow(/was not written within 300 ms/);
    expect(Date.now() - started).toBeLessThan(2_000);
  }, 5_000);

  it('stops as soon as the helper process has exited', async () => {
    const started = Date.now();
    let exited = false;
    setTimeout(() => {
      exited = true;
    }, 100);
    await expect(
      waitForPidFile(join(tmpdir(), 'never-written-', String(process.pid)), {
        deadlineMs: 60_000,
        hasExited: () => exited,
      }),
    ).rejects.toThrow(/the helper process exited before writing/);
    expect(Date.now() - started).toBeLessThan(2_000);
  }, 5_000);

  it('resolves with the pid once the file is written', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wait-for-pid-'));
    const pidFile = join(dir, 'grandchild.pid');
    try {
      setTimeout(() => writeFileSync(pidFile, '4242\n'), 100);
      await expect(
        waitForPidFile(pidFile, { deadlineMs: 2_000, hasExited: () => false }),
      ).resolves.toBe(4242);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  }, 5_000);
});

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

  // Re-review finding 1: with no `ps` on PATH the timeout must still kill
  // the whole tree and settle. The PATH holds only sh and sleep.
  it('without ps on PATH, a timeout still kills the grandchild and settles', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'run-with-timeout-nops-'));
    const bin = join(dir, 'bin');
    const pidFile = join(dir, 'grandchild.pid');
    mkdirSync(bin);
    for (const tool of ['sh', 'sleep']) {
      symlinkSync(
        execFileSync('sh', ['-c', `command -v ${tool}`], {
          encoding: 'utf8',
        }).trim(),
        join(bin, tool),
      );
    }
    try {
      const script = `
        const { runWithTimeout } = require(${helper});
        runWithTimeout('sh', ['-c', ${JSON.stringify(treeScript(pidFile))}], {
          cwd: ${JSON.stringify(dir)}, env: { PATH: ${JSON.stringify(bin)} }, timeoutMs: 1000,
        }).then((run) => console.log('SETTLED ' + JSON.stringify(run)));
      `;
      const run = await runInNode(script, { PATH: bin }, 20_000);
      const grandchild = readPid(pidFile);
      try {
        expect(grandchild).toBeGreaterThan(0);
        expect(run.killedAtLimit).toBe(false);
        expect(run.stdout).toContain('SETTLED {"code":null');
        expect(run.stdout).toContain('"timedOut":true');
        expect(await waitUntilDead(grandchild, 5_000)).toBe(true);
      } finally {
        killIfAlive(grandchild);
      }
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  }, 40_000);

  // The tree must still receive a terminal Ctrl-C: SIGINT to the parent's
  // whole process group, as a terminal sends it, leaves no grandchild.
  it('a Ctrl-C to the parent process group also ends the grandchild', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'run-with-timeout-sigint-'));
    const pidFile = join(dir, 'grandchild.pid');
    try {
      const script = `
        const { runWithTimeout } = require(${helper});
        runWithTimeout('sh', ['-c', ${JSON.stringify(treeScript(pidFile))}], {
          cwd: ${JSON.stringify(dir)}, env: { PATH: process.env.PATH }, timeoutMs: 60000,
        });
      `;
      // The readiness poll always settles (deadline, or the helper exiting),
      // and the test waits for it, so a failure reports why instead of hanging.
      let readiness: Promise<Error | undefined> = Promise.resolve(undefined);
      const run = await runInNode(
        script,
        { PATH: process.env.PATH },
        20_000,
        (pid, hasExited) => {
          readiness = waitForPidFile(pidFile, {
            deadlineMs: 15_000,
            hasExited,
          }).then(
            () => {
              process.kill(-pid, 'SIGINT');
              return undefined;
            },
            (error: Error) => error,
          );
        },
      );
      const notReady = await readiness;
      if (notReady !== undefined) {
        throw new Error(
          `${notReady.message}; helper stdout: ${JSON.stringify(run.stdout)}; stderr: ${JSON.stringify(run.stderr)}`,
        );
      }
      const grandchild = readPid(pidFile);
      try {
        expect(grandchild).toBeGreaterThan(0);
        expect(run.killedAtLimit).toBe(false);
        expect(await waitUntilDead(grandchild, 5_000)).toBe(true);
      } finally {
        killIfAlive(grandchild);
      }
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  }, 40_000);

  // Requirement: inherited pipes can never keep the run waiting. Here the
  // child exits at once, but a grandchild that left the process group
  // (setsid) still holds the pipes; the timeout must still settle the run.
  const hasSetsid = (() => {
    try {
      execFileSync('sh', ['-c', 'command -v setsid'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();
  (hasSetsid ? it : it.skip)(
    'settles at the timeout when an escaped grandchild holds the pipes',
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'run-with-timeout-escaped-'));
      const pidFile = join(dir, 'grandchild.pid');
      try {
        const script = `
          const { runWithTimeout } = require(${helper});
          runWithTimeout('sh', ['-c', ${JSON.stringify(`setsid sleep 300 & echo $! > '${pidFile}'; exit 0`)}], {
            cwd: ${JSON.stringify(dir)}, env: { PATH: process.env.PATH }, timeoutMs: 1000,
          }).then((run) => { console.log('SETTLED ' + JSON.stringify(run)); process.exit(0); });
        `;
        const run = await runInNode(script, { PATH: process.env.PATH }, 20_000);
        try {
          expect(run.killedAtLimit).toBe(false);
          expect(run.stdout).toContain('SETTLED {"code":0');
          expect(run.stdout).toContain('"timedOut":true');
        } finally {
          killIfAlive(readPid(pidFile));
        }
      } finally {
        rmSync(dir, { force: true, recursive: true });
      }
    },
    40_000,
  );
});

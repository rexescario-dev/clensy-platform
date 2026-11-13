import { spawn } from 'node:child_process';
import { apiRoot } from './migration-files';

// Runs a child process for e2e-isolation.e2e-spec.ts (focused-review
// observation g of #227). The provision-cli child runs its migration in a
// separate, detached process group (runWithTimeout), which a signal to the
// child's own group does not reach. Only the child can clean that group up,
// and runWithTimeout does so on SIGTERM. So on timeout this helper:
//
// 1. sends SIGTERM to the child's process group (the child is spawned
//    `detached`, so it leads one), letting it kill its migration group;
// 2. after `graceMs`, sends SIGKILL to the same group;
// 3. settles on the child's exit with the pipes destroyed, so a process
//    that left the group cannot keep the run waiting.
//
// runWithTimeout itself is not reused: it SIGKILLs at once, which is what
// orphaned the migration group, and it discards stdout, which callers need.
// Because a detached group no longer receives the terminal's Ctrl-C,
// SIGINT, SIGTERM and SIGHUP to this process are forwarded to the group as
// SIGTERM while the child runs (then take their usual course). Linux and
// macOS only, like runWithTimeout. The spawn is asynchronous: a synchronous
// spawn would block this process's event loop, so an in-process counting
// listener could neither accept nor count the child's connections.

export interface ChildRun {
  /** Exit code, or null when the child was ended by a signal. */
  status: number | null;
  stderr: string;
  stdout: string;
  timedOut: boolean;
}

const DEFAULT_GRACE_MS = 5_000;
const FORWARDED_SIGNALS: readonly NodeJS.Signals[] = [
  'SIGHUP',
  'SIGINT',
  'SIGTERM',
];

function signalGroup(
  leaderPid: number | undefined,
  signal: NodeJS.Signals,
): void {
  if (leaderPid === undefined) {
    return;
  }
  try {
    process.kill(-leaderPid, signal);
  } catch {
    // The group is already gone.
  }
}

export function runChild(
  command: string,
  args: string[],
  env: Record<string, string | undefined>,
  timeoutMs: number,
  options: { cwd?: string; graceMs?: number } = {},
): Promise<ChildRun> {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? apiRoot,
      detached: true,
      env,
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    let forceTimer: NodeJS.Timeout | undefined;

    const onSignal = (signal: NodeJS.Signals): void => {
      signalGroup(child.pid, 'SIGTERM');
      release();
      if (process.listenerCount(signal) === 0) {
        // No other handler: restore the signal's default effect.
        process.kill(process.pid, signal);
      }
    };
    const onExit = (): void => signalGroup(child.pid, 'SIGKILL');
    function release(): void {
      for (const signal of FORWARDED_SIGNALS) {
        process.removeListener(signal, onSignal);
      }
      process.removeListener('exit', onExit);
    }
    for (const signal of FORWARDED_SIGNALS) {
      process.on(signal, onSignal);
    }
    process.on('exit', onExit);

    const finish = (status: number | null): void => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        clearTimeout(forceTimer);
        release();
        resolveRun({ status, stderr, stdout, timedOut });
      }
    };
    // A timed-out run does not wait for `close`: a process outside the
    // group could hold the pipes open indefinitely.
    const settleTimedOut = (status: number | null): void => {
      // Anything left in the group after the child exited is forced now.
      signalGroup(child.pid, 'SIGKILL');
      child.stdout.destroy();
      child.stderr.destroy();
      finish(status);
    };

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      timedOut = true;
      signalGroup(child.pid, 'SIGTERM');
      forceTimer = setTimeout(() => {
        signalGroup(child.pid, 'SIGKILL');
        if (child.exitCode !== null || child.signalCode !== null) {
          // The child already exited; only an escaped holder of the pipes
          // was keeping the run open.
          settleTimedOut(child.exitCode);
        }
      }, options.graceMs ?? DEFAULT_GRACE_MS);
    }, timeoutMs);
    child.on('exit', (status) => {
      if (timedOut) {
        settleTimedOut(status);
      }
    });
    child.on('close', (status) => {
      finish(status);
    });
  });
}

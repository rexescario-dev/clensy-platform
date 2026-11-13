import { spawn } from 'node:child_process';
import { apiRoot } from './migration-files';

// Runs a child process for e2e-isolation.e2e-spec.ts (focused-review
// observation g of #227). The provision-cli child runs its migration in a
// separate, detached process group (runWithTimeout), which only the child
// can clean up: runWithTimeout kills that group on SIGTERM, but cannot on
// SIGKILL. So on timeout this helper:
//
// 1. sends SIGTERM to the child, letting it kill its migration group;
// 2. after `graceMs`, sends SIGKILL to the child;
// 3. settles on the child's exit with the pipes destroyed, so a process
//    that still holds them (one that left the child's control) cannot keep
//    the run waiting.
//
// The child is NOT detached, and no signal handlers are installed: this
// helper runs inside a Jest test environment, whose `process` is a sandboxed
// copy on which signal listeners never fire (review finding B-1). Staying in
// Jest's process group is what lets a terminal's Ctrl-C reach the child
// directly, and the child's own runWithTimeout then ends its migration group.
// The spawn is asynchronous: a synchronous spawn would block this process's
// event loop, so an in-process counting listener could neither accept nor
// count the child's connections.

export interface ChildRun {
  /** Exit code, or null when the child was ended by a signal. */
  status: number | null;
  stderr: string;
  stdout: string;
  timedOut: boolean;
}

const DEFAULT_GRACE_MS = 5_000;

export function runChild(
  command: string,
  args: string[],
  env: Record<string, string | undefined>,
  timeoutMs: number,
  options: { cwd?: string; graceMs?: number } = {},
): Promise<ChildRun> {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { cwd: options.cwd ?? apiRoot, env });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    let forceTimer: NodeJS.Timeout | undefined;

    const finish = (status: number | null): void => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        clearTimeout(forceTimer);
        resolveRun({ status, stderr, stdout, timedOut });
      }
    };
    // A timed-out run does not wait for `close`: a process the child left
    // behind could hold the pipes open indefinitely.
    const settleTimedOut = (status: number | null): void => {
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
      child.kill('SIGTERM');
      forceTimer = setTimeout(() => {
        if (child.exitCode !== null || child.signalCode !== null) {
          // The child already exited; only a leftover holder of the pipes
          // was keeping the run open.
          settleTimedOut(child.exitCode);
        } else {
          child.kill('SIGKILL');
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

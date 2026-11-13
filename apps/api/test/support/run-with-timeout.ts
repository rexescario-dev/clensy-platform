import { spawn } from 'node:child_process';

// Runs a child with a timeout (M7 observation 2; re-review finding 1).
//
// `pnpm run …` starts a shell that starts ts-node, so killing only the child
// would leave a grandchild running and holding the stdio pipes open. The
// child is therefore spawned `detached`, which on Linux and macOS (the
// supported platforms) makes it the leader of a new process group that its
// descendants inherit. The timeout sends SIGKILL to that whole group, with
// no dependency on `ps`. A timed-out run settles on the child's exit (or at
// once, if the child had already exited), with this side of the pipes
// destroyed, so a process that left the group cannot keep the run waiting.
//
// A detached group no longer receives the terminal's Ctrl-C, so while the
// child runs, SIGINT, SIGTERM and SIGHUP to this process also SIGKILL the
// group (then take their usual course), and so does this process exiting.

export interface TimedRun {
  /** Exit code, or null when the child was killed. */
  code: number | null;
  /** The last 2 KB of stderr. */
  stderr: string;
  timedOut: boolean;
}

const STDERR_TAIL = 2048;
const FORWARDED_SIGNALS: readonly NodeJS.Signals[] = [
  'SIGHUP',
  'SIGINT',
  'SIGTERM',
];

function killGroup(leaderPid: number | undefined): void {
  if (leaderPid === undefined) {
    return;
  }
  try {
    process.kill(-leaderPid, 'SIGKILL');
  } catch {
    // The group is already gone.
  }
}

export function runWithTimeout(
  command: string,
  args: readonly string[],
  options: {
    cwd: string;
    env: Record<string, string | undefined>;
    timeoutMs: number;
  },
): Promise<TimedRun> {
  return new Promise<TimedRun>((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      detached: true,
      env: options.env,
    });
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const onSignal = (signal: NodeJS.Signals): void => {
      killGroup(child.pid);
      release();
      if (process.listenerCount(signal) === 0) {
        // No other handler: restore the signal's default effect.
        process.kill(process.pid, signal);
      }
    };
    const onExit = (): void => killGroup(child.pid);
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

    const finish = (outcome: () => void): void => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        release();
        outcome();
      }
    };

    child.stdout.resume();
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-STDERR_TAIL);
    });
    // Settles a timed-out run without waiting for `close`: a process outside
    // the group could hold the pipes open indefinitely.
    const settleTimedOut = (code: number | null): void => {
      child.stdout.destroy();
      child.stderr.destroy();
      finish(() => resolveRun({ code, stderr, timedOut }));
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child.pid);
      if (child.exitCode !== null || child.signalCode !== null) {
        // The child already exited; only an escaped holder of the pipes
        // was keeping the run open.
        settleTimedOut(child.exitCode);
      }
    }, options.timeoutMs);
    child.on('error', (error) => {
      finish(() => rejectRun(error));
    });
    child.on('exit', (code) => {
      if (timedOut) {
        settleTimedOut(code);
      }
    });
    child.on('close', (code) => {
      finish(() => resolveRun({ code, stderr, timedOut }));
    });
  });
}

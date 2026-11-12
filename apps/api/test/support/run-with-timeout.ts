import { execFileSync, spawn } from 'node:child_process';

// Runs a child with a timeout (M7 observation 2). On timeout the child's
// whole process tree is killed, not just the child: `pnpm run …` starts a
// shell that starts ts-node, and a surviving grandchild would both keep
// running and hold the stdio pipes open, so `close` would never fire. The
// child stays in this process group, so Ctrl-C still reaches the tree.
// The promise settles only on `close`, after the child has exited.

export interface TimedRun {
  /** Exit code, or null when the child was killed. */
  code: number | null;
  /** The last 2 KB of stderr. */
  stderr: string;
  timedOut: boolean;
}

const STDERR_TAIL = 2048;

/** The pid and every descendant of it, from one `ps` snapshot (POSIX). */
export function processTree(rootPid: number): number[] {
  const children = new Map<number, number[]>();
  const listing = execFileSync('ps', ['-A', '-o', 'pid=', '-o', 'ppid='], {
    encoding: 'utf8',
  });
  for (const line of listing.split('\n')) {
    const [pid, ppid] = line.trim().split(/\s+/).map(Number);
    if (Number.isInteger(pid) && Number.isInteger(ppid)) {
      children.set(ppid, [...(children.get(ppid) ?? []), pid]);
    }
  }
  const tree: number[] = [];
  const stack = [rootPid];
  while (stack.length > 0) {
    const pid = stack.pop() as number;
    if (!tree.includes(pid)) {
      tree.push(pid);
      stack.push(...(children.get(pid) ?? []));
    }
  }
  return tree;
}

function killTree(rootPid: number): void {
  let tree: number[];
  try {
    tree = processTree(rootPid);
  } catch {
    tree = [rootPid];
  }
  for (const pid of tree) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already gone.
    }
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
    const child = spawn(command, args, { cwd: options.cwd, env: options.env });
    let stderr = '';
    let timedOut = false;
    child.stdout.resume();
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-STDERR_TAIL);
    });
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid !== undefined) {
        killTree(child.pid);
      }
    }, options.timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      rejectRun(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolveRun({ code, stderr, timedOut });
    });
  });
}

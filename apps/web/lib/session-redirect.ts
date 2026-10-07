// The single-flight session redirect behind SessionGuard (session routing
// spec §4.3). Pure: the guard supplies the effects, so the latch is
// unit-tested without a DOM. The first report closes the latch and commits one
// clearStore() -> navigateToLogin() sequence; later reports join it. Dispose
// (the guard's unmount) stops new evidence from starting a sequence, but a
// committed sequence always runs to completion — there is deliberately no
// "still mounted?" check between its two steps (spec §5 invariant 10).
export interface SessionRedirectEffects {
  clearStore: () => Promise<unknown>;
  navigateToLogin: () => void;
}

export interface SessionRedirector {
  dispose: () => void;
  report: () => Promise<void>;
}

// The parts of a currentAdmin query result the session check reads.
export interface SessionCheckResult {
  data?: { currentAdmin?: unknown } | null;
  error?: unknown;
  errors?: readonly unknown[];
}

export function createSessionRedirector(effects: SessionRedirectEffects): SessionRedirector {
  let committed: Promise<void> | undefined;
  let disposed = false;

  return {
    dispose: () => {
      disposed = true;
    },
    report: () => {
      if (committed) return committed;
      if (disposed) return Promise.resolve();
      committed = runSessionRedirect(effects);
      return committed;
    },
  };
}

// Session evidence (2) (spec §3). The Accepted spec deliberately treats any
// successful, error-free result whose currentAdmin is null OR absent as
// no-principal evidence — including an absent `data` — as defensive client
// behavior; the API declares currentAdmin non-null, so neither is expected.
// Any error on the result means the check failed, which is never evidence.
export function isNoPrincipalResult(result: SessionCheckResult): boolean {
  if (result.error || result.errors?.length) return false;
  return result.data?.currentAdmin == null;
}

// One session check (spec §4.2). It reports to the redirector captured when
// the check started — never to whichever redirector is current when it
// settles — so a check outliving its guard (unmount, strict-mode remount)
// cannot act through a newer one. Checks are not cancelled: an out-of-order
// null still reports, and a later principal result never undoes a report. A
// rejection is not evidence (an UNAUTHENTICATED rejection has already raised
// the session signal).
export async function runSessionCheck(
  query: () => Promise<SessionCheckResult>,
  redirector: SessionRedirector,
): Promise<void> {
  let result: SessionCheckResult;
  try {
    result = await query();
  } catch {
    return;
  }
  if (isNoPrincipalResult(result)) await redirector.report();
}

async function runSessionRedirect(effects: SessionRedirectEffects): Promise<void> {
  try {
    await effects.clearStore();
  } catch {
    // Navigate regardless: a failed clear must not strand the user (spec §4.3).
  }
  effects.navigateToLogin();
}

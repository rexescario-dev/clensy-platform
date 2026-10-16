# Configuration-change convention

Governing contract: [Process Specification: Standardized Agent Workflows](../specs/agent-workflow-design.md) (§2.13)

This document is **workflow infrastructure**. It owns the detailed rules for **configuration tasks**: tasks whose deliverable is a live setting outside the repository. The process specification establishes the contract and the stage prompts establish stage-specific obligations; neither restates these rules. Rules are numbered C1–C9 so stages and records can cite them.

---

## C1. Definitions

- A **configuration task** is a task whose deliverable is a live setting outside the repository, for example repository or organization settings, rulesets or branch protection, cloud or IAM settings, or feature flags.
- A **configuration-change slice** is a slice whose plan contains at least one configuration task.
- An **outward-facing action** is an apply, a re-apply, a correction, a rollback, or an enforcement probe that attempts the forbidden or controlled action.
- A **read** is any operation that only observes the live system: recon of current state, capture of prior state (C7), read-back, and effective-state checks. A read is never an outward-facing action. An enforcement probe is a read until it attempts the forbidden or controlled action; that attempt is outward-facing.

## C2. Approved reference payload

- The specification MAY state the exact payload.
- For every outward-facing action, including corrections and rollbacks, the plan MUST either state the exact payload or action, or reference an exact payload or action stated in the Accepted specification, by section, at its Accepted revision, so M5 can determine exactly what will be sent. A reference that does not resolve to an exact payload or action does not satisfy C2.
- The spec/plan payload is the **approved reference**: the exact state or action humans approved M6 to use. It is not a runtime configuration source.
- The approved reference for a desired state authorizes only the actions stated for it. It does not by itself authorize a different operation, such as a corrective change to one field (C6).
- Documentation surfaces (for example READMEs, docs, code comments, CI files) MUST NOT contain a copy of the payload. They describe intent, scope, how to inspect the live setting, verification and the undo procedure.
- After an action, the live system is authoritative; read-back (C5) establishes what actually took effect.

## C3. Confirmation gate

- Each outward-facing action MUST have its own explicit human confirmation, given at the moment it runs, naming the action and its target.
- Acceptance of the specification or the plan is not that confirmation. A confirmation covers one action; a correction, re-apply, rollback or attempting probe needs its own.
- If the human declines, M6 stops before the action, records the decision, and the affected task is blocked.

## C4. Pre-send validation

Before every outward-facing action, M6 MUST build the outbound artifact outside the repository and check that it matches the approved reference (C2). An artifact that does not match is not sent.

## C5. Verification evidence

Configuration verification **replaces the code-task TDD requirement for configuration tasks**. `code` and `docs/process` tasks in the same slice keep their own verification rules. For each configuration task, the evidence MUST demonstrate each applicable layer:

- **Configured state:** what the configuration object says, read back and compared against the approved reference.
- **Effective state:** what the target actually inherits or uses, where that can differ from the configured object (for example through inheritance, precedence or other rules combining with it).
- **Behavioral enforcement:** whether the controlled behavior actually occurs, shown by a probe that observes behavior, not by reading configuration. A probe that attempts the forbidden or controlled action is gated under C3.

One command MAY serve as evidence for more than one layer only where the plan states why it demonstrates each (for example, a system in which the configured object is itself the effective state). Reading configuration never demonstrates behavioral enforcement. A layer the plan declares not applicable states why. The record states each command or call and its result.

## C6. Failure, diagnosis and recovery

A failed check in C5 stops verification. M6 takes no further outward-facing action until it has diagnosed the failure from recorded evidence.

- **Diagnosis before recovery.** A mismatch alone does not show its cause: the target system may have transformed the payload, another actor may have changed the setting, or the approved reference may be wrong. A failure is an **operational failure** only when the evidence establishes that the approved action did not produce the approved state.
- **Recovery only by an authorized action.** For an operational failure, M6 MAY carry out a correction or rollback only when its exact action and payload are already authorized under C2 for that case, and only through C3 and C4. This applies equally when the live setting has changed but a later check failed: M6 follows the correction or rollback path the Accepted specification or plan explicitly authorizes, and MUST NOT invent a recovery action.
- **Otherwise, return.**
  - Operational failure, but no authorized action covers it → return to **M4/M5**, so the plan states the action before anything is sent.
  - Cause not established by the evidence, or evidence that the Accepted design is insufficient or wrong → return to **M2/M3**.
- Before any return, M6 records the live state as it stands, so the earlier stage decides with current facts.

M6 never guesses a value or an action.

## C7. Undo procedure and prior state

- The plan MUST state the undo procedure for each configuration task, for example a delete or disable call, or restoration of a prior state.
- Reverting the repository change does not undo the live setting. The plan MUST say so.
- When a configuration task modifies or replaces an existing setting, M6 MUST capture the relevant prior live state through a read before the first apply. The captured prior state is the reference the undo procedure restores.
- Capturing prior state is a read and is not gated. Restoring it is a rollback and is gated (C3) and validated (C4) like any outward-facing action.

## C8. M7 live finding

For each configuration task, M7 records one **live finding**. A live finding is a configuration-specific finding recorded within M7. It is **not** an M7 outcome; M7 keeps exactly its two existing outcomes, and each finding determines which one applies:

| Live finding | M7 outcome |
| --- | --- |
| **Stays** | **Approved for merge**, when the rest of the review also has no merge blockers |
| **Corrected** | **Returned for Revision**: M6 carries out the correction under C2–C6, then M7 re-reviews |
| **Rolled back** | **Returned for Revision**: M6 carries out the rollback under C2–C4 and C7, then M7 re-reviews, unless the Accepted specification or plan explicitly establishes that the rollback ends the slice |

- **Stays** means the live configuration passed review. It is not an approval independent of the repository change; "Approved for merge" still governs the repository part.
- **Corrected** and **rolled back** both mean M7 does not approve the current live state, and necessarily produce **Returned for Revision**.
- The correction or rollback M6 carries out must be authorized under C2. If it is not, the return goes first to M4/M5 (or M2/M3) so it is stated and approved, as in C6.
- After a rollback, the Accepted specification or plan determines what follows: a return to M4 or M2, or ending the slice unmerged.
- M7 records the finding and never carries out a correction or rollback.

## C9. Recording

The M6 record and the Slice Completion Report's Validation table MUST show:

- each **confirmation event** itself: what the human confirmed, for which action, at which step (not merely that the plan required a confirmation);
- each pre-send validation result;
- each piece of C5 evidence, and any correction or rollback with its own confirmation.

The Slice Completion Report format is unchanged; these are rows in its existing [Validation table](reporting-conventions.md).

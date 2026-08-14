# Code Review Prompt

Governing contract: [Process Specification: Standardized Agent Workflows](../specs/agent-workflow-design.md) · Stage **M7** · Reporting: [reporting-conventions.md](../conventions/reporting-conventions.md)

## Purpose

Answer: **Does the implementation faithfully realize the accepted plan and satisfy quality standards?**

Review M6 output (diff / PR / change set) against the **Accepted** specification and **Accepted** implementation plan. Decide **Approved for merge** or **Returned for Revision**, with explicit rationale. Validate conformance, correctness, verification, scope discipline, and maintainability signals—without redesigning the product, rewriting the plan, or silently fixing the implementation into acceptance.

**Acceptance means:** The reviewer finds **no merge blockers** and believes the change set implements the authorized plan slice faithfully under the Accepted specification’s semantics, with adequate verification and no hidden scope expansion.

## When to use

- M6 has produced a change set marked ready for review
- Re-reviewing after M6 addressed a prior return (without requiring plan/spec changes)

## Preconditions

- Accepted specification and Accepted implementation plan are identified
- Review subject is the M6 change set (PR, branch, or equivalent)
- Prompt library conventions Accepted ([prompt-library.md](../conventions/prompt-library.md))
- Implementation Execution contract understood ([implementation-execution.md](implementation-execution.md)); do not re-implement under M6 rules here

Authoritative inputs (same dual model as M6):

| Artifact | Authority |
| --- | --- |
| Accepted specification | Product semantics |
| Accepted implementation plan | Sequencing and authorized scope |

## Instructions

1. **Identify the subject.** Record the **issue PR** (branch/paths)—expected to include Accepted plan + M6 change set per process spec §2.8—plus Accepted specification, Accepted plan path, and claimed completed tasks/slices.
2. **Inspect the artifact.** If the implementation artifact (diff, commit, PR, or branch) cannot actually be inspected, **stop and request it**. Do not fabricate a review.
3. **Confirm M6 gate.** Evidence that work began only after plan Accept (or is a legitimate resume after prior M7 return). If execution clearly preceded plan Accept, **Return**.
4. **Check incremental delivery.** If the submitted change set intentionally represents only a subset of the implementation plan, verify that the plan explicitly authorizes incremental delivery for that subset. Otherwise **Return** (missing work vs staged delivery must not be ambiguous).
5. **Check plan conformance.** Does the diff match authorized tasks/ownership? List plan tasks reviewed and mark each covered / deferred / missing. Silent task reordering, skipped tasks, or undeclared extras → **Return** (or require plan amendment via M4/M5).
6. **Check specification conformance.** Behavior and contracts match Accepted semantics. Contradictions or invented semantics → **Return**; if the gap is in the spec, require M2/M3—not a clever merge.
7. **Verify correctness and tests.** Record the exact verification evidence reviewed (CI status, test commands and results, logs, or equivalent). For code: tests cover the claimed behaviors; TDD evidence or equivalent verification is present where the plan required it. If verification cannot be confirmed, **Return**. Missing or misleading verification → **Return**.
8. **Assess quality without redesign.** Assess quality against repository conventions (prompt README, contribution rules, architecture boundaries) without redesigning Accepted behavior. Flag clear defects: incorrectness, unnecessary complexity for the task, duplication that harms the slice, obvious regression risk, broken boundaries. Do **not** reject merely because you would have structured internals differently when behavior and plan conformance hold.
9. **Reject hidden scope expansion.** Drive-by refactors, dependency upgrades, API expansions, or docs campaigns outside the plan → **Return**.
10. **No silent rewrite / no fix-during-review.** Reviewers MUST NOT modify implementation code as part of review. Any required implementation changes belong in M6 after a Return decision. Do not push “fixup commits” that redefine the change into acceptance without an explicit Return.
11. **No speculative redesign.** Do not Reject solely for an alternative design that also satisfies the Accepted spec and plan. Optional non-blocking observations MUST NOT affect the merge decision.
12. **Decide explicitly.** Outcome MUST be one of:
    - **Approved for merge** — No merge blockers; record brief rationale. Merging/approval actions follow human/project norms (this prompt does not grant merge authority by itself).
    - **Returned for Revision** — Every required change MUST identify the violated criterion (plan conformance, spec conformance, verification, scope, correctness, regression risk, etc.). Hand back to M6 (or M4/M2 if plan/spec gaps).
13. **Stop.** Do not start broad refactoring (M8) or documentation campaigns (M9) as part of “review.” Optional follow-on M8/M9 happens after approval when appropriate.

### Review checklist *(non-exhaustive)*

| Check | Fail → |
| --- | --- |
| Artifact actually inspected (no fabricated review) | Stop / request artifact |
| Accepted spec + Accepted plan cited | Return |
| Incremental subset authorized by plan (if partial delivery) | Return |
| Plan tasks reviewed with coverage marks | Return if incomplete |
| Change set attributable to plan tasks | Return |
| No unauthorized scope / drive-by changes | Return |
| Behavior matches Accepted specification | Return |
| Verification evidence recorded and adequate | Return |
| No invented product semantics | Return |
| Correctness / regression risk acceptable for merge | Return |
| Repository conventions respected without redesign | Return if clearly violated |
| No demand to redesign Accepted spec/plan | N/A (preference ≠ blocker) |

## Outputs

| Output | Status |
| --- | --- |
| Review decision for the **same** M6 change set | **Approved for merge** or **Returned for Revision** |
| Written review record using the outcome template below | Recorded |

### Outcome template

**Approved for merge:**

```text
Decision: Approved for merge
Subject: <PR/branch>
Accepted specification: <path>
Accepted implementation plan: <path>

Plan tasks reviewed:
- <task>: ✓ | deferred (cite) | n/a

Verification evidence:
- <CI URL / command + result / log reference>

Review summary: <brief>
Blocking findings: None (no merge blockers)

Non-blocking observations (optional):
- <improvement / future refactor / docs idea>
(These MUST NOT affect the merge decision.)

Gate: Merge per human/project norms. M8/M9 may follow when appropriate.
```

**Returned for Revision:**

```text
Decision: Returned for Revision
Subject: <PR/branch>
Accepted specification: <path>
Accepted implementation plan: <path>

Plan tasks reviewed:
- <task>: ✓ | missing | deferred (cite)

Verification evidence:
- <what was checked, or "could not confirm">

Review summary: <brief>

Blocking findings:
1. Criterion: <e.g. plan conformance | verification | scope | correctness>
   Issue: <what is wrong>
   Required change: <what M6 (or M4/M2) must do>

2. …

Non-blocking observations (optional):
- …

Gate: Return to M6 (or earlier). Do not merge. Reviewer MUST NOT modify implementation code.
```

After recording the outcome template, emit a [Slice Completion Report](../conventions/reporting-conventions.md). On Approve, Status **Ready for merge** (or **Ready for M8** if refactoring is next); on Return, Status reflects return to M6 and Next Gate **M6**.

## Gate

**Implementation approved for merge (or returned for revision)** — Explicit Approve or Return exists, with a Slice Completion Report (§2.11). On Approve, the change set may merge under project norms. On Return, do not merge. The Accepted specification remains authoritative for product semantics; the Accepted plan remains authoritative for authorized scope.

## Non-goals

- Fabricating a review without inspecting the artifact
- Rewriting or editing implementation code during review
- Speculative redesign or style-only preference as a merge blocker when conformance holds
- Treating non-blocking observations as merge blockers
- Amending Accepted specs/plans in the review (send to M2–M5)
- Broad refactoring (M8) or documentation execution (M9) as review work
- Granting automatic merge rights without human/project process
- Tool-specific UI instructions

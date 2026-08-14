# Refactoring Prompt

Governing contract: [Process Specification: Standardized Agent Workflows](../specs/agent-workflow-design.md) · Stage **M8** · Reporting: [reporting-conventions.md](../conventions/reporting-conventions.md)

## Purpose

Answer: **Can maintainability be improved without changing behavior?**

Improve **internal implementation quality** (clarity, locality, duplication, complexity) **without changing externally observable behavior**. If no worthwhile maintainability improvements are identified, record **N/A**. If refactoring is desirable but unsafe yet, record **Deferred**. Do not redesign product semantics, expand scope, or substitute for Code Review.

## When to use

- Implementation has an explicit M7 outcome of **Approved for merge**, or the human has explicitly authorized refactoring of an already merged change set
- A prior M8 pass left **Deferred** work that is now safe to resume
- **Not** as a way to sneak features or fix failing M7 review comments (those belong in M6/M7)

## Preconditions *(hard)*

- The implementation has an explicit M7 outcome of **Approved for merge**, **or** the human has explicitly authorized refactoring of an already merged change set
- Accepted specification remains authoritative for product semantics
- Externally observable behavior under refactor is covered by existing tests / verification from M6–M7, or will be locked by characterization tests before structural change
- Prompt library conventions Accepted ([prompt-library.md](../conventions/prompt-library.md))
- Refactor scope is explicitly bounded (files/modules from the recent slice or a named area)

## Instructions

1. **Confirm intent and gate.** State that this is M8: behavior-preserving maintainability only. Confirm M7 Approve or human authorization for merged code. If the real need is a bug fix, feature, or semantic change → stop and route to M2–M6 as appropriate.
2. **Declare scope and goals.** Record paths/modules in scope and concrete maintainability goals (e.g. reduce duplication, improve naming, extract helper). Unbounded “cleanup” is not allowed.
3. **Decide Complete, N/A, or Deferred.**
   - **N/A** — no worthwhile maintainability improvement; risk exceeds likely benefit
   - **Deferred** — improvement may be warranted, but behavior is insufficiently characterized or other verification is required before safe refactoring
   - Otherwise proceed toward **Complete**
4. **Lock behavior first.** Characterization tests (when needed) MUST capture **existing externally observable behavior**. They MUST NOT encode desired future behavior or new product requirements. If coverage cannot be established safely → **Deferred** (not a silent refactor).
5. **Apply safe transformations only.** Prefer small steps. Examples of **acceptable** refactors:
   - Rename private symbols
   - Extract private helper methods
   - Remove duplication
   - Simplify control flow
   - Improve module organization within existing boundaries
   - Reduce function complexity
   - Improve comments that explain implementation  
   **Not acceptable** under M8:
   - API / public contract changes
   - New configuration
   - Dependency upgrades
   - Performance optimizations that alter externally observable behavior (performance work is outside M8 unless the Accepted plan explicitly classified it as behavior-preserving maintenance)
   - Architectural redesign or new product semantics
6. **Verify before and after.** Record verification evidence for the refactor scope (e.g. test command results). After each structural step, re-run verification. **Any failed verification invalidates the refactor step. Revert the structural change before proceeding.**
7. **Stay in scope.** No new features, API expansions, or drive-by cleanups outside the declared scope. Do not amend Accepted specs/plans. Do not use M8 to address M7 blocking findings.
8. **Commit / handoff.** Keep commits reviewable and described as refactor-only. Preparing a PR is allowed; approving/merging follows human/project norms. Hand off for light review if required.
9. **Stop.** Do not start documentation campaigns (M9) unless the human explicitly combines stages. Record decision **Complete**, **N/A**, or **Deferred**.

### Checklist

| Check | Fail → |
| --- | --- |
| M7 Approved for merge or human authorized merged refactor | Stop |
| Scope and maintainability goals declared | Stop |
| Intent is behavior-preserving maintainability | Stop; wrong stage |
| N/A or Deferred used when Complete is inappropriate | Prefer honest signal over busywork |
| Characterization locks existing externally observable behavior only | Rewrite tests or Deferred |
| Only acceptable transformation classes used | Revert / escalate |
| Before/after verification recorded; failures reverted | Revert before continuing |
| No new product semantics or scope expansion | Revert / escalate |

## Outputs

| Output | Status |
| --- | --- |
| Refactored code (optional) | **Complete** |
| Explicit N/A or Deferred record | **N/A** / **Deferred** |
| Before/after verification evidence | Recorded |

### Outcome template

```text
Decision: Complete | N/A | Deferred
Subject: <PR/branch/paths>
Scope:
- <paths/modules>
Accepted specification: <path>
Accepted implementation plan: <path> (if applicable)
M7 / authorization: <Approved for merge | human authorization note>

Maintainability goals:
- …

Changes (Complete only):
- …

Verification:
Before:
- …
After:
- … (or N/A / Deferred: not run)

Externally observable behavior changes: None (required for Complete)

Gate: Complete | N/A | Deferred — proceed to M9 when documentation is due; resume M8 only when Deferred blockers clear.
```

Also emit a [Slice Completion Report](../conventions/reporting-conventions.md) (Next Gate typically **M9**).

## Gate

**Refactoring complete (or not applicable)** — Either maintainability improvements landed with unchanged externally observable behavior and green before/after verification (**Complete**), an explicit **N/A** decision is recorded, or **Deferred** until safe characterization/verification exists—plus a Slice Completion Report (§2.11). No semantic redesign.

## Non-goals

- Feature work, behavior-changing bugfixes, or API redesign
- Using refactor as a substitute for failing M7 review
- Performance optimization unless the Accepted plan explicitly authorized it as behavior-preserving maintenance
- Broad “cleanup the whole repo” campaigns without a bounded scope
- Documentation/release notes owned by M9
- Amending Accepted specifications or plans
- Tool-specific UI instructions

# Implementation Execution Prompt

Governing contract: [Process Specification: Standardized Agent Workflows](../specs/agent-workflow-design.md) · Stage **M6** · Reporting: [reporting-conventions.md](../conventions/reporting-conventions.md)

## Purpose

Answer: **Build it.**

Execute an **Accepted** implementation plan against an **Accepted** specification: implement only authorized work, use TDD where the plan requires code, verify continuously, commit in reviewable units, and stop—returning to earlier stages—if missing semantics appear. Do not redesign, replan, or expand scope.

## When to use

- Plan Review (M5) has **Accepted** the implementation plan for this work
- Resuming M6 after addressing a Code Review (M7) return that does not require plan/spec changes
- **Never** before M5 Accept

## Preconditions *(hard)*

**No implementation activity governed by M6 MUST begin until M5 has accepted the implementation plan.**

Also required:

- Accepted specification path and Status confirmed
- Accepted implementation plan path and Status confirmed
- Active slice/tasks identified from the Accepted plan
- Prompt library conventions Accepted ([prompt-library.md](../conventions/prompt-library.md))

Authoritative inputs:

| Artifact | Authority |
| --- | --- |
| Accepted specification | Product semantics |
| Accepted implementation plan | Sequencing and execution |

Where they appear to conflict, **stop** and escalate (do not “pick a side” in code). Spec wins for semantics; if the plan cannot be followed without inventing semantics, return to M4/M5 or M2/M3 as appropriate.

## Instructions

1. **Confirm gates.** Refuse to start if the plan or specification is not Accepted. Record both paths at the start of the session.
2. **Select the next plan slice/task.** Follow the Accepted plan order. Do not split, merge, redefine, or reorder plan tasks during implementation unless the Accepted plan explicitly delegates that flexibility.
3. **TDD for code work** (when the plan’s verification strategy is TDD):
   1. Write or extend the failing test that expresses the observable behavior for the current task
   2. Run tests — confirm failure for the right reason
   3. Implement the **smallest correct change** that satisfies the Accepted specification and current plan task
   4. Run tests — confirm pass
   5. Refactor only as needed for the task: refactoring MUST preserve all observable behavior validated by the current tests and MUST NOT broaden the task scope (broader refactoring is M8)
4. **Docs/process-only work.** Follow the plan’s stated verification (checklist, link checks, conformance notes). Do not invent a code TDD ritual.
5. **Stay inside ownership boundaries.** Touch only packages/areas the plan authorizes. No drive-by cleanups outside the task.
6. **No design or plan invention.** Do not introduce new product semantics, APIs, or “while we’re here” features. Planning decisions in the plan (layout, naming) may guide structure but MUST NOT expand meaning beyond the Accepted specification.
7. **Stop on missing semantics.** If correct implementation requires inventing normative behavior, **stop coding**. Leave the repository in a **coherent, buildable/reviewable state** before escalating—do not leave partially implemented speculative behavior committed as a completed task. Escalate:
   - sequencing/task gap → return to M4/M5
   - product semantics gap → return to M2/M3  
   Do not paper over gaps with clever code.
8. **Verify for the current slice.** After each task (or small group the plan treats as atomic), run only the verification appropriate for the current slice unless the Accepted plan explicitly requires broader validation. Do not claim done without evidence; do not skip verification.
9. **Commit in reviewable units.** Prefer commits that match plan tasks or thin slices. Write commit messages that explain *why* relative to the plan/spec. Every completed task SHOULD remain attributable to the Accepted plan. Do not commit secrets. Follow the repository’s commit rules (create commits only when the human asks, unless the Accepted plan or user session explicitly authorizes agent commits).
10. **PR / handoff.** When the Accepted plan’s in-scope implementation for this session/slice is complete and green: finish the **single issue PR** that already contains (or is updated to contain) the Accepted plan plus implementation/docs (process spec §2.8). Do not open a second PR solely for M6. **Preparing** that PR is execution. **Approving, merging, or altering review outcomes** belongs to later stages or the human. Summarize what was implemented with links to Accepted plan tasks and Accepted spec sections. Hand off to **Code Review (M7)**.
11. **Slice Completion Report.** Emit a [Slice Completion Report](../conventions/reporting-conventions.md) (gate table, Shipped, Validation, Next Gate). Status MUST be **Ready for M7**. Do not replace the Validation table with prose-only “tests green.”
12. **Stop at ready-for-review.** Do not merge on your own authority unless the human explicitly requests it. Do not start M8/M9 work in this stage unless the Accepted plan explicitly includes that documentation as part of the same authorized slice (prefer M9 for docs).

### Execution checklist *(per task)*

| Check | Fail → |
| --- | --- |
| Plan and spec still Accepted | Stop; do not implement |
| Task is next (or explicitly allowed) in plan; no silent deviation from order | Stop or escalate |
| Failing test first (code/TDD) | Write test before production code |
| Smallest correct change for Accepted spec + current task | Narrow or rewrite approach |
| Implementation attributable to Accepted spec + plan | Stop / escalate if not |
| No new product semantics; no hidden replanning | Revert / escalate |
| Verification for current slice green; none skipped | Fix before next task |
| Repository coherent / buildable / reviewable before escalate or handoff | Stabilize before stop |
| Every completed task references Accepted plan | Fix attribution before claim done |
| Reviewable commit/handoff when slice complete | Do not claim done without artifact |

## Outputs

| Output | Status |
| --- | --- |
| Code and/or authorized non-code changes for the Accepted plan slice | Complete for slice |
| Tests / verification evidence | Green for completed work |
| Commits and/or PR (per project norms) | Ready for Review |
| [Slice Completion Report](../conventions/reporting-conventions.md) | Required — Status **Ready for M7** |

Cite the Accepted specification and Accepted plan in the PR/handoff summary.

## Gate

**Implementation complete; ready for review** — In-scope work for the active Accepted plan slice is implemented per plan, verified, packaged for Code Review (M7), and summarized with a Slice Completion Report (§2.11). No silent scope expansion. No unresolved invent-semantics gaps. Repository left coherent for reviewers.

## Non-goals

- Redesigning the Accepted specification or rewriting the Accepted plan
- Starting before M5 Accept
- Speculative features, refactors, or dependency upgrades outside the plan
- Splitting/merging/redefining plan tasks without plan-delegated flexibility
- Broad refactoring campaigns (M8)
- Code Review decisions (M7) — do not self-Approve or merge
- Documentation campaigns owned by M9 (unless the Accepted plan explicitly includes a docs task in this slice)
- Tool-specific UI instructions beyond what is needed to run the project’s standard commands

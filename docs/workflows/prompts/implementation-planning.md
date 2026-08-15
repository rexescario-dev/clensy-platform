# Implementation Planning Prompt

Governing contract: [Process Specification: Standardized Agent Workflows](../specs/agent-workflow-design.md) · Stage **M4** · Conventions: [prompt-library.md](../conventions/prompt-library.md)

## Purpose

Answer: **How will we build it?**

Produce **exactly one** Draft implementation plan that translates an **Accepted** specification into sequenced, reviewable work—task decomposition, TDD suitability, dependencies, export/package boundaries, and verification strategy—without reopening design, writing production code, or accepting the plan (M5 owns plan review).

**Success criterion:** A complete implementation plan enables a competent implementer to execute every task without inventing sequencing or product semantics.

## When to use

- An Accepted specification exists and implementation planning may begin
- Revising a plan that M5 returned for revision (re-enter at M4, then M5 again)

## Preconditions

- **Exactly one** specification is **Accepted** (M3 complete) for this work
- Prompt library conventions are Accepted ([prompt-library.md](../conventions/prompt-library.md))
- Design Review contract understood ([design-review.md](design-review.md)): the Accepted spec is authoritative; do not redesign it

## Instructions

1. **Identify authoritative inputs.** Cite the Accepted specification path and Status. Cite any other Accepted specs/plans this plan relies on. State that where this plan and an Accepted specification disagree, the specification wins and the plan must be revised.
2. **State plan identity.** Title; Status **Draft**; date; tracking issue; package/repo scope; Depends on (Accepted specs).
3. **Restate the goal as delivery intent** — one short section: what will be implemented from the Accepted spec, not a redesign of what the product is.
4. **Lock implementation constraints.** SHALL / SHALL NOT derived from the Accepted specification (and only from it). Do not invent new normative product semantics.
5. **Define ownership boundaries.** Packages, modules, or document areas that own the work vs must remain untouched.
6. **Inventory contracts / surfaces to implement** — only what the Accepted specification authorizes. Mark deferred items explicitly.
7. **Sequence delivery.** Prefer the **smallest independently reviewable slices** that preserve correctness and minimize partially implemented behavior. Call out hard prerequisites between slices. Task order MUST be executable without inventing missing work.
8. **Identify public surfaces that require implementation.** Do not freeze signatures, type shapes, or APIs beyond what the Accepted specification already defines. Export/public-surface decisions are planning aids, not new product contracts.
9. **Plan for TDD where code is in scope.** For each implementation slice, identify the tests that fail before implementation and the observable behavior they verify. If the work is docs/process-only, state that TDD does not apply and what verification replaces it.
10. **List bite-sized tasks** sufficient for M5 to judge executability and for M6 to execute without inventing sequencing. Tasks SHOULD map to Accepted-spec requirements.
11. **Traceability.** Every major task or slice SHOULD reference the Accepted specification section(s) it implements. Do not add “nice to have” work outside the Accepted spec without an explicit out-of-scope deferral.
12. **Keep planning decisions non-normative.** File layout, task grouping, sequencing, temporary naming, and implementation order are planning decisions. They MUST NOT be interpreted as product semantics.
13. **Stop if design is incomplete.** If planning discovers missing design semantics, **stop planning** and return the specification to M2/M3 rather than filling the gap in the plan.
14. **Stop at Draft.** Set Status to **Draft**. Hand off to **Plan Review (M5)**. Do not implement; do not self-Accept the plan.
15. **Packaging.** Prefer placing the Draft plan on the **same issue branch/PR** that will later carry M5 Accept + M6 implementation (one PR per tracking issue; process spec §2.8). Do not treat a separate “plan-only” merge PR as required.

### Recommended plan sections *(adapt to project)*

| Concern | Include when |
| --- | --- |
| Goal / non-goals of this plan | Always |
| Constraints (SHALL / SHALL NOT) | Always |
| Package / ownership boundaries | Code or multi-package work |
| Contract inventory | API / contract work |
| Slice / milestone sequence | Always |
| Public surfaces requiring implementation | Libraries with explicit export gates |
| TDD / verification strategy | Always (or explicit N/A for docs-only) |
| Task breakdown | Always |
| Traceability to Accepted spec | Always |
| Execution / dependency / scheduling risks | Only operational risks—not redesign proposals |

### Self-check before handoff *(planner)*

| Check | Fail → |
| --- | --- |
| Every major task traces to Accepted specification | Fix before Draft handoff |
| No task introduces new product semantics | Fix or return to M2/M3 |
| Task ordering is executable without inventing missing work | Fix sequencing |
| Deferred work explicitly identified | Fix if ambiguous |
| Missing design semantics → stopped and returned to M2/M3 | Do not Draft-gap-fill |

## Outputs

| Output | Status |
| --- | --- |
| **Exactly one** Draft implementation plan (path under `docs/ (or project-equivalent plans path)/` or project-equivalent) | **Draft** |

Do not create production code, parallel “design v2” specs, or sibling plans in this stage. The Draft plan MUST reference the Accepted specification it implements.

## Gate

**Implementation plan drafted** — A reviewable Draft plan exists with constraints, sequencing, verification approach, and tasks attributable to the Accepted specification, such that a competent implementer can execute without inventing sequencing or product semantics. Ready for Plan Review (M5).

## Non-goals

- Redesigning or amending the Accepted specification (return to M2–M3 if semantics are missing)
- Plan Review decisions (M5) — do not self-Accept the plan
- Any implementation activity governed by M6
- Code review, refactoring, or documentation execution (M7–M9)
- Inventing normative behavior the Accepted specification does not authorize
- Treating planning decisions (layout, naming, order) as product semantics
- Tool-specific UI instructions

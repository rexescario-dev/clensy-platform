# Specification Prompt

Governing contract: [Process Specification: Standardized Agent Workflows](../specs/agent-workflow-design.md) · Stage **M2** · Conventions: [prompt-library.md](../conventions/prompt-library.md)

## Purpose

Answer: **What should we build?**

Author a specification (architecture RFC or process specification) that states the problem, scope, goals, non-goals, terminology, invariants, rationale, and acceptance criteria clearly enough that Design Review (M3) can accept or return it—without planning tasks or writing production code.

## When to use

- Starting a new design-backed change that needs an Accepted specification before planning or implementation
- Revising a specification that M3 returned for revision (re-enter at M2, then M3 again)
- Writing a process specification that governs how work is performed (not product architecture)

## Preconditions

- Problem or opportunity is identified enough to draft scope
- Relevant Accepted upstream architecture RFCs / process specs are known (cite; do not restate wholesale)
- Prompt library conventions are Accepted ([prompt-library.md](../conventions/prompt-library.md))

## Instructions

1. **Classify the document kind.** Determine whether the document is an **architecture RFC** (defines what the product is) or a **process specification** (defines how engineering work is performed). The document MUST contain only one kind.
2. **Establish identity.** Title; Status **Draft**; date; tracking epic/issue; Depends on / Followed by; supersession links when applicable.
3. **State the primary question and thesis** in one short section so reviewers know what decision this document locks.
4. **Define scope.** In scope (normative), informative, and out of scope. Prefer explicit deferrals over vague “later.”
5. **Define terminology** used as contract language. Prefer the project glossary / existing RFCs; introduce new terms only when necessary.
6. **Write goals and non-goals.** Non-goals MUST be strong enough to stop scope creep in M4–M6.
7. **Record invariants and boundaries** (MUST / MUST NOT) that later stages and implementations must respect.
8. **Provide rationale** for material choices—sufficient for M3 to determine whether the design should be Accepted or returned for revision. Prefer a focused rationale over a full alternatives essay unless the decision is contentious.
9. **State acceptance criteria** for *this specification* (when it may move from Draft to Accepted after M3)—distinct from product acceptance tests.
10. **Traceability.** Reference every Accepted specification or RFC this document depends on and state whether it extends, constrains, or merely relies upon each dependency. Do not silently reinterpret them.
11. **Stop at Draft.** Set Status to **Draft** (or keep Draft after addressing an M3 return). Hand off to **Design Review (M3)**; do not write the implementation plan or code. Do not describe implementation sequencing, task decomposition, milestones, or execution strategy. Those belong to M4.

### Recommended section checklist *(adapt to document kind)*

| Concern | Include when |
| --- | --- |
| Background / problem | Not obvious from title alone |
| Goals / non-goals | Always |
| Terminology | New or overloaded terms |
| Invariants / boundaries | Always for normative specs |
| Rationale | Material design choices |
| Relationships / dependencies | Whenever the document builds on existing RFCs or process specifications |
| Worked examples | Clarifies semantics without prescribing code |
| Acceptance criteria (for this doc) | Always |
| Explicit deferrals / follow-ons | Anything tempting to over-specify |

## Outputs

| Output | Status |
| --- | --- |
| **Exactly one** Draft specification (path under `docs/workflows/specs/` or project-equivalent) | **Draft** |

Do not create supplementary planning docs, checklists, or sibling specs in this stage. The Draft specification SHOULD link its tracking issue and any Accepted specs it depends on.

## Gate

**Specification drafted** — A reviewable Draft specification exists with clear scope, goals, non-goals, terminology, invariants, rationale, and document acceptance criteria. Ready for Design Review (M3).

## Non-goals

- Design Review decisions (M3) — do not self-Accept the specification in this stage
- Implementation planning, task breakdown, or TDD plans (M4–M5)
- Any implementation activity (M6)
- Code review, refactoring, or documentation cleanup owned by M7–M9
- Redesigning Accepted upstream RFCs or process specs
- Tool-specific UI instructions (Cursor-only, etc.)
- Knowledge Catalog extraction or taxonomy population unless the specification’s subject is explicitly that work

# Design Review Prompt

Governing contract: [Process Specification: Standardized Agent Workflows](../specs/agent-workflow-design.md) · Stage **M3** · Conventions: [prompt-library.md](../conventions/prompt-library.md)

## Purpose

Answer: **Is this the right design?**

Review a Draft specification produced by M2 and decide **Accepted** or **Returned for Revision**, with explicit rationale. Evaluate design quality, consistency, completeness, boundaries, and alignment with Accepted RFCs/process specifications—without rewriting the document, planning implementation, or writing code.

## When to use

- A Draft specification exists and is ready for Design Review
- Re-reviewing a specification after M2 addressed a prior return

## Preconditions

- **Exactly one** Draft specification from M2 is the review subject
- Prompt library conventions are Accepted ([prompt-library.md](../conventions/prompt-library.md))
- The Specification Prompt contract is understood ([specification.md](specification.md)); do not re-author under M2 rules here

## Instructions

1. **Identify the subject.** Record the Draft specification path, document kind (architecture RFC vs process specification), and claimed primary question.
2. **Verify document kind purity.** Confirm the Draft is only one kind. If architecture and process concerns are mixed, **Return** with that defect called out.
3. **Check completeness against M2 expectations.** Scope (in/informative/out), goals, non-goals, terminology as needed, invariants/boundaries, rationale, document acceptance criteria, and dependency links. Missing contract-critical sections → **Return**.
4. **Evaluate design quality.** Ask whether the proposed design answers the primary question, draws crisp boundaries, and is the smallest stable abstraction supported by the stated evidence/rationale.
5. **Check dependencies.** Verify every normative dependency is either extended, constrained, or relied upon, with that relationship stated. Missing or dishonest normative relationships are review defects. Flag silent reinterpretation or contradiction with Accepted RFCs/process specs.
6. **Probe contradictions, terminology, and layering.** Look for internal contradictions; terminology that drifts without definition; scope that leaks into deferred concerns; and (for architecture RFCs) violations of established layering or capability boundaries.
7. **Assess implementation feasibility at design level.** Not a plan review: only whether the design is specified clearly enough that a competent M4 could plan without inventing missing **normative** semantics. Missing implementation details (APIs, class names, filenames, module layout) are **not** design defects unless M4 would have to invent normative behavior. Feasibility blockers → **Return**.
8. **No speculative redesign.** Do not reject a design merely because an alternative could also work. Return only when the proposed design violates its stated goals, upstream specifications, or review criteria. Alternative designs belong in optional non-blocking commentary, not as Accept blockers.
9. **Decide explicitly.** Outcome MUST be one of:
 - **Accepted** — The reviewer finds **no design blockers** and believes the specification is sufficiently complete and internally consistent that **M4 should not need to invent semantics**. Set specification Status to **Accepted** (or instruct the author to); record brief rationale.
 - **Returned for Revision** — Keep Status **Draft**. List required changes; every required change MUST identify the violated review criterion (scope, dependency, invariant, layering, rationale, completeness, terminology, etc.). Do not silently edit the design into acceptance.
10. **Stop.** Do not produce an implementation plan, task list, or code. Hand Accepted specs to **Implementation Planning (M4)**; hand returns back to **Specification (M2)**.

### Review checklist *(non-exhaustive)*

| Check | Fail → |
| --- | --- |
| Single document kind | Return |
| Primary question / thesis clear | Return |
| Goals and non-goals adequate | Return |
| Invariants / MUST–MUST NOT clear | Return |
| Terminology internally consistent | Return |
| Rationale sufficient to Accept or Return | Return |
| Normative dependencies cited with relationship (extends / constrains / relies) | Return if material deps missing or dishonest |
| No contradiction with Accepted upstream specs | Return |
| No planning/implementation content that belongs in M4–M6 | Return (or require removal) |
| Document acceptance criteria distinct from product tests | Return if confused |
| M4 would not need to invent normative semantics | Return |

## Outputs

| Output | Status |
| --- | --- |
| Review decision for the **same** Draft specification | **Accepted** or **Returned for Revision** |
| Written review record using the outcome template below | Recorded |

Do not create a replacement specification, plan, or supplementary design doc in this stage. Reviewers MAY suggest concrete revision bullets; authors apply them in M2.

### Outcome template

**Accepted:**

```text
Decision: Accepted
Subject: <path>
Document kind: architecture RFC | process specification
Primary question: <…>
Review summary: <brief>
Findings: None (no design blockers)
Dependencies verified: <list with extends | constrains | relies>
Gate: Proceed to M4.
```

**Returned for Revision:**

```text
Decision: Returned for Revision
Subject: <path>
Document kind: architecture RFC | process specification
Primary question: <…>
Review summary: <brief>

Blocking findings:
1. Criterion: <e.g. invariant | dependency | terminology>
 Issue: <what is wrong>
 Required change: <what M2 must do>

2. …
Gate: Return to M2. M4 MUST NOT begin.
```

## Gate

**Specification accepted (or returned for revision)** — An explicit Accept or Return decision exists for the Draft specification, with rationale in the outcome template. On Accept, the specification is authoritative for downstream stages and M4 should not need to invent semantics. On Return, M4 MUST NOT begin.

## Non-goals

- Rewriting the specification into a new “Accepted” draft without an explicit return/revise cycle
- Speculative redesign or “prefer my alternative” as an Accept blocker
- Implementation planning or plan review (M4–M5)
- Any implementation activity (M6)
- Code review, refactoring, or documentation execution (M7–M9)
- Silently changing Accepted upstream RFCs or process specs
- Tool-specific UI instructions

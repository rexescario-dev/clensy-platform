# Plan Review Prompt

Governing contract: [Process Specification: Standardized Agent Workflows](../specs/agent-workflow-design.md) · Stage **M5** · Reporting: [reporting-conventions.md](../conventions/reporting-conventions.md)

## Purpose

Answer: **Is the plan executable?**

Review a Draft implementation plan produced by M4 and decide **Accepted** or **Returned for Revision**, with explicit rationale. Evaluate executability, sequencing, TDD/verification strategy, traceability to the Accepted specification, and absence of hidden redesign—without rewriting the plan, reopening product design, or writing production code.

**Acceptance means:** The reviewer finds **no plan blockers** and believes a competent implementer can execute M6 without inventing sequencing or product semantics.

## When to use

- A Draft implementation plan exists and is ready for Plan Review
- Re-reviewing a plan after M4 addressed a prior return

## Preconditions

- **Exactly one** Draft implementation plan from M4 is the review subject
- The plan’s subject specification is **Accepted** (M3 complete)
- Prompt library conventions are Accepted ([prompt-library.md](../conventions/prompt-library.md))
- Implementation Planning contract understood ([implementation-planning.md](implementation-planning.md)); do not re-author under M4 rules here

## Instructions

1. **Identify the subject.** Record Draft plan path, Accepted specification path, and claimed delivery goal.
2. **Verify authoritative-spec rule.** Confirm the plan states that the Accepted specification wins on conflict. If the plan quietly overrides or reinterprets the spec, **Return**.
3. **Check completeness against M4 expectations.** Constraints (SHALL/SHALL NOT), ownership boundaries, sequencing, verification/TDD approach, tasks, and traceability. Missing contract-critical plan content → **Return**. Do **not** require implementation-level detail (algorithms, code structure, or private helper design) unless the Accepted specification explicitly defines it.
4. **Evaluate executability.** Can tasks be executed in the stated order without inventing missing work? Impossible or underspecified ordering → **Return**.
5. **Check slice quality.** Prefer evidence of small independently reviewable slices that preserve correctness; flag plans that force large partially implemented intermediate states without justification.
6. **Verify TDD / verification.** For code slices: tests that fail first and observable behaviors are identified. For docs/process-only: replacement verification is explicit. Missing strategy → **Return**.
7. **Check coverage vs deferral.** Every Accepted-spec requirement in scope for this plan MUST be implemented by at least one task **or** explicitly deferred. Silent omissions → **Return**. Deferred work MUST reference the Accepted specification or an explicit out-of-scope decision.
8. **Check for hidden redesign.** Any new product semantics, normative API freezes beyond the Accepted spec, or “while we’re here” features → **Return** (or require deferral / return to M2–M3). Planning decisions (layout, naming, order) are non-normative; do not treat them as product contracts—but they also must not smuggle design.
9. **Missing design semantics.** If the plan (or review) reveals gaps that require inventing normative behavior, **Return** the plan and require the specification to go back to M2/M3—do not Accept a gap-filling plan.
10. **No speculative replan.** Do not reject a plan merely because another sequencing could also work. Return only when the proposed plan violates executability, the Accepted specification, or review criteria.
11. **Evaluate risks narrowly.** Risks may cover execution, dependency, or scheduling concerns only. Risks MUST NOT be used to reopen Accepted design decisions.
12. **Decide explicitly.** Outcome MUST be one of:
    - **Accepted** — No plan blockers; set plan Status to **Accepted** (or instruct the author to); record brief rationale. **M6 may begin only after this.**
    - **Returned for Revision** — Keep Status **Draft**. Every required change MUST identify the violated review criterion (executability, sequencing, traceability, TDD, hidden redesign, coverage, etc.). Do not silently rewrite the plan into acceptance.
13. **Stop.** Do not implement. Hand Accepted plans to **Implementation (M6)**; hand returns back to **Implementation Planning (M4)** (or to M2/M3 if design gaps). Recording Accept in the plan (and issue) does **not** require a separate merge PR—continue on the issue’s single PR after Accept (process spec §2.8).

### Review checklist *(non-exhaustive)*

| Check | Fail → |
| --- | --- |
| Accepted specification cited and wins on conflict | Return |
| Every major task traces to Accepted specification | Return |
| Every in-scope Accepted-spec requirement has a task or explicit deferral | Return |
| Deferred work cites Accepted spec or out-of-scope decision | Return |
| No task introduces new product semantics | Return |
| Task ordering executable without inventing missing work | Return |
| No demand for implementation-level detail beyond Accepted spec | Return if over-specified as blocker |
| TDD/verification strategy adequate for the work kind | Return |
| Public surfaces not frozen beyond Accepted spec | Return |
| No hidden redesign / gap-filling of missing semantics | Return |
| Risks are execution/dependency/scheduling only; do not reopen design | Return |

## Outputs

| Output | Status |
| --- | --- |
| Review decision for the **same** Draft plan | **Accepted** or **Returned for Revision** |
| Written review record using the outcome template below | Recorded |

Do not create a replacement plan, new specification, or code in this stage. Reviewers MAY suggest concrete revision bullets; authors apply them in M4 (or M2 if design).

### Outcome template

**Accepted:**

```text
Decision: Accepted
Subject (plan): <path>
Accepted specification: <path>
Delivery goal: <…>
Review summary: <brief>
Findings: None (no plan blockers)
Traceability: adequate (coverage + deferrals checked)
Gate: Proceed to M6. No implementation activity before this Accept.
Authority: Plan governs sequencing/execution; specification governs product semantics.
```

**Returned for Revision:**

```text
Decision: Returned for Revision
Subject (plan): <path>
Accepted specification: <path>
Review summary: <brief>

Blocking findings:
1. Criterion: <e.g. sequencing | traceability | coverage | hidden redesign | TDD>
   Issue: <what is wrong>
   Required change: <what M4 (or M2/M3) must do>

2. …
Gate: Return to M4 (or M2/M3 if design gap). M6 MUST NOT begin.
```

On Accept, SHOULD emit a [Slice Completion Report](../conventions/reporting-conventions.md) with Status **Ready for M6** (Validation may be mostly N/A).

## Gate

**Implementation plan accepted (or returned for revision)** — An explicit Accept or Return decision exists for the Draft plan. On Accept: the **Accepted implementation plan is authoritative for sequencing and execution**; the **Accepted specification remains authoritative for product semantics**. On Return, **no implementation activity governed by M6 MUST begin**.

## Non-goals

- Rewriting the plan into acceptance without an explicit return/revise cycle
- Speculative “I would sequence it differently” as an Accept blocker
- Requiring algorithms, private helpers, or code structure not defined by the Accepted specification
- Redesigning the Accepted specification (send to M2–M3)
- Any implementation activity (M6)
- Code review, refactoring, or documentation execution (M7–M9)
- Tool-specific UI instructions

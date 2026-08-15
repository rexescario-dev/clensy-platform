# Process Specification: Standardized Agent Workflows

| Field | Value |
| --- | --- |
| **Status** | Accepted — process contract for engineering workflow stages |
| **Kind** | Process specification (not a product architecture document) |

**Normative principle:** This document defines **how engineering work is performed** by AI agents and humans following the standardized workflow. It does **not** define product runtime behavior, schemas, or architecture capabilities.

---

## 1. Purpose

Define a reusable, tool-agnostic software engineering workflow by standardizing stages, prompts, review gates, and quality controls for specification, planning, implementation, validation, and documentation.

---

## 2. Ten-stage workflow contract

### 2.1 Stages

| Stage | Primary asset | Question | Gate |
| --- | --- | --- | --- |
| **M1** Prompt Library Foundation | Conventions (`prompt-library.md`) | Where do workflow assets live, and what rules do they follow? | Conventions accepted |
| **M2** Specification | Specification prompt | What should we build? | Specification drafted |
| **M3** Design Review | Design review prompt | Is this the right design? | Specification accepted (or returned for revision) |
| **M4** Implementation Planning | Planning prompt | How will we build it? | Implementation plan drafted |
| **M5** Plan Review | Plan review prompt | Is the plan executable? | Implementation plan accepted (or returned for revision) |
| **M6** Implementation | Implementation prompt | Build it (TDD, verify, commit). | Implementation complete; ready for review |
| **M7** Code Review | Code review prompt | Does the implementation faithfully realize the accepted plan and satisfy quality standards? | Implementation approved for merge (or returned for revision) |
| **M8** Refactoring | Refactoring prompt | Improve maintainability without changing behavior. | Refactoring complete (or not applicable) |
| **M9** Documentation | Documentation prompt | Is the project documentation consistent with the shipped implementation? | Documentation complete |
| **M10** Workflow Validation | Validation prompt | Does the full workflow cohere with no gaps, overlaps, or broken traceability? | Workflow validated |

### 2.2 Stage outputs *(normative)*

| Stage | Output | Status after stage |
| --- | --- | --- |
| M1 | Prompt library conventions | Accepted |
| M2 | Specification document | Draft |
| M3 | Same specification | Accepted / Returned |
| M4 | Implementation plan | Draft |
| M5 | Same implementation plan | Accepted / Returned |
| M6 | Code + tests | Ready for Review |
| M7 | Reviewed implementation | Approved / Returned |
| M8 | Refactored implementation | Complete / N/A / Deferred |
| M9 | Documentation updates | Complete |
| M10 | Validation report | Accepted |

### 2.3 Workflow invariants *(normative)*

1. **Accepted artifacts are authoritative.**
2. **Later stages MUST NOT redesign earlier Accepted artifacts.**
3. **Every downstream artifact MUST trace to an Accepted upstream artifact** (where an upstream artifact exists).
4. **Every implementation decision MUST be attributable to either the Accepted specification or the Accepted implementation plan.**
5. **Review stages MAY reject work but MUST NOT silently rewrite upstream decisions.** Returns for revision are explicit.
6. **Every downstream artifact SHOULD reference the Accepted artifact(s) from which it was produced.**

### 2.4 Status lifecycle *(normative)*

Specification and Implementation Plan artifacts follow **Draft → Review → Accepted**. After **Accepted**, they are consumed by downstream stages; they are not themselves “executed.”

**Execution** refers only to implementation activities performed under **M6** using Accepted upstream artifacts.

No downstream stage may begin until its required upstream artifact(s) reach **Accepted**.

### 2.5 Hard prerequisite *(normative)*

**No implementation activity governed by M6 MUST begin until M5 has accepted the implementation plan.**

```text
Specification  → Design Review (M3) → Accepted
Implementation Plan → Plan Review (M5) → Accepted
                              ↓
                     Implementation (M6)
```

### 2.6 Workflow execution order

```text
M2 Specification drafted
    ↓
M3 Specification accepted
    ↓
M4 Implementation plan drafted
    ↓
M5 Implementation plan accepted
    ↓
M6 Implementation complete; ready for review
    ↓
M7 Implementation approved for merge
    ↓
M8 Refactoring complete (or not applicable)
    ↓
M9 Documentation complete
    ↓
M10 Workflow validated
```

### 2.7 Refactoring scope *(M8)*

Refactoring improves maintainability **without changing behavior**. Refactoring is optional when no maintainability improvements are identified; the M8 gate then records **not applicable**.

### 2.8 Delivery packaging *(normative for issue-based delivery)*

Stage gates remain sequential. Pull request packaging is separate from stage sequencing:

1. Prefer **one pull request per tracking issue** for a delivery slice unless a split is explicitly authorized.
2. That PR SHOULD include authorized artifacts together: any slice-local specification amendments, the implementation plan (ending **Accepted** before merge), and the M6 implementation/docs updates for that issue.
3. **Do not** use separate merge PRs solely to separate “plan Accept” from “implementation” for the same issue.
4. Packaging MUST NOT bypass §2.5.

### 2.9 Stage ownership

Each stage has one primary question, one primary initial asset, and one completion gate. Additional assets for a stage may attach without changing stage numbering.

### 2.10 M10 validation scope *(normative)*

Workflow validation (M10) MUST verify at least:

1. Every stage has a defined output and owner (issue / asset).
2. Every gate is reachable from the prior stage’s success path.
3. Stage responsibilities do not overlap.
4. Every produced artifact traces to an Accepted predecessor where required.
5. No orphan workflow assets exist outside the approved layout and naming.
6. A developer can execute the full workflow without inventing additional instructions.

### 2.11 Slice completion reporting *(normative)*

At the completion of **M6, M7, M8, M9**, and at **final slice acceptance** (merge/closeout summary), agents MUST produce a concise **Slice Completion Report** using the standard tabular format.

The report MUST include:

1. An identity / **gate** table (slice, tracking, per-gate results, branch, PR, overall Status)
2. **Shipped** (delivered intent)
3. **Validation** (explicit mechanical checks — not prose-only “tests green”)
4. **Next Gate** (exactly one next gate, or none if the slice is complete)

Vocabulary: use **Gate**, not Phase. Split M4 and M5 when both apply. Status and Next Gate describe overall position; they MUST NOT replace stage Accept/Return/Approved outcome templates.

Authoritative template: [reporting-conventions.md](../conventions/reporting-conventions.md).

M5 Plan Review SHOULD emit the same report when Accepting a plan (Status: Ready for M6).

---

## 3. Prompt / asset rules *(normative)*

All workflow assets MUST:

1. Have a **single responsibility** per primary prompt.
2. Be **tool-agnostic**.
3. Be **reusable** across repositories.
4. Avoid **project-specific implementation details** unless the asset is explicitly project-scoped.
5. Prefer **shared conventions** over duplicated wording across prompts.
6. **Preserve** Draft → Review → Accepted gates for specifications and plans.
7. Live under the installed workflow documentation tree (conventionally `docs/workflows/`).
8. Treat **approved specifications and approved implementation plans as authoritative inputs** and MUST NOT redefine accepted decisions.
9. **SHOULD** reference governing specifications rather than restating them.
10. **MUST** require a [Slice Completion Report](../conventions/reporting-conventions.md) at M6–M9 handoffs and final acceptance summaries (§2.11).

Workflow prompts are invoked **alongside** agent skills; they do not replace those skills.

### 3.1 Non-goals

- Redefining product architecture contracts
- Replacing agent skills
- Inventing stage prompts outside authorized workflow changes

---

## 4. Acceptance criteria for this specification

This process specification is fit for use when:

1. Purpose and process-vs-architecture boundary are clear.
2. The ten-stage contract (questions, primary assets, gates) is approved.
3. Status lifecycle and M6←M5 hard prerequisite are normative and unambiguous.
4. Prompt/asset rules and non-goals sufficiently constrain workflow assets.
5. No section conflicts with the consuming repository’s accepted architecture decisions.

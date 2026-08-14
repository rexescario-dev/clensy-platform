# Documentation Execution Prompt

Governing contract: [Process Specification: Standardized Agent Workflows](../specs/agent-workflow-design.md) · Stage **M9** · Reporting: [reporting-conventions.md](../conventions/reporting-conventions.md)

## Purpose

Answer: **Is the project documentation consistent with the shipped implementation?**

Update documentation so completed work is discoverable and consistent: RFCs/process specs status, roadmap, indexes, changelogs/release notes when those conventions exist, diagrams, cross-references, and terminology—**without** changing product semantics, rewriting Accepted contracts, running TDD, or modifying implementation code.

## When to use

- M7 has **Approved for merge** and M8 is Complete, N/A, Deferred, or explicitly skipped by the human
- Documentation-only follow-through after merge
- Closing a slice/epic that requires roadmap/index/changelog updates

## Preconditions *(hard)*

Documentation may only describe implementation that has either:

- **merged** into the target branch, or
- received an explicit M7 **Approved for merge** decision when project policy documents approved-but-not-yet-merged work

Also required:

- Accepted specification (and Accepted plan, when code was involved) are identified
- Prompt library conventions Accepted ([prompt-library.md](../conventions/prompt-library.md))
- Documentation **scope** is declared before editing (paths to touch)
- **No TDD requirement** for this stage (verification is editorial/consistency checks)

## Instructions

1. **Identify what shipped.** Cite Accepted specification, Accepted plan (if any), PR/merge refs, and M7/M8 outcomes. Document only what is true.
2. **Declare documentation scope.** List exact paths that may be edited. Do not wander the entire markdown tree.
3. **Inventory needed updates within scope.** Typical targets (only if in scope and used by the project):
   - Spec/plan **Status** fields and tracking links
   - `roadmap.md` / current-focus streams
   - Specs/plans indexes or READMEs
   - Changelog or release notes **only if those artifacts exist as project conventions**
   - Architecture/process diagrams referenced by the work
   - Glossary / terminology consistency with Accepted specs
   - Cross-links between related RFCs, plans, and prompts
4. **Separate editorial vs content updates.** Track them distinctly:
   - **Editorial:** spelling, formatting, broken links, heading hierarchy
   - **Content:** status, roadmap, architecture references, indexes, changelog entries
5. **Require traceability.** For each documentation change, state which implementation or process artifact caused it (spec Status, plan completion, merge, new prompt file, etc.).
6. **Describe shipped or approved reality.** Avoid future-tense “will support…” claims unless documenting planned work in roadmap (or equivalent planning) artifacts.
7. **Update for consistency, not redesign.** Prefer references over restating contracts. MUST NOT invent new product semantics or “fix” the design in docs.
8. **Terminology pass.** Use terms as defined in Accepted specs/glossary. Resolve drift; do not introduce synonyms for the same concept without definition.
9. **No implementation via docs.** Documentation edits MUST NOT require implementation changes. If documentation exposes a product inconsistency, route back to M2–M7 rather than silently changing code or contracts.
10. **Editorial verification** (documentation’s “tests”). Check and record:
    - Broken internal links
    - Heading hierarchy
    - Duplicate / contradictory sections
    - Outdated references
    - Status consistency (Draft vs Accepted vs merged reality)
    - Terminology consistency
11. **Stop.** Do not implement code, refactor, or reopen M2–M6. Hand off prompt-library / process-framework validation to **M10** when that is the active work.

### Checklist

| Check | Fail → |
| --- | --- |
| Merge or M7 Approve prerequisite met | Stop; do not document as shipped |
| Documentation scope declared | Stop |
| Docs describe shipped/approved reality (no speculative future tense outside roadmap) | Fix or omit |
| Each update traces to a causing artifact | Fix |
| Editorial vs content changes distinguishable | Clarify before Complete |
| Status/tracking fields accurate | Fix |
| Changelog/release notes updated only if project convention | Skip if absent |
| Terminology consistent with Accepted specs | Fix |
| No new product semantics; no code/contract edits | Revert / escalate to M2–M7 |
| Editorial verification recorded | Do before Complete |

## Outputs

| Output | Status |
| --- | --- |
| Documentation updates within declared scope | **Complete** |
| Editorial verification notes | Recorded |

### Outcome template

```text
Decision: Complete
Subject: <slice/PR/epic>
Accepted specification: <path>
Accepted implementation plan: <path or n/a>
M7: <Approved for merge | …>
M8: <Complete | N/A | Deferred | skipped>

Documentation scope:
- …

Updated artifacts:
- <path> ← caused by <artifact>

Editorial changes:
- …

Content updates:
- …

Verification:
- Links checked
- Heading hierarchy checked
- Status consistency checked
- Cross-references checked
- Terminology checked
- Duplicates / outdated refs checked

Gate: Documentation complete. Code/behavior/contracts unchanged by this stage.
```

Also emit a [Slice Completion Report](../conventions/reporting-conventions.md) (Status often **Slice complete** or **Ready for M10** when validating the workflow itself).

## Gate

**Documentation complete** — Declared doc surfaces reflect shipped or policy-approved work, Status/links/terminology are consistent with Accepted artifacts, editorial verification is recorded, a Slice Completion Report is produced (§2.11), and no product semantics or implementation were changed via documentation.

## Non-goals

- TDD, implementation, or refactoring (M6–M8)
- Documenting speculative unfinished work as shipped
- Updating every markdown file outside declared scope
- Redesigning Accepted specifications or plans under the guise of “clarification”
- Inventing changelog/release artifacts the project does not use
- Silently changing code or contracts when docs reveal inconsistency
- M10 workflow-framework validation unless this issue is W1-10
- Tool-specific UI instructions

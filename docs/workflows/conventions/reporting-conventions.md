# Reporting conventions — Slice Completion Report

Governing contract: [Process Specification: Standardized Agent Workflows](../specs/agent-workflow-design.md) (§2.11)

This document is **workflow infrastructure**. Agents MUST use it for gate handoffs so every slice report is structurally comparable.

---

## When to produce

| Gate | Required? |
| --- | --- |
| M5 Plan Review complete | Recommended |
| **M6** Implementation complete | **Required** |
| **M7** Code Review complete | **Required** |
| **M8** Refactoring complete or N/A | **Required** |
| **M9** Documentation complete | **Required** |
| Final acceptance / merge closeout | **Required** when summarizing the closed slice |

Use **Gate**, never “Phase,” when naming M1–M10 positions.

---

## Canonical template

```markdown
## Slice Completion Report

| Field | Result |
| --- | --- |
| Slice | <id or short name> |
| Tracking | issue URL |
| M4 | Plan **Accepted** \| Draft \| n/a |
| M5 | Review **Accepted** \| Returned \| n/a |
| M6 | **Complete** \| In progress \| n/a |
| M7 | **Approved** \| Returned \| Pending \| n/a |
| M8 | **Complete** \| N/A \| Pending |
| M9 | **Complete** \| Pending \| n/a |
| Branch | branch name |
| PR | pull request URL |
| Status | **Ready for \<next gate\>** \| **Ready for merge** \| **Slice complete** |

### Shipped

- <what was delivered — behaviors/capabilities, not a file listing>
- …

### Validation

| Check | Result |
| --- | --- |
| Tests | **Passed** \| Failed \| Skipped \| N/A |
| Typecheck | **Passed** \| Failed \| Skipped \| N/A |
| Lint | **Passed** \| Failed \| Skipped \| N/A |
| Build | **Passed** \| Failed \| Skipped \| N/A |
| Package validation | **Passed** \| Failed \| Skipped \| N/A |

### Next Gate

**<Mn> — <Gate name>**
```

---

## Field rules

1. **Slice** — Short stable name (e.g. `W2 Provider Policy`).
2. **Tracking / PR** — Link issue and PR numbers using the repository’s configured providers (`workflow.providers`).
3. **Split M4 and M5** — Do not collapse into a single “M4/M5” cell when both apply.
4. **Status** — Overall slice position *now* (distinct from individual gate cells).
5. **Shipped** — Intent delivered; keep scannable (≤ ~8 bullets unless the slice is unusually large).
6. **Validation** — Mechanical checks only. Prefer the repository’s standard commands. Use **N/A** when the project has no such check. Do not replace this table with “all tests green.”
7. **Next Gate** — Exactly one next gate, or `None — slice complete`.

---

## Relationship to stage outcome templates

M3/M5/M7 **Accept / Return / Approved** templates remain authoritative for the review decision itself. The Slice Completion Report **summarizes** handoff state for humans scanning history; it MUST NOT contradict the stage outcome record.

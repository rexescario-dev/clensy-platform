---
name: workflow
description: >-
  Use for specification, design review, implementation planning, plan review,
  implementation, code review, refactoring, documentation, or workflow-validation
  work in this repository. Activates the installed engineering workflow under
  docs/workflows/.
---

# Engineering workflow

Before performing workflow-governed engineering work, read `docs/workflows/README.md`.

1. Open `docs/workflows/README.md`.
2. Read the process contract and conventions it links.
3. Open the stage prompt that matches the work (see selection below).
4. Follow that prompt's instructions — do not restate or reinvent the workflow here.

## Workflow selection

Determine the current stage from the user request and available Accepted artifacts.

- If the request begins a new feature or design and no Accepted specification exists, start with M2 (`docs/workflows/prompts/specification.md`).
- If an Accepted specification is available, continue with M4 (`docs/workflows/prompts/implementation-planning.md`) unless the user is in Design Review (M3).
- If an Accepted implementation plan is available, continue with M6 (`docs/workflows/prompts/implementation-execution.md`).
- For review / refactor / docs / workflow-validation requests, open the matching prompt under `docs/workflows/prompts/`.
- If the requested stage's prerequisites are missing, **stop** at the appropriate gate and explain what is missing.
- Do not skip mandatory review gates unless the user explicitly states they are intentionally bypassing the workflow.

## Stage map

| When the work is… | Open |
| --- | --- |
| Specifying | `docs/workflows/prompts/specification.md` |
| Design review | `docs/workflows/prompts/design-review.md` |
| Implementation planning | `docs/workflows/prompts/implementation-planning.md` |
| Plan review | `docs/workflows/prompts/plan-review.md` |
| Implementing Accepted plan | `docs/workflows/prompts/implementation-execution.md` |
| Code review | `docs/workflows/prompts/code-review.md` |
| Refactoring | `docs/workflows/prompts/refactoring.md` |
| Documentation | `docs/workflows/prompts/documentation-execution.md` |
| Workflow validation | `docs/workflows/prompts/workflow-validation.md` |

`docs/workflows/README.md` (step 1) already links the process contract and conventions — no separate reference list is needed here.

## Hard rules

1. Accepted specs and Accepted implementation plans are authoritative — do not redesign them in later stages.
2. Do not begin M6 until M5 has Accepted the implementation plan.
3. Prefer one PR per tracking issue for a delivery slice (Accepted plan + implementation when both apply).
4. `workflow.yaml` is installer inventory only — not agent process instructions.
5. Do not edit managed `docs/workflows/**` unless the user is intentionally customizing the installed workflow (Update/Replace may overwrite).

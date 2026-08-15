# Engineering workflow

Governing contract: [Process Specification: Standardized Agent Workflows](specs/agent-workflow-design.md) · Conventions: [prompt-library.md](conventions/prompt-library.md)

This directory holds a **published** engineering workflow for AI agents and humans: stage prompts, conventions, and the process contract. It is intended to be used as ordinary repository documentation under `docs/workflows/`.

## How to use

1. Read the [process specification](specs/agent-workflow-design.md) for stages, gates, and invariants.
2. Follow [prompt-library conventions](conventions/prompt-library.md) when invoking or extending prompts.
3. Open the stage prompt that matches the work you are doing (table below).
4. At M6–M9 handoffs (and final acceptance), emit a [Slice Completion Report](conventions/reporting-conventions.md).

## Stage → prompt map

| Stage | Prompt |
| --- | --- |
| M1 Conventions | [conventions/prompt-library.md](conventions/prompt-library.md) |
| M2 Specification | [prompts/specification.md](prompts/specification.md) |
| M3 Design Review | [prompts/design-review.md](prompts/design-review.md) |
| M4 Implementation Planning | [prompts/implementation-planning.md](prompts/implementation-planning.md) |
| M5 Plan Review | [prompts/plan-review.md](prompts/plan-review.md) |
| M6 Implementation | [prompts/implementation-execution.md](prompts/implementation-execution.md) |
| M7 Code Review | [prompts/code-review.md](prompts/code-review.md) |
| M8 Refactoring | [prompts/refactoring.md](prompts/refactoring.md) |
| M9 Documentation | [prompts/documentation-execution.md](prompts/documentation-execution.md) |
| M10 Workflow Validation | [prompts/workflow-validation.md](prompts/workflow-validation.md) |

## Layout

```text
docs/workflows/
  README.md                 # this file
  specs/
    agent-workflow-design.md
  conventions/
    prompt-library.md
  prompts/
    …
```

Operational installer state (if present) lives in repository-root `workflow.yaml`, outside this tree. When `workflow.providers` is set, agents MUST honor those capability providers (see [prompt-library conventions](conventions/prompt-library.md) §12).

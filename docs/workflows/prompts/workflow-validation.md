# Workflow Validation Prompt

Governing contract: [Process Specification: Standardized Agent Workflows](../specs/agent-workflow-design.md) · Stage **M10** · Conventions: [prompt-library.md](../conventions/prompt-library.md)

## Purpose

Answer: **Does the full workflow cohere with no gaps, overlaps, or broken traceability?**

Validate the **workflow assets themselves** (prompt library + governing process specification)—not a product feature. Produce a validation report that confirms stages, owners, gates, responsibilities, and cross-references form an executable end-to-end engineering process.

## When to use

- Closing a workflow asset set after M1–M9 assets exist
- Re-validating after material changes to the process specification or prompt library

## Preconditions

- Process specification is **Accepted**
- Prompt library conventions (M1) and stage prompts M2–M9 exist under `docs/workflows/prompts/`
- Prompt library conventions Accepted ([prompt-library.md](../conventions/prompt-library.md))

## Instructions

1. **Inventory assets.** List every workflow asset under `prompts/` and map each to a stage (M1–M10).
2. **Check ownership.** Every stage has a defined output, owner (tracking issue or equivalent), and primary asset. No stage lacks an asset; no orphan assets lack a stage.
3. **Check single responsibility.** Each primary prompt answers exactly one stage question; responsibilities do not overlap (especially author vs review pairs).
4. **Check gates.** Every gate is reachable from the prior stage’s success path; hard prerequisites (especially M6←M5) are stated in both process spec and M6 prompt.
5. **Check authority model.** Dual authority (spec = semantics, plan = sequencing) is consistent across M4–M7; Accepted artifacts are not silently overridden.
6. **Check traceability rules.** Assets reference the governing process specification; review/execution prompts require citing Accepted upstream artifacts.
7. **Check naming and terminology.** Filenames, stage names, and gate wording align with the process specification.
8. **Check executability.** A developer or agent can run M2→M9 using only these assets plus the process spec without inventing missing stage instructions.
9. **Record findings.** Blocking vs non-blocking. Blocking findings prevent M10 Accept.
10. **Decide.** **Accepted** (workflow validated) or **Returned** (fix assets / process spec, then re-run M10).

### Validation checklist *(normative for M10)*

| Check | Fail → |
| --- | --- |
| Every stage M1–M10 has output + owner + asset | Return |
| No orphan workflow assets outside approved layout | Return |
| Stage responsibilities do not overlap | Return |
| Every gate reachable on success path | Return |
| M6 MUST NOT begin before M5 Accept (stated) | Return |
| Cross-references between prompts and process spec are correct | Return |
| Naming/terminology consistent | Return |
| Full workflow executable without inventing instructions | Return |
| Traceability to Accepted predecessors required where applicable | Return |

## Outputs

| Output | Status |
| --- | --- |
| Validation report (path recorded) | **Accepted** or **Returned** |

### Outcome template

```text
Decision: Accepted | Returned
Subject: workflow prompt library
Governing specification: docs/workflows/specs/agent-workflow-design.md

Asset inventory:
- …

Blocking findings:
- None | …

Non-blocking observations:
- …

Gate: Workflow validated | Return to fix assets
```

## Gate

**Workflow validated** — Checklist passes with no blocking findings; validation report Accepted. The standardized agent workflow is reusable for future work.

## Non-goals

- Validating a product feature implementation
- Rewriting prompts during validation without an explicit Return cycle
- Expanding into new workflow families (tool packs, release ops) in this stage
- Tool-specific UI instructions

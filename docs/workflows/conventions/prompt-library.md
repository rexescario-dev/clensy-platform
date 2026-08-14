# Prompt library conventions

Governing contract: [Process Specification: Standardized Agent Workflows](../specs/agent-workflow-design.md)

These conventions apply to workflow assets under `docs/workflows/` (README, specs, conventions, and prompts).

## Normative conventions

1. **Governing reference.** Every workflow asset MUST link the process specification and MUST NOT redefine accepted architectural or process decisions.
2. **Single responsibility.** One primary question per primary prompt (see process spec §2.1).
3. **Tool-agnostic.** Write for any capable agent. Avoid tool-only UI instructions unless a future pack is explicitly tool-scoped.
4. **Cross-repository reuse.** Prefer wording that works across repositories. Project-specific details belong only in explicitly project-scoped assets.
5. **Authoritative inputs.** Prompts MUST treat approved specifications and approved implementation plans as authoritative and MUST NOT redesign them during later stages.
6. **Reference, do not restate.** Assets SHOULD cite governing specs/plans rather than copying their contracts.
7. **Shared vocabulary.** Prefer linking these conventions and the process spec over duplicating rules across prompts.
8. **Gates.** Preserve Draft → Review → Accepted for specifications and plans. **Execution** means M6 implementation only. No implementation activity governed by M6 MUST begin until M5 has accepted the implementation plan.
9. **Scope discipline.** Produce only the work owned by the active stage/issue. Do not invent sibling prompts for future stages without an authorized change.
10. **Traceability.** Downstream assets SHOULD reference the Accepted artifact(s) from which they were produced.
11. **Delivery packaging.** Prefer one pull request per tracking issue for a delivery slice, including Accepted plan and implementation when both apply.
12. **Capability providers.** When the workflow needs an issue tracker, source control, or pull requests, read repository-root `workflow.yaml` → `workflow.providers` and use the configured provider. Tool/MCP availability is never provider policy. If the configured provider is missing or unavailable, stop or degrade explicitly — do not silently fall back to another integration.
13. **Slice Completion Report.** At M6–M9 handoffs and final acceptance summaries, produce a [Slice Completion Report](reporting-conventions.md) (gate table, Shipped, Validation, Next Gate). Use **Gate**, not Phase. Do not replace the Validation table with prose-only “tests green.”

## Suggested prompt skeleton

Each primary prompt SHOULD include, in order:

1. **Title** and link to the process specification + stage (M#)
2. **Purpose** — one paragraph; the stage’s primary question
3. **When to use** — entry conditions
4. **Preconditions** — required Accepted upstream artifacts (if any)
5. **Instructions** — numbered steps for the agent
6. **Outputs** — artifacts and their status after the stage
7. **Gate** — completion criteria matching the process specification
8. **Non-goals** — what this prompt must not do (especially: no redesign of Accepted inputs)

Individual prompts MAY omit sections that are not applicable, provided the stage gate remains unambiguous.

## Relationship to skills

Agents MAY use external skills while following these prompts. Workflow assets standardize the engineering process; they do not replace skills.

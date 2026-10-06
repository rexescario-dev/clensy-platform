# Repository guidance for Claude

This repository uses the installed engineering workflow. Start at `docs/workflows/README.md`. `docs/workflows/` is installer-managed: do not edit it to record project policy. Record project policy here instead.

## M7 code review: who reviews

Owner decision, 2026-10-06. The M7 prompt (`docs/workflows/prompts/code-review.md`) says the reviewer SHOULD be independent of the M6 implementer. This project applies that by risk:

- **A fresh, independent reviewer is required** when a slice changes:
  - application code;
  - authorization;
  - tenant isolation;
  - schema or database.

  Dispatch a fresh agent, on the most capable model, that did not implement the change. Give it the Accepted spec, the Accepted plan and the branch diff. The M7 record cites that review.
- **A self-review is permitted** for docs-only and settings/configuration-only slices. The M7 record MUST label it **self-review**.
- **On any slice**, the owner may request a fresh reviewer. That request overrides the rule above.

This standing instruction counts as the owner's request to dispatch a reviewer agent at M7 whenever the first bullet applies.

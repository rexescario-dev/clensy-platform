---
name: javascript-conventions
description: >-
  Use when writing, reviewing, or refactoring JavaScript or TypeScript in
  this repository. Activates the installed JS/TS coding conventions under
  docs/conventions/javascript/.
---

# JavaScript and TypeScript coding conventions

Before changing JavaScript or TypeScript, read
`docs/conventions/javascript/README.md`.

1. Open `docs/conventions/javascript/README.md`.
2. Leave mechanical lint to ESLint via the project-owned config that
   spreads `tooling/eslint.contextforge.mjs`.
3. Do not edit managed convention files unless the user is intentionally
   customizing them (`update` / `replace` may overwrite).
4. Do not replace a project-owned `eslint.config.*` with the managed
   fragment.

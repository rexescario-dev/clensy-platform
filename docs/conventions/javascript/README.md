# JavaScript and TypeScript coding conventions

These conventions apply to JavaScript and TypeScript. They are not tied to
React, Vue, Next.js, or any one bundler. Where a UI framework is in use,
apply the same rules to modules that are not components.

**Machine-enforceable lint** lives in the managed fragment
`tooling/eslint.contextforge.mjs` (`contextforgeJavascript`). Spread it from
a **project-owned** `eslint.config.*`. Do not replace an existing root
ESLint config with the managed file.

This document covers judgment ESLint does not own: module boundaries, API
shape, errors, and maintainability.

## ESLint adoption

1. Install `eslint` and `typescript-eslint` in the destination project
   (versions compatible with that repo's Node/flat-config setup).
2. Import `eslint` and `typescript-eslint` from the **project-owned** config
   (pnpm will not resolve those packages from `tooling/`). Call
   `contextforgeJavascript({ eslint, tseslint })` and spread the result
   after ignores.
3. Put repository-specific `languageOptions.globals`, path ignores, and
   extra plugins in the project-owned config.
4. Do not edit the managed fragment for one repo — `update` restores it
   when the digest still matches.

## Naming

- Types, classes, and components-as-types: `PascalCase`.
- Values, functions, and properties: `camelCase`. Module-level constants
  that are true constants may be `UPPER_SNAKE` only when they are scalars
  or frozen enumerations, not mutable objects.
- Files: match the primary export. Do not export a `UserService` from
  `helpers.ts`.
- Avoid one-letter names except tight loop indexes. Avoid `data`, `info`,
  `manager`, `util` as the only name of a module.

## Structure

- One module, one job. Do not mix persistence, HTTP, and policy in the
  same file because they happen to share a type.
- Keep side effects at the edge (handlers, scripts, UI event functions).
  Pure helpers stay pure.
- Prefer named exports for libraries and shared modules. Default exports
  are for framework entry files that require them.
- Do not create barrel files that re-export an entire package graph and
  then import everything through the barrel. That hides cycles.
- Record keys (object literals) use this order when insertion order is
  not observable: `id` first, then other identifier keys (`actorId`,
  `catalogId`, `user_id`) sorted among themselves, then remaining keys
  naturally (ESLint `contextforge/record-key-order`, four or more keys,
  blank-line groups allowed). Apply the same order to TypeScript
  type/interface members when you write or review them. Smaller objects
  may keep a conventional order (for example TypeORM `type` first). Do
  not reorder when later keys overwrite earlier ones via spread, or when
  `Object.keys` / JSON key order is part of a contract — split groups
  with a blank line or disable the next line.
- Functions that both compute and write must make the write obvious in the
  name (`saveInvoice`, not `prepareInvoice`).

## Typing (TypeScript)

- Do not use `any` to silence the compiler. Use `unknown` and narrow, or
  model the type.
- Public functions get explicit return types when inference would leak
  implementation types across a module boundary.
- Union and intersection members are kept in alphabetical order (ESLint
  `@typescript-eslint/sort-type-constituents`).
- Prefer `readonly` / `Readonly<>` for values that callers must not
  mutate. Do not mutate arguments you do not own.
- Discriminated unions beat loosely optional fields (`status: 'ok' | 'err'`
  rather than `error?: string` on every object).
- Do not disable `@typescript-eslint` rules in the managed fragment. Scope
  a project override to a file or directory if a legacy island needs it.

## JavaScript without TypeScript

- Treat JSDoc `@param` / `@returns` as the contract for exported functions.
- Use `===`. Do not rely on implicit coercion for API boundaries.
- Prefer `const`; `let` only when reassignment is the point. Never `var`.

## Errors

- Fail with `Error` subclasses or a project result type. Do not return
  magic strings or `false` for exceptional I/O.
- Catch only to add context, translate, or apply a documented fallback.
  Empty `catch` is forbidden.
- Do not log and swallow. If the UI needs a message, map a stable code to
  copy at the edge — do not parse English from `error.message` in every
  feature.

## Dependencies

- Inject I/O (fetch, clock, storage) into logic you need to test.
  Do not call `Date.now()` or `fetch` from deep helpers if tests must
  freeze time or the network.
- Justify new runtime dependencies. A ten-line function is not a package.
- Do not import a module solely for a type if `import type` exists.

## Anti-patterns

- Hidden global mutable state.
- `eslint-disable` without a one-line reason and a path-limited scope.
- Deep defaulting that masks missing data (`foo?.bar?.baz ?? []` through
  three layers of domain objects).
- Copy-pasted policy across features. Extract one function.
- Comments that only restate the next line.

Agents implementing or reviewing JS/TS in a repository that installed this
package should follow this file and leave mechanical lint to ESLint plus
the project-owned config.

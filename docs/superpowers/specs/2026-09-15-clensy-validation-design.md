# `@clensy/validation` — Frontend Validation Package — Design

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-09-15 |
| Tracking issue | [#51](https://github.com/rexescario-dev/clensy-platform/issues/51) |
| Depends on (Accepted) | [Phase 1 Design](2026-08-14-clensy-platform-phase1-design.md) §2 — `packages/*` workspace layout, `packages/ui` as the API/domain-agnostic component home. [Customers & Properties](2026-08-15-customers-properties-design.md) §2, §4.7 — `Customer.fullName`/`.email`/`.phone` non-empty domain invariant, the email-syntax-is-a-presentation-layer-concern split (`CreateCustomerInput`'s `@IsEmail()`), `Add customer` as an existing accepted surface this spec migrates without changing its behavior or GraphQL contract. |
| Related (not a dependency) | [App Router i18n Architecture](2026-09-13-web-i18n-architecture-design.md) (Accepted) — its §4.5/§6 document a forward `validation.<rule>` catalog contract and explicitly state neither ticket blocks the other, and that #51 owns the rule engine while i18n integration is a later renderer swap. This spec does not implement that catalog integration; §6 below states the compatibility contract precisely. |
| Followed by | None yet. A future slice may (a) migrate additional forms beyond Add Customer, (b) swap `@clensy/validation`'s message-rendering layer for the i18n `validation.<rule>` catalog, (c) add date rules if a migrated form needs them. |
| Governing references | This document. It does not redefine Customers & Properties' domain/API contracts (`CreateCustomerInput`, `createCustomer` resolver, `Customer` invariants) or the i18n spec's catalog architecture — it adds a client-side validation layer in front of the existing contract and documents (without implementing) a future integration point with the existing catalog architecture. |
| Revision note | First M3 pass returned the draft for contract-precision tightening (not a redesign): the §7 Add Customer acceptance criterion was corrected to match the `notes: 'nullable|string'` rule (it previously claimed all four fields show `required` errors on a blank submit, which contradicts §4.2); `Rules<T>`/`validate<T>`'s generic constraint was relaxed from `T extends Record<string, unknown>` to `T extends object` (an `interface`-typed form-values type does not structurally satisfy an index-signature constraint, so the original constraint would have rejected exactly the ordinary form interfaces §4.6 uses); `min`/`max`/`between`, `in`/`not_in`, `same`/`different`, and `url` were given precise normative semantics; unknown/malformed rule strings were defined as a thrown programmer error; a worked `required_if` example was added; `nullable`'s no-independent-effect behavior was called out as an intentional simplification rather than left implicit; §6 now states that rule identity is an internal detail and `FieldErrors` intentionally carries rendered strings; the GraphQL fixture capture was reworded as an explicit M4/M6-blocking step; and §4.6's "byte-identical" claim was narrowed to the actual invariant (mutation variables shape and `notes` normalization behavior unchanged). All applied in this version. |
| M3 decision | **Accepted** — 2026-09-15. No remaining design blocker; corrections above applied. The GraphQL validation-error fixture capture (§4.5) carries forward as an explicit M4/M6 blocking prerequisite for `normalizeApiValidationErrors`, not something M4 should plan around by assumption. Ready for M4 Implementation Planning. |

## 1. Thesis

`apps/web` has no client-side validation abstraction: every admin form (login, customers, cleaners, catalog, bookings, laundry) hand-rolls a `useState` per field, a single page-level `formError` string, and HTML `required` as the only pre-submit check. `@clensy/ui`'s `FormField` (a labeled `<input>`, `error?: string`) and `FormDialog` (a presentational modal+`<form>` that only `preventDefault`s and calls `onSubmit`) already fit a field-error-driven UI — nothing consumes that fit today. This spec introduces `@clensy/validation`: a workspace package owning Laravel-inspired rule strings, a field → `string[]` error contract, a React Hook Form resolver, and a normalizer that maps a failed GraphQL mutation onto the same contract — while `@clensy/ui` stays presentation-only and React Hook Form is added to `apps/web`, not to `@clensy/ui`. It ships one migrated form (Add Customer) as integration proof, not a UI-kit rewrite.

## 2. Scope

**In scope (normative):**

- A new workspace package `packages/validation` (`@clensy/validation`), workspace-wired (`pnpm-workspace.yaml` already covers `packages/*`; no change needed there), mirroring `packages/ui`'s source-shipped convention (§4.1).
- A rule-string validation engine (`validate()`), the initial rule set enumerated in the tracking issue (§4.2), and Laravel-style default message templates (§4.3).
- A field → `string[]` error contract (§4.2) and a React Hook Form `Resolver` adapter consuming it (§4.4).
- A normalizer (`normalizeApiValidationErrors`) that maps a failed `createCustomer` GraphQL mutation onto the same field → `string[]` contract, or returns nothing when the failure isn't a recognized field-validation shape (§4.5).
- Adding `react-hook-form` to `apps/web` as a direct dependency and as a declared peer dependency of `@clensy/validation` (§4.1, §5).
- Migrating exactly the **Add customer** `FormDialog` (`apps/web/app/app/customers/page.tsx`) to `useForm` + the Clensy resolver + the normalizer, with no change to `CreateCustomerInput`, the `createCustomer` resolver, or the customer list/detail behavior (§4.6).
- Unit tests for every initial rule, message formatting, the resolver, and the normalizer against a real captured GraphQL validation fixture (§7).
- A short package README documenting the pattern for adding a new validated form.

**Informative:** `CreateCustomerInput`'s current `class-validator` decorators (`@IsString`, `@IsEmail`, `@IsOptional`), the existing `useCreateCustomerMutation` Apollo hook (`@clensy/client`, codegen-produced), `apps/api`'s global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` (no custom `exceptionFactory`) and GraphQL module registration (no custom `formatError`).

**Out of scope:**

- Replacing or duplicating backend/`class-validator` validation, or reproducing its decorators as a parallel DTO schema.
- Running Laravel/PHP, or implementing the full Laravel rule catalog (date rules, file rules, `confirmed`, regex rules, etc.) — only the rule set in §4.2.
- Moving `react-hook-form`, RHF types, or a validation-engine import into `@clensy/ui`, or adding an `Input`/textarea/children-slot component to `@clensy/ui`. Add Customer's four fields (`fullName`, `email`, `phone`, `notes`) all currently render through `FormField`'s owned `<input>`, including `notes` (a single-line input today, not a textarea) — so no composition change is needed to satisfy this ticket, resolving Open design decision 1 from the tracking issue without a `@clensy/ui` change.
- Migrating any form other than Add Customer (edit customer, add/edit property in the same file; cleaners, catalog, bookings, laundry; login).
- Changing login's non-discriminating auth-error UX, wiring, or audit semantics.
- Integrating `@clensy/validation`'s messages with the i18n spec's `validation.<rule>` catalog — this spec documents the compatibility contract (§6) but does not implement it. `@clensy/validation` ships fixed English message templates in this slice.
- Asserting a specific GraphQL validation-error wire shape as fact. §4.5 states why and what this spec requires instead.
- Adding a `max:255`-style length constraint to the Add Customer rules that the backend `CreateCustomerInput` does not itself enforce (see §4.2 — the backend DTO has no `@MaxLength` on any field).
- A second UI/component library or a new test runner (Vitest is used).

## 3. Terminology

- **Rule string:** a pipe-separated Laravel-inspired constraint list for one field, e.g. `'required|email'`. Each token is `ruleName` or `ruleName:param1,param2`.
- **Rules map:** `Partial<Record<keyof T, string>>` — one rule string per validated field of form-values type `T`.
- **Field-error map (`FieldErrors`):** `Record<string, string[]>` — the shared contract every layer (rule engine, resolver, normalizer) produces and consumes. Multiple messages per field are first-class; a consumer that wants one string (e.g. `FormField.error`) takes the first entry.
- **Attribute:** the human-readable name substituted for `:attribute` in a message template (e.g. `fullName` → `"full name"`). Defaults to a humanized form of the field key; overridable per call.
- **Resolver:** a function matching React Hook Form's `Resolver<T>` type — `(values, context, options) => { values, errors }` — that RHF calls internally on every `validate`/`handleSubmit` pass. `clensyResolver(rules)` is `@clensy/validation`'s implementation of that shape.
- **Normalizer:** `normalizeApiValidationErrors`, a function that inspects a thrown Apollo mutation error and either returns a `FieldErrors` map (recognized field-validation failure) or a sentinel meaning "not a field-validation error" (§4.5), so the caller falls back to its existing generic message.
- **Presentation-only (`@clensy/ui`):** unchanged from the i18n spec's definition — `FormField`/`FormDialog` accept only plain strings (`label`, `error`, `title`, `submitLabel`); they hold no RHF types, no rule engine, no validation-package import.

## 4. Architecture & behavioral contracts

### 4.1 Package placement and conventions

```text
packages/validation/
  package.json          ← "@clensy/validation", private, "main": "src/index.ts" (source-shipped, mirrors ui/client)
  tsconfig.json          ← mirrors packages/ui's, without "jsx" (no React components here)
  eslint.config.mjs       ← reuses ../../tooling/eslint.contextforge.mjs, same as ui/client
  vitest.config.ts        ← new: environment 'node', include ['src/**/*.test.ts'] (no existing packages/* Vitest setup to copy — apps/web's is the only structural precedent)
  src/
    index.ts               ← public exports only
    types.ts                ← RuleString, Rules<T>, FieldErrors, ValidateOptions
    rules.ts                 ← rule implementations + parser
    messages.ts               ← default Laravel-style templates + attribute humanization
    validate.ts                ← validate(values, rules, options) -> FieldErrors
    react-hook-form.ts          ← clensyResolver(rules, options) -> Resolver<T>
    normalize.ts                 ← normalizeApiValidationErrors(error, knownFields) -> FieldErrors | undefined
```

`package.json` mirrors `packages/ui`'s exact shape (`"version": "0.0.1"`, `"private": true`, `"main": "src/index.ts"`, `build: "tsc --noEmit"`, `lint: "eslint src"`) plus a new `test: "vitest run"` script and `vitest` devDependency — no existing `packages/*` has a `test` script today, so this is new ground within the monorepo, not a copy of a sibling package's Vitest wiring. Unlike `packages/ui`/`packages/client`, `@clensy/validation` has **no `react` dependency** — it is pure TypeScript logic; the only React-adjacent dependency is `react-hook-form`, declared as a `peerDependency` (types only — the resolver's return type is RHF's `Resolver<T>`) and a matching `devDependency` for building/testing it in isolation. The exact `react-hook-form` version is an implementation-time decision (M4/M6), not pinned by this spec.

**`apps/web` wiring (two required, easy-to-miss additions):**

1. `apps/web/package.json` `dependencies` gains `"@clensy/validation": "workspace:*"` and `"react-hook-form": "<version>"`, alongside the existing `"@clensy/client"`/`"@clensy/ui"` entries.
2. `apps/web/next.config.ts`'s `transpilePackages` array (`apps/web/next.config.ts:9`, currently `['@clensy/client', '@clensy/ui']`) MUST gain `'@clensy/validation'` — the existing comment there explains why: these packages ship TS source directly (no build step), so Next must transpile them itself. Omitting this entry is a build-time failure mode, not a lint-time one, so implementation MUST verify `pnpm --filter web build` after adding the package.

### 4.2 Rule engine and error contract

Rule string grammar: `ruleName` or `ruleName:param1,param2,...`, tokens joined by `|`. Initial rule set (from the tracking issue, no more): `required`, `nullable`, `string`, `integer`, `numeric`, `boolean`, `array`, `email`, `url`, `min`, `max`, `between`, `in`, `not_in`, `same`, `different`, `required_if`, `required_unless`, `required_with`, `required_without`. Date rules are explicitly deferred — no migrated form needs one.

```ts
type RuleString = string;
type Rules<T extends object> = Partial<Record<keyof T, RuleString>>;
type FieldErrors = Record<string, string[]>;

function validate<T extends object>(
  values: T,
  rules: Rules<T>,
  options?: ValidateOptions,
): FieldErrors;
```

**Generic constraint (normative).** `Rules<T>`/`validate<T>` are constrained to `T extends object`, not `T extends Record<string, unknown>`. `Partial<Record<keyof T, RuleString>>` only needs `keyof T`, which any object type provides; an index-signature constraint like `Record<string, unknown>` does not — a plain `interface CreateCustomerFormValues { fullName: string; ... }` (§4.6's own example) does not structurally satisfy `Record<string, unknown>` unless it declares an index signature, and TypeScript would reject `Rules<CreateCustomerFormValues>` under the original constraint. `object` avoids that failure mode entirely while still rejecting primitives. §4.4's `clensyResolver<T extends FieldValues>` keeps its own, separate RHF-specific constraint (`FieldValues` is RHF's own type); `Rules<T>`/`validate` themselves stay independent of RHF's type vocabulary.

`validate` evaluates every field in `rules` against the full `values` object (not one field at a time), so cross-field rules (`same`, `different`, `required_if`, `required_unless`, `required_with`, `required_without`) can read sibling values. A field with zero errors is absent from the returned map (not present with an empty array) — `Object.keys(errors).length === 0` is the "valid" check, matching RHF's own `Resolver` contract in §4.4.

**Empty-value short-circuit (normative).** A value counts as empty when it is `undefined`, `null`, or `''` (the trimmed-empty case is the caller's concern — form values arriving from native `<input>`s are already un-trimmed strings, and this engine does not trim). For an empty value: if the field's rule string includes `required` (or a conditional-required rule whose condition is satisfied), the engine emits exactly the `required` message and evaluates no other rule for that field. If the field is empty and not required (whether or not `nullable` is present), the engine emits no error and evaluates no other rule for that field. This prevents the cascading-error UX Laravel itself avoids (e.g. an empty optional `notes` field must never fail an `email`-shaped rule) and is why `notes: 'nullable|string'` on the Add Customer form is safe to leave empty.

**`nullable` is an intentional no-op beyond documentation (normative, called out explicitly).** Because an empty, non-required field already skips remaining rules per the short-circuit above, `nullable|string` and `string` alone behave identically for empty values — `nullable` does not independently change engine behavior in this implementation. It exists so a rule string can *declare* "this field may be absent" for readability at the call site (matching Laravel's vocabulary and the tracking issue's own examples), not because the engine needs it to decide anything. This is a deliberate compatibility simplification, not an oversight; a future revision could give `nullable` independent meaning (e.g. distinguishing "absent" from "present but null") without changing today's public contract.

**Type coercion (normative, kept minimal).** Form values arriving from native `<input>` elements are strings. `numeric`/`integer` accept a real JS number or a string that parses cleanly via `Number(...)`; `boolean` accepts a real boolean or the strings `'true'`/`'false'`; no other implicit coercion is performed. `string` rejects `null`/non-string non-empty values but never rejects an already-short-circuited empty value.

**`min`/`max`/`between` (normative).** The compared quantity depends on the value's runtime type: a `string` value compares character length (`value.length`); a `number` value (or a numeric-looking string per the coercion rule above) compares the numeric value itself; an `array` value compares item count (`value.length`). No other runtime type is supported — validating `min`/`max`/`between` against, say, a plain object or boolean is a malformed-rule condition (see below). `between:a,b` is inclusive on both bounds, matching `min`/`max`'s own inclusivity.

**`in`/`not_in` (normative).** Rule parameters are always strings (parsed from the comma-separated rule-string syntax). `in:foo,bar` passes when `String(value)` strictly equals (`===`) at least one parameter, after the value has already passed the empty-value/type-coercion handling above; `not_in` is the negation. No numeric or loose-equality coercion beyond that single `String(value)` conversion — consistent with §4.2's minimal-coercion philosophy.

**`same`/`different` (normative).** Strict equality: `same:other` passes when `values[field] === values[other]`; `different:other` passes when that comparison is `false`. No type coercion between the two compared values.

**`url` (normative).** A value passes `url` when `new URL(value)` does not throw. Any URL scheme `new URL` accepts (not restricted to `http`/`https`) is valid — this package does not implement a stricter allow-list; a caller needing scheme restriction composes it separately (e.g. `in:http:,https:` is not supported syntax — this is a documented gap, not a rule to add speculatively).

**Unknown or malformed rules (normative).** An unrecognized rule name (e.g. a typo like `emali`), or a known rule invoked with missing/invalid parameters it requires (e.g. `between:1` with only one bound, `min:abc` with a non-numeric bound), is a **programmer error**, not a user-facing validation failure. The parser (`rules.ts`) MUST throw a plain `Error` during validation execution (i.e., the first time `validate()`/`clensyResolver`'s resolver function actually runs against that rule string) rather than silently ignoring the token or treating the field as passing. This is a deliberate choice: a silently-ignored typo (`required|emali`) would otherwise disable validation without any signal, which is worse than a loud, immediate developer-facing failure.

**Conditional-required worked example (normative-by-example).** For:

```ts
const rules = {
  status: 'required',
  reason: 'required_if:status,rejected|string',
};
```

- `status: 'approved'`, `reason: ''` → valid (condition `status === 'rejected'` is false; `reason` is empty and not required, so it short-circuits per the empty-value rule above).
- `status: 'rejected'`, `reason: ''` → `reason` gets exactly the `required` message (condition true, value empty).
- `status: 'rejected'`, `reason: 'customer cancelled'` → `reason` is validated against its remaining rule (`string`) normally, since it is both required-and-satisfied and non-empty.

`required_unless`, `required_with`, and `required_without` follow the same three-case shape with their respective conditions (`unless` inverts the condition test; `with`/`without` test sibling-field presence rather than a specific value).

**Add Customer's actual rules** (mirroring `CreateCustomerInput`'s real constraints, not the tracking issue's illustrative `max:255` example — the backend DTO has no length constraint on any field, confirmed by reading `apps/api/src/modules/customers/presentation/graphql/create-customer.input.ts`):

```ts
const createCustomerRules = {
  fullName: 'required|string',
  email: 'required|email',
  phone: 'required|string',
  notes: 'nullable|string',
};
```

Implementation MAY add a client-only `max` if product wants a UX ceiling, but that would be a deliberate client-only addition beyond today's backend contract, not a mirrored constraint — call it out explicitly in code/PR description if added, rather than presenting it as backend-derived.

### 4.3 Messages

`messages.ts` ships one default English template per rule, Laravel-style, using `:attribute`:

```ts
{
  required: 'The :attribute field is required.',
  email: 'The :attribute must be a valid email address.',
  string: 'The :attribute must be a string.',
  // … one entry per rule in §4.2
}
```

`:attribute` resolves to a humanized field name: the field key split on camelCase boundaries and lowercased (`fullName` → `"full name"`), unless `ValidateOptions.attributes` supplies an explicit override per field (`{ fullName: 'full name' }` — identical here, but the override exists for cases where humanization produces an awkward name). These are **fixed English strings owned by this package** — `@clensy/validation` does not import `next-intl`, does not produce ICU message keys, and does not read from `apps/web/messages/**`. §6 documents why this is compatible with the Accepted i18n spec rather than a conflict with it.

### 4.4 React Hook Form resolver

```ts
function clensyResolver<T extends FieldValues>(
  rules: Rules<T>,
  options?: ValidateOptions,
): Resolver<T>;
```

`clensyResolver(rules, options)` returns a function matching RHF's `Resolver<T>` type. On each RHF validation pass it calls `validate(values, rules, options)`; if the result is empty, it returns `{ values, errors: {} }` (RHF proceeds to the submit handler); otherwise it maps every `field -> string[]` entry to RHF's `FieldErrors` shape as `{ type: 'validation', message: messages[0] }` and returns `{ values: {}, errors: fieldErrors }` (RHF's own convention for a failed pass). This is why `FormField`'s existing `error?: string` prop needs no change: `formState.errors.email?.message` is already the first string of `@clensy/validation`'s `email` entry.

**`FormDialog` needs zero changes.** `FormDialog.onSubmit` is typed `() => Promise<void> | void` and is called with no arguments (`packages/ui/src/form-dialog.tsx:24-27`: `handleSubmit` does `event.preventDefault(); void onSubmit();`). RHF's `form.handleSubmit(onValid, onInvalid)` returns a function of type `(event?: React.BaseSyntheticEvent) => Promise<void>`, which TypeScript accepts wherever `() => Promise<void>` is expected (fewer/optional parameters), and which tolerates being invoked with zero arguments (its internal `event?.preventDefault?.()` no-ops when `event` is `undefined` — harmless, since `FormDialog` already called `preventDefault` itself). So `<FormDialog onSubmit={form.handleSubmit(onValid)}>` is a direct, unmodified drop-in. This is the concrete mechanism that satisfies the tracking issue's "`FormDialog` must not grow React Hook Form knowledge" constraint — proven by the existing type signature, not by a proposed change to it.

### 4.5 API validation error normalization

```ts
function normalizeApiValidationErrors(
  error: unknown,
  knownFields: string[],
): FieldErrors | undefined;
```

Returns a `FieldErrors` map when `error` is recognizably a field-level validation failure for one of `knownFields`; returns `undefined` otherwise, so the caller keeps its existing generic fallback (`apps/app/app/customers/page.tsx`'s current `'Unable to create customer.'` string, unchanged) for every other failure (network error, auth failure, unrecognized shape).

**The exact GraphQL wire shape this parses is not established fact and this spec does not assert one.** Investigation confirmed `apps/api` has no custom `formatError` on its GraphQL module and no custom `exceptionFactory` on its global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` — so the shape a failed `createCustomer` call actually produces over the wire is whatever `@nestjs/graphql`'s and Apollo's default exception formatting yields, and no code or test in this repository documents, captures, or relies on that shape today (`grep -rn "BAD_USER_INPUT|originalError" apps/` returns nothing). This matches the tracking issue's own Open design decision 3, which this spec does not resolve by assertion.

**Requirement instead of an assumed shape (blocking):** capturing a real fixture is a **required, blocking step of M4/M6** — implementation planning and/or execution MUST trigger one real failed `createCustomer` mutation against the running dev API (e.g. omit `email` or send a malformed one), capture the actual response as a committed test fixture, and write `normalize.ts`'s parsing logic and unit tests against that fixture. Implementation MUST NOT proceed with `normalizeApiValidationErrors`'s parsing logic against a hand-written guess of the shape; the fixture-capture step is a prerequisite to writing that logic, not an optional follow-up that can be deferred past this ticket. If the captured shape turns out to be field-keyed already (e.g. a per-field `extensions` entry), the normalizer is a direct map; if it is Nest's default array of `"<property> <constraint description>"` strings, the normalizer matches each string's leading token against `knownFields` to recover the field key. Either way, the public function signature and `FieldErrors` return contract above do not change — only `normalize.ts`'s internal parsing does, so this is safe to leave to M4/M6 without weakening this spec's architecture.

Login is explicitly excluded from this contract: it never calls `normalizeApiValidationErrors` and never surfaces a field-level error, preserving its non-discriminating failure message.

### 4.6 Add Customer migration

`apps/web/app/app/customers/page.tsx`'s `CustomersPageContent` replaces its four `useState` fields (`fullName`, `email`, `phone`, `notes`) and `formError` string with:

```ts
const form = useForm<CreateCustomerFormValues>({
  resolver: clensyResolver(createCustomerRules),
});
```

Each `FormField` spreads `{...form.register('fullName')}` (etc.) instead of `value`/`onChange`, and takes `error={form.formState.errors.fullName?.message}`. `resetForm()` becomes `form.reset()`; `openCreateForm` calls it before opening. The submit handler:

```ts
async function onValid(values: CreateCustomerFormValues) {
  try {
    await createCustomer({
      variables: {
        input: {
          ...values,
          notes: values.notes?.trim() === '' ? undefined : values.notes,
        },
      },
    });
    setFormOpen(false);
    form.reset();
    await refetch();
  } catch (err) {
    const fieldErrors = normalizeApiValidationErrors(err, ['fullName', 'email', 'phone', 'notes']);
    if (fieldErrors) {
      for (const [field, messages] of Object.entries(fieldErrors)) {
        form.setError(field as keyof CreateCustomerFormValues, { type: 'server', message: messages[0] });
      }
    } else {
      setFormError('Unable to create customer.');
    }
  }
}
```

`<FormDialog onSubmit={form.handleSubmit(onValid)} ...>` (§4.4). The mutation variables shape and the `notes`-trim-to-`undefined` normalization behavior remain unchanged from the current implementation (`apps/web/app/app/customers/page.tsx:137-153`), as do `setFormOpen(false)` and `refetch()` on success — this migration changes *how errors surface before and after submit*, not the GraphQL call itself. (The values feeding that call now come from RHF's `register`-bound state rather than local `useState`, so the call site's source of truth changes even though the resulting `variables` object and API contract do not.) Edit customer, Add property, and Edit property in the same file are untouched (they keep their current `useState` pattern).

## 5. Rationale

**Why a new `packages/validation` rather than validation helpers inside `apps/web`?** The same rule engine, resolver, and normalizer are needed by every future migrated form (cleaners, catalog, bookings, laundry), and by the login-adjacent forms that must *not* use field-level errors — a shared package makes the "generic auth error, field errors everywhere else" boundary an explicit API choice (call the resolver or don't) rather than a convention every page must remember.

**Why source-shipped (`"main": "src/index.ts"`) instead of a built `dist`?** Consistency with `@clensy/ui`/`@clensy/client`, both already consumed this way via `next.config.ts`'s `transpilePackages`; introducing a second build strategy for a third `@clensy/*` package would be an unforced inconsistency.

**Why `react-hook-form` as a peer dependency, not bundled?** The tracking issue's own preferred option (Open design decision 2). A peer keeps exactly one `react-hook-form` instance in `apps/web`'s dependency graph — bundling it inside `@clensy/validation` risks a duplicate-instance mismatch between the resolver's expected `Resolver<T>` shape and whatever RHF version `apps/web` itself installs.

**Why fixed English messages now instead of wiring the i18n `validation.<rule>` catalog immediately?** The Accepted i18n spec's §4.5/§6 already anticipates this ordering explicitly: "If #51 merges first with fixed English sentences, the follow-up is swapping the renderer, not restructuring the rule engine." Building both in one slice would couple two independently-sequenced tickets and contradicts that spec's own stated non-blocking relationship. §6 below states precisely what makes the later swap non-restructuring.

**Why not assume a GraphQL error shape?** No code in this repository establishes one (§4.5), and guessing risks the normalizer being unit-tested against fiction that silently diverges from what `createCustomer` actually returns — a bug this spec would rather force out during implementation (via a real captured fixture) than ship in the design as an untested assumption.

**Why does the Add Customer migration keep the mutation call shape identical?** Customers & Properties (Accepted) already fixes `createCustomer`'s contract; this spec is additive client-side validation in front of an unchanged API call, not a re-architecture of customer creation.

## 6. Compatibility with the i18n architecture (non-normative for this slice)

This section documents the integration path the i18n spec (§4.5) forward-references; it is not implemented here.

`@clensy/validation`'s rule engine (`rules.ts`, `validate.ts`) produces, per failing field, enough structure to drive either message source internally: a rule name (`'required'`, `'email'`, …), the field key, and any rule params (e.g. `between`'s two bounds). `messages.ts` is the *only* layer that turns that structure into a displayed string today. A future slice can replace `messages.ts`'s lookup with a call into `useTranslations('validation')` (i18n spec §4.5's `validation.<rule>` namespace, keyed the same way) without touching `rules.ts`, `validate.ts`, `react-hook-form.ts`, or `normalize.ts` — because none of those layers hard-code English text; they only call into `messages.ts`. This is the concrete mechanism behind both specs' shared claim that the two tickets don't block each other: the swap is confined to one file's implementation, not this package's public contract (§4.2's `validate`/`clensyResolver`/`normalizeApiValidationErrors` signatures are stable across that future change).

**Rule metadata is internal, not part of the public contract (normative).** The public `validate`/`clensyResolver`/`normalizeApiValidationErrors` boundary is, and remains, `FieldErrors = Record<string, string[]>` — already-rendered message strings, not rule identifiers or params. This is intentional: it keeps `@clensy/validation`'s public surface small and keeps `FormField.error`/RHF's `formState.errors` consumption trivial (§4.4). The i18n-swap claim above depends on that future work happening *inside* `validate()` (rule metadata flows from `rules.ts` to `messages.ts` internally, never crossing the public boundary) — it is not a claim that a future renderer can recover rule identity from an already-returned `FieldErrors` map after the fact. If a future design genuinely needs rule metadata after `validate()` returns (not anticipated by this spec), that would be a public API change to reconsider then, not something this spec's compatibility claim already covers.

## 7. Testing and acceptance

**Unit (`packages/validation`, Vitest):**

- Every rule in §4.2, pass and fail cases, including: `min`/`max`/`between` on string length, numeric value, and array item count (§4.2); `in`/`not_in`'s strict post-stringification comparison; `same`/`different`'s strict equality; `url`'s `new URL(value)` check (valid non-http scheme accepted, malformed string rejected); `nullable` vs. `required` interaction (§4.2's empty-value short-circuit, including the worked `required_if` example); every cross-field rule (`same`, `different`, `required_if`, `required_unless`, `required_with`, `required_without`); and that an unknown rule name or a malformed rule parameter throws rather than silently passing.
- Message formatting: `:attribute` substitution with both the default humanized name and an explicit `attributes` override.
- `clensyResolver`: a passing `validate()` result returns RHF's success shape; a failing one returns RHF's `FieldErrors` shape with `message` equal to the *first* string of a multi-message field.
- `normalizeApiValidationErrors`: against the real captured `createCustomer` failure fixture (§4.5) — recognized shape maps correctly onto `knownFields`; an unrecognized error (e.g. a network error) returns `undefined`.

**Existing suites:** `apps/api` and `apps/web` suites unaffected elsewhere; `apps/web` gains no new Vitest `include` pattern beyond whatever new test files land under `packages/validation/src` (a separate package, separate Vitest config — §4.1) and, if any, `apps/web` tests for the migrated page.

**Manual/integration golden path:**

- Add Customer: submitting with all fields blank shows `required` messages inline via `FormField.error` for `fullName`, `email`, and `phone` (all `required|...`); `notes` (`nullable|string`) shows no error, per §4.2's empty-value short-circuit. No mutation call fires while any of the three required fields is invalid.
- Submitting a syntactically invalid email shows only the `email` message on that field.
- Submitting valid data creates the customer exactly as before (same GraphQL variables, dialog closes, list refetches) — no regression in the happy path.
- A forced backend validation failure (if reproducible via the dev environment) demonstrates `normalizeApiValidationErrors` setting a field error instead of the generic fallback; an unrelated failure (e.g. server down) still shows `'Unable to create customer.'`.
- Login page renders and fails exactly as before — untouched by this ticket.

**Build gates:** `pnpm --filter web lint`, `pnpm --filter web build` (validating the `transpilePackages` addition, §4.1), `pnpm --filter validation lint`, `pnpm --filter validation build`, `pnpm --filter validation test`, `pnpm --filter web test`.

## 8. Non-goals

- Replacing backend/`class-validator` validation or `CreateCustomerInput`'s contract.
- Implementing the full Laravel rule catalog or date rules.
- Adding RHF, a resolver type, or a validation-engine import to `@clensy/ui`; adding an `Input`/textarea/children-slot component to `@clensy/ui`.
- Migrating any form beyond Add Customer.
- Wiring `@clensy/validation`'s messages into the i18n `validation.<rule>` catalog (§6 documents the path; a later slice implements it).
- Asserting a specific GraphQL validation-error wire shape as verified fact ahead of the fixture capture required in §4.5.
- Adding a client-only `max` length constraint to Add Customer's rules and presenting it as backend-derived.
- Changing login's non-discriminating auth-error UX, wiring, or audit semantics.
- A new test runner (Vitest is sufficient, per the tracking issue and existing `apps/web` convention).

## 9. Acceptance criteria (for this specification)

Ready to move Draft → Accepted at Design Review (M3) when: scope and non-goals are unambiguous about what ships in this slice vs. what is deferred (§2, §8); the rule engine's error contract, empty-value semantics, and type-coercion rules are precise enough for M4 to plan without re-deciding them (§4.2); the RHF integration mechanism is validated against `FormDialog`'s actual current type signature rather than a proposed change to it (§4.4); the GraphQL-error-shape uncertainty is called out as a requirement (capture a real fixture) rather than resolved by assumption (§4.5); and the i18n-compatibility claim is backed by a concrete "only `messages.ts` changes" mechanism rather than an assertion (§6).

# Escaped, Bounded Label-Override Warning Paths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Accepted |
| M5 decision | **Accepted** — 2026-10-09, at `6b827ae`, by the owner, on the second pass, with no further changes. To be executed natively on `feat/129-label-override-log-paths`. Execution constraints:
- Scope is fixed to the formatter, the validator integration and the specified unit and e2e tests: no service, resolver, schema, migration, web or package change.
- The root `$` stays unchanged, and `["$"]` is only for a stored key named `$`.
- Validation policy and logging behavior do not change beyond safe path rendering.
- Every Task 3 check runs, and any unexpected failure is investigated rather than worked around by weakening tests or widening scope.
- M7 MUST use a fresh, independent reviewer (application-code slice); a self-review is not sufficient.
- Before M7 is requested, the M6 report gives the final commit, the test results, the scope diff and any deviations.

This acceptance does not pre-approve the implementation or M7. |
| M5 history | First pass (2026-10-09, at `cd6923a`): the owner found the formatter, truncation, validator integration, regression coverage, scope and gates sound, and returned the plan with one verification correction. It was applied with no design or scope change. The Task 3 non-ASCII scan used `grep … \| grep -v '§'`, which drops a whole line that contains `§`, so a hostile character on such a line went unseen. The scan now deletes `§` from each line before testing for non-ASCII bytes, reports the file and line of any hit, and always exits 0, so no output is the only passing signal. The owner also asked M6 to preserve one detail: the root `$` for a non-object top level stays unchanged, and `["$"]` is only for a stored key named `$`. |
| Date | 2026-10-09 |
| Tracking issue | [#129](https://github.com/rexescario-dev/clensy-platform/issues/129) (deferred minor 1 of the #118 M7 review) |
| Scope | `apps/api` only. Two new files in `modules/admins` (`domain/label-override-path.ts` and its unit test), plus edits to `domain/tenant-label-overrides.ts`, its unit test, and `test/tenant-label-overrides.e2e-spec.ts`. No change to `TenantLabelOverridesService`, the resolver, GraphQL types, `schema.gql`, migrations, `apps/web`, `packages/*` or the lockfile. |
| Implements (Accepted) | The **#129 amendment** to [Tenant-Sourced Role Label Overrides for the App i18n Boundary — Design](../specs/2026-10-03-tenant-label-overrides-design.md): §4.2 *Logging* and *Path rendering*, §4.7 item 6, §6.1 (the *(#129)* bullets), §7, and the #129 criteria in §9. Status **Accepted** (M3, 2026-10-09, `a5f829d`, recorded in `bf696be`). The rest of that spec stays Accepted and unchanged. |
| Relies on (Accepted) | [Tenant label overrides plan](2026-10-03-tenant-label-overrides-plan.md) (#118), whose validator, service and e2e suite this changes. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. The file name `label-override-path.ts`, the names `appendPathSegment`, `MAX_PATH_KEY_CODE_POINTS`, `BARE_KEY`, `ROLES_PATH` and `escapeKeyPrefix`, the test names and the task order are planning decisions, not product semantics. |
| Edit anchors | Every edit to an existing file is a unified diff against the branch base `bf696be`. That commit matches `main` at `1f76ad4` plus the two spec-amendment commits, which touch no code. |
| Pre-validation | **Full.** See below. |

**Goal:** Deliver the #129 amendment. Every rejection path the validator returns is a single line of printable ASCII with a bounded length. Identifier-shaped paths stay exactly as they are today.

**Architecture:**

- **Formatter (Task 1).** A new pure module, `domain/label-override-path.ts`, exports `appendPathSegment(parent, key)`.
  - It appends one stored key to an already-rendered path, as spec §4.2 *Path rendering* prescribes.
  - A key matching `^[A-Za-z_][A-Za-z0-9_]*$` with at most 64 code points is appended bare, joined with `.`.
  - Any other key is truncated to its first 64 code points. The dropped count is taken from the raw key. The kept prefix is escaped one UTF-16 code unit at a time, and the result is written as `["prefix"]` or `["prefix"...(+N)]`.
  - It does not use `JSON.stringify`.
- **Validator integration (Task 2).**
  - `validateTenantLabelOverrides` builds every path through `appendPathSegment`: the `en.roles.<key>` leaf path, and both paths in `onlyChild`.
  - `onlyChild`'s `prefix: string` (`''` or `'en.'`) becomes `parent: string` (`''` or `'en'`).
  - The root `$` is unchanged, and so is the `{ path, reason }` shape.
  - `TenantLabelOverridesService` is untouched: it logs the already-rendered path with its existing message.

**Tech Stack:** NestJS 11, TypeScript 5, Jest (unit: `pnpm --filter api test`; e2e: `pnpm --filter api test:e2e`, against the local Postgres from `docker-compose.yml`).

**Spec:** [`docs/superpowers/specs/2026-10-03-tenant-label-overrides-design.md`](../specs/2026-10-03-tenant-label-overrides-design.md), the *(#129)*-marked passages.

**Pre-validation evidence (full).** This is evidence the author gathered before M5. It is not a record of the M6 execution, which must re-run every `Expected:` command itself.

On 2026-10-09, the author applied Tasks 1–2 to a working tree at `bf696be` and ran every command named by an `Expected:` line. Each result below, including each RED state, is quoted as observed. The tree was then restored to `bf696be`, and only this plan is committed.

- **Task 1:**
  - RED, without `label-override-path.ts`: `Test Suites: 1 failed`, because the module cannot be found.
  - GREEN: `Tests: 38 passed, 38 total`.
- **Task 2:**
  - RED, with the tests added and the validator unchanged: unit `Tests: 4 failed, 27 passed, 31 total`; e2e `Tests: 1 failed, 8 passed, 9 total`.
  - GREEN: unit (both domain suites) `Tests: 69 passed, 69 total`; e2e `Tests: 9 passed, 9 total`.
- **Final verification:**
  - `pnpm run lint`: `Tasks: 6 successful, 6 total`;
  - API `tsc --noEmit` clean;
  - `pnpm --filter api test`: `Test Suites: 74 passed` and `Tests: 1029 passed, 1029 total` (baseline 73 suites and 987 tests at `bf696be`);
  - `pnpm --filter api test:e2e:release-gate`: `Tests: 12 passed, 12 total`.
  - after the plan was written, its three ```diff``` blocks were extracted and passed `git apply --check` at `bf696be`. They were then applied with the two new files and re-verified: `pnpm --filter api exec tsc --noEmit -p tsconfig.json` exit 0; `git diff --name-only bf696be` listed exactly the five files; the non-ASCII and `JSON.stringify` scans printed nothing (the non-ASCII scan was re-run in its corrected form after the M5 first pass, see the M5 history row); and the two domain suites gave `Tests: 69 passed, 69 total`.
- **Corrected non-ASCII scan (M5 first pass).**
  - It was checked against a fixture with a U+2028 on a line that also contains `§`. The old `grep -v '§'` form printed nothing; the corrected form flagged the line.
  - It was then re-run on the four files, with the plan applied at `bf696be`: no output, exit 0. Each file contains at least one `§` line.
- **Hygiene finding.** In the first pre-validation pass, the hostile test keys U+2028, U+2029, U+202E and `é` were written into the source as literal characters instead of `\u` escapes. The tests passed either way, but invisible characters in source are a review hazard. The code below uses ASCII escapes only. Final verification now includes a non-ASCII scan (Task 3, step 5).

## Global Constraints

- Bare segment: the key matches `^[A-Za-z_][A-Za-z0-9_]*$` **and** has at most 64 code points. It is joined with `.`, with no leading `.` at the top level (spec §4.2 *Path rendering* item 1).
- Bracketed segment: any other key, written `[` `"` *escaped prefix* `"` *marker* `]`, appended directly with no `.` (item 2).
- Order: split into code points as string iteration does (a lone surrogate is one), then keep 64, then compute *dropped* from the raw count, then escape the prefix per UTF-16 code unit, then add the marker `...(+`*dropped*`)` only when *dropped* > 0 (item 3).
- Escape set: printable ASCII U+0020–U+007E stays, except `"` → `\"` and `\` → `\\`. Every other unit becomes `\u` plus four **uppercase** hex digits (item 3).
- No `JSON.stringify` for safety (item 4).
- The root `$` is unchanged and is not a segment. A rejection stays `{ path, reason }`. The validator stays pure. The service and its log message are unchanged (spec §4.2 *Logging*, §4.7 item 6).
- Nothing changes about what is validated, kept or rejected. No rate-limiting and no de-duplication (spec §7).
- A rendered path is diagnostic text only. No code may use it as an identity, lookup, de-duplication or validation key (spec §4.2 item 5).

## Review Focus

1. **A hostile key at each of the three levels** (top level, under `en`, under `roles`). Each must route through `appendPathSegment`. Task 2's "top level and under en" and "hostile keys" tests pin this. M7 should confirm that no template-string path remains in the validator.
2. **Invisible characters in source.** Test keys for U+2028, U+2029, U+202E and non-ASCII letters must be `\u` escapes, not literal characters. Task 3, step 5 scans for this.
3. **Escaping vs truncation order.** An escape sequence must never count toward the 64 cap, and a supplementary character or lone surrogate must count as one. Task 1's truncation tests pin this.
4. **Unchanged identifier paths.** Every existing path assertion (`$`, `en`, `en.roles`, `fr`, `en.staff`, `en.roles.FINANCE`, `en.roles.SUPER_ADMIN`, `en.roles.NOT_A_ROLE`) must pass with no change to its expected value. The existing unit and e2e suites are the characterization tests for this.
5. **No stored value in a warning.** The new e2e case asserts that neither the rejected values nor the kept value appear in any log line. The existing "never puts a stored value into a rejection" test stays green.

## Traceability

| Task | Spec |
| --- | --- |
| 1. Path formatter | §4.2 *Path rendering* items 1–5; §6.1 *(#129)* path-rendering bullets |
| 2. Validator integration | §4.2 *Logging* *(#129)* bullet; §4.7 item 6; §6.1 *(#129)* validator and e2e bullets; §9 #129 criteria |
| 3. Final verification | §7 (no policy change); §9 #129 criteria |

TDD applies to Tasks 1 and 2. The existing unit and e2e path assertions are **characterization tests**: they pin already-correct identifier paths and must stay green without edits.

---

### Task 1: Path formatter

**Files:**
- Create: `apps/api/src/modules/admins/domain/label-override-path.ts`
- Test: `apps/api/src/modules/admins/tests/domain/label-override-path.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export const MAX_PATH_KEY_CODE_POINTS = 64;` and `export function appendPathSegment(parent: string, key: string): string`. `parent` is an already-rendered path, or `''` for the top level.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/admins/tests/domain/label-override-path.spec.ts`:

```ts
import {
  appendPathSegment,
  MAX_PATH_KEY_CODE_POINTS,
} from '../../domain/label-override-path';

const PRINTABLE_ASCII_LINE = /^[\x20-\x7E]*$/;
const EMOJI = '\u{1F9FE}'; // one code point, two UTF-16 code units

describe('appendPathSegment (spec §4.2 Path rendering, #129)', () => {
  it('caps a stored key at 64 code points', () => {
    expect(MAX_PATH_KEY_CODE_POINTS).toBe(64);
  });

  describe('bare segments (identifier paths unchanged)', () => {
    it.each([
      ['', 'en', 'en'],
      ['', 'fr', 'fr'],
      ['en', 'roles', 'en.roles'],
      ['en', 'staff', 'en.staff'],
      ['en.roles', 'FINANCE', 'en.roles.FINANCE'],
      ['en.roles', 'SUPER_ADMIN', 'en.roles.SUPER_ADMIN'],
      ['en.roles', '_x9', 'en.roles._x9'],
    ])('appends %j + %j as %j', (parent, key, expected) => {
      expect(appendPathSegment(parent, key)).toBe(expected);
    });

    it('keeps a 64-code-point identifier bare', () => {
      const key = 'a'.repeat(64);
      expect(appendPathSegment('en.roles', key)).toBe(`en.roles.${key}`);
    });
  });

  describe('bracketed segments', () => {
    it.each([
      ['the empty key', '', '', '[""]'],
      ['a key named $', '', '$', '["$"]'],
      ['a key containing .', 'en.roles', 'a.b', 'en.roles["a.b"]'],
      ['a key with a hyphen', '', 'fr-CA', '["fr-CA"]'],
      ['a key starting with a digit', 'en', '1st', 'en["1st"]'],
      ['a key containing a space', 'en.roles', 'A B', 'en.roles["A B"]'],
    ])('brackets %s', (_label, parent, key, expected) => {
      expect(appendPathSegment(parent, key)).toBe(expected);
    });

    it('keeps a key named $ distinct from the root $', () => {
      expect(appendPathSegment('', '$')).not.toBe('$');
    });

    it('keeps a dotted key distinct from nesting', () => {
      expect(appendPathSegment('', 'a.b')).not.toBe(
        appendPathSegment(appendPathSegment('', 'a'), 'b'),
      );
    });
  });

  describe('escaping (hostile keys)', () => {
    it.each([
      ['a line feed', 'A\nB', 'A\\u000AB'],
      ['a carriage return', 'A\rB', 'A\\u000DB'],
      ['a tab', 'A\tB', 'A\\u0009B'],
      ['DEL', 'A\u007FB', 'A\\u007FB'],
      ['a C1 control (NEL)', 'A\u0085B', 'A\\u0085B'],
      ['the line separator', 'A\u2028B', 'A\\u2028B'],
      ['the paragraph separator', 'A\u2029B', 'A\\u2029B'],
      ['a bidi override', 'A\u202EB', 'A\\u202EB'],
      ['a non-ASCII letter', 'caf\u00E9', 'caf\\u00E9'],
      ['a supplementary character', `A${EMOJI}B`, 'A\\uD83E\\uDDFEB'],
      ['a lone high surrogate', 'A\uD800B', 'A\\uD800B'],
      ['a lone low surrogate', 'A\uDC00B', 'A\\uDC00B'],
      ['an embedded quote', 'A"B', 'A\\"B'],
      ['an embedded backslash', 'A\\B', 'A\\\\B'],
      [
        'a forged log line',
        'X\n[Nest] 1 - LOG ok',
        'X\\u000A[Nest] 1 - LOG ok',
      ],
    ])('escapes %s', (_label, key, escaped) => {
      const path = appendPathSegment('en.roles', key);
      expect(path).toBe(`en.roles["${escaped}"]`);
      expect(path).toMatch(PRINTABLE_ASCII_LINE);
    });
  });

  describe('truncation', () => {
    it('brackets a 65-code-point identifier and marks one dropped', () => {
      expect(appendPathSegment('en.roles', 'a'.repeat(65))).toBe(
        `en.roles["${'a'.repeat(64)}"...(+1)]`,
      );
    });

    it('counts a supplementary character as one code point', () => {
      expect(appendPathSegment('', `${EMOJI.repeat(64)}`)).toBe(
        `["${'\\uD83E\\uDDFE'.repeat(64)}"]`,
      );
      expect(appendPathSegment('', `${EMOJI.repeat(65)}`)).toBe(
        `["${'\\uD83E\\uDDFE'.repeat(64)}"...(+1)]`,
      );
    });

    it('counts a lone surrogate as one code point', () => {
      expect(appendPathSegment('', `${'a'.repeat(64)}\uD800`)).toBe(
        `["${'a'.repeat(64)}"...(+1)]`,
      );
    });

    it('truncates before escaping, so escapes never count toward the cap', () => {
      expect(appendPathSegment('', '\n'.repeat(65))).toBe(
        `["${'\\u000A'.repeat(64)}"...(+1)]`,
      );
    });

    it('bounds a very long key and records only how much was dropped', () => {
      const path = appendPathSegment('en.roles', 'x'.repeat(10_000));
      expect(path).toBe(`en.roles["${'x'.repeat(64)}"...(+9936)]`);
      expect(path).not.toContain('x'.repeat(65));
    });

    it('renders the worst-case prefix in at most 768 characters', () => {
      const path = appendPathSegment('', EMOJI.repeat(100_000));
      const prefix = path.slice('["'.length, path.indexOf('"...'));
      expect(prefix).toHaveLength(768);
      expect(path).toMatch(PRINTABLE_ASCII_LINE);
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter api test -- label-override-path`
Expected: FAIL. `Test Suites: 1 failed, 1 total`, because `../../domain/label-override-path` cannot be found.

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/modules/admins/domain/label-override-path.ts`:

```ts
// Tenant label overrides spec §4.2 "Path rendering" (#129). Pure: appends
// one stored JSON key to a rejection path as a single line of printable
// ASCII with a bounded length. The result is diagnostic text only: never an
// identity, lookup, de-duplication or validation key.

export const MAX_PATH_KEY_CODE_POINTS = 64;

const BARE_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

// `parent` is an already-rendered path, or '' for the top level.
export function appendPathSegment(parent: string, key: string): string {
  // Code points as string iteration counts them: a lone surrogate is one.
  const codePoints = [...key];
  if (BARE_KEY.test(key) && codePoints.length <= MAX_PATH_KEY_CODE_POINTS) {
    return parent === '' ? key : `${parent}.${key}`;
  }
  // Truncate the raw key, count what was dropped, then escape the prefix.
  const prefix = codePoints.slice(0, MAX_PATH_KEY_CODE_POINTS).join('');
  const dropped = codePoints.length - MAX_PATH_KEY_CODE_POINTS;
  const marker = dropped > 0 ? `...(+${dropped})` : '';
  return `${parent}["${escapeKeyPrefix(prefix)}"${marker}]`;
}

// Per UTF-16 code unit. Not JSON.stringify, which leaves C1 controls,
// U+2028/U+2029 and bidirectional controls unescaped.
function escapeKeyPrefix(prefix: string): string {
  let escaped = '';
  for (let index = 0; index < prefix.length; index += 1) {
    const unit = prefix.charCodeAt(index);
    if (unit === 0x22 || unit === 0x5c) {
      escaped += `\\${prefix[index]}`;
    } else if (unit >= 0x20 && unit <= 0x7e) {
      escaped += prefix[index];
    } else {
      escaped += `\\u${unit.toString(16).toUpperCase().padStart(4, '0')}`;
    }
  }
  return escaped;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter api test -- label-override-path`
Expected: PASS. `Tests: 38 passed, 38 total`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/admins/domain/label-override-path.ts apps/api/src/modules/admins/tests/domain/label-override-path.spec.ts
git commit -m "feat(api): render label override paths as escaped, bounded ASCII (#129)"
```

### Task 2: Validator integration

**Files:**
- Modify: `apps/api/src/modules/admins/domain/tenant-label-overrides.ts`
- Test: `apps/api/src/modules/admins/tests/domain/tenant-label-overrides.spec.ts`
- Test: `apps/api/test/tenant-label-overrides.e2e-spec.ts`

**Interfaces:**
- Consumes: `appendPathSegment(parent: string, key: string): string` from Task 1.
- Produces: no new export. `validateTenantLabelOverrides`'s signature and `LabelOverrideRejection` are unchanged. Only the rendering of `path` changes, and only for keys that aren't bare.

**Prerequisite (e2e):** the local Postgres must be running, with migrations applied: `docker compose up -d postgres`, then `pnpm --filter api migration:run`.

- [ ] **Step 1: Write the failing unit tests**

Apply to `apps/api/src/modules/admins/tests/domain/tenant-label-overrides.spec.ts`:

```diff
diff --git a/apps/api/src/modules/admins/tests/domain/tenant-label-overrides.spec.ts b/apps/api/src/modules/admins/tests/domain/tenant-label-overrides.spec.ts
index 5cb1fdc..8bf069b 100644
--- a/apps/api/src/modules/admins/tests/domain/tenant-label-overrides.spec.ts
+++ b/apps/api/src/modules/admins/tests/domain/tenant-label-overrides.spec.ts
@@ -155,6 +155,64 @@ describe('validateTenantLabelOverrides (spec §4.2)', () => {
     });
   });
 
+  describe('rejection paths (§4.2 Path rendering, #129)', () => {
+    it('renders a key containing a newline as one single-line rejection', () => {
+      expect(
+        validateTenantLabelOverrides(roles({ 'A\nB': 'Billing' })),
+      ).toEqual({
+        labels: null,
+        rejections: [{ path: 'en.roles["A\\u000AB"]', reason: 'unknown-key' }],
+      });
+    });
+
+    it('renders an over-length key as one bounded rejection', () => {
+      expect(
+        validateTenantLabelOverrides(
+          roles({ ['x'.repeat(10_000)]: 'Billing' }),
+        ),
+      ).toEqual({
+        labels: null,
+        rejections: [
+          {
+            path: `en.roles["${'x'.repeat(64)}"...(+9936)]`,
+            reason: 'unknown-key',
+          },
+        ],
+      });
+    });
+
+    it('renders stored keys at the top level and under en', () => {
+      expect(
+        validateTenantLabelOverrides({
+          $: {},
+          'en-US': {},
+          en: { 'a.b': {}, roles: { FINANCE: 'Billing' } },
+        }),
+      ).toEqual({
+        labels: { FINANCE: 'Billing' },
+        rejections: [
+          { path: '["$"]', reason: 'unknown-key' },
+          { path: '["en-US"]', reason: 'unknown-key' },
+          { path: 'en["a.b"]', reason: 'unknown-key' },
+        ],
+      });
+    });
+
+    it('produces only single-line printable ASCII paths for hostile keys', () => {
+      const { rejections } = validateTenantLabelOverrides({
+        'x\r\ny': {},
+        en: {
+          '\u2028': {},
+          roles: { '\u202EFINANCE': 'Billing', '"\\\u0085': 'Billing' },
+        },
+      });
+      expect(rejections).toHaveLength(4);
+      for (const { path } of rejections) {
+        expect(path).toMatch(/^[\x20-\x7E]+$/);
+      }
+    });
+  });
+
   it('never puts a stored value into a rejection', () => {
     const { rejections } = validateTenantLabelOverrides({
       en: {
```

- [ ] **Step 2: Write the failing e2e case**

Apply to `apps/api/test/tenant-label-overrides.e2e-spec.ts`:

```diff
diff --git a/apps/api/test/tenant-label-overrides.e2e-spec.ts b/apps/api/test/tenant-label-overrides.e2e-spec.ts
index d4eb734..b50de40 100644
--- a/apps/api/test/tenant-label-overrides.e2e-spec.ts
+++ b/apps/api/test/tenant-label-overrides.e2e-spec.ts
@@ -212,6 +212,38 @@ describe('Tenant label overrides (e2e, #118)', () => {
     expect(logged).not.toContain('Billing');
   });
 
+  // #129 (spec §4.2 Path rendering, §6.1): a hostile stored key yields one
+  // escaped, bounded, single-line warning and never its stored value.
+  it('logs one single-line, bounded warning per hostile stored key', async () => {
+    await store({
+      en: {
+        roles: {
+          'A\nB': 'Line-Value',
+          FINANCE: 'Billing',
+          ['x'.repeat(5_000)]: 'Long-Value',
+        },
+      },
+    });
+    expect(await currentAdminOverrides()).toEqual({
+      locale: 'en',
+      roles: { ...UNSET, FINANCE: 'Billing' },
+    });
+    expect(warnings()).toEqual(
+      expectedWarnings(
+        ['en.roles["A\\u000AB"]', 'unknown-key'],
+        [`en.roles["${'x'.repeat(64)}"...(+4936)]`, 'unknown-key'],
+      ),
+    );
+    for (const line of warnings()) {
+      expect(line).toMatch(/^[\x20-\x7E]+$/);
+      expect(line.length).toBeLessThan(256);
+    }
+    const logged = warnings().join('\n');
+    for (const stored of ['Line-Value', 'Long-Value', 'Billing']) {
+      expect(logged).not.toContain(stored);
+    }
+  });
+
   it('resolves the same tenant labels on the login result', async () => {
     await store({ en: { roles: { FINANCE: 'Billing' } } });
     const body = (await login(LOGIN_MUTATION)).body as GraphqlBody;
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter api test -- tenant-label-overrides.spec`
Expected: FAIL. `Tests: 4 failed, 27 passed, 31 total`. The four new tests receive raw paths such as `en.roles.A` + newline + `B`.

Run: `pnpm --filter api test:e2e -- tenant-label-overrides.e2e`
Expected: FAIL. `Tests: 1 failed, 8 passed, 9 total`. Only `logs one single-line, bounded warning per hostile stored key` fails.

- [ ] **Step 4: Route every path through the formatter**

Apply to `apps/api/src/modules/admins/domain/tenant-label-overrides.ts`:

```diff
diff --git a/apps/api/src/modules/admins/domain/tenant-label-overrides.ts b/apps/api/src/modules/admins/domain/tenant-label-overrides.ts
index 829ec6b..a8f8f3a 100644
--- a/apps/api/src/modules/admins/domain/tenant-label-overrides.ts
+++ b/apps/api/src/modules/admins/domain/tenant-label-overrides.ts
@@ -1,7 +1,10 @@
 import { Role } from '../../../platform/auth/domain/role';
+import { appendPathSegment } from './label-override-path';
 
 // Tenant label overrides spec §4.1, §4.2. Pure: returns the kept labels and
-// every rejection (path + reason, never the stored value).
+// every rejection (path + reason, never the stored value). Each path is
+// rendered by appendPathSegment (§4.2 Path rendering, #129), so a stored key
+// never reaches it raw.
 // TenantLabelOverridesService, the only reader of the column, owns logging.
 
 export type RelabelableRole = Exclude<Role, Role.SUPER_ADMIN>;
@@ -41,6 +44,10 @@ export const MAX_LABEL_CODE_POINTS = 64;
 export const TENANT_LABEL_LOCALE = 'en';
 
 const SUPPORTED_NAMESPACE = 'roles';
+const ROLES_PATH = appendPathSegment(
+  appendPathSegment('', TENANT_LABEL_LOCALE),
+  SUPPORTED_NAMESPACE,
+);
 const CONTROL_CHARACTER = /\p{Cc}/u;
 
 export function validateTenantLabelOverrides(
@@ -50,7 +57,7 @@ export function validateTenantLabelOverrides(
   const roles = rolesNode(raw, rejections);
   const labels: Partial<Record<RelabelableRole, string>> = {};
   for (const [key, value] of Object.entries(roles ?? {})) {
-    const path = `${TENANT_LABEL_LOCALE}.${SUPPORTED_NAMESPACE}.${key}`;
+    const path = appendPathSegment(ROLES_PATH, key);
     if (!isRelabelableRole(key)) {
       rejections.push({ path, reason: 'unknown-key' });
       continue;
@@ -93,21 +100,28 @@ function isRelabelableRole(key: string): key is RelabelableRole {
 // Rejects every key of `node` other than `key` as unknown, then returns
 // `node[key]` if it is an object. A missing key is absence, not a rejection.
 // A rejected node is never descended into, so nothing beneath it is reported.
+// `parent` is the node's rendered path, or '' for the top level.
 function onlyChild(
   node: JsonObject,
   key: string,
-  prefix: string,
+  parent: string,
   rejections: LabelOverrideRejection[],
 ): JsonObject | null {
   for (const other of Object.keys(node)) {
     if (other !== key) {
-      rejections.push({ path: `${prefix}${other}`, reason: 'unknown-key' });
+      rejections.push({
+        path: appendPathSegment(parent, other),
+        reason: 'unknown-key',
+      });
     }
   }
   if (!Object.hasOwn(node, key)) return null;
   const child = node[key];
   if (!isJsonObject(child)) {
-    rejections.push({ path: `${prefix}${key}`, reason: 'not-an-object' });
+    rejections.push({
+      path: appendPathSegment(parent, key),
+      reason: 'not-an-object',
+    });
     return null;
   }
   return child;
@@ -130,7 +144,7 @@ function rolesNode(
   return onlyChild(
     locale,
     SUPPORTED_NAMESPACE,
-    `${TENANT_LABEL_LOCALE}.`,
+    TENANT_LABEL_LOCALE,
     rejections,
   );
 }
```

- [ ] **Step 5: Run them to verify they pass**

Run: `pnpm --filter api test -- tenant-label-overrides.spec label-override-path`
Expected: PASS. `Tests: 69 passed, 69 total`. Every pre-existing identifier-path assertion passes unedited.

Run: `pnpm --filter api test:e2e -- tenant-label-overrides.e2e`
Expected: PASS. `Tests: 9 passed, 9 total`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/admins/domain/tenant-label-overrides.ts apps/api/src/modules/admins/tests/domain/tenant-label-overrides.spec.ts apps/api/test/tenant-label-overrides.e2e-spec.ts
git commit -m "fix(api): escape and bound stored keys in label override warnings (#129)"
```

### Task 3: Final verification

No code changes. Each step is a check that must pass before M6 is reported complete.

- [ ] **Step 1: Lint**

Run: `pnpm run lint`
Expected: `Tasks: 6 successful, 6 total`. Because `lint` runs `eslint --fix`, confirm `git status --short` shows no new changes afterwards.

- [ ] **Step 2: Type-check**

Run: `pnpm --filter api exec tsc --noEmit -p tsconfig.json`
Expected: exit 0, no output.

- [ ] **Step 3: API unit tests**

Run: `pnpm --filter api test`
Expected: `Test Suites: 74 passed, 74 total` and `Tests: 1029 passed, 1029 total` (baseline 73 suites and 987 tests, plus 38 formatter tests and 4 validator tests).

- [ ] **Step 4: Release gate**

Run: `pnpm --filter api test:e2e:release-gate`
Expected: `Tests: 12 passed, 12 total`. Cross-tenant isolation is unaffected.

- [ ] **Step 5: Scope and hygiene**

Run: `git diff --name-only bf696be`
Expected: exactly these five files, plus this plan if its Gate outcomes have been updated:

```text
apps/api/src/modules/admins/domain/label-override-path.ts
apps/api/src/modules/admins/domain/tenant-label-overrides.ts
apps/api/src/modules/admins/tests/domain/label-override-path.spec.ts
apps/api/src/modules/admins/tests/domain/tenant-label-overrides.spec.ts
apps/api/test/tenant-label-overrides.e2e-spec.ts
```

Run:

```bash
perl -ne 's/\xC2\xA7//g; print "$ARGV:$.: $_" if /[^\x00-\x7F]/; close ARGV if eof' \
  apps/api/src/modules/admins/domain/label-override-path.ts \
  apps/api/src/modules/admins/tests/domain/label-override-path.spec.ts \
  apps/api/src/modules/admins/tests/domain/tenant-label-overrides.spec.ts \
  apps/api/test/tenant-label-overrides.e2e-spec.ts
```

Expected: no output, exit 0. The only non-ASCII character allowed in these files is `§` (UTF-8 `C2 A7`), in comments and test names.
- The filter deletes every `§` from a line, then prints the line, with its file and line number, if any non-ASCII byte remains.
- So a hostile character is still caught on a line that also contains `§`.
- `perl -n` exits 0 whether or not it prints. Pass/fail is decided by the output alone, never by the exit status.

Run: `grep -n 'JSON.stringify' apps/api/src/modules/admins/domain/label-override-path.ts | grep -v '^[0-9]*:\s*//'`
Expected: no output. `JSON.stringify` appears only in the explanatory comment.

## Deferred / out of scope

- Rate-limiting or de-duplicating warnings across reads (spec §7).
- Any change to what is validated, kept or rejected (spec §7).
- The `TENANT_OWNER` write path (spec §8). It will reuse this validator, and therefore this rendering, unchanged.

## Gate outcomes

*(M5–M10 records are appended here as they arrive.)*

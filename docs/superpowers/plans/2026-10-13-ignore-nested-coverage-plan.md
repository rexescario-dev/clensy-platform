# Ignore Nested Coverage Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

| Field | Value |
| --- | --- |
| Status | Draft (second draft) |
| M5 (first draft) | Request changes — 2026-10-13, at `24858e8`, by the owner. See Revision log. |
| Date | 2026-10-13 |
| Tracking issue | [#176](https://github.com/rexescario-dev/clensy-platform/issues/176). Also affects the [#173](https://github.com/rexescario-dev/clensy-platform/issues/173) drawer history guard (merged in #174). |
| Scope | One file, `.gitignore`: two lines under `# Tests`. No application code, no coverage configuration, no other ignore rule. |
| Implements | No Accepted spec: this is a repository-configuration fix with no product semantics. The owner approved the design in chat and waived a new M2 spec on 2026-10-13 ("a bounded configuration-only change with no product behavior or specification semantics to define"). |
| Authority | The owner's design approval of 2026-10-13, recorded under Global Constraints. |
| M7 | **Self-review**, as `CLAUDE.md` permits for a settings/configuration-only slice (owner confirmed, 2026-10-13). The M7 record MUST be labelled **self-review**. |
| Edit anchor | `.gitignore` on `main` at `8dd247a`, lines 36–37. |

**Goal:** generated `coverage/` and `.nyc_output/` directories are ignored in every app and package, not only at the repository root. Today `.gitignore:36–37` are `/coverage` and `/.nyc_output`, from the initial NestJS setup (`9f3cf72`), when the API lived at the root. The leading slash anchors them there. So `pnpm --filter api test:cov`, which writes to `apps/api/coverage/` (`coverageDirectory: "../coverage"` with `rootDir: "src"`), leaves an untracked directory that `git add -A` would commit. The #173 drawer guard scans every file git tracks or would track under `apps/web`, so it would also scan any `apps/web/coverage/`.

## Revision log

**Second draft** (M5 review 1, 2026-10-13: request changes):
- **P1, V1 check count:** no change to the count, which is 28. The script checks 13 roots × 2 directories (26) plus 2 files: the root `coverage`, whose expectation is the conditional, and `apps/api/coverage`, the line after it. The conditional runs one `expect` per mode, not two. Both runs print `28 checks`. The plan now spells this arithmetic out under Verification strategy.
- **P2, V3 cleanup:** Step 5 is now a subshell with `set -euo pipefail` and an `EXIT` trap that removes `apps/api/coverage`. It first asserts the directory does not exist, so the trap can only remove output this step created. Afterwards it asserts the directory is gone. It keeps the three assertions: the producer exits 0, the directory exists, and `git status --porcelain` is exactly ` M .gitignore`. It adds a positive one: `git status --porcelain --ignored` lists `!! apps/api/coverage/`. Pre-validated on `main`: the status assertion fails there, as expected, and the trap still removed the directory.
- **P2, script modes:** `check-ignore.sh` now exits 2 with a usage line unless the mode is exactly `before` or `after`, including an empty mode. Step 1 checks this.
- **Unchanged:** the design, the `.gitignore` diff, the 28-path matrix, V2, V4 and V5.

## Global Constraints

- **SHALL** replace `.gitignore` line 36 `/coverage` with `coverage/`, and line 37 `/.nyc_output` with `.nyc_output/`, in place (same lines, same `# Tests` section).
- **SHALL** keep the trailing slash: the patterns match directories only, at any depth. A *file* named `coverage` or `.nyc_output` stays trackable. This is a deliberate, owner-approved narrowing at the root: today `/coverage` also ignores a root *file* named `coverage`. None exists.
- **SHALL NOT** change application code, coverage configuration (`apps/api/package.json`'s `jest` block, any Vitest config), or any other ignore rule (for example the similarly root-anchored `/.idea`).
- **SHALL NOT** change any other line of `.gitignore`.

## Verification strategy

TDD does not apply: there is no unit test for an ignore file. A command-level red/green replaces it.

- **Check script (V1).** `check-ignore.sh` (below) asks `git check-ignore -v --no-index` which rule matches each path. It compares that with the expected rule for `before` (`main`) or `after` (Task 1). It checks 28 paths, 13 roots × 2 directories plus 2 files:
  - `coverage/x` and `.nyc_output/x` under the root, `apps/api`, `apps/web`, every package (`packages/{auth,client,config,domain,graphql,testing,ui,validation,web}`), and one deeper path, `apps/api/src`;
  - two *files* named `coverage` (root and `apps/api`), for the trailing-slash rule.

  Any mode other than exactly `before` or `after` exits 2 with a usage line.

  `--no-index` makes the answer depend on the ignore rules only, not on whether the paths exist or are tracked.
- **Red:** on `main`, `before` passes (only the root paths match, nested ones match nothing) and `after` fails with 27 mismatches. **Green:** after Task 1, `after` passes with 0 mismatches.
- **Tracked files (V2).** `git ls-files | grep -E '(^|/)(coverage|\.nyc_output)(/|$)'` prints nothing, so the new patterns do not hide anything already tracked.
- **Real producer (V3).** `pnpm --filter api test:cov` creates `apps/api/coverage/`. The step first asserts the directory exists, so the check cannot pass by producing nothing. Then `git status --porcelain` must be empty.
- **Guard (V4).** The #173 drawer guard, `apps/web/lib/use-detail-drawer.guard.test.ts`, still passes.
- **Diff (V5).** `git diff --stat main...HEAD` lists exactly `.gitignore` and this plan; tree and index clean.

**Pre-validation** (run 2026-10-13 on `main` at `8dd247a`, before M5). Every command named in an `Expected:` line was run:
- V1: `bogus` and an empty mode → usage line, exit 2. `before` on `main` → 28 checks, 0 mismatches, exit 0. `after` on `main` → 27 mismatches, exit 1.
- V1 green, simulated: `after` in a scratch repository whose `.gitignore` is `main`'s with exactly lines 36–37 replaced → 0 mismatches, exit 0. The real `.gitignore` was not touched.
- V2 → no output (grep exit 1).
- V3 red half: `pnpm --filter api test:cov` → exit 0 (74 suites, 1029 tests), wrote `apps/api/coverage/` (`clover.xml`, `coverage-final.json`, `lcov.info`, `lcov-report/`). `git status --porcelain` → `?? apps/api/coverage/`. The directory was then removed. V3 green runs only after Task 1.
- V3 failure path (second draft): the Step 5 block run on `main` → the producer passed, then the status assertion failed (exit 1, `?? apps/api/coverage/`). The trap removed the directory, and `test ! -e apps/api/coverage` → exit 0.
- V4 → 1 file, 30 tests passed.

## Task 1: Ignore coverage output at any depth

Run every step from the repository root. Before Step 1 the tree and index MUST be clean (`git status --porcelain` prints nothing), and `apps/api/coverage/` MUST NOT exist.

- [ ] **Step 1 (red): save the check script and run it against `main`.** Save `check-ignore.sh` (below) outside the repository, for example in a scratch directory as `$CHECK`. Then:

```bash
bash "$CHECK" bogus    # Expected: "usage: check-ignore.sh before|after", exit 2
bash "$CHECK" before   # Expected: "28 checks, 0 mismatches", exit 0
bash "$CHECK" after    # Expected: "28 checks, 27 mismatches", exit 1
```

  Any other result means the starting point differs from this plan: stop and investigate.

- [ ] **Step 2: edit `.gitignore`.** Apply exactly:

```diff
diff --git a/.gitignore b/.gitignore
--- a/.gitignore
+++ b/.gitignore
@@ -33,8 +33,8 @@
 .DS_Store
 
 # Tests
-/coverage
-/.nyc_output
+coverage/
+.nyc_output/
 
 # IDEs and editors
 /.idea
```

  Expected: `git diff --stat` shows `.gitignore | 4 ++--`, and `git diff -U0` shows only lines 36–37.

- [ ] **Step 3 (green): rerun the check.**

```bash
bash "$CHECK" after    # Expected: "28 checks, 0 mismatches", exit 0
```

- [ ] **Step 4: tracked files (V2).**

```bash
git ls-files | grep -E '(^|/)(coverage|\.nyc_output)(/|$)'   # Expected: no output, exit 1
```

- [ ] **Step 5: real producer (V3).** Run as one block. The subshell's `EXIT` trap removes the coverage output whether the block passes or fails. The precondition check means it removes only what this step created.

```bash
test ! -e apps/api/coverage || { echo 'apps/api/coverage already exists: stop' >&2; false; }
(
  set -euo pipefail
  trap 'rm -rf apps/api/coverage' EXIT
  pnpm --filter api test:cov                  # the producer must succeed
  test -d apps/api/coverage                   # the output exists
  git status --porcelain --ignored -- apps/api | grep -qxF '!! apps/api/coverage/'   # it is ignored
  [ "$(git status --porcelain)" = ' M .gitignore' ]   # and invisible to status
)
echo "V3 exit=$?"                             # Expected: V3 exit=0
test ! -e apps/api/coverage                   # Expected: exit 0 (cleaned up)
```

- [ ] **Step 6: guard (V4).**

```bash
(cd apps/web && pnpm exec vitest run lib/use-detail-drawer.guard.test.ts)   # Expected: 1 file passed, 30 tests passed
```

- [ ] **Step 7: commit.**

```bash
git add .gitignore
git commit -m "chore(repo): ignore coverage output in every workspace (#176)"
```

- [ ] **Step 8: diff and clean tree (V5).**

```bash
git diff --stat main...HEAD   # Expected: .gitignore and this plan only
git status --porcelain        # Expected: no output
```

### `check-ignore.sh`

```bash
#!/usr/bin/env bash
# Usage: check-ignore.sh before|after. Run from the repository root.
# Asks git which .gitignore rule, if any, matches each path, and compares
# it with what `before` (main at 8dd247a) or `after` (Task 1) expects.
set -euo pipefail
mode=${1:-}
case $mode in
  before|after) ;;
  *) echo 'usage: check-ignore.sh before|after' >&2; exit 2 ;;
esac

roots=(. apps/api apps/web apps/api/src
  packages/auth packages/client packages/config packages/domain
  packages/graphql packages/testing packages/ui packages/validation packages/web)

# Prints the matching rule ("<file>:<line>:<pattern>"), or "-" for none.
rule() {
  local out
  out=$(git check-ignore -v --no-index "$1" || true)
  [ -n "$out" ] && printf '%s\n' "${out%%$'\t'*}" || printf -- '-\n'
}

checks=0 fails=0
expect() {
  local path=$1 want=$2 got
  got=$(rule "$path")
  checks=$((checks + 1))
  if [ "$got" = "$want" ]; then
    printf 'ok        %-36s %s\n' "$path" "$got"
  else
    printf 'MISMATCH  %-36s got %s, want %s\n' "$path" "$got" "$want"
    fails=$((fails + 1))
  fi
}

for root in "${roots[@]}"; do
  for dir in coverage .nyc_output; do
    path="$root/$dir/x"; path=${path#./}
    if [ "$mode" = after ]; then
      [ "$dir" = coverage ] && want='.gitignore:36:coverage/' || want='.gitignore:37:.nyc_output/'
    elif [ "$root" = . ]; then
      [ "$dir" = coverage ] && want='.gitignore:36:/coverage' || want='.gitignore:37:/.nyc_output'
    else
      want=-
    fi
    expect "$path" "$want"
  done
done

# A file (not a directory) named coverage: the trailing slash keeps it
# tracked after the change. Before, only the root one matched `/coverage`.
if [ "$mode" = after ]; then
  expect coverage -
else
  expect coverage '.gitignore:36:/coverage'
fi
expect apps/api/coverage -

echo "$checks checks, $fails mismatches"
[ "$fails" -eq 0 ]
```

## Review Focus

1. **Directory-only patterns.** `coverage/` ignores a `coverage` directory at any depth, but not a file of that name. The two file checks pin this. At the root this narrows today's rule, which the owner accepted.
2. **Nothing hidden.** V2 shows no tracked path sits under either directory name, so the change cannot silently untrack or hide existing files.
3. **Evidence from the real producer.** V3 asserts the coverage directory exists before reading `git status`. So it proves the output is ignored, not merely absent.

## Deferred / out of scope

- Other root-anchored rules (`/.idea`) and any review of the rest of `.gitignore`.
- Changing where coverage is written, or adding coverage scripts to other workspaces.

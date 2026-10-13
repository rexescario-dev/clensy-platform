# Drawer Guard Git Environment Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

| Field | Value |
| --- | --- |
| Status | Accepted (second draft) |
| M5 decision | **Accepted** — 2026-10-13, at `4ee1ad7` (second draft), by the owner. No amendment; nothing folded into this acceptance. M6 MUST, on the implemented branch: run all 25 paired runs, investigating any failure rather than re-running it away; re-run the guard, ESLint, `tsc` and the full `web` suite; apply Task 2 and verify no unrelated line changed; confirm the diff is exactly the two planned files plus this plan; run the Step 6 and Step 7 scripts; and confirm no temporary repository is left and the tree and index are clean. M7 MUST be a fresh independent review. |
| M5 (first draft) | Request changes — 2026-10-13, at `aa6cc74`, by the owner. See Revision log. |
| Date | 2026-10-13 |
| Tracking issue | [#175](https://github.com/rexescario-dev/clensy-platform/issues/175). Follows [#173](https://github.com/rexescario-dev/clensy-platform/issues/173) (merged in #174 at `99d20f8`): revision 8 M7 P3-1. |
| Scope | One test file, `apps/web/lib/use-detail-drawer.guard.test.ts`, and one line of the #173 plan's Known limits. No application code, no detector change, no hook tooling. `use-detail-drawer.ts` and `apps/web/README.md` are not modified. |
| Implements (Accepted) | [Dashboard UX Foundation](../specs/2026-08-17-dashboard-ux-foundation-design.md) §4.4, through the [#173 plan](2026-10-11-drawer-history-entry-marker-plan.md) (Accepted, revision 8), whose guard test this hardens. It adds no product semantics. As for #173's revisions 5–8, no new M2 spec is needed (owner, 2026-10-13). |
| Authority | Where this plan and an Accepted spec disagree, the spec wins. |
| Edit anchors | Step 1: a unified diff against `main` at `99d20f8`. Step 3: a diff against Step 1's result. |

**Goal:** the guard's git calls act only on the repository in their `cwd`, whatever `GIT_*` variables the process inherits. Git exports `GIT_DIR` to pre-commit hooks in a worktree and to pre-push hooks, and an absolute `GIT_INDEX_FILE` to hooks under `commit -a`. If the web tests ever run from one, the temporary repository's `git init`/`git add` today act on the developer's real repository. The #173 revision 8 M7 reproduced this: six stray files staged, and a failed `commit -a`. This plan reproduces it again (Task 1, Step 7). It is not reachable today: there is no husky or lefthook, `.git/hooks` has samples only, and CI sets none of these variables.

## Revision log

**Second draft** (M5 review 1, 2026-10-13: request changes):
- **P1, H5 baseline not reproducible:** Step 7 is now a script.
  - It writes `99d20f8`'s guard over the working copy and runs it from `apps/web`.
  - It restores the committed file from a saved copy, also on failure (`trap`).
  - It asserts `0 6` for the baseline and `0 0` for the fixed run.
- **P1, mutation restoration:** Step 6 is now a script.
  - It requires a clean tree and index, and the file equal to `HEAD`'s.
  - It saves the committed file, and restores it after each mutation and on any exit.
  - It checks at the end that the file matches `HEAD`.
  - There is no `git checkout` recovery.
- **P2, H5 working directory and cleanup:** both runs use `cd apps/web`, `set -euo pipefail`, and a `trap` that removes the sandbox. The baseline's Vitest exit (0, expected) is captured and asserted, not ignored.
- **P2, TDD not operationalized:** Task 1 is split. Step 1 adds H2/H3 with the helpers unchanged; Step 2 records the red run; Step 3 adds `gitEnv()` on both paths.
- **Unchanged:** the design and the final code. Step 1 + Step 3 reproduce the first draft's file byte for byte.

## Global Constraints

- **SHALL** run every git call in the guard file with `gitEnv()`: `process.env` as it is at the call, minus every variable `git rev-parse --local-env-vars` names. That is git's own list of repository-local variables, the ones it clears before working in a submodule. It includes the six the issue names, plus `GIT_CONFIG`, `GIT_CONFIG_PARAMETERS`, `GIT_CONFIG_COUNT`, `GIT_IMPLICIT_WORK_TREE`, `GIT_GRAFT_FILE`, `GIT_NO_REPLACE_OBJECTS`, `GIT_REPLACE_REF_BASE`, `GIT_PREFIX` and `GIT_SHALLOW_FILE` (git 2.40.1).
- **SHALL** ask git for that list once, at module load, with an environment that has **no** `GIT_*` variable, so inherited repository context cannot affect the question.
- **SHALL** apply `gitEnv()` to both paths: the temporary repository's `git(...)` helper and `sourceFiles()`. `cwd` stays as it is (`repoRoot` / the temporary repository), so normal runs list exactly what they list today.
- **SHALL** compute `gitEnv()` per call, not once, so a test that sets variables later is really exercised.
- **SHALL NOT** change what the detector counts, the scanned roots, `DRAWER_PAGES`, or any existing assertion.
- **SHALL NOT** add hook tooling, or isolate the temporary repository from global/system git config (the #173 revision 8 M7 already ran the guard against a hostile global config: 28/28).

## Review Focus

1. **Why `sourceFiles()` too.** Under a hook, `GIT_DIR` points at the hook's repository. For the real scan that is usually the same repository, but not always (another checkout, or a hook in a different repository running these tests), and `GIT_INDEX_FILE` may name a temporary index. `cwd` alone finds the right repository, so dropping the variables is safe. Under `commit -a`, the scan then reads the real index rather than the hook's temporary one; `--others` still lists every new file, so nothing is missed.
2. **What the new tests prove.** Two independent throwaway repositories: A, the file-list proof's own, and B, standing in for the hook's repository (`GIT_DIR` and `GIT_INDEX_FILE` point at B).
   - **Isolation (H2):** with `GIT_DIR`/`GIT_INDEX_FILE` set to B, the existing file-list proof runs unchanged. It must create A where it asked (`A/.git` exists), list exactly A's files, and leave B's index untouched: no index file, and `git ls-files` in B empty.
   - **Real scan (H3):** with the same variables set to a B whose `info/exclude` ignores everything, `sourceFiles()` still equals the scan taken at the top of the `describe` (104 files today). A scan that read B's `GIT_DIR` would come back empty. This is the core regression: not only that B stays clean, but that the real scan still finds the real files.
   - **Restoring the environment:** `withEnv` puts back each variable's earlier value, and **unsets** any that were unset, in `finally`.
3. **Failing for the intended reason.** The red run (Step 2) and each mutation (R1–R3) fail on an assertion that names the leak, not on a setup error. The draft first failed R2 with a thrown `git ls-files` error: the leaking `git init` initialised B, so A never became a repository. The plan therefore asserts `A/.git` exists right after `git init`, which turns that into an assertion failure at the point of the leak.
4. **Not pinned by a test:** the pre-clean of the discovery call, and the variables beyond `GIT_DIR`/`GIT_INDEX_FILE`. `git rev-parse --local-env-vars` needs no repository and answered correctly under a hostile `GIT_DIR`, `GIT_CONFIG_PARAMETERS` and `GIT_CONFIG_COUNT` (probed with git 2.40.1), so no test can tell the pre-clean apart. It is defensive, as the owner asked. M7 checks both by inspection.

## Task 1: Isolate the guard's git calls (red first)

Run every step from the repository root unless it says otherwise. Before Step 1 the tree and index MUST be clean (`git status --porcelain` prints nothing).

- [ ] **Step 1 (red): add H2 and H3, leaving the git helpers as they are.** Apply this diff. It:
  - adds `withEnv`;
  - moves the existing file-list proof into `expectGitFileList()`, where the existing test keeps its name and assertions, plus one new assertion that `A/.git` exists after `git init`;
  - adds H2 and H3.

  `sourceFiles()` and the temporary `git(...)` helper still inherit `process.env`, as on `main`. The new tests' own setup calls on B use no `env` yet; Step 3 gives them `gitEnv()`.

```diff
diff --git a/apps/web/lib/use-detail-drawer.guard.test.ts b/apps/web/lib/use-detail-drawer.guard.test.ts
index b5b86d3..4801fa1 100644
--- a/apps/web/lib/use-detail-drawer.guard.test.ts
+++ b/apps/web/lib/use-detail-drawer.guard.test.ts
@@ -187,6 +187,51 @@ function drawerHistoryHazards(fileName: string, source: string): string[] {
   return [...found];
 }
 
+// Sets these variables while `run` runs, then puts back what was there,
+// unsetting any that were unset.
+function withEnv(vars: Record<string, string>, run: () => void): void {
+  const saved = Object.keys(vars).map((name) => [name, process.env[name]] as const);
+  Object.assign(process.env, vars);
+  try {
+    run();
+  } finally {
+    for (const [name, value] of saved) {
+      if (value === undefined) delete process.env[name];
+      else process.env[name] = value;
+    }
+  }
+}
+
+// `sourceFiles` on a throwaway repository with, in each root, a tracked file,
+// a new one, an ignored one and a force-added one under an ignored directory.
+function expectGitFileList(): void {
+  const repo = mkdtempSync(join(tmpdir(), 'drawer-guard-'));
+  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo });
+  try {
+    git('init', '-q');
+    // Created here, not in a repository named by an inherited `GIT_DIR`.
+    expect(existsSync(join(repo, '.git'))).toBe(true);
+    writeFileSync(join(repo, '.gitignore'), 'public/\n');
+    const roots = SCANNED.map((root) => join(repo, relative(REPO_ROOT, root)));
+    for (const root of roots) {
+      mkdirSync(join(root, 'public'), { recursive: true });
+      for (const name of ['tracked.ts', 'new.ts', join('public', 'ignored.js'), join('public', 'forced.js')]) {
+        writeFileSync(join(root, name), 'export {};\n');
+      }
+      git('add', join(root, 'tracked.ts'));
+      git('add', '-f', join(root, 'public', 'forced.js'));
+    }
+    const expected = roots.flatMap((root) => [
+      join(root, 'tracked.ts'),
+      join(root, 'new.ts'),
+      join(root, 'public', 'forced.js'),
+    ]);
+    expect(sourceFiles(repo, roots).sort()).toEqual(expected.sort());
+  } finally {
+    rmSync(repo, { force: true, recursive: true });
+  }
+}
+
 describe('drawer history marker guard (#173)', () => {
   const files = sourceFiles();
   const scanned = files.map((file) => relative(REPO_ROOT, file));
@@ -232,28 +277,38 @@ describe('drawer history marker guard (#173)', () => {
   // written into the real source tree, which other test files walk in
   // parallel.
   it('lists tracked and new files and skips ignored ones, in every root', () => {
-    const repo = mkdtempSync(join(tmpdir(), 'drawer-guard-'));
-    const git = (...args: string[]) => execFileSync('git', args, { cwd: repo });
+    expectGitFileList();
+  });
+
+  // #175: run from a git hook, the guard inherits `GIT_DIR` and
+  // `GIT_INDEX_FILE` pointing at the hook's repository (here, another
+  // throwaway one). The proof must still act on its own repository and leave
+  // the other untouched.
+  it('keeps the temporary repository isolated from an inherited GIT_DIR', () => {
+    const other = mkdtempSync(join(tmpdir(), 'drawer-guard-other-'));
     try {
-      git('init', '-q');
-      writeFileSync(join(repo, '.gitignore'), 'public/\n');
-      const roots = SCANNED.map((root) => join(repo, relative(REPO_ROOT, root)));
-      for (const root of roots) {
-        mkdirSync(join(root, 'public'), { recursive: true });
-        for (const name of ['tracked.ts', 'new.ts', join('public', 'ignored.js'), join('public', 'forced.js')]) {
-          writeFileSync(join(root, name), 'export {};\n');
-        }
-        git('add', join(root, 'tracked.ts'));
-        git('add', '-f', join(root, 'public', 'forced.js'));
-      }
-      const expected = roots.flatMap((root) => [
-        join(root, 'tracked.ts'),
-        join(root, 'new.ts'),
-        join(root, 'public', 'forced.js'),
-      ]);
-      expect(sourceFiles(repo, roots).sort()).toEqual(expected.sort());
+      execFileSync('git', ['init', '-q'], { cwd: other });
+      withEnv({ GIT_DIR: join(other, '.git'), GIT_INDEX_FILE: join(other, '.git', 'index') }, expectGitFileList);
+      expect(existsSync(join(other, '.git', 'index'))).toBe(false);
+      expect(execFileSync('git', ['ls-files'], { cwd: other, encoding: 'utf8' })).toBe('');
+    } finally {
+      rmSync(other, { force: true, recursive: true });
+    }
+  });
+
+  // #175: and the real scan still lists the real files. The other
+  // repository ignores everything (`info/exclude`), so a scan that read its
+  // `GIT_DIR` would come back empty.
+  it('scans the real repository despite an inherited GIT_DIR', () => {
+    const other = mkdtempSync(join(tmpdir(), 'drawer-guard-other-'));
+    try {
+      execFileSync('git', ['init', '-q'], { cwd: other });
+      writeFileSync(join(other, '.git', 'info', 'exclude'), '*\n');
+      withEnv({ GIT_DIR: join(other, '.git'), GIT_INDEX_FILE: join(other, '.git', 'index') }, () => {
+        expect(sourceFiles()).toEqual(files);
+      });
     } finally {
-      rmSync(repo, { force: true, recursive: true });
+      rmSync(other, { force: true, recursive: true });
     }
   });
 
```

- [ ] **Step 2: run H2 and H3 against the unchanged helpers, and record the red result.**

```bash
(cd apps/web && npx vitest run lib/use-detail-drawer.guard.test.ts)
```

Expected: `2 failed | 28 passed (30)`, failing for the intended reason:
- H2 ("keeps the temporary repository isolated…"): `expected false to be true` on the `A/.git` assertion, because the inherited `GIT_DIR` sent `git init` to B.
- H3 ("scans the real repository…"): `expected [] to deeply equal [ …(104) ]`, because the scan read B's `GIT_DIR`, which ignores everything.

A thrown error (`Command failed: …`) or any other failure is **not** the intended reason; stop and investigate.

- [ ] **Step 3 (green): add `gitEnv()` and use it on both git call paths.** Apply this diff to the Step 1 file. It adds `envWithout`, `GIT_LOCAL_ENV_VARS` (asked with no `GIT_*` variable set) and `gitEnv()`. It passes `env: gitEnv()` to `sourceFiles()`, to the temporary `git(...)` helper, and to the new tests' calls on B.

```diff
diff --git a/apps/web/lib/use-detail-drawer.guard.test.ts b/apps/web/lib/use-detail-drawer.guard.test.ts
index 4801fa1..57ab0b9 100644
--- a/apps/web/lib/use-detail-drawer.guard.test.ts
+++ b/apps/web/lib/use-detail-drawer.guard.test.ts
@@ -41,6 +41,31 @@ const FORBIDDEN_IDENTIFIERS = new Map([
   ['useFormState', '`useFormState`'],
 ]);
 
+// Git exports repository-local variables (`GIT_DIR`, `GIT_INDEX_FILE` and
+// others) to hooks. Inherited, they would point these git calls at the
+// repository that ran the hook, not the one in `cwd` (#175). Git lists them
+// itself, as the ones it clears before working in a submodule; it is asked
+// with no `GIT_*` variable set, so the question cannot be redirected either.
+function envWithout(drop: (name: string) => boolean): NodeJS.ProcessEnv {
+  const env = { ...process.env };
+  for (const name of Object.keys(env)) if (drop(name)) delete env[name];
+  return env;
+}
+
+const GIT_LOCAL_ENV_VARS = new Set(
+  execFileSync('git', ['rev-parse', '--local-env-vars'], {
+    encoding: 'utf8',
+    env: envWithout((name) => name.startsWith('GIT_')),
+  })
+    .split('\n')
+    .filter(Boolean),
+);
+
+// The environment as it is now, without those variables.
+function gitEnv(): NodeJS.ProcessEnv {
+  return envWithout((name) => GIT_LOCAL_ENV_VARS.has(name));
+}
+
 // The files git tracks or would track under the scanned roots: tracked files,
 // plus new ones not yet added, minus anything gitignored (dependencies,
 // `.next`, and local build, coverage or `public/` output). So ignored output
@@ -59,7 +84,7 @@ function sourceFiles(repoRoot = REPO_ROOT, roots = SCANNED): string[] {
       '--',
       ...roots.map((root) => relative(repoRoot, root)),
     ],
-    { cwd: repoRoot, encoding: 'utf8' },
+    { cwd: repoRoot, encoding: 'utf8', env: gitEnv() },
   );
   return listed
     .split('\0')
@@ -206,7 +231,7 @@ function withEnv(vars: Record<string, string>, run: () => void): void {
 // a new one, an ignored one and a force-added one under an ignored directory.
 function expectGitFileList(): void {
   const repo = mkdtempSync(join(tmpdir(), 'drawer-guard-'));
-  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo });
+  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, env: gitEnv() });
   try {
     git('init', '-q');
     // Created here, not in a repository named by an inherited `GIT_DIR`.
@@ -287,10 +312,10 @@ describe('drawer history marker guard (#173)', () => {
   it('keeps the temporary repository isolated from an inherited GIT_DIR', () => {
     const other = mkdtempSync(join(tmpdir(), 'drawer-guard-other-'));
     try {
-      execFileSync('git', ['init', '-q'], { cwd: other });
+      execFileSync('git', ['init', '-q'], { cwd: other, env: gitEnv() });
       withEnv({ GIT_DIR: join(other, '.git'), GIT_INDEX_FILE: join(other, '.git', 'index') }, expectGitFileList);
       expect(existsSync(join(other, '.git', 'index'))).toBe(false);
-      expect(execFileSync('git', ['ls-files'], { cwd: other, encoding: 'utf8' })).toBe('');
+      expect(execFileSync('git', ['ls-files'], { cwd: other, encoding: 'utf8', env: gitEnv() })).toBe('');
     } finally {
       rmSync(other, { force: true, recursive: true });
     }
@@ -302,7 +327,7 @@ describe('drawer history marker guard (#173)', () => {
   it('scans the real repository despite an inherited GIT_DIR', () => {
     const other = mkdtempSync(join(tmpdir(), 'drawer-guard-other-'));
     try {
-      execFileSync('git', ['init', '-q'], { cwd: other });
+      execFileSync('git', ['init', '-q'], { cwd: other, env: gitEnv() });
       writeFileSync(join(other, '.git', 'info', 'exclude'), '*\n');
       withEnv({ GIT_DIR: join(other, '.git'), GIT_INDEX_FILE: join(other, '.git', 'index') }, () => {
         expect(sourceFiles()).toEqual(files);
```

- [ ] **Step 4 (H1–H3): run the guard, lint and `tsc`.**

```bash
(cd apps/web && npx vitest run lib/use-detail-drawer.guard.test.ts && npx eslint lib/use-detail-drawer.guard.test.ts && npx tsc --noEmit -p .)
```

Expected: `30 passed (30)` (H1 is the 28 existing tests); lint and `tsc` exit 0.

- [ ] **Step 5:** commit. The mutation and hook scripts (Steps 6–7) need this commit at `HEAD`.

```bash
git add apps/web/lib/use-detail-drawer.guard.test.ts
git commit -m "test(web): isolate the guard's git calls from inherited GIT_* env (#175)"
```

- [ ] **Step 6 (R1–R3, mutations):** save the script below outside the repository (for example `"$(mktemp -d)/mutations.sh"`) and run it from the repository root. It:
  - refuses to start unless the tree and index are clean and the guard file equals `HEAD`'s;
  - unsets git's repository-local variables first, so the run itself cannot be redirected;
  - saves the committed file and applies each mutation as an exact single replacement, so a mutation that matches nothing fails the script instead of passing silently;
  - restores the saved file after each run and on any exit (`trap`);
  - fails if a mutation does not make the guard fail;
  - checks, at the end, that the file equals `HEAD`'s again and the tree is clean;
  - keeps every run's output in the printed log directory.

```bash
#!/usr/bin/env bash
# R1–R3. Run from the repository root, on a clean tree and index, with the
# Task 1 commit at HEAD.
set -euo pipefail
for v in $(git rev-parse --local-env-vars); do unset "$v"; done
F=apps/web/lib/use-detail-drawer.guard.test.ts
test -z "$(git status --porcelain)" || { echo 'tree or index not clean' >&2; exit 1; }
test "$(git hash-object "$F")" = "$(git rev-parse "HEAD:$F")"
SAVE=$(mktemp -d)
LOGS=$(mktemp -d -t guard-175-mutations-XXXX)
cp "$F" "$SAVE/guard.ts"
trap 'cp "$SAVE/guard.ts" "$F"; rm -rf "$SAVE"' EXIT
# Replace exactly one occurrence, or fail (a mutation that matches nothing
# would pass silently).
mutate() {
  node -e '
    const fs = require("fs");
    const [file, from, to] = process.argv.slice(1);
    const source = fs.readFileSync(file, "utf8");
    if (source.split(from).length !== 2) { console.error("not exactly one match: " + from); process.exit(1); }
    fs.writeFileSync(file, source.replace(from, to));
  ' "$F" "$1" "$2"
}
run() {
  local status=0
  (cd apps/web && npx vitest run lib/use-detail-drawer.guard.test.ts) > "$LOGS/$1.log" 2>&1 || status=$?
  echo "$1: vitest exit $status"
  grep -E '×|AssertionError|Error:|Tests ' "$LOGS/$1.log" || true
  cp "$SAVE/guard.ts" "$F"
  test "$status" -ne 0 || { echo "$1 did not fail" >&2; exit 1; }
}
mutate "{ cwd: repoRoot, encoding: 'utf8', env: gitEnv() }" "{ cwd: repoRoot, encoding: 'utf8' }"; run R1
mutate "{ cwd: repo, env: gitEnv() }" "{ cwd: repo }"; run R2
mutate "  return envWithout((name) => GIT_LOCAL_ENV_VARS.has(name));" "  return process.env;"; run R3
trap - EXIT
cp "$SAVE/guard.ts" "$F"; rm -rf "$SAVE"
test "$(git hash-object "$F")" = "$(git rev-parse "HEAD:$F")"
test -z "$(git status --porcelain)"
echo "restored; logs in $LOGS"
```

Expected (the script exits 0):

| # | Mutation | Expected failures | Expected assertion (intended reason) |
| --- | --- | --- | --- |
| R1 | `sourceFiles`: drop `env: gitEnv()` | H2, H3 (2 failed) | H2: `expected [ …(6) ] to deeply equal [ …(9) ]` (A's listing read B's index, so the force-added files are missing); H3: `expected [] to deeply equal [ …(104) ]` |
| R2 | Temporary `git(...)` helper: drop `env: gitEnv()` | H2 (1 failed) | `expected false to be true` on `A/.git` (the `git init` went to B) |
| R3 | `gitEnv()` returns `process.env` (`main`'s behaviour) | H2, H3 (2 failed) | H2: `A/.git`; H3: `expected [] to deeply equal [ …(104) ]` |

The 104 is today's real scan; M6 records the number it sees. A thrown error instead of an assertion is **not** the intended reason; investigate it.

- [ ] **Step 7 (H5, hook simulation):** save the script below outside the repository and run it from the repository root. It runs the whole guard, from `apps/web`, as a git hook would: with `GIT_DIR` and `GIT_INDEX_FILE` exported to a sandbox repository created under `mktemp -d`. It runs twice:
  - **Baseline:** the guard file from `99d20f8` (`main` before this change), written over the working copy.
  - **Fixed:** the committed file, restored from a saved copy.

  Step 6's preconditions, restoration (`trap` on any exit), end-of-run checks and kept logs apply here too. The `trap` also removes the sandbox.

  The baseline's Vitest run is **expected to exit 0**: `main`'s tests cannot see the leak, which is the point. The evidence is the 6 entries staged into the sandbox. The script asserts both outcomes exactly, and exits nonzero on any other result.

```bash
#!/usr/bin/env bash
# H5. Run from the repository root, on a clean tree and index, with the
# Task 1 commit at HEAD.
set -euo pipefail
for v in $(git rev-parse --local-env-vars); do unset "$v"; done
F=apps/web/lib/use-detail-drawer.guard.test.ts
test -z "$(git status --porcelain)" || { echo 'tree or index not clean' >&2; exit 1; }
test "$(git hash-object "$F")" = "$(git rev-parse "HEAD:$F")"
SAVE=$(mktemp -d)
SANDBOX=$(mktemp -d)
LOGS=$(mktemp -d -t guard-175-hook-XXXX)
cp "$F" "$SAVE/guard.ts"
trap 'cp "$SAVE/guard.ts" "$F"; rm -rf "$SAVE" "$SANDBOX"' EXIT
# The guard as a hook would run it: GIT_DIR and GIT_INDEX_FILE exported to
# another repository (the sandbox). Prints "<vitest exit> <sandbox entries>".
hook_run() {
  rm -rf "$SANDBOX/repo"
  git init -q "$SANDBOX/repo"
  local status=0
  (cd apps/web && GIT_DIR="$SANDBOX/repo/.git" GIT_INDEX_FILE="$SANDBOX/repo/.git/index" \
    npx vitest run lib/use-detail-drawer.guard.test.ts) > "$LOGS/$1.log" 2>&1 || status=$?
  echo "$status $(git -C "$SANDBOX/repo" ls-files | wc -l)"
}
git show "99d20f8:$F" > "$F"
baseline=$(hook_run baseline)
cp "$SAVE/guard.ts" "$F"
fixed=$(hook_run fixed)
echo "baseline (99d20f8): vitest exit, sandbox entries = $baseline"
echo "fixed (HEAD):       vitest exit, sandbox entries = $fixed"
# The baseline's tests pass (exit 0): they cannot see the leak. The leak is
# the 6 entries staged into the other repository.
test "$baseline" = "0 6" || { echo 'baseline did not reproduce the leak' >&2; exit 1; }
test "$fixed" = "0 0" || { echo 'fixed guard leaked or failed' >&2; exit 1; }
trap - EXIT
cp "$SAVE/guard.ts" "$F"; rm -rf "$SAVE" "$SANDBOX"
test "$(git hash-object "$F")" = "$(git rev-parse "HEAD:$F")"
test -z "$(git status --porcelain)"
echo "restored; logs in $LOGS"
```

Expected:

```text
baseline (99d20f8): vitest exit, sandbox entries = 0 6
fixed (HEAD):       vitest exit, sandbox entries = 0 0
```

## Task 2: Mark the #173 Known limit resolved

Docs only; TDD does not apply. Verification: the link resolves, and nothing else in the #173 plan changes.

- [ ] **Step 1:** In `docs/superpowers/plans/2026-10-11-drawer-history-entry-marker-plan.md`, Revision 8 "Known limits, additions", replace the #175 bullet:

```diff
-- **Tracked in [#175](https://github.com/rexescario-dev/clensy-platform/issues/175):** the temporary repository's git calls inherit `GIT_DIR`/`GIT_INDEX_FILE`. Run from inside a git hook, they could act on the developer's real repository. That is not reachable today, because no hooks exist.
+- ~~**Tracked in [#175](https://github.com/rexescario-dev/clensy-platform/issues/175):** the temporary repository's git calls inherit `GIT_DIR`/`GIT_INDEX_FILE`.~~ **Resolved in #175** ([plan](2026-10-13-drawer-guard-git-env-isolation-plan.md)): every git call in the guard drops git's repository-local variables.
```

- [ ] **Step 2:** commit.

```bash
git add docs/superpowers/plans/2026-10-11-drawer-history-entry-marker-plan.md
git commit -m "docs(175): mark the #173 git-environment limit resolved"
```

## Final verification

On the committed code, from a clean tree and index:
- [ ] **Allowlist:** `git diff --name-only main...HEAD` is exactly the guard test, the #173 plan and this plan.
- [ ] **Task 1, Steps 4, 6 and 7:** H1–H3, R1–R3 and H5, with the logs kept.
- [ ] **Stability:** 25 paired runs, from `apps/web`, each log kept; any failure investigated, not re-run away:

```bash
LOGS=$(mktemp -d -t guard-175-paired-XXXX)
for i in $(seq 1 25); do
  npx vitest run lib/use-detail-drawer.guard.test.ts lib/web-shell-regressions.test.ts > "$LOGS/run$i.log" 2>&1
  echo "run $i: exit $?"
done
grep -h 'Tests ' "$LOGS"/*.log | sort | uniq -c; echo "logs in $LOGS"
```

  Expected: 25 × exit 0, `226 passed (226)` each.
- [ ] **Full suites,** from `apps/web`: `npx vitest run` (712 at pre-validation), `npx eslint lib/use-detail-drawer.guard.test.ts` and `npx tsc --noEmit -p .`, all exit 0.
- [ ] **Cleanup:**
  - no `drawer-guard-*` directory left under `os.tmpdir()`;
  - no sandbox left from Step 7;
  - a clean working tree and an empty index (`git status --porcelain` prints nothing);
  - the guard file equals `HEAD`'s.

## Pre-validation (partial)

Second draft, run on `fix/175-guard-git-env-isolation` at `aa6cc74`:
- Steps 1 and 3 were applied in order. The result matched the first draft's final file byte for byte.
- Step 5 was a temporary commit, undone (`git reset --soft`) before this Draft was committed.

| Check | Result |
| --- | --- |
| Step 2 (red) | `2 failed \| 28 passed (30)`; H2 on `A/.git`, H3 `[]` vs 104 |
| Step 4 (H1–H3, lint, `tsc`) | `30 passed (30)`; exit 0 / exit 0 |
| Step 6 script (R1–R3) | exit 0; 2 / 1 / 2 failed, on the assertions tabulated; file restored to `HEAD`, tree clean |
| Step 6 script, failure paths | a dirty tree is refused (exit 1); a mutation that matches nothing exits 1 and the file is restored to `HEAD` |
| Step 7 script (H5) | exit 0; baseline `0 6`, fixed `0 0`; file restored, sandbox removed |
| Paired runs, 10 (first draft) | 10 exited 0, `226 passed (226)` each |
| Full `web` suite (first draft) | `29 passed` files, `712 passed (712)` |
| Cleanup | no `drawer-guard-*` left; index empty |

**Partial.** These were not run, or not run in full:
- **Paired runs:** 10 of the 25.
- **Full suite:** run on the first draft's code, which is identical to Step 3's result.
- **Task 2:** its edit was not pre-applied.
- **Step 5:** no commit is kept.

The first draft's first `tsc` run failed: `Object.fromEntries` loses `NODE_ENV`, which Next requires on `ProcessEnv`. Step 3 copies the environment and deletes keys instead, and passes.

## Traceability

| Requirement | Source | Task |
| --- | --- | --- |
| The guard's temporary repository never touches the real tree | #173 plan, Revision 8 ("Nothing touches the real tree") | 1 |
| Drop the inherited repository-local variables; prove isolation with `GIT_DIR` set to another repository | #175; #173 revision 8 M7 P3-1 | 1 |
| The real scan still lists the real files | #173 plan, Revisions 7–8 (`sourceFiles`) | 1 (H3) |
| Known limits kept current | #173 plan, M10 observation 4 | 2 |

## Deferred

- **Global/system git config isolation** (`GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM`): out of scope; the #173 revision 8 M7 found the guard robust to a hostile global config.
- The other Known limits in the #173 plan (detector reference misses, `TMPDIR` inside `apps/web`) stay as recorded; #175 lists them only as references.

## Gate outcomes

### M5 — Request changes (2026-10-13, first draft)

At `aa6cc74`, by the owner. Two P1s (H5's baseline run not reproducible; mutation restoration by `git checkout`) and two P2s (H5's working directory and cleanup; red-first not operationalized). The second draft answers each; see the Revision log.

### M5 — Accepted (2026-10-13, second draft)

At `4ee1ad7`, by the owner. All four findings addressed. Conditions for M6 are in the header's M5 decision row. No additional M2 spec is needed.

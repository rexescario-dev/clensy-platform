# Drawer Guard Git Environment Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

| Field | Value |
| --- | --- |
| Status | Draft |
| Date | 2026-10-13 |
| Tracking issue | [#175](https://github.com/rexescario-dev/clensy-platform/issues/175). Follows [#173](https://github.com/rexescario-dev/clensy-platform/issues/173) (merged in #174 at `99d20f8`): revision 8 M7 P3-1. |
| Scope | One test file, `apps/web/lib/use-detail-drawer.guard.test.ts`, and one line of the #173 plan's Known limits. No application code, no detector change, no hook tooling. `use-detail-drawer.ts` and `apps/web/README.md` are not modified. |
| Implements (Accepted) | [Dashboard UX Foundation](../specs/2026-08-17-dashboard-ux-foundation-design.md) §4.4, through the [#173 plan](2026-10-11-drawer-history-entry-marker-plan.md) (Accepted, revision 8), whose guard test this hardens. It adds no product semantics. As for #173's revisions 5–8, no new M2 spec is needed (owner, 2026-10-13). |
| Authority | Where this plan and an Accepted spec disagree, the spec wins. |
| Edit anchors | Unified diffs against `main` at `99d20f8`. |

**Goal:** the guard's git calls act only on the repository in their `cwd`, whatever `GIT_*` variables the process inherits. Git exports `GIT_DIR` to pre-commit hooks in a worktree and to pre-push hooks, and an absolute `GIT_INDEX_FILE` to hooks under `commit -a`. If the web tests ever run from one, the temporary repository's `git init`/`git add` today act on the developer's real repository. The #173 revision 8 M7 reproduced this: six stray files staged, and a failed `commit -a`. This plan reproduces it again (see Pre-validation, H5). It is not reachable today: there is no husky or lefthook, `.git/hooks` has samples only, and CI sets none of these variables.

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
3. **Failing for the intended reason.** Each mutation (R1–R3) fails on an assertion that names the leak, not on a setup error. The draft first failed R2 with a thrown `git ls-files` error: the leaking `git init` initialised B, so A never became a repository. The plan therefore asserts `A/.git` exists right after `git init`, which turns that into an assertion failure at the point of the leak.
4. **Not pinned by a test:** the pre-clean of the discovery call, and the variables beyond `GIT_DIR`/`GIT_INDEX_FILE`. `git rev-parse --local-env-vars` needs no repository and answered correctly under a hostile `GIT_DIR`, `GIT_CONFIG_PARAMETERS` and `GIT_CONFIG_COUNT` (probed with git 2.40.1), so no test can tell the pre-clean apart. It is defensive, as the owner asked. M7 checks both by inspection.

## Task 1: Isolate the guard's git calls (red first)

TDD: the two new tests (H2, H3) are written first and fail against `main`'s helpers (R3 is exactly that state). The refactor of the existing test into `expectGitFileList()` is behaviour-preserving: the existing test keeps its name and assertions.

- [ ] **Step 1:** Apply the diff:

```diff
diff --git a/apps/web/lib/use-detail-drawer.guard.test.ts b/apps/web/lib/use-detail-drawer.guard.test.ts
index b5b86d3..57ab0b9 100644
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
@@ -187,6 +212,51 @@ function drawerHistoryHazards(fileName: string, source: string): string[] {
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
+  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, env: gitEnv() });
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
@@ -232,28 +302,38 @@ describe('drawer history marker guard (#173)', () => {
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
+      execFileSync('git', ['init', '-q'], { cwd: other, env: gitEnv() });
+      withEnv({ GIT_DIR: join(other, '.git'), GIT_INDEX_FILE: join(other, '.git', 'index') }, expectGitFileList);
+      expect(existsSync(join(other, '.git', 'index'))).toBe(false);
+      expect(execFileSync('git', ['ls-files'], { cwd: other, encoding: 'utf8', env: gitEnv() })).toBe('');
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
+      execFileSync('git', ['init', '-q'], { cwd: other, env: gitEnv() });
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

- [ ] **Step 2 (H1–H3):** run the guard.

```bash
cd apps/web && npx vitest run lib/use-detail-drawer.guard.test.ts
```

Expected: `30 passed (30)` (28 before, plus H2 and H3).

- [ ] **Step 3 (R1–R3, mutations):** apply each to the committed file, run Step 2, record the failing tests and the first assertion of each, then restore with `git checkout -- apps/web/lib/use-detail-drawer.guard.test.ts`.

| # | Mutation | Expected failures | Expected assertion (intended reason) |
| --- | --- | --- | --- |
| R1 | `sourceFiles`: drop `env: gitEnv()` | H2, H3 (2 failed) | H2: `expected [ …(6) ] to deeply equal [ …(9) ]` (A's listing read B's index, so the force-added files are missing); H3: `expected [] to deeply equal [ …(104) ]` |
| R2 | Temporary `git(...)` helper: drop `env: gitEnv()` | H2 (1 failed) | `expected false to be true` on `A/.git` exists (the `git init` went to B) |
| R3 | `gitEnv()` returns `process.env` (`main`'s behaviour) | H2, H3 (2 failed) | H2: `A/.git` exists; H3: `expected [] to deeply equal [ …(104) ]` |

The 104 is today's real scan; M6 records the number it sees. A thrown error (`Command failed: …`) instead of an assertion is **not** the intended reason; investigate it.

- [ ] **Step 4 (H5, hook simulation):** run the whole guard as a hook would, with `GIT_DIR` and `GIT_INDEX_FILE` exported to a sandbox repository outside the tree, first on `main`'s guard, then on the committed one.

```bash
S=$(mktemp -d); git -C "$S" init -q
GIT_DIR="$S/.git" GIT_INDEX_FILE="$S/.git/index" npx vitest run lib/use-detail-drawer.guard.test.ts
git -C "$S" ls-files | wc -l; rm -rf "$S"
```

Expected: on `main`'s file (`git show main:apps/web/lib/use-detail-drawer.guard.test.ts`), 28 passed, but 6 entries staged into the sandbox: the leak, unseen by `main`'s tests. On the committed file, 30 passed and 0 entries.

- [ ] **Step 5:** commit.

```bash
git add apps/web/lib/use-detail-drawer.guard.test.ts
git commit -m "test(web): isolate the guard's git calls from inherited GIT_* env (#175)"
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

On the committed code:
- [ ] **Allowlist:** `git diff --name-only main...HEAD` is exactly the guard test, the #173 plan and this plan.
- [ ] **Steps 2–4 of Task 1:** H1–H3, R1–R3 and H5, with output kept.
- [ ] **Stability:** 25 paired runs of the guard with `lib/web-shell-regressions.test.ts`, each log kept; any failure investigated, not re-run away.
- [ ] **Full suites:** `web` (`npx vitest run`, 712 at pre-validation), `npx eslint lib/use-detail-drawer.guard.test.ts` and `npx tsc --noEmit -p .` in `apps/web`: exit 0.
- [ ] **Cleanup:** no `drawer-guard-*` directory left under `os.tmpdir()`, no sandbox left from Step 4, a clean working tree, and an empty index (`git diff --cached --name-only` prints nothing).

## Pre-validation (full)

Applied on `fix/175-guard-git-env-isolation` at `99d20f8`, then removed before this Draft was committed. Every `Expected:` command was run, except the commits:

| Check | Result |
| --- | --- |
| H1–H3 (guard) | `30 passed (30)` |
| R1 / R2 / R3 | 2 / 1 / 2 failed, on the assertions tabulated |
| H5 (hook simulation) | `main`: 28 passed, 6 entries staged into the sandbox. Fixed: 30 passed, 0 entries |
| Paired runs, 10 (not 25) | 10 exited 0, `226 passed (226)` each; logs kept in the session scratchpad |
| Full `web` suite | `29 passed` files, `712 passed (712)` |
| lint / `tsc` | exit 0 / exit 0 |
| Cleanup | no `drawer-guard-*` left; index empty |

**Partial:** 10 of the 25 paired runs (M6 runs all 25). Task 2's edit was not pre-applied. The draft's first `tsc` run failed (`Object.fromEntries` loses Next's required `NODE_ENV` on `ProcessEnv`); the diff above copies and deletes instead and passes.

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

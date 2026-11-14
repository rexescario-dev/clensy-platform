# Laundry Invoice and Payment Browser Check (#209) Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. **Do not start any task until M5 has Accepted this plan and the owner has approved the gate the step needs.**

| Field | Value |
| --- | --- |
| Status | **Accepted (revision 5)** at M5, 2026-11-03 ([M5 decision](#m5-decision)). Drafted at M4 on 2026-11-03. Revision 1 was held by the owner before review with two required changes ([Revision 2 changes](#revision-2-changes)). The M5 review of revision 2 returned two blockers, B1 and B2 ([Revision 3 changes](#revision-3-changes)). The M5 review of revision 3 returned two blockers, B3 and B4, and one evidence note ([Revision 4 changes](#revision-4-changes)). The M5 review of revision 4 returned two blockers, B5 and B6 ([Revision 5 changes](#revision-5-changes)). **Revision 6 (Draft, 2026-11-14):** changes Task 1 Steps 4–5 only, to supply the API's runtime configuration through a read-only bind mount; its focused M5 re-review returned **Revise**, with one blocker, B7, and six non-blocking notes ([Revision 6 changes](#revision-6-changes)). **Revision 6a (Draft, 2026-11-14)** resolves B7 and applies N1–N5. N6 is a separate follow-up. A focused M5 confirmation **Accepted revision 6a** on 2026-11-14, with no blocking findings and five non-blocking notes carried into M6 ([M5 confirmation of revision 6a](#m5-focused-confirmation-of-revision-6a-2026-11-14)). Revision 6a governs Task 1 Steps 4–5. Revision 5 still governs everything else. **Revision 6b (2026-11-14, before publication; Accepted at its focused review)** only replaces the developer machine's absolute home path with the placeholder `<repo-root>` ([Revision 6b changes](#revision-6b-changes)). Until revision 6 is Accepted, M6 does not go past Task 1 Step 2. Revision 5 stays Accepted for everything revision 6 does not change.<br>**Delivery state (2026-11-14):** M6 Complete; M7 **Approved for merge** by **self-review**; M8 N/A; M9 Complete; M10 not applicable. PR [#235](https://github.com/rexescario-dev/clensy-platform/pull/235), open, not merged. See [Slice Completion Report (M9)](#slice-completion-report-m9). |
| M5 decision | **Accepted**, 2026-11-03, revision 5, by the owner as maintainer. B5 and B6 resolved; four non-blocking notes recorded in the [M5 decision](#m5-decision). Acceptance is of the plan only: it authorizes **none** of G0–G4, no image build, container change, browser check, database write, issue update or commit. The owner must still name the [approved active `TENANT_OWNER` account](#the-approved-active-tenant_owner-account-revision-5) before G0. |
| Date | 2026-11-03 |
| Tracking issue | [#209](https://github.com/rexescario-dev/clensy-platform/issues/209) "test(laundry): verify invoice and payment UI in browser". It has two checklists: the four #166 checks in the issue body, and the four #39 checks (a)–(d) in the [owner's comment](https://github.com/rexescario-dev/clensy-platform/issues/209#issuecomment-6593754934). |
| Branch | `docs/209-invoice-payment-browser-check`, from `main` at `c9e449f` (the same revision the images are built from). One PR for this plan and its M5–M9 records (process spec §2.8). |
| Verifies (Accepted) | [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md), Accepted 2026-09-06, Amendment #164: **§8.4.4**, the invoice section as delivered by the [#166 plan](2026-10-24-laundry-invoice-payment-plan.md) (decision (c) native radio group; "Open invoice" links to `/app/billing?detail=<invoice id>`). [Laundry Invoice Payments & Refunds](../specs/2026-11-02-laundry-payments-design.md), Accepted 2026-11-02: **§4.10** (the payments panel on the order page and in the billing drawer; method required; refund action per refundable `PAYMENT` row). |
| Relies on (Accepted, merged) | #166 plan, merged in PR #207 (`573a171`); its Task 6 Step 3 browser check was waived for that slice only, and #209 owns it. [#39 payments plan](2026-11-02-laundry-payments-plan.md), merged in PR #220 (`75cdab4`); its Task 10 Step 3 browser check was not performed, and #209 owns it. The [#161 cutover plan](2026-11-01-laundry-cutover-verification-plan.md) is the precedent for how a browser pass is run and recorded. |
| Authority | Where this plan and an Accepted spec disagree, the **spec wins** and this plan must be revised. The issue's checklists and acceptance criteria refine what is checked. Row ids, task order and evidence file names are planning decisions, not product semantics. |
| Spec amendment | **None.** This slice changes no behavior. |
| Scope | **Verification only** (issue scope rule). The only committed file is this plan, with its records. **No** change to application code, tests, API, schema, `@clensy/ui`, copy or dependencies. A defect found is recorded here and proposed as its own issue; it is not fixed in this slice. |
| Task types | Every task is `docs/process`. Rebuilding the local Docker stack and writing local test data are local environment actions, gated below; they are not `configuration` tasks (nothing outside the repository and the developer's machine changes). |
| Pre-validation | **None.** Nothing in this plan has been run. Every `Expected:` line is a prediction until M6 records the result. |
| M7 | Docs-only slice: `CLAUDE.md` permits a **self-review**, and the M7 record MUST label it so. The owner may still ask for a fresh reviewer. |
| Owner input | The owner skipped the brainstorm questions (2026-11-03). Owner instruction, 2026-11-03: **at closeout, verify the checklist against the results, update the ticket description and check the boxes.** See [Closeout instruction](#closeout-instruction-owner-2026-11-03). |

**Goal:** Run every #209 check in a real browser against one pinned source revision, **`c9e449f`** (`main`, which contains #166 and #39), served by both the API and the web image. Record the browser, viewport, role and result for each check, and propose an issue for any defect found.

## Source revision (revision 2)

**Both images are built from `c9e449f3d58b5058b310d586129f8015b7be6559`**, the `main` and `origin/main` head on 2026-11-03. Evidence that it contains the code under test (checked 2026-11-03):

| Fact | Evidence |
| --- | --- |
| #39 is merged | PR #220 `MERGED` 2026-11-03T01:56:31Z, merge commit `75cdab451b2f…`, head `feat/39-laundry-payments`; issue #39 `CLOSED` |
| The #39 M7 fix round is in it | `git merge-base --is-ancestor 73e324e c9e449f` → true; same for `75cdab4` |
| The payments API is in it | `apps/api/src/modules/payments/presentation/graphql/payment.resolver.ts` exists at `c9e449f` |
| #166 is in it | PR #207 merge `573a171` is an ancestor of `c9e449f` |
| Newest migration in it | `1791043200000-CreatePayments.ts`, the same name the dev database's `migrations` table already lists last |

Why a separate checkout: both Dockerfiles `COPY . .`, so an image built in the working directory carries whatever is on disk, including uncommitted files. Building from a clean `git worktree` of `c9e449f` makes the image contents equal that commit. If `main` moves before Task 1 runs, the pin stays `c9e449f` unless the owner names a new one.

## What the recon found (2026-11-03, read-only)

- `clensy-platform-api-1` runs an image built 2026-10-16 and `clensy-platform-web-1` one built 2026-10-24. Both predate #39 (`75cdab4`), and the web image may predate the #166 merge. Both must be rebuilt from the pinned revision before any check (the issue's prerequisite).
- Migration `CreatePayments1791043200000` is already applied to the dev database `clensy` (#39 plan, Task 10 note 8): the `migrations` table's last two rows are `CreatePayments1791043200000` and `AddLaundryLineDescription1790956800000`. No later migration exists at `c9e449f`. The API does not run migrations itself (no `migrationsRun` in `apps/api/src`); only the `migrate` service does, and this plan does not start it.
- **The dev database has lost earlier test data.** It now holds one tenant, one active `TENANT_OWNER` (plus one inactive one; neither is the `.env` seed account, see the open precondition below), 5 customers, 5 services, and 5 laundry orders, all `PRICED` with an `UNPAID` invoice, and no payments. The `qa161-*` staff users and the #161 orders are gone. This matches the #39 plan's warning that e2e suites truncate tables. **No PRICED order without an invoice exists**, so the radio-group check needs one new order.
- **Open precondition (found while drafting revision 4, read-only, 2026-11-03): `ADMIN_SEED_EMAIL` in `.env` matches no row in `admin_user_entity`**, exactly or ignoring case. The database's only active `TENANT_OWNER` has a different email, whose password is not in `.env`. So M6 cannot sign in with the `.env` credentials, and with that email the tenant-scope query returns no rows, which stops M6 (as designed).

#### The approved active `TENANT_OWNER` account (revision 5)

- **Definition.** "The **approved account**" in this plan means one active `TENANT_OWNER` account that the **owner names before G0**. Every browser row runs as it (decision (a)), and every UI write is made as it.
- **Owner decision before G0, not made by this plan.** M6 does not choose the account, change any credential, create or edit an admin, or re-run the seed. If no account has been approved, G0 cannot be given.
- **Credentials** are supplied by the owner **out of band**, never in the repository, this plan, a commit, a log, the issue or a chat transcript. M6 enters them in the browser only.
- **Its email** is passed to every snapshot query as the `psql` variable `seed_email` (`-v seed_email=<approved account's email>`). The variable keeps its revision 4 name; it no longer means the `.env` seed account. The email is not written to the evidence files; `before-SCOPE.txt` records only that it matched exactly one active `TENANT_OWNER`.

## Constraints

- SHALL check both viewports, 375 px and 1280 px wide (issue acceptance).
- SHALL record, for every row: who ran it, the browser, the viewport, the role, the result and an evidence file (issue acceptance; #161 precedent).
- SHALL use a real browser: Claude in Chrome if connected, otherwise the Playwright plugin's Chromium.
- SHALL measure horizontal overflow, not eyeball it: `document.documentElement.scrollWidth <= document.documentElement.clientWidth`, plus a check that no control in the section is cut off (its bounding box lies inside the viewport width).
- SHALL use network evidence for "no request is sent" (check (a)): the browser tool's network reader, filtered to `/graphql` POSTs whose body names `recordInvoicePayment` or `refundInvoicePayment`.
- SHALL NOT change application code, tests or copy. SHALL NOT fix a defect in this slice.
- SHALL NOT run any e2e suite against `clensy` (it truncates tables).
- SHALL NOT print, log or commit credentials.
- SHALL write test data only through the app's UI, as the approved active `TENANT_OWNER` account. No direct database writes.
- SHALL NOT run migrations. The `migrate` container is not built or started; the schema is verified read-only (Task 1 Step 5).
- SHALL make every record it creates identifiable (see [Test data ledger](#test-data-ledger)).
- Check (d) asks for a judgement. M6 records what is on screen, with screenshots, and gives its reading. The **owner** decides whether it is a problem.

## Decisions for M5 to confirm

- **(a) One role.** Every row runs as the [approved active `TENANT_OWNER` account](#the-approved-active-tenant_owner-account-revision-5). That role can generate an invoice, record a payment and refund, so no staff user needs to be created. Role gating is already covered by tests and is not a #209 check.
- **(b) Orders used.** `P1`: an existing order chosen by the [P1 selection rule](#p1-selection-rule-and-payment-amounts-revision-3), for the payments checks. `N1`: one new order, created through the intake modal for an existing customer, weighed and price-confirmed, for the radio-group check (it needs an order with no invoice). If no active pricing rule lets `N1` reach `PRICED`, M6 stops and asks; creating catalog data is not pre-authorized.
- **(c) How a server failure is produced for check (b).** Two tabs on `P1`. Tab A opens Refund for payment `X` and **chooses a valid method**, so its first submit passes browser validation and reaches the server. Tab B refunds `X` in full. Tab A then submits its (now too large) refund, which the server rejects. The exact steps are row B1's. No request is forged and no code is changed. If the server error closes the dialog, or does not show at all, that is recorded as the result, and check (b) is reported as "not reproducible this way", with what was seen.
- **(d) Layout rows cover the order page's "Invoice and payment" section** in both states (generate form; existing invoice with the payments panel), and the billing drawer for check (d). Other pages are out of scope.
- **(e) Results go in this plan's M6 record and in the issue.** The issue gets one results comment with the tables, plus the closeout edits (below).

## Owner-approval gates

Accepting this plan at M5 authorizes **none** of these. Each needs the owner's explicit approval in the session, recorded in the M6 record.

| Gate | Action | Where |
| --- | --- | --- |
| G0 | Start M6. Requires the owner to have named the [approved active `TENANT_OWNER` account](#the-approved-active-tenant_owner-account-revision-5) | Before Task 1 |
| G1 | Build the `api` and `web` images from a clean worktree of `c9e449f`, labelled with that revision, and recreate **only** the `api` and `web` containers with `--no-deps` (no `migrate`, Postgres untouched). | Task 1 |
| G2 | Write local test data through the UI: create, weigh and price `N1`; generate its invoice; record and refund payments on `P1`. | Tasks 2–4 |
| G3 | Each `git commit`, the push, and opening the PR (may be approved together) | Task 5, closeout |
| G4 | File an issue for each defect found | Task 5 |

Reading the stack (`docker compose ps`, GraphQL introspection, signing in, viewing pages) needs no gate. **Already authorized by the owner (2026-11-03):** the closeout edits to #209 described below.

## Tasks

### Task 1: Rebuild `api` and `web` from `c9e449f` (type: docs/process; gate G1)

Let `REV=c9e449f3d58b5058b310d586129f8015b7be6559` and `SRC=<scratchpad>/clensy-209-src`.

- [ ] **Step 1 (read-only):** Run the two database migration-table queries of Step 5 and record the results. Record the current image ids and creation dates (`docker image ls clensy-platform-*`), the running containers' image ids, and `git cat-file -t $REV` (expected: `commit`). Record the `migrate` container's identity and timestamps **before** Task 1:
  - `docker inspect clensy-platform-migrate-1 --format '{{.Id}} created={{.Created}} status={{.State.Status}} finished={{.State.FinishedAt}} image={{.Image}}'`
  - Recon, 2026-11-03 (a prediction until Step 1 runs): `created=2026-10-15T17:13:01.750541028Z status=exited finished=2026-11-01T03:11:56.665753662Z`.
- [ ] **Step 2:** `git worktree add --detach "$SRC" $REV`. Check `git -C "$SRC" rev-parse HEAD` = `$REV` and `git -C "$SRC" status --porcelain` is empty. (A local worktree, removed in Task 5; no gate.)
- [ ] **Step 3 (G1):** Build, tagging the names compose already uses, with the revision as a label:
  - `docker build -f "$SRC/Dockerfile" -t clensy-platform-api --label org.opencontainers.image.revision=$REV "$SRC"`
  - `docker build -f "$SRC/Dockerfile.web" -t clensy-platform-web --label org.opencontainers.image.revision=$REV "$SRC"`
  
  A build failure stops the task; nothing is changed by hand.
- [ ] **Step 4 (G1; revision 6): recreate `api` and `web`, with the API's runtime configuration bind-mounted.** The image from Step 3 has no `apps/api/.env`: git ignores it, so the clean worktree has none. Without it the API has no `JWT_SECRET` and refuses to start (`token.service.ts`). Compose does not pass `JWT_SECRET`. The file is therefore mounted at run time, never copied into `$SRC` or any build context. Let `ROOT=<repo-root>` (the absolute path of the repository root checkout, which holds the root `.env` and `apps/api/.env`) and `OVR=<scratchpad>/209-api-env.override.yml`.
  - **4a. Write the override outside the repository**, readable only by its owner:
    ```bash
    ( umask 077 && cat > "$OVR" <<'YAML'
    services:
      api:
        volumes:
          - type: bind
            source: <repo-root>/apps/api/.env
            target: /repo/apps/api/.env
            read_only: true
            bind:
              create_host_path: false
    YAML
    )
    ```
    (Revision 6b: `<repo-root>` stands for the absolute value of `$ROOT`, here and in the expected outputs below. Write that absolute path into the file, because Compose needs an absolute bind source and the 4b check compares it.) Check: `stat -c '%a' "$OVR"` → `600`. The file contains a path and no secret value. `web` is not in it. The long syntax with `create_host_path: false` (revision 6a, N1) means a missing host file makes the recreate fail. With the short syntax, Docker would instead create a root-owned directory at that path inside the repository. **Copy the override's exact contents into the M6 record** (revision 6a, N5); the scratchpad copy is not durable.
  - **4b. Preconditions (read-only).** Each check prints nothing on success, or only the jq projection shown:
    - `git -C "$ROOT" diff --quiet $REV -- docker-compose.yml` → exit 0: the compose file used is the pinned revision's.
    - `test -f "$ROOT/apps/api/.env"` → exit 0.
    - **`JWT_SECRET` is present and not empty** (revision 6a, N2): `grep -qE '^JWT_SECRET=.+' "$ROOT/apps/api/.env"` → exit 0. It exits 1 if the line is missing or empty. `-q` prints nothing; never print the file, a value or a hash.
    - **The build source has no `.env`** (revision 6a, B7): `test ! -e "$SRC/apps/api/.env"` → exit 0, run after Step 3 and before 4c (`$SRC` is removed only in Task 5). This replaces revision 6's image-execution check. The Step 3 image is `COPY . .` of `$SRC`, with nothing else added, so a file absent from `$SRC` cannot be in the image. If the check fails, M6 stops: the Step 3 image may hold the secret.
    - The merged configuration, with only safe fields printed: `docker compose --project-directory "$ROOT" -f "$ROOT/docker-compose.yml" -f "$OVR" config --format json | jq -c '{name, api_volumes: .services.api.volumes, web_volumes: (.services.web.volumes // [])}'` → exactly `{"name":"clensy-platform","api_volumes":[{"type":"bind","source":"<repo-root>/apps/api/.env","target":"/repo/apps/api/.env","read_only":true,"bind":{}}],"web_volumes":[]}`. Compose omits `create_host_path` when it is `false`, so `"bind":{}` is the expected form (rendered on 2026-11-14 from this override, read from stdin). The short syntax would show `"bind":{"create_host_path":true}`, which fails the check. Do **not** print the full `config` output: it shows the interpolated `DB_PASSWORD`.
  - **4c. Recreate:** `docker compose --project-directory "$ROOT" -f "$ROOT/docker-compose.yml" -f "$OVR" up -d --no-deps --no-build --force-recreate api web`. `--no-deps` keeps compose from starting `migrate` or touching `postgres`. `--no-build` uses the Step 3 tags unchanged.
  - **Note: the mount points at a live file on the host.** The path belongs to this machine, and the container reads the host file. A change to `apps/api/.env` reaches the API on its next start. If `api` is later recreated without `-f "$OVR"`, it starts with no `JWT_SECRET` and fails; that is a rollback or restart question for the owner (Step 6).
- [ ] **Step 5 (read-only): verify the source state and the schema.**
  - `docker inspect clensy-platform-api-1 clensy-platform-web-1 --format '{{.Name}} {{index .Config.Labels "org.opencontainers.image.revision"}}'` → both `$REV`. Both containers must report the **same** revision; otherwise stop.
  - **`migrate` did not run:** repeat the Step 1 command, `docker inspect clensy-platform-migrate-1 --format '{{.Id}} created={{.Created}} status={{.State.Status}} finished={{.State.FinishedAt}} image={{.Image}}'`. The output must be **identical** to Step 1's (same `Id`, `Created`, `FinishedAt` and `Image`). Any difference stops M6. `docker compose ps -a` is not used as this evidence.
  - **Newest migration file at the pinned revision** (recursive, from the commit, not the disk). The data source loads `__dirname + '/migrations/*.ts'` (`apps/api/src/platform/database/data-source.ts`); the listing is recursive anyway, so a file in a subfolder would also show up:
    - `git ls-tree -r --name-only $REV -- apps/api/src/platform/database/migrations > "$SRC.migration-files.txt"`
    - Every line must match `apps/api/src/platform/database/migrations/<13-digit timestamp>-<Name>.ts`; a line that does not is reported and stops M6: `grep -vE '^apps/api/src/platform/database/migrations/[0-9]{13}-[^/]+\.ts$' "$SRC.migration-files.txt"` → no output.
    - Count: `wc -l < "$SRC.migration-files.txt"`. Newest: `sed 's#.*/##' "$SRC.migration-files.txt" | sort -t- -k1,1n | tail -1` → `1791043200000-CreatePayments.ts`. No later file: `sed 's#.*/##' "$SRC.migration-files.txt" | awk -F- '$1 > 1791043200000'` → no output.
    - Recon, 2026-11-03 (a prediction): 30 files, all matching; newest `1791043200000-CreatePayments.ts`; none later.
  - **Database migration table** (read-only `select` only): `select count(*), max(timestamp) from migrations` → the same count as the file listing (recon: `30`) and `1791043200000`; `select name from migrations order by timestamp desc, id desc limit 1` → `CreatePayments1791043200000`. Both values must equal the Step 1 reading (taken with the same queries before the rebuild) and agree with the file listing. Any mismatch stops M6.
  - `\d payment_entity` exists, and `select unnest(enum_range(null::invoice_payment_status_enum))` includes `OVERPAID` and `REFUNDED` (#39 spec §4.9).
  - Introspect `http://localhost:3000/graphql` (`NODE_ENV=development` in compose keeps introspection on): `Mutation` has `recordInvoicePayment` and `refundInvoicePayment`.
  - `GET http://localhost:3001/` answers. The payments panel's presence in the served web build is confirmed by row L3.
  - **Runtime configuration (revision 6; revision 6a).** Run these only **after** the introspection check above has succeeded, so the API has finished starting. No check here starts a container. Every check prints names, paths, counts or exit codes, never a secret value:
    - **Mount:** `docker inspect clensy-platform-api-1 --format '{{json .Mounts}}' | jq -c '[.[] | {Type, Source, Destination, RW}]'` → exactly `[{"Type":"bind","Source":"<repo-root>/apps/api/.env","Destination":"/repo/apps/api/.env","RW":false}]`.
    - **`web` has no mount:** `docker inspect clensy-platform-web-1 --format '{{len .Mounts}}'` → `0`.
    - **No secret in the container's configuration:** `docker inspect clensy-platform-api-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | cut -d= -f1 | sort` lists names only, and `JWT_SECRET` is not among them.
    - **The mounted file can be read:** `docker exec clensy-platform-api-1 test -r /repo/apps/api/.env` → exit 0.
    - **The image has no `.env`:** proven by the `$SRC` check in 4b (revision 6a, B7). No container is run for it.
    - **The API started** (after introspection succeeded; revision 6a, N4):
      - `docker inspect clensy-platform-api-1 --format '{{.State.Status}} restarts={{.RestartCount}}'` → `running restarts=0`.
      - `docker logs clensy-platform-api-1 2>&1 | grep -c 'JWT_SECRET must be set'` → prints `0`. The expected result is the printed count `0`. `grep -c` then exits 1, and that exit status is not a failure.
    - **Database unchanged by Task 1 (read-only; revision 6a, N3).** Run the **same query as the G0 baseline**:
      ```sql
      select 'counts', (select count(*) from admin_user_entity),(select count(*) from tenant_entity),(select count(*) from laundry_order_entity),(select count(*) from invoice_entity),(select count(*) from payment_entity)
      ```
      Run it with `psql -X -d clensy -At`, exactly as G0 did. The output must equal the G0 line in `209-ev/task1-step1-before.txt`: `counts|3|1|5|5|0`.
      - Source of the query text: the G0 command run on 2026-11-14. The evidence file holds only that command's output, so the M6 record must quote the query alongside it.
      - The migration checks above cover the schema.
  
  Any mismatch stops M6 before a single row runs.
- [ ] **Step 6: Rollback is an owner decision, never automatic.** M6 does not roll the images back, on success or on failure: the issue requires the stack to serve code with #39. The old image ids and creation dates from Step 1 are recorded so the owner can decide. A rollback, if the owner asks for one, is a separate action needing its own approval.

### Test data ledger

Every record this plan creates is listed by id in the M6 record. To find them without the ledger:

- **Before snapshot** (Task 2 Step 0, read-only): queries S1, S2 and S3 run in **one** `REPEATABLE READ, READ ONLY` transaction, with `T0` and the transaction's identity captured in that same transaction (see [Snapshot procedure](#snapshot-procedure-revision-5)). S1 holds, for every laundry order in the owner's tenant, in the order defined below: order id, order `createdAt`, order status, invoice id, invoice number, `paymentStatus`, `amountPaidMinorUnits`, `totalMinorUnits` and the invoice's payment-row count. S2 holds every payment row in the tenant. Together they hold every field the P1 selection rule needs.
- **`P1` eligibility evidence:** the S1 row chosen as `P1`, query S3's output, and the order page's displayed total (screenshot), recorded in the M6 ledger.
- **Payments and refunds:** each one's **reference** field starts with `QA209-` (for example `QA209-C0-1`, `QA209-B1-tabB`).
- **`P1` amounts:** the ledger records `P1`'s invoice number, its total `T`, the two payment amounts `A1` and `A2` with `A1 + A2 < T`, the status after C0, and every refund amount.
- **`N1` term:** the ledger records the payment term chosen by keyboard in K1 and the term stored on `N1`'s invoice.
- **`N1` and its invoice:** no free-text field exists on a laundry order, so `N1` is identified by id, by `createdAt >= T0`, and by being absent from the before snapshot. Its weight is an unusual value, `2.09 kg`, as a visual marker.
- **After snapshot** (Task 5 Step 1, read-only): S1 and S2 in a **separate** `REPEATABLE READ, READ ONLY` transaction, by the same procedure with the prefix `after`; the difference from the before snapshot must equal the ledger exactly. Any extra or missing row is reported.
- Nothing is deleted. Removing the data is the owner's choice and is not part of this plan.

### Task 2: Prepare data (type: docs/process; gate G2)

- [ ] **Step 0 (read-only):** Take the before snapshot by the [Snapshot procedure](#snapshot-procedure-revision-5) with prefix `before` and queries S1, S2 and S3 below. `T0` is the `t0` value in `before-TX.txt`.

  Tenant scope, used by every query: `with t as (select "tenantId" from admin_user_entity where email = :'seed_email' and role = 'TENANT_OWNER' and "isActive")`, where `seed_email` is the [approved account's](#the-approved-active-tenant_owner-account-revision-5) email. It must match exactly one row (`before-SCOPE.txt`); otherwise stop.

  **S1, orders with invoice and payment rows**, ordered oldest first, with a deterministic tie-breaker:
  ```sql
  with t as (…)
  select o.id as order_id, o."createdAt" as order_created_at, o.status,
         i.id as invoice_id, i."invoiceNumber", i."paymentStatus",
         i."amountPaidMinorUnits", i."totalMinorUnits",
         (select count(*) from payment_entity p where p."invoiceId" = i.id) as payment_rows
  from laundry_order_entity o
  join t on o."tenantId" = t."tenantId"
  left join invoice_entity i on i."laundryOrderId" = o.id and i."tenantId" = o."tenantId"
  order by o."createdAt" asc, o.id asc;
  ```
  **S2, payment rows:** `select p.id, p."invoiceId", p.type, p.method, p."amountMinorUnits", p.reference, p."createdAt" from payment_entity p join t on p."tenantId" = t."tenantId" order by p."createdAt", p.id;`

  **S3, the P1 rule applied** to the same data, so the choice is mechanical:
  ```sql
  with t as (…)
  select o.id, o."createdAt", i.id, i."invoiceNumber", i."totalMinorUnits"
  from laundry_order_entity o
  join t on o."tenantId" = t."tenantId"
  join invoice_entity i on i."laundryOrderId" = o.id and i."tenantId" = o."tenantId"
  where i."paymentStatus" = 'UNPAID' and i."amountPaidMinorUnits" = 0
    and i."totalMinorUnits" >= 1000
    and not exists (select 1 from payment_entity p where p."invoiceId" = i.id)
  order by o."createdAt" asc, o.id asc
  limit 1;
  ```
  S3's row must also be the first S1 row meeting the rule by hand; if they disagree, stop.

  #### Snapshot procedure (revision 5)

  Both snapshots use this procedure. Only `select` statements run, inside a transaction declared `READ ONLY`, so PostgreSQL itself rejects any write. `PREFIX` is `before` (S1, S2, S3) or `after` (S1, S2). `EV` is the evidence folder.

  1. Write `EV/PREFIX-snapshot.sql`, with the full text of each query in place of the `…` placeholders:
     ```sql
     \set ON_ERROR_STOP on
     \set QUIET on
     \pset footer off
     BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;
     \echo ==TX==
     select now() as t0, pg_backend_pid() as backend_pid, pg_current_snapshot() as snapshot,
            current_setting('transaction_isolation') as isolation,
            current_setting('transaction_read_only') as read_only;
     \echo ==SCOPE==
     select count(*) as owner_rows from admin_user_entity
     where email = :'seed_email' and role = 'TENANT_OWNER' and "isActive";
     \echo ==S1==
     …S1…;
     \echo ==S2==
     …S2…;
     \echo ==S3==
     …S3…;          -- before only
     \echo ==END==
     select now() as t0_check, pg_current_snapshot() as snapshot_check;
     COMMIT;
     ```
  2. Run it in **one** `psql` session, so every query shares the transaction:
     `docker exec -i clensy-platform-postgres-1 psql -X -U "$DB_USERNAME" -d "$DB_NAME" -A -F'|' -v seed_email="<approved account's email>" < "EV/PREFIX-snapshot.sql" > "EV/PREFIX-snapshot.raw.txt"`. Exit status must be 0.
  3. Split the raw output at the markers, one file per section:
     `awk -v pre="EV/PREFIX" '/^==[A-Z0-9]+==$/{out=pre"-"substr($0,3,length($0)-4)".txt"; next} out{print > out}' "EV/PREFIX-snapshot.raw.txt"`
     → `PREFIX-TX.txt`, `PREFIX-SCOPE.txt`, `PREFIX-S1.txt`, `PREFIX-S2.txt`, `PREFIX-S3.txt` (before only), `PREFIX-END.txt`. The raw file and the `.sql` file are kept with them.
  4. **Check before using the results**; any failure stops M6:
     - `PREFIX-TX.txt`: `isolation` = `repeatable read`, `read_only` = `on`.
     - `PREFIX-END.txt`: `t0_check` equals `t0` and `snapshot_check` equals `snapshot`, which shows every query ran in the same transaction and snapshot.
     - `PREFIX-SCOPE.txt`: `owner_rows` = `1`.
  5. **Transaction identity in the evidence:** the M6 ledger records, for each snapshot, `t0`, `backend_pid` and `snapshot` from `PREFIX-TX.txt`, with the file names. `T0` is the before snapshot's `t0` (the transaction's start time).

  The procedure was tried read-only on 2026-11-03 against today's database, using S2 and the `.env` email only. It reported `repeatable read` and `read_only=on`; `t0_check` and `snapshot_check` matched; and `owner_rows` was `0`, as the open precondition predicts. No psql command tags were mixed into the files.
- [ ] **Step 1:** Sign in at `http://localhost:3001` as the approved active `TENANT_OWNER` account, with the credentials the owner supplied out of band.
- [ ] **Step 2:** Choose `P1` as S3's row (the [P1 selection rule](#p1-selection-rule-and-payment-amounts-revision-3) applied to the before snapshot) and record its order id, order `createdAt`, invoice id, invoice number and total `T`, with the eligibility evidence listed in the ledger. Compute `A1` and `A2`. If no order meets the rule, **stop** and report; do not create or change an invoice to make one fit.

#### P1 selection rule and payment amounts (revision 3)

- **Rule:** from the before snapshot (S1), the oldest laundry order in the owner's tenant (ordered by order `createdAt` ascending, then order `id` ascending as the tie-breaker) whose invoice has `paymentStatus = UNPAID`, `amountPaidMinorUnits = 0`, no payment rows, and `totalMinorUnits >= 1000` (₱10.00). The total is read from the snapshot and must match what the order page's invoice card shows; if they differ, stop.
- **Amounts** (integer **minor units**, i.e. centavos; `floor` applies to centavos, never to whole pesos): `A1 = floor(T / 4)`, `A2 = floor(T / 5)`. Worked examples at and near the threshold:

  | `T` | `A1` | `A2` | `A1 + A2` | Due after C0 |
  | --- | --- | --- | --- | --- |
  | 1000 (₱10.00) | 250 (₱2.50) | 200 (₱2.00) | 450 (₱4.50) | 550 (₱5.50) |
  | 1100 (₱11.00) | 275 (₱2.75) | 220 (₱2.20) | 495 (₱4.95) | 605 (₱6.05) |
  | 1200 (₱12.00) | 300 (₱3.00) | 240 (₱2.40) | 540 (₱5.40) | 660 (₱6.60) |
  | 2000 (₱20.00) | 500 (₱5.00) | 400 (₱4.00) | 900 (₱9.00) | 1100 (₱11.00) |

  The properties below follow. For `T >= 1000`: `A1 >= 250` and `A2 >= 200` (both at least ₱2.00); `A1 > A2`, because `T/4 - T/5 = T/20 >= 50`, so the two rows differ by amount; and `A1 + A2 <= 0.45 T < T`, so after C0 the invoice is **Partially paid** and neither payment overpays it.
- **Recon, 2026-11-03 (read-only, a prediction until Task 2 runs):** all five candidate invoices (`INV-2026-000480`–`000484`) total ₱20.00 (`2000`), are `UNPAID` and have nothing paid. The oldest is `INV-2026-000480`. With `T = 2000`: `A1 = 500` (₱5.00), `A2 = 400` (₱4.00), sum ₱9.00, due afterwards ₱11.00.
- The Record payment dialog pre-fills the amount with the amount due (#39 spec §4.10). C0 replaces it with `A1` or `A2`; it never submits the pre-filled value.
- [ ] **Step 3 (G2):** Create `N1` through the intake modal for an existing customer, record a weight and confirm the price. Expected: `N1` is `PRICED` with no invoice. Record its id.

### Task 3: #166 checks (type: docs/process)

Evidence: screenshots under `.superpowers/sdd/2026-11-03-laundry-invoice-payment-browser-check-plan/evidence/` (gitignored, not committed).

| Row | Viewport | Order | Check | Expected |
| --- | --- | --- | --- | --- |
| L1 | 1280×800 | N1 (generate form) | Section readable and laid out | Invoice and Order payment cards side by side; the three terms with their help visible; no overflow |
| L2 | 375×812 | N1 (generate form) | Mobile fit | Cards stacked; `scrollWidth <= clientWidth`; no control cut off; Generate reachable |
| K1 | 1280×800 | N1 | Keyboard: payment-terms radio group (G2: generates the invoice) | Tab reaches the group (lands on the checked option, the default Pay on completion); arrow keys move and select; Space selects; clicking a label selects its radio; each radio's accessible description is its help text; focus is visible throughout. Final choice by keyboard: a **non-default** term (Pay on delivery), which is **recorded**, with the checked radio's value read from the accessibility tree before Generate. Tab reaches Generate, Enter generates. **Persisted term check:** after the success toast, reload the page; the invoice card shows Pay on delivery; and, read-only, `invoice_entity."paymentTerms"` for `N1`'s invoice is `PAY_ON_DELIVERY`. Pass only if the chosen, displayed and stored terms all agree |
| L3 | 1280×800 | N1 (existing invoice) | Section after generation | Number, amount, Unpaid badge, terms, Open invoice link, payments panel; no overflow |
| L4 | 375×812 | N1 (existing invoice) | Mobile fit after generation | As L2, including the panel's Record payment button |
| O1 | 1280×800 | N1 | Open invoice | Opens `/app/billing?detail=<N1 invoice id>` with the billing drawer for that invoice (same number and total) |

### Task 4: #39 checks (type: docs/process; gate G2 for every write)

| Row | Viewport | Order | Check | Expected / what is recorded |
| --- | --- | --- | --- | --- |
| C0 | 1280×800 | P1 | Setup: record two payments, `A1` by Cash (reference `QA209-C0-1`) and `A2` by GCash (reference `QA209-C0-2`), each with a method chosen explicitly and the pre-filled amount replaced ([amounts](#p1-selection-rule-and-payment-amounts-revision-3)) | Two `PAYMENT` rows, each with a Refund button; status Partially paid; amount paid `A1 + A2`; amount due `T − A1 − A2`. If the status is anything else, stop |
| A1 | 1280×800 | P1 | (a) Record payment with the method left on "Choose a method", submit | Records whether the browser's "Please select an item" bubble and/or the inline "Choose how the money moved." appears. **No** `recordInvoicePayment` request (network reader) |
| A2 | 1280×800 | P1 | (a) Same for Refund on one row | As A1, for `refundInvoicePayment` |
| C1 | 1280×800 | P1 | (c) Accessible names of the two Refund buttons (accessibility tree) | Records each name. Known today: both "Refund payment" → expected **Fail** of "can be told apart" |
| B1 | 1280×800 | P1 | (b) Stale error, decision (c), with `X` = the `A1` payment: **1.** Tab A opens Refund for `X` and **chooses a valid method** (Cash), leaving the pre-filled amount (`A1`, the full refundable amount). **2.** Tab B opens `P1`, refunds `X` in full (reference `QA209-B1-tabB`) and sees the success toast. **3.** Tab A submits its open refund; the network reader shows one `refundInvoicePayment` request reaching the server, and the response is a rejection. **4.** In the same dialog, Tab A **blanks the amount** and submits again. (The method cannot be cleared: the "Choose a method" option is `disabled` in `apps/web/components/billing/invoice-payments-panel.tsx`, so a user cannot pick it again once a method is chosen.) **5.** Record what is shown | Records: the server error text from step 3; whether that error is still visible beside the new validation error in step 4; that step 4 sent **no** request. If step 3 is blocked before the server (no request), B1 is **Not run**, with the reason |
| D1 | 1280×800 and 375×812 | P1 | (d) Billing drawer for P1's invoice | Screenshot of the amount block and the panel below it; records which figures repeat and Claude's reading; the owner's verdict is recorded at M6 |
| L5 | 375×812 | P1 | Order page "Invoice and payment" with history rows | No overflow; the history and Refund buttons reachable |

### Task 5: Record (type: docs/process)

- [ ] **Step 1:** Take the after snapshot by the [Snapshot procedure](#snapshot-procedure-revision-5) with prefix `after` (S1 and S2 only, in their own transaction, separate from the before snapshot's) and reconcile it with the ledger. Remove the worktree (`git worktree remove "$SRC"`). Append the M6 record to this plan: gate approvals with dates, Task 1 results (revision labels, schema checks), the ids from Task 2, the Task 3 and Task 4 tables with results and evidence names, and the ledger of test data left in `clensy` (`N1`, its invoice, the `QA209-` payments and refunds on `P1`).
- [ ] **Step 2:** For each failed row, write the reproduction steps and propose a new issue (title and body) to the owner; file it only under **G4**. Known candidate: C1.
- [ ] **Step 3:** Post one results comment on #209 with the tables, the browser and viewports (issue acceptance). This comment is part of the owner-authorized closeout edits; if the owner prefers, it waits for closeout.
- [ ] **Step 4:** M6 Slice Completion Report. Validation rows: Tests, Typecheck, Lint, Build **N/A** (no code changed); the browser rows are the evidence.
- [ ] **Step 5 (G3):** Commit this plan.

## Verification strategy

TDD does not apply: no code changes. The browser rows replace it. A row passes only with its evidence file, and "no request sent" only with the network reader's output. A row that cannot be run is recorded as **Not run**, with the reason, never as passed.

## Closeout instruction (owner, 2026-11-03)

At closeout, after the merge is confirmed:

1. Check every item of both #209 checklists (the body's four #166 checks and the comment's four #39 checks (a)–(d)) against the M6 record.
2. Update the issue: edit the description and the owner's comment so each box is ticked when its check was **performed and recorded**, with a one-line result and a link to the results comment. A check that was performed but found a defect is ticked, with its follow-up issue linked. A check not performed stays unticked, with the reason.
3. Close #209 only when every box is ticked.

## Revision 2 changes

Owner hold on revision 1, 2026-11-03, before M5 review:

| Owner point | Change |
| --- | --- |
| "Rebuilding from `main` would not necessarily include the #39 payments implementation"; the plan must name the exact source revision, and both images must carry the same state | The premise was out of date (#39 is merged; see [Source revision](#source-revision-revision-2)), but the requirement stands and is adopted: the revision is pinned to `c9e449f`, both images are built from a clean worktree of it, labelled with it, and Task 1 Step 5 checks both containers report it before any row runs. |
| Verify the schema without rerunning migrations | `migrate` is no longer built or started (`--no-deps`); Task 1 Step 5 verifies the `migrations` table, `payment_entity`, the two new enum values and the GraphQL mutations read-only. |
| Identify the records the plan creates | New [Test data ledger](#test-data-ledger): before/after snapshots, `QA209-` payment references, `N1` by id, `T0` and a marker weight, reconciliation in Task 5. |

Nothing else changed.

## Revision 3 changes

M5 review of revision 2 (owner as maintainer, 2026-11-03): two blockers, plus two clarifications.

| Point | Change | Sections |
| --- | --- | --- |
| **B1:** C0's ₱100 + ₱50 does not guarantee Partially paid; Task 2 does not ensure `P1`'s total exceeds ₱150 | Confirmed by read-only recon: every candidate invoice totals ₱20.00, so revision 2's C0 would have overpaid. `P1` is now chosen by a rule (unpaid, nothing paid, no payments, total ≥ ₱10.00), and the amounts are derived from its total: `A1 = floor(T/4)`, `A2 = floor(T/5)`, so `A1 + A2 < T`. Task 2 stops if no order fits. The ledger records `T`, `A1`, `A2` and the resulting status | Decisions (b); Test data ledger; Task 2 Step 2 and the new "P1 selection rule and payment amounts"; Task 4 row C0 |
| **B2:** B1's first submit could be stopped by the required-method validation instead of reaching the server | Row B1 is now five explicit steps: tab A chooses a valid method before tab B's refund; step 3 must show a request reaching the server, or B1 is Not run. Step 4 blanks the amount, because the method placeholder is a `disabled` option and cannot be chosen again | Decisions (c); Task 4 row B1 |
| Image rollback is an owner decision | Task 1 Step 6 says so explicitly; M6 never rolls back on its own | Task 1 Step 6 |
| K1 must record the chosen term and verify the persisted term | K1 picks a non-default term by keyboard, records it, and checks it after a reload and in `invoice_entity."paymentTerms"` (read-only) | Task 3 row K1; Test data ledger |
| M5 note (pre-review): ₱10.00 and ₱11.00 seem to give equal amounts | Not a defect: the formula floors centavos, so `T = 1000` gives 250 and 200, which are distinct. A worked-example table in centavos was added so the rule cannot be read in whole pesos. The ₱10.00 threshold is unchanged | P1 selection rule and payment amounts |

Unchanged: source revision `c9e449f`, the image build strategy, the schema checks, the test-data safety rules and the separate gates G0–G4.

## Revision 4 changes

M5 review of revision 3 (owner as maintainer, 2026-11-03): two blockers and one evidence note.

| Point | Change | Sections |
| --- | --- | --- |
| **B3:** the before snapshot lacked the fields the P1 rule needs, and "oldest" had no tie-breaker | Step 0 now defines read-only queries S1 (order id, `createdAt`, status, invoice id and number, payment status, amount paid, total, payment-row count), S2 (payment rows) and S3 (the rule applied, `limit 1`). "Oldest" is order `createdAt` ascending, then order `id` ascending. Step 2 takes `P1` from S3, cross-checked against S1. The eligibility evidence goes in the M6 ledger | Test data ledger; Task 2 Steps 0 and 2; P1 selection rule; Task 5 Step 1 |
| **B4:** the migration-file check used a non-recursive `ls-tree` and `tail -1` | Step 5 now lists the files recursively from `$REV` (`git ls-tree -r`), checks that every name has the expected shape, sorts by numeric timestamp, names the newest, and confirms no later file. The read-only migration-table check compares the row count and the highest timestamp to the file listing, before and after the rebuild | Task 1 Steps 1 and 5 |
| Note: prove `migrate` did not run with `docker inspect` | Step 1 records the `migrate` container's `Id`, `Created`, `FinishedAt` and `Image`; Step 5 repeats the same command and requires identical output. `docker compose ps -a` is no longer the evidence | Task 1 Steps 1 and 5 |

Found while revising, not changed: `ADMIN_SEED_EMAIL` matches no admin row, so the sign-in account is an open owner decision before G0 (see [What the recon found](#what-the-recon-found-2026-11-03-read-only)). Also corrected: "follow: For" → "follow. For". Unchanged: source revision `c9e449f`, the image build strategy, the payment formula, the test sequence, the schema checks, the test-data safety rules and gates G0–G4.

## Revision 5 changes

M5 review of revision 4 (owner as maintainer, 2026-11-03): two blockers.

| Point | Change | Sections |
| --- | --- | --- |
| **B5:** the snapshot queries were not guaranteed to see one consistent state | New "Snapshot procedure": the before snapshot (S1, S2, S3) runs in one `REPEATABLE READ, READ ONLY` transaction in a single `psql` session; the after snapshot (S1, S2) runs in a separate one. `T0`, the backend pid and `pg_current_snapshot()` are captured in the same transaction and checked again at its end. The output is split into one evidence file per query by marker. Still `select`-only, and the `READ ONLY` transaction rejects writes | Test data ledger; Task 2 Step 0; new Snapshot procedure; Task 5 Step 1 |
| **B6:** "the seeded `TENANT_OWNER`" no longer matched the database | One term throughout: the **approved active `TENANT_OWNER` account**, named by the owner before G0, with credentials supplied out of band. Its email is the `seed_email` variable. The single-role decision is unchanged. M6 does not choose an account, change credentials or re-run the seed | What the recon found (new subsection); Constraints; Decisions (a); gate G0; Task 2 Steps 0 and 1 |

Unchanged: source revision `c9e449f`, the Docker strategy, the migration checks, the payment formula, the test sequence, the test-data safety rules and gates G0–G4 (G0 now names the approved account as its precondition; its action is the same).

## Revision 6 changes

Found in the M6 preflight on 2026-11-14, after G0 and Task 1 Steps 1–2, and before any build. Revision 5 and its [M5 decision](#m5-decision) are not changed.

| Point | Change | Sections |
| --- | --- | --- |
| **R6-1: the clean API image has no runtime configuration.** `NestConfigModule.forRoot({ isGlobal: true })` (`apps/api/src/platform/config/config.module.ts`) reads the process environment and `.env` in the working directory, `/repo/apps/api`. `token.service.ts` refuses to start without `JWT_SECRET` outside tests. `apps/api/.env` is gitignored, so the clean `c9e449f` worktree has none. Compose does not pass `JWT_SECRET`. Today's `api:latest` works only because `.dockerignore` excludes the root `.env` and not `apps/api/.env`, so `COPY . .` built that file, secret included, into an image layer. The unrecorded `api:c9e449f-209` image (2026-11-03) has no such file. Followed literally, Step 4 would start an API that cannot run, and Step 5 would stop M6. | The file is **bind-mounted read-only at run time** through a compose override file kept outside the repository (mode `600`). It is never copied into `$SRC` or a build context, so no image layer holds it. Step 4 now writes the override, checks its preconditions, and recreates `api` and `web` with `--project-directory "$ROOT" -f docker-compose.yml -f "$OVR"`, keeping `--no-deps --no-build --force-recreate`. Step 5 gains checks that print only names, paths or exit codes: the exact mount, no mount on `web`, no `JWT_SECRET` among the container's variable names, no `.env` inside the image, the API running with no `JWT_SECRET` error, and database counts unchanged | Task 1 Steps 4 and 5; Status |

Options considered and rejected: copying the file into the build context (puts the secret into image layers); compose `env_file:` or `environment: JWT_SECRET: ${JWT_SECRET}` (both expose values in `docker inspect`, and the root `.env` holds a **different** `JWT_SECRET` from `apps/api/.env`, so the API would sign with a different secret).

Risks the change adds: the mount names a path on this machine and a live host file. A change to `apps/api/.env` reaches the API on its next start. Recreating `api` later without the override starts it with no `JWT_SECRET`. The secret is still in plain text in the host file, as before; revision 6 does not redesign secret handling.

Unchanged: source revision `c9e449f`; Steps 1–3 and 6, including the image tags `clensy-platform-api` and `clensy-platform-web` and the build commands; the `web` service; no `migrate`; the migration and schema checks; Tasks 2–5; the test-data rules; and gates G0–G4. No application code, Dockerfile, `.dockerignore`, repository compose file or `.env` file changes.

### M5 focused re-review of revision 6 (2026-11-14)

```text
Decision: Revise
Subject (plan): this file, revision 6 (the delta from revision 5: Task 1 Steps 4–5, Status, Revision 6 changes)
Reviewer: a fresh, independent agent (most capable model) that did not draft revision 6; read-only review
Review summary: the runtime bind mount, the override and the compose command are correct and keep the secret out of every image layer and out of the container's configuration; one Step 5 check falls outside gate G1
Findings: B7 blocking; N1–N6 non-blocking
Gate: revision 6 may not be used for M6 until B7 is resolved and the fix is confirmed
```

Evidence the reviewer collected (read-only):
- `git show c9e449f:` for compose, both Dockerfiles, `.dockerignore`, `config.module.ts`, `token.service.ts`, `jwt.strategy.ts`, `database.module.ts` and `main.ts`.
- The source of `@nestjs/config@4.0.4`, the version locked at `c9e449f`.
- The variable names in both `.env` files (names only).
- `git diff --quiet c9e449f -- docker-compose.yml` → exit 0.
- Docker 27.1.1 and Compose v2.29.1.
- The M5 decision section is byte-identical to revision 5's.

Findings:

- **B7 (blocking).** The image check in Step 5 runs `docker run --rm … clensy-platform-api`, which creates a third container. G1 allows recreating **only** `api` and `web`, and Step 5 is labelled read-only. The text's "no network use" is also wrong: without `--network none` the container joins the default bridge. Required fix, one of:
  - (a) **Preferred:** replace the check with a host-side check that creates no container. In 4b, `test ! -e "$SRC/apps/api/.env"` → exit 0; optionally also `git -C "$SRC" status --porcelain --ignored` shows no `apps/api/.env`. The image is `COPY . .` of `$SRC`.
  - (b) Keep `docker run`, add `--network none`, correct the wording, and widen G1 and Step 5's label to cover it.
- **N1.** The short volume syntax defaults to `create_host_path: true`. If `apps/api/.env` were missing at `up`, Docker would create a root-owned directory at that path inside the repository. The 4b `test -f` prevents this. Hardening: use the long syntax with `bind: {create_host_path: false}`, and update the expected 4b jq output.
- **N2.** 4b checks only that the name `JWT_SECRET` is present, so an empty value would pass. Use `grep -qE '^JWT_SECRET=.+' "$ROOT/apps/api/.env"` → exit 0. It prints nothing.
- **N3.** Step 5 compares the database counts with the G0 reading, but the evidence file does not record the G0 query text. State that the G0 query is the Step 5 query, with the same column order.
- **N4.** Run the "API started" check only after introspection has succeeded. `grep -c` prints `0` and exits 1; the expected result is the printed `0`.
- **N5.** `$OVR` lives in a session scratchpad. Record the override's contents in the M6 record (it holds only a path), so the owner can reproduce it for a restart or rollback.
- **N6 (outside this plan's scope).** `.dockerignore` lets `apps/api/.env` into earlier images. The old `clensy-platform-api:latest` (`97833f0c7104`) holds the secret in a layer. Propose a follow-up issue: add `**/.env` to `.dockerignore`, and treat that secret as exposed in the old image layers.<br>*Traceability note (M7, 2026-11-14): this is already tracked by [#226](https://github.com/rexescario-dev/clensy-platform/issues/226), filed on 2026-11-03 during the first Task 1 attempt.*

Answers to the review questions:
1. **Configuration.** `ConfigModule.forRoot({isGlobal:true})`, run from `/repo/apps/api`, reads `/repo/apps/api/.env`. Process-environment values win over the file, so compose's `DB_*`, `NODE_ENV`, `WEB_ORIGIN` and `APP_DEBUG` still apply. No other value is missing. `web` needs no runtime configuration. No secret reaches an image.
2. **Compose.** The command is consistent:
   - The project name is `clensy-platform`, and the root `.env` is still used for interpolation.
   - The tags equal the Step 3 tags.
   - The merge yields exactly one bind on `api` and none on `web`.
   - `--no-deps` skips `migrate` and `postgres`.
3. **Step 5 checks.** The syntax and expected outputs are correct, and the checks are secret-safe, except B7, N3 and N4.
4. **Scope.** The pin, tags, Steps 1–3 and 6, Tasks 2–5 and the safety boundaries are unchanged, except B7.

## Revision 6a changes

Drafted on 2026-11-14 in response to the [focused re-review of revision 6](#m5-focused-re-review-of-revision-6-2026-11-14). That review record and revision 5 are not changed.

| Finding | Change | Sections |
| --- | --- | --- |
| **B7** | The `docker run` image check is removed. Step 4b now checks `test ! -e "$SRC/apps/api/.env"`, the build input of the Step 3 image. No Step 4–5 check starts a container other than the recreated `api` and `web` | Task 1 Steps 4b and 5 |
| **N1** | The override uses the long volume syntax with `read_only: true` and `bind.create_host_path: false`. Step 4b's expected jq output is exact and includes `"bind":{}`, which is how Compose renders `false` (checked with the override on stdin; no file written) | Task 1 Steps 4a and 4b |
| **N2** | `grep -qE '^JWT_SECRET=.+'` replaces the name-only check. It fails when the line is missing or empty and prints nothing | Task 1 Step 4b |
| **N3** | The database comparison quotes the exact G0 query and its recorded output (`counts|3|1|5|5|0`). The query text is taken from the G0 command, because the evidence file holds only its output | Task 1 Step 5 |
| **N4** | The runtime checks run only after introspection succeeds. The expected `grep -c` result is the printed `0`, not the exit status | Task 1 Step 5 |
| **N5** | Step 4a requires the override's exact contents to be copied into the M6 record | Task 1 Step 4a |

**N6, a separate security follow-up, is pending and needs its own authorization.** `.dockerignore` does not exclude `apps/api/.env`, and the old `clensy-platform-api:latest` (`97833f0c7104`) holds that file's `JWT_SECRET` in an image layer. Nothing has been remediated: no issue is filed, and `.dockerignore` and the old image are unchanged.

*Traceability note (M7, 2026-11-14). The statement "no issue is filed" was wrong: [#226](https://github.com/rexescario-dev/clensy-platform/issues/226) ("pass JWT_SECRET at runtime; keep apps/api/.env out of the image") was filed on 2026-11-03 and tracks the JWT secret and runtime-configuration problem, including `.dockerignore`. Revision 6a's read-only bind mount is a local workaround for #209's check only; it does not resolve #226 and does not change the accepted technical decision. The old image is recorded on #226 ([comment](https://github.com/rexescario-dev/clensy-platform/issues/226#issuecomment-6871264755)).*

Unchanged from revision 6: the bind-mount approach, the override's location and mode `600`, the 4c command, the host-path and live-file note, and the other Step 5 checks. Unchanged from revision 5: everything outside Task 1 Steps 4–5 and the Status row.

### M5 focused confirmation of revision 6a (2026-11-14)

```text
Decision: Accepted
Subject (plan): this file, revision 6a (the delta from revision 6: Task 1 Steps 4a, 4b and 5; Status; Revision 6a changes)
Reviewer: a fresh, independent agent (most capable model) that did not draft revision 6 or 6a; read-only review
Review summary: B7 is resolved by a host-side check, and no Step 4–5 check starts a container beyond recreating api and web. N1–N5 are applied, and the stated expected outputs are exact. Preserved sections are byte-identical.
Findings: none blocking; C1–C5 non-blocking
Gate: acceptance authorizes no gate; G1 needs the owner's approval (the owner gave G0 + G1 on 2026-11-14)
```

The reviewer checked, read-only:
- `git show c9e449f:` for the Dockerfile, `.dockerignore`, compose, `.gitignore`, both `package.json` files, `scripts/build-graphiql.ts`, `config.module.ts` and `token.service.ts`. No build step creates `apps/api/.env`.
- `docker compose … -f - config` for the long syntax, the short syntax and the long syntax without `bind:`. The expected 4b output matched byte for byte and tells all three apart.
- `git diff --quiet c9e449f -- docker-compose.yml` → exit 0.
- The G0 evidence line.
- That the revision 5 M5 decision record and the recorded revision 6 review are byte-identical.

**Non-blocking notes, carried into M6 as operational notes; the accepted text is not changed:**

1. **C1. `$SRC` guard.** Run `test ! -e "${SRC:?}/apps/api/.env"` in the same shell that confirmed `git -C "$SRC" rev-parse HEAD` = `$REV`, so an unset `$SRC` cannot pass vacuously. Optionally also run it just before Step 3, to cover the build from both sides.
2. **C2. psql invocation.** The M6 record quotes the full G0 command: `docker exec clensy-platform-postgres-1 psql -X -U "$DB_USERNAME" -d clensy -At -c "<query>"`.
3. **C3. Quoted-empty values.** `JWT_SECRET=""` or a whitespace-only value passes 4b. The API then refuses to start, and Step 5 stops M6.
4. **C4. Running image identity.** Record `docker image inspect clensy-platform-api --format '{{.Id}}'` right after Step 3, and check in Step 5 that it equals `docker inspect clensy-platform-api-1 --format '{{.Image}}'`. This separates the new image from the older `api:c9e449f-209` (`b8d74fa2cbc7`), which may carry the same revision label.
5. **C5. Wording.** The Status row now names revision 6a. In the evidence file, the `counts|3|1|5|5|0` line sits under "== Step 1 (read-only)", taken in the same G0 and Step 1 command.

## Revision 6b changes

Redaction before publication. The repository is public, and the owner chose to redact on 2026-11-14.

| Change | Where |
| --- | --- |
| Each of the 7 occurrences of the developer machine's absolute repository path is replaced by the placeholder `<repo-root>`. `ROOT=<repo-root>` is now described as "the absolute path of the repository root checkout". | Task 1 Step 4 (the `ROOT` definition, the 4a override, the expected 4b output), Step 5 (the expected mount), and the M6 record (the quoted override, 4b output and Step 5 output) |
| One sentence added to Step 4a: `<repo-root>` stands for `$ROOT`'s absolute value and must be written as that absolute path, because Compose needs an absolute bind source and 4b compares it. | Task 1 Step 4a |

**Unchanged:** every command, check, expected structure and result.
- In the M6 record's quoted outputs, only the path prefix is shown as `<repo-root>`. The values recorded at run time were that machine's absolute repository path.
- `owner@clensy.local` (a dev seed address) and home-relative paths such as `~/.cache/...` are kept.
- No other text changes.

### Focused review of revision 6b (2026-11-14)

```text
Decision: Accepted
Subject: revision 6b (path redaction only)
Reviewer: a fresh, independent agent (most capable model) that did not draft it; read-only review
Findings: none blocking
```

The reviewer checked:
- `grep -c '/home/'` = 0.
- The 7 changed lines differ only in the path prefix, apart from the disclosed rewording of the `ROOT` definition.
- The added Step 4a sentence covers the quoted heredoc and the expected 4b and Step 5 outputs.
- The M6 record states honestly that only the prefix was redacted.
- "## M5 decision" through "## Risks" and every earlier review record are byte-identical.
- No secret values. `owner@clensy.local` is the only email address.
- No session `/tmp` paths remain.

Non-blocking notes:
- **N-a:** give revision 6b's acceptance state in the Status row. Done.
- **N-b:** the change table's "Where" column is consistent with the text. No action.

## M5 decision

```text
Decision: Accepted
Subject (plan): docs/superpowers/plans/2026-11-03-laundry-invoice-payment-browser-check-plan.md, revision 5
Accepted specifications: docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md §8.4.4 (Amendment #164);
  docs/superpowers/specs/2026-11-02-laundry-payments-design.md §4.10
Delivery goal: run every #209 check in a real browser against c9e449f and record the results
Review summary: focused re-review of B5 (snapshot consistency) and B6 (account terminology); both resolved
Findings: None blocking
Gate: Proceed to M6 only after the owner names the approved account and approves G0; each later gate needs its own approval
Authority: Plan governs sequencing/execution; specifications govern product semantics
```

Reviewer: the owner, as maintainer, 2026-11-03. Earlier rounds: revision 1 held before review; revision 2 returned (B1, B2); revision 3 returned (B3, B4); revision 4 returned (B5, B6).

**Non-blocking notes (carried into M6 as operational notes; the accepted text is not changed):**

1. **Email in the process list.** `seed_email` is passed on the `docker exec` command line, so it is visible in the local process list while the query runs. It never reaches the evidence files. The operator accepts this exposure for the local dev machine, or uses a less exposed input in M6 that gives the same result (recorded as an M6 deviation if so).
2. **Variable name.** `seed_email` now means the approved account's email; a name like `approved_owner_email` would be clearer. Optional; not changed.
3. **Trial coverage.** The 2026-11-03 trial was **S2 only**, read-only, with the `.env` email (`SCOPE = 0`). It did not exercise S1, S3 or the full before-snapshot split. Their first real run is M6's.
4. **Command text.** The reviewer assessed the design, not the exact command, because the pasted excerpt was distorted. Verified on 2026-11-03 against the plan file itself: the `psql` and `awk` command lines extracted from this file pass `bash -n`, and the `awk` line, run exactly as written (with `EV/PREFIX` substituted) on the trial output, produced `TX`, `SCOPE`, `S2` and `END` files with no stray lines. M6 re-checks the final commands with the real email and paths before running them.

## Risks (execution only)

- The rebuild could fail, for example on a dependency or build error at `c9e449f`. Then M6 stops at Task 1 and reports; nothing is changed by hand.
- The Playwright Chromium's native validation bubble may not show in a screenshot. A1/A2 then record the select's `validationMessage` and `:invalid` state too.
- Another session could run e2e against `clensy` and wipe the test data mid-pass. If ids disappear, M6 stops and reports.

## M6 record

Executed against revision 5, with revision 6a for Task 1 Steps 4–5. Evidence: `<scratchpad>/209-ev/`. That location is session-local, so this record quotes everything needed.

### Gate approvals

| Gate | Decision | Date |
| --- | --- | --- |
| Approved account | The owner named `owner@clensy.local`, id `f057eca8-bdcf-474d-a66e-9af9954a2357` (active `TENANT_OWNER`, scope `TENANT`, Bootstrap tenant `b0075a4e-6c1e-4d0a-9f3a-6f1e2d7c0001`). The owner authorized creating it with `pnpm db:seed:dev-owner` (#227), which output `created`. | 2026-11-14 |
| G0 + G1 | Approved by the owner. An earlier approval was withdrawn because it came before the account was named; it was given again after the account was named. The build was paused for revisions 6 and 6a, then resumed under the same approval. | 2026-11-14 |
| G2, G3, G4 | **Not approved** at the time of Task 1. Later approved by the owner on 2026-11-14: G2 (see [G2 results](#g2-results-task-2-step-3-tasks-3-and-4-2026-11-14)), G4 (see [Owner's D1 verdict and G4](#owners-d1-verdict-and-g4-2026-11-14)) and G3 (see [Task 5](#task-5-2026-11-14)). | — |

Branch: `docs/209-invoice-payment-browser-check`, fast-forwarded from `c9e449f` to `7585658` (`main`, #227 and follow-ups). The images stay pinned to `c9e449f`. Before G0, at the owner's request, the two worktrees that predate the e2e isolation were removed, and all Docker containers on the host were stopped. Only clensy `postgres` was started again (`docker compose up -d postgres`).

### Task 1 results (2026-11-14)

**Step 1 (read-only, G0).**
- Migrations: `30|1791043200000`; newest `CreatePayments1791043200000`.
- Counts, from the command quoted under Step 5: `counts|3|1|5|5|0`.
- `git cat-file -t $REV` = `commit`.
- Images before the build:
  - `api:latest` `97833f0c7104`, built 2026-10-16
  - `web:latest` `329a090c6b56`, built 2026-10-24
  - `migrate:latest` `b9d8a4de76e0`
  - an unrecorded `api:c9e449f-209` `b8d74fa2cbc7` and `web:c9e449f-209` `963e0bdef04f`, from 2026-11-03
- The stopped `api` and `web` containers ran `97833f0c…` and `329a090c…`.
- `migrate`: `d14ecd52409f… created=2026-10-15T17:13:01.750541028Z status=exited finished=2026-11-11T20:32:54.002100033Z image=sha256:b9d8a4de76e0…`. The recon value (finished 2026-11-01) was a prediction and is now stale.

**Step 2.** `$SRC` = `<scratchpad>/clensy-209-src`.
- `HEAD` = `c9e449f3d58b5058b310d586129f8015b7be6559`.
- `status --porcelain` is empty, including ignored files.

**Step 3.**
- C1: `test ! -e "${SRC:?}/apps/api/.env"` passed both before and after the build, in the same shell as the `HEAD` = `$REV` check.
- Build commands, exactly as written. Both exited 0:
  - `docker build -f "$SRC/Dockerfile" -t clensy-platform-api --label org.opencontainers.image.revision=$REV "$SRC"`
  - `docker build -f "$SRC/Dockerfile.web" … -t clensy-platform-web …`
- Results (C4: ids captured right after the build):
  - `clensy-platform-api` = `sha256:b8d74fa2cbc7a2fd9d3450510fa365e381cbd54004bec07f4c3a96adfb66bb38`, label `c9e449f…`
  - `clensy-platform-web` = `sha256:963e0bdef04f6356547175b8779cb1cb5648e1925190c6264edbe89f91159ee0`, label `c9e449f…`
- **Observation.** Every layer was a cache hit, and the image ids equal the unrecorded 2026-11-03 `c9e449f-209` images. Image ids are content-addressed, and the `COPY . .` cache key is a checksum of the build context. So those images were built from byte-identical content, and C4 cannot tell them apart because they are the same image.
- The previous `:latest` images (`97833f0c7104`, `329a090c6b56`) lost their tags. They still exist and are not removed. `97833f0c7104` still holds `apps/api/.env` in a layer (N6, tracked by [#226](https://github.com/rexescario-dev/clensy-platform/issues/226)).
- **Image content, checked without a container.** `docker image save clensy-platform-api` was unpacked, and each of the 10 layers listed with `tar -t`: 0 entries for `repo/apps/api/.env` or its whiteout. As a sanity check, `repo/apps/api/package.json` was found. The temporary files were deleted.

**Step 4 (revision 6a).**
- 4a: the override at `<scratchpad>/209-api-env.override.yml`, mode `600`, with exactly this content:
  ```yaml
  services:
    api:
      volumes:
        - type: bind
          source: <repo-root>/apps/api/.env
          target: /repo/apps/api/.env
          read_only: true
          bind:
            create_host_path: false
  ```
- 4b, each passing:
  - compose file equals `$REV`: exit 0
  - `test -f` on the env file: exit 0
  - `grep -qE '^JWT_SECRET=.+'`: exit 0
  - `$SRC` has no `.env`: exit 0
  - the merged-config projection exactly equals the expected `{"name":"clensy-platform","api_volumes":[{"type":"bind","source":"<repo-root>/apps/api/.env","target":"/repo/apps/api/.env","read_only":true,"bind":{}}],"web_volumes":[]}`
  - extra check: with `api.volumes` removed, the merged config equals the base config, so the override changes nothing else
- 4c: `docker compose --project-directory "$ROOT" -f "$ROOT/docker-compose.yml" -f "$OVR" up -d --no-deps --no-build --force-recreate api web` exited 0. Only `api` (`199b589f6b27`) and `web` (`4b46928e7445`) were recreated. `migrate` and `postgres` were untouched. Running afterwards: `api`, `web`, `postgres` and nothing else.

**Step 5.**
- Revision labels: `api` and `web` are both `c9e449f3d58b5058b310d586129f8015b7be6559`.
- `migrate` inspect output is **identical** to Step 1's.
- Migration files at `$REV`: 30, all matching the pattern, newest `1791043200000-CreatePayments.ts`, none later.
- Database: `30|1791043200000`, newest `CreatePayments1791043200000`, equal to Step 1.
- `payment_entity` exists. Read-only, this was checked through `information_schema.tables` (count 1) rather than `\d`.
- `invoice_payment_status_enum` = `UNPAID,PARTIALLY_PAID,PAID,VOID,OVERPAID,REFUNDED`.
- Introspection of `Mutation` lists `recordInvoicePayment,refundInvoicePayment`.
- `GET http://localhost:3001/` answered HTTP `307` (redirect).
- Runtime configuration, checked after introspection succeeded:
  - api mounts exactly `[{"Type":"bind","Source":"<repo-root>/apps/api/.env","Destination":"/repo/apps/api/.env","RW":false}]`; web mounts `0`
  - api env names: `APP_DEBUG DB_HOST DB_NAME DB_PASSWORD DB_PORT DB_USERNAME NODE_ENV NODE_VERSION PATH WEB_ORIGIN YARN_VERSION`, with no `JWT_SECRET`
  - the mounted file is readable (exit 0)
  - C4: the running `api` image is `b8d74fa2…` and the running `web` image is `963e0bde…`, each equal to its Step 3 id
  - `api` is `running restarts=0`, and so is `web`
  - `JWT_SECRET must be set` log count: `0`
- Database counts (C2), using the full G0 command, run again unchanged: `docker exec clensy-platform-postgres-1 psql -X -U "$DB_USERNAME" -d clensy -At -c "select 'counts', (select count(*) from admin_user_entity),(select count(*) from tenant_entity),(select count(*) from laundry_order_entity),(select count(*) from invoice_entity),(select count(*) from payment_entity)"`. Before: `counts|3|1|5|5|0`. After: `counts|3|1|5|5|0`.

**Step 6.** No rollback was done. The old image ids are recorded above, so the owner can decide.

**Task 1: complete. Every Step 3–5 check passed.** No migration, e2e run, database write, seed (after the authorized one) or GitHub write took place. Next: Task 2, which needs **G2**.

### G2 results: Task 2 Step 3, Tasks 3 and 4 (2026-11-14)

**G2.** Approved by the owner on 2026-11-14 for Task 2 Step 3 (create, weigh and price `N1`), K1, C0, B1, and the read-only checks around them. The owner also chose:
- `N1` uses the oldest customer and the oldest active service;
- audit rows are reported in their own category.

G3 and G4 are **not** approved.

**Browser: deviation.** Claude in Chrome was not connected (`list_connected_browsers` returned `[]`). With the owner's approval, the plan's fallback was used: the Playwright MCP plugin's own headed Chrome, profile `~/.cache/ms-playwright-mcp/mcp-chrome-2a5aa8f`, kept separate from the owner's Chrome.

**Credential incident.** That profile autofilled a saved `localhost:3001` login, and the first page snapshot captured the password. Actions taken:
- the snapshot was deleted;
- the field was cleared;
- the owner approved R2, deleting that saved login (only the three `localhost:3999` logins remain), and R4, deleting the 18 older snapshots that held a password value;
- the owner chose to leave the inactive profile and the transcripts as they are, and not to rotate the password (local dev environment).

The owner then signed in by hand.

**Sign-in check.** `currentAdmin` returned id `f057eca8-…`, `TENANT_OWNER`, `TENANT`, tenant `b0075a4e-…0001`.

**Before snapshot (Task 2 Step 0).**
- First run: `t0=2026-11-14 00:49:57.348729+00`, pid 6160, snapshot `379906:379906:`. The browser was unavailable at that point, so it was kept in `first-run/` and **re-run** before the first write.
- Re-run: `t0=2026-11-14 01:30:50.168497+00`, pid 9910, snapshot `379907:379907:`, `repeatable read`, read-only `on`. `t0_check` and `snapshot_check` match, and `owner_rows=1`.
- S1, S2 and S3 are identical to the first run. S2 is empty.
- Extra baselines are identical except one audit row, `admin.login.succeeded` at 01:28:14, from the owner's sign-in.
- `T0` = `2026-11-14 01:30:50.168497+00`.

**`P1`.** S3 = the first qualifying S1 row = order `335c8ab3-82f6-487a-9b71-b1fb2b549017`, invoice `df407dad-16d8-452a-ba12-6422b05d3e51` `INV-2026-000480`, order `createdAt` `2026-11-02 09:40:05.645697+00`, `T = 2000`.
- The order page and the drawer both showed Total ₱20.00, Amount paid ₱0.00, Unpaid.
- `A1 = 500`, `A2 = 400`.

**`N1` (Task 2 Step 3).**
- Customer `f03d4a49-54f6-4d56-bb1d-268ccf0673e6`, the oldest customer. All 5 customers display as "Race Jane 555-0", so the option was chosen by its position in the search response (sorted by `fullName`, then `id`). The order's `customerId` was then checked.
- Fulfillment: the default, Customer pickup (the plan does not specify one).
- Weight 2.09 kg (one bag, `weightGrams` 2090).
- Service `e3a2aff9-073d-43be-b9c7-24cd4b5a50f1`, the oldest active service, ₱10.00 per kg.
- Displayed estimate ₱20.90. After Confirm price: line `71196d1b-…`, `unitPrice` 1000, quantity 2090, line total 2090.
- Order `2584f08d-d7e8-4e9a-9b80-34e2a678c0c1`, `PRICED`, no invoice.

**Task 3 (1280×800 and 375×812).** Evidence: `.superpowers/sdd/2026-11-03-laundry-invoice-payment-browser-check-plan/evidence/`, in this worktree.

| Row | Result | Evidence and notes |
| --- | --- | --- |
| L1 | **Pass** | `L1-1280-N1-generate.png`. The cards sit side by side (both at top 297). All three terms show their help text. `scrollWidth` 1265 = `clientWidth` 1265. No control outside the viewport. |
| L2 | **Pass** | `L2-375-N1-generate.png`. The cards are stacked. 360 = 360. No control cut off. Generate is at x 41–174. |
| K1 | **Pass** | Each radio's accessible description is its help text. Tab from the Invoice heading lands on the checked option, Pay on completion, and `:focus-visible` is true. ArrowUp selects Pay now; ArrowDown twice selects Pay on delivery. Clicking the "Pay now" label selects it. Space selects. The accessibility tree shows `radio "Pay on delivery" [checked]` before Generate. Tab reaches Generate (focus visible), and Enter shows "Invoice generated.". After reload the card shows Pay on delivery, and `invoice_entity."paymentTerms"` = `PAY_ON_DELIVERY`. *Deviation:* a radio group's arrow keys change the selection, so for the Space test focus was moved onto the unchecked radio with `element.focus()` (no state change) before pressing Space. |
| L3 | **Pass** | `L3-1280-N1-invoice.png`. Shows number, ₱20.90, Unpaid, Pay on delivery, Open invoice and the payments panel. 1265 = 1265. |
| L4 | **Pass** | `L4-375-N1-invoice.png`. 360 = 360. All controls are inside the viewport, including Record payment (x 41–171). |
| O1 | **Pass** | `O1-1280-N1-open-invoice.png`. Opens `/app/billing?detail=9842a3ee-07ba-4be6-b306-d019c0bba8aa`, drawer `INV-2026-000485`, Total ₱20.90. *Observation:* the drawer shows terms as the raw value `PAY_ON_DELIVERY` (and `PAY_NOW` for `P1`), while the order page shows the friendly label. |

**`N1`'s invoice.** `9842a3ee-07ba-4be6-b306-d019c0bba8aa`, `INV-2026-000485`, `PAY_ON_DELIVERY`, `UNPAID`, total 2090, 1 invoice line. Invoice counter 484 → 485.

**Task 4 (`P1`, 1280×800 unless stated).**

| Row | Result | Evidence and notes |
| --- | --- | --- |
| C0 | **Pass** | `C0-1280-P1-after-two-payments.png`. Both payments were made with the method chosen explicitly and the pre-filled amount replaced (pre-filled ₱20.00, then ₱15.00). `2ffa762c-93c5-4cf8-9a57-ff12df55d369`: PAYMENT CASH 500 `QA209-C0-1`. `3f90976c-955f-43aa-a942-27a8cf88f4e4`: PAYMENT GCASH 400 `QA209-C0-2`. Partially paid; paid ₱9.00, due ₱11.00 (database: `PARTIALLY_PAID`, 900). Each row has a Refund button. |
| A1 | Recorded | `A1-1280-P1-record-no-method.png`. The browser's bubble "Please select an item in the list." appears (`validationMessage`, `:invalid`). The inline "Choose how the money moved." does **not** appear. **No request:** the GraphQL list stays at #288. |
| A2 | Recorded | `A2-1280-P1-refund-no-method.png`. Same as A1 for Refund: native bubble only, no inline message, no request. |
| C1 | **Fail** (expected) | Accessibility tree: both Refund buttons are named "Refund payment" and cannot be told apart. This is the known issue. |
| B1 | Recorded | `X` = `2ffa762c-…`. **1.** Tab A: Refund on `X`, Cash, ₱5.00 pre-filled, not submitted. **2.** Tab B: full refund with Cash `QA209-B1-tabB`. `refundInvoicePayment` (#52) returned refund `25f9a405-716e-4fa7-a8ea-22ff00923f73`, `refundedPaymentId` = `X`, invoice paid 400, due 1600, `PARTIALLY_PAID`. The toast had gone by the time it was checked; the network response is the evidence. **3.** Tab A submitted: exactly one request (#289) reached the server and was rejected (`BAD_REQUEST`): "This refund is more than the payment's refundable amount of ₱0.00." The dialog stayed open with that error (`B1-step3-tabA-server-error.png`). Nothing was written (still 3 payment rows). **4.** Tab A blanked the amount and submitted: **no request** (list stays at #289). The native "Please fill out this field." appears, and **the earlier server error stays visible beside it** (`B1-step4-tabA-stale-error.png`). **5.** Check (b) answer: yes, the stale server error persists. |
| D1 | Recorded; **owner's verdict pending** | `D1-1280-P1-billing-drawer.png`, `D1-375-P1-billing-drawer.png`. Total ₱20.00, Amount paid ₱4.00, Amount due ₱16.00 and the Partially paid badge appear in **both** the amount block and the Payments panel just below it. The history table scrolls sideways inside the drawer: at 375 it is 889 px of content in a 312 px box, and the remaining Refund button starts off-screen at x 783. My reading: the repetition is noticeable at both widths, and at 375 it pushes the history further down. The owner decides whether it is a problem. |
| L5 (375×812) | **Pass** | `L5-375-P1-history.png`. 360 = 360. The history table is `overflow-x: auto` (889 px of content in a 278 px box). The remaining Refund button (GCash row) scrolls into view on keyboard focus (x 189–311). The refund row shows `−₱5.00`. The fully refunded Cash row has no Refund button. |

*Observation:* the API's error responses include a server stack trace. Compose runs it with `NODE_ENV=development`. This is outside #209's scope.

**After snapshot (Task 5 Step 1 procedure, own transaction).**
- `t0=2026-11-14 01:37:31.964718+00`, pid 10658, snapshot `379915:379915:`, `repeatable read`, read-only `on`. The end checks match, and `owner_rows=1`.
- S1 differs from the before snapshot only in:
  - `P1`: `UNPAID|0|…|0` → `PARTIALLY_PAID|400|2000|3`;
  - one new row, `N1` `2584f08d-…` `PRICED` / `INV-2026-000485` `UNPAID|0|2090|0`.
- S2 differs only by the 3 rows above.
- **The difference equals the ledger exactly.**

**Accounting, in three separate categories.**
- **Domain rows** (before → after): admins 3→3, tenants 1→1, orders 5→6, order lines 5→6, invoices 5→6, invoice lines 5→6, payments 0→3, customers 5→5, services 5→5, pricing rules 5→5.
- **Audit rows:** 1 → 8 after the sign-in (0 at the first baseline). All 7 new rows are by the owner in the Bootstrap tenant:
  - `laundry_order.received`, `laundry_order.weighed`, `laundry_order.priced` on `N1`;
  - `invoice.generated` on `9842a3ee…`;
  - `payment.recorded` × 2 on `2ffa762c…` and `3f90976c…`;
  - `payment.refunded` on `25f9a405…`.

  The rejected attempt and the blocked submissions wrote no audit row.
- **Invoice counter:** 484 → 485.
- **Unrelated rows:** recomputed without `N1`'s rows and `P1`'s invoice, the fingerprints are unchanged (`55534fcc…`, `1fd495f1…`, `cec5d9bb…`, `146baa43…`). Customers, services, pricing rules, admins and tenants are unchanged. `P1`'s number, total and terms are unchanged.

**Test data left in `clensy`.** Nothing was deleted or cleaned up.
- `N1` `2584f08d-d7e8-4e9a-9b80-34e2a678c0c1` and its line `71196d1b-…`;
- invoice `9842a3ee-07ba-4be6-b306-d019c0bba8aa` `INV-2026-000485` and its line;
- payments `2ffa762c-…` (`QA209-C0-1`), `3f90976c-…` (`QA209-C0-2`) and refund `25f9a405-…` (`QA209-B1-tabB`) on `INV-2026-000480`;
- 7 audit rows, plus 1 login audit row.

**Defect candidates (G4 not approved; none filed):**
1. the stale server error persists beside new validation (B1);
2. the Refund buttons have identical accessible names (C1);
3. the billing drawer shows payment terms as raw values;
4. D1's repeated figures (pending the owner's verdict).

**Status: G2 complete.** Next: Task 5 (the M6 Slice Completion Report). G3 (commits, push, PR) and G4 (issues) need separate approval.

### Owner's D1 verdict and G4 (2026-11-14)

**D1 verdict (owner).** The duplicated Total, Amount paid, Amount due and status in the billing drawer **is a UI defect**. The history table scrolling sideways at 375 px is **acceptable**, given the L5 keyboard result, and is not a defect.

**G4: approved by the owner on 2026-11-14 and executed.** Each create ran on the same command line as the Context Forge configuration check (`unchanged`). They were created as `rexescario` in `rexescario-dev/clensy-platform`. The URLs come from `gh issue view --json url`.

| Finding | Issue |
| --- | --- |
| B1: stale server error stays after the next validation failure | [#231](https://github.com/rexescario-dev/clensy-platform/issues/231) |
| C1: Refund buttons have identical accessible names | [#232](https://github.com/rexescario-dev/clensy-platform/issues/232) |
| O1 observation: billing drawer shows raw payment terms | [#233](https://github.com/rexescario-dev/clensy-platform/issues/233) |
| D1: billing drawer repeats Total, Paid, Due and Status. Needs an accepted #39 spec §4.10 amendment through M2/M3 before implementation | [#234](https://github.com/rexescario-dev/clensy-platform/issues/234) |

**Not filed, by the owner's decision:**
- **A1/A2:** the native bubble is the expected result, per the owner's #209 comment ("expected, since the select keeps native `required`").
- **API stack traces in error responses:** these are development-only. `apps/api/src` sets neither `includeStacktraceInErrorResponses` nor `formatError`, so Apollo includes stack traces whenever `NODE_ENV` is not `production`. The `Dockerfile` defaults to `production`; only `docker-compose.yml` sets `development`. This is recorded as a possible hardening item for the separate N6 security follow-up.<br>*Update (M7, 2026-11-14): at the owner's request, filed separately as [#236](https://github.com/rexescario-dev/clensy-platform/issues/236) (low severity, hardening, not a release blocker), apart from #226.*

### Task 5 (2026-11-14)

- **Step 1.** The after snapshot was taken and reconciled with the ledger (see the G2 results). The difference equals the ledger exactly. The `c9e449f` build worktree `$SRC` was clean (no tracked, untracked or ignored files) and has been removed (`git worktree remove`). The running `api` and `web` containers are unaffected: they still run `b8d74fa2…` and `963e0bde…`.
- **Step 2.** Proposals went to the owner, who approved them under G4: issues [#231](https://github.com/rexescario-dev/clensy-platform/issues/231), [#232](https://github.com/rexescario-dev/clensy-platform/issues/232) (C1, the known candidate), [#233](https://github.com/rexescario-dev/clensy-platform/issues/233) and [#234](https://github.com/rexescario-dev/clensy-platform/issues/234).
- **Step 3.** **Deferred to closeout.** The #209 results comment is part of the owner-authorized closeout edits, and the plan lets it wait for closeout. The owner's instruction for this step did not include it.
- **Step 4.** Report below. Its figures were re-checked on 2026-11-14 against the evidence files (`before-extra.txt`, `before-extra.rerun.txt`, `after-extra.txt`, `before-S1/S2`, `after-S1/S2`) and against a read-only query of the live database, which equals the after snapshot.
- **Step 5 (G3).** Approved by the owner on 2026-11-14. The commit, push and PR follow this record.

## Slice Completion Report

| Field | Result |
| --- | --- |
| Slice | #209 laundry invoice and payment browser check |
| Tracking | [#209](https://github.com/rexescario-dev/clensy-platform/issues/209) |
| M4 | Plan **Accepted** (revision 5; Task 1 Steps 4–5 at revision 6a; revision 6b is redaction only) |
| M5 | Review **Accepted** (revision 5, by the owner; revision 6 returned and 6a accepted, both by fresh independent reviewers; 6b redaction reviewed separately) |
| M6 | **Complete** |
| M7 | Pending (docs-only slice: self-review permitted by `CLAUDE.md`, and must be labelled so) |
| M8 | Pending |
| M9 | Pending |
| Branch | `docs/209-invoice-payment-browser-check` |
| PR | Opened from this branch at G3. The link is recorded at M7 and in the #209 closeout |
| Status | **Ready for M7** |

### Shipped

- **Task 1:** `api` and `web` were rebuilt from `c9e449f` and run with the API's configuration bind-mounted read-only. Every check passed: revision labels, image identity, `migrate` untouched, migrations 30 / `1791043200000`, payment schema and enum, introspection, no `JWT_SECRET` in the container's configuration or the image.
- **#166 checks:**
  - **Pass:** L1, L2 (375 and 1280, generate form), K1 (keyboard radio group; chosen, displayed and stored terms agree on `PAY_ON_DELIVERY`), L3, L4, O1.
- **#39 checks:**
  - **C0 (setup): Pass.**
  - **(a) A1, A2:** the browser's own bubble only; no request sent.
  - **(b) B1:** the stale server error persists (#231).
  - **(c) C1: Fail**, identical Refund names (#232).
  - **(d) D1:** the owner judged it a UI defect (#234; needs a §4.10 amendment).
  - **L5: Pass.**
  - **Extra finding:** the billing drawer shows raw payment terms (#233).
- **Data accounting, before → after:**
  - Domain rows: orders 5→6, order lines 5→6, invoices 5→6, invoice lines 5→6, payments 0→3. Admins, tenants, customers, services and pricing rules are unchanged.
  - Audit rows: 0 → 1 (the owner's sign-in) → 8 (7 for the approved writes).
  - Invoice counter: 484 → 485.
  - Fingerprints of pre-existing rows are unchanged.
- **Test data kept in `clensy`:**
  - `N1` `2584f08d-…` and `INV-2026-000485`;
  - payments `QA209-C0-1` and `QA209-C0-2`, and refund `QA209-B1-tabB`, on `INV-2026-000480`.

  Nothing was cleaned up; removing them is the owner's choice.
- **Deviations, recorded above:**
  - the browser was the Playwright MCP Chrome, not Claude in Chrome;
  - a saved-password exposure, remediated by R2 and R4 (R1 skipped by the owner);
  - the before snapshot was re-run before the first write;
  - focus was moved in code for the K1 Space test.
- **Follow-ups outside this slice:**
  - **N6:** `.dockerignore` and the old image layer holding `JWT_SECRET` (tracked by [#226](https://github.com/rexescario-dev/clensy-platform/issues/226)), plus optionally turning stack traces off explicitly (now [#236](https://github.com/rexescario-dev/clensy-platform/issues/236));
  - the #209 results comment at closeout;
  - removing the untracked revision 5 copy of this plan from the main checkout after merge.

### Validation

| Check | Result |
| --- | --- |
| Tests | N/A (no code changed) |
| Typecheck | N/A |
| Lint | N/A |
| Build | N/A (images were rebuilt from `c9e449f` as M6 Task 1, not as validation) |
| Package validation | N/A |

The browser rows above are this slice's evidence.

### Next Gate

**M7 — Code Review**

## Code review (M7): self-review

**Self-review.** The M6 implementer reviewed this change; it is **not** an independent review. `CLAUDE.md` permits a self-review for a docs-only slice, and the owner did not ask for a fresh reviewer. Date: 2026-11-14.

```text
Decision: Approved for merge (self-review)
Subject: PR #235 (https://github.com/rexescario-dev/clensy-platform/pull/235), docs/209-invoice-payment-browser-check at f0dd694 -> main at 7585658; OPEN, not draft, not merged, MERGEABLE
Accepted specification: docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md (§8.4.4, Amendment #164); docs/superpowers/specs/2026-11-02-laundry-payments-design.md (§4.10)
Accepted implementation plan: this plan (revision 5; Task 1 Steps 4-5 at revision 6a; revision 6b redaction)

Diff reviewed: git diff origin/main...f0dd694 = 1 file, +801/-0, this plan only; commits c96c7ac, fc42c5d, f0dd694

Plan tasks reviewed:
- Task 1 (rebuild from c9e449f, revision 6a mount): ✓
- Task 2 (before snapshot, re-run; P1; N1 created, weighed, priced): ✓
- Task 3 (L1, L2, K1, L3, L4, O1): ✓
- Task 4 (C0, A1, A2, C1, B1, D1, L5): ✓
- Task 5 Step 1 (after snapshot, worktree removed, M6 record): ✓
- Task 5 Step 2 (G4 issues #231-#234): ✓
- Task 5 Step 3 (#209 results comment): deferred to closeout, as Step 3 permits
- Task 5 Step 4 (Slice Completion Report): ✓
- Task 5 Step 5 (G3 commit, push, PR #235): ✓

Verification evidence:
- Configuration guard: sha256 of the Context Forge project.yaml = c4088e11...c99b (OK) before reading the PR
- git rev-parse: HEAD = origin branch = PR headRefOid = f0dd694; origin/main = 7585658; worktree clean
- gh pr view 235: state OPEN, isDraft false, mergedAt null, base main, one file
- gh issue view 231-234: all OPEN; titles match the G4 table; URLs match the links in this plan and the PR body
- Branch history scan (git log -p origin/main..HEAD): 0 home or session paths (the single "/home/" hit is the
  quoted grep in the revision 6b review); 0 token or private-key patterns; no secret assignment;
  the only e-mail address is the dev account owner@clensy.local; no password value
- Commit messages: 0 Co-Authored-By or "Generated with" lines
- Evidence: all 13 screenshots cited in this plan exist in the gitignored evidence folder, and every file there is cited;
  git ls-files .superpowers = 0
- Text evidence (209-ev): before-extra, before-extra.rerun, after-extra and after-unrelated equal the figures in the
  M6 record: domain 3|1|5|5|5|5|0|5|5|5 -> 3|1|6|6|6|6|3|5|5|5; audit 0 -> 1 -> 8 with the 7 action rows listed;
  counter 484 -> 485; four unrelated-row fingerprints unchanged
- Live database, read-only transaction: admins 3, tenants 1, orders 6, invoices 6, payments 3, migrations 30,
  newest 1791043200000 = the after snapshot
- #209 owner comment: (a) names the native bubble as expected, which matches the A1/A2 treatment
- PR body: results table, deviations, kept test data and issue list match this plan; no credential value

Review summary: The change set is the plan and its records, nothing else. Every Task 1-5 step is covered or
explicitly deferred as the plan allows. Results, counts, ids, issue links, the D1 verdict, the A1/A2 and
stack-trace dispositions, and the browser and credential deviations are recorded accurately and traceably.
No secret or local path is published.

Blocking findings: None (no merge blockers)

Non-blocking observations:
1. M6 record, "Gate approvals" table: the row "G2, G3, G4 | Not approved" was true when Task 1 was recorded,
   but later sections record all three as approved. Read alone, it contradicts them. (Annotated at M9.)
2. Header "Status" row: it still reads as before M6 ("Until revision 6 is Accepted, M6 does not go past
   Task 1 Step 2") and gives no delivery state. (Updated at M9.)
3. The Task 3/4 D1 row ("owner's verdict pending") and "Defect candidates (G4 not approved; none filed)" are
   point-in-time; "Owner's D1 verdict and G4" supersedes them. Acceptable as a chronological record.
4. The task checkboxes stay unticked although the steps ran. The M6 record is the record of completion.
5. The text evidence lives in a session scratchpad and the screenshots are gitignored, so outside this machine
   the record rests on the figures quoted in this plan. The plan says so ("That location is session-local").
6. Traceability: the plan, the PR body and the handoff called N6 a "separate follow-up" without citing #226,
   which was filed on 2026-11-03 and tracks the JWT secret/runtime configuration problem; revision 6a's
   statement "no issue is filed" was wrong. The read-only bind mount was a local workaround, not a fix.
   Corrected with dated notes where N6 appears. The stack-trace item is filed separately as #236, and the
   old image is recorded on #226. The accepted technical decision is unchanged.
(These do not affect the merge decision.)

Gate: Merge per human/project norms. M8/M9 may follow.
```

**Limits of this review.** It is a self-review: the same agent ran M6 and reviewed it. It checks the record against the evidence; it does not re-run the browser checks. Items that need separate owner decisions and are not part of this review: N6 (fixing [#226](https://github.com/rexescario-dev/clensy-platform/issues/226) and [#236](https://github.com/rexescario-dev/clensy-platform/issues/236); removing the old image `97833f0c7104` and rotating the local `JWT_SECRET`), removing the kept test data, rolling back the images, and the closeout edits to #209.

**No prohibited action.** This review changed no container, image, database row, test data or evidence file; it posted nothing to GitHub and did not merge.

## Refactoring (M8)

```text
Decision: N/A
Subject: PR #235, docs/209-invoice-payment-browser-check
Scope:
- docs/superpowers/plans/2026-11-03-laundry-invoice-payment-browser-check-plan.md (the only changed file)
Accepted specification: as cited at M7
Accepted implementation plan: this plan
M7 / authorization: Approved for merge (self-review), 2026-11-14
Maintainability goals:
- None. The slice changes no code, so there is nothing to refactor; the plan's own consistency is M9's job.
Verification:
Before: N/A
After: N/A (not run)
Externally observable behavior changes: None
Gate: N/A — proceed to M9.
```

## Documentation (M9)

```text
Decision: Complete
Subject: #209 laundry invoice and payment browser check, PR #235 (M7-approved by self-review, not merged)
Accepted specification: as cited at M7
Accepted implementation plan: this plan
M7: Approved for merge (self-review)
M8: N/A

Documentation scope:
- this plan (Status row; Gate approvals annotation; M7, M8, M9 and M10 records)
- docs/superpowers/README.md (plan count)
Inventoried and left unchanged:
- docs/history/shipped-slices.md: holds notes for slices that changed the API's behavior; #209 changes none
- docs/features/laundry.md (#payments-and-refunds-39): describes behavior, which #209 does not change;
  the defects found are tracked in #231-#234 and belong to the slices that fix them
- the two specs: Accepted; not edited (the #234 amendment goes through M2/M3)

Updated artifacts:
- this plan, Status row: adds the delivery state <- M6 Complete, M7 Approved, M8 N/A, M9 Complete, M10 n/a
- this plan, Gate approvals: notes where G2, G3 and G4 were approved later <- M7 observation 1
- this plan, N6 mentions: dated #226 / #236 traceability notes <- M7 observation 6
- docs/superpowers/README.md: plan count 79 -> 80 (79 on main, plus this plan) <- this plan

Editorial changes:
- Gate approvals annotation (consistency; the original wording is kept)
Content updates:
- Status row; plan count; these records

Verification:
- Links checked: every in-plan anchor and relative .md link resolves (script check); the three links to
  #snapshot-procedure-revision-5 target a heading indented inside a list item, which GitHub still anchors
- Heading hierarchy checked: new sections are ## with ### beneath. One pre-existing skip (#### under ## at
  "The approved active TENANT_OWNER account") is Accepted revision 5 content and is left unchanged
- Status consistency checked: plan Accepted; M7 Approved (self-review); PR #235 open, not merged
- Cross-references checked: #231-#234 and PR #235 links match gh output
- Terminology checked: row ids, P1/N1 and gate names as defined in this plan
- Duplicates / outdated refs checked: observations 1, 2 and 6 resolved; 3 and 4 kept as chronology

Gate: Documentation complete. Code, behavior and contracts unchanged by this stage.
```

## Workflow validation (M10)

**Not applicable.** M10 applies only when a slice changes workflow assets (process spec §2.12, step 1). `git diff --name-only origin/main...HEAD` lists only this plan and `docs/superpowers/README.md`; nothing under `docs/workflows/`, `docs/conventions/`, `docs/skills/` or `.claude/`, and no `workflow.yaml`.

## Slice Completion Report (M9)

| Field | Result |
| --- | --- |
| Slice | #209 laundry invoice and payment browser check |
| Tracking | [#209](https://github.com/rexescario-dev/clensy-platform/issues/209) |
| M4 | Plan drafted (revisions 1–6b) |
| M5 | Plan **Accepted** (revision 5; 6a for Task 1 Steps 4–5; 6b redaction) |
| M6 | **Complete** |
| M7 | **Approved for merge**, by **self-review** (docs-only, permitted by `CLAUDE.md`) |
| M8 | **N/A** |
| M9 | **Complete** |
| M10 | **Not applicable** |
| Branch | `docs/209-invoice-payment-browser-check` |
| PR | [#235](https://github.com/rexescario-dev/clensy-platform/pull/235), open, not merged |
| Status | **Ready for closeout**, once the owner authorises the merge |

### Validation

| Check | Result |
| --- | --- |
| Tests, Typecheck, Lint, Build | N/A (docs only; no code changed) |
| Docs | Links, headings, status and cross-references checked at M9 |

### Next Gate

**Closeout** (§2.12): an owner-authorised merge of PR #235. Then the [closeout instruction](#closeout-instruction-owner-2026-11-03): the #209 results comment (Task 5 Step 3), ticking both #209 checklists, closing #209 when every box is ticked, and deleting the untracked revision 5 copy of this plan from the main checkout. Separate owner decisions: N6 ([#226](https://github.com/rexescario-dev/clensy-platform/issues/226), [#236](https://github.com/rexescario-dev/clensy-platform/issues/236), the old image and secret rotation), removing the kept test data, rolling back the images.

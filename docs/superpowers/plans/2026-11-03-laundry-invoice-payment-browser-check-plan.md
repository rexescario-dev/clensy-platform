# Laundry Invoice and Payment Browser Check (#209) Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. **Do not start any task until M5 has Accepted this plan and the owner has approved the gate the step needs.**

| Field | Value |
| --- | --- |
| Status | **Accepted (revision 5)** at M5, 2026-11-03 ([M5 decision](#m5-decision)). Drafted at M4 on 2026-11-03. Revision 1 was held by the owner before review with two required changes ([Revision 2 changes](#revision-2-changes)). The M5 review of revision 2 returned two blockers, B1 and B2 ([Revision 3 changes](#revision-3-changes)). The M5 review of revision 3 returned two blockers, B3 and B4, and one evidence note ([Revision 4 changes](#revision-4-changes)). The M5 review of revision 4 returned two blockers, B5 and B6 ([Revision 5 changes](#revision-5-changes)). |
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
- [ ] **Step 4 (G1):** From the repository root: `docker compose up -d --no-deps --no-build --force-recreate api web`. `--no-deps` keeps compose from starting `migrate` or touching `postgres`.
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

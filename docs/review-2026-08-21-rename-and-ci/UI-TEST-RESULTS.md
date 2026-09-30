# UI test results: User Disabler v1.0.0 (post-rename / CI re-test)

Tested: 2026-08-21 · Scope: re-run of the migration acceptance suite after the app rename and CI changes · Suite: `tests/e2e/test_user_disabler.py`

This is a re-test, not a new review. It re-runs the acceptance suite from
`docs/review-2026-07-09-platform-migration/` against the production bundle built from
the current tree, to confirm that renaming the app to `tool-user-disabler` and reworking
the workflows did not regress anything. Findings and root-cause analysis for the app
itself live in the July review; nothing new was found here.

## Instances

| Label     | URL                           | DHIS2 version | Seed                               |
| --------- | ----------------------------- | ------------- | ---------------------------------- |
| 2.41-laos | http://dhis2-agent-ud-41:8080 | 2.41.9.1      | `lao_hmis_demo_v41.sql.gz`         |
| 2.42-sl   | http://dhis2-agent-ud-42:8080 | 2.42.5.2      | `dhis2-db-sierra-leone_v42.sql.gz` |
| 2.43-sl   | http://dhis2-agent-ud-43:8080 | 2.43.1        | `dhis2-db-sierra-leone_v43.sql.gz` |

Patch levels are slightly newer than the July run (2.41.9 / 2.42.5.1 / 2.43.0.1) because
the broker resolves the latest stable of each major. Each version was tested once, and
both demo databases (Laos, Sierra Leone) are covered, as in the original matrix.

The app was installed as the production bundle (`POST /api/apps` with
`build/bundle/tool-user-disabler-1.0.0.zip`) and driven at
`/api/apps/tool-user-disabler/index.html` — i.e. the new app key was exercised end to end,
which is the specific risk the rename introduced. On 2.42/2.43 the app runs inside the
global-shell iframe; the suite is frame-aware.

`admin` is disabled in the Laos seed, so 2.41 ran as the broker's `local_admin`
superuser; 2.42/2.43 ran as `admin`.

## Results

15/15 steps passed on all three versions.

| Step                                       | 2.41 (Laos)   | 2.42 (SL)                | 2.43 (SL)                |
| ------------------------------------------ | ------------- | ------------------------ | ------------------------ |
| App loads, table renders                   | PASS          | PASS                     | PASS                     |
| Default filter (6 months) matches API      | PASS (42)     | PASS (24)                | PASS (23)                |
| Apply with unchanged filter refetches      | PASS          | PASS                     | PASS                     |
| Never-logged-in merge + dedupe matches API | PASS (44)     | PASS (130)               | PASS (129)               |
| Search narrows results                     | PASS          | PASS                     | PASS                     |
| Sort by username                           | PASS          | PASS                     | PASS                     |
| Info modal shows user details              | PASS          | PASS                     | PASS                     |
| Single disable via row button              | PASS          | PASS                     | PASS                     |
| Disabled row: tag + unselectable checkbox  | PASS          | PASS                     | PASS                     |
| Bulk disable (confirm→progress→summary)    | PASS (2/2 ok) | PASS (1/2, 1 server 409) | PASS (1/2, 1 server 409) |
| Selection retained only for failed users   | PASS          | PASS                     | PASS                     |
| Create scheduler job (defaults)            | PASS          | PASS                     | PASS                     |
| Toggle job off via switch                  | PASS          | PASS                     | PASS                     |
| Job deleted (suite cleanup)                | PASS          | PASS                     | PASS                     |
| No unexpected console/page errors          | PASS          | PASS                     | PASS                     |

All counts were cross-checked against independent direct API queries. Per-run
machine-readable results are in `screenshots/<label>-results.json`; `<label>-01-loaded.png`
shows the renamed app ("User Disabler Tool") loading on each version.

## Version-specific behaviour

Unchanged from July: on the 2.42/2.43 Sierra Leone seed, `POST /api/users/{id}/disabled`
returns `409 E1004` for some demo users (e.g. `arabic`) even for the superuser. This is
server behaviour, not an app defect — the app surfaces the per-user failure in the bulk
summary and keeps the rejected user selected so the admin can retry, which the suite
asserts.

## Suite changes made during this run

Two changes to `tests/e2e/test_user_disabler.py`, both test-side:

1. **The app key is now a parameter** (`APP_KEY`, default `tool-user-disabler`). The suite
   previously hardcoded `user-disabler` in three places, so it could not have passed
   against the renamed build at all.
2. **The "create scheduler job" step now polls for the job** instead of waiting a fixed
   2500 ms. On the first 2.41 run that fixed wait expired before the POST landed, giving a
   false FAIL — the app had created the job correctly (confirmed via `created`/
   `lastUpdatedBy` on the job: created during the run, matching the modal defaults).
   Because the step's cleanup sat inside its success branch, the false negative also
   orphaned the job it had created; cleanup now runs unconditionally and removes every
   `DISABLE_INACTIVE_USERS` job the run introduced.

No app code was changed for this re-test.

## State changes

All three instances were broker-created `agent-*` instances, disposable and mutated
freely (users disabled, jobs created and deleted). `agent-ud-41` and `agent-ud-42` were
deleted after their runs. **`agent-ud-43` (2.43.1) was left running** at the user's
request for manual validation. Its post-run state, verified via the API: the app is
installed, two users are disabled (`alinana`, `arabicB`), and no
`DISABLE_INACTIVE_USERS` job remains — the suite cleaned up after itself.

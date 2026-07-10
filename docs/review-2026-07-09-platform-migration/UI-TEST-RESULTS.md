# UI test results: User Disabler v1.0.0

Tested: 2026-07-09 · App installed as production bundle (`POST /api/apps`, driven at `/api/apps/user-disabler/index.html`) · Suite: `tests/e2e/test_user_disabler.py` (Playwright, frame-aware for the 2.42+ global shell)

## Instances

| Label     | URL                            | DHIS2 version | Source                                          |
| --------- | ------------------------------ | ------------- | ----------------------------------------------- |
| 2.41-laos | http://dhis2-agent-ud-41b:8080 | 2.41.9        | broker, seed `lao_hmis_demo_v41.sql.gz`         |
| 2.42-sl   | http://dhis2-agent-ud-42:8080  | 2.42.5.1      | broker, seed `dhis2-db-sierra-leone_v42.sql.gz` |
| 2.43-sl   | http://dhis2-agent-ud-43:8080  | 2.43.0.1      | broker, seed `dhis2-db-sierra-leone_v43.sql.gz` |

Per the request, each DHIS2 version was tested once and each database (Sierra Leone, Laos) at least once. Results below are from the **final build** (all review findings fixed). All counts were cross-checked against independent direct API queries.

## Results

| Step                                       | 2.41 (Laos)   | 2.42 (SL)                                | 2.43 (SL)                                      | Notes                                                            |
| ------------------------------------------ | ------------- | ---------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| App loads, table renders                   | PASS          | PASS                                     | PASS                                           | 2.42/2.43 inside global-shell iframe                             |
| Default filter (6 months) matches API      | PASS (37)     | PASS (24)                                | PASS (23)                                      |                                                                  |
| Apply with unchanged filter refetches      | PASS          | PASS                                     | PASS                                           | Regression test for finding H1                                   |
| Never-logged-in merge + dedupe matches API | PASS (43)     | PASS (129)                               | PASS (130)                                     | Two-query union, de-duplicated                                   |
| Search narrows results                     | PASS          | PASS                                     | PASS                                           |                                                                  |
| Sort by username                           | PASS          | PASS                                     | PASS                                           |                                                                  |
| Info modal shows user details              | PASS          | PASS                                     | PASS                                           | Roles, groups, org units                                         |
| Single disable via row button              | PASS          | PASS\*                                   | PASS                                           | \*server rejected with 409 E1004; app correctly showed the error |
| Disabled row: tag + unselectable checkbox  | PASS          | SKIPPED\*                                | PASS                                           | \*no user disabled in that run                                   |
| Bulk disable (confirm→progress→summary)    | PASS (2/2 ok) | PASS (0/2, both 409, correctly reported) | PASS (1/2 ok, mixed result correctly reported) | Summary always matched actual API state                          |
| Selection retained only for failed users   | PASS          | PASS                                     | PASS                                           |                                                                  |
| Create scheduler job (defaults)            | PASS          | PASS                                     | PASS                                           | Verified via API incl. jobParameters                             |
| Toggle job off via switch                  | PASS          | PASS                                     | PASS                                           | Verified via API                                                 |
| Job deleted (suite cleanup)                | PASS          | PASS                                     | PASS                                           |                                                                  |
| No unexpected console/page errors          | PASS          | PASS                                     | PASS                                           | See hygiene below                                                |

An earlier 2.42 run (pre-fix build) additionally confirmed the happy-path disable on 2.42 (`alinana`, `arabicB` successfully disabled and verified via API).

## Version-specific failures

None in the app. One version-specific **server** behavior observed: on 2.42/2.43 Sierra Leone demo data, `POST /api/users/{id}/disabled` returns `409 E1004` ("You must have permissions to create user, or ability to manage at least one user group for the user") for some users (e.g. `arabic`) even for the superuser — and the old app's full-object `PUT` fails identically, so this is not a regression. Notably, the server's own `access.update` and `canManage=true` both claim the actor may manage users that the disable endpoint then rejects. The app surfaces these failures per-user in the bulk summary (screenshot `2.42-sl-05-bulk-summary.png`).

## Console/network hygiene

No app-caused console errors, page errors, or failed requests on any version. Environmental noise excluded from the assertion (not app defects): the PWA "not a secure context" warning (instances served over plain HTTP) and a 404 for `/api/41/staticContent/logo_banner` on the Laos instance (no custom logo configured).

## Screenshots

In `screenshots/`, prefixed by label (`2.41-laos-`, `2.42-sl-`, `2.43-sl-`): `01-loaded`, `02-never-logged-in`, `03-info-modal`, `04-single-disable-summary`, `05-bulk-summary`, `06-job-created`, `07-final`, plus `probe-41.png` from the initial smoke probe. Per-run machine-readable results in `<label>-results.json`.

> [!WARNING]
> This suite creates, disables and deletes users, and installs and uninstalls the app. Run it only against a throwaway DHIS2 instance that you can reset or recreate. Never run it against a production, shared or play server.

# End-to-end tests

The suite installs the built app on a DHIS2 instance, drives it in Chromium, and checks every change against the Web API. It follows contract version 1 of the `e2e/run.sh` contract in [reference-tool-conventions](https://github.com/dhis2-utils/reference-tool-conventions/blob/main/TESTING.md).

## Get a throwaway instance

Follow [DHIS2 in Docker](https://developers.dhis2.org/docs/tutorials/dhis2-docker/) on the developer portal. An empty database is enough: the suite seeds the users it needs. A demo database also works.

## Run the suite

You need Python 3 and Playwright for Python:

```bash
pip install -r e2e/requirements.txt
python3 -m playwright install chromium
```

Build the app, then run the suite against your local instance:

```bash
pnpm run build
mkdir -p /tmp/e2e-results
DHIS2_URL=http://localhost:8080 DHIS2_USER=admin DHIS2_PASS=district \
APP_ZIP="$PWD/build/bundle/tool-user-disabler-1.0.0.zip" \
RESULTS_DIR=/tmp/e2e-results \
  e2e/run.sh
```

| Variable                   | Required | Meaning                                                            |
| -------------------------- | -------- | ------------------------------------------------------------------ |
| `DHIS2_URL`                | yes      | Instance base URL, no trailing slash                               |
| `DHIS2_USER`, `DHIS2_PASS` | yes      | A user with the `ALL` authority. There is no default.              |
| `APP_ZIP`                  | yes      | Absolute path of the built bundle                                  |
| `RESULTS_DIR`              | yes      | Existing directory for `results.json` and screenshots              |
| `LABEL`                    | no       | Label for output and screenshot names; default: the server version |
| `APP_KEY`                  | no       | Default: the key the server gives the installed app                |

The exit code is `0` when every test passed, `1` when a test failed, and `2` when the suite could not run. `results.json` lists each test by a stable id.

## What a run changes

A run names everything it creates after itself, such as `E2E tool-user-disabler 20261023T074036 main role`, and usernames that start with `e2eud20261023t074036`. It creates:

- two user roles and one user group, with no authorities;
- seven users: three that last logged in two years ago, one that logged in ten days ago, two that never logged in, and one that is already disabled;
- one job of the type **Disable inactive users**, if the instance has none.

Before it creates an object, the suite records it in the dataStore at `e2e-state/tool-user-disabler`. At the end of a run it deletes everything in the record, then the record, and uninstalls the app. If a run is killed, the next run deletes what the record still lists before it starts.

The suite disables three of its own users. It does not change any other user. When the instance already has a job of this type, the two job tests are skipped and the job is not changed.

## Tests

| Id                                  | Checks                                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| `app-loads`                         | The app opens and shows the user table (top level on 2.41, in the global shell on 2.42 and later). |
| `default-filter`                    | The default filter (inactive for 6 months) shows the same number of users as the API.              |
| `apply-refetches`                   | **Apply filter** fetches again even when the filter did not change.                                |
| `never-logged-in`                   | Users who never logged in are added, without duplicates.                                           |
| `select-all-respects-search`        | The header checkbox chooses only the rows that match the search.                                   |
| `sort-by-username`                  | Sorting by username works in both directions.                                                      |
| `filter-by-role`, `filter-by-group` | The role and group filters show only matching users.                                               |
| `since-date`                        | The **Since date** filter includes recently active users.                                          |
| `current-user-protected`            | You cannot choose or disable your own account.                                                     |
| `include-disabled`                  | Disabled users are shown with a tag and cannot be selected.                                        |
| `info-modal`                        | **Info** shows the user's roles and groups.                                                        |
| `disable-single`, `disable-bulk`    | Disabling works, the summary is right, and the API shows the users disabled.                       |
| `others-untouched`                  | Users that were not chosen stay enabled.                                                           |
| `job-form-validation`               | The job form rejects values outside the server's ranges.                                           |
| `job-create`, `job-toggle`          | The app creates the job with its defaults and can switch it off.                                   |
| `no-console-errors`                 | The browser console shows no errors from the app.                                                  |

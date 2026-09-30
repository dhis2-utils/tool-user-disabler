# State changes: User Disabler review, 2026-07-09

Every persistent change made during this review, and its disposition.

## Project files

The migration itself rewrote the repository (old webpack/jQuery sources removed, App Platform sources added) — that is the deliverable, not reviewed state. Review-specific artefacts:

| File                                         | Change                                                                                     | Disposition  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------ |
| `tests/e2e/test_user_disabler.py`            | New Playwright acceptance suite (parameterized via `DHIS2_URL`)                            | Kept in repo |
| `docs/review-2026-07-09-platform-migration/` | This review's reports + screenshots                                                        | Kept in repo |
| `d2auth.json`                                | Deleted (contained localhost credentials; obsolete under App Platform, already gitignored) | Removed      |

No config files were repointed: testing used production bundles installed via `POST /api/apps`, not a dev-server proxy.

## DHIS2 instances (broker)

| Instance       | Version  | Seed              | Disposition                           |
| -------------- | -------- | ----------------- | ------------------------------------- |
| `agent-ud-41`  | 2.41.9   | lao_hmis_demo_v41 | Deleted                               |
| `agent-ud-42`  | 2.42.5.1 | sierra-leone v42  | Deleted                               |
| `agent-ud-43`  | 2.43.0.1 | sierra-leone v43  | Deleted                               |
| `agent-ud-41b` | 2.41.9   | lao_hmis_demo_v41 | Deleted (final-build re-verification) |

On both Laos instances the seed ships with the `admin` account disabled; it was re-enabled and its password reset to `district` directly in the instance database (instances were disposable and are deleted).

## Test data created / mutated

All mutations were on disposable broker instances (all deleted). For the record, per instance:

| Change                                                                           | Instance(s) | Cleaned up?                                    |
| -------------------------------------------------------------------------------- | ----------- | ---------------------------------------------- |
| App `user-disabler` installed via `POST /api/apps`                               | all         | Instance deleted                               |
| Test users disabled (e.g. Karoline, Kim, Morten on Laos; alinana, arabicB on SL) | all         | Instance deleted                               |
| `DISABLE_INACTIVE_USERS` job created + toggled by e2e suite                      | all         | Deleted by the suite itself (verified per run) |

## System settings changed

None (no CORS edits needed — app installed as production bundle).

## Not reverted — action needed

Nothing. No user-provided instances were touched; all broker instances were deleted.

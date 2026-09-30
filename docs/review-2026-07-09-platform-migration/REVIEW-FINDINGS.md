# Review findings: User Disabler v1.0.0 (App Platform migration)

Reviewed: 2026-07-09 · Scope: code review + functional test (post-migration acceptance) · Reviewer: agent (Claude Fable 5 / Claude Code)
DHIS2 versions tested: 2.41.9 (Laos HMIS demo DB), 2.42.5.1 (Sierra Leone demo), 2.43.0.1 (Sierra Leone demo)

## Summary

The app was migrated in this session from a vanilla-JS/webpack/jQuery tool to the DHIS2 App Platform (React 18, TypeScript, `@dhis2/ui`, `@dhis2/app-runtime`, TanStack Query v4 + Table). A static review of the migrated code found 1 HIGH, 2 MEDIUM and 7 LOW findings; **all HIGH/MEDIUM findings and 6 of 7 LOW findings were fixed during the review** and re-verified with the e2e suite. The remaining item (L5, accessibility labels on table checkboxes) is documented below. The app passes its full functional suite on all three target DHIS2 versions and is in a releasable state.

## Findings

All line references are to the code as it was when the finding was made; "Status" records what was done in this session.

### HIGH

#### H1. "Apply filter" never refetched when filter values were unchanged; inactivity cutoff went stale

- **Where**: `src/hooks/useUsers.ts` (query key) + `src/pages/UsersPage.tsx` (`applyFilter`)
- **What**: The TanStack Query key was `['users', filter]` while the actual `lastLogin:lt:` cutoff was computed inside `queryFn` at fetch time. Clicking **Apply filter** with unchanged values changed no key, so no request was ever made — the list stayed frozen (confirmed live: 1 request on load, 0 after two Apply clicks), and an app left open kept using the cutoff computed at first load. The old app refetched on every Apply.
- **Fix applied**: `applyFilter` now calls `queryClient.invalidateQueries({ queryKey: ['users'] })` on every apply, forcing a refetch with a freshly computed cutoff. Regression step added to the e2e suite ("apply with unchanged filter refetches") — passes on 2.42/2.43.

### MEDIUM

#### M1. CI release step would fail on every push to `main` after the first release

- **Where**: `.github/workflows/build.yml`
- **What**: The workflow (carried over from the old repo's design) triggered on pushes to `main` _and_ tags, and unconditionally ran `actions/create-release@v1` with a tag derived from `package.json` — once `v1.0.0` exists, every main push turns CI red with `already_exists`.
- **Fix applied**: Release/upload steps now run only on `v*` tag pushes (`if: startsWith(github.ref, 'refs/tags/v')`); pushes to `main` just lint + build. Note: `actions/create-release`/`upload-release-asset` are archived; consider `softprops/action-gh-release` when convenient.

#### M2. `import './locales'` missing from the entrypoint — translations never registered

- **Where**: `src/App.tsx`
- **What**: The generated `src/locales/index.js` (which calls `i18n.addResources`) was never imported, so any future translations would silently never load (English keys always shown). Root cause: the official `@dhis2/cli-app-scripts` **TypeScript** template omits the import that the JS template has — likely a platform template bug worth reporting upstream.
- **Fix applied**: `import './locales'` added to `src/App.tsx`.

### LOW

#### L1. Single-row Disable wiped the whole bulk selection — `src/pages/UsersPage.tsx`

Disabling one user via the row button cleared every checkbox the admin had ticked. **Fixed**: only successfully disabled users are removed from the selection; users the server rejected stay selected for retry (covered by e2e step "selection updated after bulk disable").

#### L2. Month arithmetic overflowed at month ends — `src/utils/dates.ts`

`date.setMonth(m-6)` rolls May 31 to Dec 1 instead of Nov 30. **Fixed**: `subtractMonths` clamps to the last day of the target month (also used for years, handling Feb 29).

#### L3. RHF `{...field}` spread `ref` onto `InputField` (no `forwardRef`) — `src/components/CreateJobModal.tsx`

Caused the "function components cannot be given refs" dev warning; zod schema was also built at module scope, freezing messages before locale load. **Fixed**: explicit `name`/`value`/`onBlur` props instead of spread; schema built lazily inside the component.

#### L4. "Number of months" input couldn't be cleared while typing — `src/components/UserFilterForm.tsx`

`Math.max(1, Number(value) || 1)` snapped an emptied field back to 1. **Fixed**: draft kept as string; validation error + disabled Apply on invalid input.

#### L5. Accessibility: table checkboxes and search input lack accessible labels — `src/components/UsersTable.tsx` — **NOT FIXED**

`@dhis2/ui` `Checkbox` (and `InputField`) don't forward `aria-label`, and a visible `label` on row checkboxes isn't wanted. Screen readers announce nothing meaningful for the select-all/row checkboxes. Options: wrap in a custom labelled control, or raise the `aria-label` passthrough gap with the `@dhis2/ui` team. Left as the only open finding.

#### L6. Error notices showed the generic runtime message instead of the DHIS2 API message — several files

**Fixed**: shared `src/utils/errors.ts#getErrorMessage` (prefers `FetchError.details.message`) used in all query/mutation error paths.

#### L7. `@types/react@19` with `react@18.3` — `package.json`

**Fixed**: pinned `@types/react`/`@types/react-dom` to `^18` (this is what the scaffolder generated; also probably worth an upstream report).

#### Bonus finding (fixed): i18next plural forms silently broken

The migrated code initially used `defaultValue_plural`, which the i18next bundled by the platform (v25) ignores — the UI showed "2 user selected". Fixed by branching singular/plural strings explicitly. Worth knowing for other DHIS2 apps: `@dhis2/d2-i18n` declares i18next ^10 but the built bundle resolves a modern i18next, so legacy plural options don't work.

## Claims investigated and rejected

- **Claim**: Bulk disable is broken on 2.42 — 2 of 2 users not disabled after run (e2e failure `api_ok=False`).
- **Source**: first e2e run on 2.42-SL.
- **Refuted by**: manual API reproduction — `POST /api/users/{id}/disabled` _and_ the old app's full-object `PUT /api/users/{id}` both return the identical `409 E1004` ("You must have permissions to create user, or ability to manage at least one user group for the user") for certain SL demo users (e.g. `arabic`), even for the superuser. The app correctly reports these per-user failures in the summary table (screenshot `2.42-sl-05-bulk-summary.png`). Server-side ACL quirk, not an app defect and not a regression. Note the server's own surfaces disagree: `access.update=true` and `canManage=true` for users the disable endpoint then rejects.

## Architecture assessment

The migration puts the app on the right architecture. It now matches the App Platform reference standard (`dhis2-app-dev`): data via `useDataEngine`/TanStack Query with metadata-vs-data caching, `@dhis2/ui` components throughout, i18n via `d2-i18n`, CSS modules with design tokens, hash router with global-shell URL sync. API usage was verified against dhis2-core 2.41/2.42/2.43 source: all endpoints used are stable across the range, and the app now uses the dedicated `POST /api/users/{uid}/disabled` and `POST /api/jobConfigurations/{uid}/enable|disable` endpoints instead of full-object PUT / JSON-patch, shrinking the mutation surface. `minDHIS2Version: '2.41'` is correct. One deliberate deviation from the reference table pattern: the user list is fetched with `paging=false` and paginated client-side, because the app's core operation is bulk selection across the whole filtered set and the never-logged-in union of two queries can't be server-paged; acceptable for admin-scale user counts, revisit if instances with tens of thousands of users become a target.

## Test coverage

`tests/e2e/test_user_disabler.py` (Playwright, parameterized via `DHIS2_URL`/`LABEL`/`OUTDIR`) covers: load, default filter vs API, refetch-on-apply regression, never-logged-in merge+dedupe, search, sort, info modal, single disable, disabled-row state, bulk disable with progress/summary, selection retention semantics, job create/toggle/cleanup, console hygiene. See `UI-TEST-RESULTS.md`.

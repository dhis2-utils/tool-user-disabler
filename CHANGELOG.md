# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0]

### Added

- User documentation in `docs/user/`.
- An end-to-end suite in `e2e/` that seeds its own users and cleans up after itself. It passes on DHIS2 2.41, 2.42 and 2.43.

### Changed

- You can no longer select or disable your own account. The tool marks your row with a **You** tag.
- The form to create a scheduled job checks the ranges that DHIS2 allows: 1 to 24 inactive months, and 1 to 28 reminder days.
- Error messages show the reason that DHIS2 gives, not only "One or more errors occurred".
- Linting and formatting moved from ESLint and Prettier to Ultracite (Oxlint and Oxfmt).

### Fixed

- Six texts were missing from the translation template, so they could not be translated.
- The user details showed an empty value for a user with no user roles. They now show **None**.
- The error messages for creating and switching the scheduled job showed an apostrophe as `&#39;`, for example "You don&#39;t have the proper permissions".

## [1.0.0]

### Upgrading

- The app key changed from `user-disabler` to `tool-user-disabler`, so DHIS2 installs this version as a new app. Install it, then uninstall the old app in App Management, or two entries remain in the menu.
- Add the new app to every user role that gave access to the old one. Until then, users without the ALL authority cannot open it.
- Bookmarks to the old app URL stop working.
- Requires DHIS2 2.41 or later.

### Changed

- Migrated the app to the DHIS2 App Platform (React, TypeScript, `@dhis2/ui`, TanStack Query and Table).
- Users are disabled through `POST /api/users/{id}/disabled` instead of a full user update.
- The scheduled job is switched on and off through `POST /api/jobConfigurations/{id}/enable` and `disable`.
- Users can be filtered by user role and user group. The user table can be searched, sorted and paged.
- Renamed the app to "User Disabler Tool".

## [0.1.4]

### Fixed

- The page no longer refreshes when you apply the filter.

## [0.1.1]

### Added

- This changelog.

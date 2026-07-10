# Changelog

All notable changes to this project will be documented in this file.

## 1.0.0

* Migrated the app to the React-based DHIS2 App Platform (TypeScript, @dhis2/ui, TanStack Query/Table). Requires DHIS2 2.41 or later.
* Users are now disabled via the dedicated `POST /api/users/{id}/disabled` endpoint instead of a full user PUT.
* The scheduled job toggle now uses `POST /api/jobConfigurations/{id}/enable|disable`.
* Filter by user role and group with searchable multi-selects; searchable, sortable, paginated user table.

## 0.1.4

* Fix bug: prevent page from refreshing when applying filter.

## 0.1.1

Added Changelog
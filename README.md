# User Disabler Tool

> ![Maturity: Validated](https://img.shields.io/badge/maturity-Validated-yellow)  
> Intended use: finding and disabling inactive users, one by one or in bulk.  
> Maintainers: HISP Centre implementation team.

> [!WARNING]
> This tool is for system administrators, not end users. It is a DHIS2 app, but it has not been through the same testing as the core apps. It disables user accounts in bulk: try it on a copy of your database first.

The User Disabler Tool lists the users who have not logged in to DHIS2 for a chosen period and disables them, and manages the DHIS2 job that does this on a schedule. The user documentation is in [`docs/user/`](docs/user/tool-user-disabler.md).

The rest of this README is for developers.

## Supported DHIS2 versions

DHIS2 2.41 and later (`minDHIS2Version` in `d2.config.js`). The end-to-end suite runs on 2.41, 2.42 and 2.43.

## Prerequisites

- Node.js 22.
- pnpm 10. The version is pinned in `package.json` (`packageManager`); `corepack enable` installs it.
- A DHIS2 instance to develop against, for example a local one on `http://localhost:8080`. [DHIS2 in Docker](https://developers.dhis2.org/docs/tutorials/dhis2-docker/) explains how to start one.

## Install dependencies

```bash
pnpm install
```

## Start against a local instance

```bash
pnpm start
```

Open the address that the command prints, and log in with `http://localhost:8080` as the server. The app is built with the [DHIS2 App Platform](https://developers.dhis2.org/docs/app-platform/getting-started) (React, TypeScript, `@dhis2/ui`).

## Test, lint and build

```bash
pnpm test         # unit tests (src/**/*.test.ts)
pnpm run lint     # Ultracite: Oxlint and Oxfmt
pnpm run format   # fix formatting
pnpm exec tsc --noEmit
pnpm run build    # writes build/bundle/tool-user-disabler-<version>.zip
```

The unit tests include a check that every `i18n.t` key reaches `i18n/en.pot`. If it fails after you add a text, run `pnpm run build` to regenerate the file, and commit it.

Linting follows [LINTING.md](https://github.com/dhis2-utils/reference-tool-conventions/blob/main/LINTING.md) in reference-tool-conventions. With Claude Code, a hook in `.claude/` lints every file the agent edits; `AGENTS.md` has the rules.

The end-to-end suite drives the built app on a live instance. It changes and deletes data, so read [`e2e/README.md`](e2e/README.md) before you run it.

## Release

Releases follow [RELEASE-WORKFLOW.md](https://github.com/dhis2-utils/reference-tool-conventions/blob/main/RELEASE-WORKFLOW.md) in reference-tool-conventions:

1. Bump `version` in `package.json`, and add a `## [x.y.z]` section to `CHANGELOG.md`.
2. Merge to `main` and let CI pass.
3. Tag the merged commit: `git tag vx.y.z && git push origin vx.y.z`.

The Release workflow builds the app and attaches the zip to a GitHub release.

## License

BSD-3-Clause, © University of Oslo 2026. See [LICENSE](LICENSE).

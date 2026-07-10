# Lessons learned: user-disabler migration + review (2026-07-09/10)

Notes from migrating this app to the DHIS2 App Platform and reviewing/testing it on
DHIS2 2.41–2.43, aimed at improving the agent skills and sandbox environment used.
Audience: whoever maintains the `dhis2-*` skills, the agent-sandbox image, and d2-broker.

## dhis2-app-dev skill

**Worked well**

- The "read the dhis2-core source before writing data-fetching code" rule paid off
  immediately: it surfaced `POST /api/users/{uid}/disabled` and
  `POST /api/jobConfigurations/{uid}/enable|disable`, which are cleaner than the
  full-object PUT / JSON-patch the old app used, and confirmed no feature-flagging is
  needed across 41–43.
- The ESLint `import/named` troubleshooting entry (install
  `eslint-import-resolver-typescript`) matched exactly and saved a debugging session.
- The bootstrapping recipe (TanStack Query v4, `useApiDataQuery` wrapper,
  `SyncUrlWithGlobalShell`, hash router) worked without modification.

**Gaps worth adding to the skill**

1. **i18next plurals are silently broken in platform apps.** `@dhis2/d2-i18n` declares
   i18next `^10`, but the built bundle resolves a modern i18next (v25 here), which
   ignores the legacy `defaultValue_plural` option — `t('{{count}} users', {count: 2,
defaultValue_plural: …})` renders the singular. Branch explicitly
   (`count === 1 ? t('1 user') : t('{{count}} users', {count})`). This cost a failed
   e2e run to discover.
2. **`ButtonStrip` spaces only direct children.** Wrapping two buttons in a fragment
   (e.g. for conditional rendering) collapses the gap to zero. Put the conditional
   around the `ButtonStrip`, not inside it. Would fit in `ui-patterns.md`.
3. **The official TypeScript template diverges from the JS template** (cli-app-scripts
   12.10.3): it omits `import './locales'` (translations never register) and ships
   `@types/react@19` with `react@18`. Both look like upstream bugs; until fixed, the
   bootstrapping reference should tell agents to correct them post-scaffold.
4. **`opensrc` returned 401 Unauthorized** in the sandbox even with `GITHUB_TOKEN` set,
   so the "fetch the source with opensrc" instruction failed; the workaround was a
   sparse `git clone --depth 1 --branch <tag>`. Either fix opensrc auth in the sandbox
   or document the sparse-clone fallback in `data-fetching.md`.
5. The bootstrapping doc mandates sidebar navigation for every app. For single-view
   admin tools (like this one) a sidebar is dead weight — a "skip for single-page
   tools" carve-out would avoid agents adding it reflexively.

## dhis2-app-review skill

**Worked well**

- `probe.py` → recon-then-act caught real selector surprises cheaply; the
  Basic-auth-`/api/me`-cookie login pattern worked on every version; the frame-aware
  guidance ("2.42+ serves installed apps in a global-shell iframe") was exactly right.
- The dev-server `ENOENT …tsx.tmp.<pid>` crash happened precisely as documented
  (file-watcher racing the editor's atomic rename) — having it pre-documented turned a
  scary stack trace into a 10-second restart.
- The "verify HIGH claims live before filing" rule worked as designed: a static-review
  HIGH ("Apply filter never refetches") was confirmed with a network capture before
  fixing, and an apparent bulk-disable failure was traced to a server-side quirk and
  rejected as an app finding.

**Gaps worth adding**

1. **Cookie SameSite vs. dev servers.** Injecting the instance's `JSESSIONID` only
   works when the app origin and the API are _same-site_ (hostname, not port). Testing
   the dev server from inside the sandbox against a dev-net instance
   (`localhost:49271` app → `dhis2-agent-…:8080` API) silently drops the cookie and
   shows the login screen. Fix: run a local TCP forward so the API is also
   `localhost:<port>`, mirroring the host user's setup. Worth a paragraph in
   `playwright-patterns.md` (and note `socat` is not installed — a small Python
   forwarder works).
2. **Client-side-paginated tables can't be counted from rows.** Only the current page
   is in the DOM; the reliable total is the `Pagination` footer text
   ("… items 1-10 of 36"). A note would prevent a false "app count ≠ API count"
   failure (it produced one here).
3. **DHIS2 2.42+ user-disable quirk**: some SL demo users (e.g. `arabic`) can't be
   disabled even by the superuser — `409 E1004` — and neither `access.update` nor
   `?canManage=true` predicts it. Tests should assert "app report matches API state
   afterwards", not "every disable succeeds". Candidate for a "known server quirks"
   list in the skill.

## dhis2-instances skill / d2-broker

- The documented Laos-seed workflow (admin disabled → bcrypt UPDATE → restart) was
  needed **both** times an instance was created from `lao_hmis_demo_v41.sql.gz`. It
  would be cheaper if `GET /seeds` carried per-seed metadata (working credentials, or
  a `fixups` note), or if the broker offered an opt-in "ensure admin/district" flag on
  create/reset.
- Sequential multi-version testing (create → boot → test → delete → next) works but
  each boot is ~10–20 min; 4 instances were needed for this review. If the broker could
  keep pre-warmed images or DB snapshots per (version, seed) pair, multi-version
  reviews would shrink dramatically.
- `POST /api/configuration/corsWhitelist` **replaces** the whole list rather than
  appending — easy to wipe the demo defaults. Read-modify-write; worth a note wherever
  CORS setup is documented.
- Both broker restore paths and instance mgmt behaved exactly as the skill describes
  (job polling, devnet URLs, direct DB access via `<name>-db:5432`).

## Sandbox environment

1. **`apt` is effectively broken**: the base image is Ubuntu (arm64), so packages come
   from `ports.ubuntu.com`, which the egress firewall drops (the firewall notes mention
   Debian mirrors). `postgresql-client` could not be installed; the workaround was
   `pip install --user --break-system-packages psycopg2-binary bcrypt` (PyPI is
   allowed). Either allow `ports.ubuntu.com` in `init-firewall.sh` or preinstall
   commonly-needed tools (`postgresql-client`, `socat`) in the image.
2. **Single host port** (`$SANDBOX_HOST_PORT`) is fine for the direct-CORS dev-server
   setup used here (instance reached via its own broker-published host port), but the
   App Platform's `--proxy` mode needs a second published port for the proxy. The new
   CLAUDE.md guidance covers this; preinstalling `socat` would also make in-sandbox
   port-forwarding trivial (see SameSite note above).
3. **Playwright worked out of the box** (browsers + system deps present) — keep that.
4. Minor: `.DS_Store` files from the host mount kept appearing in `git status`;
   the image could ship a global gitignore for host-OS litter.

## App-specific facts future sessions will want

Recorded in agent memory as [[laos-seed-admin-disabled]], [[dhis2-platform-i18next-plural]]
and [[dhis2-42-disable-409-quirk]]; the e2e suite (`tests/e2e/test_user_disabler.py`)
encodes all of them as tolerant assertions.

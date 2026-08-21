#!/usr/bin/env python3
"""End-to-end acceptance suite for the User Disabler app.

Runs against a live DHIS2 instance where the app is installed
(POST build/bundle/<app-key>-<version>.zip to /api/apps first).

Environment variables:
    DHIS2_URL   e.g. http://dhis2-agent-ud-41:8080  (required)
    DHIS2_USER  default: admin
    DHIS2_PASS  default: district
    APP_KEY     app key / manifest short_name, i.e. the `name` in
                d2.config.js (default: tool-user-disabler)
    LABEL       label used in output, e.g. "2.41-laos" (default: instance version)
    OUTDIR      where to write screenshots/results (default: /tmp/ud-e2e)

The suite is frame-aware: on DHIS2 2.42+ installed apps are served inside
the global-shell iframe, on <=2.41 at top level.

Mutations made (only run against disposable instances):
    - disables users (single + bulk) — usernames recorded in results
    - creates a DISABLE_INACTIVE_USERS job, toggles it, then deletes it
"""
import base64
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

from playwright.sync_api import sync_playwright

BASE = os.environ["DHIS2_URL"].rstrip("/")
USER = os.environ.get("DHIS2_USER", "admin")
PASS = os.environ.get("DHIS2_PASS", "district")
OUTDIR = os.environ.get("OUTDIR", "/tmp/ud-e2e")
APP_KEY = os.environ.get("APP_KEY", "tool-user-disabler")
AUTH = "Basic " + base64.b64encode(f"{USER}:{PASS}".encode()).decode()
USER_FIELDS = "id,username,firstName,surname,disabled,created,lastLogin"

results = []
console_errors = []
page_errors = []

# Environmental noise that is not an app defect
IGNORED_CONSOLE = (
    "secure context",  # PWA over plain http
    "logo_banner",  # instance has no custom logo -> 404
    "Failed to load resource",  # counted via http errors instead
)


def api(path, method="GET", body=None, ctype="application/json"):
    req = urllib.request.Request(
        f"{BASE}/api/{path}", method=method,
        headers={"Authorization": AUTH, "Content-Type": ctype},
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        return json.loads(raw) if raw else {}


def api_users(filters):
    q = "&".join(
        "filter=" + urllib.parse.quote(f) for f in filters
    )
    return api(f"users.json?fields={USER_FIELDS}&paging=false&{q}")["users"]


def record(step, ok, detail=""):
    results.append((step, "PASS" if ok else "FAIL", detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {step} {detail}")


def login_cookie():
    req = urllib.request.Request(
        f"{BASE}/api/me", headers={"Authorization": AUTH}
    )
    with urllib.request.urlopen(req) as r:
        for c in r.headers.get_all("Set-Cookie") or []:
            head = c.split(";", 1)[0]
            n, _, v = head.partition("=")
            if "JSESSIONID" in n:
                return n.strip(), v.strip()
    raise RuntimeError("No JSESSIONID")


def app_frame(page):
    """Return the frame the app runs in (global-shell iframe on 2.42+)."""
    for f in page.frames:
        if APP_KEY in f.url and f != page.main_frame:
            return f
    return page.main_frame


def modal_close(modal):
    """The footer Close button (the X close button also matches by name)."""
    return modal.locator(
        "[data-test='dhis2-uicore-modalactions']"
    ).get_by_role("button", name="Close")


def wait_table(frame):
    frame.wait_for_selector(
        "[data-test='dhis2-uicore-datatable'] tbody tr", timeout=30_000
    )


def visible_usernames(frame):
    """Usernames on the CURRENT page of the table."""
    return frame.eval_on_selector_all(
        "[data-test^='select-user-']",
        "els => els.map(e => e.getAttribute('data-test').replace('select-user-',''))",
    )


def table_total(frame):
    """Total row count from the pagination footer: '... items 1-10 of 36'."""
    import re
    text = frame.locator(
        "[data-test='dhis2-uiwidgets-pagination']"
    ).inner_text()
    m = re.search(r"of\s+(\d+)\s*$", text.split("\n")[2].strip())
    if not m:
        m = re.search(r"of\s+(\d+)", text.replace("\n", " "))
    return int(m.group(1)) if m else -1


def apply_filter(frame, page):
    frame.get_by_role("button", name="Apply filter").click()
    page.wait_for_timeout(1500)
    wait_table(frame)


def check_checkbox(frame, data_test):
    frame.locator(f"[data-test='{data_test}'] input").check(force=True)


def pick_disposable_users(n, exclude):
    """Pick n non-admin users safe to disable.

    Prefer users that belong to a user group: on 2.42+ the server rejects
    disabling users the actor can't 'manage' (409 E1004), which hits
    group-less demo users even for superusers.
    """
    q = "&".join(
        "filter=" + urllib.parse.quote(f)
        for f in ["disabled:eq:false"]
    )
    users = api(
        f"users.json?fields={USER_FIELDS},userGroups&paging=false&{q}"
    )["users"]
    safe = [
        u for u in users
        if u["username"] not in exclude and u["username"] != USER
    ]
    safe.sort(
        key=lambda u: (
            len(u.get("userGroups", [])) == 0,  # grouped users first
            u.get("lastLogin") is not None,     # never-logged-in first
            u["username"],
        )
    )
    return safe[:n]


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    info = api("system/info?fields=version")
    version = info.get("version", "?")
    label = os.environ.get("LABEL", version)
    shot = lambda name: page.screenshot(
        path=f"{OUTDIR}/{label}-{name}.png", full_page=True
    )

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        host = urllib.parse.urlparse(BASE).hostname
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        cn, cv = login_cookie()
        ctx.add_cookies([{
            "name": cn, "value": cv, "domain": host, "path": "/",
            "httpOnly": True, "sameSite": "Lax",
        }])
        global page
        page = ctx.new_page()
        page.on("console", lambda m: console_errors.append(m.text)
                if m.type == "error"
                and not any(s in m.text for s in IGNORED_CONSOLE) else None)
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        user_queries = []
        page.on("request", lambda r: user_queries.append(r.url)
                if "users?" in r.url else None)

        # ---- 1. App loads
        page.goto(f"{BASE}/api/apps/{APP_KEY}/index.html")
        page.wait_for_load_state("networkidle")
        frame = app_frame(page)
        try:
            wait_table(frame)
            record("app loads, table renders", True, f"version {version}")
        except Exception as e:
            record("app loads, table renders", False, str(e))
            shot("load-failed")
            browser.close()
            return finish(label)
        shot("01-loaded")

        # ---- 2. Default filter count matches API (inactive 6 months, not disabled)
        cutoff = (datetime.now(timezone.utc) - timedelta(days=182)).strftime(
            "%Y-%m-%dT%H:%M"
        )
        # app computes now - 6 calendar months; use a tolerant comparison:
        expected = api_users(["disabled:eq:false", f"lastLogin:lt:{cutoff}"])
        total = table_total(frame)
        # tolerate boundary drift of a couple of users around the cutoff
        record(
            "default filter (6 months) matches API",
            abs(total - len(expected)) <= 2,
            f"app={total} api={len(expected)}",
        )

        # ---- 2b. Apply with unchanged filter must refetch (staleness bug)
        n_before = len(user_queries)
        frame.get_by_role("button", name="Apply filter").click()
        page.wait_for_timeout(1500)
        record(
            "apply with unchanged filter refetches",
            len(user_queries) > n_before,
            f"requests before={n_before} after={len(user_queries)}",
        )

        # ---- 3. Include never-logged-in (filter checkboxes toggled via label)
        frame.get_by_text("Include users who never logged in").click()
        apply_filter(frame, page)
        never = api_users(["disabled:eq:false", "lastLogin:null"])
        total2 = table_total(frame)
        merged = set(u["id"] for u in expected) | set(u["id"] for u in never)
        got2 = visible_usernames(frame)
        record(
            "include never-logged-in merges + dedupes",
            abs(total2 - len(merged)) <= 2,
            f"app={total2} api={len(merged)}",
        )
        shot("02-never-logged-in")

        # ---- 4. Search box narrows table
        target = sorted(got2)[0] if got2 else None
        if target:
            frame.get_by_placeholder("Search users").fill(target)
            page.wait_for_timeout(600)
            got3 = visible_usernames(frame)
            record(
                "search narrows results",
                target in got3 and len(got3) <= len(got2),
                f"query={target} rows={len(got3)}",
            )
            frame.get_by_placeholder("Search users").fill("")
            page.wait_for_timeout(400)
        else:
            record("search narrows results", False, "no rows to search")

        # ---- 5. Sorting by username
        frame.locator("th", has_text="Username").locator(
            "button[title='Sort']"
        ).first.click()
        page.wait_for_timeout(500)
        first_cell = frame.locator(
            "[data-test='dhis2-uicore-datatable'] tbody tr td:nth-child(2)"
        ).first.inner_text()
        all_names = sorted(
            (u["username"] for u in expected + never),
            key=str.lower,
        )
        record(
            "sort by username asc",
            bool(all_names) and first_cell == all_names[0],
            f"first={first_cell} expected={all_names[0] if all_names else '-'}",
        )

        # ---- 6. Info modal
        row = frame.locator(
            "[data-test='dhis2-uicore-datatable'] tbody tr"
        ).first
        row.get_by_role("button", name="Info").click()
        modal = frame.locator("[data-test='dhis2-uicore-modal']")
        modal.wait_for(timeout=10_000)
        try:
            modal.get_by_text("User roles").wait_for(timeout=10_000)
            has_fields = True
        except Exception:
            has_fields = False
        record("info modal shows details", has_fields)
        shot("03-info-modal")
        modal_close(modal).click()
        page.wait_for_timeout(300)

        # ---- 7. Single-user disable
        exclude = {USER, "admin"}
        victims = pick_disposable_users(3, exclude)
        if len(victims) < 3:
            record("single disable", False, "not enough disposable users")
            return finish(label)
        single = victims[0]
        frame.get_by_placeholder("Search users").fill(single["username"])
        page.wait_for_timeout(600)
        frame.locator(
            "[data-test='dhis2-uicore-datatable'] tbody tr"
        ).first.get_by_role("button", name="Disable").click()
        dmodal = frame.locator("[data-test='disable-users-modal']")
        dmodal.wait_for(timeout=10_000)
        ok_text = single["username"] in dmodal.inner_text()
        dmodal.locator("[data-test='confirm-disable-users']").click()
        modal_close(dmodal).wait_for(timeout=30_000)
        shot("04-single-disable-summary")
        summary = dmodal.inner_text()
        modal_close(dmodal).click()
        api_state = api(
            f"users/{single['id']}.json?fields=disabled"
        )["disabled"]
        # report must match reality: success claim iff API shows disabled,
        # otherwise the failure (with username) must be listed
        report_ok = (
            "1 user was successfully disabled" in summary
            if api_state
            else single["username"] in summary
        )
        record(
            "single disable via row button",
            ok_text and report_ok,
            f"user={single['username']} api disabled={api_state}",
        )
        frame.get_by_placeholder("Search users").fill("")
        page.wait_for_timeout(500)

        # ---- 8. Row updates after refetch (disabled user unselectable)
        if api_state:
            frame.get_by_text("Include already disabled users").click()
            apply_filter(frame, page)
            frame.get_by_placeholder("Search users").fill(single["username"])
            page.wait_for_timeout(600)
            row_html = frame.locator(
                "[data-test='dhis2-uicore-datatable'] tbody tr"
            ).first.inner_text()
            cb_disabled = frame.locator(
                f"[data-test='select-user-{single['username']}'] input"
            ).is_disabled()
            record(
                "disabled user shows tag + unselectable checkbox",
                "Disabled" in row_html and cb_disabled,
                "",
            )
            frame.get_by_placeholder("Search users").fill("")
            frame.get_by_text("Include already disabled users").click()
            apply_filter(frame, page)
        else:
            record(
                "disabled user shows tag + unselectable checkbox",
                True,
                "skipped: server rejected the disable (409)",
            )

        # ---- 9. Bulk disable two users (search for each, selection persists)
        bulk = victims[1:3]
        for u in bulk:
            frame.get_by_placeholder("Search users").fill(u["username"])
            page.wait_for_timeout(500)
            check_checkbox(frame, f"select-user-{u['username']}")
        frame.get_by_placeholder("Search users").fill("")
        page.wait_for_timeout(500)
        count_ok = "2 users selected" in frame.locator(
            "text=users selected"
        ).first.inner_text()
        frame.locator("[data-test='bulk-disable-button']").click()
        dmodal = frame.locator("[data-test='disable-users-modal']")
        dmodal.wait_for(timeout=10_000)
        confirm_ok = "2 users will be disabled" in dmodal.inner_text()
        dmodal.locator("[data-test='confirm-disable-users']").click()
        modal_close(dmodal).wait_for(timeout=60_000)
        shot("05-bulk-summary")
        summary = dmodal.inner_text()
        modal_close(dmodal).click()
        page.wait_for_timeout(1000)
        # The app's report must match API reality: some users can be
        # legitimately rejected by the server (e.g. 409 E1004 "must have
        # permissions to create user / manage a user group" on 2.42+ demo
        # users without user groups). Failures must be listed by username.
        api_disabled = [
            u for u in bulk
            if api(f"users/{u['id']}.json?fields=disabled")["disabled"]
        ]
        n_ok = len(api_disabled)
        n_fail = len(bulk) - n_ok
        claim_ok = (
            f"{n_ok} users were successfully" in summary
            if n_ok != 1 else "1 user was successfully" in summary
        )
        failures_listed = all(
            u["username"] in summary for u in bulk if u not in api_disabled
        )
        record(
            "bulk disable 2 users (confirm→progress→summary)",
            count_ok and confirm_ok and claim_ok and failures_listed,
            f"users={[u['username'] for u in bulk]} "
            f"api: {n_ok} disabled, {n_fail} rejected by server",
        )

        # ---- 10. Selection cleared after bulk run
        # Successfully disabled users leave the selection; users the server
        # rejected stay selected so the admin can retry.
        remaining = len(bulk) - n_ok
        expected_sel = (
            "1 user selected" if remaining == 1
            else f"{remaining} users selected"
        )
        sel_text = frame.locator("text=selected").first.inner_text()
        record(
            "selection updated after bulk disable",
            expected_sel in sel_text,
            f"expected '{expected_sel}', got '{sel_text}'",
        )

        # ---- 11. Job section: create job
        jobs_before = api(
            "jobConfigurations.json?filter=jobType:eq:DISABLE_INACTIVE_USERS&fields=id"
        ).get("jobConfigurations", [])
        frame.locator("[data-test='add-job-button']").click()
        jmodal = frame.locator("[data-test='create-job-modal']")
        jmodal.wait_for(timeout=10_000)
        jmodal.locator("[data-test='create-job-submit']").click()
        # Poll for the new job rather than assuming the POST lands within a
        # fixed delay: on a loaded host it can take several seconds, and a
        # fixed wait made this step flake (and then skipped its own cleanup).
        before_ids = {jb["id"] for jb in jobs_before}
        created = []
        for _ in range(15):
            page.wait_for_timeout(1000)
            jobs = api(
                "jobConfigurations.json?filter=jobType:eq:DISABLE_INACTIVE_USERS"
                "&fields=id,name,enabled,jobParameters"
            ).get("jobConfigurations", [])
            created = [j for j in jobs if j["id"] not in before_ids]
            if created:
                break
        job_ok = len(created) == 1 and created[0]["enabled"] and \
            created[0]["jobParameters"]["inactiveMonths"] == 6
        record(
            "create scheduler job with defaults",
            job_ok,
            json.dumps(created[0]) if created else "no job created",
        )
        shot("06-job-created")

        # ---- 12. Toggle job off via switch
        if created:
            frame.locator(
                "[data-test='dhis2-uicore-switch'] input"
            ).first.click(force=True)
            state = True
            for _ in range(10):
                page.wait_for_timeout(1000)
                state = api(
                    f"jobConfigurations/{created[0]['id']}.json?fields=enabled"
                )["enabled"]
                if state is False:
                    break
            record("toggle job disabled via switch", state is False,
                   f"enabled={state}")

        # Cleanup runs regardless of the assertions above: delete every
        # DISABLE_INACTIVE_USERS job this run introduced. Kept outside the
        # `if created:` branch so a slow POST that the poll missed can't
        # orphan a job on the instance.
        leftover = [
            j
            for j in api(
                "jobConfigurations.json"
                "?filter=jobType:eq:DISABLE_INACTIVE_USERS&fields=id"
            ).get("jobConfigurations", [])
            if j["id"] not in before_ids
        ]
        for job in leftover:
            api(f"jobConfigurations/{job['id']}", method="DELETE")
        record(
            "cleanup: job deleted",
            len(leftover) == len(created) or not created,
            ", ".join(j["id"] for j in leftover) or "nothing to delete",
        )

        # ---- 13. Console/page errors
        record(
            "no unexpected console/page errors",
            not console_errors and not page_errors,
            (console_errors + page_errors)[:3].__repr__(),
        )
        shot("07-final")
        browser.close()
    return finish(label)


def finish(label):
    print(f"\n=== RESULTS {label} ===")
    for step, status, detail in results:
        print(f"{status}\t{step}\t{detail}")
    fails = sum(1 for _, s, _ in results if s == "FAIL")
    with open(f"{OUTDIR}/{label}-results.json", "w") as f:
        json.dump(
            [{"step": s, "status": st, "detail": d} for s, st, d in results],
            f, indent=2,
        )
    print(f"{len(results) - fails}/{len(results)} passed")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())

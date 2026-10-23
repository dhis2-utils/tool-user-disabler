#!/usr/bin/env python3
"""End-to-end suite for tool-user-disabler (contract version 1).

Run it through e2e/run.sh, which checks the inputs. See e2e/README.md: the
suite creates, disables and deletes users, so it must only run against a
throwaway DHIS2 instance.

What a run does:
1. Deletes whatever an earlier, killed run left behind (dataStore record).
2. Installs APP_ZIP and finds the key the server gave it.
3. Seeds a user role pair, a user group and seven users, all named after
   this run, and records each one before creating it.
4. Drives the app in Chromium and checks every change against the API.
5. Deletes everything it created, uninstalls the app and writes
   $RESULTS_DIR/results.json.
"""

import base64
import calendar
import json
import os
import re
import secrets
import string
import sys
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from datetime import datetime, timedelta, timezone

CONTRACT_VERSION = 1
REPO = "tool-user-disabler"
STATE_PATH = f"dataStore/e2e-state/{REPO}"
JOB_TYPE = "DISABLE_INACTIVE_USERS"
PASSWORD = "E2e-Passw0rd!x"
TIMEOUT_MS = 30_000

# Selectors. data-test values set by the app, then @dhis2/ui defaults.
TABLE_ROWS = "[data-test='dhis2-uicore-datatable'] tbody tr"
SEARCH_INPUT = "[data-test='search-users'] input"
PAGINATION_SUMMARY = "[data-test='dhis2-uiwidgets-pagination-summary']"
SELECT_ALL = "[data-test='select-all-users'] input"
BULK_DISABLE = "[data-test='bulk-disable-button']"
DISABLE_MODAL = "[data-test='disable-users-modal']"
CONFIRM_DISABLE = "[data-test='confirm-disable-users']"
CURRENT_USER_TAG = "[data-test='current-user-tag']"
ADD_JOB = "[data-test='add-job-button']"
JOB_MODAL = "[data-test='create-job-modal']"
JOB_SUBMIT = "[data-test='create-job-submit']"
JOB_SWITCH = "[data-test='dhis2-uicore-switch'] input"
MODAL = "[data-test='dhis2-uicore-modal']"
MODAL_ACTIONS = "[data-test='dhis2-uicore-modalactions']"
PERIOD_TYPE = "[data-test='filter-period-type'] [data-test='dhis2-uicore-singleselect']"
SINGLE_OPTION = "[data-test='dhis2-uicore-singleselectoption']"
DATE_INPUT = "[data-test='filter-date'] input"
ROLE_SELECT = "[data-test='filter-user-roles'] [data-test='dhis2-uicore-multiselect']"
GROUP_SELECT = "[data-test='filter-user-groups'] [data-test='dhis2-uicore-multiselect']"
MULTI_FILTER = "[data-test='dhis2-uicore-multiselect-filterinput'] input"
MULTI_OPTION = "[data-test='dhis2-uicore-multiselectoption']"
SELECTION_COUNT = re.compile(r"^\d+ users? selected$")

NEVER_LOGGED_IN = "Include users who never logged in"
INCLUDE_DISABLED = "Include already disabled users"

# Environmental noise, not app defects.
IGNORED_CONSOLE = (
    "secure context",  # the PWA service worker needs https
    "logo_banner",  # the instance has no custom logo
    "Failed to load resource",  # HTTP errors are checked through the API
)


class Skip(Exception):
    """The test does not apply to this instance."""


class SuiteError(Exception):
    """The suite could not run (exit code 2), as opposed to a failed test."""

    def __init__(self, stage, message):
        super().__init__(f"{stage}: {message}")
        self.stage = stage


# --------------------------------------------------------------------------
# Configuration


def read_config():
    env = os.environ
    zip_path = env["APP_ZIP"]
    with zipfile.ZipFile(zip_path) as bundle:
        manifest = json.loads(bundle.read("manifest.webapp"))
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    return {
        "base": env["DHIS2_URL"].rstrip("/"),
        "user": env["DHIS2_USER"],
        "password": env["DHIS2_PASS"],
        "zip": zip_path,
        "results_dir": env["RESULTS_DIR"],
        "label": env.get("LABEL", ""),
        "app_key": env.get("APP_KEY", ""),
        "app_name": manifest["name"],
        "app_version": manifest.get("version", ""),
        "run_id": run_id,
        # Fixed part first, so leftovers are easy to find by hand.
        "name_prefix": f"E2E {REPO} {run_id}",
        # Usernames must be lowercase; this one is unique to the run.
        "user_prefix": f"e2eud{run_id.lower()}",
    }


def new_uid():
    """A DHIS2 UID: a letter, then ten letters or digits."""
    letters = string.ascii_letters
    rest = letters + string.digits
    return secrets.choice(letters) + "".join(
        secrets.choice(rest) for _ in range(10)
    )


# --------------------------------------------------------------------------
# API


class Api:
    def __init__(self, base, user, password):
        self.base = base
        token = base64.b64encode(f"{user}:{password}".encode()).decode()
        self.auth = "Basic " + token

    def request(self, path, method="GET", body=None, headers=None, raw=None):
        data = raw if raw is not None else (
            json.dumps(body).encode() if body is not None else None
        )
        req = urllib.request.Request(
            f"{self.base}/api/{path}",
            method=method,
            data=data,
            headers={
                "Authorization": self.auth,
                "Content-Type": "application/json",
                "Accept": "application/json",
                **(headers or {}),
            },
        )
        with urllib.request.urlopen(req, timeout=120) as response:
            content = response.read()
            return json.loads(content) if content else {}

    def get(self, path):
        return self.request(path)

    def post(self, path, body):
        return self.request(path, method="POST", body=body)

    def delete(self, path):
        """Delete, treating 404 as already gone."""
        try:
            self.request(path, method="DELETE")
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise

    def users(self, filters, fields="id,username,disabled,lastLogin"):
        query = "&".join("filter=" + urllib.parse.quote(f) for f in filters)
        return self.get(f"users?fields={fields}&paging=false&{query}")["users"]

    def user(self, uid, fields="disabled"):
        return self.get(f"users/{uid}?fields={fields}")

    def jobs_named(self, name):
        query = urllib.parse.quote(f"name:eq:{name}")
        return self.get(
            "jobConfigurations?paging=false"
            "&fields=id,name,enabled,jobParameters"
            f"&filter=jobType:eq:{JOB_TYPE}&filter={query}"
        )["jobConfigurations"]

    def session_cookie(self):
        req = urllib.request.Request(
            f"{self.base}/api/me?fields=id",
            headers={"Authorization": self.auth},
        )
        with urllib.request.urlopen(req, timeout=60) as response:
            for header in response.headers.get_all("Set-Cookie") or []:
                name, _, value = header.split(";", 1)[0].partition("=")
                if name.strip() == "JSESSIONID":
                    return value.strip()
        raise SuiteError("login", "the server set no JSESSIONID cookie")


def install_app(api, config):
    boundary = uuid.uuid4().hex
    with open(config["zip"], "rb") as bundle:
        content = bundle.read()
    filename = os.path.basename(config["zip"])
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        "Content-Type: application/zip\r\n\r\n"
    ).encode() + content + f"\r\n--{boundary}--\r\n".encode()
    # urlopen raises on anything but 2xx: 201 on 2.42+, 204 before.
    api.request(
        "apps",
        method="POST",
        raw=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    apps = api.get("apps")
    matches = [a for a in apps if a.get("name") == config["app_name"]]
    if not matches:
        raise SuiteError("install", f"no app named {config['app_name']!r}")
    return config["app_key"] or matches[0]["key"]


# --------------------------------------------------------------------------
# Seeding and cleanup (TESTING.md, "Seeding and cleanup")

DELETE_ORDER = ("jobConfigurations", "users", "userGroups", "userRoles")


class State:
    """The record of what this run created, kept on the instance."""

    def __init__(self, api, run_id):
        self.api = api
        self.record = {"run": run_id, "objects": []}

    def add(self, kind, **ref):
        self.record["objects"].append({"type": kind, **ref})
        self.api.request(STATE_PATH, method="PUT", body=self.record)

    def create(self):
        try:
            self.api.post(STATE_PATH, self.record)
        except urllib.error.HTTPError as error:
            if error.code != 409:  # an empty record survived; reuse it
                raise
            self.api.request(STATE_PATH, method="PUT", body=self.record)

    def clean(self):
        """Delete everything the record lists, then the record."""
        try:
            record = self.api.get(STATE_PATH)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return []
            raise
        objects = record.get("objects", [])
        for kind in DELETE_ORDER:
            for ref in objects:
                if ref["type"] == kind:
                    delete_object(self.api, ref)
        self.api.delete(STATE_PATH)
        return objects


def delete_object(api, ref):
    if ref["type"] == "jobConfigurations":
        for job in api.jobs_named(ref["name"]):
            api.delete(f"jobConfigurations/{job['id']}")
    else:
        api.delete(f"{ref['type']}/{ref['id']}")


def months_ago(now, months):
    """The app's cutoff: calendar months back, clamped to the month's end."""
    index = now.year * 12 + now.month - 1 - months
    year, month = divmod(index, 12)
    last_day = calendar.monthrange(year, month + 1)[1]
    return now.replace(year=year, month=month + 1, day=min(now.day, last_day))


def tomorrow():
    return (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")


def api_date(moment):
    return moment.strftime("%Y-%m-%dT%H:%M:%S.000")


def seed(api, state, config):
    prefix = config["name_prefix"]
    now = datetime.now()
    old = api_date(now - timedelta(days=730))
    recent = api_date(now - timedelta(days=10))

    role_main = {"id": new_uid(), "name": f"{prefix} main role"}
    role_alt = {"id": new_uid(), "name": f"{prefix} alt role"}
    group = {"id": new_uid(), "name": f"{prefix} group"}
    for kind, obj in (
        ("userRoles", role_main),
        ("userRoles", role_alt),
        ("userGroups", group),
    ):
        state.add(kind, id=obj["id"])
        api.post(kind, obj)

    # name -> (lastLogin, extra role, in group, disabled)
    plan = {
        "olda": (old, False, True, False),
        "oldb": (old, False, True, False),
        "oldc": (old, True, False, False),
        "recent": (recent, False, False, False),
        "nevera": (None, False, False, False),
        "neverb": (None, True, False, False),
        "gone": (old, False, False, True),
    }
    users = {}
    for short, (last_login, alt, grouped, disabled) in plan.items():
        uid = new_uid()
        roles = [{"id": role_main["id"]}] + (
            [{"id": role_alt["id"]}] if alt else []
        )
        body = {
            "id": uid,
            "username": config["user_prefix"] + short,
            "password": PASSWORD,
            "firstName": "E2E",
            "surname": f"{prefix} {short}",
            "userRoles": roles,
            "disabled": disabled,
        }
        if last_login:
            body["lastLogin"] = last_login
        state.add("users", id=uid)
        api.post("users", body)
        users[short] = {"id": uid, "username": body["username"]}
    if grouped_ids := [users[s]["id"] for s, p in plan.items() if p[2]]:
        api.post(
            f"userGroups/{group['id']}/users",
            {"additions": [{"id": uid} for uid in grouped_ids]},
        )

    check_seed(api, config, users, plan, group)
    return {
        "users": users,
        "role_main": role_main,
        "role_alt": role_alt,
        "group": group,
    }


def check_seed(api, config, users, plan, group):
    """Read back what was seeded: the expected values come from here."""
    seeded = {
        u["username"]: u
        for u in api.users(
            [f"username:$like:{config['user_prefix']}"],
            fields="id,username,disabled,lastLogin,userGroups[id]",
        )
    }
    for short, (last_login, _, grouped, disabled) in plan.items():
        user = seeded.get(users[short]["username"])
        if user is None:
            raise SuiteError("seed", f"user {short} was not created")
        if bool(user.get("lastLogin")) != bool(last_login):
            raise SuiteError("seed", f"user {short} has the wrong lastLogin")
        if user["disabled"] != disabled:
            raise SuiteError("seed", f"user {short} has the wrong status")
        in_group = group["id"] in {g["id"] for g in user.get("userGroups", [])}
        if in_group != grouped:
            raise SuiteError("seed", f"user {short} has the wrong groups")


# --------------------------------------------------------------------------
# Browser helpers


class Ui:
    def __init__(self, page, app_key):
        self.page = page
        self.app_key = app_key
        self.frame = page.main_frame

    def find_frame(self):
        """The app runs in the global-shell iframe on 2.42+."""
        for frame in self.page.frames:
            if frame is not self.page.main_frame and (
                f"/api/apps/{self.app_key}/" in frame.url
                or f"/apps/{self.app_key}" in frame.url
            ):
                self.frame = frame
                return
        self.frame = self.page.main_frame

    def wait(self, check, message, timeout=15):
        deadline = time.monotonic() + timeout
        last = None
        while time.monotonic() < deadline:
            last = check()
            if last:
                return last
            self.page.wait_for_timeout(250)
        raise AssertionError(f"{message} (last value: {last!r})")

    def apply_filter(self):
        button = self.frame.get_by_role("button", name="Apply filter")
        with self.page.expect_response(
            lambda r: "/users?" in r.url and r.request.method == "GET",
            timeout=TIMEOUT_MS,
        ):
            button.click()
        self.wait(button.is_enabled, "the filter did not finish loading")
        self.frame.wait_for_selector(TABLE_ROWS, timeout=TIMEOUT_MS)

    def set_checkbox(self, label, checked):
        box = self.frame.get_by_label(label, exact=True)
        if box.is_checked() != checked:
            self.frame.get_by_text(label, exact=True).click()
        self.wait(lambda: box.is_checked() == checked, f"cannot set {label!r}")

    def set_filter(self, never=False, disabled=False, since=None):
        """Set the whole filter, so no test depends on an earlier one."""
        if since:
            self.choose_period("Since date")
            self.frame.locator(DATE_INPUT).fill(since)
        else:
            self.choose_period("Months")
            self.frame.locator("[data-test='filter-num-periods'] input").fill("6")
        self.set_checkbox(NEVER_LOGGED_IN, never)
        self.set_checkbox(INCLUDE_DISABLED, disabled)
        self.apply_filter()

    def search(self, text):
        self.frame.locator(SEARCH_INPUT).fill(text)
        self.page.wait_for_timeout(300)

    def usernames(self):
        return set(
            self.frame.eval_on_selector_all(
                "[data-test^='select-user-']",
                "els => els.map(e => e.getAttribute('data-test')"
                ".replace('select-user-', ''))",
            )
        )

    def expect_usernames(self, expected):
        self.wait(
            lambda: self.usernames() == expected,
            f"table rows are not {sorted(expected)}",
        )

    def total(self):
        text = self.frame.locator(PAGINATION_SUMMARY).inner_text()
        match = re.search(r"of\s+(\d+)\s*$", text.strip())
        if not match:
            raise AssertionError(f"cannot read the total from {text!r}")
        return int(match.group(1))

    def selection_count(self):
        return self.frame.get_by_text(SELECTION_COUNT).inner_text().strip()

    def row(self, username):
        return self.frame.locator(TABLE_ROWS).filter(
            has=self.frame.locator(f"[data-test='select-user-{username}']")
        )

    def row_checkbox(self, username):
        return self.frame.locator(f"[data-test='select-user-{username}'] input")

    def choose_period(self, label):
        select = self.frame.locator(PERIOD_TYPE)
        # Choosing the option that is already selected leaves the menu
        # open over the rest of the form.
        if select.inner_text().strip() == label:
            return
        select.click()
        self.frame.locator(SINGLE_OPTION, has_text=label).click()
        self.wait(
            lambda: select.inner_text().strip() == label,
            f"cannot choose {label!r}",
        )

    def toggle_option(self, select, name):
        self.frame.locator(select).click()
        self.frame.locator(MULTI_FILTER).fill(name)
        self.frame.locator(MULTI_OPTION, has_text=name).click()
        self.page.keyboard.press("Escape")
        self.page.wait_for_timeout(200)

    def modal_close(self, modal):
        return modal.locator(MODAL_ACTIONS).get_by_role("button", name="Close")


# --------------------------------------------------------------------------
# The suite


class Suite:
    def __init__(self, config, api):
        self.config = config
        self.api = api
        self.tests = []
        self.ui = None
        self.data = None
        self.label = config["label"]
        self.console_errors = []
        self.user_requests = 0
        self.job_name = f"{config['name_prefix']} job"
        self.job_id = None
        self.state = None

    # -- bookkeeping

    def run_test(self, test_id, func, needs=()):
        failed = [n for n in needs if self.status(n) != "pass"]
        if failed:
            self.record(test_id, "skip", f"needs {', '.join(failed)}")
            return
        try:
            message = func() or ""
            self.record(test_id, "pass", message)
        except Skip as reason:
            self.record(test_id, "skip", str(reason))
        except Exception as error:  # noqa: BLE001 - every failure is reported
            self.record(test_id, "fail", f"{type(error).__name__}: {error}")
            traceback.print_exc()
            self.screenshot(f"fail-{test_id}")
            self.recover()

    def record(self, test_id, status, message):
        self.tests.append({"id": test_id, "status": status, "message": message})
        print(f"[{status.upper()}] {test_id} {message}", flush=True)

    def status(self, test_id):
        for test in self.tests:
            if test["id"] == test_id:
                return test["status"]
        return None

    def screenshot(self, name):
        if self.ui is None:
            return
        path = os.path.join(self.config["results_dir"], f"{self.label}-{name}.png")
        try:
            self.ui.page.screenshot(path=path, full_page=True)
        except Exception:  # noqa: BLE001 - a screenshot is best effort
            pass

    def recover(self):
        """Reload the app after a failure, so later tests start clean."""
        try:
            self.open_app()
        except Exception:  # noqa: BLE001 - the next test reports it
            traceback.print_exc()

    # -- setup

    def open_app(self):
        page = self.ui.page
        page.goto(f"{self.config['base']}/api/apps/{self.ui.app_key}/index.html")
        page.wait_for_load_state("networkidle", timeout=60_000)
        self.ui.find_frame()
        self.ui.frame.wait_for_selector(TABLE_ROWS, timeout=60_000)

    def on_console(self, message):
        if message.type == "error" and not any(
            noise in message.text for noise in IGNORED_CONSOLE
        ):
            self.console_errors.append(message.text)

    def on_request(self, request):
        if "/users?" in request.url:
            self.user_requests += 1

    # -- tests

    def t_app_loads(self):
        self.open_app()
        self.screenshot("01-loaded")

    def t_default_filter(self):
        cutoff = months_ago(datetime.now(), 6).strftime("%Y-%m-%dT%H:%M:%S")
        expected = self.api.users(["disabled:eq:false", f"lastLogin:lt:{cutoff}"])
        total = self.ui.total()
        if total != len(expected):
            raise AssertionError(f"app shows {total}, API has {len(expected)}")
        self.search_seeded()
        self.ui.expect_usernames(self.seeded("olda", "oldb", "oldc"))
        return f"{total} users"

    def t_apply_refetches(self):
        before = self.user_requests
        self.ui.apply_filter()
        if self.user_requests <= before:
            raise AssertionError("Apply filter with the same filter sent no request")

    def t_never_logged_in(self):
        self.ui.set_filter(never=True)
        cutoff = months_ago(datetime.now(), 6).strftime("%Y-%m-%dT%H:%M:%S")
        inactive = self.api.users(["disabled:eq:false", f"lastLogin:lt:{cutoff}"])
        never = self.api.users(["disabled:eq:false", "lastLogin:null"])
        expected = {u["id"] for u in inactive} | {u["id"] for u in never}
        self.ui.search("")
        total = self.ui.total()
        if total != len(expected):
            raise AssertionError(f"app shows {total}, API has {len(expected)}")
        self.search_seeded()
        self.ui.expect_usernames(
            self.seeded("olda", "oldb", "oldc", "nevera", "neverb")
        )
        self.screenshot("02-never-logged-in")
        return f"{total} users"

    def t_select_all_respects_search(self):
        self.ui.search(self.config["user_prefix"] + "old")
        self.ui.expect_usernames(self.seeded("olda", "oldb", "oldc"))
        self.ui.frame.locator(SELECT_ALL).check(force=True)
        self.ui.wait(
            lambda: self.ui.selection_count() == "3 users selected",
            "select all did not select exactly the 3 rows that match",
        )
        self.ui.frame.locator(SELECT_ALL).uncheck(force=True)
        self.ui.wait(
            lambda: self.ui.selection_count() == "0 users selected",
            "clearing select all left users selected",
        )

    def t_sort_by_username(self):
        self.ui.set_filter(never=True)
        self.search_seeded()
        header = self.ui.frame.locator("th", has_text="Username")
        header.locator("button[title='Sort']").first.click()
        names = sorted(self.seeded("olda", "oldb", "oldc", "nevera", "neverb"))
        first = self.ui.frame.locator(f"{TABLE_ROWS} td:nth-child(2)").first
        self.ui.wait(
            lambda: first.inner_text().strip() == names[0],
            f"first row is not {names[0]} after sorting ascending",
        )
        header.locator("button[title='Sort']").first.click()
        self.ui.wait(
            lambda: first.inner_text().strip() == names[-1],
            f"first row is not {names[-1]} after sorting descending",
        )

    def t_role_filter(self):
        name = self.data["role_alt"]["name"]
        self.ui.toggle_option(ROLE_SELECT, name)
        self.ui.set_filter(never=True)
        self.search_seeded()
        self.ui.expect_usernames(self.seeded("oldc", "neverb"))
        self.ui.toggle_option(ROLE_SELECT, name)
        self.ui.apply_filter()

    def t_group_filter(self):
        name = self.data["group"]["name"]
        self.ui.toggle_option(GROUP_SELECT, name)
        self.ui.set_filter(never=True)
        self.search_seeded()
        self.ui.expect_usernames(self.seeded("olda", "oldb"))
        self.ui.toggle_option(GROUP_SELECT, name)
        self.ui.apply_filter()

    def t_since_date(self):
        self.ui.set_filter(never=True, since=tomorrow())
        self.search_seeded()
        self.ui.expect_usernames(
            self.seeded("olda", "oldb", "oldc", "recent", "nevera", "neverb")
        )

    def t_current_user_protected(self):
        me = self.config["user"]
        self.ui.set_filter(never=True, since=tomorrow())
        self.ui.search(me)
        self.ui.wait(lambda: me in self.ui.usernames(), f"{me} is not listed")
        row = self.ui.row(me)
        if not row.locator(CURRENT_USER_TAG).is_visible():
            raise AssertionError("the current user has no 'You' tag")
        if not self.ui.row_checkbox(me).is_disabled():
            raise AssertionError("the current user can be selected")
        if not row.get_by_role("button", name="Disable").is_disabled():
            raise AssertionError("the current user's Disable button is enabled")

    def t_include_disabled(self):
        self.ui.set_filter(disabled=True)
        gone = self.data["users"]["gone"]["username"]
        self.search_seeded()
        self.ui.wait(lambda: gone in self.ui.usernames(), "disabled user missing")
        row = self.ui.row(gone)
        if "Disabled" not in row.inner_text():
            raise AssertionError("the disabled user has no Disabled tag")
        if not self.ui.row_checkbox(gone).is_disabled():
            raise AssertionError("the disabled user can be selected")

    def t_info_modal(self):
        user = self.data["users"]["olda"]
        self.ui.set_filter()
        self.ui.search(user["username"])
        self.ui.row(user["username"]).get_by_role("button", name="Info").click()
        modal = self.ui.frame.locator(MODAL)
        for text in (
            user["username"],
            self.data["role_main"]["name"],
            self.data["group"]["name"],
        ):
            modal.get_by_text(text, exact=True).first.wait_for(timeout=TIMEOUT_MS)
        self.screenshot("03-info-modal")
        self.ui.modal_close(modal).click()

    def t_single_disable(self):
        user = self.data["users"]["olda"]
        self.ui.set_filter()
        self.ui.search(user["username"])
        row = self.ui.row(user["username"])
        row.get_by_role("button", name="Disable").click()
        modal = self.ui.frame.locator(DISABLE_MODAL)
        modal.get_by_text(f'User "{user["username"]}" will be disabled').wait_for(
            timeout=TIMEOUT_MS
        )
        modal.locator(CONFIRM_DISABLE).click()
        self.ui.modal_close(modal).wait_for(timeout=TIMEOUT_MS)
        summary = modal.inner_text()
        self.screenshot("04-single-disable-summary")
        self.ui.modal_close(modal).click()
        if "1 user was successfully disabled" not in summary:
            raise AssertionError(f"summary says: {summary!r}")
        if not self.api.user(user["id"])["disabled"]:
            raise AssertionError("the API shows the user still enabled")
        # The list refetches: a disabled user leaves the default filter.
        self.ui.wait(
            lambda: user["username"] not in self.ui.usernames(),
            "the disabled user is still listed",
        )

    def t_bulk_disable(self):
        targets = [self.data["users"][s] for s in ("oldb", "nevera")]
        self.ui.set_filter(never=True)
        for user in targets:
            self.ui.search(user["username"])
            self.ui.row_checkbox(user["username"]).check(force=True)
        self.ui.search("")
        self.ui.wait(
            lambda: self.ui.selection_count() == "2 users selected",
            "the selection did not survive the searches",
        )
        self.ui.frame.locator(BULK_DISABLE).click()
        modal = self.ui.frame.locator(DISABLE_MODAL)
        modal.get_by_text("2 users will be disabled").wait_for(timeout=TIMEOUT_MS)
        modal.locator(CONFIRM_DISABLE).click()
        self.ui.modal_close(modal).wait_for(timeout=60_000)
        summary = modal.inner_text()
        self.screenshot("05-bulk-summary")
        self.ui.modal_close(modal).click()
        if "2 users were successfully disabled" not in summary:
            raise AssertionError(f"summary says: {summary!r}")
        still_enabled = [
            u["username"] for u in targets if not self.api.user(u["id"])["disabled"]
        ]
        if still_enabled:
            raise AssertionError(f"the API shows {still_enabled} still enabled")
        self.ui.wait(
            lambda: self.ui.selection_count() == "0 users selected",
            "disabled users stayed selected",
        )

    def t_untouched_users(self):
        """Users the suite did not disable must still be enabled."""
        for short in ("oldc", "recent", "neverb"):
            if self.api.user(self.data["users"][short]["id"])["disabled"]:
                raise AssertionError(f"{short} was disabled")

    def existing_jobs(self):
        return self.api.get(
            f"jobConfigurations?filter=jobType:eq:{JOB_TYPE}&fields=id&paging=false"
        )["jobConfigurations"]

    def t_job_form_validation(self):
        if self.existing_jobs():
            raise Skip("the instance already has a job of this type")
        self.ui.frame.locator(ADD_JOB).click()
        modal = self.ui.frame.locator(JOB_MODAL)
        modal.locator("input[name='inactiveMonths']").fill("30")
        modal.locator("input[name='reminderDaysBefore']").fill("0")
        modal.locator(JOB_SUBMIT).click()
        modal.get_by_text("Enter a number from 1 to 24").wait_for(timeout=TIMEOUT_MS)
        modal.get_by_text("Enter a number from 1 to 28").wait_for(timeout=TIMEOUT_MS)
        modal.get_by_role("button", name="Cancel").click()
        if self.existing_jobs():
            raise AssertionError("an invalid job was created")

    def t_create_job(self):
        if self.existing_jobs():
            # The app offers Add job only when there is none.
            raise Skip("the instance already has a job of this type")
        # The UI assigns the UID, so the record names the job instead.
        self.state.add("jobConfigurations", name=self.job_name)
        self.ui.frame.locator(ADD_JOB).click()
        modal = self.ui.frame.locator(JOB_MODAL)
        modal.locator("input[name='name']").fill(self.job_name)
        modal.locator(JOB_SUBMIT).click()
        jobs = self.ui.wait(
            lambda: self.api.jobs_named(self.job_name),
            "the job was not created",
            timeout=30,
        )
        job = jobs[0]
        self.job_id = job["id"]
        params = job["jobParameters"]
        if not job["enabled"] or params.get("inactiveMonths") != 6:
            raise AssertionError(f"unexpected job: {json.dumps(job)}")
        if params.get("reminderDaysBefore") != 7:
            raise AssertionError(f"unexpected job: {json.dumps(job)}")
        self.ui.frame.get_by_text(self.job_name).wait_for(timeout=TIMEOUT_MS)
        self.screenshot("06-job-created")

    def t_toggle_job(self):
        self.ui.frame.locator(JOB_SWITCH).first.click(force=True)
        self.ui.wait(
            lambda: self.api.get(
                f"jobConfigurations/{self.job_id}?fields=enabled"
            )["enabled"]
            is False,
            "the job is still enabled",
            timeout=30,
        )

    def t_no_console_errors(self):
        if self.console_errors:
            raise AssertionError("; ".join(self.console_errors[:3]))

    # -- helpers for tests

    def seeded(self, *shorts):
        return {self.data["users"][s]["username"] for s in shorts}

    def search_seeded(self):
        self.ui.search(self.config["user_prefix"])

    def run_browser_tests(self, playwright, app_key):
        browser = playwright.chromium.launch(headless=True)
        try:
            context = browser.new_context(viewport={"width": 1440, "height": 900})
            context.add_cookies(
                [
                    {
                        "name": "JSESSIONID",
                        "value": self.api.session_cookie(),
                        "url": self.config["base"],
                    }
                ]
            )
            page = context.new_page()
            page.set_default_timeout(TIMEOUT_MS)
            page.on("console", self.on_console)
            page.on("pageerror", lambda e: self.console_errors.append(str(e)))
            page.on("request", self.on_request)
            self.ui = Ui(page, app_key)
            self.run_test("app-loads", self.t_app_loads)
            steps = [
                ("default-filter", self.t_default_filter),
                ("apply-refetches", self.t_apply_refetches),
                ("never-logged-in", self.t_never_logged_in),
                ("select-all-respects-search", self.t_select_all_respects_search),
                ("sort-by-username", self.t_sort_by_username),
                ("filter-by-role", self.t_role_filter),
                ("filter-by-group", self.t_group_filter),
                ("since-date", self.t_since_date),
                ("current-user-protected", self.t_current_user_protected),
                ("include-disabled", self.t_include_disabled),
                ("info-modal", self.t_info_modal),
                ("disable-single", self.t_single_disable),
                ("disable-bulk", self.t_bulk_disable),
                ("others-untouched", self.t_untouched_users),
                ("job-form-validation", self.t_job_form_validation),
                ("job-create", self.t_create_job),
            ]
            for test_id, func in steps:
                self.run_test(test_id, func, needs=("app-loads",))
            self.run_test("job-toggle", self.t_toggle_job, needs=("job-create",))
            self.run_test("no-console-errors", self.t_no_console_errors)
            self.screenshot("07-final")
        finally:
            browser.close()


# --------------------------------------------------------------------------
# Main


def write_results(config, started, tests, server_version, app_key, error=None):
    counts = {s: sum(1 for t in tests if t["status"] == s) for s in ("pass", "fail", "skip")}
    results = {
        "contract_version": CONTRACT_VERSION,
        "label": config.get("label", ""),
        "server_version": server_version,
        "app_key": app_key,
        "app_version": config.get("app_version", ""),
        "duration_s": round(time.monotonic() - started),
        "total": len(tests),
        "passed": counts["pass"],
        "failed": counts["fail"],
        "skipped": counts["skip"],
        "tests": tests,
    }
    if error:
        results["error"] = error
    path = os.path.join(config["results_dir"], "results.json")
    with open(path, "w", encoding="utf-8") as out:
        json.dump(results, out, indent=2)
    print(f"\n{counts['pass']}/{len(tests)} passed, {counts['fail']} failed, "
          f"{counts['skip']} skipped. Results in {path}")


def run(config, started):
    api = Api(config["base"], config["user"], config["password"])
    stage = "connect"
    server_version, app_key, suite = "", config["app_key"], None
    try:
        server_version = api.get("system/info")["version"]
        config["label"] = config["label"] or server_version

        stage = "cleanup of an earlier run"
        state = State(api, config["run_id"])
        if leftovers := state.clean():
            print(f"Deleted {len(leftovers)} objects left by an earlier run")

        stage = "install"
        app_key = install_app(api, config)

        stage = "seed"
        state.create()
        suite = Suite(config, api)
        suite.state = state
        suite.data = seed(api, state, config)

        stage = "browser"
        from playwright.sync_api import sync_playwright

        with sync_playwright() as playwright:
            suite.run_browser_tests(playwright, app_key)
        stage = "cleanup"
    except SuiteError as error:
        return finish(config, started, suite, server_version, app_key, str(error), api)
    except Exception as error:  # noqa: BLE001 - reported as a setup error
        traceback.print_exc()
        message = f"{stage}: {type(error).__name__}: {error}"
        return finish(config, started, suite, server_version, app_key, message, api)
    return finish(config, started, suite, server_version, app_key, None, api)


def finish(config, started, suite, server_version, app_key, error, api):
    """Clean up whether the tests passed or failed, then report."""
    cleanup_error = None
    try:
        State(api, config["run_id"]).clean()
        if app_key:
            api.delete(f"apps/{app_key}")
    except Exception as exc:  # noqa: BLE001 - reported below
        traceback.print_exc()
        cleanup_error = f"cleanup: {type(exc).__name__}: {exc}"
    tests = suite.tests if suite and not error else []
    error = error or cleanup_error
    write_results(config, started, tests, server_version, app_key, error)
    if error:
        print(f"ERROR {error}", file=sys.stderr)
        return 2
    return 1 if any(t["status"] == "fail" for t in tests) else 0


def main():
    started = time.monotonic()
    try:
        config = read_config()
    except Exception as error:  # noqa: BLE001 - any failure here is setup
        print(f"ERROR reading the inputs: {error}", file=sys.stderr)
        return 2
    return run(config, started)


if __name__ == "__main__":
    sys.exit(main())

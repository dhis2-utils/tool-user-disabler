#!/usr/bin/env bash
# Entry point for the end-to-end suite (contract version 1, see e2e/README.md).
#
# The suite changes and deletes data. Run it only against a throwaway DHIS2
# instance. There are deliberately no defaults for the instance or the
# credentials.
#
#   DHIS2_URL=http://localhost:8080 DHIS2_USER=admin DHIS2_PASS=district \
#   APP_ZIP="$PWD/build/bundle/tool-user-disabler-1.0.0.zip" \
#   RESULTS_DIR=/tmp/e2e-results e2e/run.sh
#
# Exit codes: 0 all tests passed, 1 a test failed, 2 the suite could not run.
set -u

fail_setup() {
    echo "e2e/run.sh: $1" >&2
    if [ -n "${RESULTS_DIR:-}" ] && [ -d "${RESULTS_DIR}" ]; then
        printf '{"contract_version": 1, "label": "%s", "error": "setup: %s", "total": 0, "passed": 0, "failed": 0, "skipped": 0, "tests": []}\n' \
            "${LABEL:-}" "$1" > "${RESULTS_DIR}/results.json"
    fi
    exit 2
}

for var in DHIS2_URL DHIS2_USER DHIS2_PASS APP_ZIP RESULTS_DIR; do
    [ -n "${!var:-}" ] || fail_setup "$var is required"
done
[ -d "$RESULTS_DIR" ] || fail_setup "RESULTS_DIR must be an existing directory"
case "$APP_ZIP" in
    /*) ;;
    *) fail_setup "APP_ZIP must be an absolute path" ;;
esac
[ -f "$APP_ZIP" ] || fail_setup "APP_ZIP does not exist: $APP_ZIP"
command -v python3 > /dev/null || fail_setup "python3 is not installed"
python3 -c 'import playwright' 2> /dev/null ||
    fail_setup "Playwright for Python is missing: pip install -r e2e/requirements.txt && python3 -m playwright install chromium"

export DHIS2_URL="${DHIS2_URL%/}"
exec python3 "$(dirname "$0")/suite.py"

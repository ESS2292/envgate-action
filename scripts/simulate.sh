#!/usr/bin/env bash
# Local simulation of the action as the runner would call it:
# inputs arrive as INPUT_<NAME> env vars; summary/outputs go to files.
set -u
cd "$(dirname "$0")/.."
TMP="$(mktemp -d)"
# Use the real binary: shell wrappers (e.g. version managers) can drop hyphenated env names.
NODE_BIN="$(node -p process.execPath)"
run_case() {
  local label="$1"; shift
  : > "$TMP/summary.md"; : > "$TMP/output.txt"
  echo "=== $label ==="
  env -i PATH="$PATH" GITHUB_WORKSPACE="$PWD" \
    GITHUB_STEP_SUMMARY="$TMP/summary.md" GITHUB_OUTPUT="$TMP/output.txt" \
    "$@" "$NODE_BIN" src/main.js
  echo "exit code: $?"
  echo "--- outputs ---"; cat "$TMP/output.txt"
  echo "--- step summary ---"; cat "$TMP/summary.md"; echo
}
run_case "PASS: env file" INPUT_EXAMPLE=test/fixtures/.env.example INPUT_ENV-FILE=test/fixtures/complete.env INPUT_FAIL-ON-EMPTY=true
run_case "PASS: job env vars only" INPUT_EXAMPLE=test/fixtures/.env.example APP_NAME=demo DATABASE_URL=postgres://x API_KEY=secret-should-not-print
run_case "FAIL: missing key" INPUT_EXAMPLE=test/fixtures/.env.example INPUT_ENV-FILE=test/fixtures/partial.env
run_case "FAIL: empty key (fail-on-empty)" INPUT_EXAMPLE=test/fixtures/.env.example INPUT_ENV-FILE=test/fixtures/partial.env INPUT_FAIL-ON-EMPTY=true DATABASE_URL=postgres://x
run_case "FAIL: missing example file" INPUT_EXAMPLE=does-not-exist
rm -rf "$TMP"

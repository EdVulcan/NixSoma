#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

# Keep the argument-shape assertions independent of a developer's persisted
# operator credential used by real milestone services.
export OPENCLAW_OPERATOR_TOKEN_FILE=/dev/null

LAST_CURL_ARGS=()

openclaw_execute_curl() {
  LAST_CURL_ARGS=("$@")
}

assert_args() {
  local label="$1"
  shift
  local expected=("$@")
  if (( ${#LAST_CURL_ARGS[@]} != ${#expected[@]} )); then
    echo "$label: expected ${#expected[@]} args, got ${#LAST_CURL_ARGS[@]}" >&2
    printf 'actual: %q\n' "${LAST_CURL_ARGS[@]}" >&2
    exit 1
  fi
  local index=0
  for index in "${!expected[@]}"; do
    if [[ "${LAST_CURL_ARGS[$index]}" != "${expected[$index]}" ]]; then
      echo "$label: arg $index expected '${expected[$index]}', got '${LAST_CURL_ARGS[$index]}'" >&2
      exit 1
    fi
  done
}

export OPENCLAW_CORE_PORT=4100
export OPENCLAW_OPERATOR_TOKEN=operator-test-secret
curl --silent --fail "http://127.0.0.1:4100/tasks?limit=1"
assert_args core-read \
  --silent --fail "http://127.0.0.1:4100/tasks?limit=1" -H "authorization: Bearer operator-test-secret"

operator_token_file="$(mktemp)"
printf '%s\n' file-backed-secret > "$operator_token_file"
export OPENCLAW_OPERATOR_TOKEN_FILE="$operator_token_file"
curl --silent --fail "http://127.0.0.1:4100/tasks?limit=1"
assert_args core-read-file-first \
  --silent --fail "http://127.0.0.1:4100/tasks?limit=1" -H "authorization: Bearer file-backed-secret"
rm -f "$operator_token_file"
export OPENCLAW_OPERATOR_TOKEN_FILE=/dev/null

curl --silent --fail "http://127.0.0.1:4101/events/audit?limit=1"
assert_args non-core-read --silent --fail "http://127.0.0.1:4101/events/audit?limit=1"

unset OPENCLAW_OPERATOR_TOKEN

unset OPENCLAW_POST_JSON_FAILURE OPENCLAW_POST_JSON_PAYLOAD_MODE OPENCLAW_POST_JSON_DATA_FLAG
post_json "http://127.0.0.1/default" '{"ok":true}'
assert_args default \
  --silent --fail -X POST "http://127.0.0.1/default" -H "content-type: application/json" --data '{"ok":true}'

OPENCLAW_POST_JSON_DATA_FLAG="-d"
post_json "http://127.0.0.1/d" '{"ok":true}'
assert_args data-flag-d \
  --silent --fail -X POST "http://127.0.0.1/d" -H "content-type: application/json" -d '{"ok":true}'

OPENCLAW_POST_JSON_FAILURE="allow"
post_json "http://127.0.0.1/allow" '{"ok":true}'
assert_args allow \
  --silent -X POST "http://127.0.0.1/allow" -H "content-type: application/json" -d '{"ok":true}'

OPENCLAW_POST_JSON_FAILURE="fail-with-body"
post_json "http://127.0.0.1/fail-with-body" '{"ok":true}'
assert_args fail-with-body \
  --silent --show-error --fail-with-body -X POST "http://127.0.0.1/fail-with-body" -H "content-type: application/json" -d '{"ok":true}'

OPENCLAW_POST_JSON_FAILURE="fail"
OPENCLAW_POST_JSON_PAYLOAD_MODE="file"
post_json "http://127.0.0.1/file" "/tmp/openclaw-body.json"
assert_args file \
  --silent --fail -X POST "http://127.0.0.1/file" -H "content-type: application/json" --data-binary "@/tmp/openclaw-body.json"

echo "OpenClaw HTTP JSON helper curl modes validated."

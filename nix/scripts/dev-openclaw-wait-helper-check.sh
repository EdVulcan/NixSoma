#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-wait-helper.sh"

WAIT_INTERVALS=()
openclaw_wait_interval() {
  WAIT_INTERVALS+=("${1:-0.2}")
}

attempts=0
succeeds_after_three() {
  attempts=$((attempts + 1))
  (( attempts >= 3 ))
}

openclaw_wait_until 5 0.1 succeeds_after_three
if (( attempts != 3 || ${#WAIT_INTERVALS[@]} != 2 )); then
  echo "wait_until should retry until the predicate succeeds." >&2
  exit 1
fi

CURL_MODE="up"
curl() {
  if [[ "$CURL_MODE" == "up" ]]; then
    return 0
  fi
  return 22
}

openclaw_wait_for_http_up "http://127.0.0.1/health" 1 0.1
CURL_MODE="down"
openclaw_wait_for_http_down "http://127.0.0.1/health" 1 0.1

SUMMARY_FILE="$(mktemp)"
cleanup() {
  rm -f "$SUMMARY_FILE"
}
trap cleanup EXIT

curl() {
  printf '%s\n' '{"summary":{"counts":{"expired":1,"pending":0}}}'
}

openclaw_wait_for_approval_summary_counts "http://127.0.0.1:4100" "$SUMMARY_FILE" 1 0 1 0.1

echo "OpenClaw wait helper predicates validated."

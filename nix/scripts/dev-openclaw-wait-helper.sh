#!/usr/bin/env bash

openclaw_wait_interval() {
  local interval="${1:-0.2}"
  sleep "$interval"
}

openclaw_wait_until() {
  local timeout="$1"
  local interval="$2"
  shift 2
  local deadline=$((SECONDS + timeout))
  while (( SECONDS < deadline )); do
    if "$@"; then
      return 0
    fi
    openclaw_wait_interval "$interval"
  done
  "$@"
}

openclaw_http_up() {
  local url="$1"
  curl --silent --fail "$url" >/dev/null 2>&1
}

openclaw_http_down() {
  local url="$1"
  ! openclaw_http_up "$url"
}

openclaw_wait_for_http_up() {
  local url="$1"
  local timeout="${2:-30}"
  local interval="${3:-0.4}"
  openclaw_wait_until "$timeout" "$interval" openclaw_http_up "$url"
}

openclaw_wait_for_http_down() {
  local url="$1"
  local timeout="${2:-5}"
  local interval="${3:-0.2}"
  openclaw_wait_until "$timeout" "$interval" openclaw_http_down "$url"
}

openclaw_approval_summary_counts_match() {
  local core_url="$1"
  local output_file="$2"
  local expected_expired="$3"
  local expected_pending="$4"
  curl --silent --fail "$core_url/approvals/summary" > "$output_file" \
    && node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); const expired=Number(process.argv[2]); const pending=Number(process.argv[3]); process.exit(data.summary?.counts?.expired === expired && data.summary?.counts?.pending === pending ? 0 : 1);' "$output_file" "$expected_expired" "$expected_pending"
}

openclaw_wait_for_approval_summary_counts() {
  local core_url="$1"
  local output_file="$2"
  local expected_expired="$3"
  local expected_pending="$4"
  local timeout="${5:-3}"
  local interval="${6:-0.05}"
  openclaw_wait_until "$timeout" "$interval" openclaw_approval_summary_counts_match "$core_url" "$output_file" "$expected_expired" "$expected_pending"
}

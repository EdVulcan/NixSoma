#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-7100}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-7101}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-7102}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-7103}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-7104}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-7105}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-7106}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-7107}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-7170}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-capability-history-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-capability-history-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
EVENT_HUB_URL="http://127.0.0.1:$OPENCLAW_EVENT_HUB_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${VITALS_FILE:-}" \
    "${BLOCKED_FILE:-}" \
    "${APPROVED_FILE:-}" \
    "${BEFORE_HISTORY_FILE:-}" \
    "${BEFORE_SUMMARY_FILE:-}" \
    "${AFTER_HISTORY_FILE:-}" \
    "${EVENTS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


"$SCRIPT_DIR/dev-up.sh"

VITALS_FILE="$(mktemp)"
BLOCKED_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
BEFORE_HISTORY_FILE="$(mktemp)"
BEFORE_SUMMARY_FILE="$(mktemp)"
AFTER_HISTORY_FILE="$(mktemp)"
EVENTS_FILE="$(mktemp)"

post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.system.vitals","intent":"system.observe"}' > "$VITALS_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.system.command.dry_run","intent":"system.command","params":{"command":"rm","args":["-rf","/tmp/openclaw-danger"]}}' > "$BLOCKED_FILE"
post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.system.command.dry_run","intent":"system.command","approved":true,"params":{"command":"rm","args":["-rf","/tmp/openclaw-danger"]}}' > "$APPROVED_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$BEFORE_HISTORY_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations/summary" > "$BEFORE_SUMMARY_FILE"

"$SCRIPT_DIR/dev-down.sh" >/dev/null
"$SCRIPT_DIR/dev-up.sh" >/dev/null

curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$AFTER_HISTORY_FILE"
curl --silent --fail "$EVENT_HUB_URL/events/audit?source=openclaw-core&limit=80" > "$EVENTS_FILE"

node - <<'EOF' \
  "$VITALS_FILE" \
  "$BLOCKED_FILE" \
  "$APPROVED_FILE" \
  "$BEFORE_HISTORY_FILE" \
  "$BEFORE_SUMMARY_FILE" \
  "$AFTER_HISTORY_FILE" \
  "$EVENTS_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));
const vitals = readJson(2);
const blocked = readJson(3);
const approved = readJson(4);
const beforeHistory = readJson(5);
const beforeSummary = readJson(6);
const afterHistory = readJson(7);
const events = readJson(8);

for (const response of [vitals, blocked, approved]) {
  if (!response.ok || !response.invocation?.id || !response.invocation?.at) {
    throw new Error("capability invoke response should include a durable invocation record");
  }
}
if (vitals.invocation.capability?.id !== "sense.system.vitals" || vitals.invocation.invoked !== true) {
  throw new Error("vitals invocation should be recorded as invoked");
}
if (blocked.invocation.capability?.id !== "act.system.command.dry_run" || blocked.invocation.blocked !== true || blocked.invocation.reason !== "approval_task_required") {
  throw new Error("unbound command dry-run should be recorded with the server approval requirement");
}
if (approved.invocation.blocked !== true || approved.invocation.reason !== "approval_task_required" || approved.invocation.policy?.decision !== "require_approval") {
  throw new Error("client approved command dry-run history should remain blocked without a bound task");
}

const beforeItems = beforeHistory.items ?? [];
const afterItems = afterHistory.items ?? [];
if (beforeHistory.summary?.total !== 3 || beforeHistory.summary?.invoked !== 1 || beforeHistory.summary?.blocked !== 2) {
  throw new Error(`unexpected capability history summary before restart: ${JSON.stringify(beforeHistory.summary)}`);
}
if (beforeSummary.summary?.total !== beforeHistory.summary?.total) {
  throw new Error("summary endpoint should match history endpoint summary");
}
if (afterHistory.summary?.total !== 3 || afterHistory.summary?.invoked !== 1 || afterHistory.summary?.blocked !== 2) {
  throw new Error(`capability invocation history did not survive restart: ${JSON.stringify(afterHistory.summary)}`);
}

const beforeIds = new Set(beforeItems.map((item) => item.id));
for (const item of afterItems) {
  if (!beforeIds.has(item.id)) {
    throw new Error("restored capability invocation ids should match pre-restart history");
  }
}

const eventTypes = new Set((events.items ?? []).map((event) => event.type));
for (const type of ["capability.invoked", "capability.blocked"]) {
  if (!eventTypes.has(type)) {
    throw new Error(`audit log missing ${type}`);
  }
}

console.log(JSON.stringify({
  capabilityHistory: {
    stateFile: process.env.OPENCLAW_CORE_STATE_FILE ?? null,
    before: beforeHistory.summary,
    after: afterHistory.summary,
    restored: afterItems.length,
  },
  examples: {
    vitalsInvocation: vitals.invocation.id,
    blockedReason: blocked.invocation.reason,
    approvedWithoutBinding: approved.invocation.reason === "approval_task_required",
  },
  auditEvents: [...eventTypes].filter((type) => type.startsWith("capability.")),
}, null, 2));
EOF

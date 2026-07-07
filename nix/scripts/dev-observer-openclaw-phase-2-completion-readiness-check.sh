#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6574}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6575}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6576}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6577}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6578}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6579}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6580}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6581}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6644}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-phase-2-completion-readiness-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-phase-2-completion-readiness-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"
. "$SCRIPT_DIR/dev-body-evidence-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


prepare_body_evidence_ledger_demo_status_prereq_state "$SCRIPT_DIR" "$REPO_ROOT" "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$LEDGER_DIR" || true

"$SCRIPT_DIR/dev-up.sh"

created_repair="$(post_json "$CORE_URL/system/systemd/repair-execution-tasks" '{"unit":"openclaw-browser-runtime.service","confirm":true,"execute":true}')"
repair_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_repair")"
post_json "$CORE_URL/approvals/$repair_approval_id/approve" '{"approvedBy":"observer-milestone-check","reason":"Prepare first Track A repair demo evidence before observer Phase 2 completion readiness."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare observer Phase 2 completion readiness."
created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/followup-record-tasks" '{"confirm":true}')"
record_task_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.task.id)' "$created_record_task")"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/body/evidence-ledger/followup-record-append" "{\"confirm\":true,\"taskId\":\"$record_task_id\"}" >/dev/null
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"observer-milestone-check","reason":"Approve follow-up append before observer Phase 2 completion readiness."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null
readiness="$(curl --silent --fail "$CORE_URL/phase-2/completion-readiness")"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$readiness"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const readiness = JSON.parse(process.argv[4]);

for (const token of [
  "Phase 2 Completion Readiness",
  "phase2-completion-readiness-panel",
  "phase2-completion-readiness-ready",
  "phase2-completion-readiness-checks",
  "phase2-completion-readiness-percent",
  "phase2-completion-readiness-mutation",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of [
  "/phase-2/completion-readiness",
  "refreshPhase2CompletionReadiness",
  "phase2CompletionReadinessReady",
  "openclaw-phase-2-completion-readiness-v0",
  "completionPercent",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (!readiness.ok
  || readiness.registry !== "openclaw-phase-2-completion-readiness-v0"
  || readiness.summary?.ready !== true
  || readiness.summary?.completionPercent !== 100
  || readiness.summary?.durableBodyMemoryRecords !== 2
  || readiness.governance?.createsTask !== false
  || readiness.governance?.mutatesHost !== false) {
  throw new Error(`Observer completion readiness should be read-only and 100% ready: ${JSON.stringify(readiness)}`);
}

console.log(JSON.stringify({
  observerOpenClawPhase2CompletionReadiness: {
    status: "passed",
    panel: "Phase 2 Completion Readiness",
    registry: readiness.registry,
    completionPercent: readiness.summary?.completionPercent,
    durableBodyMemoryRecords: readiness.summary?.durableBodyMemoryRecords,
  },
}, null, 2));
EOF

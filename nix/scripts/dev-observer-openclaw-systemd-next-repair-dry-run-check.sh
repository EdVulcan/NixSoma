#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6650}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6651}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6652}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6653}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6654}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6655}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6656}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6657}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6720}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-systemd-next-repair-dry-run-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-systemd-next-repair-dry-run-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"
. "$SCRIPT_DIR/dev-body-evidence-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-up.sh"

prepare_body_evidence_timeline_readiness "$CORE_URL" "Approve one next repair execution before observer next repair dry-run."

created_directory="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
directory_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_directory")"
post_json "$CORE_URL/approvals/$directory_approval_id/approve" '{"approvedBy":"observer-milestone-check","reason":"Approve bounded ledger directory creation before observer next repair dry-run."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/first-record-tasks" '{"confirm":true}')"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"observer-milestone-check","reason":"Approve one bounded bootstrap append before observer next repair dry-run."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
envelope="$(curl --silent --fail "$SYSTEM_URL/system/systemd/next-repair-dry-run")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$envelope"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const envelope = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Next Repair Dry Run",
  "systemd-next-repair-dry-run-panel",
  "systemd-next-repair-dry-run-target",
  "systemd-next-repair-dry-run-mode",
  "systemd-next-repair-dry-run-would-execute",
  "systemd-next-repair-dry-run-mutation",
  "systemd-next-repair-dry-run-json",
];
const requiredClient = [
  "/system/systemd/next-repair-dry-run",
  "refreshSystemdNextRepairDryRun",
  "systemdNextRepairDryRunTarget",
  "systemdNextRepairDryRunMode",
  "systemdNextRepairDryRunWouldExecute",
  "systemdNextRepairDryRunMutation",
  "systemdNextRepairDryRunJson",
  "no_restart_executed",
  "openclaw-systemd-next-repair-task-route",
];

for (const token of requiredHtml) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of requiredClient) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (!envelope.ok || envelope.registry !== "openclaw-systemd-next-repair-dry-run-v0") {
  throw new Error(`Observer source should expose next repair dry-run registry: ${JSON.stringify(envelope)}`);
}
if (envelope.target?.unit !== "openclaw-system-sense.service"
  || envelope.dryRun?.wouldExecute !== false
  || envelope.dryRun?.command !== "systemctl"
  || !envelope.dryRun?.args?.includes("openclaw-system-sense.service")) {
  throw new Error(`Observer next repair dry-run should expose no-execute system-sense command: ${JSON.stringify(envelope.dryRun)}`);
}
if (!envelope.dryRun?.checks?.some((check) => check.name === "operator_visible_before_mutation" && check.passed === true)
  || !envelope.dryRun?.checks?.some((check) => check.name === "no_restart_executed" && check.passed === true)) {
  throw new Error(`Observer next repair dry-run should show visible no-restart checks: ${JSON.stringify(envelope.dryRun?.checks)}`);
}
if (envelope.governance?.createsTask !== false
  || envelope.governance?.createsApproval !== false
  || envelope.governance?.executesCommand !== false
  || envelope.governance?.hostMutation !== false
  || envelope.governance?.canRestart !== false) {
  throw new Error(`Observer next repair dry-run must remain non-mutating: ${JSON.stringify(envelope.governance)}`);
}

console.log(JSON.stringify({
  observerOpenClawSystemdNextRepairDryRun: {
    status: "passed",
    panel: "Next Repair Dry Run",
    registry: envelope.registry,
    target: envelope.target?.unit,
    next: envelope.next?.recommendedSlice,
  },
}, null, 2));
EOF

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6650}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6651}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6652}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6653}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6654}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6655}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6656}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6657}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6720}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-next-repair-demo-status-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-next-repair-demo-status-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
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
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-up.sh"

prepare_body_evidence_timeline_readiness "$CORE_URL" "Approve one next repair execution before next repair demo status."

created_directory="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
directory_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_directory")"
post_json "$CORE_URL/approvals/$directory_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before next repair demo status."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/first-record-tasks" '{"confirm":true}')"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one bounded bootstrap append before next repair demo status."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

created="$(post_json "$CORE_URL/system/systemd/next-repair-tasks" '{"confirm":true,"execute":true}')"
approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created")"
post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one next repair execution before read-only demo status."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null
status="$(curl --silent --fail "$CORE_URL/phase-2/next-repair-demo-status")"

node - <<'EOF' "$PLAN_FILE" "$status"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const status = JSON.parse(process.argv[3]);

for (const token of [
  "Systemd next repair demo status checkpoint",
  "openclaw-systemd-next-repair-demo-status",
  "Reads task history only",
  "Creates no task, no approval, no command execution",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing next repair demo status token: ${token}`);
  }
}

if (!status.ok || status.registry !== "openclaw-systemd-next-repair-demo-status-v0") {
  throw new Error(`next repair demo status should expose expected registry: ${JSON.stringify(status)}`);
}
if (status.mode !== "read_only_next_repair_demo_status" || status.status !== "demo_ready") {
  throw new Error(`next repair demo status should be read-only and ready: ${JSON.stringify(status)}`);
}
if (status.summary?.ready !== true
  || status.summary?.targetUnit !== "openclaw-system-sense.service"
  || status.summary?.command !== "systemctl restart openclaw-system-sense.service"
  || status.summary?.hostMutationAttempted !== true) {
  throw new Error(`next repair demo summary should cite system-sense execution evidence: ${JSON.stringify(status.summary)}`);
}
if (!Number.isInteger(status.summary?.exitCode)) {
  throw new Error(`next repair demo status should carry a real exit code: ${JSON.stringify(status.summary)}`);
}
if (status.governance?.readsTaskHistoryOnly !== true
  || status.governance?.createsTask !== false
  || status.governance?.createsApproval !== false
  || status.governance?.executesCommand !== false
  || status.governance?.hostMutation !== false
  || status.governance?.triggersRecovery !== false) {
  throw new Error(`next repair demo status should be read-only: ${JSON.stringify(status.governance)}`);
}
if (status.evidence?.systemdNextRepair?.target?.unit !== "openclaw-system-sense.service"
  || status.evidence?.commandTranscript?.command !== "systemctl restart openclaw-system-sense.service"
  || !status.evidence?.postExecutionVerification?.summary
  || typeof status.evidence?.rollbackNote !== "string") {
  throw new Error(`next repair demo status should bundle execution evidence: ${JSON.stringify(status.evidence)}`);
}
if (status.next?.recommendedSlice !== "openclaw-body-evidence-timeline") {
  throw new Error(`next repair demo status should return to body evidence timeline: ${JSON.stringify(status.next)}`);
}

console.log(JSON.stringify({
  openclawSystemdNextRepairDemoStatus: {
    status: "passed",
    registry: status.registry,
    target: status.summary.targetUnit,
    outcome: status.summary.outcome,
    command: status.summary.command,
    exitCode: status.summary.exitCode,
    next: status.next.recommendedSlice,
  },
}, null, 2));
EOF

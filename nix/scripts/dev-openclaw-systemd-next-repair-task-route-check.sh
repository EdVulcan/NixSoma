#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6650}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6651}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6652}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6653}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6654}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6655}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6656}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6657}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6720}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-next-repair-task-route-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-next-repair-task-route-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"

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

created_directory="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
directory_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_directory")"
post_json "$CORE_URL/approvals/$directory_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before next repair task route."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/first-record-tasks" '{"confirm":true}')"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one bounded bootstrap append before next repair task route."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null
envelope="$(curl --silent --fail "$SYSTEM_URL/system/systemd/next-repair-dry-run")"
route_gate="$(curl --silent --fail "$SYSTEM_URL/system/systemd/next-repair-task-route")"

node - <<'EOF' "$PLAN_FILE" "$envelope" "$route_gate"
const fs = require("node:fs");
const planDoc = fs.readFileSync(process.argv[2], "utf8");
const envelope = JSON.parse(process.argv[3]);
const routeGate = JSON.parse(process.argv[4]);

for (const token of [
  "Systemd next repair task route checkpoint",
  "openclaw-systemd-next-repair-task-route",
  "openclaw-systemd-next-repair-task-shell",
  "Creates no task, no approval, no command execution",
]) {
  if (!planDoc.includes(token)) {
    throw new Error(`Phase 2 plan missing next repair task route token: ${token}`);
  }
}

if (!envelope.ok
  || envelope.registry !== "openclaw-systemd-next-repair-dry-run-v0"
  || envelope.target?.unit !== "openclaw-system-sense.service"
  || envelope.dryRun?.wouldExecute !== false) {
  throw new Error(`next repair dry-run should be ready before task route: ${JSON.stringify(envelope)}`);
}
if (!routeGate.ok || routeGate.registry !== "openclaw-systemd-next-repair-task-route-v0") {
  throw new Error(`next repair task route should expose expected registry: ${JSON.stringify(routeGate)}`);
}
if (routeGate.mode !== "read_only_next_systemd_repair_task_route") {
  throw new Error(`next repair task route should remain read-only: ${JSON.stringify(routeGate.mode)}`);
}
if (routeGate.routeDecision?.targetUnit !== "openclaw-system-sense.service"
  || routeGate.routeDecision?.selectedSlice !== "openclaw-systemd-next-repair-task-shell"
  || routeGate.routeDecision?.status !== "task_shell_route_available"
  || routeGate.routeDecision?.taskShellAllowed !== true) {
  throw new Error(`next repair task route should select task shell route: ${JSON.stringify(routeGate.routeDecision)}`);
}
if (routeGate.governance?.hostMutation !== false
  || routeGate.governance?.canRestart !== false
  || routeGate.governance?.createsTask !== false
  || routeGate.governance?.createsApproval !== false
  || routeGate.governance?.executesCommand !== false
  || routeGate.governance?.schedulesFollowUp !== false) {
  throw new Error(`next repair task route governance should stay read-only: ${JSON.stringify(routeGate.governance)}`);
}
if (routeGate.evidence?.dryRunReady !== true
  || routeGate.evidence?.dryRunRegistry !== "openclaw-systemd-next-repair-dry-run-v0"
  || routeGate.evidence?.targetUnit !== "openclaw-system-sense.service"
  || routeGate.evidence?.command !== "systemctl"
  || !routeGate.evidence?.args?.includes("openclaw-system-sense.service")
  || routeGate.evidence?.wouldExecute !== false) {
  throw new Error(`next repair task route should cite dry-run evidence: ${JSON.stringify(routeGate.evidence)}`);
}
const createShell = routeGate.allowedNextActions?.find((action) => action.id === "create-task-shell");
const executeRestart = routeGate.allowedNextActions?.find((action) => action.id === "execute-restart");
if (!createShell || createShell.allowedNow !== true || createShell.createsTask !== true || createShell.createsApproval !== true || createShell.mutatesHost !== false) {
  throw new Error(`next repair task route should allow only task-shell materialization next: ${JSON.stringify(routeGate.allowedNextActions)}`);
}
if (!executeRestart || executeRestart.allowedNow !== false || executeRestart.mutatesHost !== true) {
  throw new Error(`next repair task route should defer restart execution: ${JSON.stringify(routeGate.allowedNextActions)}`);
}
if (routeGate.next?.recommendedSlice !== "openclaw-systemd-next-repair-task-shell"
  || !String(routeGate.next?.boundary ?? "").includes("do not approve")) {
  throw new Error(`next repair task route should point to task shell boundary: ${JSON.stringify(routeGate.next)}`);
}

console.log(JSON.stringify({
  openclawSystemdNextRepairTaskRoute: {
    status: "passed",
    registry: routeGate.registry,
    target: routeGate.routeDecision.targetUnit,
    selectedSlice: routeGate.routeDecision.selectedSlice,
    createsTaskNow: routeGate.governance.createsTask,
  },
}, null, 2));
EOF

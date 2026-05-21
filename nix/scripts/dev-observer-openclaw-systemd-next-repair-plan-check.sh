#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6660}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6661}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6662}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6663}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6664}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6665}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6666}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6667}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6730}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-systemd-next-repair-plan-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-systemd-next-repair-plan-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"

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

created_directory="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
directory_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_directory")"
post_json "$CORE_URL/approvals/$directory_approval_id/approve" '{"approvedBy":"observer-milestone-check","reason":"Approve bounded ledger directory creation before observer next repair plan."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/first-record-tasks" '{"confirm":true}')"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"observer-milestone-check","reason":"Approve one bounded bootstrap append before observer next repair plan."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
repair_plan="$(curl --silent --fail "$SYSTEM_URL/system/systemd/next-repair-plan")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$repair_plan"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const repairPlan = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Next Repair Plan",
  "systemd-next-repair-plan-panel",
  "systemd-next-repair-plan-target",
  "systemd-next-repair-plan-mode",
  "systemd-next-repair-plan-creates-task",
  "systemd-next-repair-plan-mutation",
  "systemd-next-repair-plan-json",
];
const requiredClient = [
  "/system/systemd/next-repair-plan",
  "refreshSystemdNextRepairPlan",
  "systemdNextRepairPlanTarget",
  "systemdNextRepairPlanMode",
  "systemdNextRepairPlanCreatesTask",
  "systemdNextRepairPlanMutation",
  "systemdNextRepairPlanJson",
  "commandPreviewOnly",
  "openclaw-systemd-next-repair-route-review",
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
if (!repairPlan.ok || repairPlan.registry !== "openclaw-systemd-next-repair-plan-v0") {
  throw new Error(`Observer source should expose next repair plan registry: ${JSON.stringify(repairPlan)}`);
}
if (repairPlan.plan?.targetUnit !== "openclaw-system-sense.service"
  || repairPlan.plan?.commandPreviewOnly !== true
  || repairPlan.plan?.executesCommand !== false
  || repairPlan.plan?.restartsService !== false) {
  throw new Error(`Observer next repair plan should expose preview-only system-sense plan: ${JSON.stringify(repairPlan.plan)}`);
}
if (repairPlan.governance?.createsTask !== false
  || repairPlan.governance?.createsApproval !== false
  || repairPlan.governance?.executesCommand !== false
  || repairPlan.governance?.hostMutation !== false
  || repairPlan.governance?.canRestart !== false) {
  throw new Error(`Observer next repair plan must remain read-only: ${JSON.stringify(repairPlan.governance)}`);
}

console.log(JSON.stringify({
  observerOpenClawSystemdNextRepairPlan: {
    status: "passed",
    panel: "Next Repair Plan",
    registry: repairPlan.registry,
    targetUnit: repairPlan.plan?.targetUnit,
    next: repairPlan.next?.recommendedSlice,
  },
}, null, 2));
EOF

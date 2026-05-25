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
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-next-repair-plan-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-next-repair-plan-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
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

prepare_body_evidence_timeline_readiness "$CORE_URL" "Approve one next repair execution before next repair plan."

created_directory="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
directory_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_directory")"
post_json "$CORE_URL/approvals/$directory_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before next repair plan."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/first-record-tasks" '{"confirm":true}')"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one bounded bootstrap append before next repair plan."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null
scope_review="$(curl --silent --fail "$SYSTEM_URL/system/systemd/next-repair-scope-review")"
repair_plan="$(curl --silent --fail "$SYSTEM_URL/system/systemd/next-repair-plan")"

node - <<'EOF' "$PLAN_FILE" "$scope_review" "$repair_plan"
const fs = require("node:fs");
const planDoc = fs.readFileSync(process.argv[2], "utf8");
const scopeReview = JSON.parse(process.argv[3]);
const repairPlan = JSON.parse(process.argv[4]);

for (const token of [
  "Systemd next repair plan checkpoint",
  "openclaw-systemd-next-repair-plan",
  "command-preview-only flag",
  "Creates no task, no approval, no command execution, no restart",
]) {
  if (!planDoc.includes(token)) {
    throw new Error(`Phase 2 plan missing next repair plan token: ${token}`);
  }
}

if (!scopeReview.ok
  || scopeReview.registry !== "openclaw-systemd-next-repair-scope-review-v0"
  || scopeReview.summary?.ready !== true
  || scopeReview.decision?.selectedUnit !== "openclaw-system-sense.service") {
  throw new Error(`next repair scope review should be ready before plan: ${JSON.stringify(scopeReview)}`);
}
if (!repairPlan.ok || repairPlan.registry !== "openclaw-systemd-next-repair-plan-v0") {
  throw new Error(`next repair plan should expose expected registry: ${JSON.stringify(repairPlan)}`);
}
if (repairPlan.mode !== "plan_only_next_systemd_repair_scope") {
  throw new Error(`next repair plan should remain plan-only: ${JSON.stringify(repairPlan.mode)}`);
}
if (repairPlan.scope?.selectedUnit !== "openclaw-system-sense.service"
  || repairPlan.scope?.scopeReady !== true
  || repairPlan.scope?.ledgerDemoReady !== true) {
  throw new Error(`next repair plan should cite ready scope review: ${JSON.stringify(repairPlan.scope)}`);
}
if (repairPlan.plan?.targetUnit !== "openclaw-system-sense.service"
  || repairPlan.plan?.commandPreview !== "systemctl restart openclaw-system-sense.service"
  || repairPlan.plan?.commandPreviewOnly !== true
  || repairPlan.plan?.createsExecutableTask !== false
  || repairPlan.plan?.createsApproval !== false
  || repairPlan.plan?.executesCommand !== false
  || repairPlan.plan?.restartsService !== false) {
  throw new Error(`next repair plan should only preview selected repair command: ${JSON.stringify(repairPlan.plan)}`);
}
if (repairPlan.governance?.hostMutation !== false
  || repairPlan.governance?.canRestart !== false
  || repairPlan.governance?.createsTask !== false
  || repairPlan.governance?.createsApproval !== false
  || repairPlan.governance?.executesCommand !== false
  || repairPlan.governance?.schedulesFollowUp !== false) {
  throw new Error(`next repair plan governance should stay read-only: ${JSON.stringify(repairPlan.governance)}`);
}
for (const forbidden of [
  "no immediate dry-run",
  "no immediate repair task",
  "no approval creation",
  "no systemctl execution",
  "no automatic repair",
  "no browser-runtime repair demo replay",
  "no additional ledger writes",
]) {
  if (!repairPlan.plan?.notSelected?.includes(forbidden)) {
    throw new Error(`next repair plan should explicitly avoid ${forbidden}: ${JSON.stringify(repairPlan.plan?.notSelected)}`);
  }
}
if (!repairPlan.plan?.requiredBeforeExecution?.includes("operator-visible dry-run envelope")) {
  throw new Error(`next repair plan should list dry-run as a future gate: ${JSON.stringify(repairPlan.plan?.requiredBeforeExecution)}`);
}
if (repairPlan.next?.recommendedSlice !== "openclaw-systemd-next-repair-route-review"
  || !String(repairPlan.next?.boundary ?? "").includes("before any dry-run")) {
  throw new Error(`next repair plan should point to route review before dry-run/task: ${JSON.stringify(repairPlan.next)}`);
}

console.log(JSON.stringify({
  openclawSystemdNextRepairPlan: {
    status: "passed",
    registry: repairPlan.registry,
    targetUnit: repairPlan.plan.targetUnit,
    previewOnly: repairPlan.plan.commandPreviewOnly,
    next: repairPlan.next.recommendedSlice,
  },
}, null, 2));
EOF

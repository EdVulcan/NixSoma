#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6470}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6471}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6472}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6473}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6474}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6475}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6476}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6477}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6540}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-directory-task-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-directory-task-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
. "$SCRIPT_DIR/dev-body-evidence-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"

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

prepare_body_evidence_timeline_readiness "$CORE_URL" "Approve one next repair execution before body evidence ledger directory task."

curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null
route_review="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-storage-root-route-review")"
created="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
blocked_step="$(post_json "$CORE_URL/operator/step" '{}')"
directory_exists="false"
if [[ -d "$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger" ]]; then
  directory_exists="true"
fi

node - <<'EOF' "$PLAN_FILE" "$route_review" "$created" "$blocked_step" "$directory_exists"
const fs = require("node:fs");
const phase2Plan = fs.readFileSync(process.argv[2], "utf8");
const routeReview = JSON.parse(process.argv[3]);
const created = JSON.parse(process.argv[4]);
const blockedStep = JSON.parse(process.argv[5]);
const directoryExists = process.argv[6] === "true";

for (const token of [
  "openclaw-body-evidence-ledger-directory-task",
  "Body evidence ledger directory task checkpoint",
  "Creates a queued task and pending medium-risk approval",
  "Does not create the directory",
]) {
  if (!phase2Plan.includes(token)) {
    throw new Error(`Phase 2 plan missing directory task token: ${token}`);
  }
}

if (!routeReview.ok || routeReview.registry !== "openclaw-body-evidence-ledger-storage-root-route-review-v0") {
  throw new Error(`directory task route review should be available: ${JSON.stringify(routeReview)}`);
}
if (routeReview.decision?.selectedSlice !== "openclaw-body-evidence-ledger-directory-task") {
  throw new Error(`directory task route review should select directory task: ${JSON.stringify(routeReview.decision)}`);
}
if (!created.ok || created.registry !== "openclaw-body-evidence-ledger-directory-task-v0") {
  throw new Error(`directory task shell should expose expected registry: ${JSON.stringify(created)}`);
}
if (created.mode !== "approval-gated-ledger-directory-task-shell") {
  throw new Error(`directory task shell should be approval-gated: ${JSON.stringify(created.mode)}`);
}
if (created.sourceRegistry !== "openclaw-body-evidence-ledger-storage-root-route-review-v0") {
  throw new Error(`directory task should cite storage root route review: ${JSON.stringify(created.sourceRegistry)}`);
}
if (created.task?.status !== "queued"
  || created.task?.type !== "body_evidence_ledger_directory_task"
  || created.task?.bodyEvidenceLedgerDirectory?.displayPath !== ".artifacts/openclaw-body-evidence-ledger") {
  throw new Error(`directory task should queue selected ledger directory task: ${JSON.stringify(created.task)}`);
}
if (created.approval?.status !== "pending" || created.approval?.risk !== "medium") {
  throw new Error(`directory task should create pending medium-risk approval: ${JSON.stringify(created.approval)}`);
}
if (created.ledgerDirectory?.directoryCreated !== false
  || created.ledgerDirectory?.durableStorageWritten !== false
  || created.ledgerDirectory?.recordWritesEnabled !== false) {
  throw new Error(`directory task metadata should stop before mkdir and writes: ${JSON.stringify(created.ledgerDirectory)}`);
}
if (created.governance?.createsTask !== true
  || created.governance?.createsApproval !== true
  || created.governance?.canCreateDirectory !== false
  || created.governance?.canWriteLedger !== false
  || created.governance?.executed !== false
  || created.governance?.hostMutation !== false
  || created.governance?.directoryCreated !== false
  || created.governance?.durableStorageWritten !== false) {
  throw new Error(`directory task governance should stop before execution: ${JSON.stringify(created.governance)}`);
}
if (!blockedStep.ok || blockedStep.ran !== false || blockedStep.reason !== "policy_requires_approval") {
  throw new Error(`directory task shell should block operator before approval: ${JSON.stringify(blockedStep)}`);
}
if (directoryExists) {
  throw new Error("directory task shell must not create .artifacts/openclaw-body-evidence-ledger");
}

console.log(JSON.stringify({
  openclawBodyEvidenceLedgerDirectoryTask: {
    status: "passed",
    registry: created.registry,
    taskId: created.task.id,
    approvalId: created.approval.id,
    target: created.ledgerDirectory.displayPath,
    blockedReason: blockedStep.reason,
    directoryCreated: created.governance.directoryCreated,
    durableStorageWritten: created.governance.durableStorageWritten,
  },
}, null, 2));
EOF

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6390}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6391}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6392}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6393}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6394}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6395}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6396}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6397}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6460}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-ledger-plan-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-ledger-plan-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

created_next_repair="$(post_json "$CORE_URL/system/systemd/next-repair-tasks" '{"confirm":true,"execute":true}')"
next_repair_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_next_repair")"
post_json "$CORE_URL/approvals/$next_repair_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one next repair execution before body evidence ledger plan."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null
plan="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-plan")"

node - <<'EOF' "$PLAN_FILE" "$plan"
const fs = require("node:fs");
const phase2Plan = fs.readFileSync(process.argv[2], "utf8");
const plan = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-body-evidence-ledger-plan",
  "Body evidence ledger plan checkpoint",
  "planned record schema",
  "no durable storage write",
]) {
  if (!phase2Plan.includes(token)) {
    throw new Error(`Phase 2 plan missing body evidence ledger plan token: ${token}`);
  }
}

if (!plan.ok || plan.registry !== "openclaw-body-evidence-ledger-plan-v0") {
  throw new Error(`ledger plan should expose expected registry: ${JSON.stringify(plan)}`);
}
if (plan.mode !== "plan_only_body_evidence_ledger") {
  throw new Error(`ledger plan should remain plan-only: ${JSON.stringify(plan.mode)}`);
}
if (plan.summary?.planReady !== true
  || plan.summary?.timelineReady !== true
  || plan.summary?.plannedSchema !== "body-evidence-ledger-record-v0"
  || plan.summary?.durableStorageWritten !== false
  || plan.summary?.hiddenMutation !== false) {
  throw new Error(`ledger plan summary should be ready without writes: ${JSON.stringify(plan.summary)}`);
}
if (plan.governance?.canWriteLedger !== false
  || plan.governance?.durableStorageWritten !== false
  || plan.governance?.createsTask !== false
  || plan.governance?.createsApproval !== false
  || plan.governance?.executesCommand !== false
  || plan.governance?.hostMutation !== false
  || plan.governance?.schedulesFollowUp !== false) {
  throw new Error(`ledger plan must not write or execute: ${JSON.stringify(plan.governance)}`);
}
const schemaFields = new Set(plan.plan?.plannedRecordSchema?.requiredFields ?? []);
for (const field of ["id", "recordedAt", "sourceRegistry", "contentHash", "governance"]) {
  if (!schemaFields.has(field)) {
    throw new Error(`ledger plan schema missing ${field}: ${JSON.stringify(plan.plan?.plannedRecordSchema)}`);
  }
}
if (!Array.isArray(plan.plan?.writeGates)
  || plan.plan.writeGates.length < 4
  || plan.plan.writeGates.some((gate) => gate.requiredBeforeWrite !== true || gate.passed !== false)) {
  throw new Error(`ledger plan should expose unmet write gates: ${JSON.stringify(plan.plan?.writeGates)}`);
}
if (plan.next?.recommendedSlice !== "openclaw-body-evidence-ledger-route-review") {
  throw new Error(`ledger plan should route to implementation route review: ${JSON.stringify(plan.next)}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceLedgerPlan: {
    status: "passed",
    registry: plan.registry,
    schema: plan.summary.plannedSchema,
    writeGates: plan.summary.writeGateCount,
    durableStorageWritten: plan.summary.durableStorageWritten,
    next: plan.next.recommendedSlice,
  },
}, null, 2));
EOF

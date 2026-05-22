#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6400}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6401}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6402}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6403}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6404}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6405}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6406}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6407}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6470}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-body-evidence-ledger-plan-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-body-evidence-ledger-plan-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
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
post_json "$CORE_URL/approvals/$next_repair_approval_id/approve" '{"approvedBy":"observer-milestone-check","reason":"Approve one next repair execution before observer body evidence ledger plan."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
plan="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-plan")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$plan"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const plan = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Body Evidence Ledger Plan",
  "body-evidence-ledger-plan-panel",
  "body-evidence-ledger-plan-ready",
  "body-evidence-ledger-plan-schema",
  "body-evidence-ledger-plan-gates",
  "body-evidence-ledger-plan-written",
  "body-evidence-ledger-plan-json",
];
const requiredClient = [
  "/system/route/body-evidence-ledger-plan",
  "refreshBodyEvidenceLedgerPlan",
  "bodyEvidenceLedgerPlanReady",
  "bodyEvidenceLedgerPlanSchema",
  "bodyEvidenceLedgerPlanGates",
  "bodyEvidenceLedgerPlanWritten",
  "bodyEvidenceLedgerPlanJson",
  "openclaw-body-evidence-ledger-route-review",
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
if (!plan.ok || plan.registry !== "openclaw-body-evidence-ledger-plan-v0") {
  throw new Error(`Observer source should expose ledger plan registry: ${JSON.stringify(plan)}`);
}
if (plan.summary?.planReady !== true || plan.summary?.durableStorageWritten !== false) {
  throw new Error(`Observer ledger plan summary should be ready without writes: ${JSON.stringify(plan.summary)}`);
}
if (plan.governance?.canWriteLedger !== false
  || plan.governance?.durableStorageWritten !== false
  || plan.governance?.hostMutation !== false
  || plan.governance?.executesCommand !== false
  || plan.governance?.schedulesFollowUp !== false) {
  throw new Error(`Observer ledger plan must stay non-mutating: ${JSON.stringify(plan.governance)}`);
}

console.log(JSON.stringify({
  observerOpenClawBodyEvidenceLedgerPlan: {
    status: "passed",
    panel: "Body Evidence Ledger Plan",
    registry: plan.registry,
    schema: plan.summary?.plannedSchema,
    writeGates: plan.summary?.writeGateCount,
    durableStorageWritten: plan.summary?.durableStorageWritten,
    next: plan.next?.recommendedSlice,
  },
}, null, 2));
EOF

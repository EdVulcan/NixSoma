#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6520}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6521}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6522}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6523}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6524}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6525}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6526}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6527}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6590}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-body-evidence-ledger-readiness-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-body-evidence-ledger-readiness-check.json}"

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
post_json "$CORE_URL/approvals/$directory_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before observer ledger readiness."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/first-record-tasks" '{"confirm":true}')"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one bounded bootstrap append before observer ledger readiness."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
readiness="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-ledger-readiness")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$readiness"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const readiness = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Body Evidence Ledger Readiness",
  "body-evidence-ledger-readiness-panel",
  "body-evidence-ledger-readiness-ready",
  "body-evidence-ledger-readiness-checks",
  "body-evidence-ledger-readiness-records",
  "body-evidence-ledger-readiness-mutation",
  "body-evidence-ledger-readiness-json",
];
const requiredClient = [
  "/system/route/body-evidence-ledger-readiness",
  "refreshBodyEvidenceLedgerReadiness",
  "bodyEvidenceLedgerReadinessReady",
  "bodyEvidenceLedgerReadinessChecks",
  "bodyEvidenceLedgerReadinessRecords",
  "bodyEvidenceLedgerReadinessMutation",
  "bodyEvidenceLedgerReadinessJson",
  "openclaw-phase-2-next-capability-route-review",
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
if (!readiness.ok || readiness.registry !== "openclaw-body-evidence-ledger-readiness-v0") {
  throw new Error(`Observer source should expose ledger readiness registry: ${JSON.stringify(readiness)}`);
}
if (readiness.summary?.ready !== true
  || readiness.summary?.recordCount !== 1
  || readiness.summary?.bootstrapRecordCount !== 1
  || readiness.evidence?.records?.[0]?.hashValid !== true) {
  throw new Error(`Observer ledger readiness should expose one validated record: ${JSON.stringify(readiness.summary)}`);
}
if (readiness.governance?.createsTask !== false
  || readiness.governance?.createsApproval !== false
  || readiness.governance?.executesCommand !== false
  || readiness.governance?.hostMutation !== false
  || readiness.governance?.schedulesFollowUp !== false
  || readiness.governance?.backgroundWriter !== false
  || readiness.governance?.bulkImport !== false) {
  throw new Error(`Observer ledger readiness must stay read-only: ${JSON.stringify(readiness.governance)}`);
}

console.log(JSON.stringify({
  observerOpenClawBodyEvidenceLedgerReadiness: {
    status: "passed",
    panel: "Body Evidence Ledger Readiness",
    registry: readiness.registry,
    recordCount: readiness.summary?.recordCount,
    checks: `${readiness.summary?.passedChecks}/${readiness.summary?.totalChecks}`,
    next: readiness.next?.recommendedSlice,
  },
}, null, 2));
EOF

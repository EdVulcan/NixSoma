#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6590}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6591}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6592}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6593}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6594}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6595}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6596}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6597}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6650}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-phase-2-next-capability-route-review-followup-readiness-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-phase-2-next-capability-route-review-followup-readiness-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
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

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


prepare_body_evidence_ledger_demo_status_prereq_state "$SCRIPT_DIR" "$REPO_ROOT" "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$LEDGER_DIR" || true

"$SCRIPT_DIR/dev-up.sh"

prepare_body_evidence_ledger_demo_status "$CORE_URL" "Prepare observer follow-up readiness before next capability route review."
created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/followup-record-tasks" '{"confirm":true}')"
readiness="$(curl --silent --fail "$CORE_URL/phase-2/body-evidence-ledger-followup-record-readiness")"
review="$(curl --silent --fail "$CORE_URL/phase-2/next-capability-route-review")"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$created_record_task" "$readiness" "$review" "$LEDGER_DIR/body-evidence-ledger.jsonl"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const created = JSON.parse(process.argv[4]);
const readiness = JSON.parse(process.argv[5]);
const review = JSON.parse(process.argv[6]);
const ledgerLines = fs.readFileSync(process.argv[7], "utf8").trim().split("\n").filter(Boolean);

const requiredHtml = [
  "Next Capability Route",
  "phase2-next-capability-route-panel",
  "phase2-next-capability-track",
  "phase2-next-capability-slice",
  "phase2-next-capability-creates-task",
  "phase2-next-capability-mutation",
  "phase2-next-capability-json",
];
const requiredClient = [
  "/phase-2/next-capability-route-review",
  "refreshPhase2NextCapabilityRoute",
  "phase2NextCapabilityTrack",
  "phase2NextCapabilitySlice",
  "followupReadinessReady",
  "bodyEvidenceLedgerFollowupTaskId",
  "phase2NextCapabilityJson",
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
if (!created.ok || created.registry !== "openclaw-body-evidence-ledger-followup-record-task-v0") {
  throw new Error(`Observer setup should create follow-up task shell: ${JSON.stringify(created)}`);
}
if (!readiness.ok
  || readiness.summary?.ready !== true
  || readiness.summary?.taskId !== created.task?.id
  || readiness.summary?.recordAppended !== false) {
  throw new Error(`Observer setup should expose follow-up readiness: ${JSON.stringify(readiness.summary)}`);
}
if (!review.ok
  || review.registry !== "openclaw-phase-2-next-capability-route-review-v0"
  || review.decision?.selectedSlice !== "openclaw-body-evidence-ledger-followup-record-append-route-review"
  || review.evidence?.bodyEvidenceLedgerFollowupRecordReadinessReady !== true
  || review.evidence?.bodyEvidenceLedgerFollowupTaskId !== created.task?.id
  || review.governance?.createsTask !== false
  || review.governance?.mutatesHost !== false) {
  throw new Error(`Observer-facing route review should select read-only future append route: ${JSON.stringify(review)}`);
}
if (ledgerLines.length !== 1 || review.evidence?.bodyEvidenceLedgerFollowupRecordAppended !== false) {
  throw new Error(`Observer-facing route review must not append a second ledger record: lines=${ledgerLines.length}`);
}

console.log(JSON.stringify({
  observerOpenClawPhase2NextCapabilityRouteReviewFollowupReadiness: {
    status: "passed",
    panel: "Next Capability Route",
    registry: review.registry,
    selectedSlice: review.decision?.selectedSlice,
    taskId: review.evidence?.bodyEvidenceLedgerFollowupTaskId,
    createsTask: review.governance?.createsTask,
    mutatesHost: review.governance?.mutatesHost,
  },
}, null, 2));
EOF

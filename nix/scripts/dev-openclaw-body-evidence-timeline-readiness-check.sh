#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6370}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6371}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6372}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6373}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6374}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6375}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6376}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6377}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6440}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-timeline-readiness-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-timeline-readiness-check.json}"

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
post_json "$CORE_URL/approvals/$next_repair_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one next repair execution before body evidence timeline readiness."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null
readiness="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-timeline-readiness")"

node - <<'EOF' "$PLAN_FILE" "$readiness"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const readiness = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-body-evidence-timeline-readiness",
  "Body evidence timeline readiness checkpoint",
  "durable storage, schedulers, or new mutation",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing body evidence timeline readiness token: ${token}`);
  }
}

if (!readiness.ok || readiness.registry !== "openclaw-body-evidence-timeline-readiness-v0") {
  throw new Error(`timeline readiness should expose expected registry: ${JSON.stringify(readiness)}`);
}
if (readiness.summary?.ready !== true
  || readiness.summary?.passedChecks !== readiness.summary?.totalChecks
  || readiness.summary?.timelineEntries < 8
  || readiness.summary?.hiddenMutation !== false) {
  throw new Error(`timeline readiness should show ready non-mutating memory: ${JSON.stringify(readiness.summary)}`);
}
if (readiness.governance?.createsTask !== false
  || readiness.governance?.createsApproval !== false
  || readiness.governance?.executesCommand !== false
  || readiness.governance?.hostMutation !== false
  || readiness.governance?.triggersRecovery !== false
  || readiness.governance?.schedulesFollowUp !== false) {
  throw new Error(`timeline readiness must not execute or schedule work: ${JSON.stringify(readiness.governance)}`);
}
if (!readiness.completedBlock?.completedSlices?.includes("openclaw-body-evidence-timeline")
  || !readiness.completedBlock?.completedSlices?.includes("observer-openclaw-body-evidence-timeline")
  || !readiness.completedBlock?.completedSlices?.includes("openclaw-systemd-next-repair-demo-status")) {
  throw new Error(`timeline readiness should list completed timeline slices: ${JSON.stringify(readiness.completedBlock)}`);
}
if (readiness.next?.recommendedSlice !== "openclaw-phase-2-next-capability-route-review") {
  throw new Error(`timeline readiness should return to route review: ${JSON.stringify(readiness.next)}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceTimelineReadiness: {
    status: "passed",
    registry: readiness.registry,
    checks: `${readiness.summary.passedChecks}/${readiness.summary.totalChecks}`,
    entries: readiness.summary.timelineEntries,
    next: readiness.next.recommendedSlice,
    hostMutation: readiness.governance.hostMutation,
  },
}, null, 2));
EOF

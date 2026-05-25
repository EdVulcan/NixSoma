#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6350}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6351}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6352}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6353}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6354}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6355}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6356}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6357}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6420}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-evidence-timeline-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-evidence-timeline-check.json}"

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
post_json "$CORE_URL/approvals/$next_repair_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one next repair execution before body evidence timeline."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null
timeline="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-timeline")"

node - <<'EOF' "$PLAN_FILE" "$timeline"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const timeline = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-body-evidence-timeline",
  "Body evidence timeline checkpoint",
  "chronological memory spine",
  "no durable storage",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing body evidence timeline token: ${token}`);
  }
}

if (!timeline.ok || timeline.registry !== "openclaw-body-evidence-timeline-v0") {
  throw new Error(`body evidence timeline should expose expected registry: ${JSON.stringify(timeline)}`);
}
if (timeline.mode !== "read_only_body_evidence_timeline") {
  throw new Error(`body evidence timeline should be read-only: ${JSON.stringify(timeline.mode)}`);
}
if (timeline.summary?.timelineReady !== true
  || timeline.summary?.entries < 8
  || timeline.summary?.bodyGovernanceReady !== true
  || timeline.summary?.candidateDemoReady !== true
  || timeline.summary?.nextRepairDemoReady !== true
  || timeline.summary?.hiddenMutation !== false) {
  throw new Error(`body evidence timeline summary should show ready evidence memory: ${JSON.stringify(timeline.summary)}`);
}
if (timeline.governance?.createsTask !== false
  || timeline.governance?.createsApproval !== false
  || timeline.governance?.executesCommand !== false
  || timeline.governance?.hostMutation !== false
  || timeline.governance?.triggersRecovery !== false
  || timeline.governance?.schedulesFollowUp !== false) {
  throw new Error(`body evidence timeline must not execute or schedule work: ${JSON.stringify(timeline.governance)}`);
}
const ids = new Set((timeline.entries ?? []).map((entry) => entry.id));
for (const id of [
  "body-dependency-map",
  "health-trend-summary",
  "route-aware-next-action",
  "conservative-recovery-policy",
  "body-governance-readiness",
  "phase-2-route-review",
  "systemd-repair-candidate-demo-status",
  "systemd-next-repair-demo-status",
]) {
  if (!ids.has(id)) {
    throw new Error(`body evidence timeline missing entry ${id}: ${JSON.stringify(timeline.entries)}`);
  }
}
if ((timeline.entries ?? []).some((entry) => entry.mutation !== false)) {
  throw new Error(`body evidence timeline entries should all be non-mutating: ${JSON.stringify(timeline.entries)}`);
}
const nextRepairEntry = (timeline.entries ?? []).find((entry) => entry.id === "systemd-next-repair-demo-status");
if (!nextRepairEntry
  || nextRepairEntry.registry !== "openclaw-systemd-next-repair-demo-status-v0"
  || !nextRepairEntry.summary.includes("openclaw-system-sense.service")) {
  throw new Error(`body evidence timeline should include next repair demo evidence: ${JSON.stringify(nextRepairEntry)}`);
}
if (!timeline.memoryModel?.operatorUse?.some((item) => item.includes("body state"))) {
  throw new Error(`body evidence timeline should expose operator memory use: ${JSON.stringify(timeline.memoryModel)}`);
}
if (timeline.next?.recommendedSlice !== "openclaw-body-evidence-timeline-readiness") {
  throw new Error(`body evidence timeline should route to readiness closeout: ${JSON.stringify(timeline.next)}`);
}

console.log(JSON.stringify({
  openclawBodyEvidenceTimeline: {
    status: "passed",
    registry: timeline.registry,
    entries: timeline.summary.entries,
    latestEntryId: timeline.summary.latestEntryId,
    next: timeline.next.recommendedSlice,
    hostMutation: timeline.governance.hostMutation,
  },
}, null, 2));
EOF

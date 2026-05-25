#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6150}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6151}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6152}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6153}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6154}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6155}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6156}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6157}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6220}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-2-demo-walkthrough-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-2-demo-walkthrough-check.json}"

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

curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null
curl --silent --fail "$CORE_URL/phase-2/demo-control-room" >/dev/null
walkthrough="$(curl --silent --fail "$CORE_URL/phase-2/demo-walkthrough")"

node - <<'EOF' "$PLAN_FILE" "$walkthrough"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const walkthrough = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-phase-2-demo-walkthrough",
  "Phase 2 demo walkthrough checkpoint",
  "human-readable walkthrough script",
  "Must not add automatic repair, background maintenance, persistence hardening",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing demo walkthrough token: ${token}`);
  }
}

if (!walkthrough.ok || walkthrough.registry !== "openclaw-phase-2-demo-walkthrough-v0") {
  throw new Error(`demo walkthrough should expose expected registry: ${JSON.stringify(walkthrough)}`);
}
if (walkthrough.mode !== "read_only_human_demo_walkthrough") {
  throw new Error(`demo walkthrough should be read-only: ${JSON.stringify(walkthrough.mode)}`);
}
if (walkthrough.governance?.readOnly !== true
  || walkthrough.governance?.createsTask !== false
  || walkthrough.governance?.createsApproval !== false
  || walkthrough.governance?.executesCommand !== false
  || walkthrough.governance?.mutatesHost !== false
  || walkthrough.governance?.triggersRecovery !== false
  || walkthrough.governance?.schedulesWork !== false) {
  throw new Error(`demo walkthrough governance must remain non-executing: ${JSON.stringify(walkthrough.governance)}`);
}
if (walkthrough.summary?.ready !== true
  || walkthrough.summary?.controlRoomReady !== true
  || walkthrough.summary?.bodyGovernanceReady !== true
  || walkthrough.summary?.readySteps !== walkthrough.summary?.totalSteps) {
  throw new Error(`demo walkthrough should be ready from control room evidence: ${JSON.stringify(walkthrough.summary)}`);
}
for (const step of ["open-observer", "explain-route", "show-body-governance", "show-repair-demo", "state-boundary"]) {
  if (!walkthrough.steps?.some((item) => item.id === step && item.status === "ready")) {
    throw new Error(`demo walkthrough missing ready step ${step}: ${JSON.stringify(walkthrough.steps)}`);
  }
}
if (!walkthrough.script?.some((line) => line.includes("No hidden mutation"))) {
  throw new Error(`demo walkthrough should include no-hidden-mutation script: ${JSON.stringify(walkthrough.script)}`);
}
if (walkthrough.next?.recommendedSlice !== "openclaw-phase-2-demo-readiness-exit") {
  throw new Error(`demo walkthrough should point to demo readiness exit next: ${JSON.stringify(walkthrough.next)}`);
}

console.log(JSON.stringify({
  openclawPhase2DemoWalkthrough: {
    status: "passed",
    registry: walkthrough.registry,
    walkthroughStatus: walkthrough.status,
    steps: `${walkthrough.summary.readySteps}/${walkthrough.summary.totalSteps}`,
    createsTask: walkthrough.governance.createsTask,
    mutatesHost: walkthrough.governance.mutatesHost,
  },
}, null, 2));
EOF

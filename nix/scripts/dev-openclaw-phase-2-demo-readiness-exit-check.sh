#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6170}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6171}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6172}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6173}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6174}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6175}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6176}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6177}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6240}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-2-demo-readiness-exit-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-2-demo-readiness-exit-check.json}"

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
curl --silent --fail "$CORE_URL/phase-2/demo-walkthrough" >/dev/null
exit_gate="$(curl --silent --fail "$CORE_URL/phase-2/demo-readiness-exit")"

node - <<'EOF' "$PLAN_FILE" "$exit_gate"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const exitGate = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-phase-2-demo-readiness-exit",
  "Phase 2 demo readiness exit checkpoint",
  "safe-to-demo outcome",
  "Must not add automatic repair, background maintenance, persistence hardening",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing demo readiness exit token: ${token}`);
  }
}

if (!exitGate.ok || exitGate.registry !== "openclaw-phase-2-demo-readiness-exit-v0") {
  throw new Error(`demo readiness exit should expose expected registry: ${JSON.stringify(exitGate)}`);
}
if (exitGate.mode !== "read_only_demo_block_exit") {
  throw new Error(`demo readiness exit should be read-only: ${JSON.stringify(exitGate.mode)}`);
}
if (exitGate.governance?.readOnly !== true
  || exitGate.governance?.createsTask !== false
  || exitGate.governance?.createsApproval !== false
  || exitGate.governance?.executesCommand !== false
  || exitGate.governance?.mutatesHost !== false
  || exitGate.governance?.triggersRecovery !== false
  || exitGate.governance?.schedulesWork !== false) {
  throw new Error(`demo readiness exit governance must remain non-executing: ${JSON.stringify(exitGate.governance)}`);
}
if (exitGate.summary?.ready !== true
  || exitGate.summary?.passed !== exitGate.summary?.total
  || exitGate.operatorOutcome?.safeToDemo !== true
  || exitGate.operatorOutcome?.hiddenMutation !== false) {
  throw new Error(`demo readiness exit should be safe and complete: ${JSON.stringify({ summary: exitGate.summary, outcome: exitGate.operatorOutcome })}`);
}
for (const slice of [
  "openclaw-phase-2-route-review",
  "openclaw-phase-2-demo-control-room",
  "openclaw-phase-2-demo-walkthrough",
]) {
  if (!exitGate.completedBlock?.completedSlices?.includes(slice)) {
    throw new Error(`demo readiness exit missing completed slice ${slice}: ${JSON.stringify(exitGate.completedBlock)}`);
  }
}
if (!exitGate.exitChecks?.every((check) => check.passed === true)) {
  throw new Error(`demo readiness exit checks should all pass: ${JSON.stringify(exitGate.exitChecks)}`);
}
if (exitGate.next?.recommendedSlice !== "openclaw-phase-2-next-capability-route-review") {
  throw new Error(`demo readiness exit should point to next route review: ${JSON.stringify(exitGate.next)}`);
}

console.log(JSON.stringify({
  openclawPhase2DemoReadinessExit: {
    status: "passed",
    registry: exitGate.registry,
    exitStatus: exitGate.status,
    checks: `${exitGate.summary.passed}/${exitGate.summary.total}`,
    safeToDemo: exitGate.operatorOutcome.safeToDemo,
    mutatesHost: exitGate.governance.mutatesHost,
  },
}, null, 2));
EOF

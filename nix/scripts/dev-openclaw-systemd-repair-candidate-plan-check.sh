#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6230}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6231}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6232}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6233}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6234}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6235}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6236}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6237}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6300}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-repair-candidate-plan-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-repair-candidate-plan-check.json}"

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
candidate_plan="$(curl --silent --fail "$SYSTEM_URL/system/systemd/repair-candidate-plan")"

node - <<'EOF' "$PLAN_FILE" "$candidate_plan"
const fs = require("node:fs");
const planDoc = fs.readFileSync(process.argv[2], "utf8");
const candidatePlan = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-systemd-repair-candidate-plan",
  "Systemd repair candidate plan checkpoint",
  "command preview",
  "Must not add automatic repair, background maintenance, persistence hardening",
]) {
  if (!planDoc.includes(token)) {
    throw new Error(`Phase 2 plan missing repair candidate plan token: ${token}`);
  }
}

if (!candidatePlan.ok || candidatePlan.registry !== "openclaw-systemd-repair-candidate-plan-v0") {
  throw new Error(`repair candidate plan should expose expected registry: ${JSON.stringify(candidatePlan)}`);
}
if (candidatePlan.mode !== "plan_only_candidate_scope") {
  throw new Error(`repair candidate plan should be plan-only: ${JSON.stringify(candidatePlan.mode)}`);
}
if (candidatePlan.governance?.hostMutation !== false
  || candidatePlan.governance?.canMutate !== false
  || candidatePlan.governance?.canRestart !== false
  || candidatePlan.governance?.createsTask !== false
  || candidatePlan.governance?.createsApproval !== false
  || candidatePlan.governance?.executesCommand !== false
  || candidatePlan.governance?.triggersRecovery !== false) {
  throw new Error(`repair candidate plan governance must remain non-executing: ${JSON.stringify(candidatePlan.governance)}`);
}
if (candidatePlan.source?.candidateAssessmentRegistry !== "openclaw-systemd-repair-candidate-assessment-v0") {
  throw new Error(`repair candidate plan should cite candidate assessment: ${JSON.stringify(candidatePlan.source)}`);
}
if (!candidatePlan.selectedCandidate?.unit || candidatePlan.plan?.targetUnit !== candidatePlan.selectedCandidate.unit) {
  throw new Error(`repair candidate plan should select a target unit: ${JSON.stringify(candidatePlan)}`);
}
if (candidatePlan.plan?.createsExecutableTask !== false
  || candidatePlan.plan?.createsApproval !== false
  || candidatePlan.plan?.executesCommand !== false
  || candidatePlan.plan?.commandPreviewOnly !== true) {
  throw new Error(`repair candidate plan should only preview command scope: ${JSON.stringify(candidatePlan.plan)}`);
}
if (!candidatePlan.plan?.requiredBeforeExecution?.includes("explicit operator approval")) {
  throw new Error(`repair candidate plan should list execution prerequisites: ${JSON.stringify(candidatePlan.plan)}`);
}
if (candidatePlan.next?.recommendedSlice !== "openclaw-systemd-repair-candidate-observer-plan") {
  throw new Error(`repair candidate plan should point to observer plan visibility next: ${JSON.stringify(candidatePlan.next)}`);
}

console.log(JSON.stringify({
  openclawSystemdRepairCandidatePlan: {
    status: "passed",
    registry: candidatePlan.registry,
    targetUnit: candidatePlan.plan.targetUnit,
    createsTask: candidatePlan.governance.createsTask,
    hostMutation: candidatePlan.governance.hostMutation,
  },
}, null, 2));
EOF

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6210}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6211}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6212}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6213}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6214}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6215}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6216}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6217}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6280}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-repair-candidate-assessment-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-repair-candidate-assessment-check.json}"

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
assessment="$(curl --silent --fail "$SYSTEM_URL/system/systemd/repair-candidates")"

node - <<'EOF' "$PLAN_FILE" "$assessment"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const assessment = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-systemd-repair-candidate-assessment",
  "Systemd repair candidate assessment checkpoint",
  "candidate score, impact class, health signal",
  "Must not add automatic repair, background maintenance, persistence hardening",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing repair candidate assessment token: ${token}`);
  }
}

if (!assessment.ok || assessment.registry !== "openclaw-systemd-repair-candidate-assessment-v0") {
  throw new Error(`repair candidate assessment should expose expected registry: ${JSON.stringify(assessment)}`);
}
if (assessment.mode !== "read_only_repair_candidate_assessment") {
  throw new Error(`repair candidate assessment should be read-only: ${JSON.stringify(assessment.mode)}`);
}
if (assessment.governance?.hostMutation !== false
  || assessment.governance?.canMutate !== false
  || assessment.governance?.canRestart !== false
  || assessment.governance?.createsTask !== false
  || assessment.governance?.createsApproval !== false
  || assessment.governance?.executesCommand !== false
  || assessment.governance?.triggersRecovery !== false) {
  throw new Error(`repair candidate assessment governance must remain non-executing: ${JSON.stringify(assessment.governance)}`);
}
if (assessment.source?.inventoryRegistry !== "openclaw-systemd-unit-inventory-v0"
  || assessment.source?.dependencyMapRegistry !== "openclaw-systemd-dependency-map-v0"
  || assessment.source?.healthTrendRegistry !== "openclaw-health-trend-summary-v0") {
  throw new Error(`repair candidate assessment should cite inventory, dependency, and health evidence: ${JSON.stringify(assessment.source)}`);
}
if (assessment.summary?.totalCandidates < 9 || assessment.summary?.existingDemoTargets < 1) {
  throw new Error(`repair candidate assessment should cover OpenClaw body candidates: ${JSON.stringify(assessment.summary)}`);
}
if (assessment.summary?.recommendedUnit !== "openclaw-browser-runtime.service") {
  throw new Error(`repair candidate assessment should keep the existing demo target as the current recommended unit: ${JSON.stringify(assessment.summary)}`);
}
const demoCandidate = assessment.candidates?.find((candidate) => candidate.unit === "openclaw-browser-runtime.service");
if (!demoCandidate || demoCandidate.assessment?.existingDemoTarget !== true || demoCandidate.governance?.canCreateTask !== false) {
  throw new Error(`repair candidate assessment should mark browser runtime as existing non-mutating demo target: ${JSON.stringify(demoCandidate)}`);
}
if (!assessment.candidates?.every((candidate) =>
  candidate.governance?.canCreateTask === false
    && candidate.governance?.canRestart === false
    && candidate.governance?.canMutate === false
)) {
  throw new Error(`repair candidates must not expose mutation gates: ${JSON.stringify(assessment.candidates)}`);
}
if (assessment.next?.recommendedSlice !== "openclaw-systemd-repair-candidate-plan") {
  throw new Error(`repair candidate assessment should point to plan-only candidate plan next: ${JSON.stringify(assessment.next)}`);
}

console.log(JSON.stringify({
  openclawSystemdRepairCandidateAssessment: {
    status: "passed",
    registry: assessment.registry,
    candidates: assessment.summary.totalCandidates,
    recommendedUnit: assessment.summary.recommendedUnit,
    createsTask: assessment.governance.createsTask,
    hostMutation: assessment.governance.hostMutation,
  },
}, null, 2));
EOF

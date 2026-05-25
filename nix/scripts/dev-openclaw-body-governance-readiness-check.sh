#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6090}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6091}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6092}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6093}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6094}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6095}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6096}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6097}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6160}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-governance-readiness-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-governance-readiness-check.json}"

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
curl --silent --fail "$SYSTEM_URL/system/route/recovery-policy" >/dev/null
readiness="$(curl --silent --fail "$SYSTEM_URL/system/route/body-governance-readiness")"

node - <<'EOF' "$PLAN_FILE" "$readiness"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const readiness = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-body-governance-readiness",
  "Body governance readiness checkpoint",
  "completed Track C slices",
  "Must not add automatic repair, background maintenance, persistence hardening",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing body governance readiness token: ${token}`);
  }
}

if (!readiness.ok || readiness.registry !== "openclaw-body-governance-readiness-v0") {
  throw new Error(`body governance readiness should expose expected registry: ${JSON.stringify(readiness)}`);
}
if (readiness.mode !== "read_only_track_c_readiness") {
  throw new Error(`body governance readiness should be read-only: ${JSON.stringify(readiness.mode)}`);
}
if (readiness.governance?.hostMutation !== false
  || readiness.governance?.createsTask !== false
  || readiness.governance?.createsApproval !== false
  || readiness.governance?.executesCommand !== false
  || readiness.governance?.triggersRecovery !== false
  || readiness.governance?.schedulesFollowUp !== false) {
  throw new Error(`body governance readiness governance must remain non-executing: ${JSON.stringify(readiness.governance)}`);
}
if (readiness.summary?.ready !== true || readiness.summary?.passedChecks !== readiness.summary?.totalChecks) {
  throw new Error(`body governance readiness should pass all checks: ${JSON.stringify(readiness.summary)}`);
}
for (const slice of [
  "openclaw-body-service-dependency-map",
  "openclaw-health-trend-summary",
  "openclaw-route-aware-next-action-recommendation",
  "openclaw-conservative-recovery-policy-explanation",
]) {
  if (!readiness.completedTrack?.completedSlices?.includes(slice)) {
    throw new Error(`body governance readiness missing completed slice ${slice}: ${JSON.stringify(readiness.completedTrack)}`);
  }
}
if (readiness.evidence?.dependencyNodes < 9 || readiness.evidence?.healthSamples < 1 || readiness.evidence?.policyRules < 3) {
  throw new Error(`body governance readiness should summarize Track C evidence: ${JSON.stringify(readiness.evidence)}`);
}
if (readiness.next?.recommendedSlice !== "openclaw-phase-2-route-review") {
  throw new Error(`body governance readiness should point to Phase 2 route review next: ${JSON.stringify(readiness.next)}`);
}

console.log(JSON.stringify({
  openclawBodyGovernanceReadiness: {
    status: "passed",
    registry: readiness.registry,
    ready: readiness.summary.ready,
    checks: `${readiness.summary.passedChecks}/${readiness.summary.totalChecks}`,
    completedTrack: readiness.completedTrack.id,
    next: readiness.next.recommendedSlice,
  },
}, null, 2));
EOF

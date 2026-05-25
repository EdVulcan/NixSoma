#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6330}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6331}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6332}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6333}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6334}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6335}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6336}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6337}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6400}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-repair-candidate-demo-status-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-repair-candidate-demo-status-check.json}"

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
status="$(curl --silent --fail "$SYSTEM_URL/system/systemd/repair-candidate-demo-status")"

node - <<'EOF' "$PLAN_FILE" "$status"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const status = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-systemd-repair-candidate-demo-status",
  "Systemd repair candidate demo status checkpoint",
  "candidate-specific approval replay",
  "real execution replay",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing candidate demo status token: ${token}`);
  }
}

if (!status.ok || status.registry !== "openclaw-systemd-repair-candidate-demo-status-v0") {
  throw new Error(`candidate demo status should expose expected registry: ${JSON.stringify(status)}`);
}
if (status.mode !== "read_only_candidate_repair_demo_status") {
  throw new Error(`candidate demo status should be read-only: ${JSON.stringify(status.mode)}`);
}
if (status.summary?.demoReady !== true
  || status.summary?.selectedUnit !== "openclaw-browser-runtime.service"
  || status.summary?.hiddenMutation !== false) {
  throw new Error(`candidate demo status should be demo-ready for browser-runtime without hidden mutation: ${JSON.stringify(status.summary)}`);
}
if (status.governance?.createsTask !== false
  || status.governance?.createsApproval !== false
  || status.governance?.executesCommand !== false
  || status.governance?.hostMutation !== false
  || status.governance?.triggersRecovery !== false
  || status.governance?.schedulesFollowUp !== false) {
  throw new Error(`candidate demo status must not execute or schedule work: ${JSON.stringify(status.governance)}`);
}
if (!Array.isArray(status.checklist)
  || status.checklist.length < 5
  || status.checklist.some((check) => check.passed !== true)) {
  throw new Error(`candidate demo status checklist should all pass: ${JSON.stringify(status.checklist)}`);
}
if (!status.operatorView?.narrative?.includes("selected one body service")
  || !status.operatorView?.speakingPoints?.some((point) => point.includes("whitepaper route review"))) {
  throw new Error(`candidate demo status should expose operator narrative and route boundary: ${JSON.stringify(status.operatorView)}`);
}
if (status.next?.recommendedSlice !== "openclaw-phase-2-next-capability-route-review") {
  throw new Error(`candidate demo status should return to broader route review: ${JSON.stringify(status.next)}`);
}

console.log(JSON.stringify({
  openclawSystemdRepairCandidateDemoStatus: {
    status: "passed",
    registry: status.registry,
    demoReady: status.summary.demoReady,
    selectedUnit: status.summary.selectedUnit,
    checks: `${status.summary.passedChecks}/${status.summary.totalChecks}`,
    next: status.next.recommendedSlice,
    hostMutation: status.governance.hostMutation,
  },
}, null, 2));
EOF

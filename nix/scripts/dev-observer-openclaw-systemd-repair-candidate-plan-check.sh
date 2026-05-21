#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6240}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6241}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6242}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6243}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6244}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6245}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6246}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6247}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6310}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-systemd-repair-candidate-plan-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-systemd-repair-candidate-plan-check.json}"

SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
candidate_plan="$(curl --silent --fail "$SYSTEM_URL/system/systemd/repair-candidate-plan")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$candidate_plan"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const candidatePlan = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Repair Candidate Plan",
  "systemd-repair-candidate-plan-panel",
  "systemd-repair-candidate-plan-target",
  "systemd-repair-candidate-plan-mode",
  "systemd-repair-candidate-plan-creates-task",
  "systemd-repair-candidate-plan-mutation",
  "systemd-repair-candidate-plan-json",
];
const requiredClient = [
  "/system/systemd/repair-candidate-plan",
  "refreshSystemdRepairCandidatePlan",
  "systemdRepairCandidatePlanTarget",
  "systemdRepairCandidatePlanMode",
  "systemdRepairCandidatePlanCreatesTask",
  "systemdRepairCandidatePlanMutation",
  "systemdRepairCandidatePlanJson",
  "commandPreviewOnly",
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
if (!candidatePlan.ok || candidatePlan.registry !== "openclaw-systemd-repair-candidate-plan-v0") {
  throw new Error(`Observer source should expose repair candidate plan registry: ${JSON.stringify(candidatePlan)}`);
}
if (!candidatePlan.plan?.targetUnit || candidatePlan.plan?.commandPreviewOnly !== true) {
  throw new Error(`Observer-facing candidate plan should expose preview-only target: ${JSON.stringify(candidatePlan.plan)}`);
}
if (candidatePlan.governance?.createsTask !== false
  || candidatePlan.governance?.hostMutation !== false
  || candidatePlan.governance?.executesCommand !== false
  || candidatePlan.governance?.triggersRecovery !== false) {
  throw new Error(`Observer-facing candidate plan must not execute or recover: ${JSON.stringify(candidatePlan.governance)}`);
}

console.log(JSON.stringify({
  observerOpenClawSystemdRepairCandidatePlan: {
    status: "passed",
    panel: "Repair Candidate Plan",
    registry: candidatePlan.registry,
    targetUnit: candidatePlan.plan?.targetUnit,
    createsTask: candidatePlan.governance?.createsTask,
    hostMutation: candidatePlan.governance?.hostMutation,
  },
}, null, 2));
EOF

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6220}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6221}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6222}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6223}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6224}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6225}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6226}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6227}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6290}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-systemd-repair-candidate-assessment-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-systemd-repair-candidate-assessment-check.json}"

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
assessment="$(curl --silent --fail "$SYSTEM_URL/system/systemd/repair-candidates")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$assessment"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const assessment = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Repair Candidates",
  "systemd-repair-candidates-panel",
  "systemd-repair-candidate-count",
  "systemd-repair-candidate-recommended",
  "systemd-repair-candidate-creates-task",
  "systemd-repair-candidate-mutation",
  "systemd-repair-candidate-json",
];
const requiredClient = [
  "/system/systemd/repair-candidates",
  "refreshSystemdRepairCandidates",
  "systemdRepairCandidateCount",
  "systemdRepairCandidateRecommended",
  "systemdRepairCandidateCreatesTask",
  "systemdRepairCandidateMutation",
  "systemdRepairCandidateJson",
  "existingDemoTarget",
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
if (!assessment.ok || assessment.registry !== "openclaw-systemd-repair-candidate-assessment-v0") {
  throw new Error(`Observer source should expose repair candidate assessment registry: ${JSON.stringify(assessment)}`);
}
if (assessment.summary?.totalCandidates < 9 || !assessment.summary?.recommendedUnit) {
  throw new Error(`Observer-facing candidate assessment should summarize candidates: ${JSON.stringify(assessment.summary)}`);
}
if (assessment.governance?.createsTask !== false
  || assessment.governance?.hostMutation !== false
  || assessment.governance?.executesCommand !== false
  || assessment.governance?.triggersRecovery !== false) {
  throw new Error(`Observer-facing candidate assessment must not execute or recover: ${JSON.stringify(assessment.governance)}`);
}

console.log(JSON.stringify({
  observerOpenClawSystemdRepairCandidateAssessment: {
    status: "passed",
    panel: "Repair Candidates",
    registry: assessment.registry,
    candidates: assessment.summary?.totalCandidates,
    recommendedUnit: assessment.summary?.recommendedUnit,
    hostMutation: assessment.governance?.hostMutation,
  },
}, null, 2));
EOF

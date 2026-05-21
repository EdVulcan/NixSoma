#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6200}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6201}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6202}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6203}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6204}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6205}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6206}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6207}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6270}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-phase-2-next-capability-route-review-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-phase-2-next-capability-route-review-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
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
review="$(curl --silent --fail "$CORE_URL/phase-2/next-capability-route-review")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$review"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const review = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Next Capability Route",
  "phase2-next-capability-route-panel",
  "phase2-next-capability-track",
  "phase2-next-capability-slice",
  "phase2-next-capability-creates-task",
  "phase2-next-capability-mutation",
  "phase2-next-capability-json",
];
const requiredClient = [
  "/phase-2/next-capability-route-review",
  "refreshPhase2NextCapabilityRoute",
  "phase2NextCapabilityTrack",
  "phase2NextCapabilitySlice",
  "phase2NextCapabilityCreatesTask",
  "phase2NextCapabilityMutation",
  "phase2NextCapabilityJson",
  "demoExitChecks",
  "candidateDemoReady",
  "openclaw-body-evidence-timeline",
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
if (!review.ok || review.registry !== "openclaw-phase-2-next-capability-route-review-v0") {
  throw new Error(`Observer source should expose next capability route review registry: ${JSON.stringify(review)}`);
}
if (review.decision?.selectedSlice !== "openclaw-body-evidence-timeline") {
  throw new Error(`Observer-facing next capability route should select body evidence timeline: ${JSON.stringify(review.decision)}`);
}
if (review.governance?.createsTask !== false
  || review.governance?.mutatesHost !== false
  || review.governance?.executesCommand !== false
  || review.governance?.triggersRecovery !== false) {
  throw new Error(`Observer-facing next capability route must not execute or recover: ${JSON.stringify(review.governance)}`);
}
if (review.evidence?.candidateDemoReady !== true) {
  throw new Error(`Observer-facing next capability route should cite candidate demo readiness: ${JSON.stringify(review.evidence)}`);
}

console.log(JSON.stringify({
  observerOpenClawPhase2NextCapabilityRouteReview: {
    status: "passed",
    panel: "Next Capability Route",
    registry: review.registry,
    selectedSlice: review.decision?.selectedSlice,
    createsTask: review.governance?.createsTask,
    mutatesHost: review.governance?.mutatesHost,
  },
}, null, 2));
EOF

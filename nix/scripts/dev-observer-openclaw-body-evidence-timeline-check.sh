#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6360}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6361}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6362}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6363}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6364}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6365}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6366}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6367}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6430}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-body-evidence-timeline-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-body-evidence-timeline-check.json}"

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
timeline="$(curl --silent --fail "$SYSTEM_URL/system/route/body-evidence-timeline")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$timeline"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const timeline = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Body Evidence Timeline",
  "body-evidence-timeline-panel",
  "body-evidence-timeline-ready",
  "body-evidence-timeline-entries",
  "body-evidence-timeline-latest",
  "body-evidence-timeline-mutation",
  "body-evidence-timeline-json",
];
const requiredClient = [
  "/system/route/body-evidence-timeline",
  "refreshBodyEvidenceTimeline",
  "bodyEvidenceTimelineReady",
  "bodyEvidenceTimelineEntries",
  "bodyEvidenceTimelineLatest",
  "bodyEvidenceTimelineMutation",
  "bodyEvidenceTimelineJson",
  "openclaw-body-evidence-timeline-readiness",
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
if (!timeline.ok || timeline.registry !== "openclaw-body-evidence-timeline-v0") {
  throw new Error(`Observer source should expose body evidence timeline registry: ${JSON.stringify(timeline)}`);
}
if (timeline.summary?.timelineReady !== true || timeline.summary?.entries < 7) {
  throw new Error(`Observer body evidence timeline should be ready with entries: ${JSON.stringify(timeline.summary)}`);
}
if (timeline.governance?.createsTask !== false
  || timeline.governance?.createsApproval !== false
  || timeline.governance?.executesCommand !== false
  || timeline.governance?.hostMutation !== false) {
  throw new Error(`Observer body evidence timeline must remain read-only: ${JSON.stringify(timeline.governance)}`);
}

console.log(JSON.stringify({
  observerOpenClawBodyEvidenceTimeline: {
    status: "passed",
    panel: "Body Evidence Timeline",
    registry: timeline.registry,
    entries: timeline.summary?.entries,
    latest: timeline.summary?.latestEntryId,
    hostMutation: timeline.governance?.hostMutation,
  },
}, null, 2));
EOF

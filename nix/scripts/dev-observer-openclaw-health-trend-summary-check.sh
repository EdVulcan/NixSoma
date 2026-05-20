#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6040}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6041}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6042}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6043}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6044}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6045}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6046}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6047}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6110}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-health-trend-summary-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-health-trend-summary-check.json}"

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
curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
trend_summary="$(curl --silent --fail "$SYSTEM_URL/system/health/trends")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$trend_summary"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const trend = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Health Trends",
  "system-health-trends",
  "health-trend-sample-count",
  "health-trend-stable-services",
  "health-trend-degraded-services",
  "health-trend-alert-count",
  "health-trend-json",
];
const requiredClient = [
  "/system/health/trends",
  "refreshHealthTrends",
  "healthTrendSampleCount",
  "healthTrendStableServices",
  "healthTrendDegradedServices",
  "healthTrendAlertCount",
  "healthTrendJson",
  "triggersRecovery",
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

if (!trend.ok || trend.registry !== "openclaw-health-trend-summary-v0") {
  throw new Error(`Observer source should expose health trend registry: ${JSON.stringify(trend)}`);
}
if (trend.governance?.hostMutation !== false || trend.governance?.triggersRecovery !== false) {
  throw new Error(`Observer-facing health trend must remain observe-only: ${JSON.stringify(trend.governance)}`);
}
if (trend.summary?.sampleCount < 3 || trend.summary?.latestTotalServices < 7) {
  throw new Error(`Observer-facing health trend should summarize recent body samples: ${JSON.stringify(trend.summary)}`);
}

console.log(JSON.stringify({
  observerOpenClawHealthTrendSummary: {
    status: "passed",
    panel: "Health Trends",
    registry: trend.registry,
    samples: trend.summary?.sampleCount,
    stableServices: trend.summary?.stableServices,
    degradedServices: trend.summary?.degradedServices,
    next: trend.next?.recommendedSlice,
  },
}, null, 2));
EOF

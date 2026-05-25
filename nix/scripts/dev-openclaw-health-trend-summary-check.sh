#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6030}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6031}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6032}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6033}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6034}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6035}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6036}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6037}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6100}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-health-trend-summary-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-health-trend-summary-check.json}"

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
curl --silent --fail "$SYSTEM_URL/system/health" >/dev/null
trend_summary="$(curl --silent --fail "$SYSTEM_URL/system/health/trends")"

node - <<'EOF' "$PLAN_FILE" "$trend_summary"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const trend = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-health-trend-summary",
  "Health trend summary checkpoint",
  "sample window, service stability, degraded services, alert count",
  "Must not add automatic repair, background maintenance, persistence hardening",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing health trend route token: ${token}`);
  }
}

if (!trend.ok || trend.registry !== "openclaw-health-trend-summary-v0") {
  throw new Error(`health trend should expose expected registry: ${JSON.stringify(trend)}`);
}
if (trend.mode !== "read_only_recent_snapshots") {
  throw new Error(`health trend should be read-only recent snapshots: ${JSON.stringify(trend.mode)}`);
}
if (trend.governance?.hostMutation !== false
  || trend.governance?.canMutate !== false
  || trend.governance?.executesCommand !== false
  || trend.governance?.triggersRecovery !== false
  || trend.governance?.schedulesFollowUp !== false) {
  throw new Error(`health trend governance must remain observe-only: ${JSON.stringify(trend.governance)}`);
}
if (trend.summary?.sampleCount < 3) {
  throw new Error(`health trend should capture multiple recent samples: ${JSON.stringify(trend.summary)}`);
}
if (trend.summary?.latestTotalServices < 7 || trend.summary?.latestOnlineServices < 1) {
  throw new Error(`health trend should summarize service health: ${JSON.stringify(trend.summary)}`);
}
for (const resourceName of ["cpuPercent", "memoryPercent", "diskPercent", "alertCount", "onlineServices"]) {
  const resource = trend.resources?.[resourceName];
  if (!resource || !Object.hasOwn(resource, "latest") || !Object.hasOwn(resource, "max")) {
    throw new Error(`health trend missing resource trend ${resourceName}: ${JSON.stringify(trend.resources)}`);
  }
}
if (!Array.isArray(trend.services) || !trend.services.some((service) => service.service === "core")) {
  throw new Error(`health trend should include core service trend: ${JSON.stringify(trend.services)}`);
}
if (!Array.isArray(trend.snapshots) || trend.snapshots.length === 0) {
  throw new Error(`health trend should expose bounded recent snapshots: ${JSON.stringify(trend.snapshots)}`);
}
if (trend.next?.recommendedSlice !== "openclaw-route-aware-next-action-recommendation") {
  throw new Error(`health trend should point to route-aware next action recommendation: ${JSON.stringify(trend.next)}`);
}

console.log(JSON.stringify({
  openclawHealthTrendSummary: {
    status: "passed",
    registry: trend.registry,
    samples: trend.summary.sampleCount,
    latestOnlineServices: trend.summary.latestOnlineServices,
    stableServices: trend.summary.stableServices,
    degradedServices: trend.summary.degradedServices,
    next: trend.next.recommendedSlice,
  },
}, null, 2));
EOF

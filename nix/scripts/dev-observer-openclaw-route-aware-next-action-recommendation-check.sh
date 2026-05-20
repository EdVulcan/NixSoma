#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6060}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6061}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6062}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6063}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6064}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6065}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6066}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6067}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6130}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-route-aware-next-action-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-route-aware-next-action-check.json}"

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
curl --silent --fail "$SYSTEM_URL/system/health/trends" >/dev/null

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
recommendation="$(curl --silent --fail "$SYSTEM_URL/system/route/next-action")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$recommendation"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const recommendation = JSON.parse(process.argv[4]);

const requiredHtml = [
  "Route-Aware Next Action",
  "route-aware-next-action",
  "route-next-action-name",
  "route-next-action-priority",
  "route-next-action-creates-task",
  "route-next-action-mutation",
  "route-next-action-json",
];
const requiredClient = [
  "/system/route/next-action",
  "refreshRouteAwareNextAction",
  "routeNextActionName",
  "routeNextActionPriority",
  "routeNextActionCreatesTask",
  "routeNextActionMutation",
  "routeNextActionJson",
  "createsTask",
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
if (!recommendation.ok || recommendation.registry !== "openclaw-route-aware-next-action-v0") {
  throw new Error(`Observer source should expose route-aware recommendation registry: ${JSON.stringify(recommendation)}`);
}
if (recommendation.governance?.createsTask !== false
  || recommendation.governance?.hostMutation !== false
  || recommendation.governance?.triggersRecovery !== false) {
  throw new Error(`Observer-facing route recommendation must not execute or recover: ${JSON.stringify(recommendation.governance)}`);
}
if (!recommendation.candidates?.some((candidate) => candidate.id === "dependency-impact-review" && candidate.allowedNow === true)) {
  throw new Error(`Observer-facing recommendation should expose safe review candidates: ${JSON.stringify(recommendation.candidates)}`);
}

console.log(JSON.stringify({
  observerOpenClawRouteAwareNextActionRecommendation: {
    status: "passed",
    panel: "Route-Aware Next Action",
    registry: recommendation.registry,
    action: recommendation.recommendation?.action,
    priority: recommendation.recommendation?.priority,
    createsTask: recommendation.governance?.createsTask,
    hostMutation: recommendation.governance?.hostMutation,
  },
}, null, 2));
EOF

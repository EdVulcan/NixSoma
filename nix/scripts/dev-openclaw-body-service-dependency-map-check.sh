#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6010}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6011}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6012}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6013}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6014}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6015}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6016}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6017}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6080}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-body-service-dependency-map-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-body-service-dependency-map-check.json}"

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

dependency_map="$(curl --silent --fail "$SYSTEM_URL/system/systemd/dependency-map")"

node - <<'EOF' "$PLAN_FILE" "$dependency_map"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const dependencyMap = JSON.parse(process.argv[3]);

for (const token of [
  "openclaw-body-service-dependency-map",
  "Body service dependency map checkpoint",
  "nodes, upstream dependencies, downstream impact, startup layers, roots, leaves",
  "Must not add automatic restart, background repair, persistence hardening",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing body dependency map route token: ${token}`);
  }
}

if (!dependencyMap.ok || dependencyMap.registry !== "openclaw-systemd-dependency-map-v0") {
  throw new Error(`dependency map should expose expected registry: ${JSON.stringify(dependencyMap)}`);
}
if (dependencyMap.mode !== "read_only_body_governance") {
  throw new Error(`dependency map should be read-only body governance: ${JSON.stringify(dependencyMap.mode)}`);
}
if (dependencyMap.governance?.hostMutation !== false
  || dependencyMap.governance?.canMutate !== false
  || dependencyMap.governance?.canRestart !== false
  || dependencyMap.governance?.executesCommand !== false) {
  throw new Error(`dependency map governance must not mutate: ${JSON.stringify(dependencyMap.governance)}`);
}
if (dependencyMap.summary?.nodes < 9 || dependencyMap.summary?.edges < 10) {
  throw new Error(`dependency map should include the OpenClaw body graph: ${JSON.stringify(dependencyMap.summary)}`);
}
if (dependencyMap.summary?.mutationEndpoints !== 0 || dependencyMap.summary?.restartEndpoints !== 0) {
  throw new Error(`dependency map must not expose mutation endpoints: ${JSON.stringify(dependencyMap.summary)}`);
}

const nodeByUnit = new Map((dependencyMap.nodes ?? []).map((node) => [node.unit, node]));
const eventHub = nodeByUnit.get("openclaw-event-hub.service");
const browserRuntime = nodeByUnit.get("openclaw-browser-runtime.service");
const screenSense = nodeByUnit.get("openclaw-screen-sense.service");
const observerUi = nodeByUnit.get("observer-ui.service");

if (!eventHub || eventHub.upstream.length !== 0 || eventHub.impactClass !== "foundational") {
  throw new Error(`event hub should be a foundational root: ${JSON.stringify(eventHub)}`);
}
if (!browserRuntime?.upstream?.includes("openclaw-session-manager.service")
  || !browserRuntime?.upstream?.includes("openclaw-event-hub.service")) {
  throw new Error(`browser runtime should depend on event hub and session manager: ${JSON.stringify(browserRuntime)}`);
}
if (!screenSense?.upstream?.includes("openclaw-browser-runtime.service")) {
  throw new Error(`screen sense should depend on browser runtime: ${JSON.stringify(screenSense)}`);
}
if (!observerUi?.upstream?.includes("openclaw-core.service")) {
  throw new Error(`observer UI should depend on core: ${JSON.stringify(observerUi)}`);
}
if (!dependencyMap.edges?.some((edge) =>
  edge.from === "openclaw-browser-runtime.service"
    && edge.to === "openclaw-screen-sense.service"
    && edge.relation === "after"
)) {
  throw new Error(`dependency map should expose browser runtime to screen sense edge: ${JSON.stringify(dependencyMap.edges)}`);
}
if (dependencyMap.next?.recommendedSlice !== "openclaw-health-trend-summary") {
  throw new Error(`dependency map should point to health trend summary next: ${JSON.stringify(dependencyMap.next)}`);
}

console.log(JSON.stringify({
  openclawBodyServiceDependencyMap: {
    status: "passed",
    registry: dependencyMap.registry,
    nodes: dependencyMap.summary.nodes,
    edges: dependencyMap.summary.edges,
    roots: dependencyMap.roots,
    highImpact: dependencyMap.summary.highImpact,
    next: dependencyMap.next.recommendedSlice,
  },
}, null, 2));
EOF

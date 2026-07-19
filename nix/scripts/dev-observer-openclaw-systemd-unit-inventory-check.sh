#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5840}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5841}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5842}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5843}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5844}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5845}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5846}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5847}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5910}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-systemd-unit-inventory-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-systemd-unit-inventory-check.json}"
export OPENCLAW_BODY_USER_OWNED_UNITS="${OPENCLAW_BODY_USER_OWNED_UNITS:-openclaw-session-manager,openclaw-browser-runtime}"

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

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
inventory="$(curl --silent --fail "$SYSTEM_URL/system/systemd/units")"
dependency_map="$(curl --silent --fail "$SYSTEM_URL/system/systemd/dependency-map")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$inventory" "$dependency_map"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const inventory = JSON.parse(process.argv[4]);
const dependencyMap = JSON.parse(process.argv[5]);

const requiredHtml = [
  "Systemd Unit Inventory",
  "systemd-unit-inventory",
  "systemd-unit-total",
  "systemd-unit-active",
  "systemd-unit-observed",
  "systemd-unit-memory-current",
  "systemd-unit-memory-peak",
  "systemd-unit-tasks-current",
  "systemd-unit-resource-status",
  "systemd-unit-resource-warnings",
  "systemd-unit-mode",
  "systemd-unit-json",
];
const requiredClient = [
  "/system/systemd/units",
  "refreshSystemdUnitInventory",
  "systemdUnitTotal",
  "systemdUnitActive",
  "systemdUnitObserved",
  "systemdUnitMemoryCurrent",
  "systemdUnitMemoryPeak",
  "systemdUnitTasksCurrent",
  "systemdUnitResourceStatus",
  "systemdUnitResourceWarnings",
  "systemdUnitMode",
  "systemdUnitJson",
  "canMutate",
  "canRestart",
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

if (!inventory.ok || inventory.registry !== "openclaw-systemd-unit-inventory-v0") {
  throw new Error(`Observer source should expose systemd unit inventory registry: ${JSON.stringify(inventory)}`);
}
if (inventory.mode !== "read_only" || inventory.canMutate !== false || inventory.canRestart !== false) {
  throw new Error(`Observer-facing systemd inventory must stay read-only: ${JSON.stringify(inventory)}`);
}
if (inventory.source?.transport !== "dbus_native"
  || inventory.governance?.readOnlyCommands?.length !== 0
  || !inventory.governance?.readOnlyDbusMethods?.includes("org.freedesktop.DBus.Properties.GetAll")) {
  throw new Error(`Observer-facing inventory should retain native D-Bus evidence: ${JSON.stringify({
    source: inventory.source,
    governance: inventory.governance,
  })}`);
}
if (!inventory.units?.some((unit) => unit.unit === "openclaw-system-sense.service")) {
  throw new Error(`Observer-facing inventory should include system-sense body unit: ${JSON.stringify(inventory.units)}`);
}
if (!inventory.units?.some((unit) => unit.unit === "observer-ui.service")) {
  throw new Error(`Observer-facing inventory should include observer-ui unit: ${JSON.stringify(inventory.units)}`);
}
if (dependencyMap.source?.dependencyEvidence !== "dbus_native_unit_after"
  || dependencyMap.summary?.observedDependencyNodes < 1
  || !dependencyMap.nodes?.some((node) => node.unit === "openclaw-core.service"
    && node.observedUpstream?.includes("openclaw-event-hub.service"))) {
  throw new Error(`Observer-facing dependency map should retain native Unit.After evidence: ${JSON.stringify({
    source: dependencyMap.source,
    summary: dependencyMap.summary,
    core: dependencyMap.nodes?.find((node) => node.unit === "openclaw-core.service"),
  })}`);
}
if (inventory.source?.managerScopeTransport !== "system_bus_only"
  || inventory.summary?.managerScopeConfigured !== inventory.summary?.planned) {
  throw new Error(`Observer-facing inventory should retain declared manager scope evidence: ${JSON.stringify({
    source: inventory.source,
    summary: inventory.summary,
  })}`);
}
const coreUnit = inventory.units.find((unit) => unit.unit === "openclaw-core.service");
if (coreUnit?.observation !== "dbus_properties_read_only"
  || coreUnit.loadState !== "loaded"
  || coreUnit.activeState !== "active") {
  throw new Error(`Observer-facing inventory should expose native core state: ${JSON.stringify(coreUnit)}`);
}
if (coreUnit.managerScopeStatus !== "matched" || coreUnit.observedManager !== "system") {
  throw new Error(`Observer-facing inventory should show core in its declared system manager: ${JSON.stringify(coreUnit)}`);
}
if (coreUnit.resources?.registry !== "openclaw-systemd-unit-resource-observation-v0"
  || coreUnit.resources?.observed !== true
  || !Number.isSafeInteger(coreUnit.resources?.memory?.currentBytes)
  || coreUnit.resources.memory.currentBytes <= 0
  || !Number.isSafeInteger(coreUnit.resources?.memory?.effectiveHighBytes)
  || coreUnit.resources.memory.effectiveHighBytes <= 0
  || typeof coreUnit.resources?.memory?.highLimited !== "boolean"
  || typeof coreUnit.resources?.memory?.maxLimited !== "boolean"
  || inventory.summary?.resources?.observedUnits < 1
  || inventory.governance?.resourceMutation !== false) {
  throw new Error(`Observer-facing inventory should expose read-only resource evidence: ${JSON.stringify({
    core: coreUnit.resources,
    summary: inventory.summary?.resources,
    governance: inventory.governance,
  })}`);
}
if (inventory.summary?.resourceTrend?.registry !== "openclaw-systemd-unit-resource-trend-v0"
  || !["baseline", "normal", "warning", "critical"].includes(inventory.summary.resourceTrend.status)
  || inventory.summary.resourceTrend.persisted !== false
  || inventory.summary.resourceTrend.hostMutation !== false
  || coreUnit.resourceTrend?.readOnly !== true
  || coreUnit.resourceTrend?.persisted !== false) {
  throw new Error(`Observer-facing inventory should expose bounded resource trend: ${JSON.stringify({
    summary: inventory.summary?.resourceTrend,
    core: coreUnit.resourceTrend,
  })}`);
}

console.log(JSON.stringify({
  observerOpenClawSystemdUnitInventory: {
    status: "passed",
    panel: "Systemd Unit Inventory",
    registry: inventory.registry,
    mode: inventory.mode,
    total: inventory.summary?.total,
    observed: inventory.summary?.observed,
    systemdAvailable: inventory.source?.systemdAvailable,
    transport: inventory.source?.transport,
    coreState: `${coreUnit.loadState}/${coreUnit.activeState}/${coreUnit.subState}`,
    dependencyEvidence: dependencyMap.source?.dependencyEvidence,
    observedDependencyNodes: dependencyMap.summary?.observedDependencyNodes,
    managerScopeConfigured: inventory.summary?.managerScopeConfigured,
    managerScopeMatched: inventory.summary?.managerScopeMatched,
    managerScopeMismatches: inventory.summary?.managerScopeMismatches,
    managerScopeUnresolved: inventory.summary?.managerScopeUnresolved,
  },
}, null, 2));
EOF

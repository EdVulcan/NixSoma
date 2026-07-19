#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5830}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5831}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5832}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5833}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5834}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5835}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5836}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5837}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5900}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-unit-inventory-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-unit-inventory-check.json}"
export OPENCLAW_BODY_USER_OWNED_UNITS="${OPENCLAW_BODY_USER_OWNED_UNITS:-openclaw-session-manager,openclaw-browser-runtime}"

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

inventory="$(curl --silent --fail "$SYSTEM_URL/system/systemd/units")"
dependency_map="$(curl --silent --fail "$SYSTEM_URL/system/systemd/dependency-map")"

node - <<'EOF' "$inventory" "$dependency_map"
const dependencyMap = JSON.parse(process.argv[3]);
const inventory = JSON.parse(process.argv[2]);
const expectedUnits = [
  "openclaw-event-hub.service",
  "openclaw-core.service",
  "openclaw-session-manager.service",
  "openclaw-browser-runtime.service",
  "openclaw-screen-sense.service",
  "openclaw-screen-act.service",
  "openclaw-system-sense.service",
  "openclaw-system-heal.service",
  "observer-ui.service",
];

if (!inventory.ok || inventory.registry !== "openclaw-systemd-unit-inventory-v0") {
  throw new Error(`systemd unit inventory should expose the expected registry: ${JSON.stringify(inventory)}`);
}
if (inventory.mode !== "read_only" || inventory.canMutate !== false || inventory.canRestart !== false) {
  throw new Error(`systemd unit inventory must remain read-only: ${JSON.stringify({
    mode: inventory.mode,
    canMutate: inventory.canMutate,
    canRestart: inventory.canRestart,
  })}`);
}
if (inventory.summary?.total < expectedUnits.length || inventory.summary?.planned < expectedUnits.length) {
  throw new Error(`systemd unit inventory should include all OpenClaw planned units: ${JSON.stringify(inventory.summary)}`);
}
if (inventory.summary?.mutationEndpoints !== 0 || inventory.summary?.restartEndpoints !== 0) {
  throw new Error(`systemd unit inventory should not expose mutation endpoints: ${JSON.stringify(inventory.summary)}`);
}
if (inventory.source?.kind !== "openclaw-body-systemd-inventory" || inventory.source?.evidence !== "read_only_body_governance") {
  throw new Error(`systemd unit inventory should identify body governance evidence: ${JSON.stringify(inventory.source)}`);
}
if (inventory.source?.transport !== "dbus_native" || !String(inventory.source?.systemdVersion).startsWith("systemd ")) {
  throw new Error(`systemd unit inventory should use the native system bus: ${JSON.stringify(inventory.source)}`);
}
if (dependencyMap.source?.dependencyEvidence !== "dbus_native_unit_after"
  || dependencyMap.summary?.observedDependencyNodes < 1
  || dependencyMap.governance?.readOnlySources?.includes("systemd.Unit.After") !== true) {
  throw new Error(`systemd dependency map should expose native Unit.After evidence: ${JSON.stringify({
    source: dependencyMap.source,
    summary: dependencyMap.summary,
    governance: dependencyMap.governance,
  })}`);
}
if (inventory.source?.managerScopeTransport !== "system_bus_only"
  || JSON.stringify(inventory.source?.expectedUserManagerUnits) !== JSON.stringify([
    "openclaw-browser-runtime.service",
    "openclaw-session-manager.service",
  ])
  || inventory.summary?.managerScopeConfigured !== expectedUnits.length) {
  throw new Error(`systemd inventory should reconcile the desktop manager scope declaration: ${JSON.stringify({
    source: inventory.source,
    summary: inventory.summary,
  })}`);
}
if (inventory.governance?.hostMutation !== false || inventory.governance?.autonomy !== "observe_only") {
  throw new Error(`systemd unit inventory governance should stay observe-only: ${JSON.stringify(inventory.governance)}`);
}
if (inventory.governance?.resourceMutation !== false
  || inventory.source?.resourceEvidence !== "dbus_native_service_properties") {
  throw new Error(`systemd resource observation must remain D-Bus read-only: ${JSON.stringify({
    source: inventory.source,
    governance: inventory.governance,
  })}`);
}
if (inventory.governance?.readOnlyCommands?.length !== 0
  || !inventory.governance?.readOnlyDbusMethods?.includes("org.freedesktop.systemd1.Manager.GetUnit")
  || !inventory.governance?.readOnlyDbusMethods?.includes("org.freedesktop.DBus.Properties.GetAll")) {
  throw new Error(`native inventory must expose D-Bus-only read evidence: ${JSON.stringify(inventory.governance)}`);
}
if (!Array.isArray(inventory.units)) {
  throw new Error(`systemd unit inventory should expose unit items: ${JSON.stringify(inventory)}`);
}

for (const unitName of expectedUnits) {
  const unit = inventory.units.find((item) => item.unit === unitName);
  if (!unit) {
    throw new Error(`systemd unit inventory missing ${unitName}: ${JSON.stringify(inventory.units)}`);
  }
  if (unit.canMutate !== false || unit.canRestart !== false || unit.bodyOwned !== true || unit.planned !== true) {
    throw new Error(`systemd unit ${unitName} should be planned body inventory only: ${JSON.stringify(unit)}`);
  }
}

const coreUnit = inventory.units.find((item) => item.unit === "openclaw-core.service");
if (coreUnit?.observation !== "dbus_properties_read_only"
  || coreUnit.loadState !== "loaded"
  || coreUnit.activeState !== "active"
  || coreUnit.subState !== "running"
  || coreUnit.systemdObserved !== true) {
  throw new Error(`native inventory should observe the running core unit: ${JSON.stringify(coreUnit)}`);
}
if (coreUnit.managerScopeStatus !== "matched" || coreUnit.observedManager !== "system") {
  throw new Error(`core should be observed in its declared system manager: ${JSON.stringify(coreUnit)}`);
}
if (coreUnit.resources?.registry !== "openclaw-systemd-unit-resource-observation-v0"
  || coreUnit.resources?.observed !== true
  || !Number.isSafeInteger(coreUnit.resources?.memory?.currentBytes)
  || coreUnit.resources.memory.currentBytes <= 0
  || !Number.isSafeInteger(coreUnit.resources?.memory?.effectiveHighBytes)
  || coreUnit.resources.memory.effectiveHighBytes <= 0
  || typeof coreUnit.resources?.memory?.highLimited !== "boolean"
  || typeof coreUnit.resources?.memory?.maxLimited !== "boolean"
  || !Number.isSafeInteger(coreUnit.resources?.tasks?.current)
  || coreUnit.resources?.readOnly !== true) {
  throw new Error(`native inventory should expose bounded Core resource observation: ${JSON.stringify(coreUnit.resources)}`);
}
if (inventory.summary?.resources?.registry !== "openclaw-systemd-unit-resource-observation-v0"
  || inventory.summary.resources.observedUnits < 1
  || !Number.isSafeInteger(inventory.summary.resources.memoryCurrentBytes)
  || !Number.isSafeInteger(inventory.summary.resources.memoryHighLimitedUnits)
  || !Number.isSafeInteger(inventory.summary.resources.memoryMaxLimitedUnits)
  || !Number.isSafeInteger(inventory.summary.resources.tasksCurrent)) {
  throw new Error(`native inventory should summarize bounded resource observation: ${JSON.stringify(inventory.summary?.resources)}`);
}
if (inventory.summary?.resourceTrend?.registry !== "openclaw-systemd-unit-resource-trend-v0"
  || !["baseline", "normal", "warning", "critical"].includes(inventory.summary.resourceTrend.status)
  || inventory.summary.resourceTrend.sampleLimit !== 4
  || inventory.summary.resourceTrend.persisted !== false
  || inventory.summary.resourceTrend.hostMutation !== false
  || !Array.isArray(inventory.summary.resourceTrend.warnings)
  || coreUnit.resourceTrend?.registry !== "openclaw-systemd-unit-resource-trend-v0"
  || coreUnit.resourceTrend?.readOnly !== true
  || coreUnit.resourceTrend?.persisted !== false) {
  throw new Error(`native inventory should expose bounded restart-safe resource trend: ${JSON.stringify({
    summary: inventory.summary?.resourceTrend,
    core: coreUnit.resourceTrend,
  })}`);
}

const coreDependency = dependencyMap.nodes?.find((node) => node.unit === "openclaw-core.service");
if (!coreDependency?.observedUpstream?.includes("openclaw-event-hub.service")
  || coreDependency.dependencyEvidence !== "dbus_native_unit_after") {
  throw new Error(`native dependency evidence should observe core after event hub: ${JSON.stringify(coreDependency)}`);
}

if (inventory.next?.boundary !== "plan-only repair proposal before any host mutation") {
  throw new Error(`systemd unit inventory should point to plan-only repair next: ${JSON.stringify(inventory.next)}`);
}

console.log(JSON.stringify({
  openclawSystemdUnitInventory: {
    status: "passed",
    registry: inventory.registry,
    mode: inventory.mode,
    systemdAvailable: inventory.source.systemdAvailable,
    transport: inventory.source.transport,
    coreState: `${coreUnit.loadState}/${coreUnit.activeState}/${coreUnit.subState}`,
    total: inventory.summary.total,
    plannedUnits: expectedUnits.length,
    dependencyEvidence: dependencyMap.source.dependencyEvidence,
    observedDependencyNodes: dependencyMap.summary.observedDependencyNodes,
    dependencyDriftNodes: dependencyMap.summary.dependencyDriftNodes,
    managerScopeConfigured: inventory.summary.managerScopeConfigured,
    managerScopeMatched: inventory.summary.managerScopeMatched,
    managerScopeMismatches: inventory.summary.managerScopeMismatches,
    managerScopeUnresolved: inventory.summary.managerScopeUnresolved,
    next: inventory.next.recommendedSlice,
  },
}, null, 2));
EOF

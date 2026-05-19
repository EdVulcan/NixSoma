#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5880}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5881}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5882}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5883}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5884}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5885}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5886}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5887}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5950}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-systemd-repair-dry-run-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-systemd-repair-dry-run-check.json}"

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
envelope="$(curl --silent --fail "$SYSTEM_URL/system/systemd/repair-dry-run?unit=openclaw-browser-runtime.service")"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$envelope"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const envelope = JSON.parse(process.argv[4]);

const requiredHtml = [
  "systemd-repair-dry-run-mode",
  "systemd-repair-dry-run-json",
  "Loading dry-run repair envelope",
];
const requiredClient = [
  "/system/systemd/repair-dry-run?unit=openclaw-browser-runtime.service",
  "systemdRepairDryRunMode",
  "systemdRepairDryRunJson",
  "operator_visible_dry_run",
  "wouldExecute",
  "no_restart_executed",
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
if (!envelope.ok || envelope.registry !== "openclaw-systemd-repair-dry-run-v0" || envelope.mode !== "operator_visible_dry_run") {
  throw new Error(`Observer dry-run source should expose the dry-run registry: ${JSON.stringify(envelope)}`);
}
if (envelope.canMutate !== false || envelope.canRestart !== false || envelope.dryRun?.wouldExecute !== false) {
  throw new Error(`Observer dry-run source should remain non-mutating: ${JSON.stringify(envelope)}`);
}
if (!envelope.dryRun?.checks?.some((check) => check.name === "operator_visible_before_mutation" && check.passed === true)) {
  throw new Error(`Observer dry-run source should show operator-visible check: ${JSON.stringify(envelope.dryRun?.checks)}`);
}

console.log(JSON.stringify({
  observerOpenClawSystemdRepairDryRun: {
    status: "passed",
    panel: "Systemd Repair Plan",
    registry: envelope.registry,
    mode: envelope.mode,
    command: `${envelope.dryRun?.command} ${(envelope.dryRun?.args ?? []).join(" ")}`,
  },
}, null, 2));
EOF

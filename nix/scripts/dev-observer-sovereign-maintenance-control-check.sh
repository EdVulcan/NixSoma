#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9050}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9051}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9052}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9053}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9054}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9055}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9056}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9057}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9120}"
export OPENCLAW_AUTONOMY_MODE="${OPENCLAW_AUTONOMY_MODE:-sovereign_body}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-sovereign-maintenance-control-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-sovereign-maintenance-control-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-observer-sovereign-maintenance-control-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
EVENT_HUB_URL="http://127.0.0.1:$OPENCLAW_EVENT_HUB_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp" \
  "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${BODY_FILE:-}" \
    "${TICK_FILE:-}" \
    "${STATE_FILE:-}" \
    "${HISTORY_FILE:-}" \
    "${APPROVALS_FILE:-}" \
    "${EVENTS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

post_file() {
  local url="$1"
  local file="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data-binary "@$file"
}

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
BODY_FILE="$(mktemp)"
TICK_FILE="$(mktemp)"
STATE_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"
EVENTS_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"

node - <<'EOF' > "$BODY_FILE"
const now = new Date().toISOString();
process.stdout.write(JSON.stringify({
  force: true,
  autofix: true,
  mode: "simulated",
  system: {
    timestamp: now,
    body: {
      hostname: "observer-sovereign-maintenance-control-body",
      platform: "linux",
      release: "test",
      arch: "x64",
      uptimeSeconds: 840,
      processUptimeSeconds: 20,
      pid: 9120,
      node: process.version,
      stateDir: "/var/lib/openclaw",
      diskPath: "/var/lib/openclaw",
    },
    services: {
      core: {
        name: "core",
        ok: true,
        status: "healthy",
        url: "http://127.0.0.1:9050",
        detail: "openclaw-core",
        stage: "active",
        latencyMs: 2,
        checkedAt: now,
      },
      browserRuntime: {
        name: "browserRuntime",
        ok: false,
        status: "offline",
        url: "http://127.0.0.1:9053",
        detail: "offline",
        stage: null,
        latencyMs: 1500,
        checkedAt: now,
      },
    },
    resources: {
      cpuPercent: 4,
      cpuCores: 4,
      loadAverage: [0.01, 0.02, 0.03],
      memoryPercent: 29,
      memory: {
        totalBytes: 100,
        freeBytes: 71,
        usedBytes: 29,
      },
      diskPercent: 23,
      disk: {
        path: "/var/lib/openclaw",
        available: true,
      },
    },
    network: {
      online: true,
      checkedTargets: 8,
    },
    alerts: [],
  },
}, null, 2));
EOF

post_file "$HEAL_URL/maintenance/tick" "$BODY_FILE" > "$TICK_FILE"
curl --silent --fail "$HEAL_URL/maintenance/state" > "$STATE_FILE"
curl --silent --fail "$HEAL_URL/maintenance/history?limit=5" > "$HISTORY_FILE"
curl --silent --fail "$CORE_URL/approvals?limit=8" > "$APPROVALS_FILE"
curl --silent --fail "$EVENT_HUB_URL/events/audit?limit=80" > "$EVENTS_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$TICK_FILE" "$STATE_FILE" "$HISTORY_FILE" "$APPROVALS_FILE" "$EVENTS_FILE"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const tick = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const state = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const history = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
const approvals = JSON.parse(fs.readFileSync(process.argv[7], "utf8"));
const events = JSON.parse(fs.readFileSync(process.argv[8], "utf8"));

for (const token of [
  "run-maintenance-button",
  "Run Maintenance Tick",
]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing maintenance control ${token}`);
  }
}

for (const token of [
  "runMaintenanceTickFromUi",
  "/maintenance/tick",
  "force: true",
  "Maintenance tick",
  "refreshMaintenanceState",
  "refreshHealState",
]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing maintenance control token ${token}`);
  }
}

if (!tick.ok || tick.tick?.status !== "ran" || tick.tick?.reason !== "forced" || tick.run?.status !== "repaired") {
  throw new Error(`Observer maintenance control should force a conservative tick: ${JSON.stringify(tick)}`);
}
if (tick.run?.autonomy?.approvalRequired !== false || tick.run?.autonomy?.governance !== "audit_only") {
  throw new Error(`Observer maintenance control should remain body-internal audit-only: ${JSON.stringify(tick.run?.autonomy)}`);
}
if (!state.ok || state.policy?.lastTick?.status !== "ran" || state.runCount !== 1 || state.latestRun?.id !== tick.run?.id) {
  throw new Error(`Observer maintenance control should update maintenance state: ${JSON.stringify(state)}`);
}
if (!history.ok || history.count !== 1 || history.items?.[0]?.status !== "repaired") {
  throw new Error(`Observer maintenance control should be visible in maintenance history: ${JSON.stringify(history)}`);
}
if (approvals.summary?.counts?.pending !== 0 || approvals.summary?.counts?.total !== 0) {
  throw new Error(`Observer maintenance control must not create approval gates: ${JSON.stringify(approvals.summary)}`);
}

const eventTypes = new Set((events.items ?? []).map((event) => event.type));
for (const type of ["maintenance.tick", "maintenance.started", "maintenance.completed", "heal.started", "heal.completed"]) {
  if (!eventTypes.has(type)) {
    throw new Error(`Observer maintenance control audit log missing ${type}`);
  }
}

console.log(JSON.stringify({
  observerSovereignMaintenanceControl: {
    button: "run-maintenance-button",
    endpoint: "/maintenance/tick",
    tick: {
      status: tick.tick.status,
      reason: tick.tick.reason,
      runStatus: tick.run.status,
    },
    autonomy: tick.run.autonomy,
    approvals: approvals.summary,
  },
}, null, 2));
EOF

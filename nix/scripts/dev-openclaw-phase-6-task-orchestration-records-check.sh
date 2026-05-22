#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-7060}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-7061}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-7062}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-7063}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-7064}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-7065}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-7066}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-7067}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-7068}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-6-orchestration-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-6-orchestration-check.json}"
CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"
"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
cleanup() { rm -f "${RECORDS_FILE:-}"; "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true; }
trap cleanup EXIT
"$SCRIPT_DIR/dev-up.sh"
prepare_phase_4_self_heal_evidence "$HEAL_URL"
RECORDS_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-6/task-orchestration-records" > "$RECORDS_FILE"
node - <<'EOF' "$RECORDS_FILE"
const fs = require("node:fs");
const records = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!records.ok || records.registry !== "openclaw-phase-6-task-orchestration-records-v0" || records.summary?.ready !== true || records.summary?.recordCount < 3 || records.summary?.scheduledTasks !== 0 || records.summary?.createsTask !== false) {
  throw new Error(`Phase 6 task orchestration records should be ready and non-executing: ${JSON.stringify(records.summary)}`);
}
console.log(JSON.stringify({ openclawPhase6TaskOrchestrationRecords: { status: "passed", records: records.summary.recordCount } }, null, 2));
EOF

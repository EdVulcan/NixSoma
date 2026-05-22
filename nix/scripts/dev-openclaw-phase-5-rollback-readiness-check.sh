#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6910}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6911}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6912}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6913}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6914}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6915}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6916}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6917}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6918}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-5-rollback-readiness-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-5-rollback-readiness-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  rm -f "${ROLLBACK_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"
prepare_phase_4_self_heal_evidence "$HEAL_URL"
ROLLBACK_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-5/rollback-readiness" > "$ROLLBACK_FILE"

node - <<'EOF' "$ROLLBACK_FILE"
const fs = require("node:fs");
const readiness = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

if (!readiness.ok
  || readiness.registry !== "openclaw-phase-5-rollback-readiness-v0"
  || readiness.status !== "rollback_readiness_ready"
  || readiness.summary?.ready !== true
  || readiness.summary?.rollbackSurfaces < 4
  || readiness.summary?.rollbackExecuted !== false
  || readiness.summary?.mutatesHost !== false) {
  throw new Error(`Phase 5 rollback readiness should be ready and non-executing: ${JSON.stringify(readiness.summary)}`);
}
for (const token of ["nixos-generations", "git-source-rollback", "service-level-repair-evidence", "dev-lifecycle-stop-start"]) {
  if (!JSON.stringify(readiness.rollback?.surfaces).includes(token)) throw new Error(`Rollback readiness missing ${token}`);
}

console.log(JSON.stringify({
  openclawPhase5RollbackReadiness: {
    status: "passed",
    registry: readiness.registry,
    rollbackSurfaces: readiness.summary.rollbackSurfaces,
    rollbackExecuted: readiness.summary.rollbackExecuted,
  },
}, null, 2));
EOF

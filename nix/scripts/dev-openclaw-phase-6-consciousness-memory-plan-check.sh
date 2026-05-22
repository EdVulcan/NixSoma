#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_DOC="$REPO_ROOT/docs/OPENCLAW_PHASE_6_PLAN.md"
export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-7030}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-7031}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-7032}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-7033}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-7034}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-7035}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-7036}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-7037}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-7038}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-6-plan-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-6-plan-check.json}"
CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"
"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
cleanup() { rm -f "${PLAN_FILE:-}"; "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true; }
trap cleanup EXIT
"$SCRIPT_DIR/dev-up.sh"
prepare_phase_4_self_heal_evidence "$HEAL_URL"
PLAN_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-6/plan" > "$PLAN_FILE"
node - <<'EOF' "$PLAN_DOC" "$PLAN_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const plan = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
for (const token of ["openclaw-phase-6-consciousness-memory-plan", "Give the body a memory-bearing task mind", "No durable memory writes"]) {
  if (!doc.includes(token)) throw new Error(`Phase 6 plan doc missing ${token}`);
}
if (!plan.ok || plan.registry !== "openclaw-phase-6-consciousness-memory-plan-v0" || plan.summary?.ready !== true || plan.summary?.writesMemory !== false || plan.summary?.callsCloudModel !== false || plan.next?.recommendedSlice !== "openclaw-phase-6-memory-substrate-inventory") {
  throw new Error(`Phase 6 plan should be ready and read-only: ${JSON.stringify(plan.summary)}`);
}
console.log(JSON.stringify({ openclawPhase6Plan: { status: "passed", registry: plan.registry, next: plan.next.recommendedSlice } }, null, 2));
EOF

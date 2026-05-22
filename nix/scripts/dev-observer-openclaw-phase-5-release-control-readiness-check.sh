#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6970}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6971}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6972}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6973}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6974}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6975}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6976}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6977}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6978}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-phase-5-release-control-readiness-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-phase-5-release-control-readiness-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${READINESS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"
prepare_phase_4_self_heal_evidence "$HEAL_URL"
HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
READINESS_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/phase-5/release-control-readiness" > "$READINESS_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$READINESS_FILE"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const readiness = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));

for (const token of ["Phase 5 Release Control Readiness", "phase5-release-control-readiness-panel", "phase5-release-percent", "phase5-release-mutation"]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of ["/phase-5/release-control-readiness", "refreshPhase5ReleaseControlReadiness", "openclaw-phase-5-release-control-readiness-v0"]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
if (!readiness.ok || readiness.summary?.ready !== true || readiness.summary?.completionPercent !== 100) {
  throw new Error(`Observer Phase 5 release control readiness should be 100%: ${JSON.stringify(readiness.summary)}`);
}

console.log(JSON.stringify({ observerOpenClawPhase5ReleaseControlReadiness: { status: "passed", panel: "Phase 5 Release Control Readiness", percent: readiness.summary.completionPercent } }, null, 2));
EOF

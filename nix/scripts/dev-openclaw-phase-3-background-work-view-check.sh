#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6700}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6701}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6702}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6703}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6704}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6705}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6706}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6707}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6708}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-3-background-work-view-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-3-background-work-view-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  rm -f "${BACKGROUND_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"
curl --silent --fail -X POST "$SESSION_MANAGER_URL/work-view/prepare" \
  -H 'content-type: application/json' \
  --data '{"displayTarget":"workspace-2","entryUrl":"https://example.com/phase-3-background"}' >/dev/null

BACKGROUND_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-3/background-work-view" > "$BACKGROUND_FILE"

node - <<'EOF' "$BACKGROUND_FILE"
const fs = require("node:fs");
const background = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

if (!background.ok
  || background.registry !== "openclaw-phase-3-background-work-view-v0"
  || background.status !== "background_work_view_ready"
  || background.summary?.ready !== true
  || background.summary?.defaultForegroundSteal !== false) {
  throw new Error(`background work view should be ready and non-intrusive: ${JSON.stringify(background.summary)}`);
}
if (background.workViewContract?.defaultVisibility !== "hidden"
  || background.workViewContract?.defaultMode !== "background"
  || background.workViewContract?.revealRequiresExplicitOperatorAction !== true) {
  throw new Error(`background work-view contract mismatch: ${JSON.stringify(background.workViewContract)}`);
}
if (background.current?.workView?.visibility !== "hidden"
  || background.current?.workView?.mode !== "background") {
  throw new Error(`current work view should remain hidden/background: ${JSON.stringify(background.current?.workView)}`);
}
const trustedSession = background.workViewContract?.trustedSession ?? background.current?.workView?.trustedSession;
if (trustedSession?.identityLevel !== "level_2_trusted_session_work_view"
  || trustedSession?.boundary?.workViewScope !== "ai_owned_work_view_only"
  || trustedSession?.boundary?.desktopWideCapture !== false
  || trustedSession?.boundary?.rootRequired !== false
  || trustedSession?.operatorGates?.reveal !== "explicit_operator_action") {
  throw new Error(`background work-view should expose trusted session boundary: ${JSON.stringify(trustedSession)}`);
}

console.log(JSON.stringify({
  openclawPhase3BackgroundWorkView: {
    status: "passed",
    registry: background.registry,
    visibility: background.current.workView.visibility,
    mode: background.current.workView.mode,
    trustedSession: trustedSession.identityLevel,
  },
}, null, 2));
EOF

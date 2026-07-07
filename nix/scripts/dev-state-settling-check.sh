#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-state-settling-check.json}"
export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-4110}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-4111}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-4112}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-4113}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-4114}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-4115}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-4116}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-4117}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-4180}"

SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"
BROWSER_RUNTIME_URL="http://127.0.0.1:$OPENCLAW_BROWSER_RUNTIME_PORT"
SCREEN_SENSE_URL="http://127.0.0.1:$OPENCLAW_SCREEN_SENSE_PORT"
SCREEN_ACT_URL="http://127.0.0.1:$OPENCLAW_SCREEN_ACT_PORT"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-wait-helper.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"

cleanup() {
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

wait_http_down() {
  local url="$1"
  openclaw_wait_for_http_down "$url" 5 0.2
}

warming_screen="$(curl --silent "$SCREEN_SENSE_URL/screen/current")"
node -e "const data=JSON.parse(process.argv[1]); if(!['warming_up','ready'].includes(data.screen.readiness)){throw new Error(\`Expected warming_up or ready screen readiness, got: \${data.screen.readiness}\`);}" "$warming_screen"

browser=""
for attempt in 1 2 3 4 5; do
  browser="$(curl --silent -X POST "$BROWSER_RUNTIME_URL/browser/open" -H 'content-type: application/json' -d '{"url":"https://example.com/state-check"}')"
  if node -e "const data=JSON.parse(process.argv[1]); process.exit(data.ok && data.browser && data.browser.sessionId ? 0 : 1);" "$browser"; then
    break
  fi
  openclaw_wait_interval 0.4
done
node -e "const data=JSON.parse(process.argv[1]); if(!(data.ok && data.browser && data.browser.sessionId)){throw new Error(\`Expected browser sessionId, got: \${JSON.stringify(data)}\`);}" "$browser"

ready_screen="$(curl --silent "$SCREEN_SENSE_URL/screen/current")"
node -e "const data=JSON.parse(process.argv[1]); if(data.screen.readiness!=='ready'){throw new Error('Expected ready screen readiness.');} if(!data.screen.sessionId){throw new Error('Expected ready screen sessionId.');}" "$ready_screen"

ready_action="$(curl --silent -X POST "$SCREEN_ACT_URL/act/mouse/click" -H 'content-type: application/json' -d '{"x":320,"y":240,"button":"left"}')"
node -e "const data=JSON.parse(process.argv[1]); if(data.action.degraded!==false){throw new Error('Expected ready action degraded=false.');}" "$ready_action"

session_pid="$(awk -F $'\t' '$1=="openclaw-session-manager" { print $2 }' "$REPO_ROOT/.artifacts/dev-services-unix.tsv")"
browser_pid="$(awk -F $'\t' '$1=="openclaw-browser-runtime" { print $2 }' "$REPO_ROOT/.artifacts/dev-services-unix.tsv")"
kill "$session_pid" >/dev/null 2>&1 || true
kill "$browser_pid" >/dev/null 2>&1 || true
wait_http_down "$SESSION_MANAGER_URL/health" || true
wait_http_down "$BROWSER_RUNTIME_URL/health" || true

degraded_screen="$(curl --silent "$SCREEN_SENSE_URL/screen/current")"
node -e "const data=JSON.parse(process.argv[1]); if(data.screen.readiness!=='degraded'){throw new Error('Expected degraded screen readiness.');}" "$degraded_screen"

degraded_action="$(curl --silent -X POST "$SCREEN_ACT_URL/act/mouse/click" -H 'content-type: application/json' -d '{"x":10,"y":10,"button":"left"}')"
node -e "const data=JSON.parse(process.argv[1]); if(data.action.degraded!==true){throw new Error('Expected degraded action degraded=true.');}" "$degraded_action"

node - <<'EOF' "$warming_screen" "$ready_screen" "$ready_action" "$degraded_screen" "$degraded_action"
const warming = JSON.parse(process.argv[2]);
const ready = JSON.parse(process.argv[3]);
const readyAction = JSON.parse(process.argv[4]);
const degraded = JSON.parse(process.argv[5]);
const degradedAction = JSON.parse(process.argv[6]);
console.log(JSON.stringify({
  warming_up: warming.screen.readiness,
  ready: {
    readiness: ready.screen.readiness,
    sessionId: ready.screen.sessionId,
    actionDegraded: readyAction.action.degraded,
  },
  degraded: {
    readiness: degraded.screen.readiness,
    actionDegraded: degradedAction.action.degraded,
  },
}, null, 2));
EOF

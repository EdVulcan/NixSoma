#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-state-settling-check.json}"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"

cleanup() {
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

warming_screen="$(curl --silent http://127.0.0.1:4104/screen/current)"
node -e "const data=JSON.parse(process.argv[1]); if(!['warming_up','ready'].includes(data.screen.readiness)){throw new Error(\`Expected warming_up or ready screen readiness, got: \${data.screen.readiness}\`);}" "$warming_screen"

browser=""
for attempt in 1 2 3 4 5; do
  browser="$(curl --silent -X POST http://127.0.0.1:4103/browser/open -H 'content-type: application/json' -d '{"url":"https://example.com/state-check"}')"
  if node -e "const data=JSON.parse(process.argv[1]); process.exit(data.ok && data.browser && data.browser.sessionId ? 0 : 1);" "$browser"; then
    break
  fi
  sleep 0.4
done
node -e "const data=JSON.parse(process.argv[1]); if(!(data.ok && data.browser && data.browser.sessionId)){throw new Error(\`Expected browser sessionId, got: \${JSON.stringify(data)}\`);}" "$browser"

ready_screen="$(curl --silent http://127.0.0.1:4104/screen/current)"
node -e "const data=JSON.parse(process.argv[1]); if(data.screen.readiness!=='ready'){throw new Error('Expected ready screen readiness.');} if(!data.screen.sessionId){throw new Error('Expected ready screen sessionId.');}" "$ready_screen"

ready_action="$(curl --silent -X POST http://127.0.0.1:4105/act/mouse/click -H 'content-type: application/json' -d '{"x":320,"y":240,"button":"left"}')"
node -e "const data=JSON.parse(process.argv[1]); if(data.action.degraded!==false){throw new Error('Expected ready action degraded=false.');}" "$ready_action"

session_pid="$(awk -F $'\t' '$1=="openclaw-session-manager" { print $2 }' "$REPO_ROOT/.artifacts/dev-services-unix.tsv")"
kill "$session_pid" >/dev/null 2>&1 || true
sleep 0.3

degraded_screen="$(curl --silent http://127.0.0.1:4104/screen/current)"
node -e "const data=JSON.parse(process.argv[1]); if(data.screen.readiness!=='degraded'){throw new Error('Expected degraded screen readiness.');}" "$degraded_screen"

degraded_action="$(curl --silent -X POST http://127.0.0.1:4105/act/mouse/click -H 'content-type: application/json' -d '{"x":10,"y":10,"button":"left"}')"
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

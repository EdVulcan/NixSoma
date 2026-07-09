#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_URL="https://example.com/openclaw-ai-work-view-capture"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5700}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5701}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5702}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5703}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5704}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5705}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5706}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5707}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5770}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-ai-work-view-capture-check.json}"

BROWSER_URL="http://127.0.0.1:$OPENCLAW_BROWSER_RUNTIME_PORT"
SCREEN_URL="http://127.0.0.1:$OPENCLAW_SCREEN_SENSE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"

cleanup() {
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_FAILURE="allow"
OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-wait-helper.sh"


assert_json() {
  local json="$1"
  local script="$2"
  node -e "$script" "$json"
}

"$SCRIPT_DIR/dev-up.sh"

open_result=""
for attempt in 1 2 3 4 5; do
  open_result="$(post_json "$BROWSER_URL/browser/open" "{\"url\":\"$TARGET_URL\"}" || true)"
  if [[ -n "$open_result" ]] && node -e "try { const data=JSON.parse(process.argv[1]); process.exit(data.ok && data.browser?.sessionId ? 0 : 1); } catch { process.exit(1); }" "$open_result"; then
    break
  fi
  openclaw_wait_interval 0.4
done
assert_json "$open_result" 'const data=JSON.parse(process.argv[1]); if(!data.ok || !data.browser?.sessionId){throw new Error(`browser work view did not open with session: ${JSON.stringify(data)}`);}'

post_json "$BROWSER_URL/browser/input" '{"text":"openclaw sees its own work view"}' >/dev/null
post_json "$BROWSER_URL/browser/click" '{"x":512,"y":256}' >/dev/null

provider="$(curl --silent "$SCREEN_URL/screen/provider")"
capture="$(curl --silent "$BROWSER_URL/browser/capture")"
screen="$(curl --silent "$SCREEN_URL/screen/current")"

node - <<'EOF' "$provider" "$capture" "$screen" "$TARGET_URL"
const provider = JSON.parse(process.argv[2]);
const captureResponse = JSON.parse(process.argv[3]);
const screenResponse = JSON.parse(process.argv[4]);
const targetUrl = process.argv[5];

const capture = captureResponse.capture;
const screen = screenResponse.screen;

if (provider.provider?.mode !== "browser" || provider.provider?.ready !== true) {
  throw new Error(`expected ready browser capture provider: ${JSON.stringify(provider.provider)}`);
}
if (capture?.source !== "browser-runtime") {
  throw new Error(`expected browser-runtime capture source: ${JSON.stringify(capture)}`);
}
if (capture.captureStrategy !== "browser-runtime-backed") {
  throw new Error(`expected browser-runtime-backed capture strategy: ${capture.captureStrategy}`);
}
if (capture.activeUrl !== targetUrl || capture.workView?.activeUrl !== targetUrl) {
  throw new Error(`capture should expose active work view URL ${targetUrl}: ${JSON.stringify(capture.workView)}`);
}
if (capture.workView?.mode !== "ai-owned-work-view" || capture.workView?.visibility !== "observable") {
  throw new Error(`capture should identify the AI-owned observable work view: ${JSON.stringify(capture.workView)}`);
}
const captureTrust = capture.trustedSession ?? capture.workView?.trustedSession;
if (captureTrust?.identityLevel !== "level_2_trusted_session_work_view"
  || captureTrust?.boundary?.workViewScope !== "ai_owned_work_view_only"
  || captureTrust?.boundary?.desktopWideCapture !== false
  || captureTrust?.boundary?.rootRequired !== false
  || captureTrust?.operatorGates?.reveal !== "explicit_operator_action") {
  throw new Error(`capture should expose trusted AI work-view boundary: ${JSON.stringify(captureTrust)}`);
}
if (!capture.sessionId || !capture.snapshotText?.includes("Capture Strategy: browser-runtime-backed")) {
  throw new Error(`capture missing session or readable snapshot contract: ${JSON.stringify(capture)}`);
}
if (!capture.ocrBlocks?.some((block) => block.text === "AI-owned work view")) {
  throw new Error(`capture OCR blocks should expose AI-owned work view label: ${JSON.stringify(capture.ocrBlocks)}`);
}
if (screen.readiness !== "ready") {
  throw new Error(`screen-sense should report ready after browser work view capture: ${screen.readiness}`);
}
if (screen.captureSource !== "browser-runtime" || screen.captureStrategy !== "browser-runtime-backed") {
  throw new Error(`screen-sense should surface browser runtime capture metadata: ${JSON.stringify({
    source: screen.captureSource,
    strategy: screen.captureStrategy,
  })}`);
}
if (screen.workView?.activeUrl !== targetUrl || screen.captureMetadata?.activeUrl !== targetUrl) {
  throw new Error(`screen-sense should surface work view URL: ${JSON.stringify({
    workView: screen.workView,
    captureMetadata: screen.captureMetadata,
  })}`);
}
const screenTrust = screen.trustedSession ?? screen.workView?.trustedSession ?? screen.captureMetadata?.trustedSession;
if (screenTrust?.identityLevel !== "level_2_trusted_session_work_view"
  || screenTrust?.boundary?.workViewScope !== "ai_owned_work_view_only") {
  throw new Error(`screen-sense should propagate trusted work-view contract: ${JSON.stringify(screenTrust)}`);
}

console.log(JSON.stringify({
  provider: provider.provider,
  browserCapture: {
    source: capture.source,
    strategy: capture.captureStrategy,
    sessionId: capture.sessionId,
    activeUrl: capture.activeUrl,
    tabCount: capture.tabCount,
    mode: capture.workView?.mode ?? null,
    trustedSession: captureTrust.identityLevel,
  },
  screenSense: {
    readiness: screen.readiness,
    captureSource: screen.captureSource,
    captureStrategy: screen.captureStrategy,
    activeUrl: screen.workView?.activeUrl ?? null,
    trustedSession: screenTrust.identityLevel,
  },
}, null, 2));
EOF

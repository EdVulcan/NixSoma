#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_URL="https://example.com/openclaw-ai-work-view-capture-summary"
INPUT_TEXT="openclaw summary can read the work view"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5720}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5721}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5722}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5723}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5724}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5725}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5726}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5727}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5790}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-ai-work-view-capture-summary-check.json}"
OPENCLAW_DEV_RUN_ID="${OPENCLAW_DEV_RUN_ID:-ports-$OPENCLAW_CORE_PORT}"
export OPENCLAW_SESSION_MANAGER_STATE_FILE="${OPENCLAW_SESSION_MANAGER_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-session-manager-ai-work-view-capture-summary-$OPENCLAW_CORE_PORT.json}"
export OPENCLAW_BROWSER_RUNTIME_STATE_FILE="${OPENCLAW_BROWSER_RUNTIME_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-browser-runtime-ai-work-view-capture-summary-$OPENCLAW_CORE_PORT.json}"
OPENCLAW_BROWSER_RUNTIME_OPERATOR_TOKEN_FILE="${OPENCLAW_BROWSER_RUNTIME_OPERATOR_TOKEN_FILE:-$REPO_ROOT/.artifacts/openclaw-browser-runtime-credentials-$OPENCLAW_DEV_RUN_ID/openclaw-operator}"

BROWSER_URL="http://127.0.0.1:$OPENCLAW_BROWSER_RUNTIME_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"
SCREEN_ACT_URL="http://127.0.0.1:$OPENCLAW_SCREEN_ACT_PORT"
SCREEN_URL="http://127.0.0.1:$OPENCLAW_SCREEN_SENSE_PORT"

browser_curl() {
  local browser_token="${OPENCLAW_BROWSER_RUNTIME_AUTH_TOKEN:-}"
  if [[ -z "$browser_token" && -s "$OPENCLAW_BROWSER_RUNTIME_OPERATOR_TOKEN_FILE" ]]; then
    browser_token="$(tr -d '\r\n' <"$OPENCLAW_BROWSER_RUNTIME_OPERATOR_TOKEN_FILE")"
  fi
  local auth_args=()
  if [[ -n "$browser_token" ]]; then
    auth_args=(
      -H "authorization: Bearer $browser_token"
      -H "x-openclaw-service-caller: openclaw-operator"
    )
  fi
  curl "${auth_args[@]}" "$@"
}

browser_post_json() {
  local url="$1"
  local payload="$2"
  browser_curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SESSION_MANAGER_STATE_FILE" "$OPENCLAW_SESSION_MANAGER_STATE_FILE.tmp" \
  "$OPENCLAW_BROWSER_RUNTIME_STATE_FILE" "$OPENCLAW_BROWSER_RUNTIME_STATE_FILE.tmp-"*

cleanup() {
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
  rm -f "$OPENCLAW_SESSION_MANAGER_STATE_FILE" "$OPENCLAW_SESSION_MANAGER_STATE_FILE.tmp" \
    "$OPENCLAW_BROWSER_RUNTIME_STATE_FILE" "$OPENCLAW_BROWSER_RUNTIME_STATE_FILE.tmp-"*
}
trap cleanup EXIT

OPENCLAW_POST_JSON_FAILURE="allow"
OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


"$SCRIPT_DIR/dev-up.sh"

prepare_result="$(post_json "$SESSION_MANAGER_URL/work-view/prepare" "{\"displayTarget\":\"workspace-2\",\"entryUrl\":\"$TARGET_URL\"}")"
node -e 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.workView?.helperRuntime?.status!=="active"){throw new Error(`work view prepare failed: ${JSON.stringify(data)}`);}' "$prepare_result"
session_state="$(curl --silent --fail "$SESSION_MANAGER_URL/work-view/state")"
input_body="$(node -e 'const data=JSON.parse(process.argv[1]); const r=data.workView?.helperRuntime??{}; const trustedHelperLease={registry:"openclaw-trusted-work-view-helper-lease-v0",owner:r.owner,mode:r.mode,scope:r.scope,leaseId:r.leaseId,sessionId:r.sessionId,workViewId:r.workViewId,heartbeatAt:r.heartbeatAt,actionAuthority:r.actionAuthority}; process.stdout.write(JSON.stringify({text:process.argv[2],trustedHelperLease}));' "$session_state" "$INPUT_TEXT")"
click_body="$(node -e 'const body=JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify({x:640,y:360,trustedHelperLease:body.trustedHelperLease}));' "$input_body")"
browser_post_json "$BROWSER_URL/browser/input" "$input_body" >/dev/null
browser_post_json "$BROWSER_URL/browser/click" "$click_body" >/dev/null

capture="$(browser_curl --silent --fail "$BROWSER_URL/browser/capture")"
screen="$(curl --silent "$SCREEN_URL/screen/current")"

node - <<'EOF' "$capture" "$screen" "$TARGET_URL" "$INPUT_TEXT"
const captureResponse = JSON.parse(process.argv[2]);
const screenResponse = JSON.parse(process.argv[3]);
const targetUrl = process.argv[4];
const inputText = process.argv[5];

const captureSummary = captureResponse.capture?.workViewSummary;
const screenSummary = screenResponse.screen?.workViewSummary;
const trustedSession = screenResponse.screen?.trustedSession ?? screenResponse.screen?.workView?.trustedSession ?? screenResponse.screen?.captureMetadata?.trustedSession;

if (captureSummary?.kind !== "browser-work-view-summary") {
  throw new Error(`browser capture should expose a browser work view summary: ${JSON.stringify(captureSummary)}`);
}
if (captureSummary.url !== targetUrl || !captureSummary.summaryText?.includes(targetUrl)) {
  throw new Error(`browser summary should describe the active URL: ${JSON.stringify(captureSummary)}`);
}
const captureInput = captureSummary.recentInteraction?.input;
if (captureInput?.registry !== "openclaw-write-only-input-evidence-v0"
  || captureInput.charCount !== inputText.length
  || captureInput.textExposed !== false
  || captureSummary.recentInteraction?.click?.x !== 640
  || JSON.stringify(captureSummary).includes(inputText)) {
  throw new Error(`browser summary should retain redacted input evidence: ${JSON.stringify(captureSummary)}`);
}
if (screenSummary?.url !== targetUrl
  || screenSummary?.recentInteraction?.input?.registry !== "openclaw-write-only-input-evidence-v0"
  || JSON.stringify(screenSummary).includes(inputText)) {
  throw new Error(`screen-sense should propagate work view summary: ${JSON.stringify(screenSummary)}`);
}
if (!screenResponse.screen?.snapshotText?.includes("Summary: AI work view is focused")) {
  throw new Error("screen snapshot should include readable work view summary text.");
}
if (trustedSession?.identityLevel !== "level_2_trusted_session_work_view"
  || trustedSession?.boundary?.workViewScope !== "ai_owned_work_view_only"
  || trustedSession?.helperReadiness?.state !== "ready"
  || trustedSession?.recoveryRecommendation?.action !== "none") {
  throw new Error(`screen summary should carry trusted work-view contract: ${JSON.stringify(trustedSession)}`);
}

console.log(JSON.stringify({
  browserSummary: {
    kind: captureSummary.kind,
    title: captureSummary.title,
    url: captureSummary.url,
    visibleTextBlocks: captureSummary.visibleTextBlocks,
    recentInput: captureInput,
  },
  screenSummary: {
    kind: screenSummary.kind,
    url: screenSummary.url,
    recentInput: screenSummary.recentInteraction?.input ?? null,
    trustedSession: trustedSession.identityLevel,
    helperReadiness: trustedSession.helperReadiness.state,
  },
}, null, 2));
EOF

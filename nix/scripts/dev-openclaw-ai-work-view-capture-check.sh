#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

FIXTURE_PORT="${OPENCLAW_BROWSER_FIXTURE_PORT:-5799}"
TARGET_URL="http://127.0.0.1:$FIXTURE_PORT/openclaw-ai-work-view-capture"

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
export OPENCLAW_BROWSER_RUNTIME_STATE_FILE="${OPENCLAW_BROWSER_RUNTIME_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-browser-runtime-ai-work-view-capture-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-events-ai-work-view-capture-check.jsonl}"
export OPENCLAW_BROWSER_ENGINE_MODE="firefox"
export OPENCLAW_BROWSER_PROFILE_DIR="${OPENCLAW_BROWSER_PROFILE_DIR:-$REPO_ROOT/.artifacts/openclaw-browser-profile-ai-work-view-capture-check}"

BROWSER_URL="http://127.0.0.1:$OPENCLAW_BROWSER_RUNTIME_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"
SCREEN_URL="http://127.0.0.1:$OPENCLAW_SCREEN_SENSE_PORT"
EVENT_HUB_URL="http://127.0.0.1:$OPENCLAW_EVENT_HUB_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_BROWSER_RUNTIME_STATE_FILE" "$OPENCLAW_BROWSER_RUNTIME_STATE_FILE.tmp-"* "$OPENCLAW_EVENT_LOG_FILE"
rm -rf "$OPENCLAW_BROWSER_PROFILE_DIR"

cleanup() {
  if [[ -n "${FIXTURE_PID:-}" ]]; then
    kill -TERM "$FIXTURE_PID" >/dev/null 2>&1 || true
  fi
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
  if [[ -e "$OPENCLAW_BROWSER_PROFILE_DIR" ]]; then
    echo "real browser engine did not clean its ephemeral profile" >&2
    return 1
  fi
  rm -f "$OPENCLAW_BROWSER_RUNTIME_STATE_FILE" "$OPENCLAW_BROWSER_RUNTIME_STATE_FILE.tmp-"*
  rm -f "$OPENCLAW_EVENT_LOG_FILE"
  rm -f "${SCREEN_EVENTS_FILE:-}"
}
trap cleanup EXIT

OPENCLAW_POST_JSON_FAILURE="allow"
OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-wait-helper.sh"

if [[ -z "${OPENCLAW_BROWSER_EXECUTABLE:-}" ]]; then
  if command -v firefox >/dev/null 2>&1; then
    export OPENCLAW_BROWSER_EXECUTABLE="$(command -v firefox)"
  else
    firefox_out="$(nix --extra-experimental-features 'nix-command flakes' build --no-link --print-out-paths .#firefox)"
    export OPENCLAW_BROWSER_EXECUTABLE="$firefox_out/bin/firefox"
  fi
fi

node -e 'const http=require("node:http"); const port=Number(process.argv[1]); http.createServer((_req,res)=>{res.writeHead(200,{"content-type":"text/html; charset=utf-8"}); res.end("<!doctype html><title>OpenClaw Engine Fixture</title><main><h1>AI-owned work view</h1><input autofocus aria-label=work-input><button>Observe</button></main>");}).listen(port,"127.0.0.1");' "$FIXTURE_PORT" &
FIXTURE_PID=$!
openclaw_wait_for_http_up "$TARGET_URL" 10 0.2


assert_json() {
  local json="$1"
  local script="$2"
  node -e "$script" "$json"
}

"$SCRIPT_DIR/dev-up.sh"

prepare_result="$(post_json "$SESSION_MANAGER_URL/work-view/prepare" "{\"displayTarget\":\"workspace-2\",\"entryUrl\":\"$TARGET_URL\"}")"
node -e 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.workView?.helperRuntime?.status!=="active"){throw new Error(`real browser work view prepare failed: ${JSON.stringify(data)}`);}' "$prepare_result"
open_result="$(curl --silent --fail "$BROWSER_URL/browser/state")"
assert_json "$open_result" 'const data=JSON.parse(process.argv[1]); if(!data.ok || !data.browser?.sessionId || data.browser?.engine?.mode!=="firefox" || data.browser?.engine?.realEngine!==true || !Number.isInteger(data.browser?.browserPid)){throw new Error(`real browser work view did not open with session: ${JSON.stringify(data)}`);}'
engine_pid="$(node -e 'const data=JSON.parse(process.argv[1]); process.stdout.write(String(data.browser.browserPid));' "$open_result")"
kill -0 "$engine_pid"

session_state="$(curl --silent --fail "$SESSION_MANAGER_URL/work-view/state")"
input_body="$(node -e 'const data=JSON.parse(process.argv[1]); const r=data.workView?.helperRuntime??{}; const trustedHelperLease={registry:"openclaw-trusted-work-view-helper-lease-v0",owner:r.owner,mode:r.mode,scope:r.scope,leaseId:r.leaseId,sessionId:r.sessionId,workViewId:r.workViewId,heartbeatAt:r.heartbeatAt,actionAuthority:r.actionAuthority}; process.stdout.write(JSON.stringify({text:"openclaw sees its own work view",trustedHelperLease}));' "$session_state")"
click_body="$(node -e 'const body=JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify({x:512,y:256,trustedHelperLease:body.trustedHelperLease}));' "$input_body")"
post_json "$BROWSER_URL/browser/input" "$input_body" >/dev/null
post_json "$BROWSER_URL/browser/click" "$click_body" >/dev/null

provider="$(curl --silent "$SCREEN_URL/screen/provider")"
capture="$(curl --silent "$BROWSER_URL/browser/capture")"
screen="$(curl --silent "$SCREEN_URL/screen/current")"
metadata_capture="$(curl --silent "$BROWSER_URL/browser/capture?visual=metadata")"

node - <<'EOF' "$provider" "$capture" "$screen" "$TARGET_URL" "$engine_pid" "$metadata_capture"
const { createHash } = require("node:crypto");
const provider = JSON.parse(process.argv[2]);
const captureResponse = JSON.parse(process.argv[3]);
const screenResponse = JSON.parse(process.argv[4]);
const targetUrl = process.argv[5];
const metadataCaptureResponse = JSON.parse(process.argv[7]);

const capture = captureResponse.capture;
const screen = screenResponse.screen;

function assertVisualFrame(frame, label) {
  if (frame?.registry !== "openclaw-browser-visual-frame-v0"
    || frame.available !== true
    || frame.sourceScope !== "ai_owned_active_page_only"
    || frame.mediaType !== "image/jpeg"
    || frame.encoding !== "base64_data_url"
    || frame.width !== 960
    || frame.height !== 540
    || !Number.isInteger(frame.byteLength)
    || frame.byteLength <= 0
    || frame.byteLength > 256 * 1024
    || frame.maxBytes !== 256 * 1024
    || frame.desktopWideCapture !== false
    || frame.persisted !== false
    || frame.dataExposed !== true
    || frame.fresh !== true
    || typeof frame.dataUrl !== "string"
    || !frame.dataUrl.startsWith("data:image/jpeg;base64,")) {
    throw new Error(`${label} missing bounded AI-owned visual frame: ${JSON.stringify(frame)}`);
  }
  const bytes = Buffer.from(frame.dataUrl.slice("data:image/jpeg;base64,".length), "base64");
  if (bytes.length !== frame.byteLength
    || bytes[0] !== 0xff
    || bytes[1] !== 0xd8
    || bytes[2] !== 0xff
    || createHash("sha256").update(bytes).digest("hex") !== frame.sha256) {
    throw new Error(`${label} visual frame bytes/hash are invalid.`);
  }
}

if (provider.provider?.mode !== "browser" || provider.provider?.ready !== true) {
  throw new Error(`expected ready browser capture provider: ${JSON.stringify(provider.provider)}`);
}
if (capture?.source !== "browser-runtime") {
  throw new Error(`expected browser-runtime capture source: ${JSON.stringify(capture)}`);
}
if (capture.activeTitle !== "OpenClaw Engine Fixture"
  || capture.engine?.mode !== "firefox"
  || capture.engine?.realEngine !== true
  || capture.engine?.registry !== "openclaw-browser-engine-adapter-v0"
  || captureResponse.browser?.browserPid !== Number(process.argv[6])) {
  throw new Error(`expected real Firefox capture evidence: ${JSON.stringify({ capture, browser: captureResponse.browser })}`);
}
if (screen.workViewSummary?.engine?.mode !== "firefox"
  || screen.workViewSummary?.engine?.realEngine !== true
  || screen.workViewSummary?.engine?.registry !== "openclaw-browser-engine-adapter-v0") {
  throw new Error(`screen-sense should project real browser engine evidence: ${JSON.stringify(screen.workViewSummary?.engine)}`);
}
if (capture.captureStrategy !== "browser-runtime-backed") {
  throw new Error(`expected browser-runtime-backed capture strategy: ${capture.captureStrategy}`);
}
assertVisualFrame(capture.visualFrame, "browser capture");
assertVisualFrame(screen.visualFrame, "screen-sense");
if (capture.visualFrame.pageUrl !== targetUrl || screen.visualFrame.pageUrl !== targetUrl) {
  throw new Error(`visual frame must belong to the active AI-owned page: ${JSON.stringify({
    capture: capture.visualFrame.pageUrl,
    screen: screen.visualFrame.pageUrl,
    targetUrl,
  })}`);
}
if (capture.workViewSummary?.visualFrame?.dataExposed !== false
  || "dataUrl" in (capture.workViewSummary?.visualFrame ?? {})
  || screen.captureMetadata?.visualFrame?.dataExposed !== false
  || "dataUrl" in (screen.captureMetadata?.visualFrame ?? {})) {
  throw new Error("task/read-model visual frame metadata must not retain image data.");
}
const metadataFrame = metadataCaptureResponse.capture?.visualFrame;
if (metadataFrame?.available !== true
  || metadataFrame.dataExposed !== false
  || "dataUrl" in metadataFrame
  || metadataFrame.sha256 !== capture.visualFrame.sha256) {
  throw new Error(`metadata capture must reuse evidence without image data: ${JSON.stringify(metadataFrame)}`);
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
  || captureTrust?.operatorGates?.reveal !== "explicit_operator_action"
  || captureTrust?.helperReadiness?.state !== "ready"
  || captureTrust?.recoveryRecommendation?.action !== "none"
  || captureTrust?.sidecarContract?.status !== "drafted_not_started"
  || captureTrust?.sidecarContract?.lifecycle?.processStarted !== false
  || captureTrust?.sidecarContract?.lifecycle?.rootRequired !== false
  || captureTrust?.sidecarContract?.lifecycleProposal?.status !== "proposal_ready"
  || captureTrust?.sidecarContract?.lifecycleProposal?.executionStatus !== "deferred"
  || captureTrust?.sidecarContract?.approvalTaskDraft?.status !== "draft_ready"
  || captureTrust?.sidecarContract?.approvalTaskDraft?.createsTaskNow !== false
  || captureTrust?.sidecarContract?.approvalTaskDraft?.processStartEnabled !== false) {
  throw new Error(`capture should expose trusted AI work-view boundary: ${JSON.stringify(captureTrust)}`);
}
if (!capture.sessionId || !capture.snapshotText?.includes("Capture Strategy: browser-runtime-backed")) {
  throw new Error(`capture missing session or readable snapshot contract: ${JSON.stringify(capture)}`);
}
if (!capture.ocrBlocks?.some((block) => block.text === "AI-owned work view")) {
  throw new Error(`capture OCR blocks should expose AI-owned work view label: ${JSON.stringify(capture.ocrBlocks)}`);
}
if (capture.ocrSource !== "runtime_state_projection") {
  throw new Error(`capture must not mislabel runtime text as pixel OCR: ${capture.ocrSource}`);
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
  || screenTrust?.boundary?.workViewScope !== "ai_owned_work_view_only"
  || screenTrust?.helperReadiness?.state !== "ready") {
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
    engine: capture.engine.mode,
    realEngine: capture.engine.realEngine,
    engineRegistry: capture.engine.registry,
    browserPid: captureResponse.browser.browserPid,
    mode: capture.workView?.mode ?? null,
    trustedSession: captureTrust.identityLevel,
    helperReadiness: captureTrust.helperReadiness.state,
    sidecarContract: captureTrust.sidecarContract.status,
    lifecycleProposal: captureTrust.sidecarContract.lifecycleProposal.status,
    approvalTaskDraft: captureTrust.sidecarContract.approvalTaskDraft.status,
    visualFrame: {
      registry: capture.visualFrame.registry,
      dimensions: `${capture.visualFrame.width}x${capture.visualFrame.height}`,
      byteLength: capture.visualFrame.byteLength,
      sha256: capture.visualFrame.sha256,
      sourceScope: capture.visualFrame.sourceScope,
      persisted: capture.visualFrame.persisted,
    },
  },
  screenSense: {
    readiness: screen.readiness,
    captureSource: screen.captureSource,
    captureStrategy: screen.captureStrategy,
    activeUrl: screen.workView?.activeUrl ?? null,
    trustedSession: screenTrust.identityLevel,
    recoveryRecommendation: screenTrust.recoveryRecommendation.action,
    browserEngine: screen.workViewSummary.engine.mode,
    visualFrame: screen.visualFrame.available,
  },
}, null, 2));
EOF

post_json "$SCREEN_URL/screen/refresh" '{}' >/dev/null
SCREEN_EVENTS_FILE="$(mktemp)"
curl --silent --fail "$EVENT_HUB_URL/events/audit?type=screen.updated&source=openclaw-screen-sense&limit=1" > "$SCREEN_EVENTS_FILE"
node - <<'EOF' "$SCREEN_EVENTS_FILE" "$OPENCLAW_EVENT_LOG_FILE"
const { readFileSync } = require("node:fs");
const events = JSON.parse(readFileSync(process.argv[2], "utf8"));
const persistedEvents = readFileSync(process.argv[3], "utf8");
const latest = events.items?.at(-1);
const frame = latest?.payload?.screen?.visualFrame;
if (!latest
  || frame?.registry !== "openclaw-browser-visual-frame-v0"
  || frame.available !== true
  || frame.dataExposed !== false
  || "dataUrl" in frame
  || JSON.stringify(latest).includes("data:image/jpeg;base64,")
  || persistedEvents.includes("data:image/jpeg;base64,")) {
  throw new Error(`screen audit event must retain frame metadata without image data: ${JSON.stringify(latest)}`);
}
console.log(JSON.stringify({
  visualFrameAudit: {
    eventType: latest.type,
    dataExposed: frame.dataExposed,
    sha256: frame.sha256,
    persistedImageData: false,
  },
}, null, 2));
EOF

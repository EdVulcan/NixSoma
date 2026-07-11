#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

FIXTURE_PORT="${OPENCLAW_BROWSER_FIXTURE_PORT:-5799}"
TARGET_URL="http://127.0.0.1:$FIXTURE_PORT/openclaw-ai-work-view-capture"
GROUNDING_URL="http://127.0.0.1:$FIXTURE_PORT/grounded-action"
AUTONOMOUS_GROUNDING_URL="http://127.0.0.1:$FIXTURE_PORT/autonomous-grounded-action"

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
CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"
SCREEN_URL="http://127.0.0.1:$OPENCLAW_SCREEN_SENSE_PORT"
SCREEN_ACT_URL="http://127.0.0.1:$OPENCLAW_SCREEN_ACT_PORT"
EVENT_HUB_URL="http://127.0.0.1:$OPENCLAW_EVENT_HUB_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_BROWSER_RUNTIME_STATE_FILE" "$OPENCLAW_BROWSER_RUNTIME_STATE_FILE.tmp-"* "$OPENCLAW_EVENT_LOG_FILE"
rm -rf "$OPENCLAW_BROWSER_PROFILE_DIR"

cleanup() {
  if [[ -n "${SIDECAR_TASK_ID:-}" && "${SIDECAR_STOPPED:-false}" != "true" ]]; then
    curl --silent -X POST "$CORE_URL/work-view/trusted-sidecar/lifecycle-tasks/$SIDECAR_TASK_ID/stop" \
      -H 'content-type: application/json' --data '{}' >/dev/null 2>&1 || true
  fi
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

node -e 'const http=require("node:http"); const port=Number(process.argv[1]); http.createServer((req,res)=>{const autonomous=req.url.includes("autonomous-grounded-action"); const grounded=req.url.includes("grounded-action"); const title=autonomous?"Autonomous Grounded Fixture":grounded?"Grounded Action Fixture":"OpenClaw Engine Fixture"; const heading=autonomous?"Autonomous visual action observed":grounded?"Visual action observed":"AI-owned work view"; res.writeHead(200,{"content-type":"text/html; charset=utf-8"}); res.end(`<!doctype html><title>${title}</title><main><h1>${heading}</h1><label>Work <input autofocus aria-label="work-input" value="fixture-private-value"></label><label>Account <input type="password" aria-label="account-password" value="fixture-password-secret"></label><button>Observe</button><a href="/inspect">Inspect target</a><button hidden>Hidden target</button></main>`);}).listen(port,"127.0.0.1");' "$FIXTURE_PORT" &
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

sidecar_task="$(post_json "$CORE_URL/work-view/trusted-sidecar/lifecycle-tasks" '{"confirm":true}')"
SIDECAR_TASK_ID="$(node -e 'const data=JSON.parse(process.argv[1]); process.stdout.write(data.task.id);' "$sidecar_task")"
sidecar_approval_id="$(node -e 'const data=JSON.parse(process.argv[1]); process.stdout.write(data.approval.id);' "$sidecar_task")"
post_json "$CORE_URL/approvals/$sidecar_approval_id/approve" '{"approvedBy":"ai-work-view-capture-check","reason":"prove bounded visual grounding through the existing trusted sidecar"}' >/dev/null
sidecar_start="$(post_json "$CORE_URL/work-view/trusted-sidecar/lifecycle-tasks/$SIDECAR_TASK_ID/start-probe" '{}')"
node -e 'const data=JSON.parse(process.argv[1]); const frame=data.readback?.execution?.captureObservation?.visualFrame??{}; if(!data.ok || data.readback?.status!=="running_after_approval" || frame.available!==true || frame.fresh!==true || frame.dataExposed!==false || frame.sourceScope!=="ai_owned_active_page_only" || JSON.stringify(frame).includes("data:image/")){throw new Error(`real sidecar did not receive bounded frame metadata: ${JSON.stringify(data)}`);}' "$sidecar_start"
node -e 'const data=JSON.parse(process.argv[1]); const targets=data.readback?.execution?.captureObservation?.semanticTargets??{}; if(targets.available!==true || targets.itemCount<4 || targets.itemsRetained!==false || targets.inputValuesExposed!==false || targets.selectorsExposed!==false || targets.mutation!==false || !targets.inventorySha256 || JSON.stringify(targets).includes("fixture-password-secret")){throw new Error(`real sidecar did not retain semantic target summary safely: ${JSON.stringify(targets)}`);}' "$sidecar_start"

grounded_action="$(post_json "$SCREEN_ACT_URL/act/browser/new-tab" "{\"url\":\"$GROUNDING_URL\"}")"
node - <<'EOF' "$grounded_action" "$GROUNDING_URL"
const data = JSON.parse(process.argv[2]);
const expectedUrl = process.argv[3];
const mediation = data.action?.mediation ?? {};
const grounding = mediation.visualGrounding ?? {};
if (data.action?.result !== "executed-browser-runtime"
  || mediation.accepted !== true
  || mediation.transport !== "trusted-sidecar-ipc"
  || grounding.registry !== "openclaw-trusted-work-view-visual-action-grounding-v0"
  || grounding.required !== true
  || grounding.status !== "grounded"
  || mediation.effect?.url !== expectedUrl
  || grounding.sequenceAdvanced !== true
  || grounding.before?.fresh !== true
  || grounding.after?.fresh !== true
  || grounding.after?.sequence <= grounding.before?.sequence
  || grounding.after?.sha256 === grounding.before?.sha256
  || grounding.after?.pageUrl !== expectedUrl
  || grounding.before?.sourceScope !== "ai_owned_active_page_only"
  || grounding.after?.sourceScope !== "ai_owned_active_page_only"
  || grounding.before?.dataExposed !== false
  || grounding.after?.dataExposed !== false
  || grounding.imageDataRetained !== false
  || grounding.desktopWideCapture !== false
  || grounding.persisted !== false
  || JSON.stringify(grounding).includes("data:image/")) {
  throw new Error(`real browser action was not grounded in compact pre/post frame evidence: ${JSON.stringify(data)}`);
}
console.log(JSON.stringify({
  visualActionGrounding: {
    status: grounding.status,
    transport: mediation.transport,
    beforeSequence: grounding.before.sequence,
    afterSequence: grounding.after.sequence,
    beforeSha256: grounding.before.sha256,
    afterSha256: grounding.after.sha256,
    imageDataRetained: grounding.imageDataRetained,
  },
}, null, 2));
EOF

grounded_task="$(post_json "$CORE_URL/tasks" "{\"goal\":\"Prove autonomous visual grounding\",\"type\":\"browser_task\",\"targetUrl\":\"$GROUNDING_URL\",\"workViewStrategy\":\"ai-work-view\",\"planStrategy\":\"rule-v1\",\"actions\":[{\"kind\":\"browser.new_tab\",\"params\":{\"url\":\"$AUTONOMOUS_GROUNDING_URL\"}}]}")"
grounded_task_id="$(node -e 'const data=JSON.parse(process.argv[1]); process.stdout.write(data.task.id);' "$grounded_task")"
grounded_execution="$(post_json "$CORE_URL/tasks/$grounded_task_id/execute" "{\"expectedUrl\":\"$AUTONOMOUS_GROUNDING_URL\",\"hideOnComplete\":false}")"
node - <<'EOF' "$grounded_execution" "$AUTONOMOUS_GROUNDING_URL"
const data = JSON.parse(process.argv[2]);
const expectedUrl = process.argv[3];
const evidence = data.execution?.actionEvidence;
const action = evidence?.actions?.[0];
const grounding = action?.mediation?.visualGrounding ?? {};
const semanticTargets = data.execution?.workViewSummary?.semanticTargets ?? {};
if (data.task?.status !== "completed"
  || evidence?.kind !== "eye-hand-action-evidence"
  || action?.kind !== "browser.new_tab"
  || action.mediation?.transport !== "trusted-sidecar-ipc"
  || action.mediation?.effect?.url !== expectedUrl
  || grounding.required !== true
  || grounding.status !== "grounded"
  || grounding.sequenceAdvanced !== true
  || grounding.after?.sequence <= grounding.before?.sequence
  || grounding.after?.sha256 === grounding.before?.sha256
  || grounding.after?.pageUrl !== expectedUrl
  || grounding.imageDataRetained !== false
  || semanticTargets.itemCount < 4
  || "items" in semanticTargets
  || semanticTargets.inputValuesExposed !== false
  || semanticTargets.selectorsExposed !== false
  || JSON.stringify(data.execution?.actionEvidence).includes("fixture-password-secret")
  || JSON.stringify(evidence).includes("data:image/")) {
  throw new Error(`autonomous task did not retain compact visual grounding evidence: ${JSON.stringify(data)}`);
}
console.log(JSON.stringify({
  autonomousVisualGrounding: {
    taskId: data.task.id,
    status: data.task.status,
    transport: action.mediation.transport,
    beforeSequence: grounding.before.sequence,
    afterSequence: grounding.after.sequence,
    observedUrl: evidence.observedAfterActions?.url,
    imageDataRetained: grounding.imageDataRetained,
  },
}, null, 2));
EOF

provider="$(curl --silent "$SCREEN_URL/screen/provider")"
capture="$(curl --silent "$BROWSER_URL/browser/capture")"
screen="$(curl --silent "$SCREEN_URL/screen/current")"
metadata_capture="$(curl --silent "$BROWSER_URL/browser/capture?visual=metadata")"

node - <<'EOF' "$provider" "$capture" "$screen" "$AUTONOMOUS_GROUNDING_URL" "$engine_pid" "$metadata_capture"
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

function assertSemanticTargets(inventory, frame, label) {
  const serialised = JSON.stringify(inventory);
  const names = (inventory?.items ?? []).map((item) => item.name);
  if (inventory?.registry !== "openclaw-browser-semantic-target-inventory-v0"
    || inventory.available !== true
    || inventory.sourceScope !== "ai_owned_active_page_only"
    || inventory.frame?.sha256 !== frame.sha256
    || inventory.frame?.sequence !== frame.sequence
    || inventory.itemCount !== inventory.items?.length
    || inventory.itemCount < 4
    || inventory.itemCount > 64
    || inventory.maxItems !== 64
    || inventory.maxNameChars !== 120
    || inventory.inputValuesExposed !== false
    || inventory.selectorsExposed !== false
    || inventory.arbitraryPageScript !== false
    || inventory.mutation !== false
    || inventory.desktopWideCapture !== false
    || inventory.persisted !== false
    || !names.includes("work-input")
    || !names.includes("account-password")
    || !names.includes("Observe")
    || !names.includes("Inspect target")
    || names.includes("Hidden target")
    || inventory.items.some((item) => item.valueExposed !== false || item.selectorExposed !== false)
    || serialised.includes("fixture-private-value")
    || serialised.includes("fixture-password-secret")
    || serialised.includes("openclaw sees its own work view")) {
    throw new Error(`${label} missing bounded frame-linked semantic targets: ${serialised}`);
  }
}

if (provider.provider?.mode !== "browser" || provider.provider?.ready !== true) {
  throw new Error(`expected ready browser capture provider: ${JSON.stringify(provider.provider)}`);
}
if (capture?.source !== "browser-runtime") {
  throw new Error(`expected browser-runtime capture source: ${JSON.stringify(capture)}`);
}
if (capture.activeTitle !== "Autonomous Grounded Fixture"
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
assertSemanticTargets(capture.semanticTargets, capture.visualFrame, "browser capture");
assertSemanticTargets(screen.semanticTargets, screen.visualFrame, "screen-sense");
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
if (capture.workViewSummary?.semanticTargets?.itemCount !== capture.semanticTargets.itemCount
  || "items" in (capture.workViewSummary?.semanticTargets ?? {})
  || screen.captureMetadata?.semanticTargets?.itemCount !== screen.semanticTargets.itemCount
  || "items" in (screen.captureMetadata?.semanticTargets ?? {})) {
  throw new Error("task/read-model semantic target metadata must not retain target items.");
}
const metadataFrame = metadataCaptureResponse.capture?.visualFrame;
if (metadataFrame?.available !== true
  || metadataFrame.dataExposed !== false
  || "dataUrl" in metadataFrame
  || metadataFrame.sha256 !== capture.visualFrame.sha256) {
  throw new Error(`metadata capture must reuse evidence without image data: ${JSON.stringify(metadataFrame)}`);
}
if (metadataCaptureResponse.capture?.semanticTargets?.itemCount !== capture.semanticTargets.itemCount
  || "items" in (metadataCaptureResponse.capture?.semanticTargets ?? {})) {
  throw new Error(`metadata capture must omit semantic target items: ${JSON.stringify(metadataCaptureResponse.capture?.semanticTargets)}`);
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
    semanticTargets: {
      itemCount: capture.semanticTargets.itemCount,
      inventorySha256: capture.semanticTargets.inventorySha256,
      frameSequence: capture.semanticTargets.frame.sequence,
      valuesExposed: capture.semanticTargets.inputValuesExposed,
      selectorsExposed: capture.semanticTargets.selectorsExposed,
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
    semanticTargetCount: screen.semanticTargets.itemCount,
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
const semanticTargets = latest?.payload?.screen?.semanticTargets;
if (!latest
  || frame?.registry !== "openclaw-browser-visual-frame-v0"
  || frame.available !== true
  || frame.dataExposed !== false
  || semanticTargets?.itemCount < 4
  || "items" in (semanticTargets ?? {})
  || semanticTargets?.inputValuesExposed !== false
  || semanticTargets?.selectorsExposed !== false
  || "dataUrl" in frame
  || JSON.stringify(latest).includes("data:image/jpeg;base64,")
  || JSON.stringify(latest).includes("fixture-password-secret")
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

post_json "$CORE_URL/work-view/trusted-sidecar/lifecycle-tasks/$SIDECAR_TASK_ID/stop" '{}' >/dev/null
SIDECAR_STOPPED=true

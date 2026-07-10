#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_URL="https://example.com/observer-ai-work-view-capture"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5710}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5711}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5712}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5713}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5714}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5715}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5716}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5717}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5780}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-ai-work-view-capture-check.json}"

BROWSER_URL="http://127.0.0.1:$OPENCLAW_BROWSER_RUNTIME_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"
SCREEN_URL="http://127.0.0.1:$OPENCLAW_SCREEN_SENSE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_FAILURE="allow"
OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");

const requiredHtml = [
  "screen-capture-source",
  "screen-capture-strategy",
  "screen-work-view-url",
  "work-view-session-identity",
  "screen-snapshot",
  "run-recommended-work-view-action-button",
];
const requiredClient = [
  "screen.captureSource",
  "screen.captureStrategy",
  "screen.workView?.activeUrl",
  "screen.captureMetadata?.activeUrl",
  "trustedSession.identityLevel",
  "sessionIdentity",
  "Session Identity",
  "trustedSession.helperReadiness",
  "trustedSession.recoveryRecommendation",
  "runRecommendedWorkViewAction",
  "operatorActionSource",
  "lastOperatorAction",
  "workViewRecoveryAction",
  "sidecarContract",
  "Sidecar Contract",
  "Sidecar Lifecycle",
  "lifecycleProposal",
  "Sidecar Approval Draft",
  "approvalTaskDraft",
  "prepare_work_view",
  "reveal_work_view",
  "Trusted Boundary",
  "Browser Engine:",
  "workViewSummary.engine",
];

for (const token of requiredHtml) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of requiredClient) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
EOF

prepare_result="$(post_json "$SESSION_MANAGER_URL/work-view/prepare" "{\"displayTarget\":\"workspace-2\",\"entryUrl\":\"$TARGET_URL\"}")"
node -e 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.workView?.helperRuntime?.status!=="active"){throw new Error(`observer work view prepare failed: ${JSON.stringify(data)}`);}' "$prepare_result"

screen="$(curl --silent "$SCREEN_URL/screen/current")"

node - <<'EOF' "$screen" "$TARGET_URL"
const data = JSON.parse(process.argv[2]);
const targetUrl = process.argv[3];
const screen = data.screen;

if (screen.captureSource !== "browser-runtime") {
  throw new Error(`Observer-facing screen state should expose browser-runtime source: ${screen.captureSource}`);
}
if (screen.captureStrategy !== "browser-runtime-backed") {
  throw new Error(`Observer-facing screen state should expose browser-runtime-backed strategy: ${screen.captureStrategy}`);
}
if (screen.workView?.activeUrl !== targetUrl || screen.captureMetadata?.activeUrl !== targetUrl) {
  throw new Error(`Observer-facing screen state should include active work view URL: ${JSON.stringify(screen)}`);
}
if (screen.workViewSummary?.engine?.mode !== "simulated"
  || screen.workViewSummary?.engine?.realEngine !== false) {
  throw new Error(`Observer-facing screen state should expose browser engine mode: ${JSON.stringify(screen.workViewSummary?.engine)}`);
}
if (!screen.snapshotText?.includes("OpenClaw browser work view")) {
  throw new Error("Observer-facing snapshot preview should include browser work view text.");
}
const trustedSession = screen.trustedSession ?? screen.workView?.trustedSession ?? screen.captureMetadata?.trustedSession;
if (trustedSession?.identityLevel !== "level_2_trusted_session_work_view"
  || trustedSession?.boundary?.workViewScope !== "ai_owned_work_view_only"
  || trustedSession?.operatorGates?.reveal !== "explicit_operator_action"
  || trustedSession?.helperReadiness?.state !== "ready"
  || trustedSession?.sidecarContract?.status !== "drafted_not_started"
  || trustedSession?.sidecarContract?.lifecycle?.processStarted !== false
  || trustedSession?.sidecarContract?.lifecycleProposal?.status !== "proposal_ready"
  || trustedSession?.sidecarContract?.approvalTaskDraft?.status !== "draft_ready") {
  throw new Error(`Observer-facing screen state should expose trusted session boundary: ${JSON.stringify(trustedSession)}`);
}

console.log(JSON.stringify({
  observerVisibility: {
    htmlControls: [
      "screen-capture-source",
      "screen-capture-strategy",
      "screen-work-view-url",
      "run-recommended-work-view-action-button",
    ],
    clientFields: [
      "screen.captureSource",
      "screen.captureStrategy",
      "screen.workView.activeUrl",
      "screen.captureMetadata.activeUrl",
      "trustedSession.identityLevel",
      "trustedSession.helperReadiness",
      "runRecommendedWorkViewAction",
    ],
  },
  screen: {
    readiness: screen.readiness,
    captureSource: screen.captureSource,
    captureStrategy: screen.captureStrategy,
    activeUrl: screen.workView?.activeUrl ?? null,
    trustedSession: trustedSession.identityLevel,
    recoveryRecommendation: trustedSession.recoveryRecommendation.action,
    sidecarContract: trustedSession.sidecarContract?.status ?? null,
    lifecycleProposal: trustedSession.sidecarContract?.lifecycleProposal?.status ?? null,
    approvalTaskDraft: trustedSession.sidecarContract?.approvalTaskDraft?.status ?? null,
  },
}, null, 2));
EOF

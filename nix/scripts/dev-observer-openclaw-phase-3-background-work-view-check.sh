#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6750}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6751}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6752}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6753}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6754}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6755}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6756}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6757}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6758}"
export OPENCLAW_DEV_RUN_ID="${OPENCLAW_DEV_RUN_ID:-observer-phase3-background-work-view-$$}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-phase-3-background-work-view-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-observer-phase-3-background-work-view-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  rm -f \
    "${FIRST_PREPARE_FILE:-}" \
    "${SECOND_PREPARE_FILE:-}" \
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${BACKGROUND_FILE:-}" \
    "${ACTION_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_FAILURE="fail-with-body"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

"$SCRIPT_DIR/dev-up.sh"
FIRST_PREPARE_FILE="$(mktemp)"
post_json "$SESSION_MANAGER_URL/work-view/prepare" \
  '{"displayTarget":"workspace-2","entryUrl":"https://example.com/observer-phase-3-background","operatorActionSource":"observer_phase_3_background_milestone","recommendedAction":"prepare_work_view"}' > "$FIRST_PREPARE_FILE"
SECOND_PREPARE_FILE="$(mktemp)"
post_json "$SESSION_MANAGER_URL/work-view/prepare" \
  '{"displayTarget":"workspace-2","entryUrl":"https://example.com/observer-phase-3-background","operatorActionSource":"observer_phase_3_background_milestone","recommendedAction":"prepare_work_view"}' > "$SECOND_PREPARE_FILE"

ACTION_FILE="$(mktemp)"
post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"act.screen.pointer_keyboard","operation":"mouse.click","params":{"x":640,"y":360,"button":"left"}}' > "$ACTION_FILE"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
BACKGROUND_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/phase-3/background-work-view" > "$BACKGROUND_FILE"

node - <<'EOF' "$FIRST_PREPARE_FILE" "$SECOND_PREPARE_FILE" "$HTML_FILE" "$CLIENT_FILE" "$BACKGROUND_FILE" "$ACTION_FILE"
const fs = require("node:fs");
const firstPrepare = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const secondPrepare = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
const background = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
const actionResponse = JSON.parse(fs.readFileSync(process.argv[7], "utf8"));
const action = actionResponse.result?.action;

const firstTabs = firstPrepare.browser?.browser?.tabs;
const secondTabs = secondPrepare.browser?.browser?.tabs;
if (firstPrepare.reused !== false
  || secondPrepare.reused !== true
  || secondPrepare.browser?.reuse?.reason !== "same_authority"
  || !Array.isArray(firstTabs)
  || !Array.isArray(secondTabs)
  || secondTabs.length !== firstTabs.length
  || secondPrepare.session?.sessionId !== firstPrepare.session?.sessionId
  || secondPrepare.workView?.helperRuntime?.leaseId !== firstPrepare.workView?.helperRuntime?.leaseId
  || secondPrepare.workView?.helperRuntime?.browserLeaseId !== firstPrepare.workView?.helperRuntime?.browserLeaseId
  || secondPrepare.workView?.helperRuntime?.leaseMatched !== true) {
  throw new Error(`Observer Phase 3 repeated prepare should preserve one authority and tab set: ${JSON.stringify({ firstPrepare, secondPrepare })}`);
}

for (const token of ["Phase 3 Background Work View", "phase3-background-work-view-panel", "phase3-background-visibility", "phase3-background-mode", "work-view-session-identity", "run-recommended-work-view-action-button"]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of ["/phase-3/background-work-view", "refreshPhase3BackgroundWorkView", "openclaw-phase-3-background-work-view-v0", "Trusted Session", "trustedSession.identityLevel", "Session Identity", "sessionIdentity", "Helper Runtime", "helperRuntime", "Helper Runtime Boundary", "Action Mediation", "mediation", "Helper Readiness", "recoveryRecommendation", "Last Operator Action", "lastOperatorAction", "Sidecar Contract", "sidecarContract", "Sidecar Lifecycle", "lifecycleProposal", "Sidecar Approval Draft", "approvalTaskDraft", "runRecommendedWorkViewAction", "reveal_work_view"]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
if (!background.ok || background.summary?.ready !== true || background.current?.workView?.visibility !== "hidden") {
  throw new Error(`Observer Phase 3 background work view should be ready: ${JSON.stringify(background.summary)}`);
}
const trustedSession = background.workViewContract?.trustedSession ?? background.current?.workView?.trustedSession;
if (trustedSession?.identityLevel !== "level_2_trusted_session_work_view"
  || trustedSession?.boundary?.workViewScope !== "ai_owned_work_view_only"
  || trustedSession?.sessionIdentity?.status !== "authoritative"
  || trustedSession?.sessionIdentity?.authority !== "openclaw-session-manager"
  || trustedSession?.sessionIdentity?.authoritativeSessionId !== background.current?.session?.sessionId
  || trustedSession?.sessionIdentity?.browserRuntimeSessionId !== background.current?.session?.sessionId
  || trustedSession?.sessionIdentity?.alignment?.browserRuntime !== "matched"
  || trustedSession?.helperRuntime?.registry !== "openclaw-trusted-work-view-helper-runtime-v0"
  || trustedSession?.helperRuntime?.owner !== "openclaw-session-manager"
  || trustedSession?.helperRuntime?.status !== "active"
  || trustedSession?.helperRuntime?.browserLeaseId !== trustedSession?.helperRuntime?.leaseId
  || trustedSession?.helperRuntime?.leaseMatched !== true
  || trustedSession?.helperRuntime?.externalProcessStarted !== false
  || trustedSession?.helperRuntime?.rootRequired !== false
  || trustedSession?.helperRuntime?.desktopWideCapture !== false
  || trustedSession?.helperReadiness?.state !== "prepared_hidden"
  || trustedSession?.recoveryRecommendation?.action !== "reveal_work_view"
  || trustedSession?.sidecarContract?.status !== "drafted_not_started"
  || trustedSession?.sidecarContract?.lifecycleProposal?.status !== "proposal_ready"
  || trustedSession?.sidecarContract?.approvalTaskDraft?.status !== "draft_ready") {
  throw new Error(`Observer Phase 3 background work view should expose trusted session boundary: ${JSON.stringify(trustedSession)}`);
}
if (background.current?.workView?.lastOperatorAction?.action !== "prepare_work_view"
  || background.current?.workView?.lastOperatorAction?.source !== "observer_phase_3_background_milestone"
  || background.current?.workView?.lastOperatorAction?.next?.visibility !== "hidden") {
  throw new Error(`Observer Phase 3 background work view should expose operator action result: ${JSON.stringify(background.current?.workView?.lastOperatorAction)}`);
}
if (!actionResponse.ok
  || actionResponse.invoked !== true
  || actionResponse.result?.operation !== "mouse.click"
  || actionResponse.result?.governance?.requiresTrustedLease !== true
  || action?.result !== "executed-browser-runtime"
  || action?.mediation?.attempted !== true
  || action?.mediation?.accepted !== true
  || action?.mediation?.leaseMatched !== true
  || action?.mediation?.transport !== "browser-runtime-direct") {
  throw new Error(`Observer Phase 3 action readback should expose accepted helper-lease mediation: ${JSON.stringify(actionResponse)}`);
}

console.log(JSON.stringify({
  observerOpenClawPhase3BackgroundWorkView: {
    status: "passed",
    panel: "Phase 3 Background Work View",
    repeatedPrepareReused: secondPrepare.reused,
    repeatedPrepareTabCount: secondTabs.length,
    visibility: background.current.workView.visibility,
    mode: background.current.workView.mode,
    trustedSession: trustedSession.identityLevel,
    sessionIdentity: trustedSession.sessionIdentity.status,
    helperRuntime: trustedSession.helperRuntime.status,
    helperLeaseMatched: trustedSession.helperRuntime.leaseMatched,
    actionMediation: action.mediation.status,
    recoveryRecommendation: trustedSession.recoveryRecommendation.action,
    lastOperatorAction: background.current.workView.lastOperatorAction.action,
    sidecarContract: trustedSession.sidecarContract.status,
    lifecycleProposal: trustedSession.sidecarContract.lifecycleProposal.status,
    approvalTaskDraft: trustedSession.sidecarContract.approvalTaskDraft.status,
  },
}, null, 2));
EOF

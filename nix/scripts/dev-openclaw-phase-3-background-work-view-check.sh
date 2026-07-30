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
export OPENCLAW_DEV_RUN_ID="${OPENCLAW_DEV_RUN_ID:-phase3-background-work-view-$$}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-3-background-work-view-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-3-background-work-view-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"
BROWSER_URL="http://127.0.0.1:$OPENCLAW_BROWSER_RUNTIME_PORT"
BROWSER_OPERATOR_TOKEN_FILE="$REPO_ROOT/.artifacts/openclaw-browser-runtime-credentials-$OPENCLAW_DEV_RUN_ID/openclaw-operator"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

cleanup() {
  rm -f \
    "${FIRST_PREPARE_FILE:-}" \
    "${SECOND_PREPARE_FILE:-}" \
    "${BACKGROUND_FILE:-}" \
    "${ACTION_FILE:-}" \
    "${REJECTED_ACTION_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_FAILURE="fail-with-body"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

browser_operator_curl() {
  local token
  if [[ ! -s "$BROWSER_OPERATOR_TOKEN_FILE" ]]; then
    echo "Missing Browser Runtime operator credential: $BROWSER_OPERATOR_TOKEN_FILE" >&2
    return 1
  fi
  token="$(tr -d '\r\n' < "$BROWSER_OPERATOR_TOKEN_FILE")"
  if [[ ! "$token" =~ ^[A-Za-z0-9._~-]{1,512}$ ]]; then
    echo "Browser Runtime operator credential is not bounded." >&2
    return 1
  fi
  printf 'header = "authorization: Bearer %s"\nheader = "x-openclaw-service-caller: openclaw-operator"\n' "$token" \
    | command curl --config - "$@"
}

"$SCRIPT_DIR/dev-up.sh"
FIRST_PREPARE_FILE="$(mktemp)"
post_json "$SESSION_MANAGER_URL/work-view/prepare" \
  '{"displayTarget":"workspace-2","entryUrl":"https://example.com/phase-3-background","operatorActionSource":"phase_3_background_milestone","recommendedAction":"prepare_work_view"}' > "$FIRST_PREPARE_FILE"
SECOND_PREPARE_FILE="$(mktemp)"
post_json "$SESSION_MANAGER_URL/work-view/prepare" \
  '{"displayTarget":"workspace-2","entryUrl":"https://example.com/phase-3-background","operatorActionSource":"phase_3_background_milestone","recommendedAction":"prepare_work_view"}' > "$SECOND_PREPARE_FILE"

ACTION_FILE="$(mktemp)"
post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"act.screen.pointer_keyboard","operation":"keyboard.type","params":{"text":"phase 3 trusted helper action mediation"}}' > "$ACTION_FILE"

REJECTED_ACTION_FILE="$(mktemp)"
rejected_status="$(browser_operator_curl --silent --output "$REJECTED_ACTION_FILE" --write-out '%{http_code}' \
  -X POST "$BROWSER_URL/browser/input" \
  -H 'content-type: application/json' \
  --data '{"text":"must be rejected without trusted helper lease"}')"
if [[ "$rejected_status" != "409" ]]; then
  echo "Expected browser action without trusted helper lease to return 409, got $rejected_status" >&2
  exit 1
fi

BACKGROUND_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/phase-3/background-work-view" > "$BACKGROUND_FILE"

node - <<'EOF' "$FIRST_PREPARE_FILE" "$SECOND_PREPARE_FILE" "$BACKGROUND_FILE" "$ACTION_FILE" "$REJECTED_ACTION_FILE"
const fs = require("node:fs");
const firstPrepare = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const secondPrepare = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const background = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const actionResponse = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const rejectedAction = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
const action = actionResponse.result?.action;

const firstTabs = firstPrepare.browser?.browser?.tabs;
const secondTabs = secondPrepare.browser?.browser?.tabs;
if (firstPrepare.ok !== true
  || firstPrepare.reused !== false
  || firstPrepare.browser?.reused !== false
  || firstPrepare.browser?.reuse?.reason !== "session_started"
  || !Array.isArray(firstTabs)
  || firstTabs.length < 1) {
  throw new Error(`first prepare should establish one fresh browser authority: ${JSON.stringify(firstPrepare)}`);
}
if (secondPrepare.ok !== true
  || secondPrepare.reused !== true
  || secondPrepare.browser?.reused !== true
  || secondPrepare.browser?.reuse?.registry !== "openclaw-work-view-prepare-reuse-v0"
  || secondPrepare.browser?.reuse?.reason !== "same_authority"
  || !Array.isArray(secondTabs)
  || secondTabs.length !== firstTabs.length
  || secondPrepare.session?.sessionId !== firstPrepare.session?.sessionId
  || secondPrepare.workView?.browserSessionId !== firstPrepare.workView?.browserSessionId
  || secondPrepare.workView?.helperRuntime?.leaseId !== firstPrepare.workView?.helperRuntime?.leaseId
  || secondPrepare.workView?.helperRuntime?.browserLeaseId !== firstPrepare.workView?.helperRuntime?.browserLeaseId
  || secondPrepare.workView?.helperRuntime?.leaseMatched !== true) {
  throw new Error(`second prepare should reuse the exact browser authority without adding a tab: ${JSON.stringify(secondPrepare)}`);
}

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
if (background.current?.workView?.lastOperatorAction?.action !== "prepare_work_view"
  || background.current?.workView?.lastOperatorAction?.source !== "phase_3_background_milestone"
  || background.current?.workView?.lastOperatorAction?.next?.visibility !== "hidden"
  || background.current?.workView?.lastOperatorAction?.rootRequired !== false) {
  throw new Error(`current work view should record prepare action evidence: ${JSON.stringify(background.current?.workView?.lastOperatorAction)}`);
}
if (!actionResponse.ok
  || actionResponse.invoked !== true
  || actionResponse.result?.operation !== "keyboard.type"
  || actionResponse.result?.governance?.requiresTrustedLease !== true
  || action?.degraded !== false
  || action?.result !== "executed-browser-runtime"
  || action?.mediation?.attempted !== true
  || action?.mediation?.accepted !== true
  || action?.mediation?.status !== "accepted"
  || action?.mediation?.leaseMatched !== true
  || action?.mediation?.transport !== "browser-runtime-direct") {
  throw new Error(`background work-view action should require and accept the trusted helper lease: ${JSON.stringify(actionResponse)}`);
}
if (rejectedAction.ok !== false
  || rejectedAction.mediation?.required !== true
  || rejectedAction.mediation?.accepted !== false
  || rejectedAction.mediation?.status !== "rejected"
  || rejectedAction.mediation?.leaseMatched !== false) {
  throw new Error(`browser action without trusted helper lease should be rejected before mutation: ${JSON.stringify(rejectedAction)}`);
}
const trustedSession = background.workViewContract?.trustedSession ?? background.current?.workView?.trustedSession;
if (trustedSession?.identityLevel !== "level_2_trusted_session_work_view"
  || trustedSession?.boundary?.workViewScope !== "ai_owned_work_view_only"
  || trustedSession?.boundary?.desktopWideCapture !== false
  || trustedSession?.boundary?.rootRequired !== false
  || trustedSession?.sessionIdentity?.status !== "authoritative"
  || trustedSession?.sessionIdentity?.authority !== "openclaw-session-manager"
  || trustedSession?.sessionIdentity?.authoritativeSessionId !== background.current?.session?.sessionId
  || trustedSession?.sessionIdentity?.browserRuntimeSessionId !== background.current?.session?.sessionId
  || trustedSession?.sessionIdentity?.alignment?.browserRuntime !== "matched"
  || trustedSession?.helperRuntime?.registry !== "openclaw-trusted-work-view-helper-runtime-v0"
  || trustedSession?.helperRuntime?.owner !== "openclaw-session-manager"
  || trustedSession?.helperRuntime?.status !== "active"
  || !trustedSession?.helperRuntime?.leaseId
  || trustedSession?.helperRuntime?.browserLeaseId !== trustedSession?.helperRuntime?.leaseId
  || trustedSession?.helperRuntime?.leaseMatched !== true
  || trustedSession?.helperRuntime?.externalProcessStarted !== false
  || trustedSession?.helperRuntime?.rootRequired !== false
  || trustedSession?.helperRuntime?.desktopWideCapture !== false
  || trustedSession?.operatorGates?.reveal !== "explicit_operator_action"
  || trustedSession?.helperReadiness?.state !== "prepared_hidden"
  || trustedSession?.recoveryRecommendation?.action !== "reveal_work_view"
  || trustedSession?.recoveryRecommendation?.rootRequired !== false
  || trustedSession?.sidecarContract?.status !== "drafted_not_started"
  || trustedSession?.sidecarContract?.lifecycle?.processStarted !== false
  || trustedSession?.sidecarContract?.lifecycle?.rootRequired !== false
  || trustedSession?.sidecarContract?.lifecycleProposal?.status !== "proposal_ready"
  || trustedSession?.sidecarContract?.lifecycleProposal?.executionStatus !== "deferred"
  || trustedSession?.sidecarContract?.approvalTaskDraft?.status !== "draft_ready"
  || trustedSession?.sidecarContract?.approvalTaskDraft?.createsTaskNow !== false) {
  throw new Error(`background work-view should expose trusted session boundary: ${JSON.stringify(trustedSession)}`);
}

console.log(JSON.stringify({
  openclawPhase3BackgroundWorkView: {
    status: "passed",
    registry: background.registry,
    repeatedPrepareReused: secondPrepare.reused,
    repeatedPrepareTabCount: secondTabs.length,
    visibility: background.current.workView.visibility,
    mode: background.current.workView.mode,
    trustedSession: trustedSession.identityLevel,
    sessionIdentity: trustedSession.sessionIdentity.status,
    helperRuntime: trustedSession.helperRuntime.status,
    helperLeaseMatched: trustedSession.helperRuntime.leaseMatched,
    actionMediation: action.mediation.status,
    missingLeaseAction: rejectedAction.mediation.status,
    recoveryRecommendation: trustedSession.recoveryRecommendation.action,
    lastOperatorAction: background.current.workView.lastOperatorAction.action,
    sidecarContract: trustedSession.sidecarContract.status,
    lifecycleProposal: trustedSession.sidecarContract.lifecycleProposal.status,
    approvalTaskDraft: trustedSession.sidecarContract.approvalTaskDraft.status,
  },
}, null, 2));
EOF

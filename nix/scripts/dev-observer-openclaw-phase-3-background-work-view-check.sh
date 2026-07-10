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
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${BACKGROUND_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"
curl --silent --fail -X POST "$SESSION_MANAGER_URL/work-view/prepare" \
  -H 'content-type: application/json' \
  --data '{"displayTarget":"workspace-2","entryUrl":"https://example.com/observer-phase-3-background","operatorActionSource":"observer_phase_3_background_milestone","recommendedAction":"prepare_work_view"}' >/dev/null

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
BACKGROUND_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/phase-3/background-work-view" > "$BACKGROUND_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$BACKGROUND_FILE"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const background = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));

for (const token of ["Phase 3 Background Work View", "phase3-background-work-view-panel", "phase3-background-visibility", "phase3-background-mode", "run-recommended-work-view-action-button"]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of ["/phase-3/background-work-view", "refreshPhase3BackgroundWorkView", "openclaw-phase-3-background-work-view-v0", "Trusted Session", "trustedSession.identityLevel", "Session Identity", "sessionIdentity", "Helper Readiness", "recoveryRecommendation", "Last Operator Action", "lastOperatorAction", "Sidecar Contract", "sidecarContract", "Sidecar Lifecycle", "lifecycleProposal", "Sidecar Approval Draft", "approvalTaskDraft", "runRecommendedWorkViewAction", "reveal_work_view"]) {
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

console.log(JSON.stringify({
  observerOpenClawPhase3BackgroundWorkView: {
    status: "passed",
    panel: "Phase 3 Background Work View",
    visibility: background.current.workView.visibility,
    mode: background.current.workView.mode,
    trustedSession: trustedSession.identityLevel,
    sessionIdentity: trustedSession.sessionIdentity.status,
    recoveryRecommendation: trustedSession.recoveryRecommendation.action,
    lastOperatorAction: background.current.workView.lastOperatorAction.action,
    sidecarContract: trustedSession.sidecarContract.status,
    lifecycleProposal: trustedSession.sidecarContract.lifecycleProposal.status,
    approvalTaskDraft: trustedSession.sidecarContract.approvalTaskDraft.status,
  },
}, null, 2));
EOF

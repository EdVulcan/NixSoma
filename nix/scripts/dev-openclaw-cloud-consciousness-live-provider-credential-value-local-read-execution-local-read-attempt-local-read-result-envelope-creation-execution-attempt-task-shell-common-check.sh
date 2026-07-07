#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-common-env.sh" 112
RESULT_ENVELOPE_CREATION_EXECUTION_FINAL_READINESS_PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight-v0"
RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_ROUTE_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route-v0"
RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-v0"
PHASE111_CORE_STATE="$REPO_ROOT/.artifacts/openclaw-core-phase-111-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route-check.json"
PHASE111_SYSTEM_HEAL_STATE="$REPO_ROOT/.artifacts/openclaw-system-heal-phase-111-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route-check.json"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${ROUTE_FILE:-}" "${TASK_FILE:-}" "${APPROVED_FILE:-}" "${STEP_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true

if [[ "$OBSERVER_CHECK" == "true" ]]; then
  "$SCRIPT_DIR/dev-up.sh"
  HTML_FILE="$(mktemp)"
  CLIENT_FILE="$(mktemp)"
  curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
  node - <<'EOF' "$RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_ROUTE_REGISTRY" "$RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_TASK_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const attemptRouteRegistry = process.argv[2];
const attemptTaskRegistry = process.argv[3];
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Creation Execution Attempt Task Shell",
  "cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-shell-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-tasks",
  "refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShell",
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred",
  attemptRouteRegistry,
  attemptTaskRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShell: { status: "passed", attemptRouteRegistry, attemptTaskRegistry } }, null, 2));
EOF
  exit 0
fi

rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
if [[ -f "$SCRIPT_DIR/dev-openclaw-fast-prereq-state.sh" ]]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/dev-openclaw-fast-prereq-state.sh"
fi

if ! declare -F openclaw_reuse_prereq_state >/dev/null \
  || ! openclaw_reuse_prereq_state \
    "$PHASE111_CORE_STATE" \
    "$PHASE111_SYSTEM_HEAL_STATE" \
    "$OPENCLAW_CORE_STATE_FILE" \
    "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
    "phase-111-result-envelope-creation-execution-attempt-route" \
    "$RESULT_ENVELOPE_CREATION_EXECUTION_FINAL_READINESS_PREFLIGHT_REGISTRY" \
    "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_final_readiness_preflight_recorded"; then
  PHASE111_PORT_BASE="$PORT_BASE" OPENCLAW_CORE_STATE_FILE="$OPENCLAW_CORE_STATE_FILE" OPENCLAW_SYSTEM_HEAL_STATE_FILE="$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
    bash "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route-common-check.sh" >/dev/null
fi

"$SCRIPT_DIR/dev-up.sh"
ROUTE_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route" > "$ROUTE_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-tasks" '{"confirm":true}' > "$TASK_FILE"
approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$TASK_FILE")"
post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-112-check","reason":"Approve credential value local read result envelope creation execution attempt task shell while keeping credential values unread and envelopes uncreated."}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"

node - <<'EOF' "$RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_ROUTE_REGISTRY" "$RESULT_ENVELOPE_CREATION_EXECUTION_ATTEMPT_TASK_REGISTRY" "$PLAN_DOC" "$ROUTE_FILE" "$TASK_FILE" "$STEP_FILE"
const fs = require("node:fs");
const attemptRouteRegistry = process.argv[2];
const attemptTaskRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const routeRecord = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const taskRecord = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
const stepRecord = JSON.parse(fs.readFileSync(process.argv[7], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-shell",
  "Requires Phase 111 credential value local read execution local-read attempt local-read result envelope creation execution attempt route evidence",
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskApproved: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 112 plan doc missing ${token}`);
}
if (
  !routeRecord.ok
  || routeRecord.registry !== attemptRouteRegistry
  || routeRecord.summary?.ready !== true
  || routeRecord.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-shell"
) {
  throw new Error(`Phase 112 requires a ready Phase 111 execution attempt route: ${JSON.stringify(routeRecord)}`);
}
const taskShell = taskRecord.task?.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttempt;
const completedShell = stepRecord.task?.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttempt;
if (
  !taskRecord.ok
  || taskRecord.registry !== attemptTaskRegistry
  || taskRecord.approval?.status !== "pending"
  || taskShell?.registry !== attemptTaskRegistry
  || taskShell?.sourceRegistry !== attemptRouteRegistry
  || taskShell?.implementationStatus !== "task_shell_only"
  || taskShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionFinalReadinessPreflightRecorded !== true
  || taskShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskCreated !== true
  || taskShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskApproved !== false
  || taskShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptDeferred !== true
  || taskShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
  || !stepRecord.ok
  || stepRecord.task?.status !== "completed"
  || stepRecord.task?.outcome?.details?.phase !== "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_task_shell_deferred"
  || completedShell?.registry !== attemptTaskRegistry
  || completedShell?.implementationStatus !== "deferred_after_approval"
  || completedShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskCreated !== true
  || completedShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskApproved !== true
  || completedShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptDeferred !== true
  || completedShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
) {
  throw new Error(`Phase 112 should create and approve deferred credential value local read result envelope creation execution attempt task shell evidence: ${JSON.stringify({ taskRecord, stepRecord })}`);
}
if (
  completedShell.credentialValueIncluded !== false
  || completedShell.credentialValueRead !== false
  || completedShell.credentialValueExposed !== false
  || completedShell.providerCredentialRead !== false
  || completedShell.endpointContacted !== false
  || completedShell.networkEgress !== false
  || completedShell.providerResponseCreated !== false
  || completedShell.rollbackExecuted !== false
  || completedShell.rollbackCommandCreated !== false
  || completedShell.hostMutation !== false
  || completedShell.transmitsExternally !== false
  || completedShell.liveProviderCallEnabled !== false
  || completedShell.launchAuthorized !== false
  || completedShell.launchExecuted !== false
) {
  throw new Error(`Phase 112 result envelope creation execution attempt task shell must not read credentials, create envelopes, egress, roll back, mutate host state, or launch: ${JSON.stringify(stepRecord)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptTaskShell: { status: "passed", taskId: taskRecord.task.id, completedTaskId: stepRecord.task.id, sourceTaskId: taskShell.sourceTaskId, attemptRouteRegistry, attemptTaskRegistry } }, null, 2));
EOF

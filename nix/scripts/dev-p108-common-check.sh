#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-common-env.sh" 108
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-prereq.sh"
RESULT_ENVELOPE_CREATION_FINAL_READINESS_PREFLIGHT_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight-v0"
RESULT_ENVELOPE_CREATION_EXECUTION_ROUTE_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-route-v0"
RESULT_ENVELOPE_CREATION_EXECUTION_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-v0"
PHASE106_CORE_STATE="$REPO_ROOT/.artifacts/openclaw-core-phase-106-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight-check.json"
PHASE106_SYSTEM_HEAL_STATE="$REPO_ROOT/.artifacts/openclaw-system-heal-phase-106-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight-check.json"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


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
  openclaw_result_envelope_assert_observer_manifest_surface "$OPENCLAW_RESULT_ENVELOPE_PHASE" "$HTML_FILE" "$CLIENT_FILE"
  exit 0
fi

openclaw_result_envelope_prepare_prereq_state \
  "$SCRIPT_DIR" \
  "$PHASE106_CORE_STATE" \
  "$PHASE106_SYSTEM_HEAL_STATE" \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "phase-106-result-envelope-creation-final-readiness-preflight" \
  "$RESULT_ENVELOPE_CREATION_FINAL_READINESS_PREFLIGHT_REGISTRY" \
  "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_final_readiness_preflight_recorded" \
  "PHASE107_PORT_BASE" \
  "dev-p107-common-check.sh"

"$SCRIPT_DIR/dev-up.sh"
ROUTE_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-route" > "$ROUTE_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-tasks" '{"confirm":true}' > "$TASK_FILE"
approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$TASK_FILE")"
post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-108-check","reason":"Approve credential value local read result envelope creation execution task shell while keeping credential values unread and envelopes uncreated."}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"

node - <<'EOF' "$RESULT_ENVELOPE_CREATION_EXECUTION_ROUTE_REGISTRY" "$RESULT_ENVELOPE_CREATION_EXECUTION_TASK_REGISTRY" "$PLAN_DOC" "$ROUTE_FILE" "$TASK_FILE" "$STEP_FILE"
const fs = require("node:fs");
const resultEnvelopeCreationExecutionRouteRegistry = process.argv[2];
const resultEnvelopeCreationExecutionTaskRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const routeRecord = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const taskRecord = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
const stepRecord = JSON.parse(fs.readFileSync(process.argv[7], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-shell",
  "Requires Phase 107 credential value local read execution local-read attempt local-read result envelope creation execution route evidence",
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskApproved: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 108 plan doc missing ${token}`);
}
if (
  !routeRecord.ok
  || routeRecord.registry !== resultEnvelopeCreationExecutionRouteRegistry
  || routeRecord.summary?.ready !== true
  || routeRecord.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-shell"
) {
  throw new Error(`Phase 108 requires a ready Phase 107 execution route: ${JSON.stringify(routeRecord)}`);
}
const taskShell = taskRecord.task?.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecution;
const completedShell = stepRecord.task?.cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecution;
if (
  !taskRecord.ok
  || taskRecord.registry !== resultEnvelopeCreationExecutionTaskRegistry
  || taskRecord.approval?.status !== "pending"
  || taskShell?.registry !== resultEnvelopeCreationExecutionTaskRegistry
  || taskShell?.sourceRegistry !== resultEnvelopeCreationExecutionRouteRegistry
  || taskShell?.implementationStatus !== "task_shell_only"
  || taskShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskCreated !== true
  || taskShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskApproved !== false
  || taskShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionDeferred !== true
  || taskShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
  || !stepRecord.ok
  || stepRecord.task?.status !== "completed"
  || stepRecord.task?.outcome?.details?.phase !== "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_task_shell_deferred"
  || completedShell?.registry !== resultEnvelopeCreationExecutionTaskRegistry
  || completedShell?.implementationStatus !== "deferred_after_approval"
  || completedShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskCreated !== true
  || completedShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskApproved !== true
  || completedShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionDeferred !== true
  || completedShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
) {
  throw new Error(`Phase 108 should create and approve deferred credential value local read result envelope creation execution task shell evidence: ${JSON.stringify({ taskRecord, stepRecord })}`);
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
  throw new Error(`Phase 108 result envelope creation execution task shell must not read credentials, create envelopes, egress, roll back, mutate host state, or launch: ${JSON.stringify(stepRecord)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionTaskShell: { status: "passed", taskId: taskRecord.task.id, completedTaskId: stepRecord.task.id, sourceTaskId: taskShell.sourceTaskId, resultEnvelopeCreationExecutionRouteRegistry, resultEnvelopeCreationExecutionTaskRegistry } }, null, 2));
EOF

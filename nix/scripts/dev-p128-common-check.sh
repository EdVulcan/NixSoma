#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-common-env.sh" 128
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-prereq.sh"
RESULT_ENVELOPE_CREATION_EXECUTION_ROUTE_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-route-v0"
RESULT_ENVELOPE_CREATION_EXECUTION_TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-task-v0"
PHASE127_CORE_STATE="$REPO_ROOT/.artifacts/openclaw-core-phase-127-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-route-check.json"
PHASE127_SYSTEM_HEAL_STATE="$REPO_ROOT/.artifacts/openclaw-system-heal-phase-127-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-route-check.json"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

if [[ -f "$SCRIPT_DIR/dev-openclaw-service-reuse.sh" ]]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/dev-openclaw-service-reuse.sh"
fi

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${TASK_FILE:-}" "${APPROVED_FILE:-}" "${STEP_FILE:-}"
  if declare -F openclaw_dev_cleanup_for_check >/dev/null; then
    openclaw_dev_cleanup_for_check "$SCRIPT_DIR"
  else
    "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if declare -F openclaw_dev_down_before_check >/dev/null; then
  openclaw_dev_down_before_check "$SCRIPT_DIR"
else
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
fi

if [[ "$OBSERVER_CHECK" == "true" ]]; then
  if declare -F openclaw_dev_up_for_check >/dev/null; then
    openclaw_dev_up_for_check "$SCRIPT_DIR"
  else
    "$SCRIPT_DIR/dev-up.sh"
  fi
  HTML_FILE="$(mktemp)"
  CLIENT_FILE="$(mktemp)"
  curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
  openclaw_result_envelope_assert_observer_manifest_surface "$OPENCLAW_RESULT_ENVELOPE_PHASE" "$HTML_FILE" "$CLIENT_FILE"
  exit 0
fi

if ! declare -F openclaw_dev_services_already_up >/dev/null || ! openclaw_dev_services_already_up; then
  openclaw_result_envelope_prepare_prereq_state \
    "$SCRIPT_DIR" \
    "$PHASE127_CORE_STATE" \
    "$PHASE127_SYSTEM_HEAL_STATE" \
    "$OPENCLAW_CORE_STATE_FILE" \
    "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
    "phase-127-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-route" \
    "$RESULT_ENVELOPE_CREATION_EXECUTION_ROUTE_REGISTRY" \
    "credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_route_ready" \
    "PHASE127_PORT_BASE" \
    "dev-p127-common-check.sh"
else
  echo "Using already-running OpenClaw dev services as the live Phase 127 prerequisite state."
fi

if declare -F openclaw_dev_up_for_check >/dev/null; then
  openclaw_dev_up_for_check "$SCRIPT_DIR"
else
  "$SCRIPT_DIR/dev-up.sh"
fi
TASK_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-tasks" '{"confirm":true}' > "$TASK_FILE"
approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$TASK_FILE")"
post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-128-check","reason":"Approve credential value local read result envelope creation execution task shell while keeping credential values unread, result envelopes uncreated, and egress disabled."}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"

node - <<'EOF' "$RESULT_ENVELOPE_CREATION_EXECUTION_ROUTE_REGISTRY" "$RESULT_ENVELOPE_CREATION_EXECUTION_TASK_REGISTRY" "$PLAN_DOC" "$TASK_FILE" "$STEP_FILE"
const fs = require("node:fs");
const resultEnvelopeCreationExecutionRouteRegistry = process.argv[2];
const resultEnvelopeCreationExecutionTaskRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const taskRecord = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const stepRecord = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope-creation-execution-task-shell",
  "Requires Phase 127 credential value local read execution local-read attempt local-read result envelope creation execution attempt local-read result envelope creation execution route evidence",
  "credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskApproved: true",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 128 plan doc missing ${token}`);
}
const field = "cloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecution";
const taskShell = taskRecord.task?.[field];
const completedShell = stepRecord.task?.[field];
if (
  !taskRecord.ok
  || taskRecord.registry !== resultEnvelopeCreationExecutionTaskRegistry
  || taskRecord.sourceRegistry !== resultEnvelopeCreationExecutionRouteRegistry
  || taskRecord.approval?.status !== "pending"
  || taskShell?.registry !== resultEnvelopeCreationExecutionTaskRegistry
  || taskShell?.sourceRegistry !== resultEnvelopeCreationExecutionRouteRegistry
  || taskShell?.implementationStatus !== "task_shell_only"
  || taskShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskCreated !== true
  || taskShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskApproved !== false
  || taskShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionDeferred !== true
  || taskShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
  || !stepRecord.ok
  || stepRecord.task?.status !== "completed"
  || stepRecord.task?.outcome?.details?.phase !== "cloud_consciousness_live_provider_credential_value_local_read_execution_local_read_attempt_local_read_result_envelope_creation_execution_attempt_local_read_result_envelope_creation_execution_task_shell_deferred"
  || completedShell?.registry !== resultEnvelopeCreationExecutionTaskRegistry
  || completedShell?.implementationStatus !== "deferred_after_approval"
  || completedShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskCreated !== true
  || completedShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskApproved !== true
  || completedShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionDeferred !== true
  || completedShell?.credentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreated !== false
) {
  throw new Error(`Phase 128 should create and approve deferred credential value local read result envelope creation execution task shell evidence: ${JSON.stringify({ taskRecord, stepRecord })}`);
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
  || completedShell.hostMutation !== false
  || completedShell.liveProviderCallEnabled !== false
) {
  throw new Error(`Phase 128 result envelope creation execution task shell must not read credentials, create envelopes, or perform egress: ${JSON.stringify(stepRecord)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelopeCreationExecutionAttemptLocalReadResultEnvelopeCreationExecutionTaskShell: { status: "passed", taskId: taskRecord.task.id, completedTaskId: stepRecord.task.id, sourceTaskId: taskShell.sourceTaskId, resultEnvelopeCreationExecutionRouteRegistry, resultEnvelopeCreationExecutionTaskRegistry } }, null, 2));
EOF

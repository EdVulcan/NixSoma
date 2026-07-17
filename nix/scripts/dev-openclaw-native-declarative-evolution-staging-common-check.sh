#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${OPENCLAW_NATIVE_DECLARATIVE_EVOLUTION_STAGING_OBSERVER_CHECK:-false}"
CHECK_KIND="${OPENCLAW_NATIVE_DECLARATIVE_EVOLUTION_STAGING_CHECK_KIND:-core}"
PORT_BASE="${OPENCLAW_NATIVE_DECLARATIVE_EVOLUTION_STAGING_PORT_BASE:-26900}"
STAGING_DIR="${OPENCLAW_MANAGED_CONFIG_STAGING_DIR:-$REPO_ROOT/.artifacts/native-declarative-evolution-staging-$CHECK_KIND}"

export OPENCLAW_DEV_RUN_ID="${OPENCLAW_DEV_RUN_ID:-native-declarative-evolution-staging-$CHECK_KIND}"
export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-native-declarative-evolution-staging-$CHECK_KIND.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-native-declarative-evolution-staging-$CHECK_KIND-events.jsonl}"
export OPENCLAW_MANAGED_CONFIG_STAGING_DIR="$STAGING_DIR"
export OPENCLAW_NIXOS_FLAKE="${OPENCLAW_NIXOS_FLAKE:-$REPO_ROOT}"
export OPENCLAW_NIXOS_BASE_MODULE="${OPENCLAW_NIXOS_BASE_MODULE:-$REPO_ROOT/nix/hosts/local-dev.nix}"
export OPENCLAW_NIX_SYSTEM="${OPENCLAW_NIX_SYSTEM:-x86_64-linux}"
export OPENCLAW_NIX_COMMAND="${OPENCLAW_NIX_COMMAND:-nix}"
export OPENCLAW_NIX_INSTANTIATE="${OPENCLAW_NIX_INSTANTIATE:-nix-instantiate}"
export OPENCLAW_NIXOS_BUILD_MODE="${OPENCLAW_NIXOS_BUILD_MODE:-dry-run}"
export OPENCLAW_NIXOS_BUILD_TIMEOUT_MS="${OPENCLAW_NIXOS_BUILD_TIMEOUT_MS:-600000}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

if [[ "$OBSERVER_CHECK" != "true" ]]; then
  command -v "$OPENCLAW_NIX_COMMAND" >/dev/null 2>&1 || {
    echo "Nix command is unavailable: $OPENCLAW_NIX_COMMAND" >&2
    exit 1
  }
  command -v "$OPENCLAW_NIX_INSTANTIATE" >/dev/null 2>&1 || {
    echo "nix-instantiate command is unavailable: $OPENCLAW_NIX_INSTANTIATE" >&2
    exit 1
  }
fi

rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"
rm -rf "$STAGING_DIR"

cleanup() {
  rm -f \
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${CAPABILITIES_FILE:-}" \
    "${INVOCATION_FILE:-}" \
    "${BLOCKED_FILE:-}" \
    "${HEALTH_GATE_ROUTE_FILE:-}" \
    "${HEALTH_GATE_CAPABILITY_FILE:-}" \
    "${ACTIVATION_REVIEW_ROUTE_FILE:-}" \
    "${ACTIVATION_BLOCKED_FILE:-}" \
    "${HEALTH_GATE_FILE:-}" \
    "${TASK_FILE:-}" \
    "${APPROVED_FILE:-}" \
    "${STEP_FILE:-}" \
    "${ACTIVATION_REVIEW_FILE:-}" \
    "${ACTIVATION_TASK_FILE:-}" \
    "${ACTIVATION_APPROVED_FILE:-}" \
    "${ACTIVATION_STEP_FILE:-}" \
    "${ACTIVATION_TASK_BLOCKED_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
"$SCRIPT_DIR/dev-up.sh"

if [[ "$OBSERVER_CHECK" == "true" ]]; then
  HTML_FILE="$(mktemp)"
  CLIENT_FILE="$(mktemp)"
  CAPABILITIES_FILE="$(mktemp)"
  INVOCATION_FILE="$(mktemp)"
  BLOCKED_FILE="$(mktemp)"
  HEALTH_GATE_ROUTE_FILE="$(mktemp)"
  HEALTH_GATE_CAPABILITY_FILE="$(mktemp)"
  ACTIVATION_REVIEW_ROUTE_FILE="$(mktemp)"
  ACTIVATION_BLOCKED_FILE="$(mktemp)"
  ACTIVATION_TASK_BLOCKED_FILE="$(mktemp)"

  curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
  curl --silent --fail "$CORE_URL/capabilities" > "$CAPABILITIES_FILE"
  post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.openclaw.declarative_evolution.staging_task","params":{"changes":[{"operation":"enable_component","component":"systemSense"}],"confirm":false}}' > "$BLOCKED_FILE"
  curl --silent --fail "$CORE_URL/plugins/native-adapter/declarative-evolution/health-gate" > "$HEALTH_GATE_ROUTE_FILE"
  OPENCLAW_POST_JSON_FAILURE=allow post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"sense.openclaw.declarative_evolution.health_gate","params":{}}' > "$HEALTH_GATE_CAPABILITY_FILE"
  curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$INVOCATION_FILE"
  curl --silent --fail "$CORE_URL/plugins/native-adapter/declarative-evolution/activation-decision" > "$ACTIVATION_REVIEW_ROUTE_FILE"
  OPENCLAW_POST_JSON_FAILURE=allow post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.openclaw.declarative_evolution.activation_decision","params":{"taskId":"missing-staging-task","decision":"approve_activation_review","confirm":false}}' > "$ACTIVATION_BLOCKED_FILE"
  OPENCLAW_POST_JSON_FAILURE=allow post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.openclaw.declarative_evolution.activation","params":{"activationDecisionTaskId":"missing-activation-decision-task","confirm":false}}' > "$ACTIVATION_TASK_BLOCKED_FILE"

  node - <<'NODE' "$HTML_FILE" "$CLIENT_FILE" "$CAPABILITIES_FILE" "$BLOCKED_FILE" "$HEALTH_GATE_ROUTE_FILE" "$HEALTH_GATE_CAPABILITY_FILE" "$INVOCATION_FILE" "$ACTIVATION_REVIEW_ROUTE_FILE" "$ACTIVATION_BLOCKED_FILE" "$ACTIVATION_TASK_BLOCKED_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));
const html = readText(2);
const client = readText(3);
const capabilities = readJson(4);
const blocked = readJson(5);
const healthGateRoute = readJson(6);
const healthGateCapability = readJson(7);
const invocations = readJson(8);
const activationReviewRoute = readJson(9);
const activationBlocked = readJson(10);
const activationTaskBlocked = readJson(11);
const capabilityId = "act.openclaw.declarative_evolution.staging_task";
const healthGateCapabilityId = "sense.openclaw.declarative_evolution.health_gate";
const activationCapabilityId = "act.openclaw.declarative_evolution.activation_decision";
const activationTaskCapabilityId = "act.openclaw.declarative_evolution.activation";
const descriptor = capabilities.capabilities?.find((item) => item.id === capabilityId);
const healthGateDescriptor = capabilities.capabilities?.find((item) => item.id === healthGateCapabilityId);
const activationDescriptor = capabilities.capabilities?.find((item) => item.id === activationCapabilityId);
const activationTaskDescriptor = capabilities.capabilities?.find((item) => item.id === activationTaskCapabilityId);
const raw = JSON.stringify({ html, client, capabilities, blocked, healthGateRoute, healthGateCapability, invocations, activationReviewRoute, activationBlocked, activationTaskBlocked });

for (const token of [
  "Body Capabilities",
  "capability-registry",
  "capability-online",
  "capability-approval",
  "capability-history-json",
  "declarative-evolution-source-task-id",
  "declarative-evolution-refresh-button",
  "declarative-evolution-decision-button",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing generic capability token: ${token}`);
}
for (const token of [
  "/capabilities",
  "/capabilities/invoke",
  "refreshCapabilityState",
  "renderCapabilityState",
  "refreshCapabilityHistory",
  "refreshDeclarativeEvolutionActivationDecision",
  "renderDeclarativeEvolutionActivationReview",
  "/plugins/native-adapter/declarative-evolution/activation-decisions",
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing generic capability token: ${token}`);
}
if (
  !descriptor
  || descriptor.kind !== "actuator"
  || descriptor.risk !== "high"
  || descriptor.governance !== "allow"
  || (() => {
    try {
      return new URL(descriptor.endpoint).pathname !== "/plugins/native-adapter/declarative-evolution/staging-tasks";
    } catch {
      return true;
    }
  })()
) {
  throw new Error(`Observer capability registry missing declarative staging descriptor: ${JSON.stringify(descriptor)}`);
}
if (
  !blocked.ok
  || blocked.invoked !== true
  || blocked.capability?.id !== capabilityId
  || blocked.result?.reason !== "operator_confirmation_required"
  || blocked.summary?.kind !== "declarative_evolution.staging_task"
  || blocked.summary?.createsTask !== false
  || blocked.summary?.createsApproval !== false
  || blocked.summary?.noManagedConfigWrite !== true
  || blocked.summary?.noGenerationSwitch !== true
  || blocked.summary?.noRollback !== true
  || blocked.summary?.noProviderEgress !== true
) {
  throw new Error(`Observer common capability staging denial mismatch: ${JSON.stringify(blocked)}`);
}
if (!invocations.items?.some((item) => (
  item.capability?.id === capabilityId
  && item.summary?.blocked === true
  && item.summary?.reason === "operator_confirmation_required"
))) {
  throw new Error(`Observer capability history missing the blocked staging invocation: ${JSON.stringify(invocations)}`);
}
if (
  !healthGateDescriptor
  || healthGateDescriptor.kind !== "sensor"
  || healthGateDescriptor.risk !== "medium"
  || healthGateDescriptor.governance !== "audit_only"
  || (() => {
    try {
      return new URL(healthGateDescriptor.endpoint).pathname !== "/plugins/native-adapter/declarative-evolution/health-gate";
    } catch {
      return true;
    }
  })()
) {
  throw new Error(`Observer capability registry missing declarative health-gate descriptor: ${JSON.stringify(healthGateDescriptor)}`);
}
if (
  healthGateRoute.ok !== false
  || healthGateRoute.blocked !== true
  || healthGateRoute.reason !== "staging_task_id_required"
  || healthGateRoute.governance?.assessesHostHealth !== false
  || healthGateRoute.governance?.automaticActivation !== false
  || healthGateRoute.governance?.automaticRollback !== false
) {
  throw new Error(`Observer declarative health-gate route did not fail closed: ${JSON.stringify(healthGateRoute)}`);
}
if (
  healthGateCapability.ok !== false
  || !String(healthGateCapability.error ?? "").includes("requires taskId")
) {
  throw new Error(`Observer common declarative health-gate invocation did not fail closed: ${JSON.stringify(healthGateCapability)}`);
}
if (
  !activationDescriptor
  || activationDescriptor.kind !== "actuator"
  || activationDescriptor.risk !== "high"
  || activationDescriptor.governance !== "allow"
  || (() => {
    try {
      return new URL(activationDescriptor.endpoint).pathname !== "/plugins/native-adapter/declarative-evolution/activation-decisions";
    } catch {
      return true;
    }
  })()
) {
  throw new Error(`Observer capability registry missing activation decision descriptor: ${JSON.stringify(activationDescriptor)}`);
}
if (
  !activationTaskDescriptor
  || activationTaskDescriptor.kind !== "actuator"
  || activationTaskDescriptor.risk !== "high"
  || activationTaskDescriptor.governance !== "allow"
  || (() => {
    try {
      return new URL(activationTaskDescriptor.endpoint).pathname !== "/plugins/native-adapter/declarative-evolution/activation-tasks";
    } catch {
      return true;
    }
  })()
) {
  throw new Error(`Observer capability registry missing managed-config activation descriptor: ${JSON.stringify(activationTaskDescriptor)}`);
}
if (
  activationReviewRoute.ok !== false
  || activationReviewRoute.blocked !== true
  || activationReviewRoute.reason !== "staging_task_id_required"
  || activationReviewRoute.governance?.readsHostHealth !== false
  || activationReviewRoute.governance?.automaticActivation !== false
) {
  throw new Error(`Observer activation decision review did not fail closed: ${JSON.stringify(activationReviewRoute)}`);
}
if (
  !activationBlocked.ok
  || activationBlocked.invoked !== true
  || activationBlocked.result?.blocked !== true
  || activationBlocked.result?.reason !== "operator_confirmation_required"
  || activationBlocked.summary?.kind !== "declarative_evolution.activation_decision"
  || activationBlocked.summary?.createsTask !== false
  || activationBlocked.summary?.createsApproval !== false
  || activationBlocked.summary?.noManagedConfigWrite !== true
  || activationBlocked.summary?.noGenerationSwitch !== true
  || activationBlocked.summary?.noRollback !== true
  || activationBlocked.summary?.activationExecuted !== false
  || activationBlocked.summary?.noAutomaticActivation !== true
  || activationBlocked.summary?.noAutomaticRollback !== true
) {
  throw new Error(`Observer activation decision confirmation gate mismatch: ${JSON.stringify(activationBlocked)}`);
}
if (
  !activationTaskBlocked.ok
  || activationTaskBlocked.invoked !== true
  || activationTaskBlocked.result?.blocked !== true
  || activationTaskBlocked.result?.reason !== "operator_confirmation_required"
  || activationTaskBlocked.summary?.kind !== "declarative_evolution.activation"
  || activationTaskBlocked.summary?.createsTask !== false
  || activationTaskBlocked.summary?.createsApproval !== false
  || activationTaskBlocked.summary?.activationExecuted !== false
  || activationTaskBlocked.summary?.noAutomaticActivation !== true
  || activationTaskBlocked.summary?.noAutomaticRollback !== true
  || activationTaskBlocked.summary?.rollbackManualOnly !== true
) {
  throw new Error(`Observer managed-config activation confirmation gate mismatch: ${JSON.stringify(activationTaskBlocked)}`);
}
if (raw.includes("services.openclaw.components") || raw.includes("Generated by OpenClaw declarative evolution")) {
  throw new Error("Observer staging review must not expose generated candidate text.");
}
console.log(JSON.stringify({
  observerNativeDeclarativeEvolutionStaging: {
    status: "passed",
    capability: capabilityId,
    registry: capabilities.registry,
    confirmationGate: blocked.result.reason,
    healthGateRoute: healthGateRoute.reason,
    healthGateCapability: healthGateCapability.error,
    activationReviewRoute: activationReviewRoute.reason,
    activationConfirmationGate: activationBlocked.result.reason,
    candidateTextExposed: false,
  },
}, null, 2));
NODE
  exit 0
fi

TASK_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
HEALTH_GATE_FILE="$(mktemp)"
ACTIVATION_REVIEW_FILE="$(mktemp)"
ACTIVATION_TASK_FILE="$(mktemp)"
ACTIVATION_APPROVED_FILE="$(mktemp)"
ACTIVATION_STEP_FILE="$(mktemp)"
ACTIVATION_TASK_BLOCKED_FILE="$(mktemp)"

post_json "$CORE_URL/plugins/native-adapter/declarative-evolution/staging-tasks" \
  '{"changes":[{"operation":"enable_component","component":"systemSense"}],"confirm":true}' > "$TASK_FILE"

read -r TASK_ID APPROVAL_ID CANDIDATE_HASH < <(node - <<'NODE' "$TASK_FILE"
const fs = require("node:fs");
const file = process.argv[2];
const raw = fs.readFileSync(file, "utf8");
const response = JSON.parse(raw);
if (
  !response.ok
  || response.registry !== "openclaw-native-declarative-evolution-staging-task-v0"
  || response.task?.type !== "native_declarative_evolution_staging"
  || response.task?.status !== "queued"
  || response.approval?.status !== "pending"
  || response.approvalBinding?.candidateHash !== response.candidate?.candidateHash
  || response.task?.nativeDeclarativeEvolution?.approvalBinding?.candidateHash !== response.candidate?.candidateHash
  || response.candidate?.candidateStatus !== "validated"
  || response.governance?.createsTask !== true
  || response.governance?.createsApproval !== true
  || response.governance?.canExecuteWithoutApproval !== false
  || response.governance?.writesManagedConfig !== false
  || response.governance?.switchesGeneration !== false
  || response.governance?.executesRollback !== false
  || response.governance?.networkEgress !== false
  || typeof response.approval?.id !== "string"
  || !/^[a-f0-9]{64}$/.test(response.candidate?.candidateHash ?? "")
) {
  throw new Error(`Declarative staging task draft mismatch: ${raw}`);
}
if (raw.includes("services.openclaw.components") || raw.includes("Generated by OpenClaw declarative evolution")) {
  throw new Error("Declarative staging task response exposed candidate text.");
}
process.stdout.write(`${response.task.id} ${response.approval.id} ${response.candidate.candidateHash}\n`);
NODE
)

post_json "$CORE_URL/approvals/$APPROVAL_ID/approve" \
  '{"approvedBy":"dev-openclaw-native-declarative-evolution-staging-check","reason":"Approve one hash-bound managed Nix staging and read-only evaluation/build check."}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"
post_json "$CORE_URL/capabilities/invoke" "{\"capabilityId\":\"sense.openclaw.declarative_evolution.health_gate\",\"params\":{\"taskId\":\"$TASK_ID\"}}" > "$HEALTH_GATE_FILE"

if [[ "$OPENCLAW_NIXOS_BUILD_MODE" != "build" ]]; then
  node - <<'NODE' "$HEALTH_GATE_FILE" "$OPENCLAW_CORE_STATE_FILE" "$TASK_ID" "$CANDIDATE_HASH"
const fs = require("node:fs");
const healthGate = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const state = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const taskId = process.argv[4];
const candidateHash = process.argv[5];
const taskTypes = (state.tasks ?? []).map((task) => task.type);
const result = healthGate.result ?? {};
if (
  healthGate.ok !== true
  || healthGate.invoked !== true
  || result.ok !== true
  || result.blocked !== false
  || result.taskId !== taskId
  || result.candidate?.candidateHash !== candidateHash
  || result.assessment?.status !== "blocked"
  || result.assessment?.eligibleForActivationReview !== false
  || result.closureIntegrity?.status !== "blocked"
  || !result.failedChecks?.includes("nixBuildOutputBound")
  || !result.failedChecks?.includes("closureQueryPassed")
  || result.governance?.writesManagedConfig !== false
  || result.governance?.switchesGeneration !== false
  || result.governance?.executesRollback !== false
  || result.governance?.automaticActivation !== false
  || result.governance?.automaticRollback !== false
  || taskTypes.some((type) => type === "native_declarative_evolution_activation_decision" || type === "native_declarative_evolution_activation")
  || JSON.stringify(healthGate).includes("services.openclaw.components")
) {
  throw new Error(`Dry-run closure-integrity gate did not fail closed: ${JSON.stringify({ healthGate, taskTypes })}`);
}
console.log(JSON.stringify({
  nativeDeclarativeEvolutionStaging: {
    status: "passed",
    proofMode: "dry-run-closure-integrity-blocked",
    taskId,
    candidateHash,
    closureIntegrity: result.closureIntegrity?.status,
    failedChecks: result.failedChecks,
    activationTaskCreated: false,
    generationSwitch: false,
    rollback: false,
  },
}, null, 2));
NODE
  exit 0
fi

curl --silent --fail "$CORE_URL/plugins/native-adapter/declarative-evolution/activation-decision?taskId=$TASK_ID" > "$ACTIVATION_REVIEW_FILE"
post_json "$CORE_URL/plugins/native-adapter/declarative-evolution/activation-decisions" \
  "{\"taskId\":\"$TASK_ID\",\"decision\":\"approve_activation_review\",\"confirm\":true}" > "$ACTIVATION_TASK_FILE"

read -r ACTIVATION_TASK_ID ACTIVATION_APPROVAL_ID < <(node - <<'NODE' "$ACTIVATION_TASK_FILE" "$CANDIDATE_HASH"
const fs = require("node:fs");
const response = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const candidateHash = process.argv[3];
if (
  !response.ok
  || response.registry !== "openclaw-native-declarative-evolution-activation-decision-v0"
  || response.task?.type !== "native_declarative_evolution_activation_decision"
  || response.task?.status !== "queued"
  || response.approval?.status !== "pending"
  || response.approvalBinding?.decision !== "approve_activation_review"
  || response.approvalBinding?.candidateHash !== candidateHash
  || response.approvalBinding?.sourceStagingTaskId !== response.review?.sourceTaskId
  || typeof response.approvalBinding?.hostHealthHash !== "string"
  || !/^[a-f0-9]{64}$/.test(response.approvalBinding.hostHealthHash)
  || response.governance?.createsTask !== true
  || response.governance?.createsApproval !== true
  || response.governance?.writesManagedConfig !== false
  || response.governance?.switchesGeneration !== false
  || response.governance?.executesActivation !== false
  || response.governance?.executesRollback !== false
  || response.governance?.automaticActivation !== false
) {
  throw new Error(`Declarative activation decision task draft mismatch: ${JSON.stringify(response)}`);
}
process.stdout.write(`${response.task.id} ${response.approval.id}\n`);
NODE
)

post_json "$CORE_URL/approvals/$ACTIVATION_APPROVAL_ID/approve" \
  '{"approvedBy":"dev-openclaw-native-declarative-evolution-staging-check","reason":"Approve one host-health-bound future activation decision without activating a generation."}' > "$ACTIVATION_APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$ACTIVATION_STEP_FILE"
OPENCLAW_POST_JSON_FAILURE=allow post_json "$CORE_URL/capabilities/invoke" \
  "{\"capabilityId\":\"act.openclaw.declarative_evolution.activation\",\"params\":{\"activationDecisionTaskId\":\"$ACTIVATION_TASK_ID\",\"confirm\":false}}" > "$ACTIVATION_TASK_BLOCKED_FILE"

node - <<'NODE' "$TASK_FILE" "$APPROVED_FILE" "$STEP_FILE" "$HEALTH_GATE_FILE" "$STAGING_DIR" "$OPENCLAW_EVENT_LOG_FILE" "$CANDIDATE_HASH" "$TASK_ID" "$ACTIVATION_REVIEW_FILE" "$ACTIVATION_TASK_FILE" "$ACTIVATION_APPROVED_FILE" "$ACTIVATION_STEP_FILE" "$ACTIVATION_TASK_ID" "$ACTIVATION_APPROVAL_ID" "$ACTIVATION_TASK_BLOCKED_FILE"
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));
const taskResponse = readJson(2);
const approved = readJson(3);
const step = readJson(4);
const healthGate = readJson(5);
const stagingDir = path.resolve(process.argv[6]);
const eventLogFile = process.argv[7];
const candidateHash = process.argv[8];
const taskId = process.argv[9];
const activationReview = readJson(10);
const activationTaskResponse = readJson(11);
const activationApproved = readJson(12);
const activationStep = readJson(13);
const activationTaskId = process.argv[14];
const activationApprovalId = process.argv[15];
const activationTaskBlocked = readJson(16);
const task = step.task;
const execution = task?.nativeDeclarativeEvolution?.execution;
const stagingPath = execution?.staging?.path;
const stagedText = stagingPath && fs.existsSync(stagingPath) ? fs.readFileSync(stagingPath, "utf8") : null;
const raw = JSON.stringify({ taskResponse, approved, step, activationTaskBlocked });
const approvedBinding = approved.approval?.binding;
const taskApprovalBinding = taskResponse.task?.approval?.binding;
const approvedStagingStep = approvedBinding?.steps?.find((item) => item.capabilityId === "act.openclaw.declarative_evolution.staging_task");
const taskStagingStep = taskApprovalBinding?.steps?.find((item) => item.capabilityId === "act.openclaw.declarative_evolution.staging_task");

if (
  !approved.ok
  || approved.approval?.status !== "approved"
  || approvedBinding?.registry !== "openclaw-capability-execution-approval-binding-v1"
  || approvedBinding?.planId !== taskResponse.task?.plan?.planId
  || approvedStagingStep?.stepId !== taskStagingStep?.stepId
  || approvedStagingStep?.requestHash !== taskStagingStep?.requestHash
  || !step.ok
  || step.ran !== true
  || step.blocked !== false
  || task?.status !== "completed"
  || task?.type !== "native_declarative_evolution_staging"
  || task?.nativeDeclarativeEvolution?.approvalBinding?.candidateHash !== candidateHash
  || task?.nativeDeclarativeEvolution?.governance?.candidateHashBound !== true
  || task?.nativeDeclarativeEvolution?.governance?.approvalBoundToCandidateHash !== true
  || execution?.status !== "passed"
  || execution?.candidateHash !== candidateHash
  || execution?.staging?.status !== "staged"
  || execution?.staging?.candidateHash !== candidateHash
  || execution?.validation?.status !== "passed"
  || execution?.validation?.mode !== "nix-instantiate"
  || execution?.evaluation?.status !== "passed"
  || execution?.evaluation?.mode !== "nix-eval"
  || execution?.evaluation?.candidateType !== "lambda"
  || execution?.evaluation?.toplevelEvaluated !== true
  || execution?.build?.status !== "passed"
  || execution?.build?.mode !== "nix-build-no-link"
  || execution?.build?.outputPath !== execution?.evaluation?.toplevelPath
  || execution?.governance?.writesManagedConfig !== false
  || execution?.governance?.writesOpenClawStaging !== true
  || execution?.governance?.switchesGeneration !== false
  || execution?.governance?.executesRollback !== false
  || execution?.governance?.networkEgress !== false
  || !Array.isArray(step.execution?.verification?.checks)
  || !step.execution.verification.checks.includes("candidate_hash_bound")
  || !step.execution.verification.checks.includes("nixos_evaluation")
  || !step.execution.verification.checks.includes("nixos_build")
) {
  throw new Error(`Declarative staging execution mismatch: ${JSON.stringify({ taskResponse, approved, step })}`);
}
if (
  !healthGate.ok
  || healthGate.invoked !== true
  || healthGate.blocked !== false
  || healthGate.capability?.id !== "sense.openclaw.declarative_evolution.health_gate"
  || healthGate.result?.ok !== true
  || healthGate.result?.taskId !== taskId
  || healthGate.result?.assessment?.status !== "eligible_for_activation_review"
  || healthGate.result?.assessment?.eligibleForActivationReview !== true
  || healthGate.result?.assessment?.hostHealth !== "not_assessed"
  || healthGate.result?.evaluatedClosure?.path !== execution.evaluation.toplevelPath
  || !/^\/nix\/store\/.+\.drv$/.test(healthGate.result?.evaluatedClosure?.derivationPath ?? "")
  || !/^sha256-[A-Za-z0-9+/=]+$/.test(healthGate.result?.evaluatedClosure?.narHash ?? "")
  || healthGate.result?.closureIntegrity?.status !== "verified"
  || healthGate.result?.closureIntegrity?.receipt?.sourceStagingTaskId !== taskId
  || healthGate.result?.closureIntegrity?.receipt?.approvalId !== approved.approval?.id
  || !/^[a-f0-9]{64}$/.test(healthGate.result?.closureIntegrity?.receipt?.receiptHash ?? "")
  || healthGate.result?.governance?.readsStagingFile !== true
  || healthGate.result?.governance?.readsCurrentApprovalRecord !== true
  || healthGate.result?.governance?.requeriesStoreOutput !== true
  || healthGate.result?.governance?.emitsImmutableClosureReceipt !== true
  || healthGate.result?.governance?.writesManagedConfig !== false
  || healthGate.result?.governance?.switchesGeneration !== false
  || healthGate.result?.governance?.executesRollback !== false
  || healthGate.result?.governance?.assessesHostHealth !== false
  || healthGate.result?.governance?.automaticActivation !== false
  || healthGate.result?.governance?.automaticRollback !== false
  || healthGate.summary?.candidateTextInSummary !== false
) {
  throw new Error(`Declarative health-gate assessment mismatch: ${JSON.stringify({ healthGate, execution })}`);
}
const activationTask = activationStep.task;
const activationExecution = activationTask?.nativeDeclarativeEvolution?.execution;
const activationBinding = activationTaskResponse.approvalBinding;
const activationApprovedBinding = activationApproved.approval?.binding;
const activationTaskApprovalBinding = activationTaskResponse.task?.approval?.binding;
const activationApprovedStep = activationApprovedBinding?.steps?.find((item) => item.capabilityId === "act.openclaw.declarative_evolution.activation_decision");
const activationTaskStep = activationTaskApprovalBinding?.steps?.find((item) => item.capabilityId === "act.openclaw.declarative_evolution.activation_decision");
const activationChecks = {
  review: activationReview.ok
    && activationReview.blocked === false
    && activationReview.sourceTaskId === taskId
    && activationReview.activationReady === true
    && activationReview.healthGate?.assessment === "eligible_for_activation_review"
    && activationReview.hostHealth?.status === "healthy"
    && activationReview.binding?.candidateHash === candidateHash
    && activationReview.binding?.sourceStagingTaskId === taskId
    && activationReview.binding?.derivationPath === healthGate.result.evaluatedClosure.derivationPath
    && activationReview.binding?.narHash === healthGate.result.evaluatedClosure.narHash
    && activationReview.binding?.closureIntegrityReceiptHash === healthGate.result.closureIntegrity.receipt.receiptHash
    && activationReview.binding?.approvalRecordHash === healthGate.result.closureIntegrity.receipt.approvalRecordHash
    && /^[a-f0-9]{64}$/.test(activationReview.binding?.hostHealthHash ?? ""),
  taskDraft: activationTaskResponse.ok
    && activationTaskResponse.task?.id === activationTaskId
    && activationTaskResponse.approval?.id === activationApprovalId
    && activationBinding?.candidateHash === candidateHash
    && activationBinding?.sourceStagingTaskId === taskId
    && activationBinding?.closureIntegrityReceiptHash === activationReview.binding?.closureIntegrityReceiptHash
    && activationBinding?.derivationPath === activationReview.binding?.derivationPath
    && activationBinding?.narHash === activationReview.binding?.narHash
    && activationBinding?.hostHealthHash === activationReview.binding?.hostHealthHash,
  approval: activationApproved.ok
    && activationApproved.approval?.id === activationApprovalId
    && activationApproved.approval?.status === "approved"
    && activationApprovedBinding?.registry === "openclaw-capability-execution-approval-binding-v1"
    && activationApprovedBinding?.planId === activationTaskResponse.task?.plan?.planId
    && activationApprovedStep?.stepId === activationTaskStep?.stepId
    && activationApprovedStep?.requestHash === activationTaskStep?.requestHash,
  execution: activationStep.ok
    && activationStep.ran === true
    && activationStep.blocked === false
    && activationTask?.id === activationTaskId
    && activationTask?.status === "completed"
    && activationExecution?.status === "passed"
    && activationExecution?.activation === "approved_for_future_activation"
    && activationExecution?.candidateHash === candidateHash
    && activationExecution?.closureIntegrityReceiptHash === activationReview.binding?.closureIntegrityReceiptHash
    && activationExecution?.derivationPath === activationReview.binding?.derivationPath
    && activationExecution?.narHash === activationReview.binding?.narHash
    && activationExecution?.hostHealthHash === activationReview.binding?.hostHealthHash
    && activationExecution?.hostHealthStatus === "healthy"
    && activationTask?.nativeDeclarativeEvolution?.governance?.hostHealthRevalidated === true,
  zeroActivation: activationExecution?.governance?.writesManagedConfig === false
    && activationExecution?.governance?.switchesGeneration === false
    && activationExecution?.governance?.executesActivation === false
    && activationExecution?.governance?.executesRollback === false
    && activationExecution?.governance?.automaticActivation === false
    && activationStep.execution?.verification?.checks?.includes("host_health_hash_bound")
    && activationStep.execution?.verification?.checks?.includes("closure_integrity_receipt_bound")
    && activationStep.execution?.verification?.checks?.includes("activation_not_executed"),
  confirmationGate: activationTaskBlocked.ok
    && activationTaskBlocked.invoked === true
    && activationTaskBlocked.result?.blocked === true
    && activationTaskBlocked.result?.reason === "operator_confirmation_required"
    && activationTaskBlocked.summary?.kind === "declarative_evolution.activation"
    && activationTaskBlocked.summary?.createsTask === false
    && activationTaskBlocked.summary?.createsApproval === false
    && activationTaskBlocked.summary?.activationExecuted === false
    && activationTaskBlocked.summary?.noAutomaticActivation === true
    && activationTaskBlocked.summary?.noAutomaticRollback === true
    && activationTaskBlocked.summary?.rollbackManualOnly === true,
};
if (Object.values(activationChecks).some((passed) => !passed)) {
  throw new Error(`Declarative activation decision execution mismatch: ${JSON.stringify(Object.fromEntries(Object.entries(activationChecks).filter(([, passed]) => !passed)))}`);
}
if (
  !stagedText
  || crypto.createHash("sha256").update(stagedText, "utf8").digest("hex") !== candidateHash
  || !stagingPath.startsWith(`${stagingDir}${path.sep}`)
  || path.basename(stagingPath) !== `openclaw-managed-${candidateHash}.nix`
  || (!stagingPath.includes("managed-config-staging") && !stagingPath.includes("native-declarative-evolution-staging"))
) {
  throw new Error(`Staged candidate file mismatch: ${JSON.stringify({ stagingDir, stagingPath, candidateHash })}`);
}
if (raw.includes("services.openclaw.components") || raw.includes("Generated by OpenClaw declarative evolution")
  || JSON.stringify(healthGate).includes("services.openclaw.components")
  || JSON.stringify(healthGate).includes("Generated by OpenClaw declarative evolution")) {
  throw new Error("Declarative staging task evidence exposed generated candidate text.");
}
if (eventLogFile && fs.existsSync(eventLogFile)) {
  const eventText = fs.readFileSync(eventLogFile, "utf8");
  if (eventText.includes("services.openclaw.components") || eventText.includes("Generated by OpenClaw declarative evolution")) {
    throw new Error("Declarative staging audit events exposed generated candidate text.");
  }
}
console.log(JSON.stringify({
  nativeDeclarativeEvolutionStaging: {
    status: "passed",
    taskId: task.id,
    approvalId: approved.approval.id,
    candidateHash,
    stagingPath,
    validation: execution.validation.mode,
    evaluation: execution.evaluation.mode,
    build: execution.build.mode,
    healthGate: healthGate.result.assessment.status,
    evaluatedClosure: healthGate.result.evaluatedClosure.path,
    activationDecision: activationExecution.activation,
    activationTaskId,
    activationApprovalId,
    hostHealth: activationExecution.hostHealthStatus,
    hostMutation: execution.governance.writesManagedConfig,
    generationSwitch: execution.governance.switchesGeneration,
    rollback: execution.governance.executesRollback,
    activationConfirmationGate: activationTaskBlocked.result.reason,
    activationTaskCreatedWithoutConfirmation: activationTaskBlocked.summary.createsTask,
  },
}, null, 2));
NODE

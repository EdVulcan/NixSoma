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
export OPENCLAW_NIXOS_BUILD_TIMEOUT_MS="${OPENCLAW_NIXOS_BUILD_TIMEOUT_MS:-120000}"

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
    "${TASK_FILE:-}" \
    "${APPROVED_FILE:-}" \
    "${STEP_FILE:-}"
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

  curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
  curl --silent --fail "$CORE_URL/capabilities" > "$CAPABILITIES_FILE"
  post_json "$CORE_URL/capabilities/invoke" '{"capabilityId":"act.openclaw.declarative_evolution.staging_task","params":{"changes":[{"operation":"enable_component","component":"systemSense"}],"confirm":false}}' > "$BLOCKED_FILE"
  curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$INVOCATION_FILE"

  node - <<'NODE' "$HTML_FILE" "$CLIENT_FILE" "$CAPABILITIES_FILE" "$BLOCKED_FILE" "$INVOCATION_FILE"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));
const html = readText(2);
const client = readText(3);
const capabilities = readJson(4);
const blocked = readJson(5);
const invocations = readJson(6);
const capabilityId = "act.openclaw.declarative_evolution.staging_task";
const descriptor = capabilities.capabilities?.find((item) => item.id === capabilityId);
const raw = JSON.stringify({ html, client, capabilities, blocked, invocations });

for (const token of [
  "Body Capabilities",
  "capability-registry",
  "capability-online",
  "capability-approval",
  "capability-history-json",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing generic capability token: ${token}`);
}
for (const token of [
  "/capabilities",
  "/capabilities/invoke",
  "refreshCapabilityState",
  "renderCapabilityState",
  "refreshCapabilityHistory",
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
if (raw.includes("services.openclaw.components") || raw.includes("Generated by OpenClaw declarative evolution")) {
  throw new Error("Observer staging review must not expose generated candidate text.");
}
console.log(JSON.stringify({
  observerNativeDeclarativeEvolutionStaging: {
    status: "passed",
    capability: capabilityId,
    registry: capabilities.registry,
    confirmationGate: blocked.result.reason,
    candidateTextExposed: false,
  },
}, null, 2));
NODE
  exit 0
fi

TASK_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"

post_json "$CORE_URL/plugins/native-adapter/declarative-evolution/staging-tasks" \
  '{"changes":[{"operation":"enable_component","component":"systemSense"}],"confirm":true}' > "$TASK_FILE"

read -r APPROVAL_ID CANDIDATE_HASH < <(node - <<'NODE' "$TASK_FILE"
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
process.stdout.write(`${response.approval.id} ${response.candidate.candidateHash}\n`);
NODE
)

post_json "$CORE_URL/approvals/$APPROVAL_ID/approve" \
  '{"approvedBy":"dev-openclaw-native-declarative-evolution-staging-check","reason":"Approve one hash-bound managed Nix staging and read-only evaluation/build check."}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"

node - <<'NODE' "$TASK_FILE" "$APPROVED_FILE" "$STEP_FILE" "$STAGING_DIR" "$OPENCLAW_EVENT_LOG_FILE" "$CANDIDATE_HASH"
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));
const taskResponse = readJson(2);
const approved = readJson(3);
const step = readJson(4);
const stagingDir = path.resolve(process.argv[5]);
const eventLogFile = process.argv[6];
const candidateHash = process.argv[7];
const task = step.task;
const execution = task?.nativeDeclarativeEvolution?.execution;
const stagingPath = execution?.staging?.path;
const stagedText = stagingPath && fs.existsSync(stagingPath) ? fs.readFileSync(stagingPath, "utf8") : null;
const raw = JSON.stringify({ taskResponse, approved, step });

if (
  !approved.ok
  || approved.approval?.status !== "approved"
  || approved.approval?.binding?.candidateHash !== candidateHash
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
  || execution?.build?.mode !== "nix-build-dry-run"
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
  !stagedText
  || crypto.createHash("sha256").update(stagedText, "utf8").digest("hex") !== candidateHash
  || !stagingPath.startsWith(`${stagingDir}${path.sep}`)
  || path.basename(stagingPath) !== `openclaw-managed-${candidateHash}.nix`
  || (!stagingPath.includes("managed-config-staging") && !stagingPath.includes("native-declarative-evolution-staging"))
) {
  throw new Error(`Staged candidate file mismatch: ${JSON.stringify({ stagingDir, stagingPath, candidateHash })}`);
}
if (raw.includes("services.openclaw.components") || raw.includes("Generated by OpenClaw declarative evolution")) {
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
    hostMutation: execution.governance.writesManagedConfig,
    generationSwitch: execution.governance.switchesGeneration,
    rollback: execution.governance.executesRollback,
  },
}, null, 2));
NODE

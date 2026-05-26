#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE27_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE27_PORT_BASE:-8640}"
CLOUD_DIR="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness"
PROVIDER_RESPONSE_FILE="$CLOUD_DIR/provider-response-rehearsal.jsonl"
RUNBOOK_FILE="$CLOUD_DIR/live-provider-call-runbook.jsonl"
EXECUTION_PLAN_FILE="$CLOUD_DIR/live-provider-call-execution-plan.jsonl"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_27_PLAN.md"
MODULE_FILE="$REPO_ROOT/services/openclaw-core/src/cloud-live-provider-runtime-adapter.mjs"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-27-runtime-adapter-module-regression-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-27-runtime-adapter-module-regression-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
CONTRACT_REGISTRY="openclaw-cloud-consciousness-live-provider-runtime-adapter-module-contract-v0"
TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-runtime-adapter-module-task-v0"

. "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-fixtures.sh"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
seed_live_provider_call_prerequisites "$CLOUD_DIR" "$PROVIDER_RESPONSE_FILE" "$RUNBOOK_FILE" "$EXECUTION_PLAN_FILE" "phase27-prereq"
cleanup() {
  rm -f "${CONTRACT_FILE:-}" "${TASK_FILE:-}" "${APPROVED_FILE:-}" "${STEP_FILE:-}" "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${BEFORE_FILE:-}" "${AFTER_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT
"$SCRIPT_DIR/dev-up.sh"

CONTRACT_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-runtime-adapter-module-contract" > "$CONTRACT_FILE"

if [[ "$OBSERVER_CHECK" == "true" ]]; then
  HTML_FILE="$(mktemp)"
  CLIENT_FILE="$(mktemp)"
  curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
  node - <<'EOF' "$CONTRACT_REGISTRY" "$TASK_REGISTRY" "$CONTRACT_FILE" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const contractRegistry = process.argv[2];
const taskRegistry = process.argv[3];
const contract = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
const html = fs.readFileSync(process.argv[5], "utf8");
const client = fs.readFileSync(process.argv[6], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Runtime Adapter Module Contract",
  "cloud-consciousness-live-provider-runtime-adapter-module-contract-panel",
  "cloud-live-runtime-adapter-module-ready",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-runtime-adapter-module-contract",
  "/cloud-consciousness/live-provider-runtime-adapter-module-tasks",
  contractRegistry,
  taskRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
if (!contract.ok || contract.summary?.ready !== true) {
  throw new Error(`Observer Phase 27 contract prerequisite should be ready: ${JSON.stringify(contract.summary)}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessRuntimeAdapterModuleRegression: { status: "passed", contractRegistry, taskRegistry } }, null, 2));
EOF
  exit 0
fi

BEFORE_FILE="$(mktemp)"
AFTER_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
sha256sum "$MODULE_FILE" | awk '{print $1}' > "$BEFORE_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-runtime-adapter-module-tasks" '{"confirm":true}' > "$TASK_FILE"
approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$TASK_FILE")"
post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-27-check","reason":"Approve deferred runtime adapter module regression shell."}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"
sha256sum "$MODULE_FILE" | awk '{print $1}' > "$AFTER_FILE"

node - <<'EOF' "$CONTRACT_REGISTRY" "$TASK_REGISTRY" "$PLAN_DOC" "$CONTRACT_FILE" "$TASK_FILE" "$STEP_FILE" "$BEFORE_FILE" "$AFTER_FILE"
const fs = require("node:fs");
const contractRegistry = process.argv[2];
const taskRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const contract = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const task = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
const step = JSON.parse(fs.readFileSync(process.argv[7], "utf8"));
const beforeHash = fs.readFileSync(process.argv[8], "utf8").trim();
const afterHash = fs.readFileSync(process.argv[9], "utf8").trim();
for (const token of [
  "openclaw-cloud-consciousness-runtime-adapter-module-regression",
  "Phase 24-26 runtime adapter module chain",
  "no source mutation, adapter implementation, SDK load, credential value read, endpoint contact, network egress, or live provider call",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 27 plan doc missing ${token}`);
}
if (
  !contract.ok
  || contract.registry !== contractRegistry
  || contract.summary?.ready !== true
  || contract.summary?.moduleBoundaryDefined !== true
  || contract.summary?.implementedMethodCount !== 0
) {
  throw new Error(`Phase 24 module contract regression failed: ${JSON.stringify(contract.summary)}`);
}
if (
  !task.ok
  || task.registry !== taskRegistry
  || task.task?.status !== "queued"
  || task.approval?.status !== "pending"
  || task.task?.cloudConsciousnessLiveProviderRuntimeAdapterModule?.implementationStatus !== "task_shell_only"
) {
  throw new Error(`Phase 25 module task regression failed: ${JSON.stringify(task)}`);
}
const shell = step.task?.cloudConsciousnessLiveProviderRuntimeAdapterModule;
if (
  !step.ok
  || beforeHash !== afterHash
  || shell?.registry !== taskRegistry
  || shell?.implementationStatus !== "deferred_after_approval"
  || !step.task?.phaseHistory?.some((entry) => entry.phase === "cloud_consciousness_live_provider_runtime_adapter_module_deferred")
) {
  throw new Error(`Phase 26 deferred module regression failed: ${JSON.stringify({ step, beforeHash, afterHash })}`);
}
if (
  shell.mutatesModule !== false
  || shell.writesSource !== false
  || shell.implementsRuntimeAdapter !== false
  || shell.providerSdkLoaded !== false
  || shell.providerCredentialRead !== false
  || shell.credentialValueRead !== false
  || shell.endpointContacted !== false
  || shell.networkEgress !== false
  || shell.transmitsExternally !== false
  || shell.liveProviderCallEnabled !== false
) {
  throw new Error(`Phase 27 regression must keep module mutation and live provider activity disabled: ${JSON.stringify(shell)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessRuntimeAdapterModuleRegression: { status: "passed", taskId: step.task.id, contractRegistry, taskRegistry } }, null, 2));
EOF

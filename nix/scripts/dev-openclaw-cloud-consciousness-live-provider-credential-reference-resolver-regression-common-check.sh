#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE35_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE35_PORT_BASE:-8800}"
CLOUD_DIR="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness"
PROVIDER_RESPONSE_FILE="$CLOUD_DIR/provider-response-rehearsal.jsonl"
RUNBOOK_FILE="$CLOUD_DIR/live-provider-call-runbook.jsonl"
EXECUTION_PLAN_FILE="$CLOUD_DIR/live-provider-call-execution-plan.jsonl"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_35_PLAN.md"
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
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-35-credential-reference-resolver-regression-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-35-credential-reference-resolver-regression-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
TASK_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-reference-resolver-task-v0"
RESOLVER_REGISTRY="openclaw-cloud-consciousness-live-provider-credential-reference-resolver-v0"

. "$SCRIPT_DIR/dev-openclaw-cloud-consciousness-live-provider-fixtures.sh"

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
seed_live_provider_call_prerequisites "$CLOUD_DIR" "$PROVIDER_RESPONSE_FILE" "$RUNBOOK_FILE" "$EXECUTION_PLAN_FILE" "phase35-prereq"
cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${RESOLVER_FILE:-}" "${TASK_FILE:-}" "${APPROVED_FILE:-}" "${STEP_FILE:-}" "${AFTER_RESOLVER_FILE:-}" "${BEFORE_FILE:-}" "${AFTER_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT
"$SCRIPT_DIR/dev-up.sh"

if [[ "$OBSERVER_CHECK" == "true" ]]; then
  HTML_FILE="$(mktemp)"
  CLIENT_FILE="$(mktemp)"
  curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
  node - <<'EOF' "$TASK_REGISTRY" "$RESOLVER_REGISTRY" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const taskRegistry = process.argv[2];
const resolverRegistry = process.argv[3];
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Credential Reference Resolver",
  "cloud-consciousness-live-provider-credential-reference-resolver-panel",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-credential-reference-resolver",
  "/cloud-consciousness/live-provider-credential-reference-resolver-tasks",
  taskRegistry,
  resolverRegistry,
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessCredentialReferenceResolverRegression: { status: "passed", taskRegistry, resolverRegistry } }, null, 2));
EOF
  exit 0
fi

RESOLVER_FILE="$(mktemp)"
AFTER_RESOLVER_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
APPROVED_FILE="$(mktemp)"
STEP_FILE="$(mktemp)"
BEFORE_FILE="$(mktemp)"
AFTER_FILE="$(mktemp)"
sha256sum "$MODULE_FILE" | awk '{print $1}' > "$BEFORE_FILE"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-reference-resolver" > "$RESOLVER_FILE"
post_json "$CORE_URL/cloud-consciousness/live-provider-credential-reference-resolver-tasks" '{"confirm":true}' > "$TASK_FILE"
approval_id="$(node -e 'const fs=require("node:fs"); const data=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if(!data.approval?.id) throw new Error("missing approval id"); console.log(data.approval.id)' "$TASK_FILE")"
post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"phase-35-check","reason":"Approve credential reference resolver regression deferred shell."}' > "$APPROVED_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$STEP_FILE"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-credential-reference-resolver" > "$AFTER_RESOLVER_FILE"
sha256sum "$MODULE_FILE" | awk '{print $1}' > "$AFTER_FILE"

node - <<'EOF' "$TASK_REGISTRY" "$RESOLVER_REGISTRY" "$PLAN_DOC" "$RESOLVER_FILE" "$TASK_FILE" "$STEP_FILE" "$AFTER_RESOLVER_FILE" "$BEFORE_FILE" "$AFTER_FILE"
const fs = require("node:fs");
const taskRegistry = process.argv[2];
const resolverRegistry = process.argv[3];
const doc = fs.readFileSync(process.argv[4], "utf8");
const resolver = JSON.parse(fs.readFileSync(process.argv[5], "utf8"));
const task = JSON.parse(fs.readFileSync(process.argv[6], "utf8"));
const step = JSON.parse(fs.readFileSync(process.argv[7], "utf8"));
const afterResolver = JSON.parse(fs.readFileSync(process.argv[8], "utf8"));
const beforeHash = fs.readFileSync(process.argv[9], "utf8").trim();
const afterHash = fs.readFileSync(process.argv[10], "utf8").trim();
for (const token of [
  "openclaw-cloud-consciousness-live-provider-credential-reference-resolver-regression",
  "credential references remain valid and reference-only",
  "no credential value read, credential value exposure, endpoint contact, network egress, or live provider call",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 35 plan doc missing ${token}`);
}
if (beforeHash !== afterHash) {
  throw new Error(`Runtime adapter module source should not change: ${beforeHash} !== ${afterHash}`);
}
if (!resolver.ok || resolver.registry !== resolverRegistry || resolver.summary?.ready !== true || resolver.summary?.referenceOnly !== true) {
  throw new Error(`Phase 35 resolver prerequisite failed: ${JSON.stringify(resolver.summary)}`);
}
if (!task.ok || task.registry !== taskRegistry || task.task?.cloudConsciousnessLiveProviderCredentialReferenceResolver?.implementationStatus !== "task_shell_only") {
  throw new Error(`Phase 35 task shell failed: ${JSON.stringify(task.task?.cloudConsciousnessLiveProviderCredentialReferenceResolver)}`);
}
const shell = step.task?.cloudConsciousnessLiveProviderCredentialReferenceResolver;
if (!step.ok || shell?.registry !== taskRegistry || shell?.implementationStatus !== "deferred_after_approval") {
  throw new Error(`Phase 35 deferred step failed: ${JSON.stringify(step)}`);
}
for (const state of [resolver.summary, afterResolver.summary, shell]) {
  if (
    state.referenceOnly !== true
    || state.credentialValueIncluded !== false
    || state.credentialValueRead !== false
    || state.credentialValueExposed !== false
    || state.endpointContacted !== false
    || state.networkEgress !== false
    || state.liveProviderCallEnabled !== false
  ) {
    throw new Error(`Phase 35 regression found credential or live activity: ${JSON.stringify(state)}`);
  }
}
console.log(JSON.stringify({ openclawCloudConsciousnessCredentialReferenceResolverRegression: { status: "passed", taskId: step.task.id, taskRegistry, resolverRegistry } }, null, 2));
EOF

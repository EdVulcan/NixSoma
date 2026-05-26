#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OBSERVER_CHECK="${PHASE16_OBSERVER_CHECK:-false}"
PORT_BASE="${PHASE16_PORT_BASE:-8420}"
CLOUD_DIR="$REPO_ROOT/.artifacts/openclaw-cloud-consciousness"
PROVIDER_RESPONSE_FILE="$CLOUD_DIR/provider-response-rehearsal.jsonl"
RUNBOOK_FILE="$CLOUD_DIR/live-provider-call-runbook.jsonl"
EXECUTION_PLAN_FILE="$CLOUD_DIR/live-provider-call-execution-plan.jsonl"
PLAN_DOC="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_16_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$PORT_BASE}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((PORT_BASE + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((PORT_BASE + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((PORT_BASE + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((PORT_BASE + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((PORT_BASE + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((PORT_BASE + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((PORT_BASE + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((PORT_BASE + 8))}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-16-operator-launch-review-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-16-operator-launch-review-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
REGISTRY="openclaw-cloud-consciousness-live-provider-call-operator-launch-review-v0"

seed_phase16_prerequisites() {
  mkdir -p "$CLOUD_DIR"
  node - <<'EOF' "$PROVIDER_RESPONSE_FILE" "$RUNBOOK_FILE" "$EXECUTION_PLAN_FILE"
const fs = require("node:fs");
const crypto = require("node:crypto");
const [providerResponseFile, runbookFile, executionPlanFile] = process.argv.slice(2);
function hash(record) {
  return crypto.createHash("sha256").update(JSON.stringify(record)).digest("hex");
}
const providerResponse = {
  id: "phase16-prereq-provider-response-rehearsal",
  createdAt: new Date().toISOString(),
  schema: "openclaw.cloud_consciousness.provider_call_rehearsal.v0",
  requestId: "phase16-prereq-request",
  requestContentHash: "phase16-prereq-request-hash",
  governance: {
    networkCall: false,
    providerSdkLoaded: false,
    credentialRead: false,
    externalTransmissionAllowed: false
  },
  egressTranscript: {
    cloudCallExecuted: false,
    transmittedExternally: false,
    providerSdkLoaded: false,
    networkCallAttempted: false
  }
};
providerResponse.contentHash = hash(providerResponse);
fs.writeFileSync(providerResponseFile, JSON.stringify(providerResponse) + "\n");

const runbook = {
  id: "phase16-prereq-live-provider-runbook",
  createdAt: new Date().toISOString(),
  schema: "openclaw.cloud_consciousness.live_provider_call_runbook.v0",
  governance: {
    networkCall: false,
    providerSdkLoaded: false,
    credentialRead: false,
    liveProviderCallEnabled: false,
    externalTransmissionAllowed: false
  }
};
runbook.contentHash = hash(runbook);
fs.writeFileSync(runbookFile, JSON.stringify(runbook) + "\n");

const executionPlan = {
  id: "phase16-prereq-live-provider-execution-plan",
  createdAt: new Date().toISOString(),
  schema: "openclaw.cloud_consciousness.live_provider_call_execution_plan.v0",
  runbookRecordId: runbook.id,
  runbookContentHash: runbook.contentHash,
  endpointFingerprint: "phase16-endpoint-fingerprint",
  credentialReference: "openclaw://credential/provider/live-provider-fixture",
  requestEnvelopeHash: "phase16-request-envelope-hash",
  status: "execution_plan_recorded",
  governance: {
    networkCall: false,
    providerSdkLoaded: false,
    credentialRead: false,
    credentialValueRead: false,
    endpointContacted: false,
    liveProviderCallEnabled: false,
    externalTransmissionAllowed: false
  }
};
executionPlan.contentHash = hash(executionPlan);
fs.writeFileSync(executionPlanFile, JSON.stringify(executionPlan) + "\n");
EOF
}

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
seed_phase16_prerequisites
cleanup() {
  rm -f "${DATA_FILE:-}" "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT
"$SCRIPT_DIR/dev-up.sh"

DATA_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/cloud-consciousness/live-provider-call-operator-launch-review" > "$DATA_FILE"

if [[ "$OBSERVER_CHECK" == "true" ]]; then
  HTML_FILE="$(mktemp)"
  CLIENT_FILE="$(mktemp)"
  curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
  node - <<'EOF' "$REGISTRY" "$DATA_FILE" "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const registry = process.argv[2];
const data = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const html = fs.readFileSync(process.argv[4], "utf8");
const client = fs.readFileSync(process.argv[5], "utf8");
for (const token of [
  "Cloud Consciousness Live Provider Call Operator Launch Review",
  "cloud-consciousness-live-provider-call-operator-launch-review-panel",
  "cloud-live-launch-review-ready",
]) {
  if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
}
for (const token of [
  "/cloud-consciousness/live-provider-call-operator-launch-review",
  "refreshCloudConsciousnessLiveProviderCallOperatorLaunchReview",
  registry,
  "openclaw-cloud-consciousness-live-provider-call-runtime-implementation-plan",
]) {
  if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
}
if (!data.ok || data.summary?.ready !== true) {
  throw new Error(`Observer Phase 16 endpoint should be ready: ${JSON.stringify(data.summary)}`);
}
console.log(JSON.stringify({ observerOpenClawCloudConsciousnessOperatorLaunchReview: { status: "passed", registry } }, null, 2));
EOF
  exit 0
fi

node - <<'EOF' "$REGISTRY" "$PLAN_DOC" "$DATA_FILE"
const fs = require("node:fs");
const registry = process.argv[2];
const doc = fs.readFileSync(process.argv[3], "utf8");
const data = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
for (const token of [
  "openclaw-cloud-consciousness-live-provider-call-operator-launch-review",
  "Review the live provider-call launch path without authorizing launch",
  "openclaw-cloud-consciousness-live-provider-call-runtime-implementation-plan",
]) {
  if (!doc.includes(token)) throw new Error(`Phase 16 plan doc missing ${token}`);
}
if (!data.ok || data.registry !== registry) {
  throw new Error(`Unexpected Phase 16 registry: ${JSON.stringify({ ok: data.ok, registry: data.registry })}`);
}
if (
  data.summary?.ready !== true
  || data.summary?.completionPercent !== 100
  || data.summary?.grantsLaunchAuthorization !== false
  || data.summary?.launchAuthorized !== false
  || data.summary?.liveProviderCallEnabled !== false
  || data.summary?.providerCredentialRead !== false
  || data.summary?.credentialValueRead !== false
  || data.summary?.endpointContacted !== false
  || data.summary?.networkEgress !== false
  || data.next?.recommendedSlice !== "openclaw-cloud-consciousness-live-provider-call-runtime-implementation-plan"
) {
  throw new Error(`Phase 16 operator launch review should be ready but non-live: ${JSON.stringify(data.summary)}`);
}
console.log(JSON.stringify({ openclawCloudConsciousnessOperatorLaunchReview: { status: "passed", registry } }, null, 2));
EOF

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CHECK_KIND="${OPENCLAW_SYSTEMD_BOOT_EVIDENCE_CHECK_KIND:-core}"
RUN_ID="systemd-boot-evidence-${CHECK_KIND}-$$"

if [[ "$CHECK_KIND" == "observer" ]]; then
  BASE_PORT="${OPENCLAW_SYSTEMD_BOOT_EVIDENCE_OBSERVER_PORT_BASE:-5999}"
else
  BASE_PORT="${OPENCLAW_SYSTEMD_BOOT_EVIDENCE_PORT_BASE:-5989}"
fi

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-$BASE_PORT}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-$((BASE_PORT + 1))}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-$((BASE_PORT + 2))}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-$((BASE_PORT + 3))}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-$((BASE_PORT + 4))}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-$((BASE_PORT + 5))}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-$((BASE_PORT + 6))}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-$((BASE_PORT + 7))}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-$((BASE_PORT + 8))}"
export OPENCLAW_DEV_RUN_ID="${OPENCLAW_DEV_RUN_ID:-$RUN_ID}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-events-$RUN_ID.jsonl}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-boot-evidence-${CHECK_KIND}.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-boot-evidence-${CHECK_KIND}.json}"
unset OPENCLAW_OPERATOR_TOKEN
export OPENCLAW_OPERATOR_TOKEN_FILE="$REPO_ROOT/.artifacts/openclaw-operator-token-$RUN_ID"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"
DIRECT_FILE="$(mktemp)"
PROXY_FILE="$(mktemp)"
HTML_FILE=""
CLIENT_FILE=""

cleanup() {
  rm -f "$DIRECT_FILE" "$PROXY_FILE" "$HTML_FILE" "$CLIENT_FILE" \
    "$OPENCLAW_EVENT_LOG_FILE" \
    "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" \
    "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp" \
    "$OPENCLAW_OPERATOR_TOKEN_FILE"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
"$SCRIPT_DIR/dev-up.sh" >/dev/null

curl --silent --fail "$SYSTEM_URL/system/systemd/boot-evidence" >"$DIRECT_FILE"
curl --silent --fail "$CORE_URL/proxy/system-sense/system/systemd/boot-evidence" >"$PROXY_FILE"

if [[ "$CHECK_KIND" == "observer" ]]; then
  HTML_FILE="$(mktemp)"
  CLIENT_FILE="$(mktemp --suffix=.mjs)"
  curl --silent --fail "$OBSERVER_URL/" >"$HTML_FILE"
  curl --silent --fail "$OBSERVER_URL/client-v5.js" >"$CLIENT_FILE"
  node --check "$CLIENT_FILE"
fi

node - "$CHECK_KIND" "$DIRECT_FILE" "$PROXY_FILE" "$HTML_FILE" "$CLIENT_FILE" <<'NODE'
const fs = require("node:fs");

const [kind, directFile, proxyFile, htmlFile, clientFile] = process.argv.slice(2);
const direct = JSON.parse(fs.readFileSync(directFile, "utf8"));
const proxy = JSON.parse(fs.readFileSync(proxyFile, "utf8"));
const classificationSet = new Set([
  "explicit_reboot_sequence",
  "explicit_poweroff_sequence",
  "shutdown_sequence_without_cause",
  "ctrl_alt_delete",
  "watchdog",
  "kernel_fault",
  "oom",
  "unknown",
]);
const bootIdPattern = /^[0-9a-f]{32}$/u;

function assertNoJournalPayload(value, path = "$", seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoJournalPayload(item, `${path}[${index}]`, seen));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (["MESSAGE", "message", "entries", "journalEntries", "rawMessage"].includes(key)) {
      throw new Error(`boot evidence leaked journal payload at ${path}.${key}`);
    }
    assertNoJournalPayload(nested, `${path}.${key}`, seen);
  }
}

function assertEvidence(evidence, label) {
  if (evidence.ok !== true
    || evidence.registry !== "openclaw-systemd-boot-evidence-v0"
    || evidence.mode !== "read_only"
    || evidence.available !== true
    || evidence.bootCount < 1
    || !evidence.currentBoot
    || !bootIdPattern.test(evidence.currentBoot.bootId)
    || evidence.currentKernelBootId !== evidence.currentBoot.bootId
    || evidence.currentBoot.idMatchesKernel !== true
    || evidence.previousBoot?.available !== true
    || !bootIdPattern.test(evidence.previousBoot.bootId)
    || !classificationSet.has(evidence.assessment?.classification)
    || !Array.isArray(evidence.assessment?.markers)
    || evidence.assessment.inspectedEntries < 0
    || evidence.assessment.inspectedEntries > 64
    || evidence.assessment.terminalReadAvailable !== true
    || evidence.source?.messagesIncluded !== false
    || evidence.source?.persistentEvidence !== false
    || evidence.governance?.readOnlyCommand !== true
    || evidence.governance?.commandArgsBound !== true
    || evidence.governance?.hostMutation !== false
    || evidence.governance?.canMutate !== false
    || evidence.governance?.persistentEvidence !== false) {
    throw new Error(`${label} boot evidence violated its bounded contract: ${JSON.stringify(evidence)}`);
  }
  assertNoJournalPayload(evidence);
}

assertEvidence(direct, "system-sense");
assertEvidence(proxy, "Core proxy");
if (proxy.currentBoot.bootId !== direct.currentBoot.bootId
  || proxy.previousBoot.bootId !== direct.previousBoot.bootId
  || proxy.assessment.classification !== direct.assessment.classification) {
  throw new Error(`Core proxy changed the boot binding: ${JSON.stringify({ direct, proxy })}`);
}

const result = {
  status: "passed",
  kind,
  registry: direct.registry,
  currentBoot: direct.currentBoot.bootId,
  previousBoot: direct.previousBoot.bootId,
  classification: direct.assessment.classification,
  markers: direct.assessment.markers,
  inspectedEntries: direct.assessment.inspectedEntries,
  coreProxyBound: true,
  journalPayloadReturned: false,
};

if (kind === "observer") {
  const html = fs.readFileSync(htmlFile, "utf8");
  const client = fs.readFileSync(clientFile, "utf8");
  for (const token of [
    "Boot and Restart Evidence",
    "systemd-boot-evidence-panel",
    "systemd-boot-evidence-current",
    "systemd-boot-evidence-previous",
    "systemd-boot-evidence-assessment",
    "refresh-systemd-boot-evidence-button",
  ]) {
    if (!html.includes(token)) throw new Error(`Observer HTML missing ${token}`);
  }
  for (const token of [
    "/system/systemd/boot-evidence",
    "refreshSystemdBootEvidence",
    "systemdBootEvidenceCurrent",
    "systemdBootEvidenceAssessment",
    "messagesIncluded",
    "persistentEvidence",
    "await refreshSystemdBootEvidence();",
  ]) {
    if (!client.includes(token)) throw new Error(`Observer client missing ${token}`);
  }
  const bootRefresherStart = client.indexOf("async function refreshSystemdBootEvidence");
  const bootRefresherEnd = client.indexOf("async function refreshSystemdRepairPlan");
  if (bootRefresherStart < 0 || bootRefresherEnd <= bootRefresherStart
    || client.slice(bootRefresherStart, bootRefresherEnd).includes("data.entries")) {
    throw new Error("Observer boot evidence refresher must not render journal entries");
  }
  result.panel = "Boot and Restart Evidence";
}

console.log(JSON.stringify({ openclawSystemdBootEvidence: result }, null, 2));
NODE

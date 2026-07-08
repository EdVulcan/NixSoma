#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REGISTRY_SOURCE_FILE="${OPENCLAW_MILESTONE_CHECKS_FILE:-$SCRIPT_DIR/dev-milestone-checks.tsv}"
REGISTRY_FILE="$REGISTRY_SOURCE_FILE"
BASE="${OPENCLAW_MILESTONE_CHANGED_BASE:-}"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-milestone-registry-expansion.sh"
openclaw_milestone_prepare_expanded_registry "$SCRIPT_DIR" "$REGISTRY_SOURCE_FILE" REGISTRY_FILE
trap openclaw_milestone_cleanup_expanded_registry EXIT

cd "$REPO_ROOT"

collect_changed_files() {
  if [[ -n "$BASE" ]]; then
    git diff --name-only "$BASE"...HEAD 2>/dev/null || git diff --name-only "$BASE" HEAD 2>/dev/null || true
  fi
  git diff --name-only || true
  git diff --cached --name-only || true
  git ls-files --others --exclude-standard || true
}

CHANGED_FILES="$(collect_changed_files | sort -u)"

CHANGED_FILES="$CHANGED_FILES" node - "$SCRIPT_DIR" "$REGISTRY_FILE" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const [scriptDir, registryFile] = process.argv.slice(2);
const changedFiles = (process.env.CHANGED_FILES ?? "").split(/\n/).map((line) => line.trim()).filter(Boolean);
const changedBase = process.env.OPENCLAW_MILESTONE_CHANGED_BASE ?? "";
const registryText = fs.readFileSync(registryFile, "utf8").replace(/^\uFEFF/, "");
const entries = registryText.split(/\n/)
  .map((line) => line.replace(/\r$/, ""))
  .filter((line) => line.trim() && !line.startsWith("#"))
  .map((line) => {
    const [name, script, description] = line.split("\t");
    return { name, script, description };
  });

const byScript = new Map(entries.map((entry) => [entry.script, entry]));
const byName = new Map(entries.map((entry) => [entry.name, entry]));
const selected = new Set();
const sharedPackageContractsCheck = "openclaw-shared-package-contracts";
const structurallyCoveredCommonChecks = [];
const httpJsonHelperCheck = "openclaw-http-json-helper";
const waitHelperCheck = "openclaw-wait-helper";
const preCredentialPairManifestCheck = "openclaw-live-provider-pre-credential-pair-milestone-manifest";
const preCredentialPairBatchCheck = "openclaw-live-provider-pre-credential-pair-batch-reuse";
const preCredentialPairBatchDiagnosticsCheck = "openclaw-live-provider-pre-credential-pair-batch-diagnostics";
const preCredentialPairManifestFile = path.join(scriptDir, "openclaw-live-provider-pre-credential-pair-milestones.tsv");
const credentialValueLocalReadManifestCheck = "openclaw-live-provider-credential-value-local-read-milestone-manifest";
const credentialValueLocalReadManifestFile = path.join(scriptDir, "openclaw-live-provider-credential-value-local-read-milestones.tsv");
const credentialValueLocalReadAttemptManifestCheck = "openclaw-live-provider-credential-value-local-read-attempt-milestone-manifest";
const credentialValueLocalReadAttemptManifestFile = path.join(scriptDir, "openclaw-live-provider-credential-value-local-read-attempt-milestones.tsv");
const resultEnvelopeManifestCheck = "openclaw-live-provider-result-envelope-milestone-manifest";
const resultEnvelopeScriptNeedle = "credential-value-local-read-execution-local-read-attempt-local-read-result-envelope";
const resultEnvelopePhaseAliasPattern = /^dev-(?:observer-)?openclaw-live-provider-result-envelope-phase-\d+(?:-common)?-check\.sh$/;
const resultEnvelopeCommonEnvHelper = "dev-openclaw-live-provider-result-envelope-common-env.sh";
const resultEnvelopePrereqHelper = "dev-openclaw-live-provider-result-envelope-prereq.sh";
const resultEnvelopeAssertionsHelper = "dev-openclaw-live-provider-result-envelope-assertions.sh";

function readCredentialValueLocalReadCommonScripts() {
  if (!fs.existsSync(credentialValueLocalReadManifestFile)) return new Set();
  return new Set(fs.readFileSync(credentialValueLocalReadManifestFile, "utf8")
    .split(/\n/)
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => line.split("\t")[1])
    .filter(Boolean)
    .map((slug) => `dev-${slug}-common-check.sh`));
}

function readPreCredentialPairRows() {
  if (!fs.existsSync(preCredentialPairManifestFile)) return [];
  return fs.readFileSync(preCredentialPairManifestFile, "utf8")
    .split(/\n/)
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => {
      const [label, phase, publicCheck, observerCheck, commonScript] = line.split("\t");
      return { label, phase, publicCheck, observerCheck, commonScript };
    });
}

const preCredentialPairRows = readPreCredentialPairRows();
const preCredentialPairCommonScripts = new Set(preCredentialPairRows.map((row) => row.commonScript).filter(Boolean));
const preCredentialPairWrapperScripts = new Set(preCredentialPairRows
  .flatMap((row) => [byName.get(row.publicCheck)?.script, byName.get(row.observerCheck)?.script])
  .filter(Boolean));
const preCredentialPairHelperScripts = new Set([
  "openclaw-live-provider-pre-credential-pair-milestones.tsv",
  "dev-openclaw-live-provider-pre-credential-pair-milestone-manifest-check.sh",
  "dev-openclaw-live-provider-pre-credential-pair-batch-reuse-check.sh",
  "dev-openclaw-live-provider-pre-credential-pair-batch-diagnostics-check.sh",
]);

function selectPreCredentialPairRowsForCommon(scriptBasename) {
  for (const row of preCredentialPairRows) {
    if (row.commonScript === scriptBasename) {
      selectName(row.publicCheck);
      selectName(row.observerCheck);
    }
  }
}

const credentialValueLocalReadCommonScripts = readCredentialValueLocalReadCommonScripts();
const credentialValueLocalReadHelperScripts = new Set([
  "openclaw-live-provider-credential-value-local-read-milestones.tsv",
  "dev-openclaw-live-provider-credential-value-local-read-common-env.sh",
  "dev-openclaw-live-provider-credential-value-local-read-prereq.sh",
  "dev-openclaw-live-provider-credential-value-local-read-milestone-manifest-check.sh",
  "dev-openclaw-live-provider-credential-value-local-read-batch-reuse-check.sh",
]);

function readCredentialValueLocalReadAttemptCommonScripts() {
  if (!fs.existsSync(credentialValueLocalReadAttemptManifestFile)) return new Set();
  return new Set(fs.readFileSync(credentialValueLocalReadAttemptManifestFile, "utf8")
    .split(/\n/)
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => line.split("\t")[1])
    .filter(Boolean)
    .map((slug) => `dev-${slug}-common-check.sh`));
}

const credentialValueLocalReadAttemptCommonScripts = readCredentialValueLocalReadAttemptCommonScripts();
const credentialValueLocalReadAttemptHelperScripts = new Set([
  "openclaw-live-provider-credential-value-local-read-attempt-milestones.tsv",
  "dev-openclaw-live-provider-credential-value-local-read-attempt-common-env.sh",
  "dev-openclaw-live-provider-credential-value-local-read-attempt-prereq.sh",
  "dev-openclaw-live-provider-credential-value-local-read-attempt-milestone-manifest-check.sh",
  "dev-openclaw-live-provider-credential-value-local-read-attempt-batch-reuse-check.sh",
]);

function isBodyEvidenceFastPrereqScript(scriptBasename) {
  return scriptBasename === "dev-body-evidence-prereqs.sh"
    || scriptBasename === "dev-openclaw-body-evidence-fast-prereq-state.sh"
    || scriptBasename === "dev-openclaw-body-evidence-fast-prereq-state-check.sh"
    || /^dev-(observer-)?openclaw-body-evidence-ledger-followup-record-.*-check\.sh$/.test(scriptBasename)
    || /^dev-(observer-)?openclaw-phase-2-(completion-readiness|exit|next-capability-route-review-followup-(readiness|ledger-plan|append-ready))-check\.sh$/.test(scriptBasename);
}

function selectName(name) {
  if (byName.has(name)) selected.add(name);
}

function selectScriptsReferencing(scriptBasename) {
  for (const entry of entries) {
    const scriptPath = path.join(scriptDir, entry.script);
    if (!fs.existsSync(scriptPath)) continue;
    const text = fs.readFileSync(scriptPath, "utf8");
    if (text.includes(scriptBasename)) {
      selected.add(entry.name);
    }
  }
}

function readDiffChangedLines(file) {
  const commands = [];
  if (changedBase) {
    commands.push(["diff", "--no-ext-diff", "--unified=0", `${changedBase}...HEAD`, "--", file]);
  }
  commands.push(["diff", "--no-ext-diff", "--unified=0", "--", file]);
  commands.push(["diff", "--cached", "--no-ext-diff", "--unified=0", "--", file]);

  const lines = [];
  for (const args of commands) {
    try {
      const output = execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      for (const line of output.split(/\n/)) {
        if (!line || line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) continue;
        if (line.startsWith("+") || line.startsWith("-")) {
          lines.push({ op: line[0], text: line.slice(1) });
        }
      }
    } catch (error) {
      if (error.status === 1 && typeof error.stdout === "string") {
        for (const line of error.stdout.split(/\n/)) {
          if (!line || line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) continue;
          if (line.startsWith("+") || line.startsWith("-")) {
            lines.push({ op: line[0], text: line.slice(1) });
          }
        }
        continue;
      }
      return null;
    }
  }
  return lines;
}

function isAllowedCommonEnvExtractionAddition(text) {
  return text === ""
    || text === 'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"'
    || text === "# shellcheck source=/dev/null"
    || /^source "\$SCRIPT_DIR\/dev-openclaw-live-provider-result-envelope-common-env\.sh" [0-9]+$/.test(text);
}

function isAllowedCommonEnvExtractionRemoval(text) {
  return text === ""
    || text === 'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"'
    || text === 'REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"'
    || /^OBSERVER_CHECK="\$\{PHASE[0-9]+_OBSERVER_CHECK:-false\}"$/.test(text)
    || /^PORT_BASE="\$\{PHASE[0-9]+_PORT_BASE:-[0-9]+\}"$/.test(text)
    || /^PLAN_DOC="\$REPO_ROOT\/docs\/plans\/OPENCLAW_PHASE_[0-9]+_PLAN\.md"$/.test(text)
    || /^export (OPENCLAW_CORE_PORT|OPENCLAW_EVENT_HUB_PORT|OPENCLAW_SESSION_MANAGER_PORT|OPENCLAW_BROWSER_RUNTIME_PORT|OPENCLAW_SCREEN_SENSE_PORT|OPENCLAW_SCREEN_ACT_PORT|OPENCLAW_SYSTEM_SENSE_PORT|OPENCLAW_SYSTEM_HEAL_PORT|OBSERVER_UI_PORT)=/.test(text)
    || /^export OPENCLAW_(CORE|SYSTEM_HEAL)_STATE_FILE=/.test(text)
    || /^(CORE_URL|OBSERVER_URL)=/.test(text);
}

function isAllowedCommonPrereqExtractionAddition(text) {
  return text === ""
    || text === "# shellcheck source=/dev/null"
    || text === 'source "$SCRIPT_DIR/dev-openclaw-live-provider-result-envelope-prereq.sh"'
    || /^[ \t]*openclaw_result_envelope_prepare_prereq_state \\$/.test(text)
    || /^[ \t]*"\$SCRIPT_DIR" \\$/.test(text)
    || /^[ \t]*"\$PHASE[0-9]+_CORE_STATE" \\$/.test(text)
    || /^[ \t]*"\$PHASE[0-9]+_SYSTEM_HEAL_STATE" \\$/.test(text)
    || /^[ \t]*"\$OPENCLAW_CORE_STATE_FILE" \\$/.test(text)
    || /^[ \t]*"\$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \\$/.test(text)
    || /^[ \t]*"phase-[^"]+" \\$/.test(text)
    || /^[ \t]*"\$[A-Z0-9_]+" \\$/.test(text)
    || /^[ \t]*"[a-z0-9_]+" \\$/.test(text)
    || /^[ \t]*"PHASE[0-9]+_PORT_BASE" \\$/.test(text)
    || /^[ \t]*"dev-[^"]+-common-check\.sh"$/.test(text);
}

function isAllowedCommonPrereqExtractionRemoval(text) {
  return text === ""
    || /^[ \t]*rm -f "\$OPENCLAW_CORE_STATE_FILE" "\$OPENCLAW_CORE_STATE_FILE\.tmp" "\$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "\$OPENCLAW_SYSTEM_HEAL_STATE_FILE\.tmp"$/.test(text)
    || /^[ \t]*if \[\[ -f "\$SCRIPT_DIR\/dev-openclaw-fast-prereq-state\.sh" \]\]; then$/.test(text)
    || /^[ \t]*# shellcheck source=\/dev\/null$/.test(text)
    || /^[ \t]*source "\$SCRIPT_DIR\/dev-openclaw-fast-prereq-state\.sh"$/.test(text)
    || /^[ \t]*fi$/.test(text)
    || /^[ \t]*if ! declare -F openclaw_reuse_prereq_state >\/dev\/null \\$/.test(text)
    || /^[ \t]*\|\| ! openclaw_reuse_prereq_state \\$/.test(text)
    || /^[ \t]*"\$PHASE[0-9]+_CORE_STATE" \\$/.test(text)
    || /^[ \t]*"\$PHASE[0-9]+_SYSTEM_HEAL_STATE" \\$/.test(text)
    || /^[ \t]*"\$OPENCLAW_CORE_STATE_FILE" \\$/.test(text)
    || /^[ \t]*"\$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \\$/.test(text)
    || /^[ \t]*"phase-[^"]+" \\$/.test(text)
    || /^[ \t]*"\$[A-Z0-9_]+" \\$/.test(text)
    || /^[ \t]*"[a-z0-9_]+"; then$/.test(text)
    || /^[ \t]*PHASE[0-9]+_PORT_BASE="\$PORT_BASE" OPENCLAW_CORE_STATE_FILE="\$OPENCLAW_CORE_STATE_FILE" OPENCLAW_SYSTEM_HEAL_STATE_FILE="\$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \\$/.test(text)
    || /^[ \t]*bash "\$SCRIPT_DIR\/dev-[^"]+-common-check\.sh" >\/dev\/null$/.test(text);
}

function isAllowedCredentialValueLocalReadPrereqExtractionAddition(text) {
  return text === ""
    || text === "# shellcheck source=/dev/null"
    || text === 'source "$SCRIPT_DIR/dev-openclaw-live-provider-credential-value-local-read-prereq.sh"'
    || /^openclaw_credential_value_local_read_prepare_prereq_state (7[3-9]|8[0-9]|90)$/.test(text);
}

function isAllowedCredentialValueLocalReadPrereqExtractionRemoval(text) {
  return text === ""
    || /^[ \t]*rm -f "\$OPENCLAW_CORE_STATE_FILE" "\$OPENCLAW_CORE_STATE_FILE\.tmp" "\$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "\$OPENCLAW_SYSTEM_HEAL_STATE_FILE\.tmp"$/.test(text)
    || /^[ \t]*PHASE[0-9]+_PORT_BASE="\$PORT_BASE" OPENCLAW_CORE_STATE_FILE="\$OPENCLAW_CORE_STATE_FILE" OPENCLAW_SYSTEM_HEAL_STATE_FILE="\$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \\$/.test(text)
    || /^[ \t]*bash "\$SCRIPT_DIR\/dev-[^"]+-common-check\.sh" >\/dev\/null$/.test(text);
}

function isCredentialValueLocalReadCommonPrereqExtractionOnly(file, scriptBasename) {
  if (!credentialValueLocalReadCommonScripts.has(scriptBasename)) {
    return false;
  }

  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) return false;
  const currentText = fs.readFileSync(fullPath, "utf8");
  if (!currentText.includes("dev-openclaw-live-provider-credential-value-local-read-prereq.sh")) return false;
  if (!currentText.includes("openclaw_credential_value_local_read_prepare_prereq_state")) return false;

  const changedLines = readDiffChangedLines(file);
  if (!changedLines || changedLines.length === 0) return false;
  return changedLines.every(({ op, text }) => {
    if (op === "+") return isAllowedCredentialValueLocalReadPrereqExtractionAddition(text);
    if (op === "-") return isAllowedCredentialValueLocalReadPrereqExtractionRemoval(text);
    return false;
  });
}

function isAllowedCredentialValueLocalReadAttemptPrereqExtractionAddition(text) {
  return text === ""
    || text === "# shellcheck source=/dev/null"
    || text === 'source "$SCRIPT_DIR/dev-openclaw-live-provider-credential-value-local-read-attempt-prereq.sh"'
    || /^openclaw_credential_value_local_read_attempt_prepare_prereq_state (9[1-8])$/.test(text);
}

function isAllowedCredentialValueLocalReadAttemptPrereqExtractionRemoval(text) {
  return text === ""
    || /^PHASE[0-9]+_(CORE|SYSTEM_HEAL)_STATE="\$REPO_ROOT\/\.artifacts\/openclaw-(core|system-heal)-phase-[^"]+-check\.json"$/.test(text)
    || /^[ \t]*rm -f "\$OPENCLAW_CORE_STATE_FILE" "\$OPENCLAW_CORE_STATE_FILE\.tmp" "\$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "\$OPENCLAW_SYSTEM_HEAL_STATE_FILE\.tmp"$/.test(text)
    || /^[ \t]*if \[\[ -f "\$SCRIPT_DIR\/dev-openclaw-fast-prereq-state\.sh" \]\]; then$/.test(text)
    || /^[ \t]*# shellcheck source=\/dev\/null$/.test(text)
    || /^[ \t]*source "\$SCRIPT_DIR\/dev-openclaw-fast-prereq-state\.sh"$/.test(text)
    || /^[ \t]*fi$/.test(text)
    || /^[ \t]*if ! declare -F openclaw_reuse_prereq_state >\/dev\/null \\$/.test(text)
    || /^[ \t]*\|\| ! openclaw_reuse_prereq_state \\$/.test(text)
    || /^[ \t]*"\$PHASE[0-9]+_(CORE|SYSTEM_HEAL)_STATE" \\$/.test(text)
    || /^[ \t]*"\$OPENCLAW_CORE_STATE_FILE" \\$/.test(text)
    || /^[ \t]*"\$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \\$/.test(text)
    || /^[ \t]*"phase-[^"]+" \\$/.test(text)
    || /^[ \t]*"\$[A-Z0-9_]+" \\$/.test(text)
    || /^[ \t]*"[^"]+"; then$/.test(text)
    || /^[ \t]*PHASE[0-9]+_PORT_BASE="\$PORT_BASE" OPENCLAW_CORE_STATE_FILE="\$OPENCLAW_CORE_STATE_FILE" OPENCLAW_SYSTEM_HEAL_STATE_FILE="\$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \\$/.test(text)
    || /^[ \t]*bash "\$SCRIPT_DIR\/dev-[^"]+-common-check\.sh" >\/dev\/null$/.test(text);
}

function isCredentialValueLocalReadAttemptCommonPrereqExtractionOnly(file, scriptBasename) {
  if (!credentialValueLocalReadAttemptCommonScripts.has(scriptBasename)) {
    return false;
  }

  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) return false;
  const currentText = fs.readFileSync(fullPath, "utf8");
  if (!currentText.includes("dev-openclaw-live-provider-credential-value-local-read-attempt-prereq.sh")) return false;
  if (!currentText.includes("openclaw_credential_value_local_read_attempt_prepare_prereq_state")) return false;

  const changedLines = readDiffChangedLines(file);
  if (!changedLines || changedLines.length === 0) return false;
  return changedLines.every(({ op, text }) => {
    if (op === "+") return isAllowedCredentialValueLocalReadAttemptPrereqExtractionAddition(text);
    if (op === "-") return isAllowedCredentialValueLocalReadAttemptPrereqExtractionRemoval(text);
    return false;
  });
}

function isResultEnvelopeCommonEnvExtractionOnly(file, scriptBasename) {
  if (!isResultEnvelopeMilestoneScript(scriptBasename) || !scriptBasename.endsWith("-common-check.sh")) {
    return false;
  }

  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) return false;
  const currentText = fs.readFileSync(fullPath, "utf8");
  if (!currentText.includes(resultEnvelopeCommonEnvHelper)) return false;

  const changedLines = readDiffChangedLines(file);
  if (!changedLines || changedLines.length === 0) return false;
  return changedLines.every(({ op, text }) => {
    if (op === "+") return isAllowedCommonEnvExtractionAddition(text);
    if (op === "-") return isAllowedCommonEnvExtractionRemoval(text);
    return false;
  });
}

function isResultEnvelopeCommonPrereqExtractionOnly(file, scriptBasename) {
  if (!isResultEnvelopeMilestoneScript(scriptBasename) || !scriptBasename.endsWith("-common-check.sh")) {
    return false;
  }

  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) return false;
  const currentText = fs.readFileSync(fullPath, "utf8");
  if (!currentText.includes(resultEnvelopePrereqHelper)) return false;
  if (!currentText.includes("openclaw_result_envelope_prepare_prereq_state")) return false;

  const changedLines = readDiffChangedLines(file);
  if (!changedLines || changedLines.length === 0) return false;
  return changedLines.every(({ op, text }) => {
    if (op === "+") return isAllowedCommonPrereqExtractionAddition(text);
    if (op === "-") return isAllowedCommonPrereqExtractionRemoval(text);
    return false;
  });
}

function isAllowedResultEnvelopeRouteExtractionAddition(text) {
  return text === ""
    || text === 'import { handleCloudLiveProviderResultEnvelopeGetRoute } from "./cloud-live-provider-result-envelope-routes.mjs";'
    || text === "  if (await handleCloudLiveProviderResultEnvelopeGetRoute({ req, res, requestUrl, planBuilder })) {"
    || text === "    return;"
    || text === "  }";
}

function isAllowedResultEnvelopeRouteExtractionRemoval(text) {
  return text === ""
    || text === "    return;"
    || text === "  }"
    || /^  if \(req\.method === "GET" && requestUrl\.pathname === "\/cloud-consciousness\/live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope/.test(text)
    || /^    sendJson\(res, 200, await buildCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadAttemptLocalReadResultEnvelope.*\(\)\);$/.test(text);
}

function isResultEnvelopeMilestoneScript(scriptBasename) {
  return scriptBasename.includes(resultEnvelopeScriptNeedle)
    || resultEnvelopePhaseAliasPattern.test(scriptBasename);
}

function isResultEnvelopeRouteExtractionOnly(file) {
  if (file !== "services/openclaw-core/src/route-handlers.mjs") {
    return false;
  }

  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) return false;
  const currentText = fs.readFileSync(fullPath, "utf8");
  if (!currentText.includes("handleCloudLiveProviderResultEnvelopeGetRoute")) return false;

  const changedLines = readDiffChangedLines(file);
  if (!changedLines || changedLines.length === 0) return false;
  return changedLines.every(({ op, text }) => {
    if (op === "+") return isAllowedResultEnvelopeRouteExtractionAddition(text);
    if (op === "-") return isAllowedResultEnvelopeRouteExtractionRemoval(text);
    return false;
  });
}

function isCloudLiveProviderLateRuntimeCompositionExtraction(file) {
  if (file === "services/openclaw-core/src/cloud-live-provider-runtime-credential-local-read-late-builders.mjs") {
    return true;
  }
  if (file !== "services/openclaw-core/src/cloud-live-provider-runtime-implementation.mjs") {
    return false;
  }

  const changedLines = readDiffChangedLines(file);
  if (!changedLines || changedLines.length === 0) return false;
  const changedText = changedLines.map(({ text }) => text).join("\n");
  return changedText.includes("cloud-live-provider-runtime-credential-local-read-late-builders.mjs")
    && changedText.includes("credentialLocalReadLateBuilders");
}

function isCloudLiveProviderResultEnvelopeRuntimeLane(file) {
  return file.startsWith("services/openclaw-core/src/cloud-live-provider-runtime-credential-local-read-result-envelope")
    || file === "services/openclaw-core/src/cloud-live-provider-runtime-governance-local-read-b.mjs";
}

function isAllowedHttpJsonHelperExtractionAddition(text) {
  return text === ""
    || /^OPENCLAW_POST_JSON_FAILURE="(allow|fail-with-body)"$/.test(text)
    || /^OPENCLAW_POST_JSON_PAYLOAD_MODE="file"$/.test(text)
    || /^OPENCLAW_POST_JSON_DATA_FLAG="-d"$/.test(text)
    || text === "# shellcheck source=/dev/null"
    || text === 'source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"';
}

function isAllowedHttpJsonHelperExtractionRemoval(text) {
  return text === ""
    || text === "post_json() {"
    || /^  local (url|body|payload|file)="\$[12]"$/.test(text)
    || /^  curl --silent( --show-error)?( --fail| --fail-with-body)? -X POST "\$(url|1)" -H ['"]content-type: application\/json['"] (-(d)|--data) "\$(body|payload|2)"$/.test(text)
    || /^  curl --silent( --fail)? -H "content-type: application\/json" -d "\$payload" "\$url"$/.test(text)
    || /^  curl --silent( --fail)? -X POST "\$(url|1)" -H ['"]content-type: application\/json['"] --data-binary "@\$(file|2)"$/.test(text)
    || text === "}";
}

function isHttpJsonHelperExtractionOnly(file) {
  if (!file.startsWith("nix/scripts/") || path.basename(file) === "dev-openclaw-http-json-helper.sh") {
    return false;
  }

  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) return false;
  const currentText = fs.readFileSync(fullPath, "utf8");
  if (!currentText.includes("dev-openclaw-http-json-helper.sh")) return false;

  const changedLines = readDiffChangedLines(file);
  if (!changedLines || changedLines.length === 0) return false;
  return changedLines.every(({ op, text }) => {
    if (op === "+") return isAllowedHttpJsonHelperExtractionAddition(text);
    if (op === "-") return isAllowedHttpJsonHelperExtractionRemoval(text);
    return false;
  });
}

function isAllowedWaitHelperExtractionAddition(text) {
  return text === ""
    || text === "# shellcheck source=/dev/null"
    || text === 'source "$SCRIPT_DIR/dev-openclaw-wait-helper.sh"'
    || /^  openclaw_wait_for_http_down "\$url" 5 0\.2$/.test(text)
    || /^  openclaw_wait_interval 0\.[24]$/.test(text)
    || /^openclaw_wait_for_approval_summary_counts "\$CORE_URL" "\$SUMMARY_FILE" 1 0$/.test(text);
}

function isAllowedWaitHelperExtractionRemoval(text) {
  const sleepToken = "sl" + "eep";
  return text === ""
    || /^  local deadline=\$\(\(SECONDS \+ [0-9]+\)\)$/.test(text)
    || /^  while \(\( SECONDS < deadline \)\); do$/.test(text)
    || /^    if ! curl --silent --fail "\$url" >\/dev\/null 2>&1; then$/.test(text)
    || /^      return 0$/.test(text)
    || /^    fi$/.test(text)
    || new RegExp(`^    ${sleepToken} 0\\.[24]$`).test(text)
    || /^  done$/.test(text)
    || /^  return 1$/.test(text)
    || new RegExp(`^${sleepToken} 0\\.2$`).test(text)
    || new RegExp(`^  ${sleepToken} 0\\.[24]$`).test(text)
    || /^curl --silent --fail "\$CORE_URL\/approvals\/summary" > "\$SUMMARY_FILE"$/.test(text);
}

function isWaitHelperExtractionOnly(file) {
  if (!file.startsWith("nix/scripts/")) return false;
  const basename = path.basename(file);
  if (basename === "dev-up.sh" || basename === "dev-down.sh" || basename === "dev-openclaw-wait-helper.sh") {
    return false;
  }

  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) return false;
  const currentText = fs.readFileSync(fullPath, "utf8");
  if (!currentText.includes("dev-openclaw-wait-helper.sh") && !currentText.includes("openclaw_wait_")) return false;

  const changedLines = readDiffChangedLines(file);
  if (!changedLines || changedLines.length === 0) return false;
  return changedLines.every(({ op, text }) => {
    if (op === "+") return isAllowedWaitHelperExtractionAddition(text);
    if (op === "-") return isAllowedWaitHelperExtractionRemoval(text);
    return false;
  });
}

function selectPhasePlanChecks(file) {
  const match = /docs\/plans\/OPENCLAW_PHASE_(\d+)_PLAN\.md$/.exec(file);
  if (!match) return;

  const phaseNumber = match[1];
  const numericPhase = Number.parseInt(phaseNumber, 10);
  if (numericPhase >= 24 && numericPhase <= 57) {
    selectName(preCredentialPairManifestCheck);
  }
  if (numericPhase >= 73 && numericPhase <= 90) {
    selectName(credentialValueLocalReadManifestCheck);
  }
  if (numericPhase >= 91 && numericPhase <= 98) {
    selectName(credentialValueLocalReadAttemptManifestCheck);
  }
  if (numericPhase >= 99 && numericPhase <= 131) {
    selectName(resultEnvelopeManifestCheck);
    selectName("openclaw-live-provider-result-envelope-batch-reuse");
    return;
  }

  const phaseNameNeedle = `phase-${phaseNumber}`;
  const phaseDescriptionNeedle = `Phase ${phaseNumber}`;
  for (const entry of entries) {
    if (entry.name.includes(phaseNameNeedle) || entry.description.includes(phaseDescriptionNeedle)) {
      selected.add(entry.name);
    }
  }
}

function selectSourceHeuristics(file) {
  const direct = new Map([
    ["services/openclaw-core/src/policy-evaluator.mjs", ["openclaw-core-service-unit-tests", "policy"]],
    ["services/openclaw-core/src/task-executor.mjs", ["task-executor"]],
    ["services/openclaw-core/src/route-handlers.mjs", ["task-workbench", "operator-loop", "observer-operator"]],
    ["services/openclaw-core/src/cloud-live-provider-result-envelope-routes.mjs", ["openclaw-live-provider-result-envelope-batch-reuse"]],
    ["services/openclaw-core/src/server.mjs", ["task-workbench", "operator-loop", "persistence"]],
    ["services/openclaw-core/src/runtime-state.mjs", ["persistence", "operator-loop"]],
    ["services/openclaw-browser-runtime/src/server.mjs", ["state-settling", "openclaw-ai-work-view-capture"]],
    ["services/openclaw-screen-sense/src/server.mjs", ["state-settling", "openclaw-ai-work-view-capture"]],
    ["services/openclaw-screen-act/src/server.mjs", ["task-executor"]],
    ["services/openclaw-session-manager/src/server.mjs", ["state-settling"]],
    ["services/openclaw-system-sense/src/server.mjs", ["system-sense"]],
    ["services/openclaw-system-heal/src/server.mjs", ["system-heal"]],
    ["apps/observer-ui/src/server.mjs", ["observer-operator"]],
    ["apps/observer-ui/src/client-script.mjs", ["observer-operator"]],
  ]);

  for (const [prefix, names] of direct.entries()) {
    if (file === prefix || file.startsWith(`${prefix.replace(/\.mjs$/, "")}-`)) {
      for (const name of names) selectName(name);
    }
  }

  if (file === "services/openclaw-core/package.json" || file.startsWith("services/openclaw-core/test/")) {
    selectName("openclaw-core-service-unit-tests");
  }

  if (file.startsWith("services/openclaw-core/src/cloud-live-provider-runtime")) {
    if (isCloudLiveProviderResultEnvelopeRuntimeLane(file)) {
      selectName("openclaw-core-service-unit-tests");
      selectName(resultEnvelopeManifestCheck);
      selectName("openclaw-live-provider-result-envelope-batch-reuse");
      return;
    }
    if (isCloudLiveProviderLateRuntimeCompositionExtraction(file)) {
      selectName("openclaw-core-service-unit-tests");
      selectName(credentialValueLocalReadAttemptManifestCheck);
      selectName(resultEnvelopeManifestCheck);
      selectName("openclaw-live-provider-credential-value-local-read-attempt-batch-reuse");
      selectName("openclaw-live-provider-result-envelope-batch-reuse");
      return;
    }
    for (const entry of entries) {
      if (entry.name.includes("cloud-consciousness-live-provider")) {
        selected.add(entry.name);
      }
    }
  }
}

for (const file of changedFiles) {
  if (isHttpJsonHelperExtractionOnly(file)) {
    selectName("milestone-script-audit");
    selectName(httpJsonHelperCheck);
    selectName("task-workbench");
    continue;
  }

  if (isWaitHelperExtractionOnly(file)) {
    selectName("milestone-script-audit");
    selectName(waitHelperCheck);
    if (file === "nix/scripts/dev-state-settling-check.sh") {
      selectName("state-settling");
    } else if (file === "nix/scripts/dev-openclaw-ai-work-view-capture-check.sh") {
      selectName("openclaw-ai-work-view-capture");
    } else if (file.includes("-hardening-check.sh")) {
      selectName("openclaw-workspace-command-hardening");
    }
    continue;
  }

  if (isResultEnvelopeRouteExtractionOnly(file)) {
    selectName("openclaw-live-provider-result-envelope-batch-reuse");
    continue;
  }

  if (file === "nix/scripts/dev-milestone-check.sh"
    || file === "nix/scripts/dev-milestone-checks.tsv"
    || file === "nix/scripts/dev-milestone-expanded-registry.sh"
    || file === "nix/scripts/dev-milestone-registry-expansion.sh"
    || file === "nix/scripts/dev-milestone-registry-check.sh"
    || file === "nix/scripts/dev-milestone-script-audit-check.sh"
    || file === "nix/scripts/dev-milestone-select-changed-checks.sh") {
    selectName("milestone-registry");
    selectName("milestone-script-audit");
    selectName(preCredentialPairManifestCheck);
    selectName(credentialValueLocalReadManifestCheck);
    selectName(credentialValueLocalReadAttemptManifestCheck);
    selectName(resultEnvelopeManifestCheck);
    continue;
  }

  if (file === "package.json"
    || file === "tsconfig.base.json"
    || file === "flake.nix"
    || file.startsWith("packages/shared-types/")
    || file.startsWith("packages/shared-events/")
    || file.startsWith("packages/shared-client/")
    || file.startsWith("packages/shared-utils/")
    || file.startsWith("packages/plugin-runtime/")) {
    selectName("milestone-registry");
    selectName(sharedPackageContractsCheck);
    continue;
  }

  if (file.startsWith("nix/scripts/")) {
    const scriptBasename = path.basename(file);
    selectName("milestone-script-audit");
    if (scriptBasename === "dev-openclaw-http-json-helper.sh"
      || scriptBasename === "dev-openclaw-http-json-helper-check.sh") {
      selectName(httpJsonHelperCheck);
      selectName("task-workbench");
      continue;
    }
    if (scriptBasename === "dev-openclaw-wait-helper.sh"
      || scriptBasename === "dev-openclaw-wait-helper-check.sh") {
      selectName(waitHelperCheck);
      selectName("openclaw-service-lifecycle-scope");
      continue;
    }
    if (scriptBasename === "dev-openclaw-fast-prereq-state.sh"
      || scriptBasename === "dev-openclaw-phase4-prereq-state.sh"
      || scriptBasename === "dev-openclaw-phase4-fast-prereq-state-check.sh") {
      selectName("openclaw-phase4-fast-prereq-state");
      selectName("openclaw-live-provider-result-envelope-batch-reuse");
      continue;
    }
    if (isBodyEvidenceFastPrereqScript(scriptBasename)) {
      selectName("openclaw-body-evidence-fast-prereq-state");
      continue;
    }
    if (scriptBasename === "dev-up.sh" || scriptBasename === "dev-down.sh") {
      selectName("openclaw-service-lifecycle-scope");
      selectName(preCredentialPairBatchCheck);
      selectName("openclaw-live-provider-result-envelope-batch-reuse");
      continue;
    }
    if (preCredentialPairHelperScripts.has(scriptBasename)
      || scriptBasename === "dev-openclaw-core-observer-pair-runner.sh") {
      selectName(preCredentialPairManifestCheck);
      if (scriptBasename === "dev-openclaw-live-provider-pre-credential-pair-milestone-manifest-check.sh"
        || scriptBasename === "dev-openclaw-live-provider-pre-credential-pair-batch-reuse-check.sh"
        || scriptBasename === "dev-openclaw-live-provider-pre-credential-pair-batch-diagnostics-check.sh") {
        selectName(preCredentialPairBatchDiagnosticsCheck);
      } else {
        selectName(preCredentialPairBatchCheck);
      }
      continue;
    }
    if (preCredentialPairWrapperScripts.has(scriptBasename)) {
      selectName(preCredentialPairManifestCheck);
      if (byScript.has(scriptBasename)) {
        selected.add(byScript.get(scriptBasename).name);
      }
      continue;
    }
    if (preCredentialPairCommonScripts.has(scriptBasename)) {
      selectName(preCredentialPairManifestCheck);
      selectPreCredentialPairRowsForCommon(scriptBasename);
      continue;
    }
    if (credentialValueLocalReadHelperScripts.has(scriptBasename)
      || credentialValueLocalReadCommonScripts.has(scriptBasename)) {
      selectName(credentialValueLocalReadManifestCheck);
      if (scriptBasename === "dev-openclaw-live-provider-credential-value-local-read-batch-reuse-check.sh"
        || scriptBasename === "dev-openclaw-live-provider-credential-value-local-read-prereq.sh") {
        selectName("openclaw-live-provider-credential-value-local-read-batch-reuse");
      }
    }
    if (credentialValueLocalReadHelperScripts.has(scriptBasename)) {
      continue;
    }
    if (credentialValueLocalReadCommonScripts.has(scriptBasename)) {
      if (isCredentialValueLocalReadCommonPrereqExtractionOnly(file, scriptBasename)) {
        structurallyCoveredCommonChecks.push(file);
        continue;
      }
      const coreName = scriptBasename.replace(/^dev-/, "").replace(/-common-check\.sh$/, "");
      selectName(coreName);
      selectName(`observer-${coreName}`);
      continue;
    }
    if (credentialValueLocalReadAttemptHelperScripts.has(scriptBasename)
      || credentialValueLocalReadAttemptCommonScripts.has(scriptBasename)) {
      selectName(credentialValueLocalReadAttemptManifestCheck);
      if (scriptBasename === "dev-openclaw-live-provider-credential-value-local-read-attempt-batch-reuse-check.sh"
        || scriptBasename === "dev-openclaw-live-provider-credential-value-local-read-attempt-prereq.sh") {
        selectName("openclaw-live-provider-credential-value-local-read-attempt-batch-reuse");
      }
    }
    if (credentialValueLocalReadAttemptHelperScripts.has(scriptBasename)) {
      continue;
    }
    if (credentialValueLocalReadAttemptCommonScripts.has(scriptBasename)) {
      if (isCredentialValueLocalReadAttemptCommonPrereqExtractionOnly(file, scriptBasename)) {
        structurallyCoveredCommonChecks.push(file);
        continue;
      }
      const coreName = scriptBasename.replace(/^dev-/, "").replace(/-common-check\.sh$/, "");
      selectName(coreName);
      selectName(`observer-${coreName}`);
      continue;
    }
    if (scriptBasename === "openclaw-live-provider-result-envelope-milestones.tsv"
      || scriptBasename === "dev-openclaw-live-provider-result-envelope-common-env.sh"
      || scriptBasename === "dev-openclaw-live-provider-result-envelope-prereq.sh"
      || scriptBasename === resultEnvelopeAssertionsHelper
      || scriptBasename === "dev-openclaw-live-provider-result-envelope-wrapper.sh"
      || isResultEnvelopeMilestoneScript(scriptBasename)) {
      selectName(resultEnvelopeManifestCheck);
      if (scriptBasename === "dev-openclaw-live-provider-result-envelope-prereq.sh"
        || scriptBasename === resultEnvelopeAssertionsHelper) {
        selectName("openclaw-live-provider-result-envelope-batch-reuse");
      }
    }
    if (scriptBasename === "openclaw-live-provider-result-envelope-milestones.tsv"
      || scriptBasename === "dev-openclaw-live-provider-result-envelope-common-env.sh"
      || scriptBasename === "dev-openclaw-live-provider-result-envelope-prereq.sh"
      || scriptBasename === resultEnvelopeAssertionsHelper
      || scriptBasename === "dev-openclaw-live-provider-result-envelope-wrapper.sh") {
      continue;
    }
    if (isResultEnvelopeMilestoneScript(scriptBasename)) {
      if (scriptBasename.endsWith("-batch-check.sh") && byScript.has(scriptBasename)) {
        selected.add(byScript.get(scriptBasename).name);
        continue;
      }
      if (scriptBasename.endsWith("-common-check.sh")) {
        if (isResultEnvelopeCommonEnvExtractionOnly(file, scriptBasename)) {
          structurallyCoveredCommonChecks.push(file);
          continue;
        }
        if (isResultEnvelopeCommonPrereqExtractionOnly(file, scriptBasename)) {
          structurallyCoveredCommonChecks.push(file);
          continue;
        }
        selectName("openclaw-live-provider-result-envelope-batch-reuse");
      }
      continue;
    }
    if (byScript.has(scriptBasename)) {
      selected.add(byScript.get(scriptBasename).name);
    }
    selectScriptsReferencing(scriptBasename);
    continue;
  }

  selectPhasePlanChecks(file);
  selectSourceHeuristics(file);
}

if (selected.size === 0) {
  console.error(JSON.stringify({
    status: "no-affected-checks-inferred",
    changedFiles,
    hint: "Set OPENCLAW_MILESTONE_CHECKS explicitly, or run without @changed for the full registry.",
  }, null, 2));
  process.exit(2);
}

const ordered = entries.map((entry) => entry.name).filter((name) => selected.has(name));
console.error(JSON.stringify({ affectedChecks: ordered, changedFiles, structurallyCoveredCommonChecks }, null, 2));
process.stdout.write(ordered.join(","));
NODE

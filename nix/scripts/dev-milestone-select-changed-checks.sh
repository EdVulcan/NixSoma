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
const structurallyCoveredCommonChecks = [];
const resultEnvelopeManifestCheck = "openclaw-live-provider-result-envelope-milestone-manifest";
const resultEnvelopeScriptNeedle = "credential-value-local-read-execution-local-read-attempt-local-read-result-envelope";
const resultEnvelopeCommonEnvHelper = "dev-openclaw-live-provider-result-envelope-common-env.sh";
const resultEnvelopePrereqHelper = "dev-openclaw-live-provider-result-envelope-prereq.sh";

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

function isResultEnvelopeCommonEnvExtractionOnly(file, scriptBasename) {
  if (!scriptBasename.includes(resultEnvelopeScriptNeedle) || !scriptBasename.endsWith("-common-check.sh")) {
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
  if (!scriptBasename.includes(resultEnvelopeScriptNeedle) || !scriptBasename.endsWith("-common-check.sh")) {
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

function selectPhasePlanChecks(file) {
  const match = /docs\/plans\/OPENCLAW_PHASE_(\d+)_PLAN\.md$/.exec(file);
  if (!match) return;

  const phaseNumber = match[1];
  const numericPhase = Number.parseInt(phaseNumber, 10);
  if (numericPhase >= 99 && numericPhase <= 116) {
    selectName(resultEnvelopeManifestCheck);
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
    ["services/openclaw-core/src/task-executor.mjs", ["task-executor"]],
    ["services/openclaw-core/src/route-handlers.mjs", ["task-workbench", "operator-loop", "observer-operator"]],
    ["services/openclaw-core/src/server.mjs", ["task-workbench", "operator-loop", "persistence"]],
    ["services/openclaw-core/src/runtime-state.mjs", ["persistence", "operator-loop"]],
    ["apps/observer-ui/src/server.mjs", ["observer-operator"]],
    ["apps/observer-ui/src/client-script.mjs", ["observer-operator"]],
  ]);

  for (const [prefix, names] of direct.entries()) {
    if (file === prefix || file.startsWith(`${prefix.replace(/\.mjs$/, "")}-`)) {
      for (const name of names) selectName(name);
    }
  }

  if (file.startsWith("services/openclaw-core/src/cloud-live-provider-runtime")) {
    for (const entry of entries) {
      if (entry.name.includes("cloud-consciousness-live-provider")) {
        selected.add(entry.name);
      }
    }
  }
}

for (const file of changedFiles) {
  if (file === "nix/scripts/dev-milestone-check.sh"
    || file === "nix/scripts/dev-milestone-checks.tsv"
    || file === "nix/scripts/dev-milestone-expanded-registry.sh"
    || file === "nix/scripts/dev-milestone-registry-expansion.sh"
    || file === "nix/scripts/dev-milestone-registry-check.sh"
    || file === "nix/scripts/dev-milestone-script-audit-check.sh"
    || file === "nix/scripts/dev-milestone-select-changed-checks.sh") {
    selectName("milestone-registry");
    selectName("milestone-script-audit");
    selectName(resultEnvelopeManifestCheck);
    continue;
  }

  if (file.startsWith("nix/scripts/")) {
    const scriptBasename = path.basename(file);
    selectName("milestone-script-audit");
    if (scriptBasename === "dev-up.sh" || scriptBasename === "dev-down.sh") {
      selectName("openclaw-service-lifecycle-scope");
      continue;
    }
    if (scriptBasename === "openclaw-live-provider-result-envelope-milestones.tsv"
      || scriptBasename === "dev-openclaw-live-provider-result-envelope-common-env.sh"
      || scriptBasename === "dev-openclaw-live-provider-result-envelope-prereq.sh"
      || scriptBasename === "dev-openclaw-live-provider-result-envelope-wrapper.sh"
      || scriptBasename.includes(resultEnvelopeScriptNeedle)) {
      selectName(resultEnvelopeManifestCheck);
    }
    if (scriptBasename === "openclaw-live-provider-result-envelope-milestones.tsv"
      || scriptBasename === "dev-openclaw-live-provider-result-envelope-common-env.sh"
      || scriptBasename === "dev-openclaw-live-provider-result-envelope-prereq.sh"
      || scriptBasename === "dev-openclaw-live-provider-result-envelope-wrapper.sh") {
      continue;
    }
    if (scriptBasename.includes(resultEnvelopeScriptNeedle)) {
      if (scriptBasename.endsWith("-common-check.sh")) {
        if (isResultEnvelopeCommonEnvExtractionOnly(file, scriptBasename)) {
          structurallyCoveredCommonChecks.push(file);
          continue;
        }
        if (isResultEnvelopeCommonPrereqExtractionOnly(file, scriptBasename)) {
          structurallyCoveredCommonChecks.push(file);
          continue;
        }
        const coreName = scriptBasename.replace(/^dev-/, "").replace(/-common-check\.sh$/, "");
        selectName(coreName);
        selectName(`observer-${coreName}`);
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

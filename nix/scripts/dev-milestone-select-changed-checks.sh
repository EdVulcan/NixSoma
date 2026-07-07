#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REGISTRY_FILE="${OPENCLAW_MILESTONE_CHECKS_FILE:-$SCRIPT_DIR/dev-milestone-checks.tsv}"
BASE="${OPENCLAW_MILESTONE_CHANGED_BASE:-}"

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

const [scriptDir, registryFile] = process.argv.slice(2);
const changedFiles = (process.env.CHANGED_FILES ?? "").split(/\n/).map((line) => line.trim()).filter(Boolean);
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

function selectPhasePlanChecks(file) {
  const match = /docs\/plans\/OPENCLAW_PHASE_(\d+)_PLAN\.md$/.exec(file);
  if (!match) return;

  const phaseNumber = match[1];
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
    || file === "nix/scripts/dev-milestone-registry-check.sh"
    || file === "nix/scripts/dev-milestone-select-changed-checks.sh") {
    selectName("milestone-registry");
    continue;
  }

  if (file.startsWith("nix/scripts/")) {
    const scriptBasename = path.basename(file);
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
console.error(JSON.stringify({ affectedChecks: ordered, changedFiles }, null, 2));
process.stdout.write(ordered.join(","));
NODE

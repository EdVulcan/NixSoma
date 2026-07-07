#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REGISTRY_SOURCE_FILE="${OPENCLAW_MILESTONE_CHECKS_FILE:-$SCRIPT_DIR/dev-milestone-checks.tsv}"
REGISTRY_FILE="$REGISTRY_SOURCE_FILE"
ARTIFACT_DIR="$REPO_ROOT/.artifacts/milestone-script-audit"
SUMMARY_FILE="$ARTIFACT_DIR/summary.json"
LONG_FILENAME_WARNING="${OPENCLAW_MILESTONE_SCRIPT_LONG_FILENAME_WARNING:-180}"
HARD_FILENAME_LIMIT="${OPENCLAW_MILESTONE_SCRIPT_HARD_FILENAME_LIMIT:-240}"

mkdir -p "$ARTIFACT_DIR"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-milestone-registry-expansion.sh"
openclaw_milestone_prepare_expanded_registry "$SCRIPT_DIR" "$REGISTRY_SOURCE_FILE" REGISTRY_FILE
trap openclaw_milestone_cleanup_expanded_registry EXIT

node - "$SCRIPT_DIR" "$REGISTRY_FILE" "$SUMMARY_FILE" "$LONG_FILENAME_WARNING" "$HARD_FILENAME_LIMIT" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [scriptDir, registryFile, summaryFile, longWarningRaw, hardLimitRaw] = process.argv.slice(2);
const longFilenameWarning = Number.parseInt(longWarningRaw, 10);
const hardFilenameLimit = Number.parseInt(hardLimitRaw, 10);

function readRegistryEntries() {
  const text = fs.readFileSync(registryFile, "utf8").replace(/^\uFEFF/, "");
  const entries = [];
  const issues = [];

  for (const [index, rawLine] of text.split(/\n/).entries()) {
    const lineNumber = index + 1;
    const line = rawLine.replace(/\r$/, "");
    if (!line.trim() || line.startsWith("#")) continue;

    const columns = line.split("\t");
    if (columns.length !== 3) {
      issues.push({ lineNumber, issue: "expected three tab-separated columns" });
      continue;
    }

    const [name, script, description] = columns;
    entries.push({ lineNumber, name, script, description });
  }

  return { entries, issues };
}

function topByNameLength(names, limit = 25) {
  return [...names]
    .sort((left, right) => right.length - left.length || left.localeCompare(right))
    .slice(0, limit)
    .map((name) => ({ script: name, length: name.length }));
}

const { entries, issues } = readRegistryEntries();
const registryScripts = new Set(entries.map((entry) => entry.script));
const registryNamesByScript = new Map(entries.map((entry) => [entry.script, entry.name]));
const files = fs.readdirSync(scriptDir)
  .filter((file) => fs.statSync(path.join(scriptDir, file)).isFile());
const shellScripts = files.filter((file) => file.endsWith(".sh"));
const checkScripts = shellScripts.filter((file) => /^dev-.*-check\.sh$/.test(file));
const commonCheckScripts = shellScripts.filter((file) => file.endsWith("common-check.sh"));
const observerCheckScripts = shellScripts.filter((file) => file.startsWith("dev-observer-") && file.endsWith("-check.sh"));
const registeredMissingScripts = entries
  .filter((entry) => !fs.existsSync(path.join(scriptDir, entry.script)))
  .map((entry) => ({ name: entry.name, script: entry.script, lineNumber: entry.lineNumber }));
const registeredCheckScripts = checkScripts.filter((file) => registryScripts.has(file));
const unregisteredNonCommonCheckScripts = checkScripts
  .filter((file) => !registryScripts.has(file) && !file.endsWith("common-check.sh"))
  .sort();
const longFilenameScripts = shellScripts
  .filter((file) => file.length >= longFilenameWarning)
  .sort((left, right) => right.length - left.length || left.localeCompare(right))
  .map((script) => ({
    script,
    length: script.length,
    registered: registryScripts.has(script),
    checkName: registryNamesByScript.get(script) ?? null,
  }));
const hardLimitScripts = shellScripts
  .filter((file) => file.length >= hardFilenameLimit)
  .sort((left, right) => right.length - left.length || left.localeCompare(right))
  .map((script) => ({ script, length: script.length }));

if (!Number.isFinite(longFilenameWarning) || longFilenameWarning <= 0) {
  issues.push({ issue: "invalid long filename warning threshold", value: longWarningRaw });
}
if (!Number.isFinite(hardFilenameLimit) || hardFilenameLimit <= 0) {
  issues.push({ issue: "invalid hard filename limit threshold", value: hardLimitRaw });
}
if (registeredMissingScripts.length > 0) {
  issues.push({ issue: "registered scripts missing", scripts: registeredMissingScripts });
}
if (hardLimitScripts.length > 0) {
  issues.push({
    issue: "script filenames at or above hard length limit",
    hardFilenameLimit,
    scripts: hardLimitScripts,
  });
}

const summary = {
  milestoneScriptAudit: {
    status: issues.length === 0 ? "passed" : "failed",
    registryFile,
    scriptDir,
    thresholds: {
      longFilenameWarning,
      hardFilenameLimit,
    },
    counts: {
      files: files.length,
      shellScripts: shellScripts.length,
      checkScripts: checkScripts.length,
      commonCheckScripts: commonCheckScripts.length,
      observerCheckScripts: observerCheckScripts.length,
      registryEntries: entries.length,
      registeredCheckScripts: registeredCheckScripts.length,
      unregisteredNonCommonCheckScripts: unregisteredNonCommonCheckScripts.length,
      longFilenameScripts: longFilenameScripts.length,
      hardLimitScripts: hardLimitScripts.length,
    },
    longestFilenames: topByNameLength(shellScripts),
    longFilenameScripts: longFilenameScripts.slice(0, 50),
    unregisteredNonCommonCheckScripts,
    warnings: [
      ...(longFilenameScripts.length > 0 ? [{
        type: "long-filename-pressure",
        threshold: longFilenameWarning,
        count: longFilenameScripts.length,
      }] : []),
      ...(unregisteredNonCommonCheckScripts.length > 0 ? [{
        type: "unregistered-non-common-check-scripts",
        count: unregisteredNonCommonCheckScripts.length,
      }] : []),
    ],
    issues,
    nextRecommendedSlice: "Use the Phase 99-116 live-provider manifest to extract repeated assertion helpers before renaming or deleting legacy scripts.",
  },
};

fs.writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));

if (issues.length > 0) {
  process.exit(1);
}
NODE

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REGISTRY_SOURCE_FILE="${OPENCLAW_MILESTONE_CHECKS_FILE:-$SCRIPT_DIR/dev-milestone-checks.tsv}"
REGISTRY_FILE="$REGISTRY_SOURCE_FILE"
MANIFEST_FILE="${OPENCLAW_LIVE_PROVIDER_PRE_CREDENTIAL_PAIR_MILESTONES_FILE:-$SCRIPT_DIR/openclaw-live-provider-pre-credential-pair-milestones.tsv}"
ARTIFACT_DIR="$REPO_ROOT/.artifacts/live-provider-pre-credential-pair-milestone-manifest"
SUMMARY_FILE="$ARTIFACT_DIR/summary.json"

mkdir -p "$ARTIFACT_DIR"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-milestone-registry-expansion.sh"
openclaw_milestone_prepare_expanded_registry "$SCRIPT_DIR" "$REGISTRY_SOURCE_FILE" REGISTRY_FILE
trap openclaw_milestone_cleanup_expanded_registry EXIT

node - "$SCRIPT_DIR" "$REGISTRY_FILE" "$REGISTRY_SOURCE_FILE" "$MANIFEST_FILE" "$SUMMARY_FILE" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [scriptDir, registryFile, registrySourceFile, manifestFile, summaryFile] = process.argv.slice(2);
const issues = [];

function readTsv(file, columns, label) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  for (const [index, rawLine] of text.split(/\n/).entries()) {
    const lineNumber = index + 1;
    const line = rawLine.replace(/\r$/, "");
    if (!line.trim() || line.startsWith("#")) continue;
    const parts = line.split("\t");
    if (parts.length !== columns.length) {
      issues.push({ file, lineNumber, issue: `${label} row expected ${columns.length} tab-separated columns`, actualColumns: parts.length });
      continue;
    }
    rows.push(Object.fromEntries(columns.map((column, columnIndex) => [column, parts[columnIndex]]).concat([["lineNumber", lineNumber]])));
  }
  return rows;
}

function readIfExists(file, label) {
  if (!fs.existsSync(file)) {
    issues.push({ file, issue: `${label} missing` });
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function requireContains(text, token, context) {
  if (!text.includes(token)) {
    issues.push({ ...context, issue: "missing token", token });
  }
}

const registryEntries = readTsv(registryFile, ["name", "script", "description"], "registry");
const registryByName = new Map(registryEntries.map((entry) => [entry.name, entry]));
const registrySource = readIfExists(registrySourceFile, "source registry");
const batchScript = readIfExists(path.join(scriptDir, "dev-openclaw-live-provider-pre-credential-pair-batch-reuse-check.sh"), "pre-credential pair batch script");
const rows = readTsv(manifestFile, [
  "label",
  "phase",
  "publicCheck",
  "observerCheck",
  "commonScript",
  "portVar",
  "observerVar",
  "extraEnv",
  "group",
], "manifest");

if (rows.length !== 35) {
  issues.push({ file: manifestFile, issue: "expected 35 Phase 24-57 pre-credential pair rows", count: rows.length });
}
if (rows[0]?.label !== "phase24" || rows.at(-1)?.label !== "phase57") {
  issues.push({ file: manifestFile, issue: "unexpected first or last manifest row", first: rows[0]?.label, last: rows.at(-1)?.label });
}

requireContains(registrySource, "openclaw-live-provider-pre-credential-pair-milestone-manifest", { file: registrySourceFile });
requireContains(registrySource, "openclaw-live-provider-pre-credential-pair-batch-reuse", { file: registrySourceFile });
requireContains(batchScript, "openclaw-live-provider-pre-credential-pair-milestones.tsv", { file: "dev-openclaw-live-provider-pre-credential-pair-batch-reuse-check.sh" });
requireContains(batchScript, "OPENCLAW_DEV_SERVICES_ALREADY_UP", { file: "dev-openclaw-live-provider-pre-credential-pair-batch-reuse-check.sh" });
requireContains(batchScript, "OPENCLAW_CORE_STATE_FILE", { file: "dev-openclaw-live-provider-pre-credential-pair-batch-reuse-check.sh" });
requireContains(batchScript, "PAIR_GROUPS", { file: "dev-openclaw-live-provider-pre-credential-pair-batch-reuse-check.sh" });
requireContains(batchScript, "groupCount", { file: "dev-openclaw-live-provider-pre-credential-pair-batch-reuse-check.sh" });
requireContains(batchScript, "openclawLiveProviderPreCredentialPairBatchReuse", { file: "dev-openclaw-live-provider-pre-credential-pair-batch-reuse-check.sh" });

const groups = new Set();
for (const row of rows) {
  const phaseNumber = Number.parseInt(row.phase, 10);
  if (!Number.isInteger(phaseNumber) || phaseNumber < 24 || phaseNumber > 57) {
    issues.push({ lineNumber: row.lineNumber, issue: "phase outside 24-57 pre-credential range", phase: row.phase });
  }
  if (!row.observerCheck.startsWith("observer-")) {
    issues.push({ lineNumber: row.lineNumber, issue: "observer check name must use observer prefix", observerCheck: row.observerCheck });
  }
  if (!/^[a-z0-9-]+$/.test(row.group)) {
    issues.push({ lineNumber: row.lineNumber, issue: "group must be a stable lowercase token", group: row.group });
  }
  groups.add(row.group);
  if (row.publicCheck === row.observerCheck) {
    issues.push({ lineNumber: row.lineNumber, issue: "public and observer check names must be distinct", publicCheck: row.publicCheck });
  }

  const publicRegistry = registryByName.get(row.publicCheck);
  const observerRegistry = registryByName.get(row.observerCheck);
  if (!publicRegistry) {
    issues.push({ lineNumber: row.lineNumber, issue: "public registry row missing", name: row.publicCheck });
  }
  if (!observerRegistry) {
    issues.push({ lineNumber: row.lineNumber, issue: "observer registry row missing", name: row.observerCheck });
  }

  const publicWrapperPath = publicRegistry ? path.join(scriptDir, publicRegistry.script) : "";
  const observerWrapperPath = observerRegistry ? path.join(scriptDir, observerRegistry.script) : "";
  const commonPath = path.join(scriptDir, row.commonScript);
  const publicWrapper = publicWrapperPath ? readIfExists(publicWrapperPath, "public wrapper") : "";
  const observerWrapper = observerWrapperPath ? readIfExists(observerWrapperPath, "observer wrapper") : "";
  const commonScript = readIfExists(commonPath, "common check");

  requireContains(publicWrapper, row.commonScript, { lineNumber: row.lineNumber, file: publicWrapperPath });
  requireContains(observerWrapper, row.commonScript, { lineNumber: row.lineNumber, file: observerWrapperPath });
  requireContains(publicWrapper, row.portVar, { lineNumber: row.lineNumber, file: publicWrapperPath });
  requireContains(observerWrapper, row.portVar, { lineNumber: row.lineNumber, file: observerWrapperPath });
  requireContains(observerWrapper, `${row.observerVar}=true`, { lineNumber: row.lineNumber, file: observerWrapperPath });
  requireContains(commonScript, row.portVar, { lineNumber: row.lineNumber, file: commonPath });
  requireContains(commonScript, row.observerVar, { lineNumber: row.lineNumber, file: commonPath });
  requireContains(commonScript, "dev-down.sh", { lineNumber: row.lineNumber, file: commonPath });
  requireContains(commonScript, "dev-up.sh", { lineNumber: row.lineNumber, file: commonPath });

  if (row.extraEnv !== "-") {
    for (const entry of row.extraEnv.split(",")) {
      requireContains(publicWrapper, entry, { lineNumber: row.lineNumber, file: publicWrapperPath });
      requireContains(observerWrapper, entry, { lineNumber: row.lineNumber, file: observerWrapperPath });
      const [name] = entry.split("=");
      requireContains(commonScript, name, { lineNumber: row.lineNumber, file: commonPath });
    }
  }
}

if (groups.size !== 9) {
  issues.push({ file: manifestFile, issue: "expected 9 adjacent pre-credential lifecycle groups", groupCount: groups.size, groups: [...groups] });
}

const summary = {
  openclawLiveProviderPreCredentialPairMilestoneManifest: {
    status: issues.length === 0 ? "passed" : "failed",
    rowCount: rows.length,
    phaseRange: "24-57",
    publicChecks: rows.map((row) => row.publicCheck),
    observerChecks: rows.map((row) => row.observerCheck),
    issues,
  },
};
fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (issues.length > 0) {
  process.exit(1);
}
NODE

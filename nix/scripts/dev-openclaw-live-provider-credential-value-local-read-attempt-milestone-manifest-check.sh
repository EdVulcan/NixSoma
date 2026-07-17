#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REGISTRY_SOURCE_FILE="${OPENCLAW_MILESTONE_CHECKS_FILE:-$SCRIPT_DIR/dev-milestone-checks.tsv}"
REGISTRY_FILE="$REGISTRY_SOURCE_FILE"
MANIFEST_FILE="${OPENCLAW_LIVE_PROVIDER_CREDENTIAL_VALUE_LOCAL_READ_ATTEMPT_MILESTONES_FILE:-$SCRIPT_DIR/openclaw-live-provider-credential-value-local-read-attempt-milestones.tsv}"
ARTIFACT_DIR="$REPO_ROOT/.artifacts/live-provider-credential-value-local-read-attempt-milestone-manifest"
SUMMARY_FILE="$ARTIFACT_DIR/summary.json"

mkdir -p "$ARTIFACT_DIR"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-milestone-registry-expansion.sh"
openclaw_milestone_prepare_expanded_registry "$SCRIPT_DIR" "$REGISTRY_SOURCE_FILE" REGISTRY_FILE
trap openclaw_milestone_cleanup_expanded_registry EXIT

node - "$SCRIPT_DIR" "$REPO_ROOT" "$REGISTRY_FILE" "$REGISTRY_SOURCE_FILE" "$MANIFEST_FILE" "$SUMMARY_FILE" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const [scriptDir, repoRoot, registryFile, registrySourceFile, manifestFile, summaryFile] = process.argv.slice(2);
const issues = [];

function readTsv(file, columns, label) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const entries = [];
  for (const [index, rawLine] of text.split(/\n/).entries()) {
    const lineNumber = index + 1;
    const line = rawLine.replace(/\r$/, "");
    if (!line.trim() || line.startsWith("#")) continue;
    const parts = line.split("\t");
    if (parts.length !== columns.length) {
      issues.push({ file, lineNumber, issue: `${label} row expected ${columns.length} tab-separated columns`, actualColumns: parts.length });
      continue;
    }
    entries.push(Object.fromEntries(columns.map((column, columnIndex) => [column, parts[columnIndex]]).concat([["lineNumber", lineNumber]])));
  }
  return entries;
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

function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function artifactSuffixForSlug(slug) {
  return slug.replace(/^openclaw-cloud-consciousness-live-provider-/, "");
}

const relativePathLimit = 160;

function physicalScriptsForMilestone(milestone) {
  const legacy = {
    core: `dev-${milestone.slug}-check.sh`,
    observer: `dev-observer-${milestone.slug}-check.sh`,
    common: `dev-${milestone.slug}-common-check.sh`,
  };
  if (Object.values(legacy).some((script) => `nix/scripts/${script}`.length >= relativePathLimit)) {
    return {
      core: `dev-p${milestone.phase}-core-check.sh`,
      observer: `dev-p${milestone.phase}-observer-check.sh`,
      common: `dev-p${milestone.phase}-common-check.sh`,
    };
  }
  return legacy;
}

function readCommonEnvForMilestone(milestone, commonEnvHelperPath) {
  try {
    const command = [
      "set -euo pipefail",
      `SCRIPT_DIR=${shellQuote(scriptDir)}`,
      `source ${shellQuote(commonEnvHelperPath)} ${milestone.phase}`,
      "printf '%s\\n' \"$PLAN_DOC\" \"$OPENCLAW_CORE_STATE_FILE\" \"$OPENCLAW_SYSTEM_HEAL_STATE_FILE\" \"$PORT_BASE\" \"$OBSERVER_CHECK\" \"$OPENCLAW_CREDENTIAL_VALUE_LOCAL_READ_ATTEMPT_SLUG\" \"$OPENCLAW_CREDENTIAL_VALUE_LOCAL_READ_ATTEMPT_PREDECESSOR_PHASE\" \"$OPENCLAW_CREDENTIAL_VALUE_LOCAL_READ_ATTEMPT_PREDECESSOR_SLUG\" \"$OPENCLAW_CREDENTIAL_VALUE_LOCAL_READ_ATTEMPT_NEXT_SLUG\" \"$OPENCLAW_CREDENTIAL_VALUE_LOCAL_READ_ATTEMPT_FAST_SOURCE_PHASE\" \"$OPENCLAW_CREDENTIAL_VALUE_LOCAL_READ_ATTEMPT_FAST_SOURCE_SLUG\" \"$OPENCLAW_CREDENTIAL_VALUE_LOCAL_READ_ATTEMPT_PREREQ_REGISTRY\" \"$OPENCLAW_CREDENTIAL_VALUE_LOCAL_READ_ATTEMPT_PREREQ_MARKER\"",
    ].join("; ");
    const env = {
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      HOME: process.env.HOME ?? "",
    };
    const [
      planDoc,
      coreStateFile,
      systemHealStateFile,
      portBase,
      observerCheck,
      slug,
      predecessorPhase,
      predecessorSlug,
      nextSlug,
      fastSourcePhase,
      fastSourceSlug,
      prereqRegistry,
      prereqMarker,
    ] = execFileSync("bash", ["-c", command], { encoding: "utf8", env }).trimEnd().split("\n");
    return { planDoc, coreStateFile, systemHealStateFile, portBase, observerCheck, slug, predecessorPhase, predecessorSlug, nextSlug, fastSourcePhase, fastSourceSlug, prereqRegistry, prereqMarker };
  } catch (error) {
    issues.push({
      phase: milestone.phase,
      file: commonEnvHelperPath,
      issue: "common env helper execution failed",
      message: error.message,
      stderr: error.stderr?.toString?.() ?? "",
    });
    return null;
  }
}

const registryEntries = readTsv(registryFile, ["name", "script", "description"], "registry");
const registryByName = new Map(registryEntries.map((entry) => [entry.name, entry]));
const registrySourceText = readIfExists(registrySourceFile, "source registry");
const commonEnvHelperScript = "dev-openclaw-live-provider-credential-value-local-read-attempt-common-env.sh";
const commonEnvHelperPath = path.join(scriptDir, commonEnvHelperScript);
const commonEnvHelper = readIfExists(commonEnvHelperPath, "credential-value local-read-attempt common env helper");
const prereqHelperScript = "dev-openclaw-live-provider-credential-value-local-read-attempt-prereq.sh";
const prereqHelperPath = path.join(scriptDir, prereqHelperScript);
const prereqHelper = readIfExists(prereqHelperPath, "credential-value local-read-attempt prerequisite helper");
const batchReuseScript = "dev-openclaw-live-provider-credential-value-local-read-attempt-batch-reuse-check.sh";
const batchReusePath = path.join(scriptDir, batchReuseScript);
const batchReuse = readIfExists(batchReusePath, "credential-value local-read-attempt batch reuse check");
const milestones = readTsv(manifestFile, [
  "phase",
  "slug",
  "coreDescription",
  "observerDescription",
  "predecessorPhase",
  "predecessorSlug",
  "nextSlug",
  "fastSourcePhase",
  "fastSourceSlug",
  "prereqRegistry",
  "prereqMarker",
], "manifest").map((entry) => ({
  ...entry,
  phaseNumber: Number.parseInt(entry.phase, 10),
  predecessorPhaseNumber: Number.parseInt(entry.predecessorPhase, 10),
  fastSourcePhaseNumber: Number.parseInt(entry.fastSourcePhase, 10),
}));

if (milestones.length !== 8) {
  issues.push({ manifestFile, issue: "expected 8 Phase 91-98 milestone rows", count: milestones.length });
}

requireContains(commonEnvHelper, "openclaw-live-provider-credential-value-local-read-attempt-milestones.tsv", { file: commonEnvHelperPath });
requireContains(commonEnvHelper, "OPENCLAW_CREDENTIAL_VALUE_LOCAL_READ_ATTEMPT_SLUG", { file: commonEnvHelperPath });
requireContains(commonEnvHelper, "OPENCLAW_CORE_STATE_FILE", { file: commonEnvHelperPath });
requireContains(prereqHelper, "openclaw_credential_value_local_read_attempt_prepare_prereq_state", { file: prereqHelperPath });
requireContains(prereqHelper, "dev-openclaw-fast-prereq-state.sh", { file: prereqHelperPath });
requireContains(prereqHelper, "openclaw_reuse_prereq_state", { file: prereqHelperPath });
requireContains(prereqHelper, "fast_source_slug", { file: prereqHelperPath });
requireContains(batchReuse, "openclaw-live-provider-credential-value-local-read-attempt-milestones.tsv", { file: batchReusePath });
requireContains(batchReuse, "START_PHASE", { file: batchReusePath });
requireContains(batchReuse, "END_PHASE", { file: batchReusePath });
requireContains(batchReuse, "OPENCLAW_DEV_SERVICES_KEEP_UP=true", { file: batchReusePath });
requireContains(batchReuse, "OPENCLAW_DEV_SERVICES_ALREADY_UP", { file: batchReusePath });
requireContains(batchReuse, "openclawCredentialValueLocalReadAttemptBatchReuse", { file: batchReusePath });
requireContains(registrySourceText, "openclaw-live-provider-credential-value-local-read-attempt-milestone-manifest", { file: registrySourceFile });
requireContains(registrySourceText, "openclaw-live-provider-credential-value-local-read-attempt-batch-reuse", { file: registrySourceFile });

for (const [index, milestone] of milestones.entries()) {
  const expectedPhase = 91 + index;
  if (milestone.phaseNumber !== expectedPhase) {
    issues.push({ lineNumber: milestone.lineNumber, issue: "phase sequence mismatch", expectedPhase, actualPhase: milestone.phase });
  }
  if (!milestone.slug.startsWith("openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt")) {
    issues.push({ phase: milestone.phase, slug: milestone.slug, issue: "slug outside local-read-attempt lane" });
  }
  if (milestone.predecessorPhaseNumber !== milestone.phaseNumber - 1) {
    issues.push({ phase: milestone.phase, issue: "predecessor phase is not adjacent", predecessorPhase: milestone.predecessorPhase });
  }
  if (index > 0 && milestone.predecessorSlug !== milestones[index - 1].slug) {
    issues.push({
      phase: milestone.phase,
      issue: "predecessor slug does not match previous manifest row",
      expectedPredecessorSlug: milestones[index - 1].slug,
      actualPredecessorSlug: milestone.predecessorSlug,
    });
  }
  if (index < milestones.length - 1 && milestone.nextSlug !== milestones[index + 1].slug) {
    issues.push({
      phase: milestone.phase,
      issue: "next slug does not match next manifest row",
      expectedNextSlug: milestones[index + 1].slug,
      actualNextSlug: milestone.nextSlug,
    });
  }
  if (milestone.fastSourcePhaseNumber > milestone.phaseNumber || milestone.fastSourcePhaseNumber < 90) {
    issues.push({ phase: milestone.phase, issue: "fast source phase outside allowed range", fastSourcePhase: milestone.fastSourcePhase });
  }

  const physicalScripts = physicalScriptsForMilestone(milestone);
  const coreScript = physicalScripts.core;
  const commonScript = physicalScripts.common;
  const observerName = `observer-${milestone.slug}`;
  const observerScript = physicalScripts.observer;
  const coreRegistry = registryByName.get(milestone.slug);
  const observerRegistry = registryByName.get(observerName);
  const expectedCoreDescription = `Phase ${milestone.phase} ${milestone.coreDescription}`;
  const expectedObserverDescription = `Observer visibility for Phase ${milestone.phase} ${milestone.observerDescription}`;
  const commonEnv = readCommonEnvForMilestone(milestone, commonEnvHelperPath);
  const suffix = artifactSuffixForSlug(milestone.slug);
  const expectedCoreStateFile = path.join(repoRoot, ".artifacts", `openclaw-core-phase-${milestone.phase}-${suffix}-check.json`);
  const expectedSystemHealStateFile = path.join(repoRoot, ".artifacts", `openclaw-system-heal-phase-${milestone.phase}-${suffix}-check.json`);
  const expectedPortBase = String(14900 + (milestone.phaseNumber * 100));

  if (!coreRegistry) {
    issues.push({ phase: milestone.phase, name: milestone.slug, issue: "core registry row missing" });
  } else {
    if (coreRegistry.script !== coreScript) {
      issues.push({ phase: milestone.phase, name: milestone.slug, issue: "core registry script mismatch", expected: coreScript, actual: coreRegistry.script });
    }
    if (coreRegistry.description !== expectedCoreDescription) {
      issues.push({ phase: milestone.phase, name: milestone.slug, issue: "core registry description mismatch", expected: expectedCoreDescription, actual: coreRegistry.description });
    }
  }

  if (!observerRegistry) {
    issues.push({ phase: milestone.phase, name: observerName, issue: "observer registry row missing" });
  } else {
    if (observerRegistry.script !== observerScript) {
      issues.push({ phase: milestone.phase, name: observerName, issue: "observer registry script mismatch", expected: observerScript, actual: observerRegistry.script });
    }
    if (observerRegistry.description !== expectedObserverDescription) {
      issues.push({ phase: milestone.phase, name: observerName, issue: "observer registry description mismatch", expected: expectedObserverDescription, actual: observerRegistry.description });
    }
  }

  if (commonEnv) {
    if (commonEnv.coreStateFile !== expectedCoreStateFile) {
      issues.push({ phase: milestone.phase, issue: "common env core state file mismatch", expected: expectedCoreStateFile, actual: commonEnv.coreStateFile });
    }
    if (commonEnv.systemHealStateFile !== expectedSystemHealStateFile) {
      issues.push({ phase: milestone.phase, issue: "common env system heal state file mismatch", expected: expectedSystemHealStateFile, actual: commonEnv.systemHealStateFile });
    }
    if (commonEnv.portBase !== expectedPortBase) {
      issues.push({ phase: milestone.phase, issue: "common env port base mismatch", expected: expectedPortBase, actual: commonEnv.portBase });
    }
    for (const [field, expected] of [
      ["slug", milestone.slug],
      ["predecessorPhase", milestone.predecessorPhase],
      ["predecessorSlug", milestone.predecessorSlug],
      ["nextSlug", milestone.nextSlug],
      ["fastSourcePhase", milestone.fastSourcePhase],
      ["fastSourceSlug", milestone.fastSourceSlug],
      ["prereqRegistry", milestone.prereqRegistry],
      ["prereqMarker", milestone.prereqMarker],
    ]) {
      if (commonEnv[field] !== expected) {
        issues.push({ phase: milestone.phase, issue: `common env ${field} mismatch`, expected, actual: commonEnv[field] });
      }
    }
  }

  const planDocPath = path.join(repoRoot, "docs", "plans", `OPENCLAW_PHASE_${milestone.phase}_PLAN.md`);
  const coreWrapperPath = path.join(scriptDir, coreScript);
  const observerWrapperPath = path.join(scriptDir, observerScript);
  const commonScriptPath = path.join(scriptDir, commonScript);
  const planDoc = readIfExists(planDocPath, "phase plan");
  const coreWrapper = readIfExists(coreWrapperPath, "core wrapper");
  const observerWrapper = readIfExists(observerWrapperPath, "observer wrapper");
  const commonCheck = readIfExists(commonScriptPath, "common check");

  requireContains(planDoc, `# OpenClaw Phase ${milestone.phase} Plan`, { phase: milestone.phase, file: planDocPath });
  requireContains(planDoc, milestone.slug, { phase: milestone.phase, file: planDocPath });
  requireContains(planDoc, observerName, { phase: milestone.phase, file: planDocPath });
  requireContains(coreWrapper, `PHASE${milestone.phase}_PORT_BASE`, { phase: milestone.phase, file: coreWrapperPath });
  requireContains(coreWrapper, commonScript, { phase: milestone.phase, file: coreWrapperPath });
  requireContains(observerWrapper, `PHASE${milestone.phase}_OBSERVER_CHECK=true`, { phase: milestone.phase, file: observerWrapperPath });
  requireContains(observerWrapper, commonScript, { phase: milestone.phase, file: observerWrapperPath });
  requireContains(commonCheck, prereqHelperScript, { phase: milestone.phase, file: commonScriptPath });
  requireContains(commonCheck, `openclaw_credential_value_local_read_attempt_prepare_prereq_state ${milestone.phase}`, { phase: milestone.phase, file: commonScriptPath });
  if (commonCheck.includes("openclaw_reuse_prereq_state")) {
    issues.push({ phase: milestone.phase, file: commonScriptPath, issue: "common check still has inline fast prerequisite replay block" });
  }
}

const summary = {
  status: issues.length === 0 ? "passed" : "failed",
  milestoneCount: milestones.length,
  phases: milestones.map((milestone) => milestone.phase),
  manifestFile,
  issues,
};
fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
if (issues.length) {
  console.error(JSON.stringify(summary, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(summary, null, 2));
NODE

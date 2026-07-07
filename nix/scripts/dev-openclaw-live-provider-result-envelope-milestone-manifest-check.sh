#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REGISTRY_FILE="${OPENCLAW_MILESTONE_CHECKS_FILE:-$SCRIPT_DIR/dev-milestone-checks.tsv}"
MANIFEST_FILE="${OPENCLAW_LIVE_PROVIDER_RESULT_ENVELOPE_MILESTONES_FILE:-$SCRIPT_DIR/openclaw-live-provider-result-envelope-milestones.tsv}"
ARTIFACT_DIR="$REPO_ROOT/.artifacts/live-provider-result-envelope-milestone-manifest"
SUMMARY_FILE="$ARTIFACT_DIR/summary.json"

mkdir -p "$ARTIFACT_DIR"

node - "$SCRIPT_DIR" "$REPO_ROOT" "$REGISTRY_FILE" "$MANIFEST_FILE" "$SUMMARY_FILE" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [scriptDir, repoRoot, registryFile, manifestFile, summaryFile] = process.argv.slice(2);
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

function primaryRegistryForSlug(slug) {
  if (slug.endsWith("-task-shell")) {
    return `${slug.replace(/-task-shell$/, "-task")}-v0`;
  }
  return `${slug}-v0`;
}

function markerBaseForSlug(slug) {
  return slug
    .replace(/^openclaw-cloud-consciousness-live-provider-/, "")
    .replace(/-/g, "_");
}

function primaryStatusMarkersForSlug(slug) {
  const base = markerBaseForSlug(slug);
  if (slug.endsWith("-task-shell")) {
    return [`cloud_consciousness_live_provider_${base}_deferred`];
  }
  if (slug.endsWith("-final-readiness-preflight")) {
    return [`${base}_ready_deferred`, `${base}_recorded_deferred`];
  }
  return [`${base}_ready`];
}

const registryEntries = readTsv(registryFile, ["name", "script", "description"], "registry");
const registryByName = new Map(registryEntries.map((entry) => [entry.name, entry]));
const wrapperHelperScript = "dev-openclaw-live-provider-result-envelope-wrapper.sh";
const wrapperHelperPath = path.join(scriptDir, wrapperHelperScript);
const wrapperHelper = readIfExists(wrapperHelperPath, "result-envelope wrapper helper");
const milestones = readTsv(manifestFile, [
  "phase",
  "slug",
  "coreDescription",
  "observerDescription",
  "predecessorSlug",
  "nextSlug",
], "manifest").map((entry) => ({ ...entry, phaseNumber: Number.parseInt(entry.phase, 10) }));

if (milestones.length !== 18) {
  issues.push({ manifestFile, issue: "expected 18 Phase 99-116 milestone rows", count: milestones.length });
}

requireContains(wrapperHelper, "openclaw-live-provider-result-envelope-milestones.tsv", { file: wrapperHelperPath });
requireContains(wrapperHelper, "common-check.sh", { file: wrapperHelperPath });
requireContains(wrapperHelper, "${phase_env}_PORT_BASE", { file: wrapperHelperPath });
requireContains(wrapperHelper, "${phase_env}_OBSERVER_CHECK=true", { file: wrapperHelperPath });

for (const [index, milestone] of milestones.entries()) {
  const expectedPhase = 99 + index;
  if (milestone.phaseNumber !== expectedPhase) {
    issues.push({ lineNumber: milestone.lineNumber, issue: "phase sequence mismatch", expectedPhase, actualPhase: milestone.phase });
  }
  if (!milestone.slug.startsWith("openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope")) {
    issues.push({ phase: milestone.phase, slug: milestone.slug, issue: "slug outside result-envelope lane" });
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

  const coreScript = `dev-${milestone.slug}-check.sh`;
  const commonScript = `dev-${milestone.slug}-common-check.sh`;
  const observerName = `observer-${milestone.slug}`;
  const observerScript = `dev-observer-${milestone.slug}-check.sh`;
  const primaryRegistry = primaryRegistryForSlug(milestone.slug);
  const primaryStatusMarkers = primaryStatusMarkersForSlug(milestone.slug);
  const coreRegistry = registryByName.get(milestone.slug);
  const observerRegistry = registryByName.get(observerName);
  const expectedCoreDescription = `Phase ${milestone.phase} ${milestone.coreDescription}`;
  const expectedObserverDescription = `Observer visibility for Phase ${milestone.phase} ${milestone.observerDescription}`;

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

  const planDocPath = path.join(repoRoot, "docs", "plans", `OPENCLAW_PHASE_${milestone.phase}_PLAN.md`);
  const coreWrapperPath = path.join(scriptDir, coreScript);
  const observerWrapperPath = path.join(scriptDir, observerScript);
  const commonScriptPath = path.join(scriptDir, commonScript);
  const planDoc = readIfExists(planDocPath, "phase plan");
  const coreWrapper = readIfExists(coreWrapperPath, "core wrapper");
  const observerWrapper = readIfExists(observerWrapperPath, "observer wrapper");
  const commonCheck = readIfExists(commonScriptPath, "common check");
  const phaseEnvPrefix = `PHASE${milestone.phase}`;

  requireContains(planDoc, `# OpenClaw Phase ${milestone.phase} Plan`, { phase: milestone.phase, file: planDocPath });
  requireContains(planDoc, milestone.slug, { phase: milestone.phase, file: planDocPath });
  requireContains(planDoc, observerName, { phase: milestone.phase, file: planDocPath });
  requireContains(planDoc, milestone.predecessorSlug, { phase: milestone.phase, file: planDocPath });
  requireContains(planDoc, milestone.nextSlug, { phase: milestone.phase, file: planDocPath });

  requireContains(coreWrapper, wrapperHelperScript, { phase: milestone.phase, file: coreWrapperPath });
  requireContains(coreWrapper, `${milestone.phase} core`, { phase: milestone.phase, file: coreWrapperPath });
  requireContains(observerWrapper, wrapperHelperScript, { phase: milestone.phase, file: observerWrapperPath });
  requireContains(observerWrapper, `${milestone.phase} observer`, { phase: milestone.phase, file: observerWrapperPath });
  requireContains(commonCheck, `OBSERVER_CHECK="\${${phaseEnvPrefix}_OBSERVER_CHECK:-false}"`, { phase: milestone.phase, file: commonScriptPath });
  requireContains(commonCheck, `PORT_BASE="\${${phaseEnvPrefix}_PORT_BASE:-`, { phase: milestone.phase, file: commonScriptPath });
  requireContains(commonCheck, `OPENCLAW_PHASE_${milestone.phase}_PLAN.md`, { phase: milestone.phase, file: commonScriptPath });
  requireContains(commonCheck, milestone.slug, { phase: milestone.phase, file: commonScriptPath });
  requireContains(commonCheck, milestone.predecessorSlug, { phase: milestone.phase, file: commonScriptPath });
  requireContains(commonCheck, primaryRegistry, { phase: milestone.phase, file: commonScriptPath });
  for (const statusMarker of primaryStatusMarkers) {
    requireContains(commonCheck, statusMarker, { phase: milestone.phase, file: commonScriptPath });
  }
}

const summary = {
  liveProviderResultEnvelopeMilestoneManifest: {
    status: issues.length === 0 ? "passed" : "failed",
    registryFile,
    manifestFile,
    phases: milestones.map((milestone) => ({
      phase: milestone.phaseNumber,
      slug: milestone.slug,
      primaryRegistry: primaryRegistryForSlug(milestone.slug),
      primaryStatusMarkers: primaryStatusMarkersForSlug(milestone.slug),
      predecessorSlug: milestone.predecessorSlug,
      nextSlug: milestone.nextSlug,
    })),
    counts: {
      manifestRows: milestones.length,
      registryRowsChecked: milestones.length * 2,
      phasePlansChecked: milestones.length,
      wrappersChecked: milestones.length * 2,
      wrapperHelpersChecked: 1,
      commonChecksChecked: milestones.length,
      commonPrimaryRegistriesChecked: milestones.length,
      commonStatusMarkersChecked: milestones.reduce((total, milestone) => total + primaryStatusMarkersForSlug(milestone.slug).length, 0),
    },
    issues,
    nextRecommendedSlice: "Extend the manifest check to cover repeated Phase 99-116 common-check artifact paths before renaming or deleting legacy scripts.",
  },
};

fs.writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));

if (issues.length > 0) {
  process.exit(1);
}
NODE

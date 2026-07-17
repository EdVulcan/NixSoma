#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY_FILE="${1:-$SCRIPT_DIR/dev-milestone-checks.tsv}"
MANIFEST_FILE="${OPENCLAW_LIVE_PROVIDER_RESULT_ENVELOPE_MILESTONES_FILE:-$SCRIPT_DIR/openclaw-live-provider-result-envelope-milestones.tsv}"

node - "$REGISTRY_FILE" "$MANIFEST_FILE" <<'NODE'
const fs = require("node:fs");

const [registryFile, manifestFile] = process.argv.slice(2);
const registryText = fs.readFileSync(registryFile, "utf8").replace(/^\uFEFF/, "");
const relativePathLimit = 160;

function readManifest(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  return text.split(/\n/)
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => {
      const [phase, slug, coreDescription, observerDescription] = line.split("\t");
      return { phase, slug, coreDescription, observerDescription };
    });
}

const milestones = readManifest(manifestFile);

function usesShortResultEnvelopeScriptAlias(milestone) {
  const phase = Number.parseInt(milestone.phase, 10);
  return phase >= 130 || [
    `dev-${milestone.slug}-check.sh`,
    `dev-observer-${milestone.slug}-check.sh`,
    `dev-${milestone.slug}-common-check.sh`,
  ].some((script) => `nix/scripts/${script}`.length >= relativePathLimit);
}

function resultEnvelopeScripts(milestone) {
  if (usesShortResultEnvelopeScriptAlias(milestone)) {
    return {
      core: `dev-p${milestone.phase}-core-check.sh`,
      observer: `dev-p${milestone.phase}-observer-check.sh`,
    };
  }
  return {
    core: `dev-${milestone.slug}-check.sh`,
    observer: `dev-observer-${milestone.slug}-check.sh`,
  };
}

function resultEnvelopeCoreScript(milestone) {
  return resultEnvelopeScripts(milestone).core;
}

function resultEnvelopeObserverScript(milestone) {
  return resultEnvelopeScripts(milestone).observer;
}

const coreRows = milestones.map((milestone) => [
  milestone.slug,
  resultEnvelopeCoreScript(milestone),
  `Phase ${milestone.phase} ${milestone.coreDescription}`,
].join("\t"));
const observerRows = milestones.map((milestone) => [
  `observer-${milestone.slug}`,
  resultEnvelopeObserverScript(milestone),
  `Observer visibility for Phase ${milestone.phase} ${milestone.observerDescription}`,
].join("\t"));

const output = [];
for (const rawLine of registryText.split(/\n/)) {
  const line = rawLine.replace(/\r$/, "");
  if (line === "# @openclaw-generate-live-provider-result-envelope core") {
    output.push("# generated from openclaw-live-provider-result-envelope-milestones.tsv: core");
    output.push(...coreRows);
    continue;
  }
  if (line === "# @openclaw-generate-live-provider-result-envelope observer") {
    output.push("# generated from openclaw-live-provider-result-envelope-milestones.tsv: observer");
    output.push(...observerRows);
    continue;
  }
  output.push(line);
}

process.stdout.write(output.join("\n").replace(/\n*$/, "\n"));
NODE

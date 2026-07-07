#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY_FILE="${1:-$SCRIPT_DIR/dev-milestone-checks.tsv}"
MANIFEST_FILE="${OPENCLAW_LIVE_PROVIDER_RESULT_ENVELOPE_MILESTONES_FILE:-$SCRIPT_DIR/openclaw-live-provider-result-envelope-milestones.tsv}"

node - "$REGISTRY_FILE" "$MANIFEST_FILE" <<'NODE'
const fs = require("node:fs");

const [registryFile, manifestFile] = process.argv.slice(2);
const registryText = fs.readFileSync(registryFile, "utf8").replace(/^\uFEFF/, "");

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
const coreRows = milestones.map((milestone) => [
  milestone.slug,
  `dev-${milestone.slug}-check.sh`,
  `Phase ${milestone.phase} ${milestone.coreDescription}`,
].join("\t"));
const observerRows = milestones.map((milestone) => [
  `observer-${milestone.slug}`,
  `dev-observer-${milestone.slug}-check.sh`,
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

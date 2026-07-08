#!/usr/bin/env bash

openclaw_result_envelope_assert_observer_manifest_surface() {
  local phase="$1"
  local html_file="$2"
  local client_file="$3"

  node - "$OPENCLAW_RESULT_ENVELOPE_MANIFEST_FILE" "$phase" "$html_file" "$client_file" <<'NODE'
const fs = require("node:fs");

const [manifestFile, phase, htmlFile, clientFile] = process.argv.slice(2);

function readTsv(file, columns) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  for (const rawLine of text.split(/\n/)) {
    const line = rawLine.replace(/\r$/, "");
    if (!line.trim() || line.startsWith("#")) continue;
    const parts = line.split("\t");
    if (parts.length !== columns.length) {
      throw new Error(`Manifest row expected ${columns.length} columns: ${line}`);
    }
    rows.push(Object.fromEntries(columns.map((column, index) => [column, parts[index]])));
  }
  return rows;
}

function primaryRegistryForSlug(slug) {
  if (slug.endsWith("-task-shell")) {
    return `${slug.replace(/-task-shell$/, "-task")}-v0`;
  }
  return `${slug}-v0`;
}

function pascalSlug(slug) {
  return slug
    .replace(/^openclaw-/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
}

function titleForSlug(slug) {
  return slug
    .replace(/^openclaw-/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function panelIdForSlug(slug) {
  return `${slug.replace(/^openclaw-/, "")}-panel`;
}

function endpointForSlug(slug) {
  const tail = slug.replace(/^openclaw-cloud-consciousness-live-provider-/, "");
  if (tail.endsWith("-task-shell")) {
    return `/cloud-consciousness/live-provider-${tail.replace(/-task-shell$/, "-tasks")}`;
  }
  return `/cloud-consciousness/live-provider-${tail}`;
}

function requireTokens(text, tokens, label) {
  for (const token of tokens) {
    if (!text.includes(token)) {
      throw new Error(`${label} missing ${token}`);
    }
  }
}

const milestones = readTsv(manifestFile, [
  "phase",
  "slug",
  "coreDescription",
  "observerDescription",
  "predecessorSlug",
  "nextSlug",
]);
const milestone = milestones.find((row) => row.phase === phase);
if (!milestone) {
  throw new Error(`Result-envelope manifest missing phase ${phase}`);
}

const html = fs.readFileSync(htmlFile, "utf8");
const client = fs.readFileSync(clientFile, "utf8");
const registry = primaryRegistryForSlug(milestone.slug);
const predecessorRegistry = primaryRegistryForSlug(milestone.predecessorSlug);
const endpoint = endpointForSlug(milestone.slug);
const refreshFunction = `refresh${pascalSlug(milestone.slug)}`;
const title = titleForSlug(milestone.slug);
const panelId = panelIdForSlug(milestone.slug);

requireTokens(html, [title, panelId], "Observer HTML");
requireTokens(client, [
  endpoint,
  refreshFunction,
  milestone.nextSlug,
  predecessorRegistry,
  registry,
], "Observer client");

console.log(JSON.stringify({
  observerOpenClawLiveProviderResultEnvelopeManifestSurface: {
    status: "passed",
    phase,
    slug: milestone.slug,
    predecessorRegistry,
    registry,
    endpoint,
    refreshFunction,
    panelId,
  },
}, null, 2));
NODE
}

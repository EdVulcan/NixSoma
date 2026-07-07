#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY_SOURCE_FILE="${OPENCLAW_MILESTONE_CHECKS_FILE:-$SCRIPT_DIR/dev-milestone-checks.tsv}"
REGISTRY_FILE="$REGISTRY_SOURCE_FILE"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-milestone-registry-expansion.sh"
openclaw_milestone_prepare_expanded_registry "$SCRIPT_DIR" "$REGISTRY_SOURCE_FILE" REGISTRY_FILE
trap openclaw_milestone_cleanup_expanded_registry EXIT

node - "$SCRIPT_DIR" "$REGISTRY_FILE" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const [scriptDir, registryFile] = process.argv.slice(2);
const text = fs.readFileSync(registryFile, "utf8").replace(/^\uFEFF/, "");
const names = new Map();
const scripts = new Map();
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
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    issues.push({ lineNumber, name, issue: "invalid check name" });
  }
  if (!/^dev-[A-Za-z0-9_.-]+\.sh$/.test(script)) {
    issues.push({ lineNumber, script, issue: "invalid script filename" });
  }
  if (!description.trim()) {
    issues.push({ lineNumber, name, issue: "empty description" });
  }
  if (names.has(name)) {
    issues.push({ lineNumber, name, firstLine: names.get(name), issue: "duplicate check name" });
  }
  if (scripts.has(script)) {
    issues.push({ lineNumber, script, firstLine: scripts.get(script), issue: "duplicate script entry" });
  }
  if (!fs.existsSync(path.join(scriptDir, script))) {
    issues.push({ lineNumber, script, issue: "script target missing" });
  }

  names.set(name, lineNumber);
  scripts.set(script, lineNumber);
  entries.push({ name, script, description });
}

if (issues.length > 0) {
  console.error(JSON.stringify({ status: "failed", registryFile, entries: entries.length, issues }, null, 2));
  process.exit(1);
}

const longestScript = entries.reduce((longest, entry) => entry.script.length > longest.script.length ? entry : longest, entries[0]);

console.log(JSON.stringify({
  milestoneRegistry: {
    status: "passed",
    registryFile,
    entries: entries.length,
    longestScript: longestScript ? {
      name: longestScript.name,
      script: longestScript.script,
      length: longestScript.script.length,
    } : null,
  },
}, null, 2));
NODE

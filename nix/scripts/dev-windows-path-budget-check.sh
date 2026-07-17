#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ARTIFACT_DIR="$REPO_ROOT/.artifacts/windows-path-budget"
SUMMARY_FILE="$ARTIFACT_DIR/summary.json"
RELATIVE_PATH_LIMIT="${OPENCLAW_WINDOWS_RELATIVE_PATH_LIMIT:-160}"

mkdir -p "$ARTIFACT_DIR"

node - "$REPO_ROOT" "$SUMMARY_FILE" "$RELATIVE_PATH_LIMIT" <<'NODE'
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const [repoRoot, summaryFile, limitRaw] = process.argv.slice(2);
const relativePathLimit = Number.parseInt(limitRaw, 10);
if (!Number.isInteger(relativePathLimit) || relativePathLimit <= 0) {
  throw new Error(`invalid relative path limit: ${limitRaw}`);
}

const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
  cwd: repoRoot,
  encoding: "utf8",
}).split("\0").filter(Boolean);
const overBudget = files
  .map((file) => ({ file, length: file.length }))
  .filter((entry) => entry.length >= relativePathLimit)
  .sort((left, right) => right.length - left.length || left.file.localeCompare(right.file));

const summary = {
  status: overBudget.length === 0 ? "passed" : "failed",
  relativePathLimit,
  trackedAndUntrackedFileCount: files.length,
  overBudgetCount: overBudget.length,
  longestPaths: files
    .map((file) => ({ file, length: file.length }))
    .sort((left, right) => right.length - left.length || left.file.localeCompare(right.file))
    .slice(0, 25),
  overBudget,
};
fs.writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (overBudget.length > 0) process.exit(1);
NODE

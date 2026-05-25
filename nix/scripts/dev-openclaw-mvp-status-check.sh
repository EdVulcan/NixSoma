#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
STATUS_FILE="$REPO_ROOT/docs/guides/OPENCLAW_MVP_STATUS.md"

if [[ ! -f "$STATUS_FILE" ]]; then
  echo "Missing MVP status document: $STATUS_FILE" >&2
  exit 1
fi

node - <<'EOF' "$STATUS_FILE"
const fs = require("node:fs");
const statusPath = process.argv[2];
const body = fs.readFileSync(statusPath, "utf8");

const requiredTokens = [
  "First-stage MVP readiness is passed.",
  "First-stage MVP: 88% - 90%",
  "Full whitepaper vision: about 35%",
  "Body:",
  "Eyes:",
  "Hands:",
  "Observer:",
  "Task recovery:",
  "Body health:",
  "openclaw-mvp-readiness,observer-openclaw-mvp-readiness",
  "Demonstration Path",
  "Explicit Non-Goals For This Stage",
  "Plugin runtime adapter hardening.",
  "Re-check the whitepaper after each milestone",
];

for (const token of requiredTokens) {
  if (!body.includes(token)) {
    throw new Error(`MVP status document missing token: ${token}`);
  }
}

const forbiddenMainline = [
  "next mainline: plugin runtime adapter",
  "next mainline: approval hardening",
  "next mainline: persistence hardening",
];

for (const token of forbiddenMainline) {
  if (body.toLowerCase().includes(token)) {
    throw new Error(`MVP status document drifted into a safety-boundary loop: ${token}`);
  }
}

console.log(JSON.stringify({
  openclawMvpStatus: {
    status: "passed",
    document: statusPath,
    stage: "first-stage-mvp-readiness-passed",
    estimate: "88-90%",
  },
}, null, 2));
EOF

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

if [[ ! -f "$PLAN_FILE" ]]; then
  echo "Missing Phase 2 plan: $PLAN_FILE" >&2
  exit 1
fi

node - <<'EOF' "$PLAN_FILE"
const fs = require("node:fs");
const planPath = process.argv[2];
const plan = fs.readFileSync(planPath, "utf8");

const requiredTokens = [
  "Phase 1 is release-exit passed and demo-ready.",
  "Phase 2 starts with route selection only.",
  "Real NixOS/systemd repair semantics.",
  "Operator/Observer demo experience.",
  "Body governance enhancement.",
  "Plugin/runtime adapter work, only if it directly supports a visible body capability.",
  "Track A: Real NixOS/systemd Repair Semantics",
  "Track B: Operator/Observer Demo Experience",
  "Track C: Body Governance Enhancement",
  "Deferred Track: Plugin/runtime Adapter",
  "openclaw-systemd-unit-inventory",
  "observer-openclaw-systemd-unit-inventory",
  "No automatic high-risk repair.",
  "No host mutation before a plan-only and dry-run milestone.",
  "The slice is not merely hardening, persistence, denial recovery, or plugin/runtime adapter boundary work.",
];

for (const token of requiredTokens) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing token: ${token}`);
  }
}

const priorities = [
  "1. Real NixOS/systemd repair semantics.",
  "2. Operator/Observer demo experience.",
  "3. Body governance enhancement.",
  "4. Plugin/runtime adapter work, only if it directly supports a visible body capability.",
];
let lastIndex = -1;
for (const priority of priorities) {
  const index = plan.indexOf(priority);
  if (index <= lastIndex) {
    throw new Error(`Phase 2 priority order drifted near: ${priority}`);
  }
  lastIndex = index;
}

const forbidden = [
  "first recommended slice: plugin",
  "first recommended slice: runtime adapter",
  "continue approval hardening",
  "continue persistence hardening",
  "continue denial recovery",
];
for (const token of forbidden) {
  if (plan.toLowerCase().includes(token)) {
    throw new Error(`Phase 2 plan drifted into forbidden work: ${token}`);
  }
}

console.log(JSON.stringify({
  openclawPhase2Plan: {
    status: "passed",
    document: planPath,
    firstSlice: "openclaw-systemd-unit-inventory",
    priority: [
      "real-systemd-repair-semantics",
      "operator-observer-demo-experience",
      "body-governance-enhancement",
      "plugin-runtime-adapter-deferred",
    ],
  },
}, null, 2));
EOF

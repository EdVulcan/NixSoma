#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

if [[ ! -f "$PLAN_FILE" ]]; then
  echo "Missing Phase 2 plan: $PLAN_FILE" >&2
  exit 1
fi

node - <<'EOF' "$PLAN_FILE"
const fs = require("node:fs");
const planPath = process.argv[2];
const plan = fs.readFileSync(planPath, "utf8");

const requiredTokens = [
  "Track A Execution Route Gate",
  "`openclaw-systemd-unit-inventory` is passed.",
  "`observer-openclaw-systemd-unit-inventory` is passed.",
  "`openclaw-systemd-repair-plan` is passed.",
  "`observer-openclaw-systemd-repair-plan` is passed.",
  "`openclaw-systemd-repair-dry-run` is passed.",
  "`observer-openclaw-systemd-repair-dry-run` is passed.",
  "`openclaw-systemd-repair-execution-task`",
  "operator-reviewed real systemd repair execution path",
  "One selected OpenClaw-owned body unit only.",
  "Operator-visible command, target, risk, reason, and rollback note.",
  "No automatic high-risk repair.",
  "No blind restart.",
  "No background scheduler.",
  "No persistence, denial-recovery, duplicate-click, or approval-hardening loop.",
  "No plugin/runtime adapter work.",
  "linked back to the passed inventory, repair plan, and dry-run envelope.",
];

for (const token of requiredTokens) {
  if (!plan.includes(token)) {
    throw new Error(`systemd repair execution route missing token: ${token}`);
  }
}

const gateIndex = plan.indexOf("Track A Execution Route Gate");
const phase2GateIndex = plan.indexOf("## Phase 2 Gate");
if (gateIndex === -1 || phase2GateIndex === -1 || gateIndex > phase2GateIndex) {
  throw new Error("Track A execution route gate should appear before the general Phase 2 gate.");
}

const forbidden = [
  "automatic systemd repair execution is allowed",
  "blind restart is allowed",
  "continue approval hardening",
  "continue persistence hardening",
  "plugin/runtime adapter is next",
];
for (const token of forbidden) {
  if (plan.toLowerCase().includes(token)) {
    throw new Error(`systemd repair execution route drifted into forbidden work: ${token}`);
  }
}

console.log(JSON.stringify({
  openclawSystemdRepairExecutionRoute: {
    status: "passed",
    document: planPath,
    nextSlice: "openclaw-systemd-repair-execution-task",
    route: "operator-reviewed-real-systemd-repair-execution",
    boundary: "one-unit-only-no-background-autonomy-no-hardening-loop",
  },
}, null, 2));
EOF

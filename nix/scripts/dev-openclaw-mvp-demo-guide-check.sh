#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
GUIDE_FILE="$REPO_ROOT/docs/OPENCLAW_MVP_DEMO_GUIDE.md"

if [[ ! -f "$GUIDE_FILE" ]]; then
  echo "Missing MVP demo guide: $GUIDE_FILE" >&2
  exit 1
fi

node - <<'EOF' "$GUIDE_FILE"
const fs = require("node:fs");
const guidePath = process.argv[2];
const guide = fs.readFileSync(guidePath, "utf8");

const requiredTokens = [
  "first-stage MVP human demo path",
  "resident body, eyes, hands, Observer visibility, task recovery, and conservative body self-heal evidence",
  "openclaw-mvp-readiness,observer-openclaw-mvp-readiness",
  "Demo Path",
  "Evidence Checklist",
  "Pass Criteria",
  "Fail Criteria",
  "Artifacts To Keep",
  "body -> eyes -> hands -> observer -> recovery -> body health/self-heal",
  "task history, action evidence, recovery evidence, system health, heal history, maintenance state, and MVP route",
  "high-risk resource alerts are observe-only",
  "plugin runtime adapter hardening",
  "approval hardening",
  "denial recovery",
  "persistence hardening",
  "Choose next-phase work from the whitepaper route",
];

for (const token of requiredTokens) {
  if (!guide.includes(token)) {
    throw new Error(`MVP demo guide missing token: ${token}`);
  }
}

const demoStepCount = [...guide.matchAll(/^\d+\. /gm)].length;
if (demoStepCount < 12) {
  throw new Error(`MVP demo guide should include a concrete multi-step demo path; found ${demoStepCount}`);
}

const forbidden = [
  "make plugin runtime adapter the first-stage exit",
  "continue approval hardening before demo",
  "continue persistence hardening before demo",
];
for (const token of forbidden) {
  if (guide.toLowerCase().includes(token)) {
    throw new Error(`MVP demo guide drifted into forbidden work: ${token}`);
  }
}

console.log(JSON.stringify({
  openclawMvpDemoGuide: {
    status: "passed",
    document: guidePath,
    demoSteps: demoStepCount,
    readinessChecks: [
      "openclaw-mvp-readiness",
      "observer-openclaw-mvp-readiness",
    ],
  },
}, null, 2));
EOF

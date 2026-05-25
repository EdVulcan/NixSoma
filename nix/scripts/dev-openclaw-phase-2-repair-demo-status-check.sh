#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/plans/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5970}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5971}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5972}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5973}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5974}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5975}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5976}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5977}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6040}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-phase-2-repair-demo-status-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-phase-2-repair-demo-status-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

post_json() {
  local url="$1"
  local payload="$2"
  curl --silent --fail -X POST "$url" -H 'content-type: application/json' --data "$payload"
}

"$SCRIPT_DIR/dev-up.sh"

initial_status="$(curl --silent --fail "$CORE_URL/phase-2/repair-demo-status")"
created="$(post_json "$CORE_URL/system/systemd/repair-execution-tasks" '{"unit":"openclaw-browser-runtime.service","confirm":true,"execute":true}')"
approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created")"
approved="$(post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"milestone-check","reason":"Create Phase 2 repair demo evidence bundle source."}')"
step="$(post_json "$CORE_URL/operator/step" '{}')"
demo_status="$(curl --silent --fail "$CORE_URL/phase-2/repair-demo-status")"

node - <<'EOF' "$PLAN_FILE" "$initial_status" "$created" "$approved" "$step" "$demo_status"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const initialStatus = JSON.parse(process.argv[3]);
const created = JSON.parse(process.argv[4]);
const approved = JSON.parse(process.argv[5]);
const step = JSON.parse(process.argv[6]);
const demoStatus = JSON.parse(process.argv[7]);

for (const token of [
  "openclaw-phase-2-repair-demo-status",
  "Reads existing route, task history, command transcript, and post-execution verification evidence",
  "Creates no task, no approval, no command execution, no host mutation, and no recovery action",
  "Must not add persistence hardening, denial recovery, duplicate-click handling, schedulers, plugin/runtime adapter work, or any hidden execution path",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing repair demo status route token: ${token}`);
  }
}

if (!initialStatus.ok || initialStatus.registry !== "openclaw-phase-2-repair-demo-status-v0") {
  throw new Error(`initial demo status should expose registry: ${JSON.stringify(initialStatus)}`);
}
if (initialStatus.governance?.readOnly !== true
  || initialStatus.governance?.createsTask !== false
  || initialStatus.governance?.executesCommand !== false
  || initialStatus.governance?.mutatesHost !== false) {
  throw new Error(`initial demo status must be read-only: ${JSON.stringify(initialStatus.governance)}`);
}
if (!created.ok || created.governance?.realExecutionEnabled !== true || !approved.ok || approved.approval?.status !== "approved") {
  throw new Error(`demo source should create and approve real repair evidence: ${JSON.stringify({ created, approved })}`);
}
if (!step.ok || step.ran !== true || !step.task?.outcome?.details?.postExecutionVerification) {
  throw new Error(`operator step should produce post verification source evidence: ${JSON.stringify(step)}`);
}
if (!demoStatus.ok || demoStatus.registry !== "openclaw-phase-2-repair-demo-status-v0") {
  throw new Error(`demo status should expose registry after evidence: ${JSON.stringify(demoStatus)}`);
}
if (demoStatus.status !== "demo_ready" || demoStatus.summary?.demoReady !== true) {
  throw new Error(`demo status should be demo_ready after repair evidence: ${JSON.stringify(demoStatus.summary)}`);
}
if (demoStatus.summary?.latestTaskId !== step.task.id
  || demoStatus.summary?.targetUnit !== "openclaw-browser-runtime.service"
  || demoStatus.summary?.command !== "systemctl restart openclaw-browser-runtime.service") {
  throw new Error(`demo status should summarize latest repair evidence: ${JSON.stringify(demoStatus.summary)}`);
}
if (demoStatus.summary?.noAutomaticRecovery !== true
  || demoStatus.governance?.readOnly !== true
  || demoStatus.governance?.createsTask !== false
  || demoStatus.governance?.executesCommand !== false
  || demoStatus.governance?.triggersRecovery !== false
  || demoStatus.route?.avoidsSafetyBoundaryLoop !== true) {
  throw new Error(`demo status must remain read-only evidence: ${JSON.stringify(demoStatus)}`);
}
if ((demoStatus.checklist ?? []).length < 4 || !demoStatus.checklist.every((item) => item.status === "passed")) {
  throw new Error(`demo checklist should pass after evidence: ${JSON.stringify(demoStatus.checklist)}`);
}
if (demoStatus.evidence?.postExecutionVerification?.registry !== "openclaw-systemd-repair-post-verification-v0") {
  throw new Error(`demo status should link post execution verification evidence: ${JSON.stringify(demoStatus.evidence)}`);
}

console.log(JSON.stringify({
  openclawPhase2RepairDemoStatus: {
    status: "passed",
    registry: demoStatus.registry,
    demoStatus: demoStatus.status,
    latestTaskId: demoStatus.summary.latestTaskId,
    targetUnit: demoStatus.summary.targetUnit,
    evidence: `${demoStatus.summary.passed}/${demoStatus.summary.total}`,
    next: demoStatus.route.nextRecommendedSlice,
  },
}, null, 2));
EOF

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5950}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5951}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5952}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5953}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5954}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5955}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5956}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5957}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6020}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-repair-post-verification-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-repair-post-verification-check.json}"

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

created="$(post_json "$CORE_URL/system/systemd/repair-execution-tasks" '{"unit":"openclaw-browser-runtime.service","confirm":true,"execute":true}')"
approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created")"
approved="$(post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one real systemd repair attempt with post-execution verification."}')"
step="$(post_json "$CORE_URL/operator/step" '{}')"

node - <<'EOF' "$PLAN_FILE" "$created" "$approved" "$step"
const fs = require("node:fs");
const plan = fs.readFileSync(process.argv[2], "utf8");
const created = JSON.parse(process.argv[3]);
const approved = JSON.parse(process.argv[4]);
const step = JSON.parse(process.argv[5]);

for (const token of [
  "openclaw-systemd-repair-post-verification",
  "Reads systemd unit inventory before and after the approved execution attempt",
  "Reads `/system/health` before and after the approved execution attempt",
  "Must not retry the restart, trigger automatic recovery, add persistence hardening, add denial recovery, add duplicate-click handling, or schedule background repair",
]) {
  if (!plan.includes(token)) {
    throw new Error(`Phase 2 plan missing post-verification route token: ${token}`);
  }
}

if (!created.ok || created.governance?.realExecutionEnabled !== true) {
  throw new Error(`post-verification source should create real execution task: ${JSON.stringify(created)}`);
}
if (!approved.ok || approved.approval?.status !== "approved") {
  throw new Error(`post-verification source should approve real execution: ${JSON.stringify(approved)}`);
}
if (!step.ok || step.ran !== true || step.blocked !== false) {
  throw new Error(`operator step should run real execution before verification: ${JSON.stringify(step)}`);
}

const finalTask = step.task;
const verification = finalTask?.outcome?.details?.postExecutionVerification;
if (!verification || verification.registry !== "openclaw-systemd-repair-post-verification-v0") {
  throw new Error(`real execution outcome should include post verification evidence: ${JSON.stringify(finalTask?.outcome)}`);
}
if (verification.mode !== "single_observation_no_recovery" || verification.targetUnit !== "openclaw-browser-runtime.service") {
  throw new Error(`post verification should be single observation for browser runtime: ${JSON.stringify(verification)}`);
}
if (verification.before?.stage !== "before_real_execution" || verification.after?.stage !== "after_real_execution") {
  throw new Error(`post verification should include before/after stages: ${JSON.stringify(verification)}`);
}
if (verification.before?.unitInventory?.registry !== "openclaw-systemd-unit-inventory-v0"
  || verification.after?.unitInventory?.registry !== "openclaw-systemd-unit-inventory-v0") {
  throw new Error(`post verification should cite systemd unit inventory before and after: ${JSON.stringify(verification)}`);
}
if (!verification.before?.targetUnitState || !verification.after?.targetUnitState) {
  throw new Error(`post verification should record target unit state before and after: ${JSON.stringify(verification)}`);
}
if (!verification.before?.systemHealth || !verification.after?.systemHealth) {
  throw new Error(`post verification should record system health before and after: ${JSON.stringify(verification)}`);
}
if (!verification.before?.targetServiceHealth || !verification.after?.targetServiceHealth) {
  throw new Error(`post verification should record browser runtime health before and after: ${JSON.stringify(verification)}`);
}
if (verification.summary?.noAutomaticRecovery !== true
  || verification.governance?.recordsEvidenceOnly !== true
  || verification.governance?.triggersRecovery !== false
  || verification.governance?.retriesExecution !== false
  || verification.governance?.schedulesFollowUp !== false) {
  throw new Error(`post verification must remain evidence-only: ${JSON.stringify(verification)}`);
}
if (verification.commandExitCode !== finalTask.outcome?.details?.result?.exitCode) {
  throw new Error(`post verification should carry command exit code: ${JSON.stringify(verification)}`);
}

console.log(JSON.stringify({
  openclawSystemdRepairPostVerification: {
    status: "passed",
    taskId: finalTask.id,
    approvalId: approved.approval.id,
    outcome: finalTask.outcome.kind,
    commandExitCode: verification.commandExitCode,
    beforeActiveState: verification.summary.beforeActiveState,
    afterActiveState: verification.summary.afterActiveState,
    beforeServiceOk: verification.summary.beforeServiceOk,
    afterServiceOk: verification.summary.afterServiceOk,
    noAutomaticRecovery: verification.summary.noAutomaticRecovery,
  },
}, null, 2));
EOF

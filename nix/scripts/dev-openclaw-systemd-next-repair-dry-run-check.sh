#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAN_FILE="$REPO_ROOT/docs/OPENCLAW_PHASE_2_PLAN.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6650}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6651}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6652}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6653}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6654}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6655}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6656}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6657}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6720}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-systemd-next-repair-dry-run-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-systemd-next-repair-dry-run-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
SYSTEM_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_SENSE_PORT"
LEDGER_DIR="$REPO_ROOT/.artifacts/openclaw-body-evidence-ledger"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f \
  "$OPENCLAW_CORE_STATE_FILE" \
  "$OPENCLAW_CORE_STATE_FILE.tmp" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" \
  "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"
rm -rf "$LEDGER_DIR"

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

created_directory="$(post_json "$CORE_URL/body/evidence-ledger/directory-tasks" '{"confirm":true}')"
directory_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_directory")"
post_json "$CORE_URL/approvals/$directory_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve bounded ledger directory creation before next repair dry-run."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null

created_record_task="$(post_json "$CORE_URL/body/evidence-ledger/first-record-tasks" '{"confirm":true}')"
record_approval_id="$(node -e 'const data = JSON.parse(process.argv[1]); process.stdout.write(data.approval.id)' "$created_record_task")"
post_json "$CORE_URL/approvals/$record_approval_id/approve" '{"approvedBy":"milestone-check","reason":"Approve one bounded bootstrap append before next repair dry-run."}' >/dev/null
post_json "$CORE_URL/operator/step" '{}' >/dev/null
route_review="$(curl --silent --fail "$SYSTEM_URL/system/systemd/next-repair-route-review")"
envelope="$(curl --silent --fail "$SYSTEM_URL/system/systemd/next-repair-dry-run")"

node - <<'EOF' "$PLAN_FILE" "$route_review" "$envelope"
const fs = require("node:fs");
const planDoc = fs.readFileSync(process.argv[2], "utf8");
const routeReview = JSON.parse(process.argv[3]);
const envelope = JSON.parse(process.argv[4]);

for (const token of [
  "Systemd next repair dry-run checkpoint",
  "openclaw-systemd-next-repair-dry-run",
  "systemctl restart openclaw-system-sense.service",
  "no-restart-executed check",
]) {
  if (!planDoc.includes(token)) {
    throw new Error(`Phase 2 plan missing next repair dry-run token: ${token}`);
  }
}

if (!routeReview.ok
  || routeReview.registry !== "openclaw-systemd-next-repair-route-review-v0"
  || routeReview.decision?.selectedSlice !== "openclaw-systemd-next-repair-dry-run") {
  throw new Error(`next repair route review should select dry-run before envelope: ${JSON.stringify(routeReview)}`);
}
if (!envelope.ok || envelope.registry !== "openclaw-systemd-next-repair-dry-run-v0") {
  throw new Error(`next repair dry-run should expose expected registry: ${JSON.stringify(envelope)}`);
}
if (envelope.mode !== "operator_visible_next_systemd_repair_dry_run"
  || envelope.canMutate !== false
  || envelope.canRestart !== false
  || envelope.wouldExecute !== false) {
  throw new Error(`next repair dry-run must not mutate, restart, or execute: ${JSON.stringify(envelope)}`);
}
if (envelope.source?.routeReviewRegistry !== "openclaw-systemd-next-repair-route-review-v0"
  || envelope.source?.nextRepairPlanRegistry !== "openclaw-systemd-next-repair-plan-v0") {
  throw new Error(`next repair dry-run should cite route and plan evidence: ${JSON.stringify(envelope.source)}`);
}
if (envelope.target?.unit !== "openclaw-system-sense.service"
  || envelope.routeReview?.selectedUnit !== "openclaw-system-sense.service"
  || envelope.routeReview?.selectedSlice !== "openclaw-systemd-next-repair-dry-run") {
  throw new Error(`next repair dry-run should target selected system-sense unit: ${JSON.stringify({ target: envelope.target, route: envelope.routeReview })}`);
}
const dryRun = envelope.dryRun ?? {};
if (dryRun.mode !== "dry_run"
  || dryRun.command !== "systemctl"
  || !dryRun.args?.includes("restart")
  || !dryRun.args?.includes("openclaw-system-sense.service")
  || dryRun.wouldExecute !== false
  || dryRun.risk !== "high"
  || dryRun.requiresApproval !== true) {
  throw new Error(`next repair dry-run should expose high-risk no-execute command envelope: ${JSON.stringify(dryRun)}`);
}
const checkNames = new Set((dryRun.checks ?? []).filter((check) => check.passed === true).map((check) => check.name));
for (const expected of [
  "no_execution",
  "route_review_selected_dry_run",
  "target_is_system_sense",
  "operator_visible_before_mutation",
  "no_restart_executed",
]) {
  if (!checkNames.has(expected)) {
    throw new Error(`next repair dry-run missing passed check ${expected}: ${JSON.stringify(dryRun.checks)}`);
  }
}
if (envelope.governance?.hostMutation !== false
  || envelope.governance?.canRestart !== false
  || envelope.governance?.createsTask !== false
  || envelope.governance?.createsApproval !== false
  || envelope.governance?.executesCommand !== false
  || envelope.governance?.futureExecutionRequiresSeparateMilestone !== true) {
  throw new Error(`next repair dry-run governance should stay non-mutating: ${JSON.stringify(envelope.governance)}`);
}
if (envelope.next?.recommendedSlice !== "openclaw-systemd-next-repair-task-route"
  || !String(envelope.next?.boundary ?? "").includes("route-review task materialization")) {
  throw new Error(`next repair dry-run should route toward task materialization review: ${JSON.stringify(envelope.next)}`);
}

console.log(JSON.stringify({
  openclawSystemdNextRepairDryRun: {
    status: "passed",
    registry: envelope.registry,
    target: envelope.target.unit,
    command: `${dryRun.command} ${dryRun.args.join(" ")}`,
    next: envelope.next.recommendedSlice,
  },
}, null, 2));
EOF

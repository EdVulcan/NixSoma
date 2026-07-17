#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_URL="https://www.baidu.com"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6500}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6501}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6502}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6503}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6504}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6505}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6506}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6507}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6570}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-approval-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-approval-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
EVENT_HUB_URL="http://127.0.0.1:$OPENCLAW_EVENT_HUB_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f \
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${ANONYMOUS_APPROVAL_READ_FILE:-}" \
    "${BLOCKED_TASK_FILE:-}" \
    "${PENDING_APPROVALS_FILE:-}" \
    "${BLOCKED_STEP_FILE:-}" \
    "${APPROVED_FILE:-}" \
    "${AFTER_APPROVE_FILE:-}" \
    "${RUN_RESULT_FILE:-}" \
    "${DENIED_TASK_FILE:-}" \
    "${DENY_PENDING_FILE:-}" \
    "${DENIED_FILE:-}" \
    "${FINAL_APPROVALS_FILE:-}" \
    "${APPROVAL_EVENTS_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");

for (const token of ["Approval Inbox", "approval-pending-count", "approve-latest-button", "deny-latest-button"]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of ["/approvals?limit=10", "approval.created", "approval.approved", "approval.denied", "refreshApprovalState"]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
EOF

ANONYMOUS_APPROVAL_READ_FILE="$(mktemp)"
anonymous_approval_read_status="$(command curl --silent --output "$ANONYMOUS_APPROVAL_READ_FILE" --write-out "%{http_code}" "$CORE_URL/approvals?limit=10")"
if [[ "$anonymous_approval_read_status" != "401" ]]; then
  echo "anonymous approval read should be rejected with HTTP 401, got $anonymous_approval_read_status" >&2
  cat "$ANONYMOUS_APPROVAL_READ_FILE" >&2
  exit 1
fi

BLOCKED_TASK_FILE="$(mktemp)"
PENDING_APPROVALS_FILE="$(mktemp)"
BLOCKED_STEP_FILE="$(mktemp)"
post_json "$CORE_URL/tasks/plan" "{\"goal\":\"Upload requires approval\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_URL\",\"policy\":{\"intent\":\"data.upload\"},\"actions\":[{\"kind\":\"keyboard.type\",\"params\":{\"text\":\"approved upload\"}}]}" > "$BLOCKED_TASK_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$PENDING_APPROVALS_FILE"
post_json "$CORE_URL/operator/step" '{}' > "$BLOCKED_STEP_FILE"
approval_id="$(node - <<'EOF' "$PENDING_APPROVALS_FILE" "$BLOCKED_STEP_FILE"
const fs = require("node:fs");
const pending = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const blocked = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
if (!pending.ok || pending.count !== 1 || pending.summary?.pendingCount !== 1) {
  throw new Error("expected one pending approval request");
}
if (!blocked.ok || blocked.ran !== false || blocked.blocked !== true || blocked.reason !== "policy_requires_approval") {
  throw new Error("operator should block on approval request");
}
if (!blocked.approval?.id || blocked.approval.id !== pending.items[0].id) {
  throw new Error("operator response should point at the pending approval");
}
process.stdout.write(pending.items[0].id);
EOF
)"

APPROVED_FILE="$(mktemp)"
AFTER_APPROVE_FILE="$(mktemp)"
RUN_RESULT_FILE="$(mktemp)"
post_json "$CORE_URL/approvals/$approval_id/approve" '{"approvedBy":"dev-approval-check","reason":"test approval"}' > "$APPROVED_FILE"
curl --silent --fail "$CORE_URL/approvals/summary" > "$AFTER_APPROVE_FILE"
post_json "$CORE_URL/operator/run" '{"maxSteps":2}' > "$RUN_RESULT_FILE"

DENIED_TASK_FILE="$(mktemp)"
DENY_PENDING_FILE="$(mktemp)"
post_json "$CORE_URL/tasks/plan" "{\"goal\":\"Denied upload stays inside user sovereignty\",\"type\":\"browser_task\",\"targetUrl\":\"$TARGET_URL\",\"policy\":{\"intent\":\"data.upload\"},\"actions\":[{\"kind\":\"keyboard.type\",\"params\":{\"text\":\"denied upload\"}}]}" > "$DENIED_TASK_FILE"
curl --silent --fail "$CORE_URL/approvals?status=pending&limit=10" > "$DENY_PENDING_FILE"
deny_id="$(node - <<'EOF' "$DENY_PENDING_FILE"
const fs = require("node:fs");
const pending = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (!pending.ok || pending.count !== 1) {
  throw new Error("expected one pending approval request for denial path");
}
process.stdout.write(pending.items[0].id);
EOF
)"
DENIED_FILE="$(mktemp)"
FINAL_APPROVALS_FILE="$(mktemp)"
APPROVAL_EVENTS_FILE="$(mktemp)"
post_json "$CORE_URL/approvals/$deny_id/deny" '{"deniedBy":"dev-approval-check","reason":"test denial"}' > "$DENIED_FILE"
curl --silent --fail "$CORE_URL/approvals?limit=10" > "$FINAL_APPROVALS_FILE"
curl --silent --fail "$EVENT_HUB_URL/events/audit?source=openclaw-core&limit=50" > "$APPROVAL_EVENTS_FILE"

node - <<'EOF' \
  "$BLOCKED_TASK_FILE" \
  "$PENDING_APPROVALS_FILE" \
  "$BLOCKED_STEP_FILE" \
  "$APPROVED_FILE" \
  "$AFTER_APPROVE_FILE" \
  "$RUN_RESULT_FILE" \
  "$DENIED_TASK_FILE" \
  "$DENIED_FILE" \
  "$FINAL_APPROVALS_FILE" \
  "$APPROVAL_EVENTS_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));
const blockedTask = readJson(2);
const pendingApprovals = readJson(3);
const blockedStep = readJson(4);
const approved = readJson(5);
const afterApprove = readJson(6);
const runResult = readJson(7);
const deniedTask = readJson(8);
const denied = readJson(9);
const finalApprovals = readJson(10);
const approvalEvents = readJson(11);

if (blockedTask.task?.approval?.required !== true || blockedTask.task?.policy?.decision?.decision !== "require_approval") {
  throw new Error("blocked task should carry a required approval");
}
if (pendingApprovals.items[0]?.taskId !== blockedTask.task?.id || pendingApprovals.items[0]?.status !== "pending") {
  throw new Error("pending approval should link to blocked task");
}
if (blockedStep.approval?.status !== "pending") {
  throw new Error("blocked operator step should include pending approval details");
}
if (!approved.ok || approved.approval?.status !== "approved" || approved.task?.policy?.decision?.decision !== "audit_only") {
  throw new Error("approval should convert task policy to audited execution");
}
if (afterApprove.summary?.counts?.approved !== 1 || afterApprove.summary?.pendingCount !== 0) {
  throw new Error("approval summary should show approved request and no pending requests");
}
if (!runResult.ok || runResult.ran !== true || runResult.steps?.[0]?.task?.status !== "completed") {
  throw new Error("approved task should run to completion");
}
if (runResult.steps?.[0]?.policy?.decision !== "audit_only") {
  throw new Error("approved execution should remain audited");
}
if (deniedTask.task?.approval?.required !== true) {
  throw new Error("denial path task should create pending approval");
}
if (!denied.ok || denied.approval?.status !== "denied" || denied.task?.status !== "failed") {
  throw new Error("denying an approval should fail the active task");
}
const counts = finalApprovals.summary?.counts ?? {};
if (counts.approved !== 1 || counts.denied !== 1 || counts.pending !== 0) {
  throw new Error("final approval counts should show one approved, one denied, and no pending");
}
const eventTypes = new Set((approvalEvents.items ?? []).map((event) => event.type));
for (const type of ["approval.created", "approval.approved", "approval.denied"]) {
  if (!eventTypes.has(type)) {
    throw new Error(`audit log missing ${type}`);
  }
}

console.log(JSON.stringify({
  approvalInbox: {
    total: finalApprovals.summary?.counts?.total ?? 0,
    pending: counts.pending,
    approved: counts.approved,
    denied: counts.denied,
  },
  blockedGate: {
    taskId: blockedTask.task?.id ?? null,
    approvalId: pendingApprovals.items[0]?.id ?? null,
    operatorReason: blockedStep.reason,
  },
  approvedExecution: {
    taskStatus: runResult.steps?.[0]?.task?.status ?? null,
    policyDecision: runResult.steps?.[0]?.policy?.decision ?? null,
  },
  deniedExecution: {
    taskStatus: denied.task?.status ?? null,
    approvalStatus: denied.approval?.status ?? null,
  },
  auditEvents: [...eventTypes].filter((type) => type.startsWith("approval.")),
}, null, 2));
EOF

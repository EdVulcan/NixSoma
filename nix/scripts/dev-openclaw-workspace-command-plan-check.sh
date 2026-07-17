#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-workspace-command-plan-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-8670}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-8671}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-8672}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-8673}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-8674}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-8675}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-8676}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-8677}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-8740}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-workspace-command-plan-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-workspace-command-plan-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/apps" "$WORKSPACE_DIR/packages" "$WORKSPACE_DIR/.git"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-command-plan-fixture",
  "private": true,
  "scripts": {
    "dev": "echo secret-dev-plan-body",
    "test": "echo secret-test-plan-body",
    "typecheck": "echo secret-typecheck-plan-body"
  },
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
JSON
cat > "$WORKSPACE_DIR/pnpm-workspace.yaml" <<'YAML'
packages:
  - "apps/*"
  - "packages/*"
YAML

cleanup() {
  rm -f \
    "${TASKS_BEFORE_FILE:-}" \
    "${APPROVALS_BEFORE_FILE:-}" \
    "${PLAN_FILE:-}" \
    "${MISSING_FILE:-}" \
    "${TASKS_AFTER_FILE:-}" \
    "${APPROVALS_AFTER_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

TASKS_BEFORE_FILE="$(mktemp)"
APPROVALS_BEFORE_FILE="$(mktemp)"
PLAN_FILE="$(mktemp)"
MISSING_FILE="$(mktemp)"
TASKS_AFTER_FILE="$(mktemp)"
APPROVALS_AFTER_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/tasks/summary" > "$TASKS_BEFORE_FILE"
curl --silent --fail "$CORE_URL/approvals/summary" > "$APPROVALS_BEFORE_FILE"
curl --silent --fail "$CORE_URL/workspaces/command-proposals/plan?proposalId=openclaw:typecheck" > "$PLAN_FILE"
curl --silent --output "$MISSING_FILE" --write-out "%{http_code}" "$CORE_URL/workspaces/command-proposals/plan?proposalId=openclaw:missing" | grep -qx "404"
curl --silent --fail "$CORE_URL/tasks/summary" > "$TASKS_AFTER_FILE"
curl --silent --fail "$CORE_URL/approvals/summary" > "$APPROVALS_AFTER_FILE"

node - <<'EOF' "$TASKS_BEFORE_FILE" "$APPROVALS_BEFORE_FILE" "$PLAN_FILE" "$MISSING_FILE" "$TASKS_AFTER_FILE" "$APPROVALS_AFTER_FILE" "$WORKSPACE_DIR"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const tasksBefore = readJson(2);
const approvalsBefore = readJson(3);
const planDraft = readJson(4);
const missing = readJson(5);
const tasksAfter = readJson(6);
const approvalsAfter = readJson(7);
const workspaceDir = process.argv[8];
const rawDraft = JSON.stringify(planDraft);
const secretBodies = [
  "secret-dev-plan-body",
  "secret-test-plan-body",
  "secret-typecheck-plan-body",
];

if (!planDraft.ok || planDraft.registry !== "workspace-command-plan-draft-v0" || planDraft.mode !== "plan-only") {
  throw new Error(`workspace command plan draft should expose plan-only mode: ${JSON.stringify(planDraft)}`);
}
if (planDraft.sourceRegistry !== "workspace-command-proposals-v0") {
  throw new Error(`workspace command plan draft should derive from command proposals: ${JSON.stringify(planDraft)}`);
}
const proposal = planDraft.proposal ?? {};
if (proposal.id !== "openclaw:typecheck" || proposal.scriptName !== "typecheck" || proposal.command !== "pnpm") {
  throw new Error(`workspace command plan should reference selected proposal: ${JSON.stringify(proposal)}`);
}
const draft = planDraft.draft ?? {};
if (
  draft.type !== "system_task"
  || draft.action?.kind !== "system.command.execute"
  || draft.action?.params?.command !== "pnpm"
  || draft.action?.params?.args?.join(" ") !== "run typecheck"
  || draft.action?.params?.cwd !== workspaceDir
) {
  throw new Error(`workspace command plan should expose safe command action shape: ${JSON.stringify(draft.action)}`);
}
if (
  draft.policy?.request?.intent !== "system.command.execute"
  || draft.policy?.request?.requiresApproval !== true
  || draft.policy?.decision?.decision !== "require_approval"
  || draft.policy?.decision?.reason !== "workspace_command_requires_explicit_user_approval"
) {
  throw new Error(`workspace command plan should require explicit approval: ${JSON.stringify(draft.policy)}`);
}
if (
  draft.governance?.createsTask !== false
  || draft.governance?.createsApproval !== false
  || draft.governance?.canExecute !== false
  || draft.governance?.requiresExplicitApproval !== true
  || draft.governance?.exposesScriptBody !== false
) {
  throw new Error(`workspace command plan draft should remain inert: ${JSON.stringify(draft.governance)}`);
}
if (
  draft.plan?.status !== "planned"
  || draft.plan?.capabilitySummary?.ids?.includes("act.system.command.execute") !== true
  || draft.plan?.capabilitySummary?.approvalGates < 1
) {
  throw new Error(`workspace command plan should surface command execution capability gate: ${JSON.stringify(draft.plan?.capabilitySummary)}`);
}
if (secretBodies.some((secret) => rawDraft.includes(secret))) {
  throw new Error("workspace command plan draft must not expose package.json script bodies");
}
if (tasksBefore.summary?.counts?.total !== tasksAfter.summary?.counts?.total) {
  throw new Error(`plan draft should not create tasks: ${JSON.stringify({ before: tasksBefore.summary, after: tasksAfter.summary })}`);
}
if (
  approvalsBefore.summary?.counts?.total !== approvalsAfter.summary?.counts?.total
  || approvalsAfter.summary?.counts?.pending !== approvalsBefore.summary?.counts?.pending
) {
  throw new Error(`plan draft should not create approvals: ${JSON.stringify({ before: approvalsBefore.summary, after: approvalsAfter.summary })}`);
}
if (missing.ok !== false || !String(missing.error ?? "").includes("not found")) {
  throw new Error(`missing proposal should return a not-found error: ${JSON.stringify(missing)}`);
}

console.log(JSON.stringify({
  openclawWorkspaceCommandPlan: {
    registry: planDraft.registry,
    mode: planDraft.mode,
    proposal: {
      id: proposal.id,
      scriptName: proposal.scriptName,
      command: proposal.command,
      args: proposal.args,
      cwd: proposal.cwd,
    },
    policy: draft.policy,
    governance: draft.governance,
    capabilitySummary: draft.plan.capabilitySummary,
    unchangedState: {
      tasks: tasksAfter.summary,
      approvals: approvalsAfter.summary,
    },
    endpoints: [
      "/workspaces/command-proposals/plan?proposalId=openclaw:typecheck",
    ],
  },
}, null, 2));
EOF

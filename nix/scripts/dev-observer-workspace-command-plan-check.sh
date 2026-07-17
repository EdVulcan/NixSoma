#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-workspace-command-plan-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-8680}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-8681}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-8682}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-8683}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-8684}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-8685}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-8686}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-8687}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-8750}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-workspace-command-plan-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-workspace-command-plan-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/apps" "$WORKSPACE_DIR/packages" "$WORKSPACE_DIR/.git"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-observer-command-plan-fixture",
  "private": true,
  "scripts": {
    "dev": "echo observer-secret-dev-plan-body",
    "test": "echo observer-secret-test-plan-body",
    "typecheck": "echo observer-secret-typecheck-plan-body"
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
    "${HTML_FILE:-}" \
    "${CLIENT_FILE:-}" \
    "${TASKS_BEFORE_FILE:-}" \
    "${APPROVALS_BEFORE_FILE:-}" \
    "${PLAN_FILE:-}" \
    "${TASKS_AFTER_FILE:-}" \
    "${APPROVALS_AFTER_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
TASKS_BEFORE_FILE="$(mktemp)"
APPROVALS_BEFORE_FILE="$(mktemp)"
PLAN_FILE="$(mktemp)"
TASKS_AFTER_FILE="$(mktemp)"
APPROVALS_AFTER_FILE="$(mktemp)"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/tasks/summary" > "$TASKS_BEFORE_FILE"
curl --silent --fail "$CORE_URL/approvals/summary" > "$APPROVALS_BEFORE_FILE"
curl --silent --fail "$CORE_URL/workspaces/command-proposals/plan?proposalId=openclaw:typecheck" > "$PLAN_FILE"
curl --silent --fail "$CORE_URL/tasks/summary" > "$TASKS_AFTER_FILE"
curl --silent --fail "$CORE_URL/approvals/summary" > "$APPROVALS_AFTER_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$TASKS_BEFORE_FILE" "$APPROVALS_BEFORE_FILE" "$PLAN_FILE" "$TASKS_AFTER_FILE" "$APPROVALS_AFTER_FILE" "$WORKSPACE_DIR"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const tasksBefore = readJson(4);
const approvalsBefore = readJson(5);
const planDraft = readJson(6);
const tasksAfter = readJson(7);
const approvalsAfter = readJson(8);
const workspaceDir = process.argv[9];
const rawDraft = JSON.stringify(planDraft);
const secretBodies = [
  "observer-secret-dev-plan-body",
  "observer-secret-test-plan-body",
  "observer-secret-typecheck-plan-body",
];

const requiredHtml = [
  "workspace-command-plan-registry",
  "workspace-command-plan-proposal",
  "workspace-command-plan-decision",
  "workspace-command-plan-approval",
  "workspace-command-plan-task",
  "workspace-command-plan-mode",
  "workspace-command-plan-json",
];
const requiredClient = [
  "/workspaces/command-proposals/plan?proposalId=openclaw:typecheck",
  "renderWorkspaceCommandPlanDraft",
  "refreshWorkspaceCommandPlanDraft",
  "Plan-only draft: no task, approval, or command execution is created.",
  "Script bodies are not displayed.",
];

for (const token of requiredHtml) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of requiredClient) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}

const draft = planDraft.draft ?? {};
if (!planDraft.ok || planDraft.registry !== "workspace-command-plan-draft-v0" || planDraft.mode !== "plan-only") {
  throw new Error(`workspace command plan draft should expose plan-only mode: ${JSON.stringify(planDraft)}`);
}
if (
  planDraft.proposal?.id !== "openclaw:typecheck"
  || draft.action?.params?.command !== "pnpm"
  || draft.action?.params?.args?.join(" ") !== "run typecheck"
  || draft.action?.params?.cwd !== workspaceDir
) {
  throw new Error(`workspace command plan should expose selected command shape: ${JSON.stringify({ proposal: planDraft.proposal, action: draft.action })}`);
}
if (
  draft.policy?.decision?.decision !== "require_approval"
  || draft.governance?.createsTask !== false
  || draft.governance?.createsApproval !== false
  || draft.governance?.canExecute !== false
  || draft.governance?.requiresExplicitApproval !== true
  || draft.governance?.exposesScriptBody !== false
) {
  throw new Error(`workspace command plan should remain inert and approval-gated: ${JSON.stringify({ policy: draft.policy, governance: draft.governance })}`);
}
if (draft.plan?.capabilitySummary?.ids?.includes("act.system.command.execute") !== true || draft.plan?.capabilitySummary?.approvalGates < 1) {
  throw new Error(`workspace command plan should expose command execution approval gate: ${JSON.stringify(draft.plan?.capabilitySummary)}`);
}
if (secretBodies.some((secret) => rawDraft.includes(secret))) {
  throw new Error("workspace command plan draft must not expose package.json script bodies");
}
if (tasksBefore.summary?.counts?.total !== tasksAfter.summary?.counts?.total) {
  throw new Error(`observer plan draft should not create tasks: ${JSON.stringify({ before: tasksBefore.summary, after: tasksAfter.summary })}`);
}
if (
  approvalsBefore.summary?.counts?.total !== approvalsAfter.summary?.counts?.total
  || approvalsBefore.summary?.counts?.pending !== approvalsAfter.summary?.counts?.pending
) {
  throw new Error(`observer plan draft should not create approvals: ${JSON.stringify({ before: approvalsBefore.summary, after: approvalsAfter.summary })}`);
}

console.log(JSON.stringify({
  observerWorkspaceCommandPlan: {
    htmlMetrics: requiredHtml,
    clientApis: [
      "/workspaces/command-proposals/plan?proposalId=openclaw:typecheck",
      "renderWorkspaceCommandPlanDraft",
    ],
    proposal: {
      id: planDraft.proposal.id,
      command: planDraft.proposal.command,
      args: planDraft.proposal.args,
    },
    policy: draft.policy,
    governance: draft.governance,
    capabilitySummary: draft.plan.capabilitySummary,
    unchangedState: {
      tasks: tasksAfter.summary,
      approvals: approvalsAfter.summary,
    },
  },
}, null, 2));
EOF

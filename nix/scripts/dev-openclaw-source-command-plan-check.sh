#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-source-command-plan-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
TOOLS_DIR="$WORKSPACE_DIR/src/agents/tools"
DOCS_TOOLS_DIR="$WORKSPACE_DIR/docs/tools"
PROMPT_SECRET="SOURCE_COMMAND_PLAN_PROMPT_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9730}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9731}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9732}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9733}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9734}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9735}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9736}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9737}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9800}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-source-command-plan-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-source-command-plan-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$TOOLS_DIR" "$DOCS_TOOLS_DIR"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "private": true,
  "scripts": {
    "dev": "echo source-command-plan-secret-dev",
    "test": "echo source-command-plan-secret-test",
    "typecheck": "echo source-command-plan-secret-typecheck"
  }
}
JSON
cat > "$WORKSPACE_DIR/pnpm-workspace.yaml" <<'YAML'
packages:
  - "packages/*"
YAML
cat > "$WORKSPACE_DIR/TOOLS.md" <<EOF
# Tools
Command and process plans must be plan-only, require approval before execution, and hide script bodies.
$PROMPT_SECRET
EOF
cat > "$DOCS_TOOLS_DIR/command-runner.md" <<'MD'
# Command Runner
Draft command plans from shell and process metadata without executing them.
MD
cat > "$TOOLS_DIR/command-tool.ts" <<'TS'
export function commandPlanTool() {
  const secret = "SOURCE_COMMAND_PLAN_TOOL_SECRET_DO_NOT_LEAK";
  return { kind: "command-plan", secret };
}
TS
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{"name":"@openclaw/plugin-sdk","private":false,"types":"./types/index.d.ts","exports":{".":"./dist/index.js"}}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export function createSourceCommandPlanContract() {
  return { capabilityId: "source-command-plan" };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type SourceCommandPlanManifest = { pluginId: string };
TS

cleanup() {
  rm -f "${TASKS_BEFORE_FILE:-}" "${APPROVALS_BEFORE_FILE:-}" "${PLAN_FILE:-}" "${MISSING_FILE:-}" "${TASKS_AFTER_FILE:-}" "${APPROVALS_AFTER_FILE:-}"
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
curl --silent --fail "$CORE_URL/plugins/native-adapter/source-command-proposals/plan?proposalId=openclaw:typecheck&query=command" > "$PLAN_FILE"
curl --silent --output "$MISSING_FILE" --write-out "%{http_code}" "$CORE_URL/plugins/native-adapter/source-command-proposals/plan?proposalId=openclaw:missing&query=command" | grep -qx "404"
curl --silent --fail "$CORE_URL/tasks/summary" > "$TASKS_AFTER_FILE"
curl --silent --fail "$CORE_URL/approvals/summary" > "$APPROVALS_AFTER_FILE"

node - <<'EOF' "$TASKS_BEFORE_FILE" "$APPROVALS_BEFORE_FILE" "$PLAN_FILE" "$MISSING_FILE" "$TASKS_AFTER_FILE" "$APPROVALS_AFTER_FILE" "$WORKSPACE_DIR" "$PROMPT_SECRET"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const tasksBefore = readJson(2);
const approvalsBefore = readJson(3);
const planDraft = readJson(4);
const missing = readJson(5);
const tasksAfter = readJson(6);
const approvalsAfter = readJson(7);
const workspaceDir = process.argv[8];
const promptSecret = process.argv[9];
const raw = JSON.stringify(planDraft);

if (
  !planDraft.ok
  || planDraft.registry !== "openclaw-source-command-plan-draft-v0"
  || planDraft.mode !== "plan-only-source-command"
  || planDraft.sourceRegistry !== "openclaw-source-command-proposals-v0"
  || planDraft.sourceCommandPlan?.registry !== "openclaw-source-command-plan-draft-v0"
  || planDraft.sourceCommandSignals?.registry !== "openclaw-source-command-proposals-v0"
  || planDraft.sourceCommandProposal?.sourceCommand?.registry !== "openclaw-source-command-proposals-v0"
) {
  throw new Error(`source command plan envelope mismatch: ${JSON.stringify(planDraft)}`);
}
const proposal = planDraft.sourceCommandProposal ?? {};
const draft = planDraft.draft ?? {};
if (
  proposal.id !== "openclaw:typecheck"
  || proposal.command !== "pnpm"
  || proposal.args?.join(" ") !== "run typecheck"
  || proposal.workspacePath !== workspaceDir
  || draft.action?.params?.command !== "pnpm"
  || draft.action?.params?.args?.join(" ") !== "run typecheck"
  || draft.action?.params?.cwd !== workspaceDir
) {
  throw new Error(`source command plan selected wrong command shape: ${JSON.stringify({ proposal, action: draft.action })}`);
}
if (
  draft.policy?.request?.requiresApproval !== true
  || draft.policy?.decision?.decision !== "require_approval"
  || draft.governance?.createsTask !== false
  || draft.governance?.createsApproval !== false
  || draft.governance?.canExecute !== false
  || draft.governance?.canMutate !== false
  || draft.governance?.exposesScriptBody !== false
  || draft.governance?.exposesPromptContent !== false
  || draft.governance?.exposesSourceFileContent !== false
  || planDraft.governance?.createsTask !== false
  || planDraft.governance?.createsApproval !== false
  || planDraft.governance?.canExecute !== false
) {
  throw new Error(`source command plan should remain inert and approval-gated: ${JSON.stringify({ draft: draft.governance, top: planDraft.governance, policy: draft.policy })}`);
}
if (
  draft.plan?.status !== "planned"
  || draft.plan?.capabilitySummary?.ids?.includes("act.system.command.execute") !== true
  || draft.plan?.capabilitySummary?.approvalGates < 1
) {
  throw new Error(`source command plan should preserve command execution approval gate: ${JSON.stringify(draft.plan?.capabilitySummary)}`);
}
if (tasksBefore.summary?.counts?.total !== tasksAfter.summary?.counts?.total) {
  throw new Error(`source command plan should not create tasks: ${JSON.stringify({ before: tasksBefore.summary, after: tasksAfter.summary })}`);
}
if (approvalsBefore.summary?.counts?.total !== approvalsAfter.summary?.counts?.total) {
  throw new Error(`source command plan should not create approvals: ${JSON.stringify({ before: approvalsBefore.summary, after: approvalsAfter.summary })}`);
}
for (const secret of [
  promptSecret,
  "source-command-plan-secret-dev",
  "source-command-plan-secret-test",
  "source-command-plan-secret-typecheck",
  "SOURCE_COMMAND_PLAN_TOOL_SECRET_DO_NOT_LEAK",
]) {
  if (raw.includes(secret)) {
    throw new Error(`source command plan leaked body content: ${secret}`);
  }
}
if (missing.ok !== false || !String(missing.error ?? "").includes("not found")) {
  throw new Error(`missing source command proposal should return not-found: ${JSON.stringify(missing)}`);
}

console.log(JSON.stringify({
  openclawSourceCommandPlan: {
    registry: planDraft.registry,
    mode: planDraft.mode,
    proposal: proposal.id,
    command: planDraft.sourceCommandPlan.commandShape,
    governance: planDraft.governance,
  },
}, null, 2));
EOF

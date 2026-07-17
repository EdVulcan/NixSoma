#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-native-plugin-invoke-plan-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9180}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9181}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9182}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9183}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9184}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9185}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9186}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9187}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9250}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-native-plugin-invoke-plan-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-native-plugin-invoke-plan-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p \
  "$WORKSPACE_DIR/.git" \
  "$WORKSPACE_DIR/.openclaw" \
  "$WORKSPACE_DIR/extensions/provider-a" \
  "$WORKSPACE_DIR/extensions/provider-b" \
  "$WORKSPACE_DIR/packages/memory-host-sdk" \
  "$PLUGIN_SDK_DIR/src" \
  "$PLUGIN_SDK_DIR/types" \
  "$WORKSPACE_DIR/qa/smoke" \
  "$WORKSPACE_DIR/skills" \
  "$WORKSPACE_DIR/src/core" \
  "$WORKSPACE_DIR/test/unit" \
  "$WORKSPACE_DIR/ui"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

for index in $(seq 1 9); do
  mkdir -p "$WORKSPACE_DIR/extensions/provider-extra-$index"
done

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{
  "name": "openclaw",
  "version": "0.0.0-invoke-plan-fixture",
  "private": true,
  "scripts": {
    "build": "echo INVOKE_PLAN_ROOT_SECRET_BUILD_BODY",
    "typecheck": "echo INVOKE_PLAN_ROOT_SECRET_TYPECHECK_BODY"
  }
}
JSON
cat > "$WORKSPACE_DIR/pnpm-workspace.yaml" <<'YAML'
packages:
  - "extensions/*"
  - "packages/*"
  - "ui"
YAML
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{
  "name": "@openclaw/plugin-sdk",
  "version": "0.0.0-invoke-plan-fixture",
  "private": false,
  "types": "./types/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./testing": "./dist/testing.js"
  },
  "scripts": {
    "build": "echo INVOKE_PLAN_SDK_SECRET_BUILD_BODY",
    "test": "echo INVOKE_PLAN_SDK_SECRET_TEST_BODY"
  },
  "dependencies": {
    "zod": "999.0.0-invoke-plan-secret-version"
  }
}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export const INVOKE_PLAN_SDK_SECRET_SOURCE_CONTENT = "must-not-leak";
TS

cleanup() {
  rm -f \
    "${PLAN_FILE:-}" \
    "${APPROVALS_FILE:-}" \
    "${HISTORY_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

PLAN_FILE="$(mktemp)"
APPROVALS_FILE="$(mktemp)"
HISTORY_FILE="$(mktemp)"

curl --silent --fail "$CORE_URL/plugins/native-adapter/invoke-plan" > "$PLAN_FILE"
curl --silent --fail "$CORE_URL/approvals?limit=10" > "$APPROVALS_FILE"
curl --silent --fail "$CORE_URL/capabilities/invocations?limit=10" > "$HISTORY_FILE"

node - <<'EOF' "$PLAN_FILE" "$APPROVALS_FILE" "$HISTORY_FILE"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));
const plan = readJson(2);
const approvals = readJson(3);
const history = readJson(4);
const raw = JSON.stringify({ plan, approvals, history });

if (
  !plan.ok
  || plan.registry !== "openclaw-native-plugin-invoke-plan-v0"
  || plan.mode !== "plan-only"
  || plan.capability?.id !== "act.plugin.capability.invoke"
  || plan.capability?.risk !== "high"
  || plan.capability?.approvalRequired !== true
  || plan.policy?.decision?.decision !== "require_approval"
  || plan.policy?.decision?.reason !== "native_plugin_capability_invoke_requires_explicit_user_approval"
  || plan.governance?.createsTask !== false
  || plan.governance?.createsApproval !== false
  || plan.governance?.canExecutePluginCode !== false
  || plan.governance?.canActivateRuntime !== false
  || plan.governance?.canReadSourceFileContent !== false
  || plan.governance?.requiresExplicitApprovalBeforeTask !== true
  || plan.governance?.requiresRuntimeAdapterBeforeExecution !== true
) {
  throw new Error(`native plugin invoke plan mismatch: ${JSON.stringify(plan)}`);
}
if (!Array.isArray(plan.draft?.steps) || plan.draft.steps.length < 3 || plan.draft.steps.some((step) => step.canExecute !== false)) {
  throw new Error(`native plugin invoke plan steps should be non-executable: ${JSON.stringify(plan.draft?.steps)}`);
}
if (!plan.blockers?.includes("runtime adapter implementation not approved") || !plan.blockers?.includes("explicit user approval not collected")) {
  throw new Error(`native plugin invoke plan should expose blockers: ${JSON.stringify(plan.blockers)}`);
}
if ((approvals.items ?? []).some((approval) => approval.status === "pending")) {
  throw new Error(`plan-only native plugin invoke must not create pending approvals: ${JSON.stringify(approvals.items)}`);
}
if ((history.items ?? []).some((entry) => entry.capability?.id === "act.plugin.capability.invoke")) {
  throw new Error(`plan-only native plugin invoke must not record capability execution: ${JSON.stringify(history.items)}`);
}
for (const secret of [
  "INVOKE_PLAN_ROOT_SECRET_BUILD_BODY",
  "INVOKE_PLAN_ROOT_SECRET_TYPECHECK_BODY",
  "INVOKE_PLAN_SDK_SECRET_BUILD_BODY",
  "INVOKE_PLAN_SDK_SECRET_TEST_BODY",
  "INVOKE_PLAN_SDK_SECRET_SOURCE_CONTENT",
  "999.0.0-invoke-plan-secret-version",
  "0.0.0-invoke-plan-fixture",
]) {
  if (raw.includes(secret)) {
    throw new Error(`invoke plan must not expose source contents, script bodies, dependency versions, or package versions: ${secret}`);
  }
}

console.log(JSON.stringify({
  openclawNativePluginInvokePlan: {
    registry: plan.registry,
    mode: plan.mode,
    capability: plan.capability.id,
    decision: plan.policy.decision.decision,
    createsTask: plan.governance.createsTask,
    createsApproval: plan.governance.createsApproval,
    canExecutePluginCode: plan.governance.canExecutePluginCode,
    blockers: plan.blockers,
  },
}, null, 2));
EOF

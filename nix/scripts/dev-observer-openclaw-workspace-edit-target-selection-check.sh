#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-workspace-edit-target-selection-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
TOOLS_DIR="$WORKSPACE_DIR/src/agents/tools"
TARGET_RELATIVE_PATH="src/agents/tools/edit-target-tool.ts"
TARGET_FILE="$WORKSPACE_DIR/$TARGET_RELATIVE_PATH"
UNRELATED_SECRET="OBSERVER_EDIT_TARGET_SELECTION_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9640}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9641}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9642}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9643}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9644}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9645}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9646}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9647}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9710}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-edit-target-selection-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-openclaw-edit-target-selection-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$TOOLS_DIR"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{"name":"openclaw","private":true}
JSON
cat > "$WORKSPACE_DIR/pnpm-workspace.yaml" <<'YAML'
packages:
  - "packages/*"
YAML
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{"name":"@openclaw/plugin-sdk","private":false,"types":"./types/index.d.ts","exports":{".":"./dist/index.js"}}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export function createObserverEditTargetSelectionContract() {
  return { capabilityId: "observer-edit-target-selection" };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type ObserverEditTargetSelectionManifest = { pluginId: string };
TS
cat > "$TARGET_FILE" <<EOF
export function editTargetTool() {
  const before = "before";
  const marker = "$UNRELATED_SECRET";
  const omega = "omega";
  return { before, omega, marker };
}
EOF

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${SELECTION_FILE:-}" "${DRAFT_FILE:-}" "${CAPABILITY_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
SELECTION_FILE="$(mktemp)"
DRAFT_FILE="$(mktemp)"
CAPABILITY_FILE="$(mktemp)"
EDITS_JSON='[{"search":"before","replacement":"after","occurrence":1},{"search":"omega","replacement":"zeta","occurrence":1}]'
EDITS_ENCODED="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$EDITS_JSON")"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/workspace-edit-target-selection?scope=tools&query=edit&limit=8" > "$SELECTION_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/workspace-patch-apply/draft?edits=$EDITS_ENCODED&deriveProposalFromSource=true&proposalQuery=edit&selectTargetFromSource=true&targetSelectionQuery=edit&contextLines=0" > "$DRAFT_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d "{\"capabilityId\":\"sense.openclaw.workspace_edit_target_select\",\"params\":{\"workspacePath\":\"$WORKSPACE_DIR\",\"scope\":\"tools\",\"query\":\"edit\",\"limit\":8}}" \
  "$CORE_URL/capabilities/invoke" > "$CAPABILITY_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$SELECTION_FILE" "$DRAFT_FILE" "$CAPABILITY_FILE" "$TARGET_RELATIVE_PATH" "$UNRELATED_SECRET"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const selection = readJson(4);
const draft = readJson(5);
const capability = readJson(6);
const expectedTarget = process.argv[7];
const unrelatedSecret = process.argv[8];
const raw = JSON.stringify({ html, client, selection, draft, capability });

for (const token of [
  "OpenClaw Edit Target Selection",
  "edit-target-selection-registry",
  "openclaw-native-workspace-edit-target-selection-v0",
  "/capabilities/invoke",
  "sense.openclaw.workspace_edit_target_select",
  "Target Selection: registry=",
  "selectTargetFromSource=true",
]) {
  if (!raw.includes(token)) {
    throw new Error(`Observer edit target selection missing ${token}`);
  }
}
if (client.includes("observerConfig.coreUrl}/plugins/native-adapter/workspace-edit-target-selection")) {
  throw new Error("Observer edit target refresh must use the common capability runtime");
}
if (
  !selection.ok
  || selection.selectedTarget?.relativePath !== expectedTarget
  || selection.governance?.exposesSourceFileContent !== false
) {
  throw new Error(`Observer target selection mismatch: ${JSON.stringify(selection)}`);
}
if (
  !draft.ok
  || draft.targetSelection?.selectedTarget?.relativePath !== expectedTarget
  || draft.target?.relativePath !== expectedTarget
  || draft.proposal?.source !== "openclaw-source-derived-edit-proposal-v0"
) {
  throw new Error(`Observer target-selected draft mismatch: ${JSON.stringify(draft)}`);
}
if (
  !capability.ok
  || capability.invoked !== true
  || capability.capability?.id !== "sense.openclaw.workspace_edit_target_select"
  || capability.summary?.kind !== "openclaw.workspace_edit_target_select"
  || capability.summary?.registry !== "openclaw-native-workspace-edit-target-selection-v0"
  || capability.summary?.selected !== true
  || capability.summary?.selectedTarget !== expectedTarget
  || capability.summary?.canFeedPatchProposal !== true
  || capability.summary?.noSourceContentExposure !== true
  || capability.summary?.noMutation !== true
  || capability.summary?.noTaskCreation !== true
  || capability.summary?.noApprovalCreation !== true
  || capability.summary?.noPluginExecution !== true
  || capability.summary?.noRuntimeActivation !== true
  || capability.summary?.canCallProvider !== false
  || capability.summary?.canUseNetwork !== false
  || capability.summary?.noProviderEgress !== true
) {
  throw new Error(`Observer workspace edit target capability mismatch: ${JSON.stringify(capability)}`);
}
for (const secret of [unrelatedSecret, "OBSERVER_EDIT_TARGET_SELECTION_SECRET_DO_NOT_LEAK"]) {
  if (raw.includes(secret)) {
    throw new Error(`Observer edit target selection leaked content: ${secret}`);
  }
}

console.log(JSON.stringify({
  observerOpenClawWorkspaceEditTargetSelection: {
    panel: "visible",
    selected: selection.selectedTarget.relativePath,
    draftTarget: draft.target.relativePath,
  },
}, null, 2));
EOF

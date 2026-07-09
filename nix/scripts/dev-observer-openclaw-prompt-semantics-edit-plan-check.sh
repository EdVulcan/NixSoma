#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/observer-openclaw-prompt-semantics-edit-plan-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
TOOLS_DIR="$WORKSPACE_DIR/src/agents/tools"
DOCS_TOOLS_DIR="$WORKSPACE_DIR/docs/tools"
TARGET_FILE="$WORKSPACE_DIR/src/agents/tools/edit-plan-tool.ts"
PROMPT_SECRET="OBSERVER_PROMPT_SEMANTICS_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9660}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9661}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9662}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9663}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9664}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9665}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9666}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9667}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9730}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-prompt-semantics-edit-plan-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/observer-openclaw-prompt-semantics-edit-plan-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -rf "$FIXTURE_DIR"
mkdir -p "$WORKSPACE_DIR/.git" "$WORKSPACE_DIR/.openclaw" "$PLUGIN_SDK_DIR/src" "$PLUGIN_SDK_DIR/types" "$TOOLS_DIR" "$DOCS_TOOLS_DIR"
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cat > "$WORKSPACE_DIR/package.json" <<'JSON'
{"name":"openclaw","private":true,"scripts":{"typecheck":"tsc --noEmit","test":"vitest run","lint":"eslint ."}}
JSON
cat > "$WORKSPACE_DIR/pnpm-workspace.yaml" <<'YAML'
packages:
  - "packages/*"
YAML
cat > "$WORKSPACE_DIR/TOOLS.md" <<EOF
# Tools
Patch edits should include plan rationale, diff preview, approval, typecheck, test, lint, and verify.
$PROMPT_SECRET
EOF
cat > "$DOCS_TOOLS_DIR/apply-patch.md" <<'MD'
# Apply Patch
Use prompt semantics to derive edit intent, expected checks, and safety boundaries.
MD
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{"name":"@openclaw/plugin-sdk","private":false,"types":"./types/index.d.ts","exports":{".":"./dist/index.js"}}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export function createObserverPromptSemanticsContract() {
  return { capabilityId: "observer-prompt-semantics" };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type ObserverPromptSemanticsManifest = { pluginId: string };
TS
cat > "$TARGET_FILE" <<'TS'
export function editPlanTool() {
  const before = "before";
  const omega = "omega";
  return { before, omega };
}
TS

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}" "${SEMANTICS_FILE:-}" "${DRAFT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
SEMANTICS_FILE="$(mktemp)"
DRAFT_FILE="$(mktemp)"
EDITS_JSON='[{"search":"before","replacement":"after","occurrence":1},{"search":"omega","replacement":"zeta","occurrence":1}]'
EDITS_ENCODED="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$EDITS_JSON")"

curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/prompt-semantics?query=edit&limit=24" > "$SEMANTICS_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/workspace-patch-apply/draft?edits=$EDITS_ENCODED&deriveProposalFromSource=true&proposalQuery=edit&selectTargetFromSource=true&targetSelectionQuery=edit&contextLines=0" > "$DRAFT_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE" "$SEMANTICS_FILE" "$DRAFT_FILE" "$PROMPT_SECRET"
const fs = require("node:fs");
const readText = (index) => fs.readFileSync(process.argv[index], "utf8");
const readJson = (index) => JSON.parse(readText(index));

const html = readText(2);
const client = readText(3);
const semantics = readJson(4);
const draft = readJson(5);
const promptSecret = process.argv[6];
const raw = JSON.stringify({ html, client, semantics, draft });

for (const token of [
  "OpenClaw Prompt Semantics",
  "prompt-semantics-registry",
  "openclaw-native-prompt-semantics-v0",
  "/plugins/native-adapter/prompt-semantics",
  "Edit Intent:",
  "Expected Checks:",
  "Work Standards:",
  "openclaw-engineering-work-standards-v0",
]) {
  if (!raw.includes(token)) {
    throw new Error(`Observer prompt semantics missing ${token}`);
  }
}
if (
  !semantics.ok
  || semantics.workStandards?.registry !== "openclaw-engineering-work-standards-v0"
  || semantics.workStandards?.status !== "ready_for_engineering_loop_guidance"
  || semantics.workStandards?.operatorContract?.promptWallEnforced !== false
  || semantics.workStandards?.governance?.canCreateTask !== false
  || semantics.governance?.exposesPromptContent !== false
  || !semantics.derivedPlanSemantics?.expectedChecks?.includes("typecheck")
  || !semantics.derivedPlanSemantics?.expectedChecks?.includes("test")
  || !semantics.derivedPlanSemantics?.expectedChecks?.includes("lint")
) {
  throw new Error(`Observer prompt semantics mismatch: ${JSON.stringify(semantics)}`);
}
if (
  !draft.ok
  || draft.proposal?.semanticPlan?.registry !== "openclaw-native-prompt-semantics-v0"
  || !draft.proposal?.expectedChecks?.includes("typecheck")
  || draft.proposalSourceSignals?.promptSignals?.contentExposed !== false
) {
  throw new Error(`Observer prompt-derived draft mismatch: ${JSON.stringify(draft.proposal)}`);
}
if (raw.includes(promptSecret)) {
  throw new Error("Observer prompt semantics leaked prompt body content");
}

console.log(JSON.stringify({
  observerOpenClawPromptSemanticsEditPlan: {
    panel: "visible",
    expectedChecks: semantics.derivedPlanSemantics.expectedChecks,
    workStandards: semantics.workStandards.score,
    proposalChecks: draft.proposal.expectedChecks,
  },
}, null, 2));
EOF

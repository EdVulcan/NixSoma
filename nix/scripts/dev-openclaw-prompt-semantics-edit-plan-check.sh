#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$REPO_ROOT/.artifacts/openclaw-prompt-semantics-edit-plan-fixture"
WORKSPACE_DIR="$FIXTURE_DIR/openclaw"
PLUGIN_SDK_DIR="$WORKSPACE_DIR/packages/plugin-sdk"
TOOLS_DIR="$WORKSPACE_DIR/src/agents/tools"
DOCS_TOOLS_DIR="$WORKSPACE_DIR/docs/tools"
TARGET_RELATIVE_PATH="src/agents/tools/edit-plan-tool.ts"
TARGET_FILE="$WORKSPACE_DIR/$TARGET_RELATIVE_PATH"
PROMPT_SECRET="PROMPT_SEMANTICS_SECRET_DO_NOT_LEAK"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-9650}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-9651}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-9652}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-9653}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-9654}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-9655}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-9656}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-9657}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-9720}"
export OPENCLAW_WORKSPACE_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_SYSTEM_ALLOWED_ROOTS="$WORKSPACE_DIR"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-prompt-semantics-edit-plan-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-prompt-semantics-edit-plan-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"

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
Plan every edit as a patch, show a diff preview, require approval, then verify with typecheck, test, and lint.
$PROMPT_SECRET
EOF
cat > "$DOCS_TOOLS_DIR/apply-patch.md" <<'MD'
# Apply Patch
Use edit intent, patch validation, diff review, approval, and filesystem ledger checks before writing.
MD
cat > "$PLUGIN_SDK_DIR/package.json" <<'JSON'
{"name":"@openclaw/plugin-sdk","private":false,"types":"./types/index.d.ts","exports":{".":"./dist/index.js"}}
JSON
cat > "$PLUGIN_SDK_DIR/src/index.ts" <<'TS'
export function createPromptSemanticsContract() {
  return { capabilityId: "prompt-semantics" };
}
TS
cat > "$PLUGIN_SDK_DIR/types/index.d.ts" <<'TS'
export type PromptSemanticsManifest = { pluginId: string };
TS
cat > "$TARGET_FILE" <<'TS'
export function editPlanTool() {
  const before = "before";
  const omega = "omega";
  return { before, omega };
}
TS

cleanup() {
  rm -f "${SEMANTICS_FILE:-}" "${DRAFT_FILE:-}" "${TASK_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"

SEMANTICS_FILE="$(mktemp)"
DRAFT_FILE="$(mktemp)"
TASK_FILE="$(mktemp)"
EDITS_JSON='[{"search":"before","replacement":"after","occurrence":1},{"search":"omega","replacement":"zeta","occurrence":1}]'
EDITS_ENCODED="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$EDITS_JSON")"

curl --silent --fail "$CORE_URL/plugins/native-adapter/prompt-semantics?query=edit&limit=24" > "$SEMANTICS_FILE"
curl --silent --fail "$CORE_URL/plugins/native-adapter/workspace-patch-apply/draft?edits=$EDITS_ENCODED&deriveProposalFromSource=true&proposalQuery=edit&selectTargetFromSource=true&targetSelectionQuery=edit&contextLines=0" > "$DRAFT_FILE"
curl --silent --fail \
  -H "content-type: application/json" \
  -d "{\"edits\":$EDITS_JSON,\"deriveProposalFromSource\":true,\"proposalQuery\":\"edit\",\"selectTargetFromSource\":true,\"targetSelectionQuery\":\"edit\",\"contextLines\":0,\"confirm\":true}" \
  "$CORE_URL/plugins/native-adapter/workspace-patch-apply-tasks" > "$TASK_FILE"

node - <<'EOF' "$SEMANTICS_FILE" "$DRAFT_FILE" "$TASK_FILE" "$PROMPT_SECRET"
const fs = require("node:fs");
const readJson = (index) => JSON.parse(fs.readFileSync(process.argv[index], "utf8"));

const semantics = readJson(2);
const draft = readJson(3);
const task = readJson(4);
const promptSecret = process.argv[5];
const raw = JSON.stringify({ semantics, draft, task });

for (const check of ["diff-preview", "approval-required", "filesystem-ledger", "typecheck", "test", "lint", "patch-validation"]) {
  if (!semantics.derivedPlanSemantics?.expectedChecks?.includes(check)) {
    throw new Error(`prompt semantics missing expected check ${check}: ${JSON.stringify(semantics.derivedPlanSemantics)}`);
  }
  if (!draft.proposal?.expectedChecks?.includes(check)) {
    throw new Error(`proposal missing expected check ${check}: ${JSON.stringify(draft.proposal)}`);
  }
}
if (
  !semantics.ok
  || semantics.registry !== "openclaw-native-prompt-semantics-v0"
  || semantics.capability?.id !== "sense.openclaw.prompt_pack"
  || semantics.workStandards?.registry !== "openclaw-engineering-work-standards-v0"
  || semantics.workStandards?.status !== "ready_for_engineering_loop_guidance"
  || semantics.workStandards?.operatorContract?.promptWallEnforced !== false
  || semantics.workStandards?.governance?.canCreateTask !== false
  || semantics.workStandards?.score?.satisfied !== semantics.workStandards?.score?.required
  || !semantics.workStandards?.standards?.some((standard) => standard.id === "verification_evidence_before_report" && standard.satisfied === true)
  || semantics.governance?.exposesPromptContent !== false
  || semantics.governance?.canExecutePromptCode !== false
  || semantics.summary?.editVocabularyFiles < 1
  || semantics.summary?.verificationVocabularyFiles < 1
) {
  throw new Error(`prompt semantics mismatch: ${JSON.stringify(semantics)}`);
}
if (
  !draft.ok
  || draft.proposal?.editIntent?.kind !== "source_derived_workspace_edit"
  || draft.proposal?.semanticPlan?.registry !== "openclaw-native-prompt-semantics-v0"
  || draft.proposal?.semanticPlan?.contentExposed !== false
  || draft.proposalSourceSignals?.promptSignals?.registry !== "openclaw-native-prompt-semantics-v0"
  || draft.proposalSourceSignals?.governance?.exposesPromptContent !== false
) {
  throw new Error(`prompt-derived draft mismatch: ${JSON.stringify(draft.proposal)}`);
}
if (
  !task.ok
  || task.proposal?.semanticPlan?.registry !== "openclaw-native-prompt-semantics-v0"
  || task.approval?.status !== "pending"
  || task.task?.approval?.required !== true
) {
  throw new Error(`prompt-derived task mismatch: ${JSON.stringify(task)}`);
}
if (raw.includes(promptSecret)) {
  throw new Error("prompt semantics leaked prompt body content");
}

console.log(JSON.stringify({
  openclawPromptSemanticsEditPlan: {
    promptFiles: semantics.summary.totalFiles,
    expectedChecks: semantics.derivedPlanSemantics.expectedChecks,
    workStandards: semantics.workStandards.score,
    proposalChecks: draft.proposal.expectedChecks,
  },
}, null, 2));
EOF

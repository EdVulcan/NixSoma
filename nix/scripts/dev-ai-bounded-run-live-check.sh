#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_CORE_URL:-http://127.0.0.1:4100}"
EVENT_HUB_URL="${OPENCLAW_EVENT_HUB_URL:-http://127.0.0.1:4101}"
SESSION_MANAGER_URL="${OPENCLAW_SESSION_MANAGER_URL:-http://127.0.0.1:4102}"
BROWSER_RUNTIME_URL="${OPENCLAW_BROWSER_RUNTIME_URL:-http://127.0.0.1:4103}"
SCREEN_SENSE_URL="${OPENCLAW_SCREEN_SENSE_URL:-http://127.0.0.1:4104}"
SCREEN_ACT_URL="${OPENCLAW_SCREEN_ACT_URL:-http://127.0.0.1:4105}"
SYSTEM_SENSE_URL="${OPENCLAW_SYSTEM_SENSE_URL:-http://127.0.0.1:4106}"
SYSTEM_HEAL_URL="${OPENCLAW_SYSTEM_HEAL_URL:-http://127.0.0.1:4107}"
OBSERVER_URL="${OPENCLAW_OBSERVER_URL:-http://127.0.0.1:4170}"
export OPENCLAW_OPERATOR_TOKEN_FILE="${OPENCLAW_OPERATOR_TOKEN_FILE:-${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}/nixsoma/operator-token}"
TARGET_URL="${NIXSOMA_AI_BOUNDED_RUN_URL:-https://httpbin.org/forms/post}"
TASK_GOAL="${NIXSOMA_AI_BOUNDED_RUN_TASK_GOAL:-Scroll down to inspect additional form controls below the current viewport}"
EXPECTED_STEPS="${NIXSOMA_AI_BOUNDED_RUN_EXPECT_STEPS:-2}"
PROVE_TYPE="${NIXSOMA_AI_BOUNDED_RUN_PROVE_TYPE:-1}"
TYPE_CANARY_PART_A="NXS4"
TYPE_CANARY_PART_B="L4P729Q"
TYPE_CANARY="${TYPE_CANARY_PART_A}${TYPE_CANARY_PART_B}"
TYPE_TASK_GOAL="Type the exact concatenation of ${TYPE_CANARY_PART_A} and ${TYPE_CANARY_PART_B}, without spaces or punctuation, into the Customer name textbox"

if [[ ! "$EXPECTED_STEPS" =~ ^[12]$ ]]; then
  printf 'NIXSOMA_AI_BOUNDED_RUN_EXPECT_STEPS must be 1 or 2\n' >&2
  exit 64
fi
if [[ ! "$PROVE_TYPE" =~ ^[01]$ ]]; then
  printf 'NIXSOMA_AI_BOUNDED_RUN_PROVE_TYPE must be 0 or 1\n' >&2
  exit 64
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
export OPENCLAW_POST_JSON_FAILURE="${OPENCLAW_POST_JSON_FAILURE:-fail-with-body}"

stage() {
  printf 'AI bounded run live gate: %s\n' "$1" >&2
}

tmp_dir="$(mktemp -d)"
cleanup() {
  local status="$?"
  if (( status != 0 )); then
    for name in prepare navigate activate type-proof task bind run; do
      if [[ -s "$tmp_dir/$name.json" ]]; then
        printf 'AI bounded run failed response (%s.json):\n' "$name" >&2
        sed -n '1,120p' "$tmp_dir/$name.json" >&2
      fi
    done
  fi
  rm -rf "$tmp_dir"
  return "$status"
}
trap cleanup EXIT

stage "checking deployed services and operator credential"
[[ -s "$OPENCLAW_OPERATOR_TOKEN_FILE" ]]
for unit in openclaw-core.service openclaw-event-hub.service openclaw-screen-sense.service openclaw-screen-act.service; do
  [[ "$(systemctl is-active "$unit")" == "active" ]]
done
for unit in nixsoma-ai-graphical-session.service openclaw-session-manager.service openclaw-browser-runtime.service; do
  [[ "$(systemctl --user is-active "$unit")" == "active" ]]
done
browser_environment="$(systemctl --user show openclaw-browser-runtime.service -p Environment --value)"
browser_profile_dir=""
for assignment in $browser_environment; do
  case "$assignment" in
    OPENCLAW_BROWSER_PROFILE_DIR=*)
      browser_profile_dir="${assignment#OPENCLAW_BROWSER_PROFILE_DIR=}"
      ;;
  esac
done
if [[ -z "$browser_profile_dir" || "$browser_profile_dir" != "$XDG_RUNTIME_DIR/"* ]]; then
  printf 'AI browser profile is not runtime-only: %s\n' "${browser_profile_dir:-missing}" >&2
  exit 1
fi

stage "preparing current work-view authority"
post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"act.work_view.control","operation":"work_view.prepare","params":{"displayTarget":"workspace-2"}}' \
  > "$tmp_dir/prepare.json"

stage "opening the public bounded-run form through the governed browser owner"
navigate_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: "act.browser.open",
    operation: "browser.new_tab",
    intent: "browser.new_tab",
    params: { url: process.argv[1] },
  }));
' "$TARGET_URL")"
post_json "$CORE_URL/capabilities/invoke" "$navigate_payload" > "$tmp_dir/navigate.json"

for _ in $(seq 1 120); do
  curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/state.json"
  curl -fsS "$BROWSER_RUNTIME_URL/browser/state" > "$tmp_dir/browser.json"
  curl -fsS "$SCREEN_SENSE_URL/screen/semantic-scene" > "$tmp_dir/scene.json"
  if node -e '
    const fs = require("node:fs");
    const state = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).workView ?? {};
    const browser = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).browser ?? {};
    const scene = JSON.parse(fs.readFileSync(process.argv[3], "utf8")).scene ?? {};
    const expectedUrl = new URL(process.argv[4]).href;
    const surfaces = state.aiGraphicalSession?.surfaceInventory?.surfaces ?? [];
    process.exit(state.status === "prepared"
      && state.helperRuntime?.actionAuthority === "active"
      && state.helperRuntime?.leaseMatched === true
      && browser.running === true
      && browser.activeUrl === expectedUrl
      && scene.available === true
      && scene.itemCount > 0
      && surfaces.some((surface) => surface.pid === scene.browserPid) ? 0 : 1);
  ' "$tmp_dir/state.json" "$tmp_dir/browser.json" "$tmp_dir/scene.json" "$TARGET_URL"; then
    break
  fi
  sleep 0.1
done

read -r surface_id inventory_sequence active < <(node -e '
  const fs = require("node:fs");
  const state = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).workView ?? {};
  const scene = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).scene ?? {};
  const inventory = state.aiGraphicalSession?.surfaceInventory ?? {};
  const matches = inventory.surfaces?.filter((surface) => surface.pid === scene.browserPid) ?? [];
  if (matches.length !== 1 || !Number.isInteger(inventory.sequence)) process.exit(1);
  console.log(`${matches[0].surfaceId} ${inventory.sequence} ${matches[0].activated === true}`);
' "$tmp_dir/state.json" "$tmp_dir/scene.json")

if [[ "$active" != "true" ]]; then
  activation_payload="$(node -e '
    console.log(JSON.stringify({
      capabilityId: "act.work_view.control",
      operation: "work_view.surface.activate",
      params: { surfaceId: Number(process.argv[1]), inventorySequence: Number(process.argv[2]) },
    }));
  ' "$surface_id" "$inventory_sequence")"
  post_json "$CORE_URL/capabilities/invoke" "$activation_payload" > "$tmp_dir/activate.json"
fi

if [[ "$PROVE_TYPE" == "1" ]]; then
  stage "proving one write-only semantic type before the bounded continuation"
  NIXSOMA_AI_SCENE_TASK_GOAL="$TYPE_TASK_GOAL" \
  NIXSOMA_AI_SCENE_EXPECTED_ACTION="type_item" \
  NIXSOMA_AI_SCENE_EXPECTED_INPUT_CHAR_COUNT="${#TYPE_CANARY}" \
    bash "$SCRIPT_DIR/dev-ai-browser-scene-grounding-live-check.sh" > "$tmp_dir/type-proof.json"
  if grep -Fq -- "$TYPE_CANARY" "$tmp_dir/type-proof.json"; then
    printf 'AI bounded run type proof exposed the write-only canary\n' >&2
    exit 1
  fi
fi

stage "creating and binding one reviewed task"
task_payload="$(node -e '
  console.log(JSON.stringify({ goal: process.argv[1], type: "browser_task", workViewStrategy: "ai-work-view" }));
' "$TASK_GOAL")"
post_json "$CORE_URL/tasks" "$task_payload" > "$tmp_dir/task.json"
task_id="$(node -e '
  const fs = require("node:fs");
  const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (data.ok !== true || typeof data.task?.id !== "string") process.exit(1);
  process.stdout.write(data.task.id);
' "$tmp_dir/task.json")"
bind_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: "act.openclaw.engineering_context.work_view_bind",
    taskId: process.argv[1],
    params: { taskId: process.argv[1], confirm: true },
  }));
' "$task_id")"
post_json "$CORE_URL/capabilities/invoke" "$bind_payload" > "$tmp_dir/bind.json"

stage "requesting one task-bound bounded run"
run_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: "act.ai.workspace.bounded_run",
    taskId: process.argv[1],
    params: { confirm: true },
  }));
' "$task_id")"
post_json "$CORE_URL/capabilities/invoke" "$run_payload" > "$tmp_dir/run.json"
curl -fsS "$EVENT_HUB_URL/events/audit?limit=400" > "$tmp_dir/events.json"
curl -fsS "$SCREEN_ACT_URL/act/state" > "$tmp_dir/action-state.json"
curl -fsS "$CORE_URL/capabilities/invocations?limit=100" > "$tmp_dir/invocations.json"
curl -fsS "$CORE_URL/state/runtime" > "$tmp_dir/runtime.json"
curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/work-view.json"
curl -fsS "$BROWSER_RUNTIME_URL/browser/state" > "$tmp_dir/browser-state.json"
curl -fsS "$SCREEN_SENSE_URL/screen/semantic-scene" > "$tmp_dir/semantic-scene.json"
browser_profile_filesystem="$(stat -f -c %T "$browser_profile_dir")"
if [[ "$browser_profile_filesystem" != "tmpfs" ]]; then
  printf 'AI browser profile filesystem is not tmpfs: %s\n' "$browser_profile_filesystem" >&2
  exit 1
fi

stage "verifying bounded continuation, durable audit, and no plaintext state"
node - "$tmp_dir" "$task_id" "$EXPECTED_STEPS" "$PROVE_TYPE" "$TYPE_CANARY" "$browser_profile_filesystem" <<'NODE'
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const directory = process.argv[2];
const taskId = process.argv[3];
const expectedSteps = Number(process.argv[4]);
const proveType = process.argv[5] === "1";
const typeCanary = process.argv[6];
const browserProfileFilesystem = process.argv[7];
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const response = read("run.json");
const result = response.result ?? {};
const evidence = result.evidence ?? {};
const governance = result.governance ?? {};
const steps = result.steps ?? [];
const events = read("events.json").items ?? [];
const actionState = read("action-state.json");
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const allowed = new Set(["no_op", "scroll_up", "scroll_down", "click_item", "type_item"]);
const egress = steps.map((step) => events.find((event) =>
  event.type === "cloud_provider.ai_workspace_single_step_egress_authorized"
    && event.payload?.taskId === taskId
    && event.payload?.requestContentHash === step.requestContentHash));
const completed = steps.map((step) => events.find((event) =>
  event.type === "ai_workspace.single_step_completed"
    && event.payload?.taskId === taskId
    && event.payload?.responseContentHash === step.responseContentHash));
const continuation = events.find((event) =>
  event.type === "ai_workspace.bounded_run_continuation_authorized"
    && event.payload?.taskId === taskId);
const runCompleted = events.find((event) =>
  event.type === "ai_workspace.bounded_run_completed"
    && event.payload?.steps?.[0]?.taskId === taskId);
const durable = JSON.stringify({ egress, completed, continuation, runCompleted, actionState });
const typeProof = proveType ? read("type-proof.json") : null;
const plaintextReadbacks = JSON.stringify({
  typeProof,
  events: read("events.json"),
  invocations: read("invocations.json"),
  runtime: read("runtime.json"),
  workView: read("work-view.json"),
  browserState: read("browser-state.json"),
  semanticScene: read("semantic-scene.json"),
  actionState,
});

if (response.invoked !== true
  || result.registry !== "nixsoma-ai-workspace-bounded-run-v0"
  || steps.length !== expectedSteps
  || evidence.stepCount !== expectedSteps
  || evidence.providerCallCount !== expectedSteps
  || evidence.providerCallCountMinimum !== expectedSteps
  || governance.maximumProviderCalls !== 2
  || governance.maximumActions !== 2
  || governance.continuationAfterVerifiedScrollOnly !== true
  || governance.terminalAfterSecondStep !== true
  || governance.automaticRepeat !== false
  || governance.inputTextPersisted !== false
  || governance.mutatesHost !== false
  || evidence.outcomeUnknown !== false
  || evidence.runCompletionAudit !== true
  || steps.some((step, index) => step.index !== index + 1
    || !allowed.has(step.actionId)
    || step.providerCalled !== true
    || !hash(step.contextContentHash)
    || !hash(step.requestContentHash)
    || !hash(step.responseContentHash)
    || !hash(step.sceneContentHash)
    || step.completionAudit !== true
    || step.taskId !== taskId)
  || egress.some((event) => !event)
  || completed.some((event) => !event)
  || !runCompleted
  || browserProfileFilesystem !== "tmpfs"
  || (proveType && (typeProof?.actionId !== "type_item"
    || typeProof?.actionExecuted !== true
    || typeProof?.keyboardInput !== true
    || typeProof?.inputCharCount !== typeCanary.length))
  || plaintextReadbacks.includes(typeCanary)
  || plaintextReadbacks.includes('"inputText"')
  || (expectedSteps === 2 && (!continuation
    || !["scroll_up", "scroll_down"].includes(steps[0].actionId)
    || steps[0].actionExecuted !== true
    || evidence.continuationAudit !== true
    || governance.continuedAfterVerifiedScroll !== true))
  || durable.includes('"inputText"')
  || durable.includes('"text":')
  || durable.includes("targetId")
  || durable.includes("selector")) {
  throw new Error(`bounded run evidence invalid: ${JSON.stringify({ result, egress, completed, continuation, runCompleted })}`);
}

console.log(JSON.stringify({
  registry: result.registry,
  taskId,
  steps: steps.map((step) => ({ actionId: step.actionId, actionExecuted: step.actionExecuted })),
  providerCallCount: evidence.providerCallCount,
  actionCount: evidence.actionCount,
  continuationAudit: evidence.continuationAudit,
  runCompletionAudit: evidence.runCompletionAudit,
  typeItemProved: proveType,
  typeInputCharCount: typeProof?.inputCharCount ?? null,
  inputCanarySha256: proveType
    ? createHash("sha256").update(typeCanary).digest("hex")
    : null,
  plaintextCanaryExposedInReadbacks: false,
  browserProfileFilesystem,
  browserProfilePersistent: false,
  inputTextPersisted: governance.inputTextPersisted,
  automaticRepeat: governance.automaticRepeat,
}, null, 2));
NODE

stage "checking post-run service health"
for url in "$CORE_URL" "$EVENT_HUB_URL" "$SESSION_MANAGER_URL" "$BROWSER_RUNTIME_URL" \
  "$SCREEN_SENSE_URL" "$SCREEN_ACT_URL" "$SYSTEM_SENSE_URL" "$SYSTEM_HEAL_URL" "$OBSERVER_URL"; do
  curl -fsS "$url/health" > /dev/null
done

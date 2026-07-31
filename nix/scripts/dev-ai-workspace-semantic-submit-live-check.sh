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
FIXTURE_URL="${NIXSOMA_AI_SEMANTIC_SUBMIT_URL:-http://127.0.0.1:4103/fixtures/semantic-submit}"
CANARY_PART_A="NXS4"
CANARY_PART_B="L4S729Q"
CANARY="${CANARY_PART_A}${CANARY_PART_B}"
TASK_GOAL="Type the exact concatenation of ${CANARY_PART_A} and ${CANARY_PART_B}, without spaces or punctuation, into the Customer name textbox, then submit the review form"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
openclaw_use_deployed_operator_token
export OPENCLAW_POST_JSON_FAILURE="${OPENCLAW_POST_JSON_FAILURE:-fail-with-body}"

stage() {
  printf 'AI workspace semantic submit live gate: %s\n' "$1" >&2
}

tmp_dir="$(mktemp -d)"
cleanup() {
  local status="$?"
  if (( status != 0 )); then
    for name in prepare activate task bind type submit replay task-before task-after scene-before scene-after events invocations; do
      if [[ -s "$tmp_dir/$name.json" ]]; then
        printf 'AI workspace semantic submit failed response (%s.json):\n' "$name" >&2
        sed -n '1,140p' "$tmp_dir/$name.json" >&2
      fi
    done
  fi
  rm -rf "$tmp_dir"
  return "$status"
}
trap cleanup EXIT

system_units=(
  openclaw-core.service
  openclaw-event-hub.service
  openclaw-screen-sense.service
  openclaw-screen-act.service
  openclaw-system-sense.service
  openclaw-system-heal.service
  observer-ui.service
)
user_units=(
  nixsoma-ai-graphical-session.service
  openclaw-session-manager.service
  openclaw-browser-runtime.service
)

record_restart_counts() {
  local target="$1"
  : > "$target"
  for unit in "${system_units[@]}"; do
    printf 'system\t%s\t%s\n' "$unit" "$(systemctl show "$unit" -p NRestarts --value)" >> "$target"
  done
  for unit in "${user_units[@]}"; do
    printf 'user\t%s\t%s\n' "$unit" "$(systemctl --user show "$unit" -p NRestarts --value)" >> "$target"
  done
}

stage "checking deployed services, operator credential, and ephemeral browser profile"
[[ -s "$OPENCLAW_OPERATOR_TOKEN_FILE" ]]
for unit in "${system_units[@]}"; do
  [[ "$(systemctl is-active "$unit")" == "active" ]]
done
for unit in "${user_units[@]}"; do
  [[ "$(systemctl --user is-active "$unit")" == "active" ]]
done
browser_environment="$(systemctl --user show openclaw-browser-runtime.service -p Environment --value)"
browser_profile_dir="$(tr ' ' '\n' <<<"$browser_environment" \
  | sed -n 's/^OPENCLAW_BROWSER_PROFILE_DIR=//p' | head -n 1)"
[[ "$browser_profile_dir" == "$XDG_RUNTIME_DIR/"* ]]
record_restart_counts "$tmp_dir/restarts-before.tsv"

stage "opening the fixed local semantic submit fixture through current work-view authority"
prepare_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: "act.work_view.control",
    operation: "work_view.prepare",
    params: { displayTarget: "workspace-2", entryUrl: process.argv[1] },
  }));
' "$FIXTURE_URL")"
post_json "$CORE_URL/capabilities/invoke" "$prepare_payload" > "$tmp_dir/prepare.json"

for _ in $(seq 1 150); do
  curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/work-view-before.json"
  curl -fsS "$BROWSER_RUNTIME_URL/browser/state" > "$tmp_dir/browser-before.json"
  curl -fsS "$SCREEN_SENSE_URL/screen/semantic-scene" > "$tmp_dir/scene-before.json"
  if node -e '
    const fs = require("node:fs");
    const workView = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).workView ?? {};
    const browser = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).browser ?? {};
    const scene = JSON.parse(fs.readFileSync(process.argv[3], "utf8")).scene ?? {};
    const names = scene.items?.map((item) => `${item.role}:${item.name}:${item.disabled}`) ?? [];
    process.exit(workView.status === "prepared"
      && workView.helperRuntime?.actionAuthority === "active"
      && workView.helperRuntime?.leaseMatched === true
      && browser.running === true
      && browser.activeUrl === process.argv[4]
      && names.includes("textbox:Customer name:false")
      && names.includes("button:Submit review:false") ? 0 : 1);
  ' "$tmp_dir/work-view-before.json" "$tmp_dir/browser-before.json" \
    "$tmp_dir/scene-before.json" "$FIXTURE_URL"; then
    break
  fi
  sleep 0.1
done
read -r browser_surface_id inventory_sequence browser_surface_active < <(node -e '
  const fs = require("node:fs");
  const workView = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).workView ?? {};
  const scene = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).scene ?? {};
  const inventory = workView.aiGraphicalSession?.surfaceInventory ?? {};
  const matches = inventory.surfaces?.filter((surface) => surface.pid === scene.browserPid) ?? [];
  if (matches.length !== 1 || !Number.isInteger(inventory.sequence)) process.exit(1);
  console.log(`${matches[0].surfaceId} ${inventory.sequence} ${matches[0].activated === true}`);
' "$tmp_dir/work-view-before.json" "$tmp_dir/scene-before.json")
if [[ "$browser_surface_active" != "true" ]]; then
  activation_payload="$(node -e '
    console.log(JSON.stringify({
      capabilityId: "act.work_view.control",
      operation: "work_view.surface.activate",
      params: {
        surfaceId: Number(process.argv[1]),
        inventorySequence: Number(process.argv[2]),
      },
    }));
  ' "$browser_surface_id" "$inventory_sequence")"
  post_json "$CORE_URL/capabilities/invoke" "$activation_payload" > "$tmp_dir/activate.json"
fi
for _ in $(seq 1 100); do
  curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/work-view-before.json"
  if node -e '
    const fs = require("node:fs");
    const expected = Number(process.argv[2]);
    const workView = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).workView ?? {};
    const active = workView.aiGraphicalSession?.surfaceInventory?.surfaces
      ?.filter((surface) => surface.activated === true) ?? [];
    process.exit(active.length === 1 && active[0].surfaceId === expected ? 0 : 1);
  ' "$tmp_dir/work-view-before.json" "$browser_surface_id"; then
    break
  fi
  sleep 0.05
done
node -e '
  const fs = require("node:fs");
  const scene = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).scene ?? {};
  const names = scene.items?.map((item) => `${item.role}:${item.name}:${item.disabled}`) ?? [];
  if (!names.includes("textbox:Customer name:false")
    || !names.includes("button:Submit review:false")) process.exit(1);
' "$tmp_dir/scene-before.json"
node -e '
  const fs = require("node:fs");
  const expected = Number(process.argv[2]);
  const workView = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).workView ?? {};
  const active = workView.aiGraphicalSession?.surfaceInventory?.surfaces
    ?.filter((surface) => surface.activated === true) ?? [];
  if (active.length !== 1 || active[0].surfaceId !== expected) process.exit(1);
' "$tmp_dir/work-view-before.json" "$browser_surface_id"
[[ -d "$browser_profile_dir" ]]
[[ "$(stat -f -c %T "$browser_profile_dir")" == "tmpfs" ]]

stage "creating and binding one reviewed type-then-submit task"
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
curl -fsS "$CORE_URL/tasks/$task_id" > "$tmp_dir/task-before.json"

start_time="$(date -Is)"
stage "requesting one verified write-only semantic type"
type_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: "act.ai.workspace.single_step",
    taskId: process.argv[1],
    params: { confirm: true },
  }));
' "$task_id")"
post_json "$CORE_URL/capabilities/invoke" "$type_payload" > "$tmp_dir/type.json"

stage "binding the exact type receipt to one semantic submit"
submit_payload="$(node - "$tmp_dir/type.json" "$task_id" <<'NODE'
const fs = require("node:fs");
const response = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const result = response.result ?? {};
const summary = response.invocation?.summary ?? {};
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
if (response.invoked !== true
  || result.status !== "executed"
  || result.decision?.actionId !== "type_item"
  || result.governance?.actionExecuted !== true
  || result.governance?.inputTextPersisted !== false
  || result.evidence?.postActionVerified !== true
  || summary.completionAudit !== true
  || summary.taskId !== process.argv[3]
  || ![summary.objectiveContentHash, summary.taskVersionHash,
    summary.responseContentHash, summary.sceneContentHash].every(hash)) process.exit(1);
process.stdout.write(JSON.stringify({
  capabilityId: "act.ai.workspace.semantic_submit",
  taskId: process.argv[3],
  params: {
    confirm: true,
    typeInvocationId: response.invocation.id,
    objectiveContentHash: summary.objectiveContentHash,
    taskVersionHash: summary.taskVersionHash,
    responseContentHash: summary.responseContentHash,
    sceneContentHash: summary.sceneContentHash,
  },
}));
NODE
)"
post_json "$CORE_URL/capabilities/invoke" "$submit_payload" > "$tmp_dir/submit.json"

stage "proving the exact receipt cannot be replayed"
post_json "$CORE_URL/capabilities/invoke" "$submit_payload" > "$tmp_dir/replay.json"

for _ in $(seq 1 100); do
  curl -fsS "$SCREEN_SENSE_URL/screen/semantic-scene" > "$tmp_dir/scene-after.json"
  if node -e '
    const fs = require("node:fs");
    const scene = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).scene ?? {};
    const complete = scene.items?.find((item) => item.role === "button"
      && item.name === "Submission complete" && item.disabled === true);
    process.exit(complete ? 0 : 1);
  ' "$tmp_dir/scene-after.json"; then
    break
  fi
  sleep 0.05
done

curl -fsS "$CORE_URL/tasks/$task_id" > "$tmp_dir/task-after.json"
curl -fsS "$EVENT_HUB_URL/events/audit?limit=700" > "$tmp_dir/events.json"
curl -fsS "$CORE_URL/capabilities/invocations?limit=220" > "$tmp_dir/invocations.json"
curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/work-view-after.json"
curl -fsS "$BROWSER_RUNTIME_URL/browser/state" > "$tmp_dir/browser-after.json"
curl -fsS "$SCREEN_ACT_URL/act/state" > "$tmp_dir/action-state.json"
curl -fsS "$OBSERVER_URL/" > "$tmp_dir/observer.html"
curl -fsS "$OBSERVER_URL/client.js" > "$tmp_dir/observer-client.js"
record_restart_counts "$tmp_dir/restarts-after.tsv"

stage "checking post-run health and durable bounded evidence"
for url in "$CORE_URL" "$EVENT_HUB_URL" "$SESSION_MANAGER_URL" "$BROWSER_RUNTIME_URL" \
  "$SCREEN_SENSE_URL" "$SCREEN_ACT_URL" "$SYSTEM_SENSE_URL" "$SYSTEM_HEAL_URL" "$OBSERVER_URL"; do
  curl -fsS "$url/health" > /dev/null
done
[[ -z "$(systemctl --failed --no-legend --plain)" ]]
[[ -z "$(systemctl --user --failed --no-legend --plain)" ]]
cmp -s "$tmp_dir/restarts-before.tsv" "$tmp_dir/restarts-after.tsv"

node - "$tmp_dir" "$task_id" "$CANARY" "$FIXTURE_URL" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const [directory, taskId, canary, fixtureUrl] = process.argv.slice(2);
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const type = read("type.json");
const submit = read("submit.json");
const replay = read("replay.json");
const before = read("task-before.json").task ?? {};
const after = read("task-after.json").task ?? {};
const afterScene = read("scene-after.json").scene ?? {};
const events = read("events.json").items ?? [];
const invocations = read("invocations.json").items ?? [];
const browser = read("browser-after.json").browser ?? {};
const actionState = read("action-state.json");
const result = submit.result ?? {};
const evidence = result.evidence ?? {};
const governance = result.governance ?? {};
const typeInvocationId = type.invocation?.id;
const submitInvocationId = submit.invocation?.id;
const typeEgress = events.filter((event) =>
  event.type === "cloud_provider.ai_workspace_single_step_egress_authorized"
    && event.payload?.taskId === taskId);
const submitAuthorized = events.filter((event) =>
  event.type === "ai_workspace.semantic_submit_authorized"
    && event.payload?.taskId === taskId
    && event.payload?.typeInvocationId === typeInvocationId);
const submitEgress = events.filter((event) =>
  event.type === "cloud_provider.ai_workspace_semantic_submit_egress_authorized"
    && event.payload?.taskId === taskId);
const completion = events.filter((event) =>
  event.type === "ai_workspace.single_step_completed"
    && event.payload?.taskId === taskId);
const typeInvocation = invocations.find((entry) => entry.id === typeInvocationId);
const submitInvocation = invocations.find((entry) => entry.id === submitInvocationId);
const replayInvocation = invocations.find((entry) => entry.id === replay.invocation?.id);
const completionItem = afterScene.items?.find((item) =>
  item.role === "button" && item.name === "Submission complete" && item.disabled === true);
const html = fs.readFileSync(path.join(directory, "observer.html"), "utf8");
const client = fs.readFileSync(path.join(directory, "observer-client.js"), "utf8");
const durable = JSON.stringify({ events, invocations, browser, actionState });

const checks = {
  type: type.result?.status === "executed"
    && type.result?.decision?.actionId === "type_item"
    && type.result?.governance?.actionExecuted === true
    && type.result?.evidence?.postActionVerified === true
    && type.invocation?.summary?.completionAudit === true,
  submit: submit.invoked === true
    && result.registry === "nixsoma-ai-workspace-semantic-submit-v0"
    && result.status === "executed"
    && result.action?.actionId === "click_item"
    && result.action?.executed === true
    && result.action?.postActionVerified === true,
  binding: evidence.taskId === taskId
    && evidence.typeInvocationId === typeInvocationId
    && evidence.priorTypeReceiptBound === true
    && evidence.authorizationAudit === true
    && evidence.completionAudit === true,
  governance: governance.providerCalled === true
    && governance.maximumProviderCalls === 1
    && governance.maximumActions === 1
    && governance.actionExecuted === true
    && governance.priorTypeReceiptRequired === true
    && governance.semanticSubmitTargetBound === true
    && governance.automaticRepeat === false
    && governance.keyboardInput === false
    && governance.inputTextPersisted === false
    && governance.taskMutated === false
    && governance.automaticTaskCompletion === false
    && governance.mutatesHost === false,
  replay: replay.result?.status === "rejected"
    && replay.result?.reason === "type_receipt_not_current"
    && replay.result?.governance?.providerCalled === false
    && replay.result?.governance?.actionExecuted === false,
  transition: Boolean(completionItem)
    && !afterScene.items?.some((item) => item.name === "Customer name" || item.name === "Submit review"),
  task: before.id === taskId && after.id === taskId
    && before.status === after.status
    && before.updatedAt === after.updatedAt
    && before.outcome === after.outcome,
  audits: typeEgress.length === 1 && submitAuthorized.length === 1
    && submitEgress.length === 1 && completion.length === 2,
  invocations: typeInvocation?.summary?.actionId === "type_item"
    && submitInvocation?.summary?.kind === "ai.workspace.semantic_submit"
    && submitInvocation?.summary?.priorTypeReceiptBound === true
    && replayInvocation?.summary?.reason === "type_receipt_not_current",
  browser: browser.activeUrl === fixtureUrl && browser.running === true,
  observer: html.includes('id="run-ai-workspace-semantic-submit-button"')
    && client.includes('capabilityId: "act.ai.workspace.semantic_submit"'),
  plaintext: !durable.includes(canary)
    && !JSON.stringify(result).includes(canary)
    && !JSON.stringify(result).includes('"inputText"'),
};
const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
if (failed.length > 0) {
  throw new Error(`semantic submit physical evidence invalid: ${JSON.stringify({
    failed, result, replay: replay.result, completionItem, typeEgress: typeEgress.length,
    submitAuthorized: submitAuthorized.length, submitEgress: submitEgress.length,
    completion: completion.length, typeInvocation, submitInvocation, replayInvocation,
  })}`);
}

console.log(JSON.stringify({
  registry: result.registry,
  taskId,
  fixtureUrl,
  steps: [
    { actionId: "type_item", actionExecuted: true },
    { actionId: "click_item", actionExecuted: true },
  ],
  providerCallCount: 2,
  actionCount: 2,
  priorTypeReceiptBound: true,
  semanticSubmitTargetBound: true,
  postActionVerified: true,
  completionAudit: true,
  visibleTransition: "Submission complete",
  replayRejectedBeforeProvider: true,
  taskMutated: false,
  plaintextCanaryPersisted: false,
  browserProfileFilesystem: "tmpfs",
  automaticRepeat: false,
}, null, 2));
NODE

stage "physical semantic submit acceptance passed"

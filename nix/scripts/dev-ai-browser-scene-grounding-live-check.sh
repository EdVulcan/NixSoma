#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_CORE_URL:-http://127.0.0.1:4100}"
EVENT_HUB_URL="${OPENCLAW_EVENT_HUB_URL:-http://127.0.0.1:4101}"
SESSION_MANAGER_URL="${OPENCLAW_SESSION_MANAGER_URL:-http://127.0.0.1:4102}"
SCREEN_SENSE_URL="${OPENCLAW_SCREEN_SENSE_URL:-http://127.0.0.1:4104}"
SCREEN_ACT_URL="${OPENCLAW_SCREEN_ACT_URL:-http://127.0.0.1:4105}"
SYSTEM_SENSE_URL="${OPENCLAW_SYSTEM_SENSE_URL:-http://127.0.0.1:4106}"
SYSTEM_HEAL_URL="${OPENCLAW_SYSTEM_HEAL_URL:-http://127.0.0.1:4107}"
BROWSER_RUNTIME_URL="${OPENCLAW_BROWSER_RUNTIME_URL:-http://127.0.0.1:4103}"
OBSERVER_URL="${OPENCLAW_OBSERVER_URL:-http://127.0.0.1:4170}"
export OPENCLAW_OPERATOR_TOKEN_FILE="${OPENCLAW_OPERATOR_TOKEN_FILE:-${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}/nixsoma/operator-token}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
export OPENCLAW_POST_JSON_FAILURE="${OPENCLAW_POST_JSON_FAILURE:-fail-with-body}"

stage() {
  printf 'AI browser scene live gate: %s\n' "$1" >&2
}

tmp_dir="$(mktemp -d)"
cleanup() {
  local status="$?"
  if (( status != 0 )); then
    for diagnostic in authority-control.json activated.json task.json task-bind.json single-step.json; do
      if [[ -s "$tmp_dir/$diagnostic" ]]; then
        printf 'AI browser scene live gate failed response (%s):\n' "$diagnostic" >&2
        sed -n '1,120p' "$tmp_dir/$diagnostic" >&2
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

stage "ensuring current work-view authority"
curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/state.json"
curl -fsS "$BROWSER_RUNTIME_URL/browser/state" > "$tmp_dir/browser-state.json"
if ! node -e '
  const fs = require("node:fs");
  const workView = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).workView ?? {};
  const browser = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const helper = workView.helperRuntime ?? {};
  const graphical = workView.aiGraphicalSession ?? {};
  process.exit(workView.status === "prepared"
    && helper.status === "active"
    && helper.actionAuthority === "active"
    && helper.leaseMatched === true
    && graphical.browserAttachment?.attached === true
    && (browser.running ?? browser.browser?.running) === true ? 0 : 1);
' "$tmp_dir/state.json" "$tmp_dir/browser-state.json"; then
  post_json "$CORE_URL/capabilities/invoke" \
    '{"capabilityId":"act.work_view.control","operation":"work_view.prepare","params":{"displayTarget":"workspace-2"}}' \
    > "$tmp_dir/authority-control.json"
fi

for _ in $(seq 1 120); do
  curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/state.json"
  curl -fsS "$SCREEN_SENSE_URL/screen/semantic-scene" > "$tmp_dir/scene.json"
  if node -e '
    const fs = require("node:fs");
    const state = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const scene = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).scene ?? {};
    const workView = state.workView ?? {};
    const helper = workView.helperRuntime ?? {};
    const surfaces = workView.aiGraphicalSession?.surfaceInventory?.surfaces ?? [];
    process.exit(workView.status === "prepared"
      && helper.status === "active"
      && helper.actionAuthority === "active"
      && helper.leaseMatched === true
      && scene.available === true
      && scene.itemCount > 0
      && surfaces.some((surface) => surface.pid === scene.browserPid) ? 0 : 1);
  ' "$tmp_dir/state.json" "$tmp_dir/scene.json"; then
    break
  fi
  sleep 0.1
done

read -r browser_surface_id inventory_sequence browser_surface_active < <(node -e '
  const fs = require("node:fs");
  const state = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const scene = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).scene ?? {};
  const inventory = state.workView?.aiGraphicalSession?.surfaceInventory ?? {};
  const matches = inventory.surfaces?.filter((surface) => surface.pid === scene.browserPid) ?? [];
  if (scene.registry !== "nixsoma-ai-browser-semantic-scene-v0"
    || scene.available !== true
    || !Number.isInteger(scene.itemCount)
    || scene.itemCount < 1
    || scene.itemCount > 12
    || !/^[a-f0-9]{64}$/u.test(scene.sceneContentSha256 ?? "")
    || matches.length !== 1
    || !Number.isInteger(inventory.sequence)) process.exit(1);
  console.log(`${matches[0].surfaceId} ${inventory.sequence} ${matches[0].activated === true}`);
' "$tmp_dir/state.json" "$tmp_dir/scene.json")

if [[ "$browser_surface_active" != "true" ]]; then
  stage "activating the AI-owned browser surface"
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
  post_json "$CORE_URL/capabilities/invoke" "$activation_payload" > "$tmp_dir/activated.json"
fi

stage "binding one current browser scene to the active Weston surface"
for _ in $(seq 1 120); do
  curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/before-state.json"
  curl -fsS "$SCREEN_SENSE_URL/screen/semantic-scene" > "$tmp_dir/before-scene.json"
  if node -e '
    const fs = require("node:fs");
    const state = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const scene = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).scene ?? {};
    const surfaces = state.workView?.aiGraphicalSession?.surfaceInventory?.surfaces ?? [];
    const active = surfaces.filter((surface) => surface.activated === true);
    process.exit(scene.available === true
      && scene.itemCount > 0
      && active.length === 1
      && active[0].pid === scene.browserPid ? 0 : 1);
  ' "$tmp_dir/before-state.json" "$tmp_dir/before-scene.json"; then
    break
  fi
  sleep 0.1
done

stage "creating one reviewed task objective bound to the current work view"
post_json "$CORE_URL/tasks" \
  '{"goal":"Open the Learn more item to review the displayed product","type":"browser_task","workViewStrategy":"ai-work-view"}' \
  > "$tmp_dir/task.json"
task_id="$(node -e '
  const fs = require("node:fs");
  const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (data.ok !== true || typeof data.task?.id !== "string" || !data.task.id) process.exit(1);
  process.stdout.write(data.task.id);
' "$tmp_dir/task.json")"
task_bind_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: "act.openclaw.engineering_context.work_view_bind",
    taskId: process.argv[1],
    params: { taskId: process.argv[1], confirm: true },
  }));
' "$task_id")"
post_json "$CORE_URL/capabilities/invoke" "$task_bind_payload" > "$tmp_dir/task-bind.json"
node -e '
  const fs = require("node:fs");
  const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const taskId = process.argv[2];
  if (data.invoked !== true
    || data.result?.ok !== true
    || data.result?.changed !== true
    || data.result?.task?.id !== taskId
    || data.result?.association?.binding?.status !== "bound") process.exit(1);
' "$tmp_dir/task-bind.json" "$task_id"

stage "requesting one live scene-grounded DeepSeek decision"
single_step_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: "act.ai.workspace.single_step",
    taskId: process.argv[1],
    params: { confirm: true },
  }));
' "$task_id")"
post_json "$CORE_URL/capabilities/invoke" "$single_step_payload" > "$tmp_dir/single-step.json"
curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/after-state.json"
curl -fsS "$SCREEN_SENSE_URL/screen/semantic-scene" > "$tmp_dir/after-scene.json"
curl -fsS "$EVENT_HUB_URL/events/audit?limit=300" > "$tmp_dir/events.json"

stage "checking post-decision service health"
for url in "$CORE_URL" "$EVENT_HUB_URL" "$SESSION_MANAGER_URL" "$BROWSER_RUNTIME_URL" \
  "$SCREEN_SENSE_URL" "$SCREEN_ACT_URL" "$SYSTEM_SENSE_URL" "$SYSTEM_HEAL_URL" "$OBSERVER_URL"; do
  curl -fsS "$url/health" > /dev/null
done

stage "verifying scene binding, bounded egress, action limit, and durable audit"
node - "$tmp_dir" "$browser_surface_id" "$task_id" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const directory = process.argv[2];
const browserSurfaceId = Number(process.argv[3]);
const taskId = process.argv[4];
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const response = read("single-step.json");
const beforeState = read("before-state.json");
const beforeScene = read("before-scene.json").scene ?? {};
const afterState = read("after-state.json");
const events = read("events.json").items ?? [];
const result = response.result ?? {};
const governance = result.governance ?? {};
const evidence = result.evidence ?? {};
const actionId = result.decision?.actionId ?? null;
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const beforeInput = beforeState.workView?.aiGraphicalSession?.compositorInput ?? {};
const afterInput = afterState.workView?.aiGraphicalSession?.compositorInput ?? {};
const egress = events.find((event) =>
  event.type === "cloud_provider.ai_workspace_single_step_egress_authorized"
    && event.source === "openclaw-core"
    && event.payload?.contextContentHash === evidence.contextContentHash
    && event.payload?.requestContentHash === evidence.requestContentHash
    && event.payload?.taskId === taskId
    && event.payload?.objectiveContentHash === evidence.objectiveContentHash
    && event.payload?.taskVersionHash === evidence.taskVersionHash);
const completed = events.find((event) =>
  event.type === "ai_workspace.single_step_completed"
    && event.source === "openclaw-core"
    && event.payload?.contextContentHash === evidence.contextContentHash
    && event.payload?.responseContentHash === evidence.responseContentHash
    && event.payload?.sceneContentHash === evidence.sceneContentHash
    && event.payload?.taskId === taskId
    && event.payload?.objectiveContentHash === evidence.objectiveContentHash
    && event.payload?.taskVersionHash === evidence.taskVersionHash);
const durableJson = JSON.stringify({ egress, completed, invocation: response.invocation });
const sceneNames = beforeScene.items?.map((item) => item.name).filter(Boolean) ?? [];

if (response.invoked !== true
  || result.registry !== "nixsoma-ai-workspace-single-step-v0"
  || !["no_op", "scroll_up", "scroll_down", "click_item"].includes(actionId)
  || !(result.status === "no_op" || result.status?.startsWith("executed"))
  || governance.providerCalled !== true
  || governance.networkEgress !== true
  || governance.semanticSceneBound !== true
  || governance.currentBrowserSurfaceBound !== true
  || governance.taskObjectiveBound !== true
  || governance.taskObjectiveProviderEgress !== true
  || governance.rawTaskGoalProviderEgress !== false
  || governance.sceneContentProviderEgress !== true
  || governance.pixelsProviderEgress !== false
  || governance.urlsProviderEgress !== false
  || governance.inputValuesProviderEgress !== false
  || governance.maximumActions !== 1
  || governance.automaticRepeat !== false
  || governance.keyboardInput !== false
  || governance.processLaunch !== false
  || governance.parentDisplayConnected !== false
  || governance.mutatesHost !== false
  || !hash(evidence.contextContentHash)
  || !hash(evidence.requestContentHash)
  || !hash(evidence.responseContentHash)
  || evidence.taskId !== taskId
  || !["queued", "running"].includes(evidence.taskStatus)
  || !hash(evidence.objectiveContentHash)
  || !hash(evidence.taskVersionHash)
  || evidence.sceneContentHash !== beforeScene.sceneContentSha256
  || evidence.sceneItemCount !== beforeScene.itemCount
  || !egress
  || egress.payload?.semanticSceneRequired !== true
  || egress.payload?.pixelsEgress !== false
  || egress.payload?.urlsEgress !== false
  || egress.payload?.inputValuesEgress !== false
  || egress.payload?.rawTaskGoalEgress !== false
  || egress.payload?.taskObjectiveEgress !== true
  || !completed
  || completed.payload?.sceneItemCount !== beforeScene.itemCount
  || durableJson.includes("browserPid")
  || durableJson.includes("targetId")
  || durableJson.includes("selector")
  || durableJson.includes("Open the Learn more item to review the displayed product")
  || sceneNames.some((name) => durableJson.includes(name))
  || JSON.stringify(response).includes("data:image")) {
  throw new Error(`live semantic grounding evidence is incomplete: ${JSON.stringify({
    invoked: response.invoked,
    status: result.status,
    actionId,
    fallback: result.fallback?.reason ?? null,
    governance,
    sceneHashMatched: evidence.sceneContentHash === beforeScene.sceneContentSha256,
    sceneItemCountMatched: evidence.sceneItemCount === beforeScene.itemCount,
    egressAudit: Boolean(egress),
    completionAudit: Boolean(completed),
  })}`);
}

if (actionId === "no_op") {
  if (result.status !== "no_op"
    || governance.actionExecuted !== false
    || afterInput.requestId !== beforeInput.requestId) {
    throw new Error("scene-grounded no-op unexpectedly contacted the compositor actuator");
  }
} else if (actionId === "click_item") {
  if (!result.status.startsWith("executed")
    || governance.actionExecuted !== true
    || governance.currentFrameBound !== true
    || governance.currentActiveSurfaceBound !== true
    || governance.semanticItemOrdinalBound !== true
    || !Number.isInteger(result.action?.itemOrdinal)
    || result.action.itemOrdinal < 1
    || result.action.itemOrdinal > beforeScene.itemCount
    || result.action?.executed !== true
    || evidence.itemOrdinal !== result.action.itemOrdinal
    || evidence.postActionVerified !== true
    || evidence.postFrameSequenceAdvanced !== true
    || afterInput.requestId !== beforeInput.requestId) {
    throw new Error("scene-grounded semantic click evidence is incomplete");
  }
} else if (!result.status.startsWith("executed")
  || governance.actionExecuted !== true
  || governance.currentFrameBound !== true
  || governance.currentActiveSurfaceBound !== true
  || result.action?.surfaceId !== browserSurfaceId
  || result.action?.executed !== true
  || evidence.receiptMatched !== true
  || evidence.frameChanged !== true
  || afterInput.requestId === beforeInput.requestId
  || afterInput.operation !== "pointer_scroll"
  || afterInput.surfaceId !== browserSurfaceId
  || afterInput.receiptMatched !== true) {
  throw new Error("scene-grounded scroll evidence is incomplete");
}

console.log(JSON.stringify({
  registry: "nixsoma-ai-browser-scene-grounding-live-check-v0",
  providerCalled: true,
  actionId,
  status: result.status,
  actionExecuted: governance.actionExecuted,
  semanticSceneBound: true,
  currentBrowserSurfaceBound: true,
  sceneItemCount: evidence.sceneItemCount,
  itemOrdinal: evidence.itemOrdinal ?? null,
  sceneContentHashMatched: true,
  taskId,
  taskObjectiveBound: true,
  pixelsProviderEgress: false,
  urlsProviderEgress: false,
  inputValuesProviderEgress: false,
  durableEgressAudit: true,
  durableCompletionAudit: true,
  maximumActions: 1,
  automaticRepeat: false,
  keyboardInput: false,
  parentDisplayConnected: false,
  rootRequired: false,
}, null, 2));
NODE

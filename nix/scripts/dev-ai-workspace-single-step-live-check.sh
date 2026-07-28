#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_CORE_URL:-http://127.0.0.1:4100}"
EVENT_HUB_URL="${OPENCLAW_EVENT_HUB_URL:-http://127.0.0.1:4101}"
SESSION_MANAGER_URL="${OPENCLAW_SESSION_MANAGER_URL:-http://127.0.0.1:4102}"
APP_UNIT="nixsoma-ai-workbench.service"
RUNTIME_DIR="${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}/nixsoma-ai-graphical-session"
export OPENCLAW_OPERATOR_TOKEN_FILE="${OPENCLAW_OPERATOR_TOKEN_FILE:-$XDG_RUNTIME_DIR/nixsoma/operator-token}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

tmp_dir="$(mktemp -d)"
fixture_pid=""
cleanup() {
  if [[ -n "$fixture_pid" ]] && kill -0 "$fixture_pid" 2>/dev/null; then
    kill "$fixture_pid" 2>/dev/null || true
    wait "$fixture_pid" 2>/dev/null || true
  fi
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

[[ -s "$OPENCLAW_OPERATOR_TOKEN_FILE" ]]
for unit in openclaw-core.service openclaw-event-hub.service openclaw-screen-act.service; do
  [[ "$(systemctl is-active "$unit")" == "active" ]]
done
for unit in nixsoma-ai-graphical-session.service openclaw-session-manager.service openclaw-browser-runtime.service; do
  [[ "$(systemctl --user is-active "$unit")" == "active" ]]
done

workbench_launcher="$(systemctl --user show "$APP_UNIT" -p ExecStart --value \
  | sed -E 's/^\{ path=([^ ;]+).*/\1/')"
weston_terminal="$(printf '%s' "$workbench_launcher" \
  | grep -o '/nix/store/[^ ]*/bin/weston-terminal' \
  | head -n 1)"
[[ -x "$weston_terminal" ]]

install -d -m 700 "$tmp_dir/fixture-home" "$tmp_dir/fixture-cache"
fixture_shell="$tmp_dir/fixture-shell"
printf '%s\n' \
  "#!$(command -v bash)" \
  'set -eu' \
  "for line in \$($(command -v seq) 1 160); do printf 'NixSoma AI Step Fixture %03d\\n' \"\$line\"; done" \
  "while :; do $(command -v sleep) 3600; done" \
  > "$fixture_shell"
chmod 700 "$fixture_shell"
env -i \
  HOME="$tmp_dir/fixture-home" \
  XDG_RUNTIME_DIR="$RUNTIME_DIR" \
  XDG_CACHE_HOME="$tmp_dir/fixture-cache" \
  WAYLAND_DISPLAY="nixsoma-ai-0" \
  XCURSOR_THEME="Adwaita" \
  "$weston_terminal" \
  --fullscreen \
  --font="monospace" \
  --font-size=20 \
  --shell="$fixture_shell" &
fixture_pid="$!"

for _ in $(seq 1 120); do
  if curl -fsS "$SESSION_MANAGER_URL/work-view/state" \
    | node -e '
      let body = "";
      process.stdin.on("data", (chunk) => { body += chunk; });
      process.stdin.on("end", () => {
        const data = JSON.parse(body);
        const pid = Number(process.argv[1]);
        process.exit(data.workView?.aiGraphicalSession?.surfaceInventory?.surfaces
          ?.some((surface) => surface.pid === pid) ? 0 : 1);
      });
    ' "$fixture_pid"; then
    break
  fi
  sleep 0.1
done

post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"act.work_view.control","operation":"work_view.prepare","params":{"displayTarget":"workspace-2","entryUrl":"https://example.com/work-view"}}' \
  > "$tmp_dir/prepared.json"

for _ in $(seq 1 120); do
  curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/state.json"
  if node -e '
    const fs = require("node:fs");
    const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const pid = Number(process.argv[2]);
    const workView = data.workView ?? {};
    const helper = workView.helperRuntime ?? {};
    const graphical = workView.aiGraphicalSession ?? {};
    process.exit(workView.status === "prepared"
      && helper.status === "active"
      && helper.actionAuthority === "active"
      && helper.leaseMatched === true
      && graphical.browserAttachment?.attached === true
      && graphical.surfaceInventory?.surfaces?.some((surface) => surface.pid === pid)
      ? 0 : 1);
  ' "$tmp_dir/state.json" "$fixture_pid"; then
    break
  fi
  sleep 0.1
done

read -r fixture_surface_id inventory_sequence < <(node -e '
  const fs = require("node:fs");
  const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const pid = Number(process.argv[2]);
  const inventory = data.workView?.aiGraphicalSession?.surfaceInventory ?? {};
  const surface = inventory.surfaces?.find((item) => item.pid === pid);
  if (!surface || !Number.isInteger(inventory.sequence)) process.exit(1);
  process.stdout.write(`${surface.surfaceId} ${inventory.sequence}`);
' "$tmp_dir/state.json" "$fixture_pid")

activation_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: "act.work_view.control",
    operation: "work_view.surface.activate",
    params: {
      surfaceId: Number(process.argv[1]),
      inventorySequence: Number(process.argv[2]),
    },
  }));
' "$fixture_surface_id" "$inventory_sequence")"
post_json "$CORE_URL/capabilities/invoke" "$activation_payload" \
  > "$tmp_dir/activated.json"

for _ in $(seq 1 120); do
  curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/activated-state.json"
  if node -e '
    const fs = require("node:fs");
    const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const surfaceId = Number(process.argv[2]);
    const surfaces = data.workView?.aiGraphicalSession?.surfaceInventory?.surfaces ?? [];
    process.exit(surfaces.filter((surface) => surface.activated === true).length === 1
      && surfaces.some((surface) => surface.surfaceId === surfaceId && surface.activated === true)
      ? 0 : 1);
  ' "$tmp_dir/activated-state.json" "$fixture_surface_id"; then
    break
  fi
  sleep 0.1
done

curl -fsS "$SESSION_MANAGER_URL/work-view/compositor-frame" > "$tmp_dir/setup-frame.json"
setup_scroll_payload="$(node -e '
  const fs = require("node:fs");
  const state = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const capture = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const surfaceId = Number(process.argv[3]);
  const inventory = state.workView?.aiGraphicalSession?.surfaceInventory ?? {};
  const frame = capture.frame ?? {};
  console.log(JSON.stringify({
    capabilityId: "act.screen.pointer_keyboard",
    operation: "mouse.scroll",
    params: {
      direction: "up",
      surfaceId,
      inventorySequence: inventory.sequence,
      compositorFrame: {
        registry: frame.registry,
        socketName: frame.socketName,
        width: frame.width,
        height: frame.height,
        sha256: frame.sha256,
        sequence: frame.sequence,
        capturedAt: frame.capturedAt,
      },
    },
  }));
' "$tmp_dir/activated-state.json" "$tmp_dir/setup-frame.json" "$fixture_surface_id")"
post_json "$CORE_URL/capabilities/invoke" "$setup_scroll_payload" \
  > "$tmp_dir/setup-scroll.json"
node -e '
  const fs = require("node:fs");
  const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (data.invoked !== true
    || data.result?.summary?.accepted !== true
    || data.result?.governance?.currentActiveSurfaceBound !== true) {
    throw new Error("fixture scroll prepositioning failed");
  }
' "$tmp_dir/setup-scroll.json"
curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/before-step.json"

post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"act.ai.workspace.single_step","params":{"confirm":true}}' \
  > "$tmp_dir/single-step.json"
curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/after-step.json"
curl -fsS "$EVENT_HUB_URL/events/audit?limit=300" > "$tmp_dir/events.json"

node - "$tmp_dir" "$fixture_surface_id" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const directory = process.argv[2];
const fixtureSurfaceId = Number(process.argv[3]);
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const response = read("single-step.json");
const before = read("before-step.json");
const after = read("after-step.json");
const events = read("events.json").items ?? [];
const result = response.result ?? {};
const governance = result.governance ?? {};
const evidence = result.evidence ?? {};
const actionId = result.decision?.actionId ?? null;
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const beforeInput = before.workView?.aiGraphicalSession?.compositorInput ?? {};
const afterInput = after.workView?.aiGraphicalSession?.compositorInput ?? {};
const egress = events.find((event) =>
  event.type === "cloud_provider.ai_workspace_single_step_egress_authorized"
    && event.source === "openclaw-core"
    && event.payload?.contextContentHash === evidence.contextContentHash
    && event.payload?.requestContentHash === evidence.requestContentHash);
const completed = events.find((event) =>
  event.type === "ai_workspace.single_step_completed"
    && event.source === "openclaw-core"
    && event.payload?.contextContentHash === evidence.contextContentHash
    && event.payload?.responseContentHash === evidence.responseContentHash);

if (response.invoked !== true
  || result.registry !== "nixsoma-ai-workspace-single-step-v0"
  || !["no_op", "scroll_up", "scroll_down"].includes(actionId)
  || !["no_op", "executed", "executed_completion_audit_unavailable"].includes(result.status)
  || governance.providerCalled !== true
  || governance.networkEgress !== true
  || governance.maximumActions !== 1
  || governance.automaticRepeat !== false
  || governance.createsTask !== false
  || governance.createsApproval !== false
  || governance.keyboardInput !== false
  || governance.processLaunch !== false
  || governance.parentDisplayConnected !== false
  || governance.mutatesHost !== false
  || !hash(evidence.contextContentHash)
  || !hash(evidence.requestContentHash)
  || !hash(evidence.responseContentHash)
  || !egress
  || !completed
  || JSON.stringify(response.invocation ?? {}).includes(result.decision?.reason ?? "\u0000")
  || JSON.stringify(response).includes("data:image")
  || JSON.stringify(response).includes("callerPrompt")) {
  throw new Error(`live AI workspace decision evidence is incomplete: ${JSON.stringify({
    invoked: response.invoked,
    status: result.status,
    actionId,
    fallback: result.fallback?.reason ?? null,
    governance,
    hashes: {
      context: hash(evidence.contextContentHash),
      request: hash(evidence.requestContentHash),
      response: hash(evidence.responseContentHash),
    },
    egressAudit: Boolean(egress),
    completionAudit: Boolean(completed),
  })}`);
}

if (actionId === "no_op") {
  if (result.status !== "no_op"
    || governance.actionExecuted !== false
    || afterInput.requestId !== beforeInput.requestId) {
    throw new Error("provider no-op unexpectedly contacted the compositor actuator");
  }
} else if (!result.status.startsWith("executed")
  || governance.actionExecuted !== true
  || governance.currentFrameBound !== true
  || governance.currentActiveSurfaceBound !== true
  || result.action?.surfaceId !== fixtureSurfaceId
  || result.action?.executed !== true
  || evidence.receiptMatched !== true
  || evidence.frameChanged !== true
  || afterInput.requestId === beforeInput.requestId
  || afterInput.operation !== "pointer_scroll"
  || afterInput.surfaceId !== fixtureSurfaceId
  || afterInput.receiptMatched !== true) {
  throw new Error("live AI workspace scroll evidence is incomplete");
}

console.log(JSON.stringify({
  registry: "nixsoma-ai-workspace-single-step-live-check-v0",
  providerCalled: true,
  actionId,
  status: result.status,
  actionExecuted: governance.actionExecuted,
  fixtureSurfaceId,
  currentFrameBound: governance.currentFrameBound === true,
  currentActiveSurfaceBound: governance.currentActiveSurfaceBound === true,
  durableEgressAudit: true,
  durableCompletionAudit: true,
  fixturePrepositioned: true,
  maximumActions: 1,
  automaticRepeat: false,
  callerPromptAccepted: false,
  keyboardInput: false,
  parentDisplayConnected: false,
  rootRequired: false,
}, null, 2));
NODE

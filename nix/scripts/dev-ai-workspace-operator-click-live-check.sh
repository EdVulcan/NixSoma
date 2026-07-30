#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_CORE_URL:-http://127.0.0.1:4100}"
EVENT_HUB_URL="${OPENCLAW_EVENT_HUB_URL:-http://127.0.0.1:4101}"
SESSION_MANAGER_URL="${OPENCLAW_SESSION_MANAGER_URL:-http://127.0.0.1:4102}"
OBSERVER_URL="${OPENCLAW_OBSERVER_URL:-http://127.0.0.1:4170}"
AUTHORITY_URL="${NIXSOMA_AI_OPERATOR_CLICK_AUTHORITY_URL:-https://example.org/}"
NATIVE_X="${NIXSOMA_AI_OPERATOR_CLICK_X:-48}"
NATIVE_Y="${NIXSOMA_AI_OPERATOR_CLICK_Y:-177}"
RUNTIME_DIR="$XDG_RUNTIME_DIR/nixsoma-ai-graphical-session"
CAPTURE_DIR="$RUNTIME_DIR/capture"
WORKBENCH_ACTION_MARKER="$RUNTIME_DIR/workbench-action/acknowledged"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
openclaw_use_deployed_operator_token
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-ai-workspace-local-ocr-workbench-helper.sh"
export OPENCLAW_POST_JSON_FAILURE="${OPENCLAW_POST_JSON_FAILURE:-fail-with-body}"

stage() {
  printf 'AI workspace operator click live gate: %s\n' "$1" >&2
}

tmp_dir="$(mktemp -d)"
workbench_requested=0
cleanup() {
  local status="$?"
  if (( workbench_requested )); then
    post_json "$CORE_URL/capabilities/invoke" \
      '{"capabilityId":"act.work_view.control","operation":"work_view.application.stop","params":{}}' \
      >/dev/null 2>&1 || true
  fi
  if (( status != 0 )); then
    for name in prepare start activate ui-result state-after events invocations stop; do
      if [[ -s "$tmp_dir/$name.json" ]]; then
        printf 'AI workspace operator click failed response (%s.json):\n' "$name" >&2
        sed -n '1,180p' "$tmp_dir/$name.json" >&2
      fi
    done
  fi
  rm -rf "$tmp_dir"
  return "$status"
}
trap cleanup EXIT

stage "checking deployed services, operator credential, and fixed graphical owners"
[[ -s "$OPENCLAW_OPERATOR_TOKEN_FILE" ]]
declare -A user_restart_baseline=()
declare -A system_restart_baseline=()
for unit in \
  nixsoma-ai-graphical-session.service \
  openclaw-session-manager.service \
  openclaw-browser-runtime.service
do
  [[ "$(systemctl --user is-active "$unit")" == "active" ]]
  user_restart_baseline["$unit"]="$(systemctl --user show "$unit" -p NRestarts --value)"
done
for unit in \
  openclaw-core.service \
  openclaw-event-hub.service \
  openclaw-screen-sense.service \
  openclaw-screen-act.service \
  openclaw-system-sense.service \
  openclaw-system-heal.service \
  observer-ui.service
do
  [[ "$(systemctl is-active "$unit")" == "active" ]]
  system_restart_baseline["$unit"]="$(systemctl show "$unit" -p NRestarts --value)"
done
[[ -z "$(find "$CAPTURE_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]
firefox_executable="$(systemctl --user show openclaw-browser-runtime.service -p Environment --value \
  | tr ' ' '\n' \
  | sed -n 's/^OPENCLAW_BROWSER_EXECUTABLE=//p' \
  | head -n 1)"
[[ -x "$firefox_executable" ]]

stage "preparing current work-view authority and fixed Workbench surface"
prepare_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: "act.work_view.control",
    operation: "work_view.prepare",
    params: { displayTarget: "workspace-2", entryUrl: process.argv[1] },
  }));
' "$AUTHORITY_URL")"
post_json "$CORE_URL/capabilities/invoke" "$prepare_payload" > "$tmp_dir/prepare.json"
workbench_requested=1
read -r surface_id _ < <(openclaw_start_local_ocr_workbench "$tmp_dir")
[[ ! -e "$WORKBENCH_ACTION_MARKER" ]]

stage "binding the one-shot input to the fixed visible Workbench target"
[[ "$NATIVE_X" =~ ^[0-9]+$ && "$NATIVE_Y" =~ ^[0-9]+$ ]]
(( NATIVE_X >= 0 && NATIVE_X < 1280 && NATIVE_Y >= 0 && NATIVE_Y < 720 ))
native_x="$NATIVE_X"
native_y="$NATIVE_Y"

start_time="$(date -Is)"
stage "arming one click and selecting the target through the production Observer projection"
node --input-type=module - \
  "$OBSERVER_URL" \
  "$OPENCLAW_OPERATOR_TOKEN_FILE" \
  "$firefox_executable" \
  "$native_x" \
  "$native_y" \
  "$tmp_dir/ui-result.json" <<'NODE'
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const [observerUrl, tokenFile, executablePath, nativeXText, nativeYText, outputFile] = process.argv.slice(2);
const token = fs.readFileSync(tokenFile, "utf8").trim();
const nativeX = Number(nativeXText);
const nativeY = Number(nativeYText);
const browser = await puppeteer.launch({
  browser: "firefox",
  executablePath,
  headless: true,
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto(observerUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector("#operator-auth-token", { timeout: 15_000 });
  await page.type("#operator-auth-token", token);
  await page.click("#operator-auth-sign-in");
  await page.waitForFunction(
    () => document.querySelector("#operator-auth-status")?.textContent === "authenticated",
    { timeout: 15_000 },
  );
  console.error("observer operator session authenticated");
  await page.click("#ai-workspace-preview-tab");
  await page.waitForFunction(() => {
    const image = document.querySelector("#ai-workspace-projection-frame");
    const toggle = document.querySelector("#ai-workspace-operator-click-toggle");
    return image && !image.hidden && image.complete
      && image.naturalWidth === 1280 && image.naturalHeight === 720
      && toggle && toggle.disabled === false;
  }, { timeout: 15_000 });
  console.error("observer projection and one-click control ready");

  await page.click("#ai-workspace-operator-click-toggle");
  await page.waitForFunction(() =>
    document.querySelector("#ai-workspace-operator-click-status")?.textContent === "armed"
      && document.querySelector("#ai-workspace-projection-frame")?.classList.contains("operator-click-ready"));
  console.error("observer one-click control armed");

  await page.$eval("#ai-workspace-projection-frame", (image) => {
    image.scrollIntoView({ block: "center", inline: "center" });
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));

  const projected = await page.evaluate(({ x, y }) => {
    const image = document.querySelector("#ai-workspace-projection-frame");
    const bounds = image.getBoundingClientRect();
    return {
      x: bounds.left + image.clientLeft + ((x + 0.5) / 1280) * image.clientWidth,
      y: bounds.top + image.clientTop + ((y + 0.5) / 720) * image.clientHeight,
      offsetX: image.clientLeft + ((x + 0.5) / 1280) * image.clientWidth,
      offsetY: image.clientTop + ((y + 0.5) / 720) * image.clientHeight,
      frameSequence: Number((document.querySelector("#ai-workspace-projection-status")?.textContent ?? "")
        .match(/seq=([1-9][0-9]*)/u)?.[1] ?? 0),
    };
  }, { x: nativeX, y: nativeY });
  console.error("observer projected point " + JSON.stringify(projected));

  const imageHandle = await page.$("#ai-workspace-projection-frame");
  await imageHandle.click({
    button: "left",
    offset: { x: projected.offsetX, y: projected.offsetY },
  });
  await page.waitForFunction(() => /^clicked [0-9]+,[0-9]+$/u.test(
    document.querySelector("#ai-workspace-operator-click-status")?.textContent ?? "",
  ), { timeout: 15_000 });
  console.error("observer projected click completed");

  const ui = await page.evaluate(() => ({
    authenticated: document.querySelector("#operator-auth-status")?.textContent === "authenticated",
    workspaceSelected: document.querySelector("#ai-workspace-preview-tab")?.getAttribute("aria-selected") === "true",
    oneShotDisarmed: document.querySelector("#ai-workspace-operator-click-toggle")?.checked === false,
    readyClassRemoved: !document.querySelector("#ai-workspace-projection-frame")?.classList.contains("operator-click-ready"),
    status: document.querySelector("#ai-workspace-operator-click-status")?.textContent ?? null,
    projectionStatus: document.querySelector("#ai-workspace-projection-status")?.textContent ?? null,
  }));
  const mappedMatch = /^clicked ([0-9]+),([0-9]+)$/u.exec(ui.status ?? "");
  if (!mappedMatch) throw new Error("Observer click status did not expose bounded mapped coordinates.");
  const screenshot = await page.screenshot({ type: "png", fullPage: false });
  fs.writeFileSync(outputFile, JSON.stringify({
    nativePoint: { x: nativeX, y: nativeY },
    mappedPoint: { x: Number(mappedMatch[1]), y: Number(mappedMatch[2]) },
    projectedPoint: projected,
    screenshotBytesInMemory: screenshot.length,
    ui,
  }));
} finally {
  await browser.close();
}
NODE

for _ in $(seq 1 100); do
  [[ -s "$WORKBENCH_ACTION_MARKER" ]] && break
  sleep 0.05
done
[[ -s "$WORKBENCH_ACTION_MARKER" ]]

stage "verifying one-shot UI, native receipt, post-frame, compact audit, and no provider call"
curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/state-after.json"
curl -fsS "$EVENT_HUB_URL/events/audit?limit=500" > "$tmp_dir/events.json"
curl -fsS "$CORE_URL/capabilities/invocations?limit=120" > "$tmp_dir/invocations.json"
curl -fsS "$OBSERVER_URL/" > "$tmp_dir/observer.html"
curl -fsS "$OBSERVER_URL/client.js" > "$tmp_dir/observer-client.js"

node - \
  "$tmp_dir" \
  "$surface_id" \
  "$native_x" \
  "$native_y" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const [directory, surfaceIdText, xText, yText] = process.argv.slice(2);
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const ui = read("ui-result.json");
const state = read("state-after.json");
const input = state.workView?.aiGraphicalSession?.compositorInput ?? {};
const events = read("events.json").items ?? [];
const invocations = read("invocations.json").items ?? [];
const html = fs.readFileSync(path.join(directory, "observer.html"), "utf8");
const client = fs.readFileSync(path.join(directory, "observer-client.js"), "utf8");
const surfaceId = Number(surfaceIdText);
const expectedX = Number(xText);
const expectedY = Number(yText);
const x = ui.mappedPoint?.x;
const y = ui.mappedPoint?.y;
const requested = [...events].reverse().find((event) =>
  event.type === "screen.updated"
    && event.payload?.action === "ai-compositor-input-requested"
    && event.payload?.input?.operation === "pointer_click"
    && event.payload?.input?.x === x
    && event.payload?.input?.y === y);
const executed = [...events].reverse().find((event) =>
  event.type === "screen.updated"
    && event.payload?.action === "ai-compositor-input-executed"
    && event.payload?.input?.requestId === input.requestId);
const invocation = [...invocations].reverse().find((item) =>
  item.summary?.kind === "mouse.click"
    && item.summary?.accepted === true
    && item.summary?.currentActiveSurfaceBound === true);
if (ui.nativePoint?.x !== expectedX
  || ui.nativePoint?.y !== expectedY
  || !Number.isInteger(x)
  || !Number.isInteger(y)
  || Math.abs(x - expectedX) > 5
  || Math.abs(y - expectedY) > 5
  || ui.projectedPoint?.frameSequence < 1
  || ui.screenshotBytesInMemory < 10_000
  || ui.ui?.authenticated !== true
  || ui.ui?.workspaceSelected !== true
  || ui.ui?.oneShotDisarmed !== true
  || ui.ui?.readyClassRemoved !== true
  || ui.ui?.status !== `clicked ${x},${y}`
  || input.registry !== "nixsoma-ai-compositor-input-v0"
  || input.status !== "executed"
  || input.operation !== "pointer_click"
  || input.x !== x
  || input.y !== y
  || input.surfaceId !== surfaceId
  || !Number.isInteger(input.inventorySequence)
  || input.frame?.sequence !== ui.projectedPoint.frameSequence
  || input.postFrame?.sequence <= input.frame?.sequence
  || input.postFrame?.sha256 === input.frame?.sha256
  || input.frameMatched !== true
  || input.frameFresh !== true
  || input.leaseMatched !== true
  || input.receiptMatched !== true
  || input.sequenceAdvanced !== true
  || input.frameChanged !== true
  || input.inventoryMatched !== true
  || input.surfaceMatched !== true
  || input.imageDataRetained !== false
  || input.persisted !== false
  || input.desktopWideInput !== false
  || input.parentDisplayConnected !== false
  || input.rootRequired !== false
  || input.hostMutation !== false
  || !requested
  || requested.payload.input.surfaceId !== surfaceId
  || !executed
  || executed.payload.input.receiptMatched !== true
  || !invocation
  || invocation.request?.intent !== "mouse.click"
  || invocation.summary?.kind !== "mouse.click"
  || invocation.summary?.accepted !== true
  || invocation.summary?.currentActiveSurfaceBound !== true
  || invocation.summary?.noAutomaticDispatch !== true
  || invocation.summary?.noProviderEgress !== true
  || !html.includes('id="ai-workspace-operator-click-toggle"')
  || !client.includes("Clicked AI surface #")
  || !client.includes('capabilityId: "act.screen.pointer_keyboard"')
  || JSON.stringify(state).includes("data:image/png")
  || JSON.stringify(invocation).includes("data:image/png")) {
  throw new Error(`operator projected click evidence invalid: ${JSON.stringify({
    ui, input, requested, executed, invocation,
  })}`);
}

console.log(JSON.stringify({
  registry: "nixsoma-ai-workspace-operator-click-v0",
  surfaceId,
  inventorySequence: input.inventorySequence,
  coordinates: { x, y },
  frameSequence: input.frame.sequence,
  postFrameSequence: input.postFrame.sequence,
  operatorAuthenticated: true,
  oneShotDisarmed: true,
  receiptMatched: true,
  visualChange: true,
  providerCallCount: 0,
  taskMutation: false,
  desktopWideInput: false,
  parentDisplayConnected: false,
  rootRequired: false,
  hostMutation: false,
}, null, 2));
NODE

[[ -z "$(find "$CAPTURE_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]

stage "stopping the fixed Workbench and checking post-run service health"
post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"act.work_view.control","operation":"work_view.application.stop","params":{}}' \
  > "$tmp_dir/stop.json"
workbench_requested=0
for _ in $(seq 1 100); do
  [[ "$(systemctl --user is-active nixsoma-ai-workbench.service)" == "inactive" ]] \
    && [[ ! -e "$WORKBENCH_ACTION_MARKER" ]] \
    && break
  sleep 0.05
done
[[ "$(systemctl --user is-active nixsoma-ai-workbench.service)" == "inactive" ]]
[[ ! -e "$WORKBENCH_ACTION_MARKER" ]]

for unit in \
  nixsoma-ai-graphical-session.service \
  openclaw-session-manager.service \
  openclaw-browser-runtime.service
do
  [[ "$(systemctl --user is-active "$unit")" == "active" ]]
  [[ "$(systemctl --user show "$unit" -p NRestarts --value)" == "${user_restart_baseline[$unit]}" ]]
done
for unit in \
  openclaw-core.service \
  openclaw-event-hub.service \
  openclaw-screen-sense.service \
  openclaw-screen-act.service \
  openclaw-system-sense.service \
  openclaw-system-heal.service \
  observer-ui.service
do
  [[ "$(systemctl is-active "$unit")" == "active" ]]
  [[ "$(systemctl show "$unit" -p NRestarts --value)" == "${system_restart_baseline[$unit]}" ]]
done

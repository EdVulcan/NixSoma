#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_CORE_URL:-http://127.0.0.1:4100}"
EVENT_HUB_URL="${OPENCLAW_EVENT_HUB_URL:-http://127.0.0.1:4101}"
SESSION_MANAGER_URL="${OPENCLAW_SESSION_MANAGER_URL:-http://127.0.0.1:4102}"
SCREEN_ACT_URL="${OPENCLAW_SCREEN_ACT_URL:-http://127.0.0.1:4105}"
OBSERVER_URL="${OPENCLAW_OBSERVER_URL:-http://127.0.0.1:4170}"
export OPENCLAW_OPERATOR_TOKEN_FILE="${OPENCLAW_OPERATOR_TOKEN_FILE:-${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}/nixsoma/operator-token}"
AUTHORITY_URL="${NIXSOMA_AI_OPERATOR_TYPE_AUTHORITY_URL:-https://example.org/}"
# Keep the per-run visual canary short enough for deterministic local OCR.
CANARY="${NIXSOMA_AI_OPERATOR_TYPE_CANARY:-$(date +%H%M%S | tr '0123456789' 'ABCDEFGHJK')}"
RUNTIME_DIR="$XDG_RUNTIME_DIR/nixsoma-ai-graphical-session"
CAPTURE_DIR="$RUNTIME_DIR/capture"
WORKBENCH_ACTION_MARKER="$RUNTIME_DIR/workbench-action/acknowledged"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-ai-workspace-local-ocr-workbench-helper.sh"
export OPENCLAW_POST_JSON_FAILURE="${OPENCLAW_POST_JSON_FAILURE:-fail-with-body}"

stage() {
  printf 'AI workspace operator type live gate: %s\n' "$1" >&2
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
    for name in prepare start activate ui-result state-after events invocations action-state stop; do
      if [[ -s "$tmp_dir/$name.json" ]]; then
        printf 'AI workspace operator type failed response (%s.json):\n' "$name" >&2
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
node -e '
  const value = process.argv[1];
  if (!/^[A-Za-z0-9 .,_-]{1,32}$/u.test(value)) process.exit(1);
' "$CANARY"
canary_chars="${#CANARY}"
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

start_time="$(date -Is)"
stage "submitting one write-only native type through the production Observer projection"
node --input-type=module - \
  "$OBSERVER_URL" \
  "$OPENCLAW_OPERATOR_TOKEN_FILE" \
  "$firefox_executable" \
  "$CANARY" \
  "$tmp_dir/ui-result.json" <<'NODE'
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const [observerUrl, tokenFile, executablePath, canary, outputFile] = process.argv.slice(2);
const token = fs.readFileSync(tokenFile, "utf8").trim();
const browser = await puppeteer.launch({ browser: "firefox", executablePath, headless: true });

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
  await page.click("#ai-workspace-preview-tab");
  await page.waitForFunction(() => {
    const image = document.querySelector("#ai-workspace-projection-frame");
    const input = document.querySelector("#ai-workspace-operator-type-input");
    return image && !image.hidden && image.complete
      && image.naturalWidth === 1280 && image.naturalHeight === 720
      && input && input.disabled === false;
  }, { timeout: 15_000 });

  const frameSequence = await page.evaluate(() => Number(
    (document.querySelector("#ai-workspace-projection-status")?.textContent ?? "")
      .match(/seq=([1-9][0-9]*)/u)?.[1] ?? 0,
  ));
  await page.type("#ai-workspace-operator-type-input", canary);
  await page.waitForFunction(
    () => document.querySelector("#ai-workspace-operator-type-button")?.disabled === false,
  );
  await page.click("#ai-workspace-operator-type-button");
  await page.waitForFunction(
    (count) => document.querySelector("#ai-workspace-operator-type-status")?.textContent === `typed ${count}`,
    { timeout: 15_000 },
    canary.length,
  );
  const ui = await page.evaluate(() => ({
    authenticated: document.querySelector("#operator-auth-status")?.textContent === "authenticated",
    workspaceSelected: document.querySelector("#ai-workspace-preview-tab")?.getAttribute("aria-selected") === "true",
    inputCleared: document.querySelector("#ai-workspace-operator-type-input")?.value === "",
    buttonDisabled: document.querySelector("#ai-workspace-operator-type-button")?.disabled === true,
    status: document.querySelector("#ai-workspace-operator-type-status")?.textContent ?? null,
    projectionStatus: document.querySelector("#ai-workspace-projection-status")?.textContent ?? null,
  }));
  const screenshot = await page.screenshot({ type: "png", fullPage: false });
  fs.writeFileSync(outputFile, JSON.stringify({
    inputCharCount: canary.length,
    frameSequence,
    screenshotBytesInMemory: screenshot.length,
    ui,
  }));
} finally {
  await browser.close();
}
NODE

[[ ! -e "$WORKBENCH_ACTION_MARKER" ]]

stage "confirming the transient visual effect with bounded local OCR"
ocr_json="$(post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"sense.ai.workspace.local_ocr","params":{"confirm":true}}')"

stage "verifying native receipt, compact evidence, zero provider calls, and no plaintext state"
curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/state-after.json"
curl -fsS "$EVENT_HUB_URL/events/audit?limit=500" > "$tmp_dir/events.json"
curl -fsS "$CORE_URL/capabilities/invocations?limit=160" > "$tmp_dir/invocations.json"
curl -fsS "$SCREEN_ACT_URL/act/state" > "$tmp_dir/action-state.json"
curl -fsS "$OBSERVER_URL/" > "$tmp_dir/observer.html"
curl -fsS "$OBSERVER_URL/client.js" > "$tmp_dir/observer-client.js"
journalctl --since "$start_time" \
  -u openclaw-core.service \
  -u openclaw-event-hub.service \
  -u openclaw-screen-act.service \
  -u observer-ui.service \
  --no-pager > "$tmp_dir/system-journal.txt"
journalctl --user --since "$start_time" \
  -u openclaw-session-manager.service \
  -u nixsoma-ai-graphical-session.service \
  -u nixsoma-ai-workbench.service \
  --no-pager > "$tmp_dir/user-journal.txt"

node - \
  "$tmp_dir" \
  "$surface_id" \
  "$canary_chars" \
  "$start_time" \
  "$CANARY" 3< <(printf '%s' "$ocr_json") <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const [directory, surfaceIdText, charCountText, startTime, canary] = process.argv.slice(2);
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const ui = read("ui-result.json");
const state = read("state-after.json");
const events = read("events.json").items ?? [];
const invocations = read("invocations.json").items ?? [];
const actionState = read("action-state.json");
const html = fs.readFileSync(path.join(directory, "observer.html"), "utf8");
const client = fs.readFileSync(path.join(directory, "observer-client.js"), "utf8");
const systemJournal = fs.readFileSync(path.join(directory, "system-journal.txt"), "utf8");
const userJournal = fs.readFileSync(path.join(directory, "user-journal.txt"), "utf8");
const ocrResponse = JSON.parse(fs.readFileSync(3, "utf8"));
const ocr = ocrResponse.result ?? {};
const surfaceId = Number(surfaceIdText);
const inputCharCount = Number(charCountText);
const input = state.workView?.aiGraphicalSession?.compositorInput ?? {};
const requested = [...events].reverse().find((event) =>
  event.type === "screen.updated"
    && event.payload?.action === "ai-compositor-input-requested"
    && event.payload?.input?.operation === "keyboard_type"
    && event.payload?.input?.inputCharCount === inputCharCount);
const executed = [...events].reverse().find((event) =>
  event.type === "screen.updated"
    && event.payload?.action === "ai-compositor-input-executed"
    && event.payload?.input?.requestId === input.requestId);
const invocation = [...invocations].reverse().find((item) =>
  item.summary?.kind === "keyboard.type"
    && item.summary?.nativeTextInput === true
    && item.summary?.inputCharCount === inputCharCount);
const ocrText = (ocr.items ?? []).map((item) => item.text).join(" ").replace(/\s+/gu, " ");
const normalizeVisualText = (value) => value.toUpperCase().replace(/[^A-Z0-9]/gu, "");
const levenshtein = (left, right) => {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      current.push(Math.min(
        current[rightIndex] + 1,
        previous[rightIndex + 1] + 1,
        previous[rightIndex] + (left[leftIndex] === right[rightIndex] ? 0 : 1),
      ));
    }
    previous = current;
  }
  return previous[right.length];
};
const normalizedCanary = normalizeVisualText(canary);
const normalizedOcrText = normalizeVisualText(ocrText);
let ocrVisualDistance = normalizedCanary.length;
for (let start = 0; start < normalizedOcrText.length; start += 1) {
  for (let delta = -2; delta <= 2; delta += 1) {
    const length = normalizedCanary.length + delta;
    if (length < 1 || start + length > normalizedOcrText.length) continue;
    ocrVisualDistance = Math.min(
      ocrVisualDistance,
      levenshtein(normalizedCanary, normalizedOcrText.slice(start, start + length)),
    );
  }
}
const providerEvents = events.filter((event) =>
  Date.parse(event.timestamp ?? event.at ?? "") >= Date.parse(startTime)
    && String(event.type ?? "").startsWith("cloud_provider."));
const durablePayloads = [
  JSON.stringify(state),
  JSON.stringify(events),
  JSON.stringify(invocations),
  JSON.stringify(actionState),
  systemJournal,
  userJournal,
];
const checks = [
  ["ui_input_count", ui.inputCharCount === inputCharCount],
  ["ui_frame_sequence", ui.frameSequence >= 1],
  ["ui_screenshot", ui.screenshotBytesInMemory >= 10_000],
  ["ui_authenticated", ui.ui?.authenticated === true],
  ["ui_workspace_selected", ui.ui?.workspaceSelected === true],
  ["ui_input_cleared", ui.ui?.inputCleared === true],
  ["ui_button_disabled", ui.ui?.buttonDisabled === true],
  ["ui_status", ui.ui?.status === `typed ${inputCharCount}`],
  ["input_registry", input.registry === "nixsoma-ai-compositor-input-v0"],
  ["input_status", input.status === "executed"],
  ["input_operation", input.operation === "keyboard_type"],
  ["input_count", input.inputCharCount === inputCharCount],
  ["input_surface", input.surfaceId === surfaceId],
  ["input_frame", input.frame?.sequence === ui.frameSequence],
  ["input_post_frame", input.postFrame?.sequence > input.frame?.sequence],
  ["input_frame_changed", input.postFrame?.sha256 !== input.frame?.sha256],
  ["input_frame_matched", input.frameMatched === true],
  ["input_frame_fresh", input.frameFresh === true],
  ["input_lease_matched", input.leaseMatched === true],
  ["input_receipt_matched", input.receiptMatched === true],
  ["input_sequence_advanced", input.sequenceAdvanced === true],
  ["input_visual_changed", input.frameChanged === true],
  ["input_inventory_matched", input.inventoryMatched === true],
  ["input_surface_matched", input.surfaceMatched === true],
  ["input_keyboard", input.keyboardInput === true],
  ["input_no_hotkey", input.hotkeyInput === false],
  ["input_no_enter", input.enterKeyInput === false],
  ["input_no_repeat", input.automaticRepeat === false],
  ["input_not_exposed", input.inputTextExposed === false],
  ["input_not_persisted", input.inputTextPersisted === false],
  ["request_audit", Boolean(requested)],
  ["request_not_exposed", requested?.payload?.input?.inputTextExposed === false],
  ["request_not_persisted", requested?.payload?.input?.inputTextPersisted === false],
  ["execution_audit", Boolean(executed)],
  ["core_invocation", Boolean(invocation)],
  ["core_native_execution", invocation?.summary?.compositorNativeExecuted === true],
  ["core_frame_bound", invocation?.summary?.currentFrameBound === true],
  ["core_surface_bound", invocation?.summary?.currentActiveSurfaceBound === true],
  ["core_input_not_persisted", invocation?.summary?.inputTextPersisted === false],
  ["core_no_hotkey", invocation?.summary?.hotkeyInput === false],
  ["core_no_enter", invocation?.summary?.enterKeyInput === false],
  ["core_no_repeat", invocation?.summary?.automaticRepeat === false],
  ["ocr_registry", ocr.registry === "nixsoma-ai-workspace-local-ocr-v0"],
  ["ocr_surface", ocr.surface?.surfaceId === surfaceId],
  ["ocr_visual_text", ocrText.toLowerCase().includes(canary.toLowerCase())],
  ["ocr_no_provider", ocr.governance?.providerCalled === false],
  ["ocr_not_persisted", ocr.governance?.textPersisted === false],
  ["no_provider_events", providerEvents.length === 0],
  ["observer_control", html.includes('id="ai-workspace-operator-type-input"')],
  ["observer_client", client.includes("write-only characters into AI surface")],
  ["no_plaintext_readback", !durablePayloads.some((payload) => payload.includes(canary))],
];
const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name);
if (failedChecks.length > 0) {
  throw new Error(`operator native type evidence is invalid: ${JSON.stringify({
    failedChecks,
    ocrVisualDistance,
  })}`);
}

console.log(JSON.stringify({
  registry: "nixsoma-ai-workspace-operator-type-v0",
  surfaceId,
  inventorySequence: input.inventorySequence,
  inputCharCount,
  frameSequence: input.frame.sequence,
  postFrameSequence: input.postFrame.sequence,
  operatorAuthenticated: true,
  inputCleared: true,
  receiptMatched: true,
  visualTextVerified: true,
  providerCallCount: 0,
  taskMutation: false,
  inputTextPersisted: false,
  hotkeyInput: false,
  enterKeyInput: false,
  automaticRepeat: false,
  desktopWideInput: false,
  parentDisplayConnected: false,
  rootRequired: false,
  hostMutation: false,
}, null, 2));
NODE

[[ -z "$(find "$CAPTURE_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]
[[ ! -e "$WORKBENCH_ACTION_MARKER" ]]

stage "stopping the fixed Workbench and checking post-run service health"
post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"act.work_view.control","operation":"work_view.application.stop","params":{}}' \
  > "$tmp_dir/stop.json"
workbench_requested=0
for _ in $(seq 1 100); do
  [[ "$(systemctl --user is-active nixsoma-ai-workbench.service)" == "inactive" ]] && break
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

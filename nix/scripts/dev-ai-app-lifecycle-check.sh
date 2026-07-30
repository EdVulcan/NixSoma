#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_CORE_URL:-http://127.0.0.1:4100}"
EVENT_HUB_URL="${OPENCLAW_EVENT_HUB_URL:-http://127.0.0.1:4101}"
SESSION_MANAGER_URL="${OPENCLAW_SESSION_MANAGER_URL:-http://127.0.0.1:4102}"
BROWSER_RUNTIME_URL="${OPENCLAW_BROWSER_RUNTIME_URL:-http://127.0.0.1:4103}"
OBSERVER_URL="${OBSERVER_URL:-http://127.0.0.1:4170}"
APP_UNIT="nixsoma-ai-workbench.service"
RUNTIME_DIR="${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}/nixsoma-ai-graphical-session"
SURFACE_FILE="$RUNTIME_DIR/surfaces/current.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
openclaw_use_deployed_operator_token

tmp_dir="$(mktemp -d)"
fixture_pid=""
cleanup() {
  if [[ "$(systemctl --user is-active "$APP_UNIT" 2>/dev/null || true)" == "active" ]]; then
    post_json "$CORE_URL/capabilities/invoke" \
      '{"capabilityId":"act.work_view.control","operation":"work_view.application.stop","params":{}}' \
      >/dev/null 2>&1 || systemctl --user stop "$APP_UNIT" || true
  fi
  if [[ -n "$fixture_pid" ]] && kill -0 "$fixture_pid" 2>/dev/null; then
    kill "$fixture_pid" 2>/dev/null || true
    wait "$fixture_pid" 2>/dev/null || true
  fi
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

declare -A user_restart_baseline=()
declare -A system_restart_baseline=()

[[ -s "$OPENCLAW_OPERATOR_TOKEN_FILE" ]]
[[ "$(systemctl --user show "$APP_UNIT" -p UnitFileState --value)" == "static" ]]
[[ "$(systemctl --user show "$APP_UNIT" -p Restart --value)" == "no" ]]
[[ "$(systemctl --user show "$APP_UNIT" -p PrivateDevices --value)" == "no" ]]
[[ "$(systemctl --user show "$APP_UNIT" -p DevicePolicy --value)" == "closed" ]]
[[ "$(systemctl --user show "$APP_UNIT" -p ProtectHome --value)" == "read-only" ]]
[[ "$(systemctl --user is-active "$APP_UNIT" 2>/dev/null || true)" == "inactive" ]]
for unit in nixsoma-ai-graphical-session.service openclaw-session-manager.service openclaw-browser-runtime.service; do
  [[ "$(systemctl --user is-active "$unit")" == "active" ]]
  user_restart_baseline["$unit"]="$(systemctl --user show "$unit" -p NRestarts --value)"
done
for unit in openclaw-core.service openclaw-event-hub.service observer-ui.service; do
  [[ "$(systemctl is-active "$unit")" == "active" ]]
  system_restart_baseline["$unit"]="$(systemctl show "$unit" -p NRestarts --value)"
done

[[ "$(stat -c '%a:%u:%F' "$RUNTIME_DIR/surfaces")" == "700:$(id -u):directory" ]]
[[ "$(stat -c '%a:%u:%F' "$SURFACE_FILE")" == "600:$(id -u):regular file" ]]
curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/before.json"

workbench_launcher="$(systemctl --user show "$APP_UNIT" -p ExecStart --value \
  | sed -E 's/^\{ path=([^ ;]+).*/\1/')"
weston_terminal="$(grep -o '/nix/store/[^ ]*/bin/weston-terminal' "$workbench_launcher" | head -n 1)"
[[ -x "$weston_terminal" ]]
install -d -m 700 "$tmp_dir/fixture-home" "$tmp_dir/fixture-cache"
fixture_shell="$tmp_dir/fixture-shell"
printf '%s\n' \
  "#!$(command -v bash)" \
  'set -eu' \
  "for line in \$($(command -v seq) 1 120); do printf 'NixSoma Scroll Fixture %03d\\n' \"\$line\"; done" \
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

anonymous_status="$(command curl --silent --output "$tmp_dir/anonymous.json" --write-out '%{http_code}' \
  -X POST "$SESSION_MANAGER_URL/work-view/application/start" \
  -H 'content-type: application/json' \
  --data '{"operatorActionSource":"capability_runtime_work_view_control","recommendedAction":"start_ai_workbench"}')"
[[ "$anonymous_status" == "401" ]]
[[ "$(systemctl --user is-active "$APP_UNIT" 2>/dev/null || true)" == "inactive" ]]
anonymous_scroll_status="$(command curl --silent --output "$tmp_dir/anonymous-scroll.json" --write-out '%{http_code}' \
  -X POST "$SESSION_MANAGER_URL/work-view/compositor-input" \
  -H 'content-type: application/json' \
  --data '{"action":{"direction":"down","surfaceId":1,"inventorySequence":1,"compositorFrame":{}},"trustedHelperLease":{}}')"
[[ "$anonymous_scroll_status" == "401" ]]

firefox_executable="$(systemctl --user show openclaw-browser-runtime.service -p Environment --value \
  | tr ' ' '\n' \
  | sed -n 's/^OPENCLAW_BROWSER_EXECUTABLE=//p' \
  | head -n 1)"
[[ -x "$firefox_executable" ]]

node --input-type=module - \
  "$OBSERVER_URL" \
  "$OPENCLAW_OPERATOR_TOKEN_FILE" \
  "$firefox_executable" \
  "$SESSION_MANAGER_URL" \
  "$BROWSER_RUNTIME_URL" \
  "$fixture_pid" \
  "$tmp_dir" <<'NODE'
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const [
  observerUrl,
  tokenFile,
  executablePath,
  sessionManagerUrl,
  browserRuntimeUrl,
  fixturePidText,
  outputDirectory,
] = process.argv.slice(2);
const fixturePid = Number(fixturePidText);
const token = fs.readFileSync(tokenFile, "utf8").trim();
const browser = await puppeteer.launch({ browser: "firefox", executablePath, headless: true });

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto(observerUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.type("#operator-auth-token", token);
  await page.click("#operator-auth-sign-in");
  try {
    await page.waitForFunction(
      () => document.querySelector("#operator-auth-status")?.textContent === "authenticated",
      { timeout: 15_000 },
    );
  } catch (error) {
    const authState = await page.evaluate(() => ({
      status: document.querySelector("#operator-auth-status")?.textContent ?? null,
      controlMessage: document.querySelector("#control-message")?.textContent ?? null,
      coreUrl: typeof observerConfig === "object" ? observerConfig.coreUrl : null,
    }));
    throw new Error(`Observer operator login did not settle: ${JSON.stringify(authState)}`, {
      cause: error,
    });
  }
  await page.waitForFunction(
    () => document.querySelector("#ai-workbench-status")?.textContent === "stopped",
    { timeout: 15_000 },
  );
  await page.waitForFunction(async (url, pid) => {
    const state = await fetch(`${url}/work-view/state`).then((response) => response.json());
    return state.workView?.aiGraphicalSession?.surfaceInventory?.surfaces
      ?.some((surface) => surface.pid === pid);
  }, { timeout: 15_000 }, sessionManagerUrl, fixturePid);

  await page.click("#prepare-work-view-button");
  try {
    await page.waitForFunction(async (url) => {
      const state = await fetch(url + "/work-view/state").then((response) => response.json());
      const helper = state.workView?.helperRuntime;
      const graphical = state.workView?.aiGraphicalSession;
      return helper?.status === "active"
        && helper.actionAuthority === "active"
        && helper.leaseMatched === true
        && graphical?.browserAttachment?.attached === true;
    }, { timeout: 15_000 }, sessionManagerUrl);
  } catch (error) {
    const diagnostic = await page.evaluate(async (sessionUrl, browserUrl) => ({
      controlMessage: document.querySelector("#control-message")?.textContent ?? null,
      state: await fetch(sessionUrl + "/work-view/state").then((response) => response.json()),
      browserHealth: await fetch(browserUrl + "/health").then(async (response) => ({
        status: response.status,
        body: await response.json(),
      })).catch((fetchError) => ({ error: fetchError.message })),
    }), sessionManagerUrl, browserRuntimeUrl);
    diagnostic.units = execFileSync("systemctl", [
      "--user", "show",
      "nixsoma-ai-graphical-session.service",
      "openclaw-session-manager.service",
      "openclaw-browser-runtime.service",
      "-p", "Id", "-p", "ActiveState", "-p", "SubState", "-p", "MainPID",
      "-p", "NRestarts", "-p", "PartOf",
    ], { encoding: "utf8" });
    diagnostic.journal = execFileSync("journalctl", [
      "--user", "--no-pager", "-n", "40",
      "-u", "nixsoma-ai-graphical-session.service",
      "-u", "openclaw-session-manager.service",
      "-u", "openclaw-browser-runtime.service",
    ], { encoding: "utf8" });
    throw new Error(`AI work view preparation did not settle: ${JSON.stringify(diagnostic)}`, {
      cause: error,
    });
  }
  const preparedState = await fetch(`${sessionManagerUrl}/work-view/state`).then((response) => response.json());
  fs.writeFileSync(path.join(outputDirectory, "prepared.json"), JSON.stringify(preparedState));

  await page.click("#start-ai-workbench-button");
  await page.waitForFunction(() => {
    const status = document.querySelector("#ai-workbench-status")?.textContent;
    const surface = document.querySelector("#ai-workbench-surface")?.textContent ?? "";
    return status === "running" && /^#[1-9][0-9]* pid=[1-9][0-9]*$/u.test(surface);
  }, { timeout: 15_000 });
  const runningState = await fetch(`${sessionManagerUrl}/work-view/state`).then((response) => response.json());
  const application = runningState.workView?.aiGraphicalSession?.applicationLifecycle ?? {};
  const inventory = runningState.workView?.aiGraphicalSession?.surfaceInventory ?? {};
  const mainPid = application.mainPid;
  const unitMainPid = Number(execFileSync("systemctl", [
    "--user", "show", "nixsoma-ai-workbench.service", "-p", "MainPID", "--value",
  ], { encoding: "utf8" }).trim());
  const processEnvironment = fs.readFileSync(`/proc/${mainPid}/environ`)
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const expectedRuntime = `${process.env.XDG_RUNTIME_DIR}/nixsoma-ai-graphical-session`;

  if (application.registry !== "nixsoma-ai-workbench-lifecycle-v0"
    || application.status !== "running"
    || application.active !== true
    || application.surfaceAttached !== true
    || mainPid !== unitMainPid
    || inventory.registry !== "nixsoma-ai-surface-inventory-v0"
    || inventory.status !== "available"
    || !inventory.surfaces?.some((surface) => surface.surfaceId === application.matchingSurface?.surfaceId
      && surface.pid === mainPid)
    || Object.keys(application.matchingSurface ?? {}).sort().join(",") !== "activated,height,pid,surfaceId,width"
    || !processEnvironment.includes("WAYLAND_DISPLAY=nixsoma-ai-0")
    || !processEnvironment.includes(`XDG_RUNTIME_DIR=${expectedRuntime}`)
    || processEnvironment.some((entry) => entry.startsWith("DISPLAY=")
      || entry.startsWith("DBUS_SESSION_BUS_ADDRESS=")
      || entry.includes("API_KEY"))) {
    throw new Error(`running workbench boundary is invalid: ${JSON.stringify({ application, inventory, unitMainPid, processEnvironment })}`);
  }
  fs.writeFileSync(path.join(outputDirectory, "running.json"), JSON.stringify(runningState));
  const fixtureSurface = inventory.surfaces.find((surface) => surface.pid === fixturePid);
  if (!fixtureSurface || fixtureSurface.surfaceId === application.matchingSurface?.surfaceId) {
    throw new Error(`fixed activation fixture surface is missing: ${JSON.stringify({ fixturePid, inventory })}`);
  }

  const visible = await page.evaluate(() => ({
    status: document.querySelector("#ai-workbench-status")?.textContent,
    surface: document.querySelector("#ai-workbench-surface")?.textContent,
    count: Number(document.querySelector("#ai-surface-count")?.textContent),
    startDisabled: document.querySelector("#start-ai-workbench-button")?.disabled,
    stopDisabled: document.querySelector("#stop-ai-workbench-button")?.disabled,
  }));
  if (visible.status !== "running" || !visible.surface.startsWith("#")
    || !Number.isInteger(visible.count) || visible.count < 2
    || visible.startDisabled !== true || visible.stopDisabled !== false) {
    throw new Error(`Observer did not render the running workbench: ${JSON.stringify(visible)}`);
  }

  await page.select("#ai-surface-select", String(fixtureSurface.surfaceId));
  await page.click("#activate-ai-surface-button");
  await page.waitForFunction(async (url, surfaceId) => {
    const state = await fetch(`${url}/work-view/state`).then((response) => response.json());
    const activation = state.workView?.aiGraphicalSession?.surfaceActivation;
    const surfaces = state.workView?.aiGraphicalSession?.surfaceInventory?.surfaces ?? [];
    return activation?.status === "activated"
      && activation.surfaceId === surfaceId
      && activation.receiptMatched === true
      && activation.frameSequenceAdvanced === true
      && activation.frameChanged === true
      && surfaces.find((surface) => surface.surfaceId === surfaceId)?.activated === true;
  }, { timeout: 15_000 }, sessionManagerUrl, fixtureSurface.surfaceId);
  const fixtureActiveState = await fetch(`${sessionManagerUrl}/work-view/state`).then((response) => response.json());
  fs.writeFileSync(path.join(outputDirectory, "fixture-active.json"), JSON.stringify(fixtureActiveState));

  await page.click("#ai-workspace-preview-tab");
  await page.waitForFunction(() =>
    document.querySelector("#ai-workspace-projection-frame")?.hidden === false
      && document.querySelector("#scroll-ai-surface-up-button")?.disabled === false,
  { timeout: 15_000 });
  await page.click("#scroll-ai-surface-up-button");
  try {
    await page.waitForFunction(async (url, surfaceId) => {
      const state = await fetch(url + "/work-view/state").then((response) => response.json());
      const input = state.workView?.aiGraphicalSession?.compositorInput;
      return input?.status === "executed"
        && input.operation === "pointer_scroll"
        && input.direction === "up"
        && input.surfaceId === surfaceId
        && input.inventoryMatched === true
        && input.surfaceMatched === true
        && input.receiptMatched === true
        && input.sequenceAdvanced === true
        && input.frameChanged === true;
    }, { timeout: 15_000 }, sessionManagerUrl, fixtureSurface.surfaceId);
  } catch (error) {
    const diagnostic = await page.evaluate(async (url) => ({
      controlMessage: document.querySelector("#control-message")?.textContent ?? null,
      scrollUpDisabled: document.querySelector("#scroll-ai-surface-up-button")?.disabled,
      state: await fetch(url + "/work-view/state").then((response) => response.json()),
    }), sessionManagerUrl);
    throw new Error(`AI surface scroll up did not settle: ${JSON.stringify(diagnostic)}`, {
      cause: error,
    });
  }
  const scrollUpState = await fetch(`${sessionManagerUrl}/work-view/state`).then((response) => response.json());
  const scrollUpRequestId = scrollUpState.workView?.aiGraphicalSession?.compositorInput?.requestId;
  fs.writeFileSync(path.join(outputDirectory, "scroll-up.json"), JSON.stringify(scrollUpState));

  await page.waitForFunction(() =>
    document.querySelector("#scroll-ai-surface-down-button")?.disabled === false,
  { timeout: 15_000 });
  await page.click("#scroll-ai-surface-down-button");
  await page.waitForFunction(async (url, surfaceId, priorRequestId) => {
    const state = await fetch(url + "/work-view/state").then((response) => response.json());
    const input = state.workView?.aiGraphicalSession?.compositorInput;
    return input?.status === "executed"
      && input.requestId !== priorRequestId
      && input.operation === "pointer_scroll"
      && input.direction === "down"
      && input.surfaceId === surfaceId
      && input.inventoryMatched === true
      && input.surfaceMatched === true
      && input.receiptMatched === true
      && input.sequenceAdvanced === true
      && input.frameChanged === true;
  }, { timeout: 15_000 }, sessionManagerUrl, fixtureSurface.surfaceId, scrollUpRequestId);
  const scrollDownState = await fetch(`${sessionManagerUrl}/work-view/state`).then((response) => response.json());
  fs.writeFileSync(path.join(outputDirectory, "scroll-down.json"), JSON.stringify(scrollDownState));

  await page.select("#ai-surface-select", String(application.matchingSurface.surfaceId));
  await page.click("#activate-ai-surface-button");
  await page.waitForFunction(async (url, surfaceId) => {
    const state = await fetch(`${url}/work-view/state`).then((response) => response.json());
    const activation = state.workView?.aiGraphicalSession?.surfaceActivation;
    const surfaces = state.workView?.aiGraphicalSession?.surfaceInventory?.surfaces ?? [];
    return activation?.status === "activated"
      && activation.surfaceId === surfaceId
      && activation.receiptMatched === true
      && activation.frameChanged === true
      && surfaces.find((surface) => surface.surfaceId === surfaceId)?.activated === true;
  }, { timeout: 15_000 }, sessionManagerUrl, application.matchingSurface.surfaceId);
  const workbenchActiveState = await fetch(`${sessionManagerUrl}/work-view/state`).then((response) => response.json());
  fs.writeFileSync(path.join(outputDirectory, "workbench-active.json"), JSON.stringify(workbenchActiveState));

  await page.click("#stop-ai-workbench-button");
  await page.waitForFunction(() =>
    document.querySelector("#ai-workbench-status")?.textContent === "stopped"
      && document.querySelector("#ai-workbench-surface")?.textContent === "none",
  { timeout: 15_000 });
  const stoppedState = await fetch(`${sessionManagerUrl}/work-view/state`).then((response) => response.json());
  const stopped = stoppedState.workView?.aiGraphicalSession?.applicationLifecycle ?? {};
  const stoppedInventory = stoppedState.workView?.aiGraphicalSession?.surfaceInventory ?? {};
  if (stopped.status !== "stopped" || stopped.active !== false || stopped.surfaceAttached !== false
    || stoppedInventory.surfaces?.some((surface) => surface.pid === mainPid)) {
    throw new Error(`stopped workbench surface remained attached: ${JSON.stringify({ stopped, stoppedInventory })}`);
  }
  fs.writeFileSync(path.join(outputDirectory, "stopped.json"), JSON.stringify(stoppedState));
  fs.writeFileSync(path.join(outputDirectory, "observer.json"), JSON.stringify({
    running: visible,
    stopped: true,
    mainPid,
    surfaceId: application.matchingSurface.surfaceId,
    fixtureSurfaceId: fixtureSurface.surfaceId,
  }));
} finally {
  await browser.close();
}
NODE

kill "$fixture_pid"
wait "$fixture_pid" 2>/dev/null || true
fixture_pid=""
for _attempt in $(seq 1 80); do
  curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/after-fixture.json"
  if node -e '
    const fs = require("node:fs");
    const before = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const after = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
    process.exit(after.workView?.aiGraphicalSession?.surfaceInventory?.count
      === before.workView?.aiGraphicalSession?.surfaceInventory?.count ? 0 : 1);
  ' "$tmp_dir/before.json" "$tmp_dir/after-fixture.json"; then
    break
  fi
  sleep 0.025
done

curl -fsS "$EVENT_HUB_URL/events/audit?limit=300" > "$tmp_dir/events.json"
node - "$tmp_dir" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const directory = process.argv[2];
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const before = read("before.json");
const prepared = read("prepared.json");
const running = read("running.json");
const fixtureActive = read("fixture-active.json");
const workbenchActive = read("workbench-active.json");
const scrollUp = read("scroll-up.json");
const scrollDown = read("scroll-down.json");
const stopped = read("stopped.json");
const afterFixture = read("after-fixture.json");
const observer = read("observer.json");
const anonymous = read("anonymous.json");
const anonymousScroll = read("anonymous-scroll.json");
const events = read("events.json").items ?? [];
const beforeInventory = before.workView?.aiGraphicalSession?.surfaceInventory ?? {};
const preparedInventory = prepared.workView?.aiGraphicalSession?.surfaceInventory ?? {};
const runningInventory = running.workView?.aiGraphicalSession?.surfaceInventory ?? {};
const stoppedInventory = stopped.workView?.aiGraphicalSession?.surfaceInventory ?? {};
const finalInventory = afterFixture.workView?.aiGraphicalSession?.surfaceInventory ?? {};
const fixtureActivation = fixtureActive.workView?.aiGraphicalSession?.surfaceActivation ?? {};
const workbenchActivation = workbenchActive.workView?.aiGraphicalSession?.surfaceActivation ?? {};
const scrollUpInput = scrollUp.workView?.aiGraphicalSession?.compositorInput ?? {};
const scrollDownInput = scrollDown.workView?.aiGraphicalSession?.compositorInput ?? {};
const actions = new Set(events.map((event) => event.payload?.action));

if (before.workView?.aiGraphicalSession?.applicationLifecycle?.status !== "stopped"
  || prepared.workView?.helperRuntime?.status !== "active"
  || prepared.workView?.aiGraphicalSession?.browserAttachment?.attached !== true
  || runningInventory.count !== preparedInventory.count + 1
  || stoppedInventory.count !== preparedInventory.count
  || finalInventory.count !== preparedInventory.count - 1
  || anonymous.code !== "EXECUTION_GRANT_REQUIRED"
  || anonymousScroll.code !== "EXECUTION_GRANT_REQUIRED"
  || !actions.has("ai-workbench-start-requested")
  || !actions.has("ai-workbench-start-completed")
  || !actions.has("ai-workbench-stop-requested")
  || !actions.has("ai-workbench-stop-completed")
  || !actions.has("ai-surface-activation-requested")
  || !actions.has("ai-surface-activation-completed")
  || !actions.has("ai-compositor-input-requested")
  || !actions.has("ai-compositor-input-executed")
  || fixtureActivation.surfaceId !== observer.fixtureSurfaceId
  || workbenchActivation.surfaceId !== observer.surfaceId
  || fixtureActivation.receiptMatched !== true
  || workbenchActivation.receiptMatched !== true
  || fixtureActivation.frameChanged !== true
  || workbenchActivation.frameChanged !== true
  || scrollUpInput.operation !== "pointer_scroll"
  || scrollDownInput.operation !== "pointer_scroll"
  || scrollUpInput.direction !== "up"
  || scrollDownInput.direction !== "down"
  || scrollUpInput.surfaceId !== observer.fixtureSurfaceId
  || scrollDownInput.surfaceId !== observer.fixtureSurfaceId
  || scrollUpInput.receiptMatched !== true
  || scrollDownInput.receiptMatched !== true
  || scrollUpInput.frameChanged !== true
  || scrollDownInput.frameChanged !== true
  || scrollUpInput.frame?.sha256 === scrollUpInput.postFrame?.sha256
  || scrollDownInput.frame?.sha256 === scrollDownInput.postFrame?.sha256
  || JSON.stringify(runningInventory.surfaces).includes("title")
  || JSON.stringify(running).includes("API_KEY")) {
  throw new Error("physical application lifecycle evidence is incomplete");
}
console.log(JSON.stringify({
  registry: "nixsoma-ai-workbench-physical-check-v0",
  startSurfaceId: observer.surfaceId,
  fixtureSurfaceId: observer.fixtureSurfaceId,
  mainPid: observer.mainPid,
  beforeSurfaceCount: beforeInventory.count,
  preparedSurfaceCount: preparedInventory.count,
  runningSurfaceCount: runningInventory.count,
  postWorkbenchStopSurfaceCount: stoppedInventory.count,
  stoppedSurfaceCount: finalInventory.count,
  observerRendered: true,
  anonymousDirectStartRejected: true,
  anonymousDirectScrollRejected: true,
  durableAudit: true,
  surfaceActivationRoundTrip: true,
  frameBoundActivation: true,
  nativeScrollRoundTrip: true,
  activeSurfaceBoundScroll: true,
  devicePolicy: "closed",
  privateDevices: false,
  protectHome: "read-only",
  parentDisplayConnected: false,
  arbitraryProcessLaunch: false,
  rootRequired: false,
}, null, 2));
NODE

[[ "$(systemctl --user is-active "$APP_UNIT" 2>/dev/null || true)" == "inactive" ]]
for unit in nixsoma-ai-graphical-session.service openclaw-session-manager.service openclaw-browser-runtime.service; do
  [[ "$(systemctl --user is-active "$unit")" == "active" ]]
  [[ "$(systemctl --user show "$unit" -p NRestarts --value)" == "${user_restart_baseline[$unit]}" ]]
done
for unit in openclaw-core.service openclaw-event-hub.service observer-ui.service; do
  [[ "$(systemctl is-active "$unit")" == "active" ]]
  [[ "$(systemctl show "$unit" -p NRestarts --value)" == "${system_restart_baseline[$unit]}" ]]
done

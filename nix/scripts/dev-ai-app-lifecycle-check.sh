#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_CORE_URL:-http://127.0.0.1:4100}"
EVENT_HUB_URL="${OPENCLAW_EVENT_HUB_URL:-http://127.0.0.1:4101}"
SESSION_MANAGER_URL="${OPENCLAW_SESSION_MANAGER_URL:-http://127.0.0.1:4102}"
OBSERVER_URL="${OBSERVER_URL:-http://127.0.0.1:4170}"
APP_UNIT="nixsoma-ai-workbench.service"
RUNTIME_DIR="${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}/nixsoma-ai-graphical-session"
SURFACE_FILE="$RUNTIME_DIR/surfaces/current.json"
export OPENCLAW_OPERATOR_TOKEN_FILE="${OPENCLAW_OPERATOR_TOKEN_FILE:-$XDG_RUNTIME_DIR/nixsoma/operator-token}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

tmp_dir="$(mktemp -d)"
cleanup() {
  if [[ "$(systemctl --user is-active "$APP_UNIT" 2>/dev/null || true)" == "active" ]]; then
    post_json "$CORE_URL/capabilities/invoke" \
      '{"capabilityId":"act.work_view.control","operation":"work_view.application.stop","params":{}}' \
      >/dev/null 2>&1 || systemctl --user stop "$APP_UNIT" || true
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

anonymous_status="$(command curl --silent --output "$tmp_dir/anonymous.json" --write-out '%{http_code}' \
  -X POST "$SESSION_MANAGER_URL/work-view/application/start" \
  -H 'content-type: application/json' \
  --data '{"operatorActionSource":"capability_runtime_work_view_control","recommendedAction":"start_ai_workbench"}')"
[[ "$anonymous_status" == "401" ]]
[[ "$(systemctl --user is-active "$APP_UNIT" 2>/dev/null || true)" == "inactive" ]]

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
  "$tmp_dir" <<'NODE'
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const [observerUrl, tokenFile, executablePath, sessionManagerUrl, outputDirectory] = process.argv.slice(2);
const token = fs.readFileSync(tokenFile, "utf8").trim();
const browser = await puppeteer.launch({ browser: "firefox", executablePath, headless: true });

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.goto(observerUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.type("#operator-auth-token", token);
  await page.click("#operator-auth-sign-in");
  await page.waitForFunction(
    () => document.querySelector("#operator-auth-status")?.textContent === "authenticated",
    { timeout: 15_000 },
  );
  await page.waitForFunction(
    () => document.querySelector("#ai-workbench-status")?.textContent === "stopped",
    { timeout: 15_000 },
  );

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

  const visible = await page.evaluate(() => ({
    status: document.querySelector("#ai-workbench-status")?.textContent,
    surface: document.querySelector("#ai-workbench-surface")?.textContent,
    count: Number(document.querySelector("#ai-surface-count")?.textContent),
    startDisabled: document.querySelector("#start-ai-workbench-button")?.disabled,
    stopDisabled: document.querySelector("#stop-ai-workbench-button")?.disabled,
  }));
  if (visible.status !== "running" || !visible.surface.startsWith("#")
    || !Number.isInteger(visible.count) || visible.count < 1
    || visible.startDisabled !== true || visible.stopDisabled !== false) {
    throw new Error(`Observer did not render the running workbench: ${JSON.stringify(visible)}`);
  }

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
  }));
} finally {
  await browser.close();
}
NODE

curl -fsS "$EVENT_HUB_URL/events/audit?limit=300" > "$tmp_dir/events.json"
node - "$tmp_dir" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const directory = process.argv[2];
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const before = read("before.json");
const running = read("running.json");
const stopped = read("stopped.json");
const observer = read("observer.json");
const anonymous = read("anonymous.json");
const events = read("events.json").items ?? [];
const beforeInventory = before.workView?.aiGraphicalSession?.surfaceInventory ?? {};
const runningInventory = running.workView?.aiGraphicalSession?.surfaceInventory ?? {};
const stoppedInventory = stopped.workView?.aiGraphicalSession?.surfaceInventory ?? {};
const actions = new Set(events.map((event) => event.payload?.action));

if (before.workView?.aiGraphicalSession?.applicationLifecycle?.status !== "stopped"
  || runningInventory.count !== beforeInventory.count + 1
  || stoppedInventory.count !== beforeInventory.count
  || anonymous.code !== "EXECUTION_GRANT_REQUIRED"
  || !actions.has("ai-workbench-start-requested")
  || !actions.has("ai-workbench-start-completed")
  || !actions.has("ai-workbench-stop-requested")
  || !actions.has("ai-workbench-stop-completed")
  || JSON.stringify(runningInventory.surfaces).includes("title")
  || JSON.stringify(running).includes("API_KEY")) {
  throw new Error("physical application lifecycle evidence is incomplete");
}
console.log(JSON.stringify({
  registry: "nixsoma-ai-workbench-physical-check-v0",
  startSurfaceId: observer.surfaceId,
  mainPid: observer.mainPid,
  beforeSurfaceCount: beforeInventory.count,
  runningSurfaceCount: runningInventory.count,
  stoppedSurfaceCount: stoppedInventory.count,
  observerRendered: true,
  anonymousDirectStartRejected: true,
  durableAudit: true,
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

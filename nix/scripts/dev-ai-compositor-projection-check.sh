#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_CORE_URL:-http://127.0.0.1:4100}"
EVENT_HUB_URL="${OPENCLAW_EVENT_HUB_URL:-http://127.0.0.1:4101}"
SESSION_MANAGER_URL="${OPENCLAW_SESSION_MANAGER_URL:-http://127.0.0.1:4102}"
OBSERVER_URL="${OBSERVER_URL:-http://127.0.0.1:4170}"
CAPTURE_DIR="${XDG_RUNTIME_DIR:?XDG_RUNTIME_DIR is required}/nixsoma-ai-graphical-session/capture"
export OPENCLAW_OPERATOR_TOKEN_FILE="${OPENCLAW_OPERATOR_TOKEN_FILE:-$XDG_RUNTIME_DIR/nixsoma/operator-token}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

declare -A user_restart_baseline=()
declare -A system_restart_baseline=()

[[ -s "$OPENCLAW_OPERATOR_TOKEN_FILE" ]]
for unit in nixsoma-ai-graphical-session.service openclaw-session-manager.service openclaw-browser-runtime.service; do
  [[ "$(systemctl --user is-active "$unit")" == "active" ]]
  user_restart_baseline["$unit"]="$(systemctl --user show "$unit" -p NRestarts --value)"
done
for unit in openclaw-core.service openclaw-event-hub.service observer-ui.service; do
  [[ "$(systemctl is-active "$unit")" == "active" ]]
  system_restart_baseline["$unit"]="$(systemctl show "$unit" -p NRestarts --value)"
done

curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/before-state.json"
anonymous_status="$(command curl --silent --output "$tmp_dir/anonymous.json" --write-out '%{http_code}' \
  "$CORE_URL/proxy/session-manager/work-view/compositor-frame")"
[[ "$anonymous_status" == "401" ]]
curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/after-anonymous-state.json"

node - "$tmp_dir/before-state.json" "$tmp_dir/after-anonymous-state.json" "$tmp_dir/anonymous.json" <<'NODE'
const fs = require("node:fs");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const before = read(process.argv[2]);
const after = read(process.argv[3]);
const anonymous = read(process.argv[4]);
const beforeSequence = before.workView?.aiGraphicalSession?.compositorFrame?.sequence ?? null;
const afterSequence = after.workView?.aiGraphicalSession?.compositorFrame?.sequence ?? null;
if (anonymous.ok !== false
  || !/operator authentication is required/iu.test(anonymous.error ?? "")
  || beforeSequence !== afterSequence) {
  throw new Error("anonymous projection request was not rejected before capture");
}
NODE

curl -fsS -D "$tmp_dir/projection.headers" \
  "$CORE_URL/proxy/session-manager/work-view/compositor-frame" > "$tmp_dir/projection.json"
tr -d '\r' < "$tmp_dir/projection.headers" | rg -iq '^cache-control: no-store, no-cache, must-revalidate$'
curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/after-state.json"
curl -fsS "$EVENT_HUB_URL/events/audit?limit=300" > "$tmp_dir/events.json"
curl -fsS "$OBSERVER_URL/" > "$tmp_dir/observer.html"
curl -fsS "$OBSERVER_URL/client-v5.js" > "$tmp_dir/observer-client.js"

node - "$tmp_dir" <<'NODE'
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const directory = process.argv[2];
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const projection = read("projection.json");
const after = read("after-state.json");
const events = read("events.json").items ?? [];
const html = fs.readFileSync(path.join(directory, "observer.html"), "utf8");
const client = fs.readFileSync(path.join(directory, "observer-client.js"), "utf8");
const frame = projection.frame ?? {};
const bytes = Buffer.from(String(frame.dataUrl ?? "").replace(/^data:image\/png;base64,/u, ""), "base64");
const metadata = after.workView?.aiGraphicalSession?.compositorFrame ?? {};
const audit = [...events].reverse().find((event) =>
  event.payload?.action === "ai-compositor-frame-captured"
  && event.payload?.compositorFrame?.sha256 === frame.sha256);

if (projection.ok !== true
  || projection.registry !== "nixsoma-ai-output-projection-v0"
  || projection.mode !== "operator_transient"
  || frame.registry !== "nixsoma-ai-compositor-frame-v0"
  || frame.available !== true
  || frame.fresh !== true
  || frame.socketName !== "nixsoma-ai-0"
  || frame.width !== 1280
  || frame.height !== 720
  || frame.byteLength !== bytes.length
  || bytes.length < 8
  || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  || crypto.createHash("sha256").update(bytes).digest("hex") !== frame.sha256
  || projection.boundary?.operatorAuthenticationRequired !== true
  || projection.boundary?.serverPersistence !== false
  || projection.boundary?.browserMemoryOnly !== true
  || projection.boundary?.parentDisplayConnected !== false
  || projection.boundary?.desktopWideCapture !== false
  || projection.boundary?.inputAuthorityExpanded !== false
  || projection.boundary?.rootRequired !== false
  || projection.boundary?.hostMutation !== false) {
  throw new Error(`projection contract is invalid: ${JSON.stringify(projection)}`);
}
if (metadata.sha256 !== frame.sha256
  || metadata.sequence !== frame.sequence
  || metadata.dataExposed !== false
  || JSON.stringify(after).includes("data:image/png")
  || !audit
  || JSON.stringify(audit).includes("data:image/png")) {
  throw new Error("projection pixels escaped transient response memory");
}
for (const token of [
  'id="browser-page-preview-tab"',
  'id="ai-workspace-preview-tab"',
  'id="ai-workspace-projection-frame"',
  "/proxy/session-manager/work-view/compositor-frame",
  "nixsoma-ai-output-projection-v0",
  'crypto.subtle.digest("SHA-256", bytes)',
  'aiWorkspaceProjectionFrame.removeAttribute("src")',
]) {
  if (!html.includes(token) && !client.includes(token)) {
    throw new Error(`Observer projection asset is missing ${token}`);
  }
}
fs.writeFileSync(path.join(directory, "projection-summary.json"), JSON.stringify({
  registry: projection.registry,
  sequence: frame.sequence,
  sha256: frame.sha256,
  byteLength: frame.byteLength,
  capturedAt: frame.capturedAt,
}));
NODE

firefox_executable="$(systemctl --user show openclaw-browser-runtime.service -p Environment --value \
  | tr ' ' '\n' \
  | sed -n 's/^OPENCLAW_BROWSER_EXECUTABLE=//p' \
  | head -n 1)"
[[ -x "$firefox_executable" ]]

node --input-type=module - "$OBSERVER_URL" "$OPENCLAW_OPERATOR_TOKEN_FILE" "$firefox_executable" <<'NODE'
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const observerUrl = process.argv[2];
const token = fs.readFileSync(process.argv[3], "utf8").trim();
const executablePath = process.argv[4];
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
  await page.click("#ai-workspace-preview-tab");
  await page.waitForFunction(() => {
    const image = document.querySelector("#ai-workspace-projection-frame");
    return image && !image.hidden && image.complete
      && image.naturalWidth === 1280 && image.naturalHeight === 720;
  }, { timeout: 15_000 });

  const rendered = await page.evaluate(() => {
    const tabs = document.querySelector(".preview-tabs").getBoundingClientRect();
    const panel = document.querySelector("#ai-workspace-preview");
    const image = document.querySelector("#ai-workspace-projection-frame");
    const imageRect = image.getBoundingClientRect();
    return {
      workspaceSelected: document.querySelector("#ai-workspace-preview-tab").getAttribute("aria-selected") === "true",
      browserSelected: document.querySelector("#browser-page-preview-tab").getAttribute("aria-selected") === "true",
      workspaceHidden: panel.hidden,
      imageHidden: image.hidden,
      imageWidth: imageRect.width,
      imageHeight: imageRect.height,
      imageTop: imageRect.top,
      tabsBottom: tabs.bottom,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      sourcePrefix: image.src.slice(0, 22),
      status: document.querySelector("#ai-workspace-projection-status").textContent,
    };
  });
  if (!rendered.workspaceSelected || rendered.browserSelected || rendered.workspaceHidden
    || rendered.imageHidden || rendered.imageWidth < 240 || rendered.imageHeight < 135
    || Math.abs((rendered.imageWidth / rendered.imageHeight) - (16 / 9)) > 0.02
    || rendered.imageTop <= rendered.tabsBottom || rendered.naturalWidth !== 1280
    || rendered.naturalHeight !== 720 || rendered.sourcePrefix !== "data:image/png;base64,"
    || !/^fresh 1280x720 [1-9][0-9]*B seq=[1-9][0-9]*$/u.test(rendered.status)) {
    throw new Error(`Observer did not render the native projection: ${JSON.stringify(rendered)}`);
  }
  const screenshot = await page.screenshot({ type: "png", fullPage: false });
  if (screenshot.length < 10_000) throw new Error("Observer rendered screenshot is unexpectedly blank");

  await page.click("#browser-page-preview-tab");
  await page.waitForFunction(() => {
    const image = document.querySelector("#ai-workspace-projection-frame");
    return image.hidden && !image.hasAttribute("src")
      && document.querySelector("#ai-workspace-preview").hidden === true;
  });
  await page.click("#ai-workspace-preview-tab");
  await page.waitForFunction(() => !document.querySelector("#ai-workspace-projection-frame").hidden, { timeout: 15_000 });
  await page.click("#operator-auth-sign-out");
  await page.waitForFunction(() => {
    const image = document.querySelector("#ai-workspace-projection-frame");
    return document.querySelector("#operator-auth-status")?.textContent === "signed out"
      && image.hidden && !image.hasAttribute("src");
  }, { timeout: 15_000 });

  console.log(JSON.stringify({
    rendered: true,
    dimensions: `${rendered.naturalWidth}x${rendered.naturalHeight}`,
    status: rendered.status,
    screenshotBytesInMemory: screenshot.length,
    clearedOnModeSwitch: true,
    clearedOnSignOut: true,
  }, null, 2));
} finally {
  await browser.close();
}
NODE

[[ -z "$(find "$CAPTURE_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]
for unit in nixsoma-ai-graphical-session.service openclaw-session-manager.service openclaw-browser-runtime.service; do
  [[ "$(systemctl --user is-active "$unit")" == "active" ]]
  [[ "$(systemctl --user show "$unit" -p NRestarts --value)" == "${user_restart_baseline[$unit]}" ]]
done
for unit in openclaw-core.service openclaw-event-hub.service observer-ui.service; do
  [[ "$(systemctl is-active "$unit")" == "active" ]]
  [[ "$(systemctl show "$unit" -p NRestarts --value)" == "${system_restart_baseline[$unit]}" ]]
done

cat "$tmp_dir/projection-summary.json"

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_URL="https://example.com/openclaw-ai-work-view-capture-summary"
INPUT_TEXT="openclaw summary can read the work view"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5720}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5721}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5722}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5723}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5724}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5725}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5726}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5727}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5790}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-ai-work-view-capture-summary-check.json}"

BROWSER_URL="http://127.0.0.1:$OPENCLAW_BROWSER_RUNTIME_PORT"
SCREEN_URL="http://127.0.0.1:$OPENCLAW_SCREEN_SENSE_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"

cleanup() {
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

post_json() {
  local url="$1"
  local body="$2"
  curl --silent -X POST "$url" -H 'content-type: application/json' -d "$body"
}

"$SCRIPT_DIR/dev-up.sh"

open_result="$(post_json "$BROWSER_URL/browser/open" "{\"url\":\"$TARGET_URL\"}")"
node -e 'const data=JSON.parse(process.argv[1]); if(!data.ok || !data.browser?.sessionId){throw new Error(`browser open failed: ${JSON.stringify(data)}`);}' "$open_result"
post_json "$BROWSER_URL/browser/input" "{\"text\":\"$INPUT_TEXT\"}" >/dev/null
post_json "$BROWSER_URL/browser/click" '{"x":640,"y":360}' >/dev/null

capture="$(curl --silent "$BROWSER_URL/browser/capture")"
screen="$(curl --silent "$SCREEN_URL/screen/current")"

node - <<'EOF' "$capture" "$screen" "$TARGET_URL" "$INPUT_TEXT"
const captureResponse = JSON.parse(process.argv[2]);
const screenResponse = JSON.parse(process.argv[3]);
const targetUrl = process.argv[4];
const inputText = process.argv[5];

const captureSummary = captureResponse.capture?.workViewSummary;
const screenSummary = screenResponse.screen?.workViewSummary;

if (captureSummary?.kind !== "browser-work-view-summary") {
  throw new Error(`browser capture should expose a browser work view summary: ${JSON.stringify(captureSummary)}`);
}
if (captureSummary.url !== targetUrl || !captureSummary.summaryText?.includes(targetUrl)) {
  throw new Error(`browser summary should describe the active URL: ${JSON.stringify(captureSummary)}`);
}
if (!captureSummary.visibleTextBlocks?.includes(inputText)) {
  throw new Error(`browser summary should include recent input in visible text blocks: ${JSON.stringify(captureSummary.visibleTextBlocks)}`);
}
if (captureSummary.recentInteraction?.input !== inputText || captureSummary.recentInteraction?.click?.x !== 640) {
  throw new Error(`browser summary should include recent interaction: ${JSON.stringify(captureSummary.recentInteraction)}`);
}
if (screenSummary?.url !== targetUrl || screenSummary?.recentInteraction?.input !== inputText) {
  throw new Error(`screen-sense should propagate work view summary: ${JSON.stringify(screenSummary)}`);
}
if (!screenResponse.screen?.snapshotText?.includes("Summary: AI work view is focused")) {
  throw new Error("screen snapshot should include readable work view summary text.");
}

console.log(JSON.stringify({
  browserSummary: {
    kind: captureSummary.kind,
    title: captureSummary.title,
    url: captureSummary.url,
    visibleTextBlocks: captureSummary.visibleTextBlocks,
    recentInput: captureSummary.recentInteraction?.input ?? null,
  },
  screenSummary: {
    kind: screenSummary.kind,
    url: screenSummary.url,
    recentInput: screenSummary.recentInteraction?.input ?? null,
  },
}, null, 2));
EOF

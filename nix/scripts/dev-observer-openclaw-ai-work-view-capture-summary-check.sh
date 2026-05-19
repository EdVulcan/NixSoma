#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET_URL="https://example.com/observer-ai-work-view-capture-summary"
INPUT_TEXT="observer reads the work view summary"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-5730}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-5731}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-5732}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-5733}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-5734}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-5735}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-5736}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-5737}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-5800}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-observer-ai-work-view-capture-summary-check.json}"

BROWSER_URL="http://127.0.0.1:$OPENCLAW_BROWSER_RUNTIME_PORT"
SCREEN_URL="http://127.0.0.1:$OPENCLAW_SCREEN_SENSE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

post_json() {
  local url="$1"
  local body="$2"
  curl --silent -X POST "$url" -H 'content-type: application/json' -d "$body"
}

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");

const requiredHtml = [
  "screen-work-view-summary",
  "screen-work-view-url",
];
const requiredClient = [
  "screen.workViewSummary",
  "workViewSummary.visibleTextBlocks",
  "workViewSummary.recentInteraction?.input",
];

for (const token of requiredHtml) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of requiredClient) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
EOF

open_result="$(post_json "$BROWSER_URL/browser/open" "{\"url\":\"$TARGET_URL\"}")"
node -e 'const data=JSON.parse(process.argv[1]); if(!data.ok || !data.browser?.sessionId){throw new Error(`observer summary browser open failed: ${JSON.stringify(data)}`);}' "$open_result"
post_json "$BROWSER_URL/browser/input" "{\"text\":\"$INPUT_TEXT\"}" >/dev/null

screen="$(curl --silent "$SCREEN_URL/screen/current")"

node - <<'EOF' "$screen" "$TARGET_URL" "$INPUT_TEXT"
const data = JSON.parse(process.argv[2]);
const targetUrl = process.argv[3];
const inputText = process.argv[4];
const summary = data.screen?.workViewSummary;

if (summary?.url !== targetUrl) {
  throw new Error(`Observer-facing summary should expose active URL: ${JSON.stringify(summary)}`);
}
if (summary?.recentInteraction?.input !== inputText) {
  throw new Error(`Observer-facing summary should expose recent input: ${JSON.stringify(summary)}`);
}
if (!summary?.visibleTextBlocks?.includes(inputText)) {
  throw new Error(`Observer-facing summary should expose visible text blocks: ${JSON.stringify(summary?.visibleTextBlocks)}`);
}

console.log(JSON.stringify({
  observerSummary: {
    htmlControls: [
      "screen-work-view-summary",
      "screen-work-view-url",
    ],
    clientFields: [
      "screen.workViewSummary",
      "visibleTextBlocks",
      "recentInteraction.input",
    ],
  },
  screenSummary: {
    title: summary.title,
    url: summary.url,
    recentInput: summary.recentInteraction?.input ?? null,
  },
}, null, 2));
EOF

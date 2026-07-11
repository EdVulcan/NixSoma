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
SESSION_MANAGER_URL="http://127.0.0.1:$OPENCLAW_SESSION_MANAGER_PORT"
SCREEN_ACT_URL="http://127.0.0.1:$OPENCLAW_SCREEN_ACT_PORT"
SCREEN_URL="http://127.0.0.1:$OPENCLAW_SCREEN_SENSE_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_FAILURE="allow"
OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"


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
  "screen.trustedSession",
  "workViewSummary.visibleTextBlocks",
  "workViewSummary.recentInteraction?.input?.registry",
  "Trusted Session",
  "Helper Readiness",
  "Recovery Recommendation",
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

prepare_result="$(post_json "$SESSION_MANAGER_URL/work-view/prepare" "{\"displayTarget\":\"workspace-2\",\"entryUrl\":\"$TARGET_URL\"}")"
node -e 'const data=JSON.parse(process.argv[1]); if(!data.ok || data.workView?.helperRuntime?.status!=="active"){throw new Error(`observer summary work view prepare failed: ${JSON.stringify(data)}`);}' "$prepare_result"
post_json "$SCREEN_ACT_URL/act/keyboard/type" "{\"text\":\"$INPUT_TEXT\"}" >/dev/null

screen="$(curl --silent "$SCREEN_URL/screen/current")"

node - <<'EOF' "$screen" "$TARGET_URL" "$INPUT_TEXT"
const data = JSON.parse(process.argv[2]);
const targetUrl = process.argv[3];
const inputText = process.argv[4];
const summary = data.screen?.workViewSummary;
const trustedSession = data.screen?.trustedSession ?? data.screen?.workView?.trustedSession ?? data.screen?.captureMetadata?.trustedSession;

if (summary?.url !== targetUrl) {
  throw new Error(`Observer-facing summary should expose active URL: ${JSON.stringify(summary)}`);
}
if (summary?.recentInteraction?.input?.registry !== "openclaw-write-only-input-evidence-v0"
  || summary.recentInteraction.input.charCount !== inputText.length
  || summary.recentInteraction.input.textExposed !== false
  || JSON.stringify(summary).includes(inputText)) {
  throw new Error(`Observer-facing summary should expose redacted input evidence: ${JSON.stringify(summary)}`);
}
if (trustedSession?.identityLevel !== "level_2_trusted_session_work_view"
  || trustedSession?.boundary?.workViewScope !== "ai_owned_work_view_only"
  || trustedSession?.helperReadiness?.state !== "ready") {
  throw new Error(`Observer-facing summary should expose trusted work-view contract: ${JSON.stringify(trustedSession)}`);
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
    "trustedSession.identityLevel",
    "trustedSession.helperReadiness",
  ],
},
screenSummary: {
  title: summary.title,
  url: summary.url,
  recentInput: summary.recentInteraction?.input ?? null,
  trustedSession: trustedSession.identityLevel,
  helperReadiness: trustedSession.helperReadiness.state,
},
}, null, 2));
EOF

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FINAL_DOC="$REPO_ROOT/docs/guides/OPENCLAW_MVP_FINAL_READINESS.md"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6990}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6991}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6992}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6993}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6994}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6995}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6996}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6997}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6998}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-mvp-final-readiness-check.json}"
export OPENCLAW_SYSTEM_HEAL_STATE_FILE="${OPENCLAW_SYSTEM_HEAL_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-system-heal-mvp-final-readiness-check.json}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
HEAL_URL="http://127.0.0.1:$OPENCLAW_SYSTEM_HEAL_PORT"
. "$SCRIPT_DIR/dev-phase-4-prereqs.sh"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE" "$OPENCLAW_SYSTEM_HEAL_STATE_FILE.tmp"

cleanup() {
  rm -f "${FINAL_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$SCRIPT_DIR/dev-up.sh"
prepare_phase_4_self_heal_evidence "$HEAL_URL"
FINAL_FILE="$(mktemp)"
curl --silent --fail "$CORE_URL/mvp/final-readiness" > "$FINAL_FILE"

node - <<'EOF' "$FINAL_DOC" "$FINAL_FILE"
const fs = require("node:fs");
const doc = fs.readFileSync(process.argv[2], "utf8");
const final = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));

for (const token of [
  "openclaw-mvp-final-readiness",
  "First-stage MVP is complete",
  "Overall deployment and rollback are controllable",
  "No post-MVP automation without a separate plan",
]) {
  if (!doc.includes(token)) throw new Error(`MVP final readiness doc missing ${token}`);
}
if (!final.ok
  || final.registry !== "openclaw-mvp-final-readiness-v0"
  || final.status !== "first_stage_mvp_complete"
  || final.summary?.complete !== true
  || final.summary?.completionPercent !== 100
  || final.summary?.criteriaPassed !== 7
  || final.summary?.criteriaTotal !== 7
  || final.summary?.postMvpWorkStarted !== false
  || final.summary?.mutatesHost !== false
  || final.next?.recommendedSlice !== "openclaw-post-mvp-plan") {
  throw new Error(`MVP final readiness should mark first-stage MVP complete: ${JSON.stringify(final.summary)}`);
}

console.log(JSON.stringify({
  openclawMvpFinalReadiness: {
    status: "passed",
    registry: final.registry,
    criteria: `${final.summary.criteriaPassed}/${final.summary.criteriaTotal}`,
    next: final.next.recommendedSlice,
  },
}, null, 2));
EOF

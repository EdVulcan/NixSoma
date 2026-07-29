#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

export OPENCLAW_CORE_PORT="${OPENCLAW_CORE_PORT:-6400}"
export OPENCLAW_EVENT_HUB_PORT="${OPENCLAW_EVENT_HUB_PORT:-6401}"
export OPENCLAW_SESSION_MANAGER_PORT="${OPENCLAW_SESSION_MANAGER_PORT:-6402}"
export OPENCLAW_BROWSER_RUNTIME_PORT="${OPENCLAW_BROWSER_RUNTIME_PORT:-6403}"
export OPENCLAW_SCREEN_SENSE_PORT="${OPENCLAW_SCREEN_SENSE_PORT:-6404}"
export OPENCLAW_SCREEN_ACT_PORT="${OPENCLAW_SCREEN_ACT_PORT:-6405}"
export OPENCLAW_SYSTEM_SENSE_PORT="${OPENCLAW_SYSTEM_SENSE_PORT:-6406}"
export OPENCLAW_SYSTEM_HEAL_PORT="${OPENCLAW_SYSTEM_HEAL_PORT:-6407}"
export OBSERVER_UI_PORT="${OBSERVER_UI_PORT:-6470}"
export OPENCLAW_CORE_STATE_FILE="${OPENCLAW_CORE_STATE_FILE:-$REPO_ROOT/.artifacts/openclaw-core-capability-check.json}"
export OPENCLAW_EVENT_LOG_FILE="${OPENCLAW_EVENT_LOG_FILE:-$REPO_ROOT/.artifacts/openclaw-capability-check-events.jsonl}"

CORE_URL="http://127.0.0.1:$OPENCLAW_CORE_PORT"
EVENT_HUB_URL="http://127.0.0.1:$OPENCLAW_EVENT_HUB_PORT"
OBSERVER_URL="http://127.0.0.1:$OBSERVER_UI_PORT"

"$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
rm -f "$OPENCLAW_CORE_STATE_FILE" "$OPENCLAW_CORE_STATE_FILE.tmp" "$OPENCLAW_EVENT_LOG_FILE"

cleanup() {
  rm -f "${HTML_FILE:-}" "${CLIENT_FILE:-}"
  "$SCRIPT_DIR/dev-down.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OPENCLAW_POST_JSON_DATA_FLAG="-d"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"

"$SCRIPT_DIR/dev-up.sh"

HTML_FILE="$(mktemp)"
CLIENT_FILE="$(mktemp)"
curl --silent --fail "$OBSERVER_URL/" > "$HTML_FILE"
curl --silent --fail "$OBSERVER_URL/client-v5.js" > "$CLIENT_FILE"

node - <<'EOF' "$HTML_FILE" "$CLIENT_FILE"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");

for (const token of ["Body Capabilities", "capability-registry", "capability-json"]) {
  if (!html.includes(token)) {
    throw new Error(`Observer HTML missing ${token}`);
  }
}
for (const token of ["/capabilities", "capability.updated", "refreshCapabilityState"]) {
  if (!client.includes(token)) {
    throw new Error(`Observer client missing ${token}`);
  }
}
EOF

capabilities="$(curl --silent --fail "$CORE_URL/capabilities")"
summary="$(curl --silent --fail "$CORE_URL/capabilities/summary")"
refresh="$(post_json "$CORE_URL/capabilities/refresh" '{}')"
audit="$(curl --silent --fail "$EVENT_HUB_URL/events/audit?type=capability.updated&source=openclaw-core&limit=5")"

node - <<'EOF' "$capabilities" "$summary" "$refresh" "$audit"
const capabilities = JSON.parse(process.argv[2]);
const summary = JSON.parse(process.argv[3]);
const refresh = JSON.parse(process.argv[4]);
const audit = JSON.parse(process.argv[5]);

if (!capabilities.ok || capabilities.registry !== "capability-v0" || capabilities.mode !== "local-body-registry") {
  throw new Error("capability registry should expose capability-v0 local-body-registry");
}
if (!Array.isArray(capabilities.capabilities) || capabilities.capabilities.length < 10) {
  throw new Error("capability registry should expose the body capability set");
}

const byId = Object.fromEntries(capabilities.capabilities.map((capability) => [capability.id, capability]));
for (const id of [
  "sense.screen.observe",
  "sense.system.vitals",
  "memory.event.audit",
  "act.work_view.control",
  "act.browser.open",
  "act.browser.current_tab.close",
  "act.screen.pointer_keyboard",
  "act.system.heal",
  "govern.policy.evaluate",
  "operate.task.loop",
  "boundary.cross_domain.approval",
]) {
  if (!byId[id]) {
    throw new Error(`missing capability ${id}`);
  }
}

if (byId["boundary.cross_domain.approval"].requiresApproval !== true || byId["boundary.cross_domain.approval"].governance !== "require_approval") {
  throw new Error("cross-boundary capability should require approval");
}
if (byId["act.system.heal"].domains?.[0] !== "body_internal" || byId["act.system.heal"].governance !== "audit_only") {
  throw new Error("system heal capability should remain body-internal and audited");
}
if (byId["act.browser.open"].risk !== "medium" || !byId["act.browser.open"].intents?.includes("browser.open")) {
  throw new Error("browser open capability should carry medium-risk browser.open intent");
}
if (byId["act.browser.current_tab.close"].risk !== "medium"
  || byId["act.browser.current_tab.close"].governance !== "allow"
  || JSON.stringify(byId["act.browser.current_tab.close"].intents) !== JSON.stringify(["browser.current_tab.close"])) {
  throw new Error("browser current-tab close should expose one fixed medium-risk intent");
}

const requiredKinds = ["sensor", "actuator", "governance", "memory", "operator", "boundary"];
for (const kind of requiredKinds) {
  if (!capabilities.summary?.byKind?.[kind]) {
    throw new Error(`capability summary missing kind ${kind}`);
  }
}
if ((capabilities.summary?.online ?? 0) < capabilities.capabilities.length) {
  throw new Error("all services should be online during capability check");
}
if ((capabilities.summary?.requiresApproval ?? 0) < 1) {
  throw new Error("capability summary should count approval-gated capabilities");
}
if (summary.summary?.total !== capabilities.summary?.total || summary.summary?.online !== capabilities.summary?.online) {
  throw new Error("capability summary endpoint should match registry summary");
}
if (!refresh.ok || refresh.refreshed !== true || refresh.summary?.total !== capabilities.summary?.total) {
  throw new Error("capability refresh should return refreshed registry state");
}
if (audit.count < 1 || audit.items[0]?.payload?.registry !== "capability-v0") {
  throw new Error("capability refresh should publish capability.updated audit event");
}

console.log(JSON.stringify({
  capabilityRegistry: {
    registry: capabilities.registry,
    mode: capabilities.mode,
    total: capabilities.summary.total,
    online: capabilities.summary.online,
    kinds: capabilities.summary.byKind,
    risks: capabilities.summary.byRisk,
    governance: capabilities.summary.byGovernance,
    approvalGates: capabilities.summary.requiresApproval,
  },
  examples: {
    screenObserve: {
      status: byId["sense.screen.observe"].status,
      service: byId["sense.screen.observe"].service,
    },
    browserOpen: {
      risk: byId["act.browser.open"].risk,
      governance: byId["act.browser.open"].governance,
    },
    browserCurrentTabClose: {
      risk: byId["act.browser.current_tab.close"].risk,
      governance: byId["act.browser.current_tab.close"].governance,
    },
    crossBoundary: {
      risk: byId["boundary.cross_domain.approval"].risk,
      governance: byId["boundary.cross_domain.approval"].governance,
      requiresApproval: byId["boundary.cross_domain.approval"].requiresApproval,
    },
  },
  refreshEvent: {
    count: audit.count,
    type: audit.items[0]?.type ?? null,
  },
}, null, 2));
EOF

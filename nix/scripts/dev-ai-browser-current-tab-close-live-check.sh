#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_CORE_URL:-http://127.0.0.1:4100}"
EVENT_HUB_URL="${OPENCLAW_EVENT_HUB_URL:-http://127.0.0.1:4101}"
SESSION_MANAGER_URL="${OPENCLAW_SESSION_MANAGER_URL:-http://127.0.0.1:4102}"
BROWSER_RUNTIME_URL="${OPENCLAW_BROWSER_RUNTIME_URL:-http://127.0.0.1:4103}"
SCREEN_SENSE_URL="${OPENCLAW_SCREEN_SENSE_URL:-http://127.0.0.1:4104}"
SCREEN_ACT_URL="${OPENCLAW_SCREEN_ACT_URL:-http://127.0.0.1:4105}"
SYSTEM_SENSE_URL="${OPENCLAW_SYSTEM_SENSE_URL:-http://127.0.0.1:4106}"
SYSTEM_HEAL_URL="${OPENCLAW_SYSTEM_HEAL_URL:-http://127.0.0.1:4107}"
OBSERVER_URL="${OPENCLAW_OBSERVER_URL:-http://127.0.0.1:4170}"
AUTHORITY_URL="${NIXSOMA_AI_BROWSER_CLOSE_AUTHORITY_URL:-https://example.org/}"
TARGET_URL="${NIXSOMA_AI_BROWSER_CLOSE_TARGET_URL:-https://example.com/}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/dev-openclaw-http-json-helper.sh"
openclaw_use_deployed_operator_token
export OPENCLAW_POST_JSON_FAILURE="${OPENCLAW_POST_JSON_FAILURE:-fail-with-body}"

stage() {
  printf 'AI browser current-tab close live gate: %s\n' "$1" >&2
}

tmp_dir="$(mktemp -d)"
cleanup() {
  local status="$?"
  if (( status != 0 )); then
    for name in prepare new-tab before close after work-view events invocations; do
      if [[ -s "$tmp_dir/$name.json" ]]; then
        printf 'AI browser current-tab close failed response (%s.json):\n' "$name" >&2
        sed -n '1,160p' "$tmp_dir/$name.json" >&2
      fi
    done
  fi
  rm -rf "$tmp_dir"
  return "$status"
}
trap cleanup EXIT

declare -A user_restart_baseline=()
declare -A system_restart_baseline=()

stage "checking deployed services, operator credential, and real browser owner"
[[ -r "$OPENCLAW_OPERATOR_TOKEN_FILE" && -s "$OPENCLAW_OPERATOR_TOKEN_FILE" ]]
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
boot_id_before="$(< /proc/sys/kernel/random/boot_id)"
generation_before="$(readlink -f /run/current-system)"
started_at="$(date -Is)"

stage "preparing the current trusted work view"
curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/work-view.json"
curl -fsS "$BROWSER_RUNTIME_URL/browser/state" > "$tmp_dir/before.json"
if node - "$tmp_dir/work-view.json" "$tmp_dir/before.json" <<'NODE'
const fs = require("node:fs");
const workView = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).workView ?? {};
const browser = JSON.parse(fs.readFileSync(process.argv[3], "utf8")).browser ?? {};
process.exit(workView.status === "prepared"
  && workView.helperRuntime?.actionAuthority === "active"
  && workView.helperRuntime?.leaseMatched === true
  && browser.running === true
  && browser.engine?.mode === "firefox"
  && browser.engine?.realEngine === true ? 0 : 1);
NODE
then
  printf '%s\n' '{"ok":true,"skipped":true,"reason":"current_authority_ready"}' > "$tmp_dir/prepare.json"
else
  prepare_payload="$(node -e '
    console.log(JSON.stringify({
      capabilityId: "act.work_view.control",
      operation: "work_view.prepare",
      params: { displayTarget: "workspace-2", entryUrl: process.argv[1] },
    }));
  ' "$AUTHORITY_URL")"
  post_json "$CORE_URL/capabilities/invoke" "$prepare_payload" > "$tmp_dir/prepare.json"
fi

for _ in $(seq 1 160); do
  curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/work-view.json"
  curl -fsS "$BROWSER_RUNTIME_URL/browser/state" > "$tmp_dir/before.json"
  if node - "$tmp_dir/work-view.json" "$tmp_dir/before.json" <<'NODE'
const fs = require("node:fs");
const workView = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).workView ?? {};
const browser = JSON.parse(fs.readFileSync(process.argv[3], "utf8")).browser ?? {};
process.exit(workView.status === "prepared"
  && workView.helperRuntime?.actionAuthority === "active"
  && workView.helperRuntime?.leaseMatched === true
  && browser.running === true
  && browser.engine?.mode === "firefox"
  && browser.engine?.realEngine === true
  && Number.isInteger(browser.browserPid)
  && Array.isArray(browser.tabs)
  && browser.tabs.length >= 1 ? 0 : 1);
NODE
  then
    break
  fi
  sleep 0.1
done

stage "opening one explicit target tab through the governed owner"
new_tab_payload="$(node -e '
  console.log(JSON.stringify({
    capabilityId: "act.browser.open",
    operation: "browser.new_tab",
    intent: "browser.new_tab",
    params: { url: process.argv[1] },
  }));
' "$TARGET_URL")"
post_json "$CORE_URL/capabilities/invoke" "$new_tab_payload" > "$tmp_dir/new-tab.json"

for _ in $(seq 1 160); do
  curl -fsS "$BROWSER_RUNTIME_URL/browser/state" > "$tmp_dir/before.json"
  if node - "$tmp_dir/before.json" "$TARGET_URL" <<'NODE'
const fs = require("node:fs");
const browser = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).browser ?? {};
const expectedUrl = new URL(process.argv[3]).href;
process.exit(browser.running === true
  && browser.engine?.mode === "firefox"
  && browser.engine?.realEngine === true
  && browser.activeUrl === expectedUrl
  && Array.isArray(browser.tabs)
  && browser.tabs.length >= 2 ? 0 : 1);
NODE
  then
    break
  fi
  sleep 0.1
done

stage "closing only the current tab through one exact capability request"
post_json "$CORE_URL/capabilities/invoke" \
  '{"capabilityId":"act.browser.current_tab.close","operation":"browser.current_tab.close","params":{"confirm":true}}' \
  > "$tmp_dir/close.json"

curl -fsS "$BROWSER_RUNTIME_URL/browser/state" > "$tmp_dir/after.json"
curl -fsS "$SESSION_MANAGER_URL/work-view/state" > "$tmp_dir/work-view.json"
curl -fsS "$EVENT_HUB_URL/events/audit?limit=500" > "$tmp_dir/events.json"
curl -fsS "$CORE_URL/capabilities/invocations?limit=160" > "$tmp_dir/invocations.json"

stage "verifying real Firefox state, compact evidence, durable audit, and no restart"
for url in "$CORE_URL" "$EVENT_HUB_URL" "$SESSION_MANAGER_URL" "$BROWSER_RUNTIME_URL" \
  "$SCREEN_SENSE_URL" "$SCREEN_ACT_URL" "$SYSTEM_SENSE_URL" "$SYSTEM_HEAL_URL" "$OBSERVER_URL"; do
  curl -fsS "$url/health" > /dev/null
done

node - \
  "$tmp_dir" \
  "$TARGET_URL" \
  "$started_at" \
  "$generation_before" \
  "$boot_id_before" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const [directory, targetUrl, startedAt, generation, bootId] = process.argv.slice(2);
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const before = read("before.json").browser ?? {};
const after = read("after.json").browser ?? {};
const response = read("close.json");
const result = response.result ?? {};
const summary = response.summary ?? {};
const effect = result.action?.mediation?.effect ?? {};
const governance = result.governance ?? {};
const workView = read("work-view.json").workView ?? {};
const events = read("events.json").items ?? [];
const invocations = read("invocations.json").items ?? [];
const expectedTargetUrl = new URL(targetUrl).href;
const startedMs = Date.parse(startedAt);
const currentGeneration = fs.realpathSync("/run/current-system");
const currentBootId = fs.readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
const invocation = invocations.find((item) => item.id === response.invocation?.id);
const browserAudit = [...events].reverse().find((event) =>
  Date.parse(event.timestamp) >= startedMs
    && event.type === "browser.updated"
    && event.source === "openclaw-browser-runtime"
    && event.payload?.action === "browser.current_tab.close"
    && event.payload?.effect?.registry === "openclaw-browser-current-tab-close-v0"
    && event.payload?.effect?.tabCountBefore === before.tabs?.length
    && event.payload?.effect?.tabCountAfter === after.tabs?.length);
const screenAudit = [...events].reverse().find((event) =>
  Date.parse(event.timestamp) >= startedMs
    && event.type === "screen_act.action_completed"
    && event.source === "openclaw-screen-act"
    && event.payload?.action?.kind === "browser.current_tab.close"
    && event.payload?.action?.mediation?.effect?.registry === "openclaw-browser-current-tab-close-v0");
const transport = result.action?.mediation?.transport ?? null;
const visualGrounding = screenAudit?.payload?.action?.mediation?.visualGrounding ?? {};
const visualGroundingValid = transport === "browser-runtime-direct"
  ? screenAudit?.payload?.action?.mediation?.visualGrounding == null
  : transport === "trusted-sidecar-ipc"
    && visualGrounding.required === true
    && visualGrounding.status === "grounded"
    && visualGrounding.sequenceAdvanced === true;
const compactResult = JSON.stringify(result);

if (response.ok !== true
  || response.invoked !== true
  || response.capability?.id !== "act.browser.current_tab.close"
  || response.policy?.subject?.intent !== "browser.current_tab.close"
  || response.invocation?.request?.intent !== "browser.current_tab.close"
  || result.ok !== true
  || result.registry !== "openclaw-browser-current-tab-close-capability-v0"
  || result.operation !== "browser.current_tab.close"
  || result.action?.kind !== "browser.current_tab.close"
  || result.action?.result !== "executed-browser-runtime"
  || result.action?.degraded !== false
  || result.action?.mediation?.accepted !== true
  || result.action?.mediation?.leaseMatched !== true
  || !["browser-runtime-direct", "trusted-sidecar-ipc"].includes(transport)
  || effect.registry !== "openclaw-browser-current-tab-close-v0"
  || effect.status !== "closed"
  || effect.tabCountBefore !== before.tabs?.length
  || effect.tabCountAfter !== after.tabs?.length
  || effect.tabCountAfter !== effect.tabCountBefore - 1
  || effect.tabCountAfter < 1
  || effect.currentTabClosed !== true
  || effect.activeTabChanged !== true
  || effect.lastTabPreserved !== true
  || effect.callerSelectedTab !== false
  || effect.automaticCleanup !== false
  || effect.browserProcessControlled !== false
  || effect.browserWindowControlled !== false
  || effect.desktopTakeover !== false
  || effect.contractMatched !== true
  || governance.explicitOperatorConfirmation !== true
  || governance.currentTabOnly !== true
  || governance.callerTabSelection !== false
  || governance.maximumActions !== 1
  || governance.actionExecuted !== true
  || governance.automaticCleanup !== false
  || governance.automaticRepeat !== false
  || governance.providerCall !== false
  || governance.providerEgress !== false
  || governance.mutatesHost !== false
  || summary.kind !== "browser.current_tab.close"
  || summary.browserRuntimeExecuted !== true
  || summary.minimumTabPreserved !== true
  || summary.noCallerTabSelection !== true
  || summary.noAutomaticCleanup !== true
  || summary.noProcessOrWindowControl !== true
  || summary.noPayloadExposure !== true
  || summary.noProviderEgress !== true
  || before.running !== true
  || after.running !== true
  || before.engine?.mode !== "firefox"
  || after.engine?.mode !== "firefox"
  || before.engine?.realEngine !== true
  || after.engine?.realEngine !== true
  || !Number.isInteger(before.browserPid)
  || after.browserPid !== before.browserPid
  || before.activeUrl !== expectedTargetUrl
  || after.activeUrl === expectedTargetUrl
  || before.tabs?.some((tab) => tab.url === expectedTargetUrl) !== true
  || after.tabs?.some((tab) => tab.url === expectedTargetUrl) !== false
  || !browserAudit
  || !screenAudit
  || !visualGroundingValid
  || !invocation
  || invocation.summary?.kind !== "browser.current_tab.close"
  || invocation.summary?.browserRuntimeExecuted !== true
  || workView.status !== "prepared"
  || workView.helperRuntime?.actionAuthority !== "active"
  || workView.helperRuntime?.leaseMatched !== true
  || compactResult.includes(expectedTargetUrl)
  || compactResult.includes('"tabId"')
  || compactResult.includes('"activeUrl"')
  || currentGeneration !== generation
  || currentBootId !== bootId) {
  throw new Error(`current-tab close physical evidence invalid: ${JSON.stringify({
    response, before, after, workView, invocation, browserAudit, screenAudit,
    currentGeneration, currentBootId,
  })}`);
}

console.log(JSON.stringify({
  registry: "nixsoma-ai-browser-current-tab-close-physical-v0",
  generation,
  browserMode: after.engine.mode,
  browserPid: after.browserPid,
  tabCountBefore: effect.tabCountBefore,
  tabCountAfter: effect.tabCountAfter,
  currentTabClosed: true,
  finalTabPreserved: true,
  leaseMatched: true,
  transport,
  visualGrounding: visualGrounding.status ?? "direct_runtime_not_required",
  durableBrowserAudit: true,
  durableScreenActAudit: true,
  callerTabSelection: false,
  automaticCleanup: false,
  automaticRepeat: false,
  providerCallCount: 0,
  hostMutation: false,
  rebooted: false,
}, null, 2));
NODE

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

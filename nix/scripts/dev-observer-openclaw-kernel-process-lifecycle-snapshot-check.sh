#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_INSTALLED_CORE_URL:-http://127.0.0.1:4100}"
OBSERVER_URL="${OPENCLAW_INSTALLED_OBSERVER_URL:-http://127.0.0.1:4170}"

systemctl is-active --quiet openclaw-core.service openclaw-system-sense.service observer-ui.service
curl --silent --fail "$CORE_URL/health" >/dev/null
curl --silent --fail "$OBSERVER_URL/health" >/dev/null

html_file="$(mktemp)"
client_file="$(mktemp)"
snapshot_file="$(mktemp)"
generator_pid=""
cleanup() {
  if [[ -n "$generator_pid" ]]; then
    kill "$generator_pid" 2>/dev/null || true
    wait "$generator_pid" 2>/dev/null || true
  fi
  rm -f "$html_file" "$client_file" "$snapshot_file"
}
trap cleanup EXIT

curl --silent --fail "$OBSERVER_URL/" >"$html_file"
curl --silent --fail "$OBSERVER_URL/client-v5.js" >"$client_file"

# Create bounded local churn so the explicit capture proves both lanes instead
# of treating an otherwise valid quiet capture window as installed failure.
(
  for _ in $(seq 1 24); do
    /run/current-system/sw/bin/true
    /run/current-system/sw/bin/sleep 0.01
    sleep 0.03
  done
) &
generator_pid=$!
curl --silent --fail \
  "$CORE_URL/proxy/system-sense/system/kernel/process-lifecycle-snapshot" \
  >"$snapshot_file"
wait "$generator_pid"
generator_pid=""

node - <<'EOF' "$html_file" "$client_file" "$snapshot_file"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const snapshot = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
for (const token of [
  "Process Lifecycle Snapshot", "capture-kernel-process-lifecycle-button",
  "kernel-process-lifecycle-start-count", "kernel-process-lifecycle-exit-count",
]) if (!html.includes(token)) throw new Error("Observer HTML missing " + token);
for (const token of [
  "/system/kernel/process-lifecycle-snapshot", "captureKernelProcessLifecycleSnapshot",
  "captureKernelProcessLifecycleButton.addEventListener",
]) if (!client.includes(token)) throw new Error("Observer client missing " + token);
if (client.includes("setInterval(captureKernelProcessLifecycleSnapshot")) {
  throw new Error("Observer must not repeat process lifecycle capture automatically");
}
if (snapshot.registry !== "openclaw-kernel-process-lifecycle-snapshot-v0"
  || snapshot.status !== "complete"
  || snapshot.availableLaneCount !== 2
  || snapshot.boundary?.rawEventsIncluded !== false
  || snapshot.boundary?.processNamesIncluded !== false
  || snapshot.boundary?.persisted !== false
  || snapshot.boundary?.automaticRepeat !== false
  || snapshot.boundary?.hostMutation !== false
  || Object.values(snapshot.lanes ?? {}).some((lane) => lane.eventCount < 1)) {
  throw new Error("Observer process lifecycle evidence was incomplete: " + JSON.stringify(snapshot));
}
console.log(JSON.stringify({
  observerOpenClawKernelProcessLifecycleSnapshot: {
    status: "passed",
    panel: "Process Lifecycle Snapshot",
    registry: snapshot.registry,
    availableLaneCount: snapshot.availableLaneCount,
    eventCount: snapshot.eventCount,
    explicitTrigger: true,
    automaticRepeat: false,
    rawEventsIncluded: false,
  },
}, null, 2));
EOF

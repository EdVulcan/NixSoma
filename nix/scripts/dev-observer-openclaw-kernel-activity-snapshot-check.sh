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
temporary_file="$(mktemp)"
cleanup() { rm -f "$html_file" "$client_file" "$snapshot_file" "$temporary_file"; }
trap cleanup EXIT

curl --silent --fail "$OBSERVER_URL/" >"$html_file"
curl --silent --fail "$OBSERVER_URL/client-v5.js" >"$client_file"
(
  for _ in $(seq 1 24); do
    /run/current-system/sw/bin/true
    curl --silent --fail "$CORE_URL/health" >/dev/null
    : >"$temporary_file"
    /run/current-system/sw/bin/cat "$temporary_file" >/dev/null
    sleep 0.05
  done
) &
generator_pid=$!
curl --silent --fail \
  "$CORE_URL/proxy/system-sense/system/kernel/activity-snapshot" \
  >"$snapshot_file"
wait "$generator_pid"

node - <<'EOF' "$html_file" "$client_file" "$snapshot_file"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const snapshot = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));
for (const token of [
  "Kernel Activity Snapshot", "capture-kernel-activity-button", "kernel-activity-status",
  "kernel-activity-available-lanes", "kernel-activity-event-count",
  "kernel-activity-process-count", "kernel-activity-network-count",
  "kernel-activity-file-count", "kernel-activity-json",
]) if (!html.includes(token)) throw new Error("Observer HTML missing " + token);
for (const token of [
  "/system/kernel/activity-snapshot", "captureKernelActivitySnapshot",
  "kernelActivityAvailableLanes", "captureKernelActivityButton.addEventListener",
]) if (!client.includes(token)) throw new Error("Observer client missing " + token);
if (client.includes("setInterval(captureKernelActivitySnapshot")) {
  throw new Error("Observer must not repeat aggregate kernel capture automatically");
}
if (snapshot.registry !== "openclaw-kernel-activity-snapshot-v0"
  || snapshot.status !== "complete"
  || snapshot.availableLaneCount !== 3
  || snapshot.boundary?.rawEventsIncluded !== false
  || snapshot.boundary?.persisted !== false
  || snapshot.boundary?.automaticRepeat !== false
  || Object.values(snapshot.lanes ?? {}).some((lane) => lane.eventCount < 1)) {
  throw new Error("Observer snapshot evidence was incomplete: " + JSON.stringify(snapshot));
}
console.log(JSON.stringify({
  observerOpenClawKernelActivitySnapshot: {
    status: "passed",
    panel: "Kernel Activity Snapshot",
    registry: snapshot.registry,
    availableLaneCount: snapshot.availableLaneCount,
    eventCount: snapshot.eventCount,
    explicitTrigger: true,
    automaticRepeat: false,
    rawEventsIncluded: false,
  },
}, null, 2));
EOF

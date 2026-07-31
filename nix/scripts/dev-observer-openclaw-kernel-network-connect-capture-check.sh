#!/usr/bin/env bash
set -euo pipefail

CORE_URL="${OPENCLAW_INSTALLED_CORE_URL:-http://127.0.0.1:4100}"
OBSERVER_URL="${OPENCLAW_INSTALLED_OBSERVER_URL:-http://127.0.0.1:4170}"
SERVICE="openclaw-system-sense.service"

systemctl is-active --quiet openclaw-core.service "$SERVICE" observer-ui.service
curl --silent --fail "$CORE_URL/health" >/dev/null
curl --silent --fail "$OBSERVER_URL/health" >/dev/null

html_file="$(mktemp)"
client_file="$(mktemp)"
capture_file="$(mktemp)"
cleanup() {
  rm -f "$html_file" "$client_file" "$capture_file"
}
trap cleanup EXIT

curl --silent --fail "$OBSERVER_URL/" >"$html_file"
curl --silent --fail "$OBSERVER_URL/client-v5.js" >"$client_file"

(
  for _ in $(seq 1 20); do
    curl --silent --fail "$CORE_URL/health" >/dev/null
    sleep 0.1
  done
) &
generator_pid=$!
curl --silent --fail \
  "$CORE_URL/proxy/system-sense/system/kernel/network-connect-events" \
  >"$capture_file"
wait "$generator_pid"

node - <<'EOF' "$html_file" "$client_file" "$capture_file"
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const client = fs.readFileSync(process.argv[3], "utf8");
const capture = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));

for (const token of [
  "Kernel Network Connect Attempts",
  "kernel-network-connect-events",
  "kernel-network-connect-status",
  "kernel-network-connect-available",
  "kernel-network-connect-event-count",
  "kernel-network-connect-unique-comm-count",
  "kernel-network-connect-unique-family-count",
  "kernel-network-connect-unique-pid-count",
  "kernel-network-connect-unique-uid-count",
  "kernel-network-connect-continuity-status",
  "kernel-network-connect-capture-sequence",
  "kernel-network-connect-activity",
  "kernel-network-connect-new-comm-count",
  "kernel-network-connect-readback-json",
  "kernel-network-connect-json",
]) {
  if (!html.includes(token)) throw new Error("Observer HTML missing " + token);
}
for (const token of [
  "/system/kernel/network-connect-events",
  "refreshKernelNetworkConnectEvents",
  "kernelNetworkConnectStatus",
  "kernelNetworkConnectAvailable",
  "kernelNetworkConnectEventCount",
  "kernelNetworkConnectUniqueCommCount",
  "kernelNetworkConnectUniqueFamilyCount",
  "kernelNetworkConnectUniquePidCount",
  "kernelNetworkConnectUniqueUidCount",
  "kernelNetworkConnectContinuityStatus",
  "kernelNetworkConnectCaptureSequence",
  "kernelNetworkConnectActivity",
  "kernelNetworkConnectNewCommCount",
  "kernelNetworkConnectReadbackJson",
]) {
  if (!client.includes(token)) throw new Error("Observer client missing " + token);
}
if (capture.registry !== "openclaw-kernel-network-connect-v0"
  || capture.status !== "captured"
  || capture.available !== true
  || capture.readback?.registry !== "openclaw-kernel-network-connect-readback-v0"
  || capture.readback?.persisted !== false
  || capture.readback?.destinationCaptured !== false
  || capture.readback?.portCaptured !== false
  || capture.readback?.networkPayloadCaptured !== false
  || capture.source?.familyCaptured !== true
  || !capture.events?.some((event) => event.family > 0)
  || !capture.events?.some((event) => event.comm === "curl")) {
  throw new Error("Observer should expose real bounded network-connect events: " + JSON.stringify(capture));
}
const serialised = html + client + JSON.stringify(capture);
if (serialised.includes("127.0.0.1") || serialised.includes("4100") || serialised.includes("4106")) {
  throw new Error("network destination or port leaked into Observer evidence");
}

console.log(JSON.stringify({
  observerOpenClawKernelNetworkConnectCapture: {
    status: "passed",
    panel: "Kernel Network Connect Attempts",
    registry: capture.registry,
    transport: capture.source.transport,
    tracepoint: capture.source.tracepoint,
    eventCount: capture.eventCount,
    uniqueCommCount: capture.readback.uniqueCommCount,
    uniqueFamilyCount: capture.readback.uniqueFamilyCount,
    continuityStatus: capture.readback.continuity.status,
    destinationCaptured: capture.source.destinationCaptured,
    portCaptured: capture.source.portCaptured,
    networkPayloadCaptured: capture.source.networkPayloadCaptured,
  },
}, null, 2));
EOF

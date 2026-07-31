export const observerClientKernelNetworkRefreshersScript = `async function refreshKernelNetworkConnectEvents() {
  try {
    const data = await fetchJson(observerConfig.systemSenseUrl + "/system/kernel/network-connect-events");
    kernelNetworkConnectStatus.textContent = data.status ?? "unknown";
    kernelNetworkConnectAvailable.textContent = String(Boolean(data.available));
    const readback = data.readback ?? {};
    kernelNetworkConnectEventCount.textContent = String(data.eventCount ?? data.events?.length ?? 0);
    kernelNetworkConnectUniqueCommCount.textContent = String(readback.uniqueCommCount ?? 0);
    kernelNetworkConnectUniqueFamilyCount.textContent = String(readback.uniqueFamilyCount ?? 0);
    kernelNetworkConnectUniquePidCount.textContent = String(readback.uniquePidCount ?? 0);
    kernelNetworkConnectUniqueUidCount.textContent = String(readback.uniqueUidCount ?? 0);
    const continuity = readback.continuity ?? {};
    kernelNetworkConnectContinuityStatus.textContent = continuity.status ?? "unknown";
    kernelNetworkConnectCaptureSequence.textContent = String(continuity.captureSequence ?? "none");
    kernelNetworkConnectActivity.textContent = continuity.currentActivity ?? "unknown";
    kernelNetworkConnectNewCommCount.textContent = String(continuity.newCommCount ?? 0);
    kernelNetworkConnectReadbackJson.textContent = JSON.stringify(readback, null, 2);
    kernelNetworkConnectJson.textContent = JSON.stringify(data, null, 2);
  } catch {
    kernelNetworkConnectStatus.textContent = "offline";
    kernelNetworkConnectAvailable.textContent = "false";
    kernelNetworkConnectEventCount.textContent = "0";
    kernelNetworkConnectUniqueCommCount.textContent = "0";
    kernelNetworkConnectUniqueFamilyCount.textContent = "0";
    kernelNetworkConnectUniquePidCount.textContent = "0";
    kernelNetworkConnectUniqueUidCount.textContent = "0";
    kernelNetworkConnectContinuityStatus.textContent = "offline";
    kernelNetworkConnectCaptureSequence.textContent = "none";
    kernelNetworkConnectActivity.textContent = "unknown";
    kernelNetworkConnectNewCommCount.textContent = "0";
    kernelNetworkConnectReadbackJson.textContent = "Unable to read kernel network-connect summary.";
    kernelNetworkConnectJson.textContent = "Unable to read kernel network-connect events.";
  }
}
`;

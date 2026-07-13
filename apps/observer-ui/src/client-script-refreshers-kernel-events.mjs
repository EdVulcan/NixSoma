export const observerClientKernelEventRefreshersScript = `async function refreshKernelProcessExecEvents() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/kernel/process-exec-events\`);
    kernelProcessExecStatus.textContent = data.status ?? "unknown";
    kernelProcessExecAvailable.textContent = String(Boolean(data.available));
    const readback = data.readback ?? {};
    kernelProcessExecEventCount.textContent = String(data.eventCount ?? data.events?.length ?? 0);
    kernelProcessExecUniqueCommCount.textContent = String(readback.uniqueCommCount ?? 0);
    kernelProcessExecUniquePidCount.textContent = String(readback.uniquePidCount ?? 0);
    kernelProcessExecUniqueUidCount.textContent = String(readback.uniqueUidCount ?? 0);
    kernelProcessExecReadbackJson.textContent = JSON.stringify(readback, null, 2);
    kernelProcessExecJson.textContent = JSON.stringify(data, null, 2);
  } catch {
    kernelProcessExecStatus.textContent = "offline";
    kernelProcessExecAvailable.textContent = "false";
    kernelProcessExecEventCount.textContent = "0";
    kernelProcessExecUniqueCommCount.textContent = "0";
    kernelProcessExecUniquePidCount.textContent = "0";
    kernelProcessExecUniqueUidCount.textContent = "0";
    kernelProcessExecReadbackJson.textContent = "Unable to read kernel process-exec summary.";
    kernelProcessExecJson.textContent = "Unable to read kernel process-exec events.";
  }
}
`;

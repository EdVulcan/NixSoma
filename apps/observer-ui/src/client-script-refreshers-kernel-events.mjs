export const observerClientKernelEventRefreshersScript = `async function refreshKernelProcessExecEvents() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/kernel/process-exec-events\`);
    kernelProcessExecStatus.textContent = data.status ?? "unknown";
    kernelProcessExecAvailable.textContent = String(Boolean(data.available));
    kernelProcessExecEventCount.textContent = String(data.eventCount ?? data.events?.length ?? 0);
    kernelProcessExecJson.textContent = JSON.stringify(data, null, 2);
  } catch {
    kernelProcessExecStatus.textContent = "offline";
    kernelProcessExecAvailable.textContent = "false";
    kernelProcessExecEventCount.textContent = "0";
    kernelProcessExecJson.textContent = "Unable to read kernel process-exec events.";
  }
}
`;

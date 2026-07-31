export const observerClientRuntimeKernelActivityScript = `async function captureKernelActivitySnapshot() {
  captureKernelActivityButton.disabled = true;
  kernelActivityStatus.textContent = "capturing";
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/kernel/activity-snapshot\`);
    const lanes = data.lanes ?? {};
    kernelActivityStatus.textContent = data.status ?? "unknown";
    kernelActivityAvailableLanes.textContent = \`\${data.availableLaneCount ?? 0}/\${data.laneCount ?? 3}\`;
    kernelActivityEventCount.textContent = String(data.eventCount ?? 0);
    kernelActivityProcessCount.textContent = String(lanes.processExec?.eventCount ?? 0);
    kernelActivityNetworkCount.textContent = String(lanes.networkConnect?.eventCount ?? 0);
    kernelActivityFileCount.textContent = String(lanes.fileOpen?.eventCount ?? 0);
    kernelActivityJson.textContent = JSON.stringify(data, null, 2);
    setControlMessage(\`Kernel activity snapshot \${data.status ?? "unknown"}: \${data.availableLaneCount ?? 0}/3 lanes available.\`);
  } catch (error) {
    kernelActivityStatus.textContent = "offline";
    kernelActivityAvailableLanes.textContent = "0/3";
    kernelActivityEventCount.textContent = "0";
    kernelActivityProcessCount.textContent = "0";
    kernelActivityNetworkCount.textContent = "0";
    kernelActivityFileCount.textContent = "0";
    kernelActivityJson.textContent = "Unable to capture the bounded kernel activity snapshot.";
    throw error;
  } finally {
    captureKernelActivityButton.disabled = false;
  }
}

captureKernelActivityButton.addEventListener("click", () => {
  captureKernelActivitySnapshot().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});
`;

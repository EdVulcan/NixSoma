export const observerClientRuntimeKernelProcessLifecycleScript = `async function captureKernelProcessLifecycleSnapshot() {
  captureKernelProcessLifecycleButton.disabled = true;
  kernelProcessLifecycleStatus.textContent = "capturing";
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/kernel/process-lifecycle-snapshot\`);
    const lanes = data.lanes ?? {};
    kernelProcessLifecycleStatus.textContent = data.status ?? "unknown";
    kernelProcessLifecycleAvailableLanes.textContent = \`\${data.availableLaneCount ?? 0}/\${data.laneCount ?? 2}\`;
    kernelProcessLifecycleStartCount.textContent = String(lanes.processExec?.eventCount ?? 0);
    kernelProcessLifecycleExitCount.textContent = String(lanes.processExit?.eventCount ?? 0);
    kernelProcessLifecycleEventCount.textContent = String(data.eventCount ?? 0);
    kernelProcessLifecycleJson.textContent = JSON.stringify(data, null, 2);
    setControlMessage(\`Process lifecycle snapshot \${data.status ?? "unknown"}: \${data.availableLaneCount ?? 0}/2 lanes available.\`);
  } catch (error) {
    kernelProcessLifecycleStatus.textContent = "offline";
    kernelProcessLifecycleAvailableLanes.textContent = "0/2";
    kernelProcessLifecycleStartCount.textContent = "0";
    kernelProcessLifecycleExitCount.textContent = "0";
    kernelProcessLifecycleEventCount.textContent = "0";
    kernelProcessLifecycleJson.textContent = "Unable to capture the bounded process lifecycle snapshot.";
    throw error;
  } finally {
    captureKernelProcessLifecycleButton.disabled = false;
  }
}

captureKernelProcessLifecycleButton.addEventListener("click", () => {
  captureKernelProcessLifecycleSnapshot().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});
`;

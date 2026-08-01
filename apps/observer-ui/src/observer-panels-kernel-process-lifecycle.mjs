export function observerKernelProcessLifecyclePanel() {
  return `        <section class="panel" id="kernel-process-lifecycle-snapshot">
          <h2>Process Lifecycle Snapshot</h2>
          <div class="metric"><span>Status</span><span id="kernel-process-lifecycle-status">not_captured</span></div>
          <div class="metric"><span>Available lanes</span><span id="kernel-process-lifecycle-available-lanes">0/2</span></div>
          <div class="metric"><span>Starts observed</span><span id="kernel-process-lifecycle-start-count">0</span></div>
          <div class="metric"><span>Exits observed</span><span id="kernel-process-lifecycle-exit-count">0</span></div>
          <div class="metric"><span>Total churn</span><span id="kernel-process-lifecycle-event-count">0</span></div>
          <div class="actions tight">
            <button id="capture-kernel-process-lifecycle-button" class="secondary" type="button">Capture Lifecycle</button>
          </div>
          <pre id="kernel-process-lifecycle-json">No explicit process lifecycle snapshot captured.</pre>
        </section>
`;
}

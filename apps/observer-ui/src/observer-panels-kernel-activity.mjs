export function observerKernelActivityPanel() {
  return `        <section class="panel" id="kernel-activity-snapshot">
          <h2>Kernel Activity Snapshot</h2>
          <div class="metric"><span>Status</span><span id="kernel-activity-status">not_captured</span></div>
          <div class="metric"><span>Available lanes</span><span id="kernel-activity-available-lanes">0/3</span></div>
          <div class="metric"><span>Events observed</span><span id="kernel-activity-event-count">0</span></div>
          <div class="metric"><span>Process exec</span><span id="kernel-activity-process-count">0</span></div>
          <div class="metric"><span>Network connect</span><span id="kernel-activity-network-count">0</span></div>
          <div class="metric"><span>File open</span><span id="kernel-activity-file-count">0</span></div>
          <div class="actions tight">
            <button id="capture-kernel-activity-button" class="secondary" type="button">Capture Snapshot</button>
          </div>
          <pre id="kernel-activity-json">No explicit kernel activity snapshot captured.</pre>
        </section>
`;
}

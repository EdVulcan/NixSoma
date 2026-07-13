export function observerKernelEventPanels() {
  return `        <section class="panel" id="kernel-process-exec-events">
          <h2>Kernel Process Events</h2>
          <div class="metric"><span>Status</span><span id="kernel-process-exec-status">disabled</span></div>
          <div class="metric"><span>Available</span><span id="kernel-process-exec-available">false</span></div>
          <div class="metric"><span>Events</span><span id="kernel-process-exec-event-count">0</span></div>
          <pre id="kernel-process-exec-json">Loading read-only kernel process-exec events...</pre>
        </section>
`;
}

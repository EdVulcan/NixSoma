export function observerKernelEventPanels() {
  return `        <section class="panel" id="kernel-process-exec-events">
          <h2>Kernel Process Events</h2>
          <div class="metric"><span>Status</span><span id="kernel-process-exec-status">disabled</span></div>
          <div class="metric"><span>Available</span><span id="kernel-process-exec-available">false</span></div>
          <div class="metric"><span>Events</span><span id="kernel-process-exec-event-count">0</span></div>
          <div class="metric"><span>Unique comm</span><span id="kernel-process-exec-unique-comm-count">0</span></div>
          <div class="metric"><span>Unique PID</span><span id="kernel-process-exec-unique-pid-count">0</span></div>
          <div class="metric"><span>Unique UID</span><span id="kernel-process-exec-unique-uid-count">0</span></div>
          <div class="metric"><span>Executable identities</span><span id="kernel-process-exec-executable-identity-count">0</span></div>
          <div class="metric"><span>Continuity</span><span id="kernel-process-exec-continuity-status">not_available</span></div>
          <div class="metric"><span>Capture sequence</span><span id="kernel-process-exec-capture-sequence">none</span></div>
          <div class="metric"><span>Activity</span><span id="kernel-process-exec-activity">unknown</span></div>
          <div class="metric"><span>New comm</span><span id="kernel-process-exec-new-comm-count">0</span></div>
          <pre id="kernel-process-exec-readback-json">Loading bounded process-exec summary...</pre>
          <pre id="kernel-process-exec-json">Loading read-only kernel process-exec events...</pre>
        </section>
`;
}

export function observerKernelFilePanels() {
  return `        <section class="panel" id="kernel-file-open-events">
          <h2>Kernel File Open Attempts</h2>
          <div class="metric"><span>Status</span><span id="kernel-file-open-status">disabled</span></div>
          <div class="metric"><span>Available</span><span id="kernel-file-open-available">false</span></div>
          <div class="metric"><span>Events</span><span id="kernel-file-open-event-count">0</span></div>
          <div class="metric"><span>Unique comm</span><span id="kernel-file-open-unique-comm-count">0</span></div>
          <div class="metric"><span>Unique flags</span><span id="kernel-file-open-unique-flag-count">0</span></div>
          <div class="metric"><span>Unique PID</span><span id="kernel-file-open-unique-pid-count">0</span></div>
          <div class="metric"><span>Unique UID</span><span id="kernel-file-open-unique-uid-count">0</span></div>
          <div class="metric"><span>Continuity</span><span id="kernel-file-open-continuity-status">not_available</span></div>
          <div class="metric"><span>Capture sequence</span><span id="kernel-file-open-capture-sequence">none</span></div>
          <div class="metric"><span>Activity</span><span id="kernel-file-open-activity">unknown</span></div>
          <div class="metric"><span>New comm</span><span id="kernel-file-open-new-comm-count">0</span></div>
          <pre id="kernel-file-open-readback-json">Loading bounded file-open summary...</pre>
          <pre id="kernel-file-open-json">Loading read-only kernel file-open events...</pre>
        </section>
`;
}

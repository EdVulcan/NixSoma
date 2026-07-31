export function observerKernelNetworkPanels() {
  return `        <section class="panel" id="kernel-network-connect-events">
          <h2>Kernel Network Connect Attempts</h2>
          <div class="metric"><span>Status</span><span id="kernel-network-connect-status">disabled</span></div>
          <div class="metric"><span>Available</span><span id="kernel-network-connect-available">false</span></div>
          <div class="metric"><span>Events</span><span id="kernel-network-connect-event-count">0</span></div>
          <div class="metric"><span>Unique comm</span><span id="kernel-network-connect-unique-comm-count">0</span></div>
          <div class="metric"><span>Unique family</span><span id="kernel-network-connect-unique-family-count">0</span></div>
          <div class="metric"><span>Unique PID</span><span id="kernel-network-connect-unique-pid-count">0</span></div>
          <div class="metric"><span>Unique UID</span><span id="kernel-network-connect-unique-uid-count">0</span></div>
          <div class="metric"><span>Continuity</span><span id="kernel-network-connect-continuity-status">not_available</span></div>
          <div class="metric"><span>Capture sequence</span><span id="kernel-network-connect-capture-sequence">none</span></div>
          <div class="metric"><span>Activity</span><span id="kernel-network-connect-activity">unknown</span></div>
          <div class="metric"><span>New comm</span><span id="kernel-network-connect-new-comm-count">0</span></div>
          <pre id="kernel-network-connect-readback-json">Loading bounded network-connect summary...</pre>
          <pre id="kernel-network-connect-json">Loading read-only kernel network-connect events...</pre>
        </section>
`;
}

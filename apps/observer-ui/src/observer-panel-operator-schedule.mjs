export function observerOperatorSchedulePanel() {
  return `        <section class="panel">
          <h2>Scheduled Operator Run</h2>
          <div class="field">
            <label for="operator-schedule-delay-input">Delay (minutes)</label>
            <input id="operator-schedule-delay-input" type="number" min="0" max="1440" step="1" value="0" />
          </div>
          <div class="actions tight">
            <button id="operator-schedule-arm-button">Schedule Queue</button>
            <button id="operator-schedule-rearm-button" class="secondary" disabled>Re-arm Paused Schedule</button>
            <button id="operator-schedule-cancel-button" class="secondary" disabled>Cancel Scheduled Run</button>
            <button id="operator-schedule-refresh-button" class="secondary">Refresh Schedule</button>
          </div>
          <div class="metric"><span>Timer</span><span id="operator-schedule-enabled">unknown</span></div>
          <div class="metric"><span>Timer State</span><span id="operator-schedule-timer">inactive</span></div>
          <div class="metric"><span>Status</span><span id="operator-schedule-status">none</span></div>
          <div class="metric"><span>Schedule</span><span id="operator-schedule-id">none</span></div>
          <div class="metric"><span>Due</span><span id="operator-schedule-due">none</span></div>
          <div class="metric"><span>Steps</span><span id="operator-schedule-steps">0</span></div>
          <pre id="operator-schedule-json">No scheduled operator run.</pre>
        </section>
`;
}

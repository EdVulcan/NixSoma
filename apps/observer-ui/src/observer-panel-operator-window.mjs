export function observerOperatorWindowPanel() {
  return `        <section class="panel">
          <h2>Windowed Operator Lease</h2>
          <div class="field">
            <label for="operator-window-count-input">Windows</label>
            <input id="operator-window-count-input" type="number" min="1" max="8" step="1" value="2" />
          </div>
          <div class="field">
            <label for="operator-window-steps-input">Steps per Window</label>
            <input id="operator-window-steps-input" type="number" min="1" max="20" step="1" value="1" />
          </div>
          <div class="field">
            <label for="operator-window-interval-input">Interval (seconds)</label>
            <input id="operator-window-interval-input" type="number" min="0" max="86400" step="1" value="0" />
          </div>
          <div class="field">
            <label for="operator-window-deadline-input">Deadline (minutes)</label>
            <input id="operator-window-deadline-input" type="number" min="1" max="1440" step="1" value="5" />
          </div>
          <div class="actions tight">
            <button id="operator-window-arm-button">Arm Window Lease</button>
            <button id="operator-window-rearm-button" class="secondary" disabled>Re-arm Paused Lease</button>
            <button id="operator-window-cancel-button" class="secondary" disabled>Cancel Window Lease</button>
            <button id="operator-window-refresh-button" class="secondary">Refresh Lease</button>
          </div>
          <div class="metric"><span>Timer</span><span id="operator-window-enabled">unknown</span></div>
          <div class="metric"><span>Timer State</span><span id="operator-window-timer">inactive</span></div>
          <div class="metric"><span>Status</span><span id="operator-window-status">none</span></div>
          <div class="metric"><span>Lease</span><span id="operator-window-id">none</span></div>
          <div class="metric"><span>Windows</span><span id="operator-window-progress">0 / 0</span></div>
          <div class="metric"><span>Next Window</span><span id="operator-window-next">none</span></div>
          <div class="metric"><span>Deadline</span><span id="operator-window-deadline">none</span></div>
          <pre id="operator-window-json">No window lease.</pre>
        </section>
`;
}

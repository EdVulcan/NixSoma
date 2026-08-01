export function observerOperatorMissionPanel() {
  return `        <section class="panel">
          <h2>Renewable Operator Mission</h2>
          <div class="field">
            <label for="operator-mission-epoch-input">Epochs / Renewal</label>
            <input id="operator-mission-epoch-input" type="number" min="1" max="32" step="1" value="8" />
          </div>
          <div class="field">
            <label for="operator-mission-steps-input">Steps per Epoch</label>
            <input id="operator-mission-steps-input" type="number" min="1" max="20" step="1" value="3" />
          </div>
          <div class="field">
            <label for="operator-mission-interval-input">Epoch Interval (seconds)</label>
            <input id="operator-mission-interval-input" type="number" min="0" max="86400" step="1" value="300" />
          </div>
          <div class="field">
            <label for="operator-mission-authority-input">Authority / Extension (hours)</label>
            <input id="operator-mission-authority-input" type="number" min="1" max="168" step="1" value="24" />
          </div>
          <div class="field">
            <label for="operator-mission-circuit-input">No-progress Circuit</label>
            <input id="operator-mission-circuit-input" type="number" min="1" max="5" step="1" value="2" />
          </div>
          <div class="actions tight">
            <button id="operator-mission-arm-button">Arm Mission</button>
            <button id="operator-mission-renew-button" class="secondary" disabled>Renew Authority</button>
            <button id="operator-mission-pause-button" class="secondary" disabled>Pause Mission</button>
            <button id="operator-mission-rearm-button" class="secondary" disabled>Resume Mission</button>
            <button id="operator-mission-cancel-button" class="secondary" disabled>Cancel Mission</button>
            <button id="operator-mission-refresh-button" class="secondary">Refresh Mission</button>
          </div>
          <progress id="operator-mission-progress-bar" class="mission-progress" max="100" value="0"></progress>
          <div class="metric"><span>Supervisor</span><span id="operator-mission-enabled">unknown</span></div>
          <div class="metric"><span>Timer</span><span id="operator-mission-timer">inactive</span></div>
          <div class="metric"><span>Status</span><span id="operator-mission-status">none</span></div>
          <div class="metric"><span>Mission</span><span id="operator-mission-id">none</span></div>
          <div class="metric"><span>Epoch Progress</span><span id="operator-mission-progress">0 / 0 (0%)</span></div>
          <div class="metric"><span>Completed</span><span id="operator-mission-completed">0</span></div>
          <div class="metric"><span>Checkpoint</span><span id="operator-mission-checkpoint">none</span></div>
          <div class="metric"><span>Next Epoch</span><span id="operator-mission-next">none</span></div>
          <div class="metric"><span>Authority Ends</span><span id="operator-mission-deadline">none</span></div>
          <div class="metric"><span>Circuit</span><span id="operator-mission-circuit">0 / 0</span></div>
          <div class="metric"><span>Renewals</span><span id="operator-mission-renewals">0</span></div>
          <div class="metric"><span>Stop Reason</span><span id="operator-mission-stop-reason">none</span></div>
          <pre id="operator-mission-json">No renewable mission.</pre>
        </section>
`;
}

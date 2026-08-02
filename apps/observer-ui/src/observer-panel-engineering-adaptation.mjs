export function observerEngineeringAdaptationPanel() {
  return `        <section class="panel">
          <h2>Experience Adaptation</h2>
          <div class="metric"><span>Status</span><span id="engineering-adaptation-status">idle</span></div>
          <div class="metric"><span>Assignments</span><span id="engineering-adaptation-assignments">0 / 0</span></div>
          <div class="metric"><span>Candidate</span><span id="engineering-adaptation-candidate">none</span></div>
          <div class="metric"><span>Active Profile</span><span id="engineering-adaptation-profile">baseline</span></div>
          <div class="control-stack">
            <div class="field">
              <label for="engineering-adaptation-task-type-input">Task type</label>
              <input id="engineering-adaptation-task-type-input" type="text" value="browser_task" maxlength="80" spellcheck="false" />
            </div>
            <div class="field">
              <label for="engineering-adaptation-trial-limit-input">Trial assignments</label>
              <input id="engineering-adaptation-trial-limit-input" type="number" value="8" min="8" max="32" step="2" />
            </div>
            <div class="field">
              <label for="engineering-adaptation-duration-input">Duration (minutes)</label>
              <input id="engineering-adaptation-duration-input" type="number" value="1440" min="5" max="43200" step="5" />
            </div>
          </div>
          <div class="actions tight">
            <button id="engineering-adaptation-refresh-button" class="secondary" type="button">Refresh</button>
            <button id="engineering-adaptation-arm-button" class="secondary" type="button">Arm Comparison</button>
            <button id="engineering-adaptation-rearm-button" class="secondary" type="button" disabled>Re-arm</button>
            <button id="engineering-adaptation-cancel-button" class="secondary" type="button" disabled>Cancel</button>
            <button id="engineering-adaptation-activate-button" class="secondary" type="button" disabled>Activate Candidate</button>
            <button id="engineering-adaptation-revoke-button" class="secondary" type="button" disabled>Revoke Profile</button>
          </div>
          <pre id="engineering-adaptation-json">No controlled comparison read yet.</pre>
        </section>
`;
}

export function observerOperatorMissionWorklistPanel() {
  return `        <section class="panel">
          <h2>Reviewed Mission Worklist</h2>
          <div class="actions tight">
            <button id="operator-mission-worklist-add-button" class="secondary" type="button">Add Current Goal + URL</button>
            <button id="operator-mission-worklist-clear-button" class="secondary" type="button" disabled>Clear Draft</button>
            <button id="operator-mission-worklist-bind-button" type="button" disabled>Bind Reviewed Worklist</button>
          </div>
          <label for="operator-mission-worklist-workflow">Workflow recipe</label>
          <select id="operator-mission-worklist-workflow">
            <option value="bounded_run">bounded_run</option>
          </select>
          <ol id="operator-mission-worklist-draft" class="mission-worklist-draft"></ol>
          <progress id="operator-mission-worklist-progress-bar" class="mission-progress" max="100" value="0"></progress>
          <div class="metric"><span>Status</span><span id="operator-mission-worklist-status">none</span></div>
          <div class="metric"><span>Worklist</span><span id="operator-mission-worklist-id">none</span></div>
          <div class="metric"><span>Mission</span><span id="operator-mission-worklist-mission">none</span></div>
          <div class="metric"><span>Items</span><span id="operator-mission-worklist-items">0</span></div>
          <div class="metric"><span>Issued</span><span id="operator-mission-worklist-issued">0</span></div>
          <div class="metric"><span>Completed</span><span id="operator-mission-worklist-completed">0</span></div>
          <div class="metric"><span>Current Task</span><span id="operator-mission-worklist-current-task">none</span></div>
          <div class="metric"><span>Current Workflow</span><span id="operator-mission-worklist-current-workflow">none</span></div>
          <div class="metric"><span>Next Item</span><span id="operator-mission-worklist-next">none</span></div>
          <div class="metric"><span>Stop Reason</span><span id="operator-mission-worklist-stop-reason">none</span></div>
          <pre id="operator-mission-worklist-json">No reviewed mission worklist.</pre>
        </section>
`;
}

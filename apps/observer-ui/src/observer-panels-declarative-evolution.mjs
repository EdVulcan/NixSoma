export function observerDeclarativeEvolutionPanels() {
  return `        <section class="panel">
          <h2>Declarative Evolution Activation</h2>
          <div class="field">
            <label for="declarative-evolution-source-task-id">Completed Staging Task ID</label>
            <input id="declarative-evolution-source-task-id" type="text" value="" spellcheck="false" />
          </div>
          <div class="field">
            <label for="declarative-evolution-decision">Decision</label>
            <select id="declarative-evolution-decision">
              <option value="approve_activation_review">Approve future activation review</option>
              <option value="reject_activation">Reject activation review</option>
            </select>
          </div>
          <div class="metric"><span>Registry</span><span id="declarative-evolution-activation-registry">unknown</span></div>
          <div class="metric"><span>Health Gate</span><span id="declarative-evolution-health-gate-status">unknown</span></div>
          <div class="metric"><span>Host Health</span><span id="declarative-evolution-host-health-status">unknown</span></div>
          <div class="metric"><span>Activation Ready</span><span id="declarative-evolution-activation-ready">false</span></div>
          <div class="metric"><span>Decision Task</span><span id="declarative-evolution-activation-task-id">none</span></div>
          <div class="metric"><span>Approval</span><span id="declarative-evolution-activation-approval-id">none</span></div>
          <div class="actions tight">
            <button id="declarative-evolution-refresh-button" class="secondary" type="button">Refresh Health Boundary</button>
            <button id="declarative-evolution-decision-button" type="button">Queue Decision</button>
          </div>
          <pre id="declarative-evolution-review-json">No activation decision review selected.</pre>
          <pre id="declarative-evolution-decision-json">No activation decision task created.</pre>
        </section>
`;
}

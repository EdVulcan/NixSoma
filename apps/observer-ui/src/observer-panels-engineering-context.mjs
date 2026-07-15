export function observerEngineeringContextPanels() {
  return `        <section class="panel">
          <h2>Engineering Context Packet</h2>
          <div class="metric"><span>Registry</span><span id="engineering-context-packet-registry">openclaw-native-engineering-context-packet-v0</span></div>
          <div class="metric"><span>Records</span><span id="engineering-context-packet-records">0</span></div>
          <div class="metric"><span>Messages</span><span id="engineering-context-packet-messages">0</span></div>
          <div class="metric"><span>Redactions</span><span id="engineering-context-packet-redactions">0</span></div>
          <div class="metric"><span>Source Task</span><span id="engineering-context-packet-source-task">none</span></div>
          <div class="metric"><span>Provider</span><span id="engineering-context-packet-provider">blocked</span></div>
          <div class="metric"><span>Audit</span><span id="engineering-context-packet-audit">not built</span></div>
          <div class="metric"><span>Work View</span><span id="engineering-context-packet-work-view">none</span></div>
          <div class="metric"><span>Binding</span><span id="engineering-context-packet-binding">none</span></div>
          <div class="metric"><span>Authority</span><span id="engineering-context-packet-authority">inactive</span></div>
          <div class="metric"><span>Capture</span><span id="engineering-context-packet-capture">none</span></div>
          <div class="metric"><span>Targets</span><span id="engineering-context-packet-targets">none</span></div>
          <div class="metric"><span>Plan/Todo</span><span id="engineering-context-packet-plan-todo">none</span></div>
          <div class="metric"><span>Recovery</span><span id="engineering-context-packet-recovery">none</span></div>
          <div class="control-stack">
            <div class="field">
              <label for="engineering-context-packet-source-task-id-input">Context Source Task ID</label>
              <input id="engineering-context-packet-source-task-id-input" type="text" value="" spellcheck="false" placeholder="Optional existing task for read-only evidence" />
            </div>
            <div class="field">
              <label for="engineering-provider-handoff-prompt-input">DeepSeek Handoff Request</label>
              <textarea id="engineering-provider-handoff-prompt-input" rows="3" maxlength="8000" placeholder="Bounded request for the next approved provider review"></textarea>
            </div>
          </div>
          <div class="actions tight">
            <button id="engineering-context-packet-build-button" class="secondary" type="button">Build Context Packet</button>
            <button id="engineering-context-packet-use-task-detail-button" class="secondary" type="button">Use Task Detail ID</button>
            <button id="engineering-context-packet-bind-work-view-button" class="secondary" type="button">Bind Task to Work View</button>
            <button id="engineering-context-packet-recovery-button" class="secondary" type="button" hidden>Prepare Trusted Work View</button>
            <button id="engineering-provider-handoff-create-button" class="secondary" type="button">Create Pending DeepSeek Handoff</button>
          </div>
          <div class="metric"><span>Provider Handoff</span><span id="engineering-provider-handoff-status">not created</span></div>
          <div class="metric"><span>Handoff Task</span><span id="engineering-provider-handoff-task">none</span></div>
          <div class="metric"><span>Handoff Approval</span><span id="engineering-provider-handoff-approval">none</span></div>
          <pre id="engineering-provider-handoff-json">No provider handoff task created yet.</pre>
          <pre id="engineering-context-packet-json">No local engineering context packet built yet.</pre>
        </section>
`;
}

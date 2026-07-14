export function observerEngineeringContextPanels() {
  return `        <section class="panel">
          <h2>Engineering Context Packet</h2>
          <div class="metric"><span>Registry</span><span id="engineering-context-packet-registry">openclaw-native-engineering-context-packet-v0</span></div>
          <div class="metric"><span>Records</span><span id="engineering-context-packet-records">0</span></div>
          <div class="metric"><span>Messages</span><span id="engineering-context-packet-messages">0</span></div>
          <div class="metric"><span>Redactions</span><span id="engineering-context-packet-redactions">0</span></div>
          <div class="metric"><span>Provider</span><span id="engineering-context-packet-provider">blocked</span></div>
          <div class="metric"><span>Audit</span><span id="engineering-context-packet-audit">not built</span></div>
          <div class="metric"><span>Work View</span><span id="engineering-context-packet-work-view">none</span></div>
          <div class="metric"><span>Binding</span><span id="engineering-context-packet-binding">none</span></div>
          <div class="metric"><span>Authority</span><span id="engineering-context-packet-authority">inactive</span></div>
          <div class="actions tight">
            <button id="engineering-context-packet-build-button" class="secondary" type="button">Build Context Packet</button>
          </div>
          <pre id="engineering-context-packet-json">No local engineering context packet built yet.</pre>
        </section>
`;
}

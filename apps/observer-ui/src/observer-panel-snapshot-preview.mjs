export function observerSnapshotPreviewPanel() {
  return `        <section class="panel">
          <h2>Snapshot Preview</h2>
          <div class="preview-tabs" role="tablist" aria-label="Snapshot source">
            <button id="browser-page-preview-tab" class="preview-tab" type="button" role="tab" aria-selected="true" aria-controls="browser-page-preview">Browser Page</button>
            <button id="ai-workspace-preview-tab" class="preview-tab" type="button" role="tab" aria-selected="false" aria-controls="ai-workspace-preview">AI Workspace</button>
          </div>
          <div id="browser-page-preview" class="preview-pane" role="tabpanel" aria-labelledby="browser-page-preview-tab">
            <div class="metric"><span>Visual Frame</span><span id="screen-visual-frame-status">unavailable</span></div>
            <img id="screen-visual-frame" class="work-view-frame" alt="AI-owned browser work view" hidden />
            <div class="field">
              <label for="screen-semantic-target-select">Semantic Target</label>
              <select id="screen-semantic-target-select" disabled>
                <option value="">Refresh screen to select</option>
              </select>
            </div>
            <div class="actions tight">
              <button id="create-semantic-click-task-button" class="secondary" type="button" disabled>Create Reviewed Semantic Click Task</button>
            </div>
            <pre id="screen-semantic-target-task-json">No reviewed semantic click task created.</pre>
            <pre id="screen-semantic-targets">No semantic targets available.</pre>
            <pre id="screen-snapshot">No screen preview yet.</pre>
          </div>
          <div id="ai-workspace-preview" class="preview-pane" role="tabpanel" aria-labelledby="ai-workspace-preview-tab" hidden>
            <div class="metric"><span>Native Frame</span><span id="ai-workspace-projection-status">not selected</span></div>
            <img id="ai-workspace-projection-frame" class="work-view-frame" alt="NixSoma AI-owned compositor output" hidden />
          </div>
        </section>
`;
}

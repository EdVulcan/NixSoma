export function observerAiWorkViewPanel() {
  return `        <section class="panel">
          <h2>AI Work View</h2>
          <div class="metric"><span>Status</span><span id="work-view-status">idle</span></div>
          <div class="metric"><span>Visibility</span><span id="work-view-visibility">hidden</span></div>
          <div class="metric"><span>Mode</span><span id="work-view-mode">background</span></div>
          <div class="metric"><span>Helper</span><span id="work-view-helper">idle</span></div>
          <div class="metric"><span>Capture</span><span id="work-view-capture">browser-runtime</span></div>
          <div class="metric"><span>Session Identity</span><span id="work-view-session-identity">pending</span></div>
          <div class="metric"><span>Workbench</span><span id="ai-workbench-status">disabled</span></div>
          <div class="metric"><span>Workbench Surface</span><span id="ai-workbench-surface">none</span></div>
          <div class="metric"><span>AI Surfaces</span><span id="ai-surface-count">0</span></div>
          <label for="ai-surface-select">Surface</label>
          <select id="ai-surface-select" disabled></select>
          <div class="actions">
            <button id="start-ai-workbench-button" type="button">Start Workbench</button>
            <button id="stop-ai-workbench-button" class="secondary" type="button">Stop Workbench</button>
            <button id="activate-ai-surface-button" class="secondary" type="button" disabled>Activate Surface</button>
            <button id="scroll-ai-surface-up-button" class="secondary" type="button" disabled title="Scroll active AI surface up" aria-label="Scroll active AI surface up">&#8593;</button>
            <button id="scroll-ai-surface-down-button" class="secondary" type="button" disabled title="Scroll active AI surface down" aria-label="Scroll active AI surface down">&#8595;</button>
            <button id="run-ai-workspace-single-step-button" type="button" disabled>AI Step</button>
          </div>
          <pre id="work-view-json">Loading work view state...</pre>
        </section>
`;
}

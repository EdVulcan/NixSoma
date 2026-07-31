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
          <div class="metric"><span>Local OCR</span><span id="ai-workspace-local-ocr-status">not observed</span></div>
          <div class="metric"><span>OCR Assessment</span><span id="ai-workspace-ocr-assessment-status">not assessed</span></div>
          <div class="metric"><span>OCR Click</span><span id="ai-workspace-ocr-click-status">not run</span></div>
          <div class="metric"><span>OCR Type</span><span id="ai-workspace-ocr-type-status">not run</span></div>
          <div class="metric"><span>OCR Focus + Type</span><span id="ai-workspace-ocr-focus-type-status">not run</span></div>
          <div class="metric"><span>Assessment</span><span id="ai-workspace-assessment-status">not assessed</span></div>
          <div class="metric"><span>Cycle</span><span id="ai-workspace-reviewed-cycle-status">not run</span></div>
          <div class="metric"><span>Semantic Submit</span><span id="ai-workspace-semantic-submit-status">type receipt required</span></div>
          <label for="ai-surface-select">Surface</label>
          <select id="ai-surface-select" disabled></select>
          <div class="actions">
            <button id="start-ai-workbench-button" type="button">Start Workbench</button>
            <button id="stop-ai-workbench-button" class="secondary" type="button">Stop Workbench</button>
            <button id="activate-ai-surface-button" class="secondary" type="button" disabled>Activate Surface</button>
            <button id="scroll-ai-surface-up-button" class="secondary" type="button" disabled title="Scroll active AI surface up" aria-label="Scroll active AI surface up">&#8593;</button>
            <button id="scroll-ai-surface-down-button" class="secondary" type="button" disabled title="Scroll active AI surface down" aria-label="Scroll active AI surface down">&#8595;</button>
            <button id="run-ai-workspace-local-ocr-button" class="secondary" type="button" disabled>OCR</button>
            <button id="ocr-assess-ai-workspace-button" class="secondary" type="button" disabled>OCR Assess</button>
            <button id="ocr-click-ai-workspace-button" class="secondary" type="button" disabled>OCR Click</button>
            <button id="ocr-type-ai-workspace-button" class="secondary" type="button" disabled>OCR Type</button>
            <button id="ocr-focus-type-ai-workspace-button" class="secondary" type="button" disabled>OCR Focus + Type</button>
            <button id="run-ai-workspace-single-step-button" type="button" disabled>AI Step</button>
            <button id="run-ai-workspace-semantic-submit-button" type="button" disabled>Submit</button>
            <button id="run-ai-workspace-bounded-run-button" type="button" disabled>AI Run</button>
            <button id="run-ai-workspace-reviewed-cycle-button" type="button" disabled>Run + Assess</button>
            <button id="assess-ai-workspace-button" class="secondary" type="button" disabled>Assess</button>
            <button id="accept-ai-workspace-assessment-button" type="button" disabled>Accept</button>
          </div>
          <pre id="ai-workspace-local-ocr-output">not observed</pre>
          <pre id="work-view-json">Loading work view state...</pre>
        </section>
`;
}

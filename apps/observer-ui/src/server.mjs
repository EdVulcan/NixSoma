import http from "node:http";

const host = process.env.OBSERVER_UI_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.OBSERVER_UI_PORT ?? "4170", 10);
const coreUrl = process.env.OPENCLAW_CORE_URL ?? "http://127.0.0.1:4100";
const eventHubUrl = process.env.OPENCLAW_EVENT_HUB_URL ?? "http://127.0.0.1:4101";
const sessionManagerUrl = process.env.OPENCLAW_SESSION_MANAGER_URL ?? "http://127.0.0.1:4102";
const screenSenseUrl = process.env.OPENCLAW_SCREEN_SENSE_URL ?? "http://127.0.0.1:4104";
const screenActUrl = process.env.OPENCLAW_SCREEN_ACT_URL ?? "http://127.0.0.1:4105";
const systemSenseUrl = process.env.OPENCLAW_SYSTEM_SENSE_URL ?? "http://127.0.0.1:4106";
const systemHealUrl = process.env.OPENCLAW_SYSTEM_HEAL_URL ?? "http://127.0.0.1:4107";

function sendHtml(res, html) {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate",
  });
  res.end(html);
}

function sendJavaScript(res, script) {
  res.writeHead(200, {
    "content-type": "text/javascript; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate",
  });
  res.end(script);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function observerHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OpenClaw Observer UI</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b1020;
        --panel: #121932;
        --line: #2b3568;
        --text: #e6ebff;
        --muted: #9aa7d6;
        --accent: #6ee7c8;
        --warn: #ffcc66;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "Noto Sans", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(110, 231, 200, 0.12), transparent 30%),
          linear-gradient(180deg, #08101d, var(--bg));
        color: var(--text);
      }
      main {
        max-width: 1320px;
        margin: 0 auto;
        padding: 24px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 32px;
      }
      .subtitle {
        margin: 0 0 24px;
        color: var(--muted);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
      }
      .panel {
        background: rgba(18, 25, 50, 0.9);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 16px;
        box-shadow: 0 14px 40px rgba(0, 0, 0, 0.24);
      }
      .panel h2 {
        margin: 0 0 12px;
        font-size: 18px;
      }
      .metric {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin: 8px 0;
      }
      .metric span:last-child {
        color: var(--accent);
      }
      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .actions.tight {
        gap: 8px;
      }
      .control-stack {
        display: grid;
        gap: 12px;
      }
      .field {
        display: grid;
        gap: 6px;
      }
      .field label {
        color: var(--muted);
        font-size: 13px;
      }
      .field input {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: rgba(10, 16, 34, 0.9);
        color: var(--text);
        padding: 10px 12px;
        font: inherit;
      }
      button {
        border: 0;
        border-radius: 999px;
        background: var(--accent);
        color: #04111c;
        padding: 10px 16px;
        font-weight: 700;
        cursor: pointer;
      }
      button.secondary {
        background: transparent;
        color: var(--text);
        border: 1px solid var(--line);
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        color: var(--muted);
        font-size: 13px;
      }
      ul {
        margin: 0;
        padding-left: 18px;
      }
      li {
        margin: 6px 0;
      }
      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 4px 10px;
        background: rgba(110, 231, 200, 0.12);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
      }
      .status-pill.warn {
        background: rgba(255, 204, 102, 0.14);
        color: var(--warn);
      }
      .task-list {
        display: grid;
        gap: 12px;
      }
      .task-card {
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 12px;
        background: rgba(10, 16, 34, 0.66);
      }
      .task-card.selected {
        border-color: var(--accent);
        box-shadow: 0 0 0 1px rgba(110, 231, 200, 0.35);
      }
      .task-card.active {
        border-color: rgba(110, 231, 200, 0.6);
      }
      .task-card h3 {
        margin: 0 0 8px;
        font-size: 14px;
      }
      .task-card-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 10px;
      }
      .task-card-actions button {
        padding: 8px 12px;
        font-size: 12px;
      }
      .task-card-top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
      }
      .task-card-top h3 {
        flex: 1;
      }
      .task-status-group {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .task-section {
        display: grid;
        gap: 12px;
      }
      .task-section h3 {
        margin: 0;
        font-size: 13px;
        color: var(--muted);
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .task-summary-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px 14px;
        margin-bottom: 14px;
      }
      .task-summary-grid .metric {
        margin: 0;
      }
      .hint {
        color: var(--muted);
        font-size: 12px;
      }
      .detail-meta {
        margin-top: 12px;
        margin-bottom: 12px;
        color: var(--muted);
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>OpenClaw Observer UI</h1>
      <p class="subtitle">Observe the first control-plane loop: runtime, screen, action, system, and heal state.</p>
      <div class="grid">
        <section class="panel">
          <h2>Runtime</h2>
          <div class="metric"><span>Status</span><span id="runtime-status">loading</span></div>
          <div class="metric"><span>Current Task</span><span id="runtime-task">none</span></div>
          <div class="metric"><span>Paused</span><span id="runtime-paused">false</span></div>
          <div class="metric"><span>Task Count</span><span id="runtime-count">0</span></div>
          <div class="metric"><span>Updated</span><span id="runtime-updated">-</span></div>
        </section>
        <section class="panel">
          <h2>Service Health</h2>
          <div class="metric"><span>Core</span><span id="core-health" class="status-pill warn">checking</span></div>
          <div class="metric"><span>Event Hub</span><span id="eventhub-health" class="status-pill warn">checking</span></div>
          <div class="metric"><span>Session Manager</span><span id="session-manager-health" class="status-pill warn">checking</span></div>
          <div class="metric"><span>Screen Sense</span><span id="screen-health" class="status-pill warn">checking</span></div>
          <div class="metric"><span>Screen Act</span><span id="screen-act-health" class="status-pill warn">checking</span></div>
          <div class="metric"><span>System Sense</span><span id="system-health-pill" class="status-pill warn">checking</span></div>
          <div class="metric"><span>System Heal</span><span id="system-heal-health" class="status-pill warn">checking</span></div>
          <div class="metric"><span>Observer</span><span class="status-pill">active</span></div>
        </section>
        <section class="panel">
          <h2>MVP Route</h2>
          <div class="metric"><span>Current</span><span id="mvp-route-current">loading</span></div>
          <div class="metric"><span>Trunk</span><span id="mvp-route-trunk">body-eyes-hands-observer-recovery</span></div>
          <div class="metric"><span>Complete</span><span id="mvp-route-complete">0/0</span></div>
          <div class="metric"><span>Next</span><span id="mvp-route-next">system-health-self-heal</span></div>
          <pre id="mvp-route-json">Loading MVP route alignment...</pre>
        </section>
        <section class="panel">
          <h2>Controls</h2>
          <div class="control-stack">
            <div class="field">
              <label for="work-view-url-input">Desired Work View URL</label>
              <input id="work-view-url-input" type="text" value="https://example.com/work-view" spellcheck="false" />
              <div class="hint" id="work-view-url-hint">Desired URL for the next open, task, or recovery action.</div>
            </div>
            <div class="actions">
              <button id="create-task-button">Create Demo Task</button>
              <button id="create-planned-task-button">Create Planned Task</button>
              <button id="operator-step-button" class="secondary">Operator Step</button>
              <button id="operator-run-button" class="secondary">Operator Run</button>
              <button id="recover-latest-task-button" class="secondary">Recover Latest Finished Task</button>
              <button id="recover-latest-failed-task-button" class="secondary">Recover Latest Failed Task</button>
              <button id="load-history-button" class="secondary">Load Latest Task History</button>
              <button id="follow-active-url-button" class="secondary">Follow Active URL</button>
              <button id="open-work-view-url-button">Open Work View URL</button>
              <button id="prepare-work-view-button" class="secondary">Prepare Work View</button>
              <button id="reveal-work-view-button" class="secondary">Reveal Work View</button>
              <button id="hide-work-view-button" class="secondary">Hide Work View</button>
              <button id="refresh-screen-button" class="secondary">Refresh Screen State</button>
              <button id="click-action-button" class="secondary">Simulate Click</button>
              <button id="type-action-button" class="secondary">Simulate Type</button>
              <button id="heal-browser-button" class="secondary">Simulate Browser Restart</button>
              <button id="run-maintenance-button" class="secondary">Run Maintenance Tick</button>
              <button id="complete-task-button" class="secondary">Complete Current Task</button>
              <button id="pause-button" class="secondary">Pause Current Task</button>
              <button id="resume-button" class="secondary">Resume Current Task</button>
              <button id="stop-button" class="secondary">Stop Current Task</button>
            </div>
          </div>
          <pre id="control-result">Controls ready.</pre>
        </section>
        <section class="panel">
          <h2>AI Work View</h2>
          <div class="metric"><span>Status</span><span id="work-view-status">idle</span></div>
          <div class="metric"><span>Visibility</span><span id="work-view-visibility">hidden</span></div>
          <div class="metric"><span>Mode</span><span id="work-view-mode">background</span></div>
          <div class="metric"><span>Helper</span><span id="work-view-helper">idle</span></div>
          <div class="metric"><span>Capture</span><span id="work-view-capture">browser-runtime</span></div>
          <pre id="work-view-json">Loading work view state...</pre>
        </section>
        <section class="panel">
          <h2>Current Task</h2>
          <pre id="task-json">Loading task state...</pre>
        </section>
        <section class="panel">
          <h2>Task Plan</h2>
          <div class="metric"><span>Status</span><span id="task-plan-status">none</span></div>
          <div class="metric"><span>Steps</span><span id="task-plan-count">0</span></div>
          <div class="metric"><span>Planner</span><span id="task-plan-planner">none</span></div>
          <div class="metric"><span>Capabilities</span><span id="task-plan-capability-count">0</span></div>
          <div class="metric"><span>Approval Gates</span><span id="task-plan-approval-gates">0</span></div>
          <pre id="task-plan-json">No task plan selected.</pre>
        </section>
        <section class="panel">
          <h2>Operator Loop</h2>
          <div class="metric"><span>Status</span><span id="operator-loop-status">idle</span></div>
          <div class="metric"><span>Blocked</span><span id="operator-loop-blocked">false</span></div>
          <div class="metric"><span>Next Task</span><span id="operator-loop-next">none</span></div>
          <div class="metric"><span>Last Run</span><span id="operator-loop-ran">none</span></div>
          <div class="metric"><span>Steps</span><span id="operator-loop-count">0</span></div>
          <pre id="operator-loop-json">No operator run yet.</pre>
        </section>
        <section class="panel">
          <h2>Command Transcript</h2>
          <div class="metric"><span>Entries</span><span id="command-transcript-count">0</span></div>
          <div class="metric"><span>Executed</span><span id="command-transcript-executed">0</span></div>
          <div class="metric"><span>Skipped</span><span id="command-transcript-skipped">0</span></div>
          <div class="metric"><span>Failed</span><span id="command-transcript-failed">0</span></div>
          <pre id="command-transcript-json">No command transcript yet.</pre>
        </section>
        <section class="panel">
          <h2>Policy Governance</h2>
          <div class="metric"><span>Engine</span><span id="policy-engine">policy-v0</span></div>
          <div class="metric"><span>Last Decision</span><span id="policy-decision">none</span></div>
          <div class="metric"><span>Domain</span><span id="policy-domain">none</span></div>
          <div class="metric"><span>Audit Entries</span><span id="policy-audit-count">0</span></div>
          <pre id="policy-json">Loading policy state...</pre>
        </section>
        <section class="panel">
          <h2>Approval Inbox</h2>
          <div class="metric"><span>Pending</span><span id="approval-pending-count">0</span></div>
          <div class="metric"><span>Latest</span><span id="approval-latest">none</span></div>
          <div class="actions tight">
            <button id="approve-latest-button" class="secondary">Approve Latest</button>
            <button id="deny-latest-button" class="secondary">Deny Latest</button>
          </div>
          <pre id="approval-json">Loading approval inbox...</pre>
        </section>
        <section class="panel">
          <h2>Body Capabilities</h2>
          <div class="metric"><span>Registry</span><span id="capability-registry">capability-v0</span></div>
          <div class="metric"><span>Online</span><span id="capability-online">0</span></div>
          <div class="metric"><span>Approval Gates</span><span id="capability-approval">0</span></div>
          <div class="actions tight">
            <button id="invoke-vitals-button" class="secondary">Invoke Vitals</button>
            <button id="invoke-process-button" class="secondary">Invoke Processes</button>
            <button id="invoke-command-dry-run-button" class="secondary">Blocked Command Dry Run</button>
            <button id="invoke-approved-command-dry-run-button" class="secondary">Approved Dry Run</button>
          </div>
          <pre id="capability-json">Loading body capabilities...</pre>
          <pre id="capability-invoke-json">No capability invocation yet.</pre>
        </section>
        <section class="panel">
          <h2>Capability History</h2>
          <div class="metric"><span>Total</span><span id="capability-history-total">0</span></div>
          <div class="metric"><span>Invoked</span><span id="capability-history-invoked">0</span></div>
          <div class="metric"><span>Blocked</span><span id="capability-history-blocked">0</span></div>
          <div class="metric"><span>Latest</span><span id="capability-history-latest">none</span></div>
          <pre id="capability-history-json">Loading capability invocation history...</pre>
        </section>
        <section class="panel">
          <h2>Command Ledger</h2>
          <div class="metric"><span>Total</span><span id="command-ledger-total">0</span></div>
          <div class="metric"><span>Executed</span><span id="command-ledger-executed">0</span></div>
          <div class="metric"><span>Failed</span><span id="command-ledger-failed">0</span></div>
          <div class="metric"><span>Skipped</span><span id="command-ledger-skipped">0</span></div>
          <div class="metric"><span>Tasks</span><span id="command-ledger-tasks">0</span></div>
          <pre id="command-ledger-json">Loading command transcript ledger...</pre>
        </section>
        <section class="panel">
          <h2>Filesystem Ledger</h2>
          <div class="metric"><span>Total</span><span id="filesystem-ledger-total">0</span></div>
          <div class="metric"><span>Mkdir</span><span id="filesystem-ledger-mkdir">0</span></div>
          <div class="metric"><span>Writes</span><span id="filesystem-ledger-writes">0</span></div>
          <div class="metric"><span>Tasks</span><span id="filesystem-ledger-tasks">0</span></div>
          <pre id="filesystem-ledger-json">Loading filesystem change ledger...</pre>
        </section>
        <section class="panel">
          <h2>Filesystem Reads</h2>
          <div class="metric"><span>Total</span><span id="filesystem-read-ledger-total">0</span></div>
          <div class="metric"><span>Metadata</span><span id="filesystem-read-ledger-metadata">0</span></div>
          <div class="metric"><span>List/Search</span><span id="filesystem-read-ledger-query">0</span></div>
          <div class="metric"><span>Read Text</span><span id="filesystem-read-ledger-read-text">0</span></div>
          <div class="metric"><span>Tasks</span><span id="filesystem-read-ledger-tasks">0</span></div>
          <pre id="filesystem-read-ledger-json">Loading filesystem read ledger...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Workspaces</h2>
          <div class="metric"><span>Registry</span><span id="workspace-registry">workspace-detect-v0</span></div>
          <div class="metric"><span>Detected</span><span id="workspace-detected">0</span></div>
          <div class="metric"><span>Missing</span><span id="workspace-missing">0</span></div>
          <div class="metric"><span>Node Workspaces</span><span id="workspace-node">0</span></div>
          <div class="metric"><span>Mode</span><span id="workspace-mode">read-only</span></div>
          <pre id="workspace-json">Loading OpenClaw workspace registry...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Source Migration Map</h2>
          <div class="metric"><span>Registry</span><span id="workspace-migration-registry">openclaw-source-migration-map-v0</span></div>
          <div class="metric"><span>Candidates</span><span id="workspace-migration-total">0</span></div>
          <div class="metric"><span>Capability Registry</span><span id="workspace-migration-capabilities">0</span></div>
          <div class="metric"><span>High Priority</span><span id="workspace-migration-high">0</span></div>
          <div class="metric"><span>Mode</span><span id="workspace-migration-mode">read-only</span></div>
          <pre id="workspace-migration-json">Loading OpenClaw source migration map...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Source Migration Plan</h2>
          <div class="metric"><span>Registry</span><span id="workspace-migration-plan-registry">openclaw-source-migration-plan-v0</span></div>
          <div class="metric"><span>First Wave</span><span id="workspace-migration-plan-total">0</span></div>
          <div class="metric"><span>Candidates</span><span id="workspace-migration-plan-candidates">0</span></div>
          <div class="metric"><span>Backlog</span><span id="workspace-migration-plan-backlog">0</span></div>
          <div class="metric"><span>Mode</span><span id="workspace-migration-plan-mode">plan-only</span></div>
          <pre id="workspace-migration-plan-json">Loading OpenClaw source migration plan...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Plugin SDK Contract Review</h2>
          <div class="metric"><span>Registry</span><span id="plugin-sdk-review-registry">openclaw-plugin-sdk-contract-review-v0</span></div>
          <div class="metric"><span>Reviews</span><span id="plugin-sdk-review-total">0</span></div>
          <div class="metric"><span>Manifest</span><span id="plugin-sdk-review-manifest">0</span></div>
          <div class="metric"><span>Types</span><span id="plugin-sdk-review-types">0</span></div>
          <div class="metric"><span>Exports</span><span id="plugin-sdk-review-exports">0</span></div>
          <div class="metric"><span>Mode</span><span id="plugin-sdk-review-mode">read-only</span></div>
          <pre id="plugin-sdk-review-json">Loading plugin SDK contract review...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Plugin SDK Source Review Scope</h2>
          <div class="metric"><span>Registry</span><span id="plugin-sdk-source-scope-registry">openclaw-plugin-sdk-source-review-scope-v0</span></div>
          <div class="metric"><span>Files</span><span id="plugin-sdk-source-scope-total">0</span></div>
          <div class="metric"><span>Content</span><span id="plugin-sdk-source-scope-content">blocked</span></div>
          <div class="metric"><span>Approval</span><span id="plugin-sdk-source-scope-approval">required</span></div>
          <div class="metric"><span>Mode</span><span id="plugin-sdk-source-scope-mode">scope-plan-only</span></div>
          <pre id="plugin-sdk-source-scope-json">Loading plugin SDK source review scope...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Plugin SDK Source Content Review</h2>
          <div class="metric"><span>Registry</span><span id="plugin-sdk-source-content-registry">openclaw-plugin-sdk-source-content-review-v0</span></div>
          <div class="metric"><span>Read</span><span id="plugin-sdk-source-content-read">0</span></div>
          <div class="metric"><span>Exports</span><span id="plugin-sdk-source-content-exports">0</span></div>
          <div class="metric"><span>Raw</span><span id="plugin-sdk-source-content-raw">hidden</span></div>
          <div class="metric"><span>Mode</span><span id="plugin-sdk-source-content-mode">content-review-derived-signals</span></div>
          <pre id="plugin-sdk-source-content-json">Loading plugin SDK source content review...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Plugin SDK Native Contract Tests</h2>
          <div class="metric"><span>Registry</span><span id="plugin-sdk-native-tests-registry">openclaw-plugin-sdk-native-contract-tests-v0</span></div>
          <div class="metric"><span>Required</span><span id="plugin-sdk-native-tests-required">0/0</span></div>
          <div class="metric"><span>Enhanced Source</span><span id="plugin-sdk-native-tests-source">0</span></div>
          <div class="metric"><span>Native Caps</span><span id="plugin-sdk-native-tests-caps">0</span></div>
          <div class="metric"><span>Mode</span><span id="plugin-sdk-native-tests-mode">native-contract-tests</span></div>
          <pre id="plugin-sdk-native-tests-json">Loading plugin SDK native contract tests...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Native SDK Contract Implementation</h2>
          <div class="metric"><span>Registry</span><span id="native-sdk-implementation-registry">openclaw-native-plugin-sdk-contract-implementation-v0</span></div>
          <div class="metric"><span>Slots</span><span id="native-sdk-implementation-slots">0/0</span></div>
          <div class="metric"><span>Read-only</span><span id="native-sdk-implementation-readonly">0</span></div>
          <div class="metric"><span>Executable</span><span id="native-sdk-implementation-executable">0</span></div>
          <div class="metric"><span>Mode</span><span id="native-sdk-implementation-mode">native-sdk-contract-implementation</span></div>
          <pre id="native-sdk-implementation-json">Loading native SDK contract implementation...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Tool Catalog</h2>
          <div class="metric"><span>Registry</span><span id="openclaw-tool-catalog-registry">openclaw-tool-catalog-v0</span></div>
          <div class="metric"><span>Tools</span><span id="openclaw-tool-catalog-tools">0</span></div>
          <div class="metric"><span>Docs</span><span id="openclaw-tool-catalog-docs">0</span></div>
          <div class="metric"><span>Categories</span><span id="openclaw-tool-catalog-categories">0</span></div>
          <div class="metric"><span>Mode</span><span id="openclaw-tool-catalog-mode">read-only-native-absorption</span></div>
          <pre id="openclaw-tool-catalog-json">Loading OpenClaw tool catalog...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Plugin Manifest Map</h2>
          <div class="metric"><span>Registry</span><span id="plugin-manifest-map-registry">openclaw-plugin-manifest-map-v0</span></div>
          <div class="metric"><span>Manifests</span><span id="plugin-manifest-map-manifests">0</span></div>
          <div class="metric"><span>Categories</span><span id="plugin-manifest-map-categories">0</span></div>
          <div class="metric"><span>Auth Refs</span><span id="plugin-manifest-map-auth">0</span></div>
          <div class="metric"><span>Mode</span><span id="plugin-manifest-map-mode">read-only-plugin-manifest-absorption</span></div>
          <pre id="plugin-manifest-map-json">Loading OpenClaw plugin manifest map...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Plugin Capability Plan</h2>
          <div class="metric"><span>Registry</span><span id="plugin-capability-plan-registry">openclaw-plugin-capability-plan-v0</span></div>
          <div class="metric"><span>Candidates</span><span id="plugin-capability-plan-candidates">0</span></div>
          <div class="metric"><span>Blocked</span><span id="plugin-capability-plan-blocked">0</span></div>
          <div class="metric"><span>Approval</span><span id="plugin-capability-plan-approval">0</span></div>
          <div class="metric"><span>Runtime</span><span id="plugin-capability-plan-runtime">disabled</span></div>
          <pre id="plugin-capability-plan-json">Loading OpenClaw plugin capability plan...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Plugin Candidate Contract Tests</h2>
          <div class="metric"><span>Registry</span><span id="plugin-candidate-contract-tests-registry">openclaw-plugin-candidate-contract-tests-v0</span></div>
          <div class="metric"><span>Category</span><span id="plugin-candidate-contract-tests-category">search_and_web</span></div>
          <div class="metric"><span>Required</span><span id="plugin-candidate-contract-tests-required">0/0</span></div>
          <div class="metric"><span>Contracts</span><span id="plugin-candidate-contract-tests-contracts">0</span></div>
          <div class="metric"><span>Runtime</span><span id="plugin-candidate-contract-tests-runtime">pending</span></div>
          <pre id="plugin-candidate-contract-tests-json">Loading OpenClaw plugin candidate contract tests...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Search/Web Adapter Contract</h2>
          <div class="metric"><span>Registry</span><span id="plugin-search-web-contract-registry">openclaw-plugin-search-web-adapter-contract-v0</span></div>
          <div class="metric"><span>Providers</span><span id="plugin-search-web-contract-providers">0</span></div>
          <div class="metric"><span>Required</span><span id="plugin-search-web-contract-required">0/0</span></div>
          <div class="metric"><span>Network</span><span id="plugin-search-web-contract-network">blocked</span></div>
          <div class="metric"><span>Runtime</span><span id="plugin-search-web-contract-runtime">disabled</span></div>
          <div class="actions tight">
            <button id="plugin-search-web-task-button" class="secondary">Create Search/Web Approval Task</button>
          </div>
          <pre id="plugin-search-web-contract-json">Loading OpenClaw search/web adapter contract...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Search/Web Runtime Preflight</h2>
          <div class="metric"><span>Registry</span><span id="plugin-search-web-preflight-registry">openclaw-plugin-search-web-adapter-runtime-preflight-v0</span></div>
          <div class="metric"><span>Envelope</span><span id="plugin-search-web-preflight-envelope">unknown</span></div>
          <div class="metric"><span>Approval</span><span id="plugin-search-web-preflight-approval">required</span></div>
          <div class="metric"><span>Network</span><span id="plugin-search-web-preflight-network">blocked</span></div>
          <div class="metric"><span>Runtime</span><span id="plugin-search-web-preflight-runtime">disabled</span></div>
          <pre id="plugin-search-web-preflight-json">Loading OpenClaw search/web runtime preflight...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Search/Web Runtime Activation Plan</h2>
          <div class="metric"><span>Registry</span><span id="plugin-search-web-activation-registry">openclaw-plugin-search-web-adapter-runtime-activation-plan-v0</span></div>
          <div class="metric"><span>Status</span><span id="plugin-search-web-activation-status">unknown</span></div>
          <div class="metric"><span>Required</span><span id="plugin-search-web-activation-required">0/0</span></div>
          <div class="metric"><span>Network</span><span id="plugin-search-web-activation-network">blocked</span></div>
          <div class="metric"><span>Runtime</span><span id="plugin-search-web-activation-runtime">disabled</span></div>
          <div class="actions tight">
            <button id="plugin-search-web-activation-task-button" class="secondary">Create Search/Web Activation Task</button>
          </div>
          <pre id="plugin-search-web-activation-json">Loading OpenClaw search/web runtime activation plan...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Search/Web Provider Sandbox</h2>
          <div class="metric"><span>Registry</span><span id="plugin-search-web-sandbox-registry">openclaw-plugin-search-web-adapter-provider-runtime-sandbox-v0</span></div>
          <div class="metric"><span>Status</span><span id="plugin-search-web-sandbox-status">unknown</span></div>
          <div class="metric"><span>Required</span><span id="plugin-search-web-sandbox-required">0/0</span></div>
          <div class="metric"><span>Network</span><span id="plugin-search-web-sandbox-network">blocked</span></div>
          <div class="metric"><span>Runtime</span><span id="plugin-search-web-sandbox-runtime">disabled</span></div>
          <div class="actions tight">
            <button id="plugin-search-web-sandbox-task-button" class="secondary">Create Provider Sandbox Task</button>
          </div>
          <pre id="plugin-search-web-sandbox-json">Loading OpenClaw search/web provider runtime sandbox contract...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Tool Catalog Adapter</h2>
          <div class="metric"><span>Registry</span><span id="tool-catalog-adapter-registry">openclaw-native-plugin-adapter-v0</span></div>
          <div class="metric"><span>Matches</span><span id="tool-catalog-adapter-matches">0</span></div>
          <div class="metric"><span>Categories</span><span id="tool-catalog-adapter-categories">0</span></div>
          <div class="metric"><span>Execution</span><span id="tool-catalog-adapter-execution">blocked</span></div>
          <div class="metric"><span>Mode</span><span id="tool-catalog-adapter-mode">tool-catalog-profile-only</span></div>
          <pre id="tool-catalog-adapter-json">Loading native tool catalog adapter...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Semantic Index</h2>
          <div class="metric"><span>Registry</span><span id="semantic-index-registry">openclaw-native-plugin-adapter-v0</span></div>
          <div class="metric"><span>Files</span><span id="semantic-index-files">0</span></div>
          <div class="metric"><span>Exports</span><span id="semantic-index-exports">0</span></div>
          <div class="metric"><span>Source</span><span id="semantic-index-source">hidden</span></div>
          <div class="metric"><span>Mode</span><span id="semantic-index-mode">workspace-semantic-index-only</span></div>
          <pre id="semantic-index-json">Loading native workspace semantic index...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Symbol Lookup</h2>
          <div class="metric"><span>Registry</span><span id="symbol-lookup-registry">openclaw-native-plugin-adapter-v0</span></div>
          <div class="metric"><span>Matches</span><span id="symbol-lookup-matches">0</span></div>
          <div class="metric"><span>Files</span><span id="symbol-lookup-files">0</span></div>
          <div class="metric"><span>Execution</span><span id="symbol-lookup-execution">query-only</span></div>
          <div class="metric"><span>Mode</span><span id="symbol-lookup-mode">workspace-symbol-lookup-executable-read-only</span></div>
          <pre id="symbol-lookup-json">Loading native workspace symbol lookup...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Edit Target Selection</h2>
          <div class="metric"><span>Registry</span><span id="edit-target-selection-registry">openclaw-native-workspace-edit-target-selection-v0</span></div>
          <div class="metric"><span>Candidates</span><span id="edit-target-selection-candidates">0</span></div>
          <div class="metric"><span>Selected</span><span id="edit-target-selection-selected">none</span></div>
          <div class="metric"><span>Source</span><span id="edit-target-selection-source">hidden</span></div>
          <div class="metric"><span>Mode</span><span id="edit-target-selection-mode">source-derived-bounded-target-selection</span></div>
          <pre id="edit-target-selection-json">Loading native workspace edit target selection...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Prompt Semantics</h2>
          <div class="metric"><span>Registry</span><span id="prompt-semantics-registry">openclaw-native-prompt-semantics-v0</span></div>
          <div class="metric"><span>Files</span><span id="prompt-semantics-files">0</span></div>
          <div class="metric"><span>Checks</span><span id="prompt-semantics-checks">0</span></div>
          <div class="metric"><span>Content</span><span id="prompt-semantics-content">hidden</span></div>
          <div class="metric"><span>Mode</span><span id="prompt-semantics-mode">prompt-tool-semantics-profile-only</span></div>
          <pre id="prompt-semantics-json">Loading native prompt semantics...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Workspace Text Write</h2>
          <div class="metric"><span>Registry</span><span id="workspace-text-write-registry">openclaw-native-workspace-text-write-draft-v0</span></div>
          <div class="metric"><span>Capability</span><span id="workspace-text-write-capability">act.openclaw.workspace_text_write</span></div>
          <div class="metric"><span>Approval</span><span id="workspace-text-write-approval">required</span></div>
          <div class="metric"><span>Content</span><span id="workspace-text-write-content">redacted</span></div>
          <div class="metric"><span>Mode</span><span id="workspace-text-write-mode">approval-gated-draft</span></div>
          <div class="actions tight">
            <button id="workspace-text-write-task-button" class="secondary">Create Approval Task</button>
          </div>
          <pre id="workspace-text-write-json">Loading native workspace text write draft...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Workspace Patch Apply</h2>
          <div class="metric"><span>Registry</span><span id="workspace-patch-apply-registry">openclaw-native-workspace-patch-apply-draft-v0</span></div>
          <div class="metric"><span>Capability</span><span id="workspace-patch-apply-capability">act.openclaw.workspace_patch_apply</span></div>
          <div class="metric"><span>Approval</span><span id="workspace-patch-apply-approval">required</span></div>
          <div class="metric"><span>Preview</span><span id="workspace-patch-apply-preview">bounded diff</span></div>
          <div class="metric"><span>Mode</span><span id="workspace-patch-apply-mode">diff-preview-approval-gated-draft</span></div>
          <div class="actions tight">
            <button id="workspace-patch-apply-task-button" class="secondary">Create Approval Task</button>
            <button id="source-authored-edit-task-button" class="secondary">Create Source-Authored Task</button>
          </div>
          <pre id="workspace-patch-apply-json">Loading native workspace patch draft...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Native Plugin Contract</h2>
          <div class="metric"><span>Registry</span><span id="native-plugin-contract-registry">openclaw-native-plugin-contract-v0</span></div>
          <div class="metric"><span>Owner</span><span id="native-plugin-contract-owner">openclaw_on_nixos</span></div>
          <div class="metric"><span>Capabilities</span><span id="native-plugin-contract-total">0</span></div>
          <div class="metric"><span>Approval</span><span id="native-plugin-contract-approval">0</span></div>
          <div class="metric"><span>Mutation</span><span id="native-plugin-contract-mutation">0</span></div>
          <div class="metric"><span>Validation</span><span id="native-plugin-contract-validation">unknown</span></div>
          <pre id="native-plugin-contract-json">Loading native plugin contract...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Native Plugin Registry</h2>
          <div class="metric"><span>Registry</span><span id="native-plugin-registry-id">openclaw-native-plugin-registry-v0</span></div>
          <div class="metric"><span>Plugins</span><span id="native-plugin-registry-total">0</span></div>
          <div class="metric"><span>Capabilities</span><span id="native-plugin-registry-capabilities">0</span></div>
          <div class="metric"><span>Activation</span><span id="native-plugin-registry-activation">manual</span></div>
          <div class="metric"><span>Validation</span><span id="native-plugin-registry-validation">unknown</span></div>
          <pre id="native-plugin-registry-json">Loading native plugin registry...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Formal Integration Readiness</h2>
          <div class="metric"><span>Registry</span><span id="integration-readiness-registry">openclaw-formal-integration-readiness-v0</span></div>
          <div class="metric"><span>Status</span><span id="integration-readiness-status">unknown</span></div>
          <div class="metric"><span>Required</span><span id="integration-readiness-required">0/0</span></div>
          <div class="metric"><span>Runtime</span><span id="integration-readiness-runtime">disabled</span></div>
          <div class="metric"><span>Mode</span><span id="integration-readiness-mode">readiness-only</span></div>
          <pre id="integration-readiness-json">Loading formal integration readiness...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Native Plugin Adapter</h2>
          <div class="metric"><span>Registry</span><span id="native-plugin-adapter-registry">openclaw-native-plugin-adapter-v0</span></div>
          <div class="metric"><span>Status</span><span id="native-plugin-adapter-status">unknown</span></div>
          <div class="metric"><span>Implemented</span><span id="native-plugin-adapter-implemented">0</span></div>
          <div class="metric"><span>Runtime</span><span id="native-plugin-adapter-runtime">disabled</span></div>
          <div class="metric"><span>Mode</span><span id="native-plugin-adapter-mode">native-adapter-shell</span></div>
          <pre id="native-plugin-adapter-json">Loading native plugin adapter...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Native Runtime Preflight</h2>
          <div class="metric"><span>Registry</span><span id="native-plugin-preflight-registry">openclaw-native-plugin-runtime-preflight-v0</span></div>
          <div class="metric"><span>Envelope</span><span id="native-plugin-preflight-envelope">unknown</span></div>
          <div class="metric"><span>Approval</span><span id="native-plugin-preflight-approval">required</span></div>
          <div class="metric"><span>Runtime</span><span id="native-plugin-preflight-runtime">disabled</span></div>
          <div class="metric"><span>Mode</span><span id="native-plugin-preflight-mode">preflight-only</span></div>
          <pre id="native-plugin-preflight-json">Loading native plugin runtime preflight...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Native Runtime Activation Plan</h2>
          <div class="metric"><span>Registry</span><span id="native-plugin-activation-registry">openclaw-native-plugin-runtime-activation-plan-v0</span></div>
          <div class="metric"><span>Status</span><span id="native-plugin-activation-status">unknown</span></div>
          <div class="metric"><span>Required</span><span id="native-plugin-activation-required">0/0</span></div>
          <div class="metric"><span>Runtime</span><span id="native-plugin-activation-runtime">disabled</span></div>
          <div class="metric"><span>Mode</span><span id="native-plugin-activation-mode">activation-plan-only</span></div>
          <div class="actions tight">
            <button id="native-plugin-activation-task-button" type="button">Create Activation Task</button>
          </div>
          <pre id="native-plugin-activation-json">Loading native plugin runtime activation plan...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Native Runtime Adapter Contract</h2>
          <div class="metric"><span>Registry</span><span id="native-plugin-runtime-contract-registry">openclaw-native-plugin-runtime-adapter-contract-v0</span></div>
          <div class="metric"><span>Status</span><span id="native-plugin-runtime-contract-status">unknown</span></div>
          <div class="metric"><span>Required</span><span id="native-plugin-runtime-contract-required">0/0</span></div>
          <div class="metric"><span>Runtime</span><span id="native-plugin-runtime-contract-runtime">disabled</span></div>
          <div class="metric"><span>Mode</span><span id="native-plugin-runtime-contract-mode">runtime-adapter-contract</span></div>
          <div class="actions tight">
            <button id="native-plugin-runtime-adapter-task-button" type="button">Create Adapter Task</button>
          </div>
          <pre id="native-plugin-runtime-contract-json">Loading native plugin runtime adapter contract...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Native Plugin Invoke Plan</h2>
          <div class="metric"><span>Registry</span><span id="native-plugin-invoke-plan-registry">openclaw-native-plugin-invoke-plan-v0</span></div>
          <div class="metric"><span>Capability</span><span id="native-plugin-invoke-plan-capability">act.plugin.capability.invoke</span></div>
          <div class="metric"><span>Decision</span><span id="native-plugin-invoke-plan-decision">require_approval</span></div>
          <div class="metric"><span>Runtime</span><span id="native-plugin-invoke-plan-runtime">disabled</span></div>
          <div class="metric"><span>Mode</span><span id="native-plugin-invoke-plan-mode">plan-only</span></div>
          <div class="actions tight">
            <button id="native-plugin-invoke-task-button" type="button">Create Approval Task</button>
          </div>
          <pre id="native-plugin-invoke-plan-json">Loading native plugin invoke plan...</pre>
        </section>
        <section class="panel">
          <h2>Workspace Command Proposals</h2>
          <div class="metric"><span>Registry</span><span id="workspace-command-registry">workspace-command-proposals-v0</span></div>
          <div class="metric"><span>Total</span><span id="workspace-command-total">0</span></div>
          <div class="metric"><span>Validation</span><span id="workspace-command-validation">0</span></div>
          <div class="metric"><span>Build</span><span id="workspace-command-build">0</span></div>
          <div class="metric"><span>Runtime</span><span id="workspace-command-runtime">0</span></div>
          <div class="metric"><span>Mode</span><span id="workspace-command-mode">proposal-only</span></div>
          <pre id="workspace-command-json">Loading workspace command proposals...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Source Command Proposals</h2>
          <div class="metric"><span>Registry</span><span id="source-command-registry">openclaw-source-command-proposals-v0</span></div>
          <div class="metric"><span>Total</span><span id="source-command-total">0</span></div>
          <div class="metric"><span>Tools</span><span id="source-command-tools">0</span></div>
          <div class="metric"><span>Prompt Files</span><span id="source-command-prompts">0</span></div>
          <div class="metric"><span>Mode</span><span id="source-command-mode">proposal-only-source-absorbed</span></div>
          <pre id="source-command-json">Loading source-derived command proposals...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Source Command Plan</h2>
          <div class="metric"><span>Registry</span><span id="source-command-plan-registry">openclaw-source-command-plan-draft-v0</span></div>
          <div class="metric"><span>Proposal</span><span id="source-command-plan-proposal">openclaw:typecheck</span></div>
          <div class="metric"><span>Decision</span><span id="source-command-plan-decision">require_approval</span></div>
          <div class="metric"><span>Creates Task</span><span id="source-command-plan-task">false</span></div>
          <div class="metric"><span>Mode</span><span id="source-command-plan-mode">plan-only-source-command</span></div>
          <div class="actions tight">
            <button id="source-command-task-button" class="secondary">Create Source Command Approval Task</button>
          </div>
          <pre id="source-command-plan-json">Loading source-derived command plan...</pre>
        </section>
        <section class="panel">
          <h2>Workspace Command Plan Draft</h2>
          <div class="metric"><span>Registry</span><span id="workspace-command-plan-registry">workspace-command-plan-draft-v0</span></div>
          <div class="metric"><span>Proposal</span><span id="workspace-command-plan-proposal">openclaw:typecheck</span></div>
          <div class="metric"><span>Decision</span><span id="workspace-command-plan-decision">require_approval</span></div>
          <div class="metric"><span>Approval</span><span id="workspace-command-plan-approval">required</span></div>
          <div class="metric"><span>Creates Task</span><span id="workspace-command-plan-task">false</span></div>
          <div class="metric"><span>Mode</span><span id="workspace-command-plan-mode">plan-only</span></div>
          <div class="actions tight">
            <button id="workspace-command-task-button" class="secondary">Create Approval Task</button>
          </div>
          <pre id="workspace-command-plan-json">Loading workspace command plan draft...</pre>
        </section>
        <section class="panel">
          <h2>Recent Tasks</h2>
          <div class="metric"><span>Entries</span><span id="task-list-count">0</span></div>
          <div class="task-summary-grid">
            <div class="metric"><span>Active</span><span id="task-active-count">0</span></div>
            <div class="metric"><span>Recoverable</span><span id="task-recoverable-count">0</span></div>
            <div class="metric"><span>Failed</span><span id="task-failed-count">0</span></div>
            <div class="metric"><span>Completed</span><span id="task-completed-count">0</span></div>
            <div class="metric"><span>Superseded</span><span id="task-superseded-count">0</span></div>
            <div class="metric"><span>Queued</span><span id="task-queued-count">0</span></div>
          </div>
          <div id="task-list-items" class="task-list"></div>
        </section>
        <section class="panel">
          <h2>Task History Detail</h2>
          <div class="field">
            <label for="task-detail-id-input">Task Detail ID</label>
            <input id="task-detail-id-input" type="text" value="" spellcheck="false" placeholder="Task ID to inspect or recover" />
          </div>
          <div class="actions" style="margin-top: 12px;">
            <button id="load-current-task-button" class="secondary">Load Current Task</button>
            <button id="load-latest-failed-task-button" class="secondary">Load Latest Failed Task</button>
            <button id="load-selected-task-button" class="secondary">Load Selected Task</button>
            <button id="recover-selected-task-button" class="secondary">Recover Selected Task</button>
            <button id="use-detail-url-button" class="secondary">Use Detail URL</button>
          </div>
          <div class="detail-meta" id="task-history-meta">Viewing latest finished task.</div>
          <pre id="task-history-json">Loading task history detail...</pre>
        </section>
        <section class="panel">
          <h2>Screen State</h2>
          <div class="metric"><span>Focused Window</span><span id="screen-window">loading</span></div>
          <div class="metric"><span>Session</span><span id="screen-session">unknown</span></div>
          <div class="metric"><span>Readiness</span><span id="screen-readiness">warming_up</span></div>
          <div class="metric"><span>Capture Source</span><span id="screen-capture-source">unknown</span></div>
          <div class="metric"><span>Capture Strategy</span><span id="screen-capture-strategy">unknown</span></div>
          <div class="metric"><span>Work View URL</span><span id="screen-work-view-url">none</span></div>
          <pre id="screen-work-view-summary">No work view summary yet.</pre>
          <pre id="screen-summary">Loading screen state...</pre>
        </section>
        <section class="panel">
          <h2>Snapshot Preview</h2>
          <pre id="screen-snapshot">No screen preview yet.</pre>
        </section>
        <section class="panel">
          <h2>Last Action</h2>
          <div class="metric"><span>Kind</span><span id="action-kind">none</span></div>
          <div class="metric"><span>Count</span><span id="action-count">0</span></div>
          <div class="metric"><span>Degraded</span><span id="action-degraded">false</span></div>
          <pre id="action-json">No action executed yet.</pre>
        </section>
        <section class="panel">
          <h2>System Health</h2>
          <div class="metric"><span>Online Services</span><span id="system-services-online">0</span></div>
          <div class="metric"><span>Alerts</span><span id="system-alert-count">0</span></div>
          <div class="metric"><span>Body Uptime</span><span id="system-body-uptime">0s</span></div>
          <pre id="system-summary">Loading system state...</pre>
        </section>
        <section class="panel" id="systemd-unit-inventory">
          <h2>Systemd Unit Inventory</h2>
          <div class="metric"><span>Total Units</span><span id="systemd-unit-total">0</span></div>
          <div class="metric"><span>Active</span><span id="systemd-unit-active">0</span></div>
          <div class="metric"><span>Observed</span><span id="systemd-unit-observed">0</span></div>
          <div class="metric"><span>Mode</span><span id="systemd-unit-mode">read_only</span></div>
          <pre id="systemd-unit-json">Loading read-only OpenClaw systemd unit inventory...</pre>
        </section>
        <section class="panel" id="systemd-repair-plan-panel">
          <h2>Systemd Repair Plan</h2>
          <div class="metric"><span>Target</span><span id="systemd-repair-plan-target">openclaw-browser-runtime.service</span></div>
          <div class="metric"><span>Risk</span><span id="systemd-repair-plan-risk">loading</span></div>
          <div class="metric"><span>Mode</span><span id="systemd-repair-plan-mode">plan_only</span></div>
          <div class="metric"><span>Dry Run</span><span id="systemd-repair-dry-run-mode">loading</span></div>
          <pre id="systemd-repair-plan-json">Loading operator-visible systemd repair plan...</pre>
          <pre id="systemd-repair-dry-run-json">Loading dry-run repair envelope...</pre>
        </section>
        <section class="panel">
          <h2>Heal History</h2>
          <div class="metric"><span>Entries</span><span id="heal-count">0</span></div>
          <pre id="heal-summary">No heal actions yet.</pre>
        </section>
        <section class="panel">
          <h2>Maintenance</h2>
          <div class="metric"><span>Policy</span><span id="maintenance-policy-enabled">disabled</span></div>
          <div class="metric"><span>Next Due</span><span id="maintenance-next-due">-</span></div>
          <div class="metric"><span>Last Tick</span><span id="maintenance-last-tick">none</span></div>
          <div class="metric"><span>Runs</span><span id="maintenance-run-count">0</span></div>
          <pre id="maintenance-summary">Loading maintenance state...</pre>
        </section>
        <section class="panel">
          <h2>Audit Ledger</h2>
          <div class="metric"><span>Persisted Events</span><span id="audit-total">0</span></div>
          <div class="metric"><span>Event Types</span><span id="audit-type-count">0</span></div>
          <div class="metric"><span>Sources</span><span id="audit-source-count">0</span></div>
          <pre id="audit-summary">Loading audit ledger...</pre>
        </section>
        <section class="panel" style="grid-column: 1 / -1;">
          <h2>Recent Events</h2>
          <ul id="events-list"></ul>
        </section>
      </div>
    </main>
    <script type="module" src="/client-v5.js"></script>
  </body>
</html>`;
}

function clientScript() {
  return `const observerBase = \`\${window.location.protocol}//\${window.location.hostname}\`;
const observerConfig = {
  coreUrl: \`\${observerBase}:4100\`,
  eventHubUrl: \`\${observerBase}:4101\`,
  sessionManagerUrl: \`\${observerBase}:4102\`,
  screenSenseUrl: \`\${observerBase}:4104\`,
  screenActUrl: \`\${observerBase}:4105\`,
  systemSenseUrl: \`\${observerBase}:4106\`,
  systemHealUrl: \`\${observerBase}:4107\`,
};

const SOURCE_DERIVED_EDIT_PROPOSAL_REGISTRY = "openclaw-source-derived-edit-proposal-v0";

const runtimeStatus = document.querySelector("#runtime-status");
const runtimeTask = document.querySelector("#runtime-task");
const runtimePaused = document.querySelector("#runtime-paused");
const runtimeCount = document.querySelector("#runtime-count");
const runtimeUpdated = document.querySelector("#runtime-updated");
const taskJson = document.querySelector("#task-json");
const taskListCount = document.querySelector("#task-list-count");
const taskActiveCount = document.querySelector("#task-active-count");
const taskRecoverableCount = document.querySelector("#task-recoverable-count");
const taskFailedCount = document.querySelector("#task-failed-count");
const taskCompletedCount = document.querySelector("#task-completed-count");
const taskSupersededCount = document.querySelector("#task-superseded-count");
const taskQueuedCount = document.querySelector("#task-queued-count");
const taskListItems = document.querySelector("#task-list-items");
const taskHistoryJson = document.querySelector("#task-history-json");
const taskHistoryMeta = document.querySelector("#task-history-meta");
const taskDetailIdInput = document.querySelector("#task-detail-id-input");
const workViewUrlHint = document.querySelector("#work-view-url-hint");
const workViewStatus = document.querySelector("#work-view-status");
const workViewVisibility = document.querySelector("#work-view-visibility");
const workViewMode = document.querySelector("#work-view-mode");
const workViewHelper = document.querySelector("#work-view-helper");
const workViewCapture = document.querySelector("#work-view-capture");
const workViewJson = document.querySelector("#work-view-json");
const controlResult = document.querySelector("#control-result");
const eventsList = document.querySelector("#events-list");
const coreHealth = document.querySelector("#core-health");
const eventhubHealth = document.querySelector("#eventhub-health");
const sessionManagerHealth = document.querySelector("#session-manager-health");
const screenHealth = document.querySelector("#screen-health");
const screenActHealth = document.querySelector("#screen-act-health");
const systemHealthPill = document.querySelector("#system-health-pill");
const systemHealHealth = document.querySelector("#system-heal-health");
const mvpRouteCurrent = document.querySelector("#mvp-route-current");
const mvpRouteTrunk = document.querySelector("#mvp-route-trunk");
const mvpRouteComplete = document.querySelector("#mvp-route-complete");
const mvpRouteNext = document.querySelector("#mvp-route-next");
const mvpRouteJson = document.querySelector("#mvp-route-json");
const screenWindow = document.querySelector("#screen-window");
const screenSession = document.querySelector("#screen-session");
const screenReadiness = document.querySelector("#screen-readiness");
const screenCaptureSource = document.querySelector("#screen-capture-source");
const screenCaptureStrategy = document.querySelector("#screen-capture-strategy");
const screenWorkViewUrl = document.querySelector("#screen-work-view-url");
const screenWorkViewSummary = document.querySelector("#screen-work-view-summary");
const screenSummary = document.querySelector("#screen-summary");
const screenSnapshot = document.querySelector("#screen-snapshot");
const actionKind = document.querySelector("#action-kind");
const actionCount = document.querySelector("#action-count");
const actionDegraded = document.querySelector("#action-degraded");
const actionJson = document.querySelector("#action-json");
const systemServicesOnline = document.querySelector("#system-services-online");
const systemAlertCount = document.querySelector("#system-alert-count");
const systemBodyUptime = document.querySelector("#system-body-uptime");
const systemSummary = document.querySelector("#system-summary");
const systemdUnitTotal = document.querySelector("#systemd-unit-total");
const systemdUnitActive = document.querySelector("#systemd-unit-active");
const systemdUnitObserved = document.querySelector("#systemd-unit-observed");
const systemdUnitMode = document.querySelector("#systemd-unit-mode");
const systemdUnitJson = document.querySelector("#systemd-unit-json");
const systemdRepairPlanTarget = document.querySelector("#systemd-repair-plan-target");
const systemdRepairPlanRisk = document.querySelector("#systemd-repair-plan-risk");
const systemdRepairPlanMode = document.querySelector("#systemd-repair-plan-mode");
const systemdRepairDryRunMode = document.querySelector("#systemd-repair-dry-run-mode");
const systemdRepairPlanJson = document.querySelector("#systemd-repair-plan-json");
const systemdRepairDryRunJson = document.querySelector("#systemd-repair-dry-run-json");
const healCount = document.querySelector("#heal-count");
const healSummary = document.querySelector("#heal-summary");
const maintenancePolicyEnabled = document.querySelector("#maintenance-policy-enabled");
const maintenanceNextDue = document.querySelector("#maintenance-next-due");
const maintenanceLastTick = document.querySelector("#maintenance-last-tick");
const maintenanceRunCount = document.querySelector("#maintenance-run-count");
const maintenanceSummary = document.querySelector("#maintenance-summary");
const auditTotal = document.querySelector("#audit-total");
const auditTypeCount = document.querySelector("#audit-type-count");
const auditSourceCount = document.querySelector("#audit-source-count");
const auditSummary = document.querySelector("#audit-summary");
const createTaskButton = document.querySelector("#create-task-button");
const createPlannedTaskButton = document.querySelector("#create-planned-task-button");
const operatorStepButton = document.querySelector("#operator-step-button");
const operatorRunButton = document.querySelector("#operator-run-button");
const recoverLatestTaskButton = document.querySelector("#recover-latest-task-button");
const recoverLatestFailedTaskButton = document.querySelector("#recover-latest-failed-task-button");
const loadHistoryButton = document.querySelector("#load-history-button");
const followActiveUrlButton = document.querySelector("#follow-active-url-button");
const loadCurrentTaskButton = document.querySelector("#load-current-task-button");
const loadLatestFailedTaskButton = document.querySelector("#load-latest-failed-task-button");
const loadSelectedTaskButton = document.querySelector("#load-selected-task-button");
const recoverSelectedTaskButton = document.querySelector("#recover-selected-task-button");
const useDetailUrlButton = document.querySelector("#use-detail-url-button");
const prepareWorkViewButton = document.querySelector("#prepare-work-view-button");
const revealWorkViewButton = document.querySelector("#reveal-work-view-button");
const hideWorkViewButton = document.querySelector("#hide-work-view-button");
const refreshScreenButton = document.querySelector("#refresh-screen-button");
const clickActionButton = document.querySelector("#click-action-button");
const typeActionButton = document.querySelector("#type-action-button");
const healBrowserButton = document.querySelector("#heal-browser-button");
const runMaintenanceButton = document.querySelector("#run-maintenance-button");
const completeTaskButton = document.querySelector("#complete-task-button");
const pauseButton = document.querySelector("#pause-button");
const resumeButton = document.querySelector("#resume-button");
const stopButton = document.querySelector("#stop-button");
const openWorkViewUrlButton = document.querySelector("#open-work-view-url-button");
const workViewUrlInput = document.querySelector("#work-view-url-input");
const taskPlanStatus = document.querySelector("#task-plan-status");
const taskPlanCount = document.querySelector("#task-plan-count");
const taskPlanPlanner = document.querySelector("#task-plan-planner");
const taskPlanCapabilityCount = document.querySelector("#task-plan-capability-count");
const taskPlanApprovalGates = document.querySelector("#task-plan-approval-gates");
const taskPlanJson = document.querySelector("#task-plan-json");
const operatorLoopStatus = document.querySelector("#operator-loop-status");
const operatorLoopBlocked = document.querySelector("#operator-loop-blocked");
const operatorLoopNext = document.querySelector("#operator-loop-next");
const operatorLoopRan = document.querySelector("#operator-loop-ran");
const operatorLoopCount = document.querySelector("#operator-loop-count");
const operatorLoopJson = document.querySelector("#operator-loop-json");
const commandTranscriptCount = document.querySelector("#command-transcript-count");
const commandTranscriptExecuted = document.querySelector("#command-transcript-executed");
const commandTranscriptSkipped = document.querySelector("#command-transcript-skipped");
const commandTranscriptFailed = document.querySelector("#command-transcript-failed");
const commandTranscriptJson = document.querySelector("#command-transcript-json");
const policyEngine = document.querySelector("#policy-engine");
const policyDecision = document.querySelector("#policy-decision");
const policyDomain = document.querySelector("#policy-domain");
const policyAuditCount = document.querySelector("#policy-audit-count");
const policyJson = document.querySelector("#policy-json");
const approvalPendingCount = document.querySelector("#approval-pending-count");
const approvalLatest = document.querySelector("#approval-latest");
const approvalJson = document.querySelector("#approval-json");
const approveLatestButton = document.querySelector("#approve-latest-button");
const denyLatestButton = document.querySelector("#deny-latest-button");
const capabilityRegistry = document.querySelector("#capability-registry");
const capabilityOnline = document.querySelector("#capability-online");
const capabilityApproval = document.querySelector("#capability-approval");
const capabilityJson = document.querySelector("#capability-json");
const capabilityInvokeJson = document.querySelector("#capability-invoke-json");
const invokeVitalsButton = document.querySelector("#invoke-vitals-button");
const invokeProcessButton = document.querySelector("#invoke-process-button");
const invokeCommandDryRunButton = document.querySelector("#invoke-command-dry-run-button");
const invokeApprovedCommandDryRunButton = document.querySelector("#invoke-approved-command-dry-run-button");
const capabilityHistoryTotal = document.querySelector("#capability-history-total");
const capabilityHistoryInvoked = document.querySelector("#capability-history-invoked");
const capabilityHistoryBlocked = document.querySelector("#capability-history-blocked");
const capabilityHistoryLatest = document.querySelector("#capability-history-latest");
const capabilityHistoryJson = document.querySelector("#capability-history-json");
const commandLedgerTotal = document.querySelector("#command-ledger-total");
const commandLedgerExecuted = document.querySelector("#command-ledger-executed");
const commandLedgerFailed = document.querySelector("#command-ledger-failed");
const commandLedgerSkipped = document.querySelector("#command-ledger-skipped");
const commandLedgerTasks = document.querySelector("#command-ledger-tasks");
const commandLedgerJson = document.querySelector("#command-ledger-json");
const filesystemLedgerTotal = document.querySelector("#filesystem-ledger-total");
const filesystemLedgerMkdir = document.querySelector("#filesystem-ledger-mkdir");
const filesystemLedgerWrites = document.querySelector("#filesystem-ledger-writes");
const filesystemLedgerTasks = document.querySelector("#filesystem-ledger-tasks");
const filesystemLedgerJson = document.querySelector("#filesystem-ledger-json");
const filesystemReadLedgerTotal = document.querySelector("#filesystem-read-ledger-total");
const filesystemReadLedgerMetadata = document.querySelector("#filesystem-read-ledger-metadata");
const filesystemReadLedgerQuery = document.querySelector("#filesystem-read-ledger-query");
const filesystemReadLedgerReadText = document.querySelector("#filesystem-read-ledger-read-text");
const filesystemReadLedgerTasks = document.querySelector("#filesystem-read-ledger-tasks");
const filesystemReadLedgerJson = document.querySelector("#filesystem-read-ledger-json");
const workspaceRegistry = document.querySelector("#workspace-registry");
const workspaceDetected = document.querySelector("#workspace-detected");
const workspaceMissing = document.querySelector("#workspace-missing");
const workspaceNode = document.querySelector("#workspace-node");
const workspaceMode = document.querySelector("#workspace-mode");
const workspaceJson = document.querySelector("#workspace-json");
const workspaceMigrationRegistry = document.querySelector("#workspace-migration-registry");
const workspaceMigrationTotal = document.querySelector("#workspace-migration-total");
const workspaceMigrationCapabilities = document.querySelector("#workspace-migration-capabilities");
const workspaceMigrationHigh = document.querySelector("#workspace-migration-high");
const workspaceMigrationMode = document.querySelector("#workspace-migration-mode");
const workspaceMigrationJson = document.querySelector("#workspace-migration-json");
const workspaceMigrationPlanRegistry = document.querySelector("#workspace-migration-plan-registry");
const workspaceMigrationPlanTotal = document.querySelector("#workspace-migration-plan-total");
const workspaceMigrationPlanCandidates = document.querySelector("#workspace-migration-plan-candidates");
const workspaceMigrationPlanBacklog = document.querySelector("#workspace-migration-plan-backlog");
const workspaceMigrationPlanMode = document.querySelector("#workspace-migration-plan-mode");
const workspaceMigrationPlanJson = document.querySelector("#workspace-migration-plan-json");
const pluginSdkReviewRegistry = document.querySelector("#plugin-sdk-review-registry");
const pluginSdkReviewTotal = document.querySelector("#plugin-sdk-review-total");
const pluginSdkReviewManifest = document.querySelector("#plugin-sdk-review-manifest");
const pluginSdkReviewTypes = document.querySelector("#plugin-sdk-review-types");
const pluginSdkReviewExports = document.querySelector("#plugin-sdk-review-exports");
const pluginSdkReviewMode = document.querySelector("#plugin-sdk-review-mode");
const pluginSdkReviewJson = document.querySelector("#plugin-sdk-review-json");
const pluginSdkSourceScopeRegistry = document.querySelector("#plugin-sdk-source-scope-registry");
const pluginSdkSourceScopeTotal = document.querySelector("#plugin-sdk-source-scope-total");
const pluginSdkSourceScopeContent = document.querySelector("#plugin-sdk-source-scope-content");
const pluginSdkSourceScopeApproval = document.querySelector("#plugin-sdk-source-scope-approval");
const pluginSdkSourceScopeMode = document.querySelector("#plugin-sdk-source-scope-mode");
const pluginSdkSourceScopeJson = document.querySelector("#plugin-sdk-source-scope-json");
const pluginSdkSourceContentRegistry = document.querySelector("#plugin-sdk-source-content-registry");
const pluginSdkSourceContentRead = document.querySelector("#plugin-sdk-source-content-read");
const pluginSdkSourceContentExports = document.querySelector("#plugin-sdk-source-content-exports");
const pluginSdkSourceContentRaw = document.querySelector("#plugin-sdk-source-content-raw");
const pluginSdkSourceContentMode = document.querySelector("#plugin-sdk-source-content-mode");
const pluginSdkSourceContentJson = document.querySelector("#plugin-sdk-source-content-json");
const pluginSdkNativeTestsRegistry = document.querySelector("#plugin-sdk-native-tests-registry");
const pluginSdkNativeTestsRequired = document.querySelector("#plugin-sdk-native-tests-required");
const pluginSdkNativeTestsSource = document.querySelector("#plugin-sdk-native-tests-source");
const pluginSdkNativeTestsCaps = document.querySelector("#plugin-sdk-native-tests-caps");
const pluginSdkNativeTestsMode = document.querySelector("#plugin-sdk-native-tests-mode");
const pluginSdkNativeTestsJson = document.querySelector("#plugin-sdk-native-tests-json");
const nativeSdkImplementationRegistry = document.querySelector("#native-sdk-implementation-registry");
const nativeSdkImplementationSlots = document.querySelector("#native-sdk-implementation-slots");
const nativeSdkImplementationReadOnly = document.querySelector("#native-sdk-implementation-readonly");
const nativeSdkImplementationExecutable = document.querySelector("#native-sdk-implementation-executable");
const nativeSdkImplementationMode = document.querySelector("#native-sdk-implementation-mode");
const nativeSdkImplementationJson = document.querySelector("#native-sdk-implementation-json");
const openclawToolCatalogRegistry = document.querySelector("#openclaw-tool-catalog-registry");
const openclawToolCatalogTools = document.querySelector("#openclaw-tool-catalog-tools");
const openclawToolCatalogDocs = document.querySelector("#openclaw-tool-catalog-docs");
const openclawToolCatalogCategories = document.querySelector("#openclaw-tool-catalog-categories");
const openclawToolCatalogMode = document.querySelector("#openclaw-tool-catalog-mode");
const openclawToolCatalogJson = document.querySelector("#openclaw-tool-catalog-json");
const pluginManifestMapRegistry = document.querySelector("#plugin-manifest-map-registry");
const pluginManifestMapManifests = document.querySelector("#plugin-manifest-map-manifests");
const pluginManifestMapCategories = document.querySelector("#plugin-manifest-map-categories");
const pluginManifestMapAuth = document.querySelector("#plugin-manifest-map-auth");
const pluginManifestMapMode = document.querySelector("#plugin-manifest-map-mode");
const pluginManifestMapJson = document.querySelector("#plugin-manifest-map-json");
const pluginCapabilityPlanRegistry = document.querySelector("#plugin-capability-plan-registry");
const pluginCapabilityPlanCandidates = document.querySelector("#plugin-capability-plan-candidates");
const pluginCapabilityPlanBlocked = document.querySelector("#plugin-capability-plan-blocked");
const pluginCapabilityPlanApproval = document.querySelector("#plugin-capability-plan-approval");
const pluginCapabilityPlanRuntime = document.querySelector("#plugin-capability-plan-runtime");
const pluginCapabilityPlanJson = document.querySelector("#plugin-capability-plan-json");
const pluginCandidateContractTestsRegistry = document.querySelector("#plugin-candidate-contract-tests-registry");
const pluginCandidateContractTestsCategory = document.querySelector("#plugin-candidate-contract-tests-category");
const pluginCandidateContractTestsRequired = document.querySelector("#plugin-candidate-contract-tests-required");
const pluginCandidateContractTestsContracts = document.querySelector("#plugin-candidate-contract-tests-contracts");
const pluginCandidateContractTestsRuntime = document.querySelector("#plugin-candidate-contract-tests-runtime");
const pluginCandidateContractTestsJson = document.querySelector("#plugin-candidate-contract-tests-json");
const pluginSearchWebContractRegistry = document.querySelector("#plugin-search-web-contract-registry");
const pluginSearchWebContractProviders = document.querySelector("#plugin-search-web-contract-providers");
const pluginSearchWebContractRequired = document.querySelector("#plugin-search-web-contract-required");
const pluginSearchWebContractNetwork = document.querySelector("#plugin-search-web-contract-network");
const pluginSearchWebContractRuntime = document.querySelector("#plugin-search-web-contract-runtime");
const pluginSearchWebContractJson = document.querySelector("#plugin-search-web-contract-json");
const pluginSearchWebTaskButton = document.querySelector("#plugin-search-web-task-button");
const pluginSearchWebPreflightRegistry = document.querySelector("#plugin-search-web-preflight-registry");
const pluginSearchWebPreflightEnvelope = document.querySelector("#plugin-search-web-preflight-envelope");
const pluginSearchWebPreflightApproval = document.querySelector("#plugin-search-web-preflight-approval");
const pluginSearchWebPreflightNetwork = document.querySelector("#plugin-search-web-preflight-network");
const pluginSearchWebPreflightRuntime = document.querySelector("#plugin-search-web-preflight-runtime");
const pluginSearchWebPreflightJson = document.querySelector("#plugin-search-web-preflight-json");
const pluginSearchWebActivationRegistry = document.querySelector("#plugin-search-web-activation-registry");
const pluginSearchWebActivationStatus = document.querySelector("#plugin-search-web-activation-status");
const pluginSearchWebActivationRequired = document.querySelector("#plugin-search-web-activation-required");
const pluginSearchWebActivationNetwork = document.querySelector("#plugin-search-web-activation-network");
const pluginSearchWebActivationRuntime = document.querySelector("#plugin-search-web-activation-runtime");
const pluginSearchWebActivationJson = document.querySelector("#plugin-search-web-activation-json");
const pluginSearchWebActivationTaskButton = document.querySelector("#plugin-search-web-activation-task-button");
const pluginSearchWebSandboxRegistry = document.querySelector("#plugin-search-web-sandbox-registry");
const pluginSearchWebSandboxStatus = document.querySelector("#plugin-search-web-sandbox-status");
const pluginSearchWebSandboxRequired = document.querySelector("#plugin-search-web-sandbox-required");
const pluginSearchWebSandboxNetwork = document.querySelector("#plugin-search-web-sandbox-network");
const pluginSearchWebSandboxRuntime = document.querySelector("#plugin-search-web-sandbox-runtime");
const pluginSearchWebSandboxJson = document.querySelector("#plugin-search-web-sandbox-json");
const pluginSearchWebSandboxTaskButton = document.querySelector("#plugin-search-web-sandbox-task-button");
const toolCatalogAdapterRegistry = document.querySelector("#tool-catalog-adapter-registry");
const toolCatalogAdapterMatches = document.querySelector("#tool-catalog-adapter-matches");
const toolCatalogAdapterCategories = document.querySelector("#tool-catalog-adapter-categories");
const toolCatalogAdapterExecution = document.querySelector("#tool-catalog-adapter-execution");
const toolCatalogAdapterMode = document.querySelector("#tool-catalog-adapter-mode");
const toolCatalogAdapterJson = document.querySelector("#tool-catalog-adapter-json");
const semanticIndexRegistry = document.querySelector("#semantic-index-registry");
const semanticIndexFiles = document.querySelector("#semantic-index-files");
const semanticIndexExports = document.querySelector("#semantic-index-exports");
const semanticIndexSource = document.querySelector("#semantic-index-source");
const semanticIndexMode = document.querySelector("#semantic-index-mode");
const semanticIndexJson = document.querySelector("#semantic-index-json");
const symbolLookupRegistry = document.querySelector("#symbol-lookup-registry");
const symbolLookupMatches = document.querySelector("#symbol-lookup-matches");
const symbolLookupFiles = document.querySelector("#symbol-lookup-files");
const symbolLookupExecution = document.querySelector("#symbol-lookup-execution");
const symbolLookupMode = document.querySelector("#symbol-lookup-mode");
const symbolLookupJson = document.querySelector("#symbol-lookup-json");
const editTargetSelectionRegistry = document.querySelector("#edit-target-selection-registry");
const editTargetSelectionCandidates = document.querySelector("#edit-target-selection-candidates");
const editTargetSelectionSelected = document.querySelector("#edit-target-selection-selected");
const editTargetSelectionSource = document.querySelector("#edit-target-selection-source");
const editTargetSelectionMode = document.querySelector("#edit-target-selection-mode");
const editTargetSelectionJson = document.querySelector("#edit-target-selection-json");
const promptSemanticsRegistry = document.querySelector("#prompt-semantics-registry");
const promptSemanticsFiles = document.querySelector("#prompt-semantics-files");
const promptSemanticsChecks = document.querySelector("#prompt-semantics-checks");
const promptSemanticsContent = document.querySelector("#prompt-semantics-content");
const promptSemanticsMode = document.querySelector("#prompt-semantics-mode");
const promptSemanticsJson = document.querySelector("#prompt-semantics-json");
const workspaceTextWriteRegistry = document.querySelector("#workspace-text-write-registry");
const workspaceTextWriteCapability = document.querySelector("#workspace-text-write-capability");
const workspaceTextWriteApproval = document.querySelector("#workspace-text-write-approval");
const workspaceTextWriteContent = document.querySelector("#workspace-text-write-content");
const workspaceTextWriteMode = document.querySelector("#workspace-text-write-mode");
const workspaceTextWriteJson = document.querySelector("#workspace-text-write-json");
const workspaceTextWriteTaskButton = document.querySelector("#workspace-text-write-task-button");
const workspacePatchApplyRegistry = document.querySelector("#workspace-patch-apply-registry");
const workspacePatchApplyCapability = document.querySelector("#workspace-patch-apply-capability");
const workspacePatchApplyApproval = document.querySelector("#workspace-patch-apply-approval");
const workspacePatchApplyPreview = document.querySelector("#workspace-patch-apply-preview");
const workspacePatchApplyMode = document.querySelector("#workspace-patch-apply-mode");
const workspacePatchApplyJson = document.querySelector("#workspace-patch-apply-json");
const workspacePatchApplyTaskButton = document.querySelector("#workspace-patch-apply-task-button");
const sourceAuthoredEditTaskButton = document.querySelector("#source-authored-edit-task-button");
const nativePluginContractRegistry = document.querySelector("#native-plugin-contract-registry");
const nativePluginContractOwner = document.querySelector("#native-plugin-contract-owner");
const nativePluginContractTotal = document.querySelector("#native-plugin-contract-total");
const nativePluginContractApproval = document.querySelector("#native-plugin-contract-approval");
const nativePluginContractMutation = document.querySelector("#native-plugin-contract-mutation");
const nativePluginContractValidation = document.querySelector("#native-plugin-contract-validation");
const nativePluginContractJson = document.querySelector("#native-plugin-contract-json");
const nativePluginRegistryId = document.querySelector("#native-plugin-registry-id");
const nativePluginRegistryTotal = document.querySelector("#native-plugin-registry-total");
const nativePluginRegistryCapabilities = document.querySelector("#native-plugin-registry-capabilities");
const nativePluginRegistryActivation = document.querySelector("#native-plugin-registry-activation");
const nativePluginRegistryValidation = document.querySelector("#native-plugin-registry-validation");
const nativePluginRegistryJson = document.querySelector("#native-plugin-registry-json");
const integrationReadinessRegistry = document.querySelector("#integration-readiness-registry");
const integrationReadinessStatus = document.querySelector("#integration-readiness-status");
const integrationReadinessRequired = document.querySelector("#integration-readiness-required");
const integrationReadinessRuntime = document.querySelector("#integration-readiness-runtime");
const integrationReadinessMode = document.querySelector("#integration-readiness-mode");
const integrationReadinessJson = document.querySelector("#integration-readiness-json");
const nativePluginAdapterRegistry = document.querySelector("#native-plugin-adapter-registry");
const nativePluginAdapterStatus = document.querySelector("#native-plugin-adapter-status");
const nativePluginAdapterImplemented = document.querySelector("#native-plugin-adapter-implemented");
const nativePluginAdapterRuntime = document.querySelector("#native-plugin-adapter-runtime");
const nativePluginAdapterMode = document.querySelector("#native-plugin-adapter-mode");
const nativePluginAdapterJson = document.querySelector("#native-plugin-adapter-json");
const nativePluginPreflightRegistry = document.querySelector("#native-plugin-preflight-registry");
const nativePluginPreflightEnvelope = document.querySelector("#native-plugin-preflight-envelope");
const nativePluginPreflightApproval = document.querySelector("#native-plugin-preflight-approval");
const nativePluginPreflightRuntime = document.querySelector("#native-plugin-preflight-runtime");
const nativePluginPreflightMode = document.querySelector("#native-plugin-preflight-mode");
const nativePluginPreflightJson = document.querySelector("#native-plugin-preflight-json");
const nativePluginActivationRegistry = document.querySelector("#native-plugin-activation-registry");
const nativePluginActivationStatus = document.querySelector("#native-plugin-activation-status");
const nativePluginActivationRequired = document.querySelector("#native-plugin-activation-required");
const nativePluginActivationRuntime = document.querySelector("#native-plugin-activation-runtime");
const nativePluginActivationMode = document.querySelector("#native-plugin-activation-mode");
const nativePluginActivationJson = document.querySelector("#native-plugin-activation-json");
const nativePluginActivationTaskButton = document.querySelector("#native-plugin-activation-task-button");
const nativePluginRuntimeContractRegistry = document.querySelector("#native-plugin-runtime-contract-registry");
const nativePluginRuntimeContractStatus = document.querySelector("#native-plugin-runtime-contract-status");
const nativePluginRuntimeContractRequired = document.querySelector("#native-plugin-runtime-contract-required");
const nativePluginRuntimeContractRuntime = document.querySelector("#native-plugin-runtime-contract-runtime");
const nativePluginRuntimeContractMode = document.querySelector("#native-plugin-runtime-contract-mode");
const nativePluginRuntimeContractJson = document.querySelector("#native-plugin-runtime-contract-json");
const nativePluginRuntimeAdapterTaskButton = document.querySelector("#native-plugin-runtime-adapter-task-button");
const nativePluginInvokePlanRegistry = document.querySelector("#native-plugin-invoke-plan-registry");
const nativePluginInvokePlanCapability = document.querySelector("#native-plugin-invoke-plan-capability");
const nativePluginInvokePlanDecision = document.querySelector("#native-plugin-invoke-plan-decision");
const nativePluginInvokePlanRuntime = document.querySelector("#native-plugin-invoke-plan-runtime");
const nativePluginInvokePlanMode = document.querySelector("#native-plugin-invoke-plan-mode");
const nativePluginInvokePlanJson = document.querySelector("#native-plugin-invoke-plan-json");
const nativePluginInvokeTaskButton = document.querySelector("#native-plugin-invoke-task-button");
const workspaceCommandRegistry = document.querySelector("#workspace-command-registry");
const workspaceCommandTotal = document.querySelector("#workspace-command-total");
const workspaceCommandValidation = document.querySelector("#workspace-command-validation");
const workspaceCommandBuild = document.querySelector("#workspace-command-build");
const workspaceCommandRuntime = document.querySelector("#workspace-command-runtime");
const workspaceCommandMode = document.querySelector("#workspace-command-mode");
const workspaceCommandJson = document.querySelector("#workspace-command-json");
const sourceCommandRegistry = document.querySelector("#source-command-registry");
const sourceCommandTotal = document.querySelector("#source-command-total");
const sourceCommandTools = document.querySelector("#source-command-tools");
const sourceCommandPrompts = document.querySelector("#source-command-prompts");
const sourceCommandMode = document.querySelector("#source-command-mode");
const sourceCommandJson = document.querySelector("#source-command-json");
const sourceCommandPlanRegistry = document.querySelector("#source-command-plan-registry");
const sourceCommandPlanProposal = document.querySelector("#source-command-plan-proposal");
const sourceCommandPlanDecision = document.querySelector("#source-command-plan-decision");
const sourceCommandPlanTask = document.querySelector("#source-command-plan-task");
const sourceCommandPlanMode = document.querySelector("#source-command-plan-mode");
const sourceCommandPlanJson = document.querySelector("#source-command-plan-json");
const sourceCommandTaskButton = document.querySelector("#source-command-task-button");
const workspaceCommandPlanRegistry = document.querySelector("#workspace-command-plan-registry");
const workspaceCommandPlanProposal = document.querySelector("#workspace-command-plan-proposal");
const workspaceCommandPlanDecision = document.querySelector("#workspace-command-plan-decision");
const workspaceCommandPlanApproval = document.querySelector("#workspace-command-plan-approval");
const workspaceCommandPlanTask = document.querySelector("#workspace-command-plan-task");
const workspaceCommandPlanMode = document.querySelector("#workspace-command-plan-mode");
const workspaceCommandPlanJson = document.querySelector("#workspace-command-plan-json");
const workspaceCommandTaskButton = document.querySelector("#workspace-command-task-button");
let currentTaskState = null;
let latestActionState = null;
let latestHistoryTask = null;
let selectedHistoryTaskId = null;
let recentTasksState = [];
let latestTaskSummary = null;
let desiredWorkViewUrl = workViewUrlInput.value.trim() || "https://example.com/work-view";
let desiredWorkViewUrlPinned = false;
let latestWorkViewState = null;
let latestPendingApproval = null;
let taskHistoryFocus = "latest-finished";

function setHealthPill(target, ok, text) {
  target.textContent = text;
  target.className = ok ? "status-pill" : "status-pill warn";
}

function formatTimestamp(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function formatTaskFocusLabel(focus, task = null) {
  if (focus === "current-task") {
    return task?.id ? \`Viewing current task \${task.id}.\` : "Viewing current task.";
  }
  if (focus === "latest-failed") {
    return task?.id ? \`Viewing latest failed task \${task.id}.\` : "Viewing latest failed task.";
  }
  if (focus === "selected-task") {
    return task?.id ? \`Viewing selected task \${task.id}.\` : "Viewing selected task.";
  }
  return task?.id ? \`Viewing latest finished task \${task.id}.\` : "Viewing latest finished task.";
}

function setControlMessage(message) {
  controlResult.textContent = message;
}

function updateDesiredUrlHint(activeUrl = null) {
  const hintTail = activeUrl ? \`Current active URL: \${activeUrl}\` : "Current active URL: none";
  workViewUrlHint.textContent = desiredWorkViewUrlPinned
    ? \`Pinned desired URL for the next action. \${hintTail}\`
    : \`Desired URL follows the active work view until you pin a new one. \${hintTail}\`;
}

function setDesiredWorkViewUrl(url, { pinned = true } = {}) {
  const nextUrl = typeof url === "string" && url.trim() ? url.trim() : "https://example.com/work-view";
  desiredWorkViewUrl = nextUrl;
  desiredWorkViewUrlPinned = pinned;
  workViewUrlInput.value = nextUrl;
}

function followActiveWorkViewUrl() {
  const nextUrl = latestWorkViewState?.activeUrl ?? latestWorkViewState?.entryUrl ?? "https://example.com/work-view";
  setDesiredWorkViewUrl(nextUrl, { pinned: false });
  updateDesiredUrlHint(latestWorkViewState?.activeUrl ?? latestWorkViewState?.entryUrl ?? null);
  setControlMessage(\`Following active work view URL: \${nextUrl}\`);
}

function deriveTaskLastAction(task) {
  if (task?.lastAction) {
    return task.lastAction;
  }

  const fallback = latestActionState?.lastAction ?? null;
  if (!fallback) {
    return null;
  }

  const taskSessionId = task?.workView?.sessionId ?? null;
  const actionSessionId = fallback.screenContext?.sessionId ?? null;

  if (taskSessionId && actionSessionId && taskSessionId === actionSessionId) {
    return {
      kind: fallback.kind ?? "unknown",
      degraded: Boolean(fallback.degraded),
      at: fallback.executedAt ?? null,
      result: fallback.result ?? null,
    };
  }

  return null;
}

function renderTaskPlan(plan) {
  if (!plan) {
    return "No task plan selected.";
  }

  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const capabilitySummary = plan.capabilitySummary ?? {};
  return [
    \`Plan ID: \${plan.planId ?? "none"}\`,
    \`Strategy: \${plan.strategy ?? "unknown"}\`,
    \`Planner: \${plan.planner ?? "unknown"}\`,
    \`Status: \${plan.status ?? "unknown"}\`,
    \`Intent: \${plan.intent ?? "unknown"}\`,
    \`Target URL: \${plan.targetUrl ?? "none"}\`,
    \`Steps: \${steps.length}\`,
    \`Capabilities: \${capabilitySummary.total ?? 0} (\${(capabilitySummary.ids ?? []).join(", ") || "none"})\`,
    \`Approval Gates: \${capabilitySummary.approvalGates ?? 0}\`,
    "",
    ...steps.map((step, index) => {
      const status = step.status ?? "pending";
      const title = step.title ?? step.kind ?? step.phase ?? \`step \${index + 1}\`;
      const phase = step.phase ?? "unknown";
      const capability = step.capabilityId ?? "unmapped";
      const risk = step.risk ?? "unknown";
      const governance = step.governance ?? "unknown";
      const approval = step.requiresApproval ? " approval-required" : "";
      return \`\${index + 1}. [\${status}] \${phase} - \${title} :: capability=\${capability} risk=\${risk} governance=\${governance}\${approval}\`;
    }),
  ].join("\\n");
}

function renderPlanPanel(task) {
  const plan = task?.plan ?? null;
  const steps = Array.isArray(plan?.steps) ? plan.steps : [];
  taskPlanStatus.textContent = plan?.status ?? "none";
  taskPlanCount.textContent = String(steps.length);
  taskPlanPlanner.textContent = plan?.planner ?? plan?.strategy ?? "none";
  taskPlanCapabilityCount.textContent = String(plan?.capabilitySummary?.total ?? 0);
  taskPlanApprovalGates.textContent = String(plan?.capabilitySummary?.approvalGates ?? 0);
  taskPlanJson.textContent = renderTaskPlan(plan);
}

function renderOperatorState(operator) {
  const nextTask = operator?.nextTask ?? null;
  operatorLoopStatus.textContent = operator?.status ?? "idle";
  operatorLoopBlocked.textContent = String(operator?.blocked ?? false);
  operatorLoopNext.textContent = nextTask?.id ? nextTask.id.slice(0, 8) : "none";
}

function renderPolicyState(policy) {
  const lastDecision = Array.isArray(policy?.decisions) ? policy.decisions[0] : null;
  policyEngine.textContent = policy?.engine ?? "policy-v0";
  policyDecision.textContent = lastDecision?.decision ?? "none";
  policyDomain.textContent = lastDecision?.domain ?? "none";
  policyAuditCount.textContent = String(policy?.counts?.total ?? 0);
  policyJson.textContent = [
    \`Mode: \${policy?.mode ?? "unknown"}\`,
    \`Body Internal Default: \${policy?.rules?.bodyInternalDefault ?? "unknown"}\`,
    \`User Task Default: \${policy?.rules?.userTaskDefault ?? "unknown"}\`,
    \`Cross Boundary Default: \${policy?.rules?.crossBoundaryDefault ?? "unknown"}\`,
    \`Decisions: \${policy?.counts?.total ?? 0}\`,
    "",
    ...(policy?.decisions ?? []).slice(0, 6).map((decision) => {
      return \`[\${formatTimestamp(decision.at)}] \${decision.decision} \${decision.domain} \${decision.subject?.intent ?? "unknown"} - \${decision.reason}\`;
    }),
  ].join("\\n");
}

function renderApprovalState(data) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const pendingItems = items.filter((approval) => approval.status === "pending");
  latestPendingApproval = pendingItems[0] ?? null;
  approvalPendingCount.textContent = String(data?.summary?.pendingCount ?? pendingItems.length);
  approvalLatest.textContent = latestPendingApproval?.id ? latestPendingApproval.id.slice(0, 8) : "none";
  approvalJson.textContent = [
    \`Total: \${data?.summary?.counts?.total ?? 0}\`,
    \`Pending: \${data?.summary?.counts?.pending ?? 0}\`,
    \`Approved: \${data?.summary?.counts?.approved ?? 0}\`,
    \`Denied: \${data?.summary?.counts?.denied ?? 0}\`,
    "",
    ...items.slice(0, 6).map((approval) => {
      return \`[\${approval.status}] \${approval.id} task=\${approval.taskId ?? "none"} \${approval.intent ?? "unknown"} risk=\${approval.risk ?? "unknown"} reason=\${approval.reason ?? "none"}\`;
    }),
  ].join("\\n");
}

function renderCapabilityState(registry) {
  const capabilities = Array.isArray(registry?.capabilities) ? registry.capabilities : [];
  const summary = registry?.summary ?? {};
  const topCapabilities = capabilities
    .slice()
    .sort((left, right) => String(left.kind).localeCompare(String(right.kind)) || String(left.id).localeCompare(String(right.id)))
    .slice(0, 8);

  capabilityRegistry.textContent = registry?.registry ?? "capability-v0";
  capabilityOnline.textContent = \`\${summary.online ?? 0}/\${summary.total ?? 0}\`;
  capabilityApproval.textContent = String(summary.requiresApproval ?? 0);
  capabilityJson.textContent = [
    \`Mode: \${registry?.mode ?? "unknown"}\`,
    \`Kinds: \${Object.entries(summary.byKind ?? {}).map(([kind, count]) => \`\${kind}=\${count}\`).join(", ") || "none"}\`,
    \`Risks: \${Object.entries(summary.byRisk ?? {}).map(([risk, count]) => \`\${risk}=\${count}\`).join(", ") || "none"}\`,
    \`Governance: \${Object.entries(summary.byGovernance ?? {}).map(([rule, count]) => \`\${rule}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...topCapabilities.map((capability) => {
      return \`[\${capability.status ?? "unknown"}] \${capability.id} \${capability.kind} \${capability.risk} governance=\${capability.governance}\`;
    }),
  ].join("\\n");
}

function renderCapabilityInvocation(result) {
  if (!result) {
    capabilityInvokeJson.textContent = "No capability invocation yet.";
    return;
  }

  capabilityInvokeJson.textContent = [
    \`Capability: \${result.capability?.id ?? "unknown"}\`,
    \`Invoked: \${Boolean(result.invoked)}\`,
    \`Blocked: \${Boolean(result.blocked)}\`,
    \`Reason: \${result.reason ?? "none"}\`,
    \`Policy: \${result.policy?.decision ?? "none"} / \${result.policy?.domain ?? "unknown"} / risk=\${result.policy?.risk ?? "unknown"}\`,
    \`Summary: \${JSON.stringify(result.summary ?? {}, null, 2)}\`,
  ].join("\\n");
}

function renderCapabilityHistory(data) {
  const summary = data?.summary ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  capabilityHistoryTotal.textContent = String(summary.total ?? 0);
  capabilityHistoryInvoked.textContent = String(summary.invoked ?? 0);
  capabilityHistoryBlocked.textContent = String(summary.blocked ?? 0);
  capabilityHistoryLatest.textContent = summary.latestAt ? formatTimestamp(summary.latestAt) : "none";
  capabilityHistoryJson.textContent = [
    \`Total: \${summary.total ?? 0}\`,
    \`Invoked: \${summary.invoked ?? 0}\`,
    \`Blocked: \${summary.blocked ?? 0}\`,
    \`By Policy: \${Object.entries(summary.byPolicy ?? {}).map(([policy, count]) => \`\${policy}=\${count}\`).join(", ") || "none"}\`,
    \`By Capability: \${Object.entries(summary.byCapability ?? {}).map(([capability, count]) => \`\${capability}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      const state = entry.blocked ? "blocked" : entry.invoked ? "invoked" : "recorded";
      const decision = entry.policy?.decision ?? "unknown";
      const reason = entry.reason ?? entry.policy?.reason ?? "none";
      return \`[\${formatTimestamp(entry.at)}] \${state} \${entry.capability?.id ?? "unknown"} policy=\${decision} reason=\${reason}\`;
    }),
  ].join("\\n");
}

function extractTaskCommandTranscript(task) {
  return Array.isArray(task?.outcome?.details?.commandTranscript)
    ? task.outcome.details.commandTranscript
    : [];
}

function renderCommandTranscript(transcript, { source = "task" } = {}) {
  const entries = Array.isArray(transcript) ? transcript : [];
  const skipped = entries.filter((entry) => entry.skipped === true);
  const executed = entries.filter((entry) => entry.skipped !== true);
  const failed = executed.filter((entry) => entry.timedOut === true || (Number.isInteger(entry.exitCode) && entry.exitCode !== 0));

  commandTranscriptCount.textContent = String(entries.length);
  commandTranscriptExecuted.textContent = String(executed.length);
  commandTranscriptSkipped.textContent = String(skipped.length);
  commandTranscriptFailed.textContent = String(failed.length);

  if (entries.length === 0) {
    commandTranscriptJson.textContent = "No command transcript yet.";
    return;
  }

  commandTranscriptJson.textContent = [
    \`Source: \${source}\`,
    \`Entries: \${entries.length} executed=\${executed.length} skipped=\${skipped.length} failed=\${failed.length}\`,
    "",
    ...entries.map((entry, index) => {
      const state = entry.skipped === true
        ? \`skipped:\${entry.skipReason ?? "condition"}\`
        : entry.timedOut === true
          ? "failed:timeout"
          : Number.isInteger(entry.exitCode) && entry.exitCode !== 0
            ? \`failed:exit_\${entry.exitCode}\`
            : "executed";
      const stdout = String(entry.stdout ?? "").trim();
      const stderr = String(entry.stderr ?? "").trim();
      return [
        \`\${index + 1}. [\${state}] \${entry.command ?? "unknown"} exit=\${entry.exitCode ?? "n/a"}\`,
        stdout ? \`   stdout: \${stdout}\` : null,
        stderr ? \`   stderr: \${stderr}\` : null,
      ].filter(Boolean).join("\\n");
    }),
  ].join("\\n");
}

function renderCommandTranscriptFromTask(task, { source = "task" } = {}) {
  renderCommandTranscript(extractTaskCommandTranscript(task), { source });
}

function renderCommandLedger(data) {
  const summary = data?.summary ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  commandLedgerTotal.textContent = String(summary.total ?? 0);
  commandLedgerExecuted.textContent = String(summary.executed ?? 0);
  commandLedgerFailed.textContent = String(summary.failed ?? 0);
  commandLedgerSkipped.textContent = String(summary.skipped ?? 0);
  commandLedgerTasks.textContent = String(summary.taskCount ?? 0);

  commandLedgerJson.textContent = [
    \`Total: \${summary.total ?? 0}\`,
    \`Executed: \${summary.executed ?? 0}\`,
    \`Failed: \${summary.failed ?? 0}\`,
    \`Skipped: \${summary.skipped ?? 0}\`,
    \`Tasks: \${summary.taskCount ?? 0}\`,
    \`By Command: \${Object.entries(summary.byCommand ?? {}).map(([command, count]) => \`\${command}=\${count}\`).join(", ") || "none"}\`,
    \`By Task Status: \${Object.entries(summary.byTaskStatus ?? {}).map(([status, count]) => \`\${status}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      const state = entry.state ?? (entry.skipped ? "skipped" : "executed");
      const stdout = String(entry.stdout ?? "").trim();
      return \`[\${state}] task=\${entry.taskId ?? "none"} \${entry.command ?? "unknown"} exit=\${entry.exitCode ?? "n/a"} skip=\${entry.skipReason ?? "none"}\${stdout ? \` stdout=\${stdout}\` : ""}\`;
    }),
  ].join("\\n");
}

function renderFilesystemLedger(data) {
  const summary = data?.summary ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  filesystemLedgerTotal.textContent = String(summary.total ?? 0);
  filesystemLedgerMkdir.textContent = String(summary.mkdir ?? 0);
  filesystemLedgerWrites.textContent = String(summary.write_text ?? 0);
  filesystemLedgerTasks.textContent = String(summary.taskCount ?? 0);

  filesystemLedgerJson.textContent = [
    \`Total: \${summary.total ?? 0}\`,
    \`Mkdir: \${summary.mkdir ?? 0}\`,
    \`Writes: \${summary.write_text ?? 0}\`,
    \`Tasks: \${summary.taskCount ?? 0}\`,
    \`By Capability: \${Object.entries(summary.byCapability ?? {}).map(([capability, count]) => \`\${capability}=\${count}\`).join(", ") || "none"}\`,
    \`By Policy: \${Object.entries(summary.byPolicy ?? {}).map(([policy, count]) => \`\${policy}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      return \`[\${entry.change ?? "unknown"}] task=\${entry.taskId ?? "none"} \${entry.path ?? "unknown"} bytes=\${entry.contentBytes ?? "n/a"} created=\${entry.created ?? "n/a"}\`;
    }),
  ].join("\\n");
}

function renderFilesystemReadLedger(data) {
  const summary = data?.summary ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  const queryReads = (summary.list ?? 0) + (summary.search ?? 0);
  filesystemReadLedgerTotal.textContent = String(summary.total ?? 0);
  filesystemReadLedgerMetadata.textContent = String(summary.metadata ?? 0);
  filesystemReadLedgerQuery.textContent = String(queryReads);
  filesystemReadLedgerReadText.textContent = String(summary.read_text ?? 0);
  filesystemReadLedgerTasks.textContent = String(summary.taskCount ?? 0);

  filesystemReadLedgerJson.textContent = [
    "Content: not displayed or stored in the read ledger.",
    \`Total: \${summary.total ?? 0}\`,
    \`Metadata: \${summary.metadata ?? 0}\`,
    \`List: \${summary.list ?? 0}\`,
    \`Search: \${summary.search ?? 0}\`,
    \`Read Text: \${summary.read_text ?? 0}\`,
    \`Tasks: \${summary.taskCount ?? 0}\`,
    \`By Capability: \${Object.entries(summary.byCapability ?? {}).map(([capability, count]) => \`\${capability}=\${count}\`).join(", ") || "none"}\`,
    \`By Policy: \${Object.entries(summary.byPolicy ?? {}).map(([policy, count]) => \`\${policy}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      return \`[\${entry.operation ?? "read"}] task=\${entry.taskId ?? "none"} \${entry.path ?? "unknown"} count=\${entry.count ?? "n/a"} bytes=\${entry.contentBytes ?? "n/a"} encoding=\${entry.encoding ?? "n/a"}\`;
    }),
  ].join("\\n");
}

function renderWorkspaceRegistry(data) {
  const summary = data?.summary ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  workspaceRegistry.textContent = data?.registry ?? "workspace-detect-v0";
  workspaceDetected.textContent = String(summary.detected ?? 0);
  workspaceMissing.textContent = String(summary.missing ?? 0);
  workspaceNode.textContent = String(summary.nodeWorkspaces ?? 0);
  workspaceMode.textContent = data?.mode ?? "read-only";

  workspaceJson.textContent = [
    "Read-only detection: no file contents, mutations, or command execution.",
    \`Registry: \${data?.registry ?? "workspace-detect-v0"}\`,
    \`Mode: \${data?.mode ?? "read-only"}\`,
    \`Total: \${summary.total ?? data?.count ?? 0}\`,
    \`Detected: \${summary.detected ?? 0}\`,
    \`Missing: \${summary.missing ?? 0}\`,
    \`Node Workspaces: \${summary.nodeWorkspaces ?? 0}\`,
    \`By Package Manager: \${Object.entries(summary.byPackageManager ?? {}).map(([manager, count]) => \`\${manager}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      const scripts = Array.isArray(entry.scripts) ? entry.scripts.join(",") : "none";
      const markers = Array.isArray(entry.markers) ? entry.markers.join(",") : "none";
      const governance = entry.governance ?? {};
      return \`[\${entry.kind ?? "workspace"}] \${entry.name ?? entry.id ?? "unknown"} path=\${entry.path ?? "unknown"} packageManager=\${entry.packageManager ?? "unknown"} scripts=\${scripts} markers=\${markers} readContent=\${Boolean(governance.canReadFileContent)} mutate=\${Boolean(governance.canMutate)} execute=\${Boolean(governance.canExecute)}\`;
    }),
  ].join("\\n");
}

function renderWorkspaceMigrationMap(data) {
  const summary = data?.summary ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  workspaceMigrationRegistry.textContent = data?.registry ?? "openclaw-source-migration-map-v0";
  workspaceMigrationTotal.textContent = String(summary.total ?? data?.count ?? 0);
  workspaceMigrationCapabilities.textContent = String(summary.byTargetArea?.capability_registry ?? 0);
  workspaceMigrationHigh.textContent = String(summary.byPriority?.high ?? 0);
  workspaceMigrationMode.textContent = data?.mode ?? "read-only";

  workspaceMigrationJson.textContent = [
    "Read-only migration map: candidates are visible, source file contents stay hidden.",
    "Candidate status is not an import, execution, or mutation grant.",
    \`Registry: \${data?.registry ?? "openclaw-source-migration-map-v0"}\`,
    \`Mode: \${data?.mode ?? "read-only"}\`,
    \`Source Registry: \${data?.sourceRegistry ?? "workspace-detect-v0"}\`,
    \`Total: \${summary.total ?? data?.count ?? 0}\`,
    \`Workspaces: \${summary.workspaces ?? 0}\`,
    \`By Target: \${Object.entries(summary.byTargetArea ?? {}).map(([target, count]) => \`\${target}=\${count}\`).join(", ") || "none"}\`,
    \`By Migration Kind: \${Object.entries(summary.byMigrationKind ?? {}).map(([kind, count]) => \`\${kind}=\${count}\`).join(", ") || "none"}\`,
    \`By Risk: \${Object.entries(summary.byRisk ?? {}).map(([risk, count]) => \`\${risk}=\${count}\`).join(", ") || "none"}\`,
    \`By Priority: \${Object.entries(summary.byPriority ?? {}).map(([priority, count]) => \`\${priority}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      const governance = entry.governance ?? {};
      return \`[\${entry.priority ?? "unknown"}/\${entry.risk ?? "unknown"}] \${entry.capability ?? "capability"} from=\${entry.sourceDomain ?? "unknown"} target=\${entry.targetArea ?? "unknown"} kind=\${entry.migrationKind ?? "unknown"} status=\${entry.readiness ?? "unknown"} readContent=\${Boolean(governance.canReadFileContent)} mutate=\${Boolean(governance.canMutate)} execute=\${Boolean(governance.canExecute)} review=\${Boolean(governance.requiresHumanReview)}\`;
    }),
  ].join("\\n");
}

function renderWorkspaceMigrationPlan(data) {
  const summary = data?.summary ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  const backlog = Array.isArray(data?.backlog) ? data.backlog : [];
  workspaceMigrationPlanRegistry.textContent = data?.registry ?? "openclaw-source-migration-plan-v0";
  workspaceMigrationPlanTotal.textContent = String(summary.total ?? data?.count ?? 0);
  workspaceMigrationPlanCandidates.textContent = String(summary.candidateCount ?? data?.candidateCount ?? 0);
  workspaceMigrationPlanBacklog.textContent = String(summary.backlog ?? backlog.length);
  workspaceMigrationPlanMode.textContent = data?.mode ?? "plan-only";

  workspaceMigrationPlanJson.textContent = [
    "Plan-only migration draft: no task, approval, import, execution, or source read is created.",
    "First wave is a review order, not permission to absorb code.",
    \`Registry: \${data?.registry ?? "openclaw-source-migration-plan-v0"}\`,
    \`Mode: \${data?.mode ?? "plan-only"}\`,
    \`Source Registry: \${data?.sourceRegistry ?? "openclaw-source-migration-map-v0"}\`,
    \`First Wave: \${summary.total ?? data?.count ?? 0}\`,
    \`Candidates: \${summary.candidateCount ?? data?.candidateCount ?? 0}\`,
    \`Backlog: \${summary.backlog ?? backlog.length}\`,
    \`By Target: \${Object.entries(summary.byTargetArea ?? {}).map(([target, count]) => \`\${target}=\${count}\`).join(", ") || "none"}\`,
    \`By Risk: \${Object.entries(summary.byRisk ?? {}).map(([risk, count]) => \`\${risk}=\${count}\`).join(", ") || "none"}\`,
    \`By Priority: \${Object.entries(summary.byPriority ?? {}).map(([priority, count]) => \`\${priority}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      const governance = entry.governance ?? {};
      const blockers = Array.isArray(entry.blockers) ? entry.blockers.join("; ") : "none";
      return \`#\${entry.sequence ?? "?"} [\${entry.priority ?? "unknown"}/\${entry.risk ?? "unknown"}] \${entry.capability ?? "capability"} target=\${entry.targetArea ?? "unknown"} kind=\${entry.migrationKind ?? "unknown"} status=\${entry.status ?? "unknown"} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)} execute=\${Boolean(governance.canExecute)} blockers=\${blockers}\`;
    }),
    "",
    \`Backlog: \${backlog.map((entry) => \`\${entry.capability}(\${entry.priority}/\${entry.risk})\`).join(", ") || "none"}\`,
  ].join("\\n");
}

function renderPluginSdkContractReview(data) {
  const summary = data?.summary ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  pluginSdkReviewRegistry.textContent = data?.registry ?? "openclaw-plugin-sdk-contract-review-v0";
  pluginSdkReviewTotal.textContent = String(summary.total ?? data?.count ?? 0);
  pluginSdkReviewManifest.textContent = String(summary.withManifest ?? 0);
  pluginSdkReviewTypes.textContent = String(summary.withTypes ?? 0);
  pluginSdkReviewExports.textContent = String(summary.withExports ?? 0);
  pluginSdkReviewMode.textContent = data?.mode ?? "read-only";

  pluginSdkReviewJson.textContent = [
    "Read-only contract review: manifest shape and directory markers only.",
    "Source contents, README text, script bodies, dependency versions, tasks, approvals, and executions stay hidden.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-sdk-contract-review-v0"}\`,
    \`Mode: \${data?.mode ?? "read-only"}\`,
    \`Source Registry: \${data?.sourceRegistry ?? "openclaw-source-migration-plan-v0"}\`,
    \`Reviews: \${summary.total ?? data?.count ?? 0}\`,
    \`With Manifest: \${summary.withManifest ?? 0}\`,
    \`With Types: \${summary.withTypes ?? 0}\`,
    \`With Exports: \${summary.withExports ?? 0}\`,
    \`By Verdict: \${Object.entries(summary.byVerdict ?? {}).map(([verdict, count]) => \`\${verdict}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      const manifest = entry.packageManifest ?? {};
      const structure = entry.structure ?? {};
      const governance = entry.governance ?? {};
      const surfaces = Array.isArray(entry.contractSurfaces) ? entry.contractSurfaces.join(",") : "none";
      const blockers = Array.isArray(entry.blockers) ? entry.blockers.join("; ") : "none";
      return \`[\${entry.verdict ?? "unknown"}] \${manifest.name ?? "unknown"} surfaces=\${surfaces} markers=\${(structure.markers ?? []).join(",") || "none"} scripts=\${(manifest.scriptNames ?? []).join(",") || "none"} readSource=\${Boolean(governance.canReadSourceFileContent)} mutate=\${Boolean(governance.canMutate)} execute=\${Boolean(governance.canExecute)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)} blockers=\${blockers}\`;
    }),
  ].join("\\n");
}

function renderPluginSdkSourceReviewScope(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const files = Array.isArray(data?.files) ? data.files : [];
  const gates = Array.isArray(data?.gates) ? data.gates : [];
  pluginSdkSourceScopeRegistry.textContent = data?.registry ?? "openclaw-plugin-sdk-source-review-scope-v0";
  pluginSdkSourceScopeTotal.textContent = String(summary.totalFiles ?? files.length);
  pluginSdkSourceScopeContent.textContent = summary.canReadSourceFileContent ? "allowed" : "blocked";
  pluginSdkSourceScopeApproval.textContent = summary.requiresApprovalBeforeContentRead ? "required" : "not required";
  pluginSdkSourceScopeMode.textContent = data?.mode ?? "scope-plan-only";

  pluginSdkSourceScopeJson.textContent = [
    "Source review scope: file metadata only. Source contents are not read, displayed, imported, or executed.",
    "This is the checklist for a future explicit content-read approval, not the content review itself.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-sdk-source-review-scope-v0"}\`,
    \`Mode: \${data?.mode ?? "scope-plan-only"}\`,
    \`Package: \${data?.package?.name ?? "unknown"}\`,
    \`Files: \${summary.totalFiles ?? files.length}\`,
    \`By Kind: \${Object.entries(summary.byKind ?? {}).map(([kind, count]) => \`\${kind}=\${count}\`).join(", ") || "none"}\`,
    \`Governance: readSource=\${Boolean(governance.canReadSourceFileContent)} importModule=\${Boolean(governance.canImportModule)} executePlugin=\${Boolean(governance.canExecutePluginCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...gates.map((gate) => {
      const required = gate.required ? "required" : "optional";
      return \`[\${gate.status ?? "unknown"}/\${required}] \${gate.id ?? "gate"} :: \${gate.evidence ?? "no evidence"}\`;
    }),
    "",
    ...files.slice(0, 16).map((file) => \`\${file.relativePath ?? "unknown"} kind=\${file.kind ?? "unknown"} size=\${file.sizeBytes ?? "unknown"} contentRead=\${Boolean(file.contentRead)}\`),
  ].join("\\n");
}

function renderPluginSdkSourceContentReview(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const files = Array.isArray(data?.files) ? data.files : [];
  const findings = Array.isArray(data?.findings) ? data.findings : [];
  pluginSdkSourceContentRegistry.textContent = data?.registry ?? "openclaw-plugin-sdk-source-content-review-v0";
  pluginSdkSourceContentRead.textContent = String(summary.contentRead ?? 0);
  pluginSdkSourceContentExports.textContent = String(summary.exportStatements ?? 0);
  pluginSdkSourceContentRaw.textContent = summary.exposesSourceFileContent ? "exposed" : "hidden";
  pluginSdkSourceContentMode.textContent = data?.mode ?? "content-review-derived-signals";

  pluginSdkSourceContentJson.textContent = [
    "Source content review: scoped files are read, but only derived signals are shown.",
    "Raw source text, README contents, script bodies, dependency versions, imports, execution, and runtime activation remain blocked.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-sdk-source-content-review-v0"}\`,
    \`Mode: \${data?.mode ?? "content-review-derived-signals"}\`,
    \`Source Registry: \${data?.sourceRegistry ?? "openclaw-plugin-sdk-source-review-scope-v0"}\`,
    \`Files: total=\${summary.totalFiles ?? files.length} read=\${summary.contentRead ?? 0} skipped=\${summary.skipped ?? 0}\`,
    \`Signals: exports=\${summary.exportStatements ?? 0} imports=\${summary.importStatements ?? 0} interfaces=\${summary.interfaceDeclarations ?? 0} types=\${summary.typeDeclarations ?? 0} functions=\${summary.functionDeclarations ?? 0} classes=\${summary.classDeclarations ?? 0}\`,
    \`Governance: readSource=\${Boolean(governance.canReadSourceFileContent)} exposeSource=\${Boolean(governance.exposesSourceFileContent)} importModule=\${Boolean(governance.canImportModule)} executePlugin=\${Boolean(governance.canExecutePluginCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...findings.map((finding) => \`[\${finding.status ?? "unknown"}] \${finding.id ?? "finding"} :: \${finding.summary ?? "no summary"}\`),
    "",
    ...files.slice(0, 16).map((file) => {
      const signals = file.signals ?? {};
      return \`\${file.relativePath ?? "unknown"} kind=\${file.kind ?? "unknown"} read=\${Boolean(file.contentRead)} exposed=\${Boolean(file.contentExposed)} exports=\${signals.exportStatements ?? 0} interfaces=\${signals.interfaceDeclarations ?? 0} types=\${signals.typeDeclarations ?? 0} recommendation=\${file.recommendedAbsorption ?? "none"}\`;
    }),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderPluginSdkNativeContractTests(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const tests = Array.isArray(data?.tests) ? data.tests : [];
  const mappings = Array.isArray(data?.mappings) ? data.mappings : [];
  const capabilities = Array.isArray(data?.contract?.capabilities) ? data.contract.capabilities : [];
  const sourceSummary = data?.enhancedSource?.summary ?? {};
  pluginSdkNativeTestsRegistry.textContent = data?.registry ?? "openclaw-plugin-sdk-native-contract-tests-v0";
  pluginSdkNativeTestsRequired.textContent = \`\${summary.passedRequired ?? 0}/\${summary.requiredTests ?? 0}\`;
  pluginSdkNativeTestsSource.textContent = String(summary.enhancedSourceFilesRead ?? 0);
  pluginSdkNativeTestsCaps.textContent = String(summary.nativeCapabilities ?? capabilities.length);
  pluginSdkNativeTestsMode.textContent = data?.mode ?? "native-contract-tests";

  pluginSdkNativeTestsJson.textContent = [
    "Native contract tests: derived SDK source signals are checked against OpenClawOnNixOS-owned plugin/capability contracts.",
    "This is a test mapping layer, not runtime activation: old OpenClaw modules are not imported or executed.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-sdk-native-contract-tests-v0"}\`,
    \`Mode: \${data?.mode ?? "native-contract-tests"}\`,
    \`Source Registries: \${(data?.sourceRegistries ?? []).join(", ") || "none"}\`,
    \`Workspace: \${data?.workspace?.path ?? "unknown"}\`,
    \`Enhanced Source Root: \${data?.enhancedSource?.root ?? "unknown"}\`,
    \`Tests: required=\${summary.passedRequired ?? 0}/\${summary.requiredTests ?? 0} failed=\${summary.failedRequired ?? 0}\`,
    \`Signals: packageFiles=\${summary.sourcePackageFilesRead ?? 0} enhancedFiles=\${summary.enhancedSourceFilesRead ?? 0} exports=\${summary.exportStatements ?? 0} interfaces=\${summary.interfaceDeclarations ?? 0} types=\${summary.typeDeclarations ?? 0} functions=\${summary.functionDeclarations ?? 0} vocabFiles=\${summary.capabilityVocabularyFiles ?? sourceSummary.capabilityVocabularyFiles ?? 0}\`,
    \`Contract: nativeCapabilities=\${summary.nativeCapabilities ?? capabilities.length} implementationReady=\${Boolean(summary.nativeContractReadyForImplementation)}\`,
    \`Governance: exposeSource=\${Boolean(governance.exposesSourceFileContent)} importModule=\${Boolean(governance.canImportModule)} executePlugin=\${Boolean(governance.canExecutePluginCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...tests.map((test) => \`[\${test.status ?? "unknown"}] \${test.id ?? "test"} :: \${test.evidence ?? "no evidence"}\`),
    "",
    ...mappings.map((mapping) => \`\${mapping.sourceSignal ?? "source"} -> \${(mapping.nativeContractFields ?? []).join(", ")} [\${mapping.status ?? "unknown"}]\`),
    "",
    ...capabilities.map((capability) => \`\${capability.id ?? "unknown"} kind=\${capability.kind ?? "unknown"} risk=\${capability.risk ?? "unknown"} domains=\${(capability.domains ?? []).join(",")} approval=\${Boolean(capability.approval?.required)} runtimeOwner=\${capability.runtimeOwner ?? "unknown"}\`),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderNativeSdkContractImplementation(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const slots = Array.isArray(data?.implementationSlots) ? data.implementationSlots : [];
  const capabilities = Array.isArray(data?.contract?.capabilities) ? data.contract.capabilities : [];
  nativeSdkImplementationRegistry.textContent = data?.registry ?? "openclaw-native-plugin-sdk-contract-implementation-v0";
  nativeSdkImplementationSlots.textContent = \`\${summary.implementedSlots ?? 0}/\${summary.totalSlots ?? slots.length}\`;
  nativeSdkImplementationReadOnly.textContent = String(summary.readOnlySlots ?? 0);
  nativeSdkImplementationExecutable.textContent = String(summary.executableSlots ?? 0);
  nativeSdkImplementationMode.textContent = data?.mode ?? "native-sdk-contract-implementation";

  nativeSdkImplementationJson.textContent = [
    "Native SDK contract implementation: stable OpenClawOnNixOS-owned absorption slots for enhanced OpenClaw tools, prompts, manifests, and governed execution.",
    "Read-only slots are contract-ready for adapter implementation; executable slots remain approval-gated and inactive.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-sdk-contract-implementation-v0"}\`,
    \`Mode: \${data?.mode ?? "native-sdk-contract-implementation"}\`,
    \`Runtime Owner: \${data?.runtimeOwner ?? "unknown"}\`,
    \`Source Registries: \${(data?.sourceRegistries ?? []).join(", ") || "none"}\`,
    \`Slots: implemented=\${summary.implementedSlots ?? 0}/\${summary.totalSlots ?? slots.length} missing=\${summary.missingSlots ?? 0}\`,
    \`Capabilities: native=\${summary.nativeCapabilities ?? capabilities.length} readOnly=\${summary.readOnlySlots ?? 0} executable=\${summary.executableSlots ?? 0}\`,
    \`Ready For First Read-only Absorption: \${Boolean(summary.readyForFirstReadOnlyAbsorption)}\`,
    \`Governance: externalRuntime=\${Boolean(governance.externalRuntimeDependencyAllowed)} sourceImported=\${Boolean(governance.sourceContentImported)} exposeSource=\${Boolean(governance.exposesSourceFileContent)} importModule=\${Boolean(governance.canImportModule)} executePlugin=\${Boolean(governance.canExecutePluginCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...slots.map((slot) => \`\${slot.id ?? "unknown"} status=\${slot.status ?? "unknown"} kind=\${slot.kind ?? "unknown"} risk=\${slot.risk ?? "unknown"} approval=\${Boolean(slot.approvalRequired)} adapter=\${slot.adapterState ?? "unknown"} owner=\${slot.runtimeOwner ?? "unknown"}\`),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderOpenClawToolCatalog(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const tools = Array.isArray(data?.catalog?.tools) ? data.catalog.tools : [];
  const docs = Array.isArray(data?.catalog?.documentation) ? data.catalog.documentation : [];
  const categories = Array.isArray(data?.catalog?.categories) ? data.catalog.categories : [];
  const mappings = Array.isArray(data?.catalog?.nativeSlotMapping) ? data.catalog.nativeSlotMapping : [];
  openclawToolCatalogRegistry.textContent = data?.registry ?? "openclaw-tool-catalog-v0";
  openclawToolCatalogTools.textContent = String(summary.toolImplementationFiles ?? tools.length);
  openclawToolCatalogDocs.textContent = String(summary.toolDocumentationFiles ?? docs.length);
  openclawToolCatalogCategories.textContent = String(summary.categoryCount ?? categories.length);
  openclawToolCatalogMode.textContent = data?.mode ?? "read-only-native-absorption";

  openclawToolCatalogJson.textContent = [
    "First real read-only absorption: enhanced OpenClaw tool files and docs are visible as metadata catalog entries.",
    "Source text, documentation bodies, old module imports, old tool execution, runtime activation, tasks, and approvals remain blocked.",
    \`Registry: \${data?.registry ?? "openclaw-tool-catalog-v0"}\`,
    \`Mode: \${data?.mode ?? "read-only-native-absorption"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.tool_catalog"} risk=\${data?.capability?.risk ?? "low"} approval=\${Boolean(data?.capability?.approvalRequired)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Workspace: \${data?.workspace?.path ?? "unknown"}\`,
    \`Roots: tools=\${data?.roots?.tools ?? "unknown"} docs=\${data?.roots?.docs ?? "unknown"} sdk=\${data?.roots?.pluginSdkVocabulary ?? "unknown"}\`,
    \`Counts: sourceFiles=\${summary.sourceToolFiles ?? 0} implementations=\${summary.toolImplementationFiles ?? tools.length} tests=\${summary.toolTestFiles ?? 0} docs=\${summary.toolDocumentationFiles ?? docs.length} documented=\${summary.documentedImplementations ?? 0} sdkVocabulary=\${summary.pluginSdkVocabularyFiles ?? 0}\`,
    \`Categories: \${Object.entries(summary.byCategory ?? {}).map(([category, count]) => \`\${category}=\${count}\`).join(", ") || "none"}\`,
    \`Governance: metadata=\${Boolean(governance.canReadMetadata)} readSource=\${Boolean(governance.canReadSourceFileContent)} exposeSource=\${Boolean(governance.exposesSourceFileContent)} exposeDocs=\${Boolean(governance.exposesDocumentationContent)} importModule=\${Boolean(governance.canImportModule)} executeTool=\${Boolean(governance.canExecuteToolCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...categories.map((entry) => \`\${entry.category ?? "unknown"} count=\${entry.count ?? 0} tools=\${entry.implementationFiles ?? 0} docs=\${entry.documentationFiles ?? 0} slot=\${entry.recommendedNativeSlot ?? "none"}\`),
    "",
    ...mappings.map((mapping) => \`\${mapping.capabilityId ?? "capability"} status=\${mapping.status ?? "unknown"} roots=\${(mapping.sourceRoots ?? []).join(",")} executeSource=\${Boolean(mapping.canExecuteSourceTool)} owner=\${mapping.runtimeOwner ?? "unknown"}\`),
    "",
    ...tools.slice(0, 20).map((tool) => \`\${tool.relativePath ?? "unknown"} category=\${tool.category ?? "unknown"} documented=\${Boolean(tool.documented)} size=\${tool.sizeBytes ?? "n/a"} slot=\${tool.nativeSlot ?? "none"} contentRead=\${Boolean(tool.contentRead)}\`),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderPluginManifestMap(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const manifests = Array.isArray(data?.manifests) ? data.manifests : [];
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  pluginManifestMapRegistry.textContent = data?.registry ?? "openclaw-plugin-manifest-map-v0";
  pluginManifestMapManifests.textContent = String(summary.manifestCount ?? manifests.length);
  pluginManifestMapCategories.textContent = String(summary.categoryCount ?? categories.length);
  pluginManifestMapAuth.textContent = String(summary.authReferenceCount ?? 0);
  pluginManifestMapMode.textContent = data?.mode ?? "read-only-plugin-manifest-absorption";

  pluginManifestMapJson.textContent = [
    "Read-only absorption of enhanced OpenClaw extension manifests as native plugin metadata candidates.",
    "Manifest bodies, auth env var names, endpoint hosts, config schema bodies, module imports, plugin execution, runtime activation, tasks, and approvals remain blocked.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-manifest-map-v0"}\`,
    \`Mode: \${data?.mode ?? "read-only-plugin-manifest-absorption"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.plugin_manifest_map"} risk=\${data?.capability?.risk ?? "low"} approval=\${Boolean(data?.capability?.approvalRequired)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Workspace: \${data?.workspace?.path ?? "unknown"}\`,
    \`Roots: extensions=\${data?.roots?.extensions ?? "extensions"}\`,
    \`Counts: manifests=\${summary.manifestCount ?? manifests.length} categories=\${summary.categoryCount ?? categories.length} enabled=\${summary.enabledByDefaultCount ?? 0} providers=\${summary.providerCount ?? 0} endpoints=\${summary.providerEndpointCount ?? 0} channels=\${summary.channelCount ?? 0} tools=\${summary.toolContractCount ?? 0} authRefs=\${summary.authReferenceCount ?? 0} schemas=\${summary.configSchemaCount ?? 0}\`,
    \`Governance: metadata=\${Boolean(governance.canReadManifestMetadata)} exposeBodies=\${Boolean(governance.exposesManifestBodies)} exposeAuthNames=\${Boolean(governance.exposesAuthEnvVarNames)} exposeSchemas=\${Boolean(governance.exposesConfigSchemaBodies)} importModule=\${Boolean(governance.canImportModule)} executePlugin=\${Boolean(governance.canExecutePluginCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} mutate=\${Boolean(governance.canMutate)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...categories.map((entry) => \`\${entry.category ?? "unknown"} count=\${entry.count ?? 0}\`),
    "",
    ...manifests.slice(0, 30).map((manifest) => \`\${manifest.relativePath ?? "unknown"} id=\${manifest.id ?? "unknown"} category=\${manifest.category ?? "unknown"} contracts=\${(manifest.contractKeys ?? []).join(",") || "none"} providers=\${manifest.providerCount ?? 0} endpoints=\${manifest.providerEndpointCount ?? 0} channels=\${manifest.channelCount ?? 0} authRefs=\${(manifest.providerAuthEnvVarCount ?? 0) + (manifest.channelEnvVarCount ?? 0) + (manifest.syntheticAuthRefCount ?? 0)} schemaProps=\${manifest.configSchemaPropertyCount ?? 0} contentExposed=\${Boolean(manifest.contentExposed)}\`),
  ].join("\\n");
}

function renderPluginCapabilityPlan(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  pluginCapabilityPlanRegistry.textContent = data?.registry ?? "openclaw-plugin-capability-plan-v0";
  pluginCapabilityPlanCandidates.textContent = String(summary.candidateCount ?? candidates.length);
  pluginCapabilityPlanBlocked.textContent = String(summary.blockedCandidates ?? 0);
  pluginCapabilityPlanApproval.textContent = String(summary.requiresApproval ?? 0);
  pluginCapabilityPlanRuntime.textContent = summary.canActivateRuntime ? "enabled" : "disabled";

  pluginCapabilityPlanJson.textContent = [
    "Manifest-derived plugin capability plan: enhanced OpenClaw extension manifests become native capability candidates and governance gates.",
    "This remains plan-only: no plugin modules are imported, no plugin code is executed, no runtime is activated, and no task or approval is created.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-capability-plan-v0"}\`,
    \`Mode: \${data?.mode ?? "manifest-derived-plan-only"}\`,
    \`Capability: \${data?.capability?.id ?? "plan.openclaw.plugin_capability"} risk=\${data?.capability?.risk ?? "low"} approval=\${Boolean(data?.capability?.approvalRequired)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Workspace: \${data?.workspace?.path ?? "unknown"}\`,
    \`Counts: candidates=\${summary.candidateCount ?? candidates.length} blocked=\${summary.blockedCandidates ?? 0} metadataOnly=\${summary.metadataOnlyCandidates ?? 0} approval=\${summary.requiresApproval ?? 0} runtimeAdapter=\${summary.requiresRuntimeAdapter ?? 0}\`,
    \`Risks: \${Object.entries(summary.byRisk ?? {}).map(([risk, count]) => \`\${risk}=\${count}\`).join(", ") || "none"}\`,
    \`Kinds: \${Object.entries(summary.byKind ?? {}).map(([kind, count]) => \`\${kind}=\${count}\`).join(", ") || "none"}\`,
    \`Governance: metadata=\${Boolean(governance.canReadManifestMetadata)} exposeBodies=\${Boolean(governance.exposesManifestBodies)} exposeAuthNames=\${Boolean(governance.exposesAuthEnvVarNames)} importModule=\${Boolean(governance.canImportModule)} executePlugin=\${Boolean(governance.canExecutePluginCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...candidates.slice(0, 30).map((candidate) => \`\${candidate.id ?? "candidate"} manifest=\${candidate.manifestId ?? "unknown"} kind=\${candidate.proposedCapability?.kind ?? "unknown"} risk=\${candidate.proposedCapability?.risk ?? "unknown"} approval=\${Boolean(candidate.proposedCapability?.approvalRequired)} status=\${candidate.status ?? "unknown"} gates=\${(candidate.gates ?? []).map((gate) => \`\${gate.id}:\${gate.status}\`).join(",")}\`),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderPluginCandidateContractTests(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  const contracts = Array.isArray(data?.adapterContracts) ? data.adapterContracts : [];
  const tests = Array.isArray(data?.tests) ? data.tests : [];
  pluginCandidateContractTestsRegistry.textContent = data?.registry ?? "openclaw-plugin-candidate-contract-tests-v0";
  pluginCandidateContractTestsCategory.textContent = summary.selectedCategory ?? data?.filter?.category ?? "search_and_web";
  pluginCandidateContractTestsRequired.textContent = \`\${summary.passedRequired ?? 0}/\${summary.requiredTests ?? 0}\`;
  pluginCandidateContractTestsContracts.textContent = String(summary.adapterContractCount ?? contracts.length);
  pluginCandidateContractTestsRuntime.textContent = summary.runtimeAdapterImplemented ? "implemented" : "pending";

  pluginCandidateContractTestsJson.textContent = [
    "Candidate-native adapter contract tests: the selected enhanced OpenClaw plugin category is now checked against native OpenClawOnNixOS adapter expectations.",
    "This is still read-only: it tests the contract boundary without importing old modules, executing plugin code, activating runtime, creating tasks, or creating approvals.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-candidate-contract-tests-v0"}\`,
    \`Mode: \${data?.mode ?? "candidate-native-adapter-contract-tests"}\`,
    \`Source Registries: \${(data?.sourceRegistries ?? []).join(", ") || "none"}\`,
    \`Workspace: \${data?.workspace?.path ?? "unknown"}\`,
    \`Category: \${summary.selectedCategory ?? data?.filter?.category ?? "search_and_web"}\`,
    \`Counts: candidates=\${summary.candidateCount ?? candidates.length} contracts=\${summary.adapterContractCount ?? contracts.length} tests=\${summary.passedRequired ?? 0}/\${summary.requiredTests ?? 0} approval=\${summary.requiresApproval ?? 0} crossBoundary=\${summary.crossBoundaryCandidates ?? 0}\`,
    \`Governance: metadata=\${Boolean(governance.canReadManifestMetadata)} exposeBodies=\${Boolean(governance.exposesManifestBodies)} exposeAuthNames=\${Boolean(governance.exposesAuthEnvVarNames)} importModule=\${Boolean(governance.canImportModule)} executePlugin=\${Boolean(governance.canExecutePluginCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...contracts.slice(0, 20).map((contract) => \`\${contract.candidateId ?? "candidate"} manifest=\${contract.manifestId ?? "unknown"} capability=\${contract.proposedCapabilityId ?? "unknown"} approval=\${Boolean(contract.approvalRequired)} status=\${contract.implementationStatus ?? "unknown"} surfaces=\${(contract.expectedNativeSurfaces ?? []).join(",")}\`),
    "",
    ...tests.slice(0, 36).map((test) => \`\${test.id ?? "test"} status=\${test.status ?? "unknown"} required=\${Boolean(test.required)} evidence=\${test.evidence ?? ""}\`),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderPluginSearchWebAdapterContract(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const adapter = data?.adapter ?? {};
  const providerContracts = Array.isArray(data?.providerContracts) ? data.providerContracts : [];
  const checks = Array.isArray(data?.contractChecks) ? data.contractChecks : [];
  pluginSearchWebContractRegistry.textContent = data?.registry ?? "openclaw-plugin-search-web-adapter-contract-v0";
  pluginSearchWebContractProviders.textContent = String(summary.providerContractCount ?? providerContracts.length);
  pluginSearchWebContractRequired.textContent = \`\${summary.passedRequired ?? 0}/\${summary.requiredChecks ?? 0}\`;
  pluginSearchWebContractNetwork.textContent = summary.canUseNetwork ? "enabled" : "blocked";
  pluginSearchWebContractRuntime.textContent = summary.canActivateRuntime ? "enabled" : "disabled";

  pluginSearchWebContractJson.textContent = [
    "Search/Web adapter contract shell: selected enhanced OpenClaw search/web providers are mapped to native OpenClawOnNixOS adapter contracts.",
    "No network access, old module import, plugin execution, runtime activation, task creation, or approval creation is available at this layer.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-search-web-adapter-contract-v0"}\`,
    \`Mode: \${data?.mode ?? "native-search-web-adapter-contract-shell"}\`,
    \`Adapter: \${adapter.id ?? "openclaw.search_web.native-adapter"} status=\${adapter.status ?? "unknown"} owner=\${adapter.runtimeOwner ?? "unknown"}\`,
    \`Sources: \${(data?.sourceRegistries ?? []).join(", ") || "none"}\`,
    \`Counts: providers=\${summary.providerContractCount ?? providerContracts.length} operations=\${summary.operationCount ?? 0} checks=\${summary.passedRequired ?? 0}/\${summary.requiredChecks ?? 0} approval=\${summary.requiresApproval ?? 0} crossBoundary=\${summary.crossBoundaryContracts ?? 0}\`,
    \`Boundaries: network=\${Boolean(summary.canUseNetwork)} import=\${Boolean(summary.canImportModule)} executePlugin=\${Boolean(summary.canExecutePluginCode)} activateRuntime=\${Boolean(summary.canActivateRuntime)} task=\${Boolean(summary.createsTask)} approval=\${Boolean(summary.createsApproval)}\`,
    \`Privacy: manifestBodies=\${Boolean(governance.exposesManifestBodies)} authNames=\${Boolean(governance.exposesAuthEnvVarNames)} endpoints=\${Boolean(governance.exposesEndpointHosts)} schemaBodies=\${Boolean(governance.exposesConfigSchemaBodies)} source=\${Boolean(governance.exposesSourceFileContent)}\`,
    "",
    ...providerContracts.slice(0, 24).map((contract) => \`\${contract.id ?? "provider"} manifest=\${contract.manifestId ?? "unknown"} capability=\${contract.proposedCapabilityId ?? "unknown"} operations=\${(contract.operations ?? []).join(",") || "none"} risk=\${contract.policy?.risk ?? "unknown"} approval=\${Boolean(contract.policy?.requiresApproval)} network=\${Boolean(contract.runtime?.canUseNetwork)} runtime=\${contract.runtime?.implementationState ?? "unknown"}\`),
    "",
    ...checks.slice(0, 32).map((check) => \`\${check.id ?? "check"} status=\${check.status ?? "unknown"} required=\${Boolean(check.required)} evidence=\${check.evidence ?? ""}\`),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderPluginSearchWebRuntimePreflight(data) {
  const envelope = data?.executionEnvelope ?? {};
  const constraints = envelope.constraints ?? {};
  const provider = data?.provider ?? {};
  const governance = data?.governance ?? {};
  pluginSearchWebPreflightRegistry.textContent = data?.registry ?? "openclaw-plugin-search-web-adapter-runtime-preflight-v0";
  pluginSearchWebPreflightEnvelope.textContent = envelope.envelopeVersion ?? "missing";
  pluginSearchWebPreflightApproval.textContent = envelope.approval?.required ? "required" : "not-required";
  pluginSearchWebPreflightNetwork.textContent = constraints.canUseNetwork ? "enabled" : "blocked";
  pluginSearchWebPreflightRuntime.textContent = constraints.canActivateRuntime ? "enabled" : "disabled";

  pluginSearchWebPreflightJson.textContent = [
    "Search/Web runtime preflight: builds a governed provider execution envelope before any network or provider runtime can be activated.",
    "This layer is preflight-only: it creates no task, approval, network call, capability invocation, or plugin/provider execution.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-search-web-adapter-runtime-preflight-v0"}\`,
    \`Mode: \${data?.mode ?? "preflight-only"}\`,
    \`Envelope: \${envelope.envelopeVersion ?? "missing"} state=\${envelope.state ?? "unknown"}\`,
    \`Provider: \${provider.id ?? "unknown"} manifest=\${provider.manifestId ?? "unknown"} operations=\${(provider.operations ?? []).join(",") || "none"}\`,
    \`Query: present=\${Boolean(data?.query?.present)} length=\${data?.query?.length ?? 0} digest=\${data?.query?.digest ?? "none"} contentExposed=\${Boolean(data?.query?.contentExposed)}\`,
    \`Policy: decision=\${envelope.policyDecision?.decision ?? "unknown"} domain=\${envelope.policyDecision?.domain ?? "unknown"} risk=\${envelope.policyDecision?.risk ?? "unknown"} approved=\${Boolean(envelope.policyDecision?.approved)}\`,
    \`Approval: required=\${Boolean(envelope.approval?.required)} collected=\${Boolean(envelope.approval?.collected)}\`,
    \`Audit: required=\${Boolean(envelope.audit?.required)} ledger=\${envelope.audit?.ledger ?? "unknown"}\`,
    \`Constraints: network=\${Boolean(constraints.canUseNetwork)} import=\${Boolean(constraints.canImportModule)} executePlugin=\${Boolean(constraints.canExecutePluginCode)} activateRuntime=\${Boolean(constraints.canActivateRuntime)} task=\${Boolean(constraints.canCreateTask)} approval=\${Boolean(constraints.canCreateApproval)}\`,
    \`Privacy: query=\${Boolean(governance.exposesQueryContent)} manifestBodies=\${Boolean(governance.exposesManifestBodies)} authNames=\${Boolean(governance.exposesAuthEnvVarNames)} endpoints=\${Boolean(governance.exposesEndpointHosts)} source=\${Boolean(governance.exposesSourceFileContent)}\`,
  ].join("\\n");
}

function renderPluginSearchWebRuntimeActivationPlan(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const gates = Array.isArray(data?.gates) ? data.gates : [];
  const envelope = data?.executionEnvelope ?? {};
  pluginSearchWebActivationRegistry.textContent = data?.registry ?? "openclaw-plugin-search-web-adapter-runtime-activation-plan-v0";
  pluginSearchWebActivationStatus.textContent = data?.status ?? "unknown";
  pluginSearchWebActivationRequired.textContent = \`\${summary.passedRequired ?? 0}/\${summary.requiredGates ?? 0}\`;
  pluginSearchWebActivationNetwork.textContent = summary.canUseNetwork ? "enabled" : "blocked";
  pluginSearchWebActivationRuntime.textContent = summary.canActivateRuntime ? "enabled" : "disabled";

  pluginSearchWebActivationJson.textContent = [
    "Search/Web runtime activation plan: records the remaining gates before native provider/network execution can be enabled.",
    "This plan creates no task by itself; the activation task button materializes a separate approval-gated shell that still defers network/provider runtime.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-search-web-adapter-runtime-activation-plan-v0"}\`,
    \`Mode: \${data?.mode ?? "activation-plan-only"}\`,
    \`Status: \${data?.status ?? "unknown"} activationReady=\${Boolean(data?.activationReady)}\`,
    \`Required Gates: \${summary.passedRequired ?? 0}/\${summary.requiredGates ?? 0} blocked=\${summary.blockedRequired ?? 0}\`,
    \`Envelope: \${envelope.envelopeVersion ?? "unknown"} state=\${envelope.state ?? "unknown"}\`,
    \`Provider: \${data?.provider?.id ?? "unknown"} manifest=\${data?.provider?.manifestId ?? "unknown"} operation=\${envelope.operation ?? "unknown"}\`,
    \`Network Activation: \${summary.canUseNetwork ? "enabled" : "disabled"} importModule=\${Boolean(summary.canImportModule)} executePlugin=\${Boolean(summary.canExecutePluginCode)} activateRuntime=\${Boolean(summary.canActivateRuntime)}\`,
    \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} query=\${Boolean(governance.exposesQueryContent)} endpoints=\${Boolean(governance.exposesEndpointHosts)} authNames=\${Boolean(governance.exposesAuthEnvVarNames)}\`,
    "",
    ...gates.map((gate) => {
      const required = gate.required ? "required" : "optional";
      return \`[\${gate.status ?? "unknown"}/\${required}] \${gate.id ?? "gate"} :: \${gate.evidence ?? "no evidence"}\`;
    }),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
    \`Forbidden Work: \${(summary.forbiddenWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderPluginSearchWebProviderRuntimeSandbox(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const sandbox = data?.sandbox ?? {};
  const checks = Array.isArray(data?.checks) ? data.checks : [];
  pluginSearchWebSandboxRegistry.textContent = data?.registry ?? "openclaw-plugin-search-web-adapter-provider-runtime-sandbox-v0";
  pluginSearchWebSandboxStatus.textContent = data?.status ?? "unknown";
  pluginSearchWebSandboxRequired.textContent = \`\${summary.passedRequired ?? 0}/\${summary.requiredChecks ?? 0}\`;
  pluginSearchWebSandboxNetwork.textContent = summary.canUseNetwork ? "enabled" : "blocked";
  pluginSearchWebSandboxRuntime.textContent = summary.canActivateRuntime ? "enabled" : "disabled";

  pluginSearchWebSandboxJson.textContent = [
    "Search/Web provider runtime sandbox contract: defines the native provider boundary before any live network runtime is enabled.",
    "This is contract-only: it creates no task, approval, network call, capability invocation, provider import, or provider execution.",
    \`Registry: \${data?.registry ?? "openclaw-plugin-search-web-adapter-provider-runtime-sandbox-v0"}\`,
    \`Mode: \${data?.mode ?? "provider-runtime-sandbox-contract"}\`,
    \`Status: \${data?.status ?? "unknown"} sandboxApproved=\${Boolean(summary.sandboxApproved)} activationReady=\${Boolean(data?.activationReady)}\`,
    \`Required Checks: \${summary.passedRequired ?? 0}/\${summary.requiredChecks ?? 0} blocked=\${summary.blockedRequired ?? 0}\`,
    \`Provider: \${data?.provider?.id ?? "unknown"} manifest=\${data?.provider?.manifestId ?? "unknown"} operations=\${(data?.provider?.operations ?? []).join(",") || "none"}\`,
    \`Sandbox: \${sandbox.contractVersion ?? "unknown"} state=\${sandbox.state ?? "unknown"} approvalRequired=\${Boolean(sandbox.approval?.required)} collected=\${Boolean(sandbox.approval?.collected)}\`,
    \`Isolation: process=\${Boolean(sandbox.isolation?.processIsolationRequired)} oldModuleImport=\${Boolean(sandbox.isolation?.oldOpenClawModuleImportAllowed)} secretsMounted=\${Boolean(sandbox.isolation?.secretsMounted)}\`,
    \`Egress: default=\${sandbox.egress?.networkEgressDefault ?? "unknown"} network=\${Boolean(sandbox.egress?.canUseNetwork)} allowlist=\${(sandbox.egress?.allowlist ?? []).length} dns=\${Boolean(sandbox.egress?.dnsResolutionAllowed)}\`,
    \`Execution: import=\${Boolean(sandbox.execution?.canImportModule)} providerCode=\${Boolean(sandbox.execution?.canExecuteProviderCode)} activateRuntime=\${Boolean(sandbox.execution?.canActivateRuntime)} mutate=\${Boolean(sandbox.execution?.canMutate)}\`,
    \`Privacy: query=\${Boolean(sandbox.privacy?.queryContentExposed)} manifestBodies=\${Boolean(sandbox.privacy?.manifestBodiesExposed)} authNames=\${Boolean(sandbox.privacy?.authEnvVarNamesExposed)} endpoints=\${Boolean(sandbox.privacy?.endpointHostsExposed)} source=\${Boolean(sandbox.privacy?.sourceFileContentExposed)}\`,
    \`Governance: task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)} network=\${Boolean(governance.canUseNetwork)} import=\${Boolean(governance.canImportModule)} execute=\${Boolean(governance.canExecutePluginCode)} runtime=\${Boolean(governance.canActivateRuntime)}\`,
    "",
    ...checks.map((check) => {
      const required = check.required ? "required" : "optional";
      return \`[\${check.status ?? "unknown"}/\${required}] \${check.id ?? "check"} :: \${check.evidence ?? "no evidence"}\`;
    }),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
    \`Forbidden Work: \${(summary.forbiddenWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderToolCatalogAdapter(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const tools = Array.isArray(data?.tools) ? data.tools : [];
  const docs = Array.isArray(data?.documentation) ? data.documentation : [];
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  toolCatalogAdapterRegistry.textContent = data?.registry ?? "openclaw-native-plugin-adapter-v0";
  toolCatalogAdapterMatches.textContent = String(summary.matchedTools ?? tools.length);
  toolCatalogAdapterCategories.textContent = String(summary.categoryCount ?? categories.length);
  toolCatalogAdapterExecution.textContent = governance.canExecuteToolCode ? "enabled" : "blocked";
  toolCatalogAdapterMode.textContent = data?.mode ?? "tool-catalog-profile-only";

  toolCatalogAdapterJson.textContent = [
    "Native adapter invocation surface for the absorbed enhanced OpenClaw tool catalog.",
    "This adapter can be invoked through capability history; it still does not import, execute, mutate, activate runtime, or expose source/doc bodies.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-adapter-v0"}\`,
    \`Mode: \${data?.mode ?? "tool-catalog-profile-only"}\`,
    \`Adapter Status: \${data?.adapterStatus ?? "unknown"}\`,
    \`Source Registry: \${data?.sourceRegistry ?? "openclaw-tool-catalog-v0"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.tool_catalog"} risk=\${data?.capability?.risk ?? "low"} approval=\${Boolean(data?.capability?.approvalRequired)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Filter: category=\${data?.filter?.category ?? "none"} query=\${data?.filter?.query ?? "none"} limit=\${data?.filter?.limit ?? "n/a"}\`,
    \`Counts: matched=\${summary.matchedTools ?? tools.length}/\${summary.totalTools ?? 0} docs=\${summary.matchedDocumentation ?? docs.length}/\${summary.totalDocumentation ?? 0} categories=\${summary.categoryCount ?? categories.length} filterApplied=\${Boolean(summary.filterApplied)}\`,
    \`Governance: metadata=\${Boolean(governance.canReadMetadata)} readSource=\${Boolean(governance.canReadSourceFileContent)} exposeSource=\${Boolean(governance.exposesSourceFileContent)} exposeDocs=\${Boolean(governance.exposesDocumentationContent)} importModule=\${Boolean(governance.canImportModule)} executeTool=\${Boolean(governance.canExecuteToolCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...tools.slice(0, 16).map((tool) => \`\${tool.relativePath ?? "unknown"} category=\${tool.category ?? "unknown"} documented=\${Boolean(tool.documented)} slot=\${tool.nativeSlot ?? "none"} contentRead=\${Boolean(tool.contentRead)}\`),
  ].join("\\n");
}

function renderSemanticIndex(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const files = Array.isArray(data?.files) ? data.files : [];
  semanticIndexRegistry.textContent = data?.registry ?? "openclaw-native-plugin-adapter-v0";
  semanticIndexFiles.textContent = String(summary.totalFiles ?? files.length);
  semanticIndexExports.textContent = String(summary.exportStatements ?? 0);
  semanticIndexSource.textContent = governance.exposesSourceFileContent ? "exposed" : "hidden";
  semanticIndexMode.textContent = data?.mode ?? "workspace-semantic-index-only";

  semanticIndexJson.textContent = [
    "Native read-only semantic tool: derived signals from enhanced OpenClaw files, with raw source and docs hidden.",
    "This reads bounded content to count semantics, but does not expose text, import modules, execute tools, mutate files, or activate runtime.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-adapter-v0"}\`,
    \`Mode: \${data?.mode ?? "workspace-semantic-index-only"}\`,
    \`Adapter Status: \${data?.adapterStatus ?? "unknown"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.workspace_semantic_index"} risk=\${data?.capability?.risk ?? "low"} approval=\${Boolean(data?.capability?.approvalRequired)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Scope: \${data?.scope?.id ?? "tools"} root=\${data?.scope?.relativeRoot ?? "unknown"} query=\${data?.scope?.query ?? "none"} limit=\${data?.scope?.limit ?? "n/a"}\`,
    \`Files: total=\${summary.totalFiles ?? files.length} read=\${summary.contentRead ?? 0} skipped=\${summary.skipped ?? 0} lines=\${summary.lineCount ?? 0}\`,
    \`Signals: exports=\${summary.exportStatements ?? 0} imports=\${summary.importStatements ?? 0} interfaces=\${summary.interfaceDeclarations ?? 0} types=\${summary.typeDeclarations ?? 0} functions=\${summary.functionDeclarations ?? 0} classes=\${summary.classDeclarations ?? 0} semanticFiles=\${summary.semanticVocabularyFiles ?? 0}\`,
    \`By Kind: \${Object.entries(summary.byKind ?? {}).map(([kind, count]) => \`\${kind}=\${count}\`).join(", ") || "none"}\`,
    \`By Category: \${Object.entries(summary.byCategory ?? {}).map(([category, count]) => \`\${category}=\${count}\`).join(", ") || "none"}\`,
    \`Governance: readSource=\${Boolean(governance.canReadSourceFileContent)} exposeSource=\${Boolean(governance.exposesSourceFileContent)} exposeDocs=\${Boolean(governance.exposesDocumentationContent)} importModule=\${Boolean(governance.canImportModule)} executeTool=\${Boolean(governance.canExecuteToolCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...files.slice(0, 16).map((file) => {
      const signals = file.signals ?? {};
      return \`\${file.relativePath ?? "unknown"} kind=\${file.kind ?? "unknown"} category=\${file.category ?? "unknown"} read=\${Boolean(file.contentRead)} exposed=\${Boolean(file.contentExposed)} exports=\${signals.exportStatements ?? 0} functions=\${signals.functionDeclarations ?? 0} terms=\${signals.semanticTermCount ?? 0}\`;
    }),
  ].join("\\n");
}

function renderSymbolLookup(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const matches = Array.isArray(data?.matches) ? data.matches : [];
  symbolLookupRegistry.textContent = data?.registry ?? "openclaw-native-plugin-adapter-v0";
  symbolLookupMatches.textContent = String(summary.matchedSymbols ?? matches.length);
  symbolLookupFiles.textContent = String(summary.filesScanned ?? 0);
  symbolLookupExecution.textContent = governance.canExecuteQuery ? "query-only" : "blocked";
  symbolLookupMode.textContent = data?.mode ?? "workspace-symbol-lookup-executable-read-only";

  symbolLookupJson.textContent = [
    "Native governed executable adapter: bounded read-only symbol lookup over enhanced OpenClaw files.",
    "This executes a local query and returns declaration symbols only; no old module imports, tool execution, function bodies, mutations, tasks, or approvals.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-adapter-v0"}\`,
    \`Mode: \${data?.mode ?? "workspace-symbol-lookup-executable-read-only"}\`,
    \`Adapter Status: \${data?.adapterStatus ?? "unknown"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.workspace_symbol_lookup"} risk=\${data?.capability?.risk ?? "low"} approval=\${Boolean(data?.capability?.approvalRequired)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Query: text=\${data?.query?.text ?? "tool"} scope=\${data?.query?.scope ?? "tools"} root=\${data?.query?.relativeRoot ?? "unknown"} limit=\${data?.query?.limit ?? "n/a"}\`,
    \`Counts: matches=\${summary.matchedSymbols ?? matches.length} files=\${summary.filesScanned ?? 0} declarations=\${summary.declarationsScanned ?? 0} contentRead=\${summary.contentRead ?? 0}\`,
    \`Governance: executeQuery=\${Boolean(governance.canExecuteQuery)} readSource=\${Boolean(governance.canReadSourceFileContent)} exposeSource=\${Boolean(governance.exposesSourceFileContent)} exposePreview=\${Boolean(governance.exposesDeclarationPreview)} exposeBodies=\${Boolean(governance.exposesFunctionBodies)} importModule=\${Boolean(governance.canImportModule)} executeTool=\${Boolean(governance.canExecuteToolCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...matches.slice(0, 16).map((match) => \`\${match.relativePath ?? "unknown"}:\${match.lineNumber ?? "?"} \${match.declarationKind ?? "symbol"} \${match.symbolName ?? "unknown"} exported=\${Boolean(match.exported)} preview=\${match.declarationPreview ?? ""}\`),
  ].join("\\n");
}

function renderEditTargetSelection(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  const selectedTarget = data?.selectedTarget ?? null;
  editTargetSelectionRegistry.textContent = data?.registry ?? "openclaw-native-workspace-edit-target-selection-v0";
  editTargetSelectionCandidates.textContent = String(summary.candidateCount ?? candidates.length);
  editTargetSelectionSelected.textContent = selectedTarget?.relativePath ?? "none";
  editTargetSelectionSource.textContent = governance.exposesSourceFileContent ? "exposed" : "hidden";
  editTargetSelectionMode.textContent = data?.mode ?? "source-derived-bounded-target-selection";

  editTargetSelectionJson.textContent = [
    "Native source-derived edit target selection: bounded real OpenClaw workspace target metadata for later approval-gated patch proposals.",
    "This selects file paths from derived metadata only; source bodies remain hidden, no legacy modules are imported, and no task or mutation is created.",
    "Patch bridge flag: selectTargetFromSource=true",
    \`Registry: \${data?.registry ?? "openclaw-native-workspace-edit-target-selection-v0"}\`,
    \`Mode: \${data?.mode ?? "source-derived-bounded-target-selection"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.workspace_edit_target_select"} risk=\${data?.capability?.risk ?? "low"} approval=\${Boolean(data?.capability?.approvalRequired)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Query: text=\${data?.query?.text ?? "edit"} scope=\${data?.query?.scope ?? "tools"} root=\${data?.query?.relativeRoot ?? "unknown"} limit=\${data?.query?.limit ?? "n/a"}\`,
    \`Selected: \${selectedTarget?.relativePath ?? "none"} score=\${selectedTarget?.score ?? 0} kind=\${selectedTarget?.kind ?? "unknown"} symbol=\${selectedTarget?.primarySymbol?.symbolName ?? "none"} eligible=\${Boolean(selectedTarget?.eligibleForPatchProposal)}\`,
    \`Counts: candidates=\${summary.candidateCount ?? candidates.length} semanticFiles=\${summary.semanticFilesMatched ?? 0} symbols=\${summary.symbolMatches ?? 0} toolCatalog=\${summary.toolCatalogMatches ?? 0} canFeedPatch=\${Boolean(summary.canFeedPatchProposal)}\`,
    \`Governance: readSource=\${Boolean(governance.canReadSourceFileContent)} exposeSource=\${Boolean(governance.exposesSourceFileContent)} exposePreview=\${Boolean(governance.exposesDeclarationPreview)} importModule=\${Boolean(governance.canImportModule)} executeTool=\${Boolean(governance.canExecuteToolCode)} mutate=\${Boolean(governance.canMutate)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...candidates.slice(0, 12).map((candidate) => \`\${candidate.relativePath ?? "unknown"} score=\${candidate.score ?? 0} kind=\${candidate.kind ?? "unknown"} category=\${candidate.category ?? "unknown"} symbol=\${candidate.primarySymbol?.symbolName ?? "none"} exposed=\${Boolean(candidate.contentExposed)} eligible=\${Boolean(candidate.eligibleForPatchProposal)}\`),
  ].join("\\n");
}

function renderPromptSemantics(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const files = Array.isArray(data?.files) ? data.files : [];
  const expectedChecks = data?.derivedPlanSemantics?.expectedChecks ?? summary.expectedChecks ?? [];
  const editIntent = data?.derivedPlanSemantics?.editIntent ?? {};
  promptSemanticsRegistry.textContent = data?.registry ?? "openclaw-native-prompt-semantics-v0";
  promptSemanticsFiles.textContent = String(summary.totalFiles ?? files.length);
  promptSemanticsChecks.textContent = String(expectedChecks.length);
  promptSemanticsContent.textContent = governance.exposesPromptContent ? "exposed" : "hidden";
  promptSemanticsMode.textContent = data?.mode ?? "prompt-tool-semantics-profile-only";

  promptSemanticsJson.textContent = [
    "Native prompt/tool semantics profile: derives edit intent and expected checks from enhanced OpenClaw prompt/tool surfaces.",
    "Prompt and source bodies remain hidden; no legacy modules are imported, no prompt code is executed, and no mutation/task is created.",
    \`Registry: \${data?.registry ?? "openclaw-native-prompt-semantics-v0"}\`,
    \`Mode: \${data?.mode ?? "prompt-tool-semantics-profile-only"}\`,
    \`Capability: \${data?.capability?.id ?? "sense.openclaw.prompt_pack"} risk=\${data?.capability?.risk ?? "low"} approval=\${Boolean(data?.capability?.approvalRequired)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Intent: kind=\${editIntent.kind ?? "source_derived_workspace_edit"} planning=\${editIntent.planningStyle ?? "unknown"} safety=\${editIntent.targetSafety ?? "unknown"} verification=\${(editIntent.verificationStyle ?? []).join(",") || "none"}\`,
    \`Expected Checks: \${expectedChecks.join(",") || "none"}\`,
    \`Counts: files=\${summary.totalFiles ?? files.length} read=\${summary.contentRead ?? 0} editFiles=\${summary.editVocabularyFiles ?? 0} verificationFiles=\${summary.verificationVocabularyFiles ?? 0} governanceFiles=\${summary.governanceVocabularyFiles ?? 0}\`,
    \`Governance: readPrompt=\${Boolean(governance.canReadPromptContent)} exposePrompt=\${Boolean(governance.exposesPromptContent)} exposeSource=\${Boolean(governance.exposesSourceFileContent)} importModule=\${Boolean(governance.canImportModule)} executePrompt=\${Boolean(governance.canExecutePromptCode)} executeTool=\${Boolean(governance.canExecuteToolCode)} mutate=\${Boolean(governance.canMutate)} task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)}\`,
    "",
    ...files.slice(0, 12).map((file) => {
      const signals = file.signals ?? {};
      return \`\${file.relativePath ?? "unknown"} kind=\${file.kind ?? "unknown"} read=\${Boolean(file.contentRead)} exposed=\${Boolean(file.contentExposed)} edit=\${Boolean(signals.hasEditVocabulary)} verify=\${Boolean(signals.hasVerificationVocabulary)} governance=\${Boolean(signals.hasGovernanceVocabulary)}\`;
    }),
  ].join("\\n");
}

function renderWorkspaceTextWriteDraft(data) {
  const target = data?.target ?? {};
  const governance = data?.draft?.governance ?? data?.governance ?? {};
  workspaceTextWriteRegistry.textContent = data?.registry ?? "openclaw-native-workspace-text-write-draft-v0";
  workspaceTextWriteCapability.textContent = data?.capability?.id ?? "act.openclaw.workspace_text_write";
  workspaceTextWriteApproval.textContent = data?.capability?.approvalRequired === false ? "not required" : "required";
  workspaceTextWriteContent.textContent = target.contentExposed === true ? "exposed" : "redacted";
  workspaceTextWriteMode.textContent = data?.mode ?? "approval-gated-draft";

  workspaceTextWriteJson.textContent = [
    "Native approval-gated mutation adapter: creates a task for bounded enhanced OpenClaw workspace text writes.",
    "Content is represented by byte count and sha256 only; execution reuses act.filesystem.write_text after approval so filesystem ledger/history remain authoritative.",
    \`Registry: \${data?.registry ?? "openclaw-native-workspace-text-write-draft-v0"}\`,
    \`Mode: \${data?.mode ?? "approval-gated-draft"}\`,
    \`Capability: \${data?.capability?.id ?? "act.openclaw.workspace_text_write"} risk=\${data?.capability?.risk ?? "high"} approval=\${Boolean(data?.capability?.approvalRequired ?? true)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Workspace: \${data?.workspace?.name ?? "unknown"} \${data?.workspace?.path ?? ""}\`,
    \`Target: \${target.relativePath ?? "scratch/native-write.txt"} bytes=\${target.contentBytes ?? 0} sha256=\${target.contentSha256 ?? "unknown"} overwrite=\${Boolean(target.overwrite)} exposed=\${Boolean(target.contentExposed)}\`,
    \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executeWithoutApproval=\${Boolean(governance.canExecuteWithoutApproval)} filesystemWrite=\${Boolean(governance.usesFilesystemWriteCapability)} exposesContent=\${Boolean(governance.exposesContent)}\`,
  ].join("\\n");
}

function renderWorkspacePatchApplyDraft(data) {
  const target = data?.target ?? {};
  const governance = data?.draft?.governance ?? data?.governance ?? {};
  const validation = data?.validation ?? {};
  const proposal = data?.proposal ?? {};
  const proposalSourceSignals = data?.proposalSourceSignals ?? null;
  const targetSelection = data?.targetSelection ?? null;
  const sourceAuthoredEdit = data?.sourceAuthoredEdit ?? null;
  const editIntent = proposal.editIntent ?? {};
  const expectedChecks = Array.isArray(proposal.expectedChecks) ? proposal.expectedChecks : [];
  const semanticPlan = proposal.semanticPlan ?? null;
  const rationaleBundle = proposal.rationaleBundle ?? null;
  const checkBundle = proposal.checkBundle ?? null;
  const riskNotes = proposal.riskNotes ?? null;
  const structuredValidationEngine = validation.structuredPatch?.engine ?? "openclaw-native-workspace-patch-validation-v0";
  const previewValidationEngine = validation.preview?.engine ?? "openclaw-native-workspace-patch-preview-validation-v0";
  const diffPreview = data?.diffPreview ?? {};
  const lines = Array.isArray(diffPreview.lines) ? diffPreview.lines : [];
  workspacePatchApplyRegistry.textContent = data?.registry ?? "openclaw-native-workspace-patch-apply-draft-v0";
  workspacePatchApplyCapability.textContent = data?.capability?.id ?? "act.openclaw.workspace_patch_apply";
  workspacePatchApplyApproval.textContent = data?.capability?.approvalRequired === false ? "not required" : "required";
  workspacePatchApplyPreview.textContent = target.diffPreviewExposed === false ? "hidden" : \`\${diffPreview.previewLineCount ?? lines.length} lines\`;
  workspacePatchApplyMode.textContent = data?.mode ?? "diff-preview-approval-gated-draft";

  workspacePatchApplyJson.textContent = [
    "Native approval-gated patch adapter: reads a bounded file, creates small single or multi-hunk diff previews, and applies only after approval.",
    "The task stores the full patched content internally for act.filesystem.write_text, but public task/Observer output uses redacted params plus hashes.",
    \`Registry: \${data?.registry ?? "openclaw-native-workspace-patch-apply-draft-v0"}\`,
    \`Mode: \${data?.mode ?? "diff-preview-approval-gated-draft"}\`,
    \`Capability: \${data?.capability?.id ?? "act.openclaw.workspace_patch_apply"} risk=\${data?.capability?.risk ?? "high"} approval=\${Boolean(data?.capability?.approvalRequired ?? true)} owner=\${data?.capability?.runtimeOwner ?? "unknown"}\`,
    \`Workspace: \${data?.workspace?.name ?? "unknown"} \${data?.workspace?.path ?? ""}\`,
    \`Target: \${target.relativePath ?? "scratch/observer-native-edit.txt"} edits=\${target.editCount ?? 1} changedAt=\${(target.changedAtLines ?? [target.changedAtLine]).filter(Boolean).join(",") || "unknown"} oldBytes=\${target.originalBytes ?? 0} newBytes=\${target.nextBytes ?? 0} oldSha256=\${target.originalSha256 ?? "unknown"} newSha256=\${target.nextSha256 ?? "unknown"} contentExposed=\${Boolean(target.contentExposed)} diffPreview=\${Boolean(target.diffPreviewExposed)}\`,
    \`Source-Authored Edit: registry=\${sourceAuthoredEdit?.registry ?? "openclaw-source-authored-edit-v0"} mode=\${sourceAuthoredEdit?.mode ?? "none"} entrypoint=\${sourceAuthoredEdit?.entrypoint ?? "/plugins/native-adapter/source-authored-edit-tasks"} proposal=\${sourceAuthoredEdit?.proposalRegistry ?? "none"} rationale=\${sourceAuthoredEdit?.rationaleBundleRegistry ?? "none"} checks=\${sourceAuthoredEdit?.checkBundleRegistry ?? "none"} contentExposed=\${Boolean(sourceAuthoredEdit?.contentExposed)}\`,
    "Source-Derived Compatibility: deriveProposalFromSource=true supersededBy=/plugins/native-adapter/source-authored-edit/draft",
    \`Target Selection: registry=\${targetSelection?.registry ?? "none"} selected=\${targetSelection?.selectedTarget?.relativePath ?? "none"} candidates=\${targetSelection?.summary?.candidateCount ?? 0} canFeedPatch=\${Boolean(targetSelection?.summary?.canFeedPatchProposal)} exposesSource=\${Boolean(targetSelection?.governance?.exposesSourceFileContent)}\`,
    \`Proposal Envelope: registry=\${proposal.registry ?? "openclaw-native-workspace-edit-proposal-v0"} title=\${proposal.title ?? "unknown"} dryRun=\${Boolean(proposal.dryRun?.ok)} contentExposed=\${Boolean(proposal.dryRun?.contentExposed)} rationale=\${proposal.rationale ?? "unknown"}\`,
    \`Edit Intent: kind=\${editIntent.kind ?? "none"} objective=\${editIntent.objective ?? "none"} planning=\${editIntent.planningStyle ?? "none"} safety=\${editIntent.targetSafety ?? "none"}\`,
    \`Expected Checks: \${expectedChecks.join(",") || "none"} semanticPlan=\${semanticPlan?.registry ?? "none"} promptFiles=\${semanticPlan?.promptFiles ?? 0} contentExposed=\${Boolean(semanticPlan?.contentExposed)}\`,
    \`Rationale Bundle: registry=\${rationaleBundle?.registry ?? "openclaw-rationale-check-bundle-v0"} reasons=\${rationaleBundle?.reasons?.length ?? 0} matchedTools=\${rationaleBundle?.sourceSignals?.matchedTools ?? 0} matchedSemanticFiles=\${rationaleBundle?.sourceSignals?.matchedSemanticFiles ?? 0} promptFiles=\${rationaleBundle?.sourceSignals?.promptSemanticFiles ?? 0} contentExposed=\${Boolean(rationaleBundle?.contentExposed)}\`,
    \`Check Bundle: registry=\${checkBundle?.registry ?? "openclaw-rationale-check-bundle-v0"} required=\${(checkBundle?.required ?? []).join(",") || "none"} recommended=\${(checkBundle?.recommended ?? []).join(",") || "none"} blockedUntilApproval=\${(checkBundle?.blockedUntilApproval ?? []).join(",") || "none"} contentExposed=\${Boolean(checkBundle?.contentExposed)}\`,
    \`Risk Notes: registry=\${riskNotes?.registry ?? "openclaw-rationale-check-bundle-v0"} risk=\${riskNotes?.risk ?? "none"} approvalRequired=\${Boolean(riskNotes?.approvalRequired)} notes=\${(riskNotes?.notes ?? []).join(";") || "none"} contentExposed=\${Boolean(riskNotes?.contentExposed)}\`,
    \`Proposal Source Signals: registry=\${proposalSourceSignals?.registry ?? "none"} knownRegistry=\${SOURCE_DERIVED_EDIT_PROPOSAL_REGISTRY} matchedTools=\${proposalSourceSignals?.toolSignals?.matchedTools ?? 0} matchedSemanticFiles=\${proposalSourceSignals?.semanticSignals?.matchedFiles ?? 0} exposesSource=\${Boolean(proposalSourceSignals?.governance?.exposesSourceFileContent)} executesTool=\${Boolean(proposalSourceSignals?.governance?.canExecuteToolCode)}\`,
    \`Structured Edits: supportedKinds=replace_text,replace_lines observedKinds=\${(data?.edits ?? []).map((edit) => edit.kind ?? "replace_text").join(",") || "none"}\`,
    \`Validation: ok=\${Boolean(validation.ok)} structured=\${structuredValidationEngine} preview=\${previewValidationEngine} appliesAgainstOriginal=\${Boolean(validation.structuredPatch?.checks?.appliesAgainstOriginalContent)} structuredLineRangesResolved=\${Boolean(validation.structuredPatch?.checks?.structuredLineRangesResolved)}\`,
    \`Diff: format=\${diffPreview.format ?? "unknown"} hunks=\${diffPreview.hunkCount ?? 1} oldStart=\${diffPreview.oldStartLine ?? "?"} newStart=\${diffPreview.newStartLine ?? "?"} lines=\${diffPreview.previewLineCount ?? lines.length} truncated=\${Boolean(diffPreview.truncated)}\`,
    \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executeWithoutApproval=\${Boolean(governance.canExecuteWithoutApproval)} filesystemWrite=\${Boolean(governance.usesFilesystemWriteCapability)} exposesFullContent=\${Boolean(governance.exposesFullContent)} exposesDiffPreview=\${Boolean(governance.exposesDiffPreview)}\`,
    "",
    ...lines.map((line) => {
      const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
      const number = line.type === "add" ? line.newLine : line.oldLine;
      const hunk = line.hunk ? \`h\${line.hunk} \` : "";
      return \`\${hunk}\${prefix}\${number ?? "?"}: \${line.text ?? ""}\`;
    }),
  ].join("\\n");
}

function renderNativePluginContract(data) {
  const summary = data?.summary ?? {};
  const contract = data?.contract ?? {};
  const governance = summary.governance ?? contract.governance ?? {};
  const capabilities = Array.isArray(contract.capabilities) ? contract.capabilities : [];
  const validation = data?.validation ?? {};
  nativePluginContractRegistry.textContent = data?.registry ?? "openclaw-native-plugin-contract-v0";
  nativePluginContractOwner.textContent = summary.runtimeOwner ?? governance.runtimeOwner ?? "unknown";
  nativePluginContractTotal.textContent = String(summary.totalCapabilities ?? capabilities.length);
  nativePluginContractApproval.textContent = String(summary.approvalRequired ?? 0);
  nativePluginContractMutation.textContent = String(summary.mutationCapable ?? 0);
  nativePluginContractValidation.textContent = validation.ok === true || summary.validationOk === true ? "valid" : "invalid";

  nativePluginContractJson.textContent = [
    "Contract-only native plugin boundary: no plugin code is imported, registered, activated, or executed here.",
    "This is the OpenClawOnNixOS-owned shape that absorbed OpenClaw ideas must satisfy before runtime use.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-contract-v0"}\`,
    \`Mode: \${data?.mode ?? "contract-only"}\`,
    \`Source Registry: \${data?.sourceRegistry ?? "openclaw-plugin-sdk-contract-review-v0"}\`,
    \`Runtime Owner: \${summary.runtimeOwner ?? governance.runtimeOwner ?? "unknown"}\`,
    \`Origin: \${summary.origin ?? governance.origin ?? "unknown"}\`,
    \`Capabilities: \${summary.totalCapabilities ?? capabilities.length}\`,
    \`Approval Required: \${summary.approvalRequired ?? 0}\`,
    \`Mutation Capable: \${summary.mutationCapable ?? 0}\`,
    \`Execution Capable: \${summary.executionCapable ?? 0}\`,
    \`Validation: \${validation.ok === true || summary.validationOk === true ? "ok" : "failed"} issues=\${summary.issueCount ?? validation.issues?.length ?? 0}\`,
    \`Governance: externalRuntimeDependencyAllowed=\${Boolean(governance.externalRuntimeDependencyAllowed)} sourceContentImported=\${Boolean(governance.sourceContentImported)} executeDuringRegistration=\${Boolean(governance.canExecuteDuringRegistration)}\`,
    \`By Risk: \${Object.entries(summary.byRisk ?? {}).map(([risk, count]) => \`\${risk}=\${count}\`).join(", ") || "none"}\`,
    \`By Kind: \${Object.entries(summary.byKind ?? {}).map(([kind, count]) => \`\${kind}=\${count}\`).join(", ") || "none"}\`,
    "",
    \`Guardrails: \${(summary.guardrails ?? []).join("; ") || "none"}\`,
    "",
    ...capabilities.slice(0, 8).map((capability) => {
      const permissions = capability.permissions ?? {};
      return \`[\${capability.risk ?? "unknown"}] \${capability.id ?? "capability"} kind=\${capability.kind ?? "unknown"} domains=\${(capability.domains ?? []).join(",") || "none"} approval=\${Boolean(capability.approval?.required)} audit=\${Boolean(capability.audit?.required)} command=\${Boolean(permissions.commandExecution)} mutate=\${Boolean(permissions.filesystemWrite || permissions.browserControl || permissions.screenControl || permissions.systemMutation)} owner=\${capability.runtimeOwner ?? "unknown"}\`;
    }),
  ].join("\\n");
}

function renderNativePluginRegistry(data) {
  const summary = data?.summary ?? {};
  const governance = summary.governance ?? data?.governance ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  const validation = data?.validation ?? {};
  nativePluginRegistryId.textContent = data?.registry ?? "openclaw-native-plugin-registry-v0";
  nativePluginRegistryTotal.textContent = String(summary.totalPlugins ?? items.length);
  nativePluginRegistryCapabilities.textContent = String(summary.totalCapabilities ?? 0);
  nativePluginRegistryActivation.textContent = data?.activationMode ?? "manual_adapter_required";
  nativePluginRegistryValidation.textContent = validation.ok === true || summary.validationOk === true ? "valid" : "invalid";

  nativePluginRegistryJson.textContent = [
    "Native registry: OpenClawOnNixOS-owned contracts that are eligible for adapter implementation.",
    "Runtime activation is still disabled here; this registry is the controlled starting line.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-registry-v0"}\`,
    \`Mode: \${data?.mode ?? "native-contract-registry"}\`,
    \`Runtime Owner: \${data?.runtimeOwner ?? "unknown"}\`,
    \`Activation Mode: \${data?.activationMode ?? "manual_adapter_required"}\`,
    \`Plugins: \${summary.totalPlugins ?? items.length}\`,
    \`Capabilities: \${summary.totalCapabilities ?? 0}\`,
    \`Approval Required: \${summary.approvalRequired ?? 0}\`,
    \`Mutation Capable: \${summary.mutationCapable ?? 0}\`,
    \`Execution Capable: \${summary.executionCapable ?? 0}\`,
    \`Validation: \${validation.ok === true || summary.validationOk === true ? "ok" : "failed"} issues=\${summary.issueCount ?? validation.issues?.length ?? 0}\`,
    \`Governance: externalRuntimeDependencyAllowed=\${Boolean(governance.externalRuntimeDependencyAllowed)} sourceContentImported=\${Boolean(governance.sourceContentImported)} canActivateRuntime=\${Boolean(governance.canActivateRuntime)}\`,
    "",
    \`Guardrails: \${(summary.guardrails ?? []).join("; ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((item) => {
      const plugin = item.contract?.plugin ?? {};
      const pluginSummary = summary.byPlugin?.[item.id] ?? {};
      return \`[\${item.status ?? "unknown"}] \${plugin.id ?? item.id ?? "plugin"} name=\${plugin.name ?? "unknown"} capabilities=\${pluginSummary.totalCapabilities ?? item.contract?.capabilities?.length ?? 0} approval=\${pluginSummary.approvalRequired ?? 0} mutate=\${pluginSummary.mutationCapable ?? 0} execute=\${pluginSummary.executionCapable ?? 0}\`;
    }),
  ].join("\\n");
}

function renderFormalIntegrationReadiness(data) {
  const summary = data?.summary ?? {};
  const gates = Array.isArray(data?.gates) ? data.gates : [];
  integrationReadinessRegistry.textContent = data?.registry ?? "openclaw-formal-integration-readiness-v0";
  integrationReadinessStatus.textContent = data?.status ?? "unknown";
  integrationReadinessRequired.textContent = \`\${summary.passedRequired ?? 0}/\${summary.requiredGates ?? 0}\`;
  integrationReadinessRuntime.textContent = summary.canActivateRuntime ? "enabled" : "disabled";
  integrationReadinessMode.textContent = data?.mode ?? "readiness-only";

  integrationReadinessJson.textContent = [
    "Readiness gate: formal adapter work may begin only after required governance gates pass.",
    "This does not import source, execute plugin code, activate runtime, create tasks, or create approvals.",
    \`Registry: \${data?.registry ?? "openclaw-formal-integration-readiness-v0"}\`,
    \`Mode: \${data?.mode ?? "readiness-only"}\`,
    \`Status: \${data?.status ?? "unknown"}\`,
    \`Ready For Formal Integration: \${Boolean(data?.readyForFormalIntegration)}\`,
    \`Required Gates: \${summary.passedRequired ?? 0}/\${summary.requiredGates ?? 0}\`,
    \`Runtime Activation: \${summary.canActivateRuntime ? "enabled" : "disabled"}\`,
    \`Import Source Content: \${Boolean(summary.canImportSourceContent)}\`,
    \`Execute Plugin Code: \${Boolean(summary.canExecutePluginCode)}\`,
    \`Creates Task: \${Boolean(summary.createsTask)} Creates Approval: \${Boolean(summary.createsApproval)}\`,
    \`Sources: \${(data?.sourceRegistries ?? []).join(", ") || "none"}\`,
    "",
    ...gates.map((gate) => {
      const required = gate.required ? "required" : "optional";
      return \`[\${gate.status ?? "unknown"}/\${required}] \${gate.id ?? "gate"} :: \${gate.evidence ?? "no evidence"}\`;
    }),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
    \`Forbidden Work: \${(summary.forbiddenWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderNativePluginAdapter(data) {
  const summary = data?.summary ?? {};
  nativePluginAdapterRegistry.textContent = data?.registry ?? "openclaw-native-plugin-adapter-v0";
  nativePluginAdapterStatus.textContent = data?.status ?? "unknown";
  nativePluginAdapterImplemented.textContent = String(summary.implemented ?? data?.implementedCapabilities?.length ?? 0);
  nativePluginAdapterRuntime.textContent = summary.canActivateRuntime ? "enabled" : "disabled";
  nativePluginAdapterMode.textContent = data?.mode ?? "native-adapter-shell";

  nativePluginAdapterJson.textContent = [
    "Native adapter shell: first real adapter capability is available, but runtime activation remains disabled.",
    "Implemented adapter reads only reviewed plugin SDK manifest metadata and never reads source contents or executes plugin code.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-adapter-v0"}\`,
    \`Mode: \${data?.mode ?? "native-adapter-shell"}\`,
    \`Status: \${data?.status ?? "unknown"}\`,
    \`Runtime Owner: \${data?.runtimeOwner ?? "unknown"}\`,
    \`Implemented: \${(data?.implementedCapabilities ?? []).join(", ") || "none"}\`,
    \`Pending: \${(data?.pendingCapabilities ?? []).join(", ") || "none"}\`,
    \`Read Manifest Metadata: \${Boolean(summary.canReadManifestMetadata)}\`,
    \`Read Source Content: \${Boolean(summary.canReadSourceFileContent)}\`,
    \`Execute Plugin Code: \${Boolean(summary.canExecutePluginCode)}\`,
    \`Runtime Activation: \${summary.canActivateRuntime ? "enabled" : "disabled"}\`,
    \`Creates Task: \${Boolean(summary.createsTask)} Creates Approval: \${Boolean(summary.createsApproval)}\`,
    "",
    \`Guardrails: \${(data?.guardrails ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderNativePluginPreflight(data) {
  const governance = data?.governance ?? {};
  const envelope = data?.executionEnvelope ?? {};
  const adapter = data?.adapter ?? {};
  const capability = data?.capability ?? {};
  const approval = envelope.approval ?? {};
  const constraints = envelope.constraints ?? {};
  nativePluginPreflightRegistry.textContent = data?.registry ?? "openclaw-native-plugin-runtime-preflight-v0";
  nativePluginPreflightEnvelope.textContent = envelope.envelopeVersion ?? "unknown";
  nativePluginPreflightApproval.textContent = approval.required ? "required" : "not required";
  nativePluginPreflightRuntime.textContent = adapter.canActivateRuntime ? "enabled" : "disabled";
  nativePluginPreflightMode.textContent = data?.mode ?? "preflight-only";

  nativePluginPreflightJson.textContent = [
    "Runtime preflight: builds the governed execution envelope before any plugin module can be loaded.",
    "This still does not create tasks, create approvals, import modules, execute plugin code, mutate state, or activate runtime.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-runtime-preflight-v0"}\`,
    \`Mode: \${data?.mode ?? "preflight-only"}\`,
    \`Envelope: \${envelope.envelopeVersion ?? "unknown"} state=\${envelope.state ?? "unknown"}\`,
    \`Adapter: \${adapter.id ?? "unknown"} status=\${adapter.status ?? "unknown"} owner=\${adapter.runtimeOwner ?? "unknown"}\`,
    \`Plugin: \${data?.plugin?.id ?? "unknown"} package=\${data?.plugin?.packageName ?? "unknown"}\`,
    \`Capability: \${capability.id ?? "unknown"} risk=\${capability.risk ?? "unknown"} approval=\${Boolean(capability.approvalRequired)}\`,
    \`Policy: \${envelope.policyDecision?.decision ?? "unknown"} reason=\${envelope.policyDecision?.reason ?? "none"}\`,
    \`Audit: required=\${Boolean(envelope.audit?.required)} ledger=\${envelope.audit?.ledger ?? "unknown"}\`,
    \`Constraints: importModule=\${Boolean(constraints.canImportModule)} executePlugin=\${Boolean(constraints.canExecutePluginCode)} activateRuntime=\${Boolean(constraints.canActivateRuntime)} mutate=\${Boolean(constraints.canMutate)}\`,
    \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} readSource=\${Boolean(governance.canReadSourceFileContent)} exposesScripts=\${Boolean(governance.exposesScriptBodies)} exposesDeps=\${Boolean(governance.exposesDependencyVersions)}\`,
  ].join("\\n");
}

function renderNativePluginActivationPlan(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const gates = Array.isArray(data?.gates) ? data.gates : [];
  const envelope = data?.executionEnvelope ?? {};
  nativePluginActivationRegistry.textContent = data?.registry ?? "openclaw-native-plugin-runtime-activation-plan-v0";
  nativePluginActivationStatus.textContent = data?.status ?? "unknown";
  nativePluginActivationRequired.textContent = \`\${summary.passedRequired ?? 0}/\${summary.requiredGates ?? 0}\`;
  nativePluginActivationRuntime.textContent = summary.canActivateRuntime ? "enabled" : "disabled";
  nativePluginActivationMode.textContent = data?.mode ?? "activation-plan-only";

  nativePluginActivationJson.textContent = [
    "Runtime activation plan: records the remaining gates before native plugin runtime can be activated.",
    "This still does not create tasks, create approvals, import modules, execute plugin code, or activate runtime.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-runtime-activation-plan-v0"}\`,
    \`Mode: \${data?.mode ?? "activation-plan-only"}\`,
    \`Status: \${data?.status ?? "unknown"} activationReady=\${Boolean(data?.activationReady)}\`,
    \`Required Gates: \${summary.passedRequired ?? 0}/\${summary.requiredGates ?? 0} blocked=\${summary.blockedRequired ?? 0}\`,
    \`Envelope: \${envelope.envelopeVersion ?? "unknown"} state=\${envelope.state ?? "unknown"}\`,
    \`Runtime Activation: \${summary.canActivateRuntime ? "enabled" : "disabled"} importModule=\${Boolean(summary.canImportModule)} executePlugin=\${Boolean(summary.canExecutePluginCode)}\`,
    \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} readSource=\${Boolean(governance.canReadSourceFileContent)} exposesScripts=\${Boolean(governance.exposesScriptBodies)} exposesDeps=\${Boolean(governance.exposesDependencyVersions)}\`,
    "",
    ...gates.map((gate) => {
      const required = gate.required ? "required" : "optional";
      return \`[\${gate.status ?? "unknown"}/\${required}] \${gate.id ?? "gate"} :: \${gate.evidence ?? "no evidence"}\`;
    }),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
    \`Forbidden Work: \${(summary.forbiddenWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderNativePluginRuntimeAdapterContract(data) {
  const summary = data?.summary ?? {};
  const governance = data?.governance ?? {};
  const contract = data?.runtimeContract ?? {};
  const checks = Array.isArray(data?.checks) ? data.checks : [];
  nativePluginRuntimeContractRegistry.textContent = data?.registry ?? "openclaw-native-plugin-runtime-adapter-contract-v0";
  nativePluginRuntimeContractStatus.textContent = data?.status ?? "unknown";
  nativePluginRuntimeContractRequired.textContent = \`\${summary.passedRequired ?? 0}/\${summary.requiredChecks ?? 0}\`;
  nativePluginRuntimeContractRuntime.textContent = summary.canActivateRuntime ? "enabled" : "disabled";
  nativePluginRuntimeContractMode.textContent = data?.mode ?? "runtime-adapter-contract";

  nativePluginRuntimeContractJson.textContent = [
    "Native runtime adapter contract: defines the sandboxed loader boundary before any plugin module can be loaded.",
    "This is contract-only: it creates no task, approval, module import, plugin execution, runtime activation, or mutation.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-runtime-adapter-contract-v0"}\`,
    \`Mode: \${data?.mode ?? "runtime-adapter-contract"}\`,
    \`Status: \${data?.status ?? "unknown"} adapterReady=\${Boolean(summary.adapterContractReady)} activationReady=\${Boolean(data?.activationReady)}\`,
    \`Required Checks: \${summary.passedRequired ?? 0}/\${summary.requiredChecks ?? 0} blocked=\${summary.blockedRequired ?? 0}\`,
    \`Plugin: \${data?.plugin?.id ?? "unknown"} package=\${data?.plugin?.packageName ?? "unknown"} capability=\${data?.capability?.id ?? "unknown"}\`,
    \`Contract: \${contract.contractVersion ?? "unknown"} state=\${contract.state ?? "unknown"} approvalRequired=\${Boolean(contract.approval?.required)} collected=\${Boolean(contract.approval?.collected)}\`,
    \`Isolation: process=\${Boolean(contract.isolation?.processIsolationRequired)} oldModuleImport=\${Boolean(contract.isolation?.oldOpenClawModuleImportAllowed)} pluginImport=\${Boolean(contract.isolation?.pluginModuleImportAllowed)} secretsMounted=\${Boolean(contract.isolation?.secretsMounted)}\`,
    \`Execution: import=\${Boolean(contract.execution?.canImportModule)} pluginCode=\${Boolean(contract.execution?.canExecutePluginCode)} activateRuntime=\${Boolean(contract.execution?.canActivateRuntime)} mutate=\${Boolean(contract.execution?.canMutate)}\`,
    \`Privacy: readme=\${Boolean(contract.privacy?.readmeContentExposed)} source=\${Boolean(contract.privacy?.sourceFileContentExposed)} scripts=\${Boolean(contract.privacy?.scriptBodiesExposed)} deps=\${Boolean(contract.privacy?.dependencyVersionsExposed)} packageVersion=\${Boolean(contract.privacy?.packageVersionExposed)}\`,
    \`Governance: task=\${Boolean(governance.createsTask)} approval=\${Boolean(governance.createsApproval)} readSource=\${Boolean(governance.canReadSourceFileContent)} import=\${Boolean(governance.canImportModule)} execute=\${Boolean(governance.canExecutePluginCode)} runtime=\${Boolean(governance.canActivateRuntime)}\`,
    "",
    ...checks.map((check) => {
      const required = check.required ? "required" : "optional";
      return \`[\${check.status ?? "unknown"}/\${required}] \${check.id ?? "check"} :: \${check.evidence ?? "no evidence"}\`;
    }),
    "",
    \`Next Allowed Work: \${(summary.nextAllowedWork ?? []).join("; ") || "none"}\`,
    \`Forbidden Work: \${(summary.forbiddenWork ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderNativePluginInvokePlan(data) {
  const governance = data?.governance ?? {};
  const policyDecision = data?.policy?.decision ?? {};
  const capability = data?.capability ?? {};
  const plugin = data?.plugin ?? {};
  const steps = Array.isArray(data?.draft?.steps) ? data.draft.steps : [];
  nativePluginInvokePlanRegistry.textContent = data?.registry ?? "openclaw-native-plugin-invoke-plan-v0";
  nativePluginInvokePlanCapability.textContent = capability.id ?? "act.plugin.capability.invoke";
  nativePluginInvokePlanDecision.textContent = policyDecision.decision ?? "unknown";
  nativePluginInvokePlanRuntime.textContent = governance.canActivateRuntime ? "enabled" : "disabled";
  nativePluginInvokePlanMode.textContent = data?.mode ?? "plan-only";

  nativePluginInvokePlanJson.textContent = [
    "Plan-only draft for high-risk plugin capability invocation; no task, approval, runtime activation, or plugin execution is created here.",
    "This is the approval-gate shape that future runtime adapter work must pass through.",
    \`Registry: \${data?.registry ?? "openclaw-native-plugin-invoke-plan-v0"}\`,
    \`Mode: \${data?.mode ?? "plan-only"}\`,
    \`Plugin: \${plugin.id ?? "unknown"} package=\${plugin.packageName ?? "unknown"}\`,
    \`Capability: \${capability.id ?? "unknown"} risk=\${capability.risk ?? "unknown"} approval=\${Boolean(capability.approvalRequired)}\`,
    \`Policy: \${policyDecision.decision ?? "unknown"} reason=\${policyDecision.reason ?? "none"} domain=\${policyDecision.domain ?? "unknown"}\`,
    \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executePlugin=\${Boolean(governance.canExecutePluginCode)} activateRuntime=\${Boolean(governance.canActivateRuntime)} readSource=\${Boolean(governance.canReadSourceFileContent)}\`,
    \`Manifest Metadata: exports=\${(plugin.exportKeys ?? []).join(",") || "none"} scripts=\${(plugin.scriptNames ?? []).join(",") || "none"} deps=\${plugin.dependencySummary?.dependencies ?? 0}\`,
    "",
    ...steps.map((step) => \`[\${step.status ?? "unknown"}] \${step.id ?? "step"} execute=\${Boolean(step.canExecute)}\`),
    "",
    \`Blockers: \${(data?.blockers ?? []).join("; ") || "none"}\`,
  ].join("\\n");
}

function renderWorkspaceCommandProposals(data) {
  const summary = data?.summary ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  workspaceCommandRegistry.textContent = data?.registry ?? "workspace-command-proposals-v0";
  workspaceCommandTotal.textContent = String(summary.total ?? data?.count ?? 0);
  workspaceCommandValidation.textContent = String(summary.byCategory?.validation ?? 0);
  workspaceCommandBuild.textContent = String(summary.byCategory?.build ?? 0);
  workspaceCommandRuntime.textContent = String(summary.byCategory?.runtime ?? 0);
  workspaceCommandMode.textContent = data?.mode ?? "proposal-only";

  workspaceCommandJson.textContent = [
    "Proposal-only: command shapes are visible, execution remains disabled here.",
    "Script bodies are not displayed.",
    \`Registry: \${data?.registry ?? "workspace-command-proposals-v0"}\`,
    \`Mode: \${data?.mode ?? "proposal-only"}\`,
    \`Total: \${summary.total ?? data?.count ?? 0}\`,
    \`Workspaces: \${summary.workspaces ?? 0}\`,
    \`By Package Manager: \${Object.entries(summary.byPackageManager ?? {}).map(([manager, count]) => \`\${manager}=\${count}\`).join(", ") || "none"}\`,
    \`By Category: \${Object.entries(summary.byCategory ?? {}).map(([category, count]) => \`\${category}=\${count}\`).join(", ") || "none"}\`,
    \`By Risk: \${Object.entries(summary.byRisk ?? {}).map(([risk, count]) => \`\${risk}=\${count}\`).join(", ") || "none"}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      const commandShape = [entry.command, ...(Array.isArray(entry.args) ? entry.args : [])].filter(Boolean).join(" ");
      const governance = entry.governance ?? {};
      return \`[\${entry.risk ?? "unknown"}] \${entry.workspaceName ?? "workspace"}:\${entry.scriptName ?? "script"} \${commandShape} cwd=\${entry.cwd ?? "unknown"} execute=\${Boolean(governance.canExecute)} approval=\${Boolean(governance.requiresExplicitExecutionApproval)} scriptBody=\${Boolean(governance.exposesScriptBody)}\`;
    }),
  ].join("\\n");
}

function renderSourceCommandProposals(data) {
  const summary = data?.summary ?? {};
  const signals = data?.sourceCommandSignals ?? {};
  const toolSignals = signals.toolSignals ?? {};
  const promptSignals = signals.promptSignals ?? {};
  const items = Array.isArray(data?.items) ? data.items : [];
  sourceCommandRegistry.textContent = data?.registry ?? "openclaw-source-command-proposals-v0";
  sourceCommandTotal.textContent = String(summary.total ?? data?.count ?? 0);
  sourceCommandTools.textContent = String(summary.matchedTools ?? toolSignals.matchedTools ?? 0);
  sourceCommandPrompts.textContent = String(summary.promptSemanticFiles ?? promptSignals.matchedFiles ?? 0);
  sourceCommandMode.textContent = data?.mode ?? "proposal-only-source-absorbed";

  sourceCommandJson.textContent = [
    "Source-derived command proposals: enhanced OpenClaw tool/prompt signals are absorbed into command proposal metadata only.",
    "No command is executed, no task is created, and script/prompt/source bodies remain hidden.",
    \`Registry: \${data?.registry ?? "openclaw-source-command-proposals-v0"}\`,
    \`Mode: \${data?.mode ?? "proposal-only-source-absorbed"}\`,
    \`Source Registry: \${data?.sourceRegistry ?? "workspace-command-proposals-v0"}\`,
    \`Query: \${data?.query?.text ?? "command"} limit=\${data?.query?.limit ?? 12}\`,
    \`Total: \${summary.total ?? data?.count ?? 0}\`,
    \`Source Signals: registry=\${signals.registry ?? "openclaw-source-command-proposals-v0"} tools=\${toolSignals.matchedTools ?? 0} docs=\${toolSignals.matchedDocumentation ?? 0} promptFiles=\${promptSignals.matchedFiles ?? 0} commandVocabularyFiles=\${promptSignals.commandVocabularyFiles ?? 0}\`,
    \`Governance: execute=\${Boolean(data?.governance?.canExecute)} mutate=\${Boolean(data?.governance?.canMutate)} createsTask=\${Boolean(data?.governance?.createsTask)} createsApproval=\${Boolean(data?.governance?.createsApproval)} scriptBody=\${Boolean(data?.governance?.exposesScriptBodies)} prompt=\${Boolean(data?.governance?.exposesPromptContent)} source=\${Boolean(data?.governance?.exposesSourceFileContent)}\`,
    "",
    ...items.slice(0, 8).map((entry) => {
      const commandShape = [entry.command, ...(Array.isArray(entry.args) ? entry.args : [])].filter(Boolean).join(" ");
      const sourceCommand = entry.sourceCommand ?? {};
      const governance = entry.governance ?? {};
      return \`[\${entry.risk ?? "unknown"}] \${entry.workspaceName ?? "workspace"}:\${entry.scriptName ?? "script"} \${commandShape} source=\${sourceCommand.registry ?? "none"} absorbed=\${Boolean(sourceCommand.absorbedFromEnhancedOpenClaw)} execute=\${Boolean(governance.canExecute)} task=\${Boolean(governance.canCreateTaskFromSourceAbsorption)} approval=\${Boolean(governance.requiresExplicitExecutionApproval)} scriptBody=\${Boolean(governance.exposesScriptBody)}\`;
    }),
  ].join("\\n");
}

function renderSourceCommandPlanDraft(data) {
  const proposal = data?.sourceCommandProposal ?? data?.proposal ?? {};
  const sourceCommandPlan = data?.sourceCommandPlan ?? {};
  const signals = data?.sourceCommandSignals ?? {};
  const draft = data?.draft ?? {};
  const governance = data?.governance ?? draft.governance ?? {};
  const policyDecision = draft.policy?.decision ?? {};
  const action = draft.action ?? {};
  const params = action.params ?? {};
  const commandShape = [params.command, ...(Array.isArray(params.args) ? params.args : [])].filter(Boolean).join(" ");
  sourceCommandPlanRegistry.textContent = data?.registry ?? "openclaw-source-command-plan-draft-v0";
  sourceCommandPlanProposal.textContent = proposal.id ?? "none";
  sourceCommandPlanDecision.textContent = policyDecision.decision ?? "unknown";
  sourceCommandPlanTask.textContent = String(governance.createsTask ?? false);
  sourceCommandPlanMode.textContent = data?.mode ?? "plan-only-source-command";

  sourceCommandPlanJson.textContent = [
    "Source-derived command plan: converts enhanced OpenClaw command proposal metadata into an inert approval-gated plan draft.",
    "No task, approval, shell, or process execution is created here.",
    \`Registry: \${data?.registry ?? "openclaw-source-command-plan-draft-v0"}\`,
    \`Mode: \${data?.mode ?? "plan-only-source-command"}\`,
    \`Source Registry: \${data?.sourceRegistry ?? "openclaw-source-command-proposals-v0"}\`,
    \`Proposal: \${proposal.id ?? "none"} source=\${proposal.sourceCommand?.registry ?? "none"} absorbed=\${Boolean(proposal.sourceCommand?.absorbedFromEnhancedOpenClaw)}\`,
    \`Command: \${commandShape || "none"} cwd=\${params.cwd ?? "unknown"} shell=\${Boolean(sourceCommandPlan.commandShape?.usesShell)}\`,
    \`Policy: \${policyDecision.decision ?? "unknown"} reason=\${policyDecision.reason ?? "none"} risk=\${policyDecision.risk ?? proposal.risk ?? "unknown"}\`,
    \`Signals: registry=\${signals.registry ?? "openclaw-source-command-proposals-v0"} tools=\${signals.toolSignals?.matchedTools ?? 0} prompts=\${signals.promptSignals?.matchedFiles ?? 0} commandVocabulary=\${signals.promptSignals?.commandVocabularyFiles ?? 0}\`,
    \`Governance: execute=\${Boolean(governance.canExecute)} mutate=\${Boolean(governance.canMutate)} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} scriptBody=\${Boolean(governance.exposesScriptBodies ?? governance.exposesScriptBody)} prompt=\${Boolean(governance.exposesPromptContent)} source=\${Boolean(governance.exposesSourceFileContent)} explicitApproval=\${Boolean(governance.requiresExplicitApprovalBeforeExecution ?? governance.requiresExplicitApproval)}\`,
    \`Capabilities: \${(draft.plan?.capabilitySummary?.ids ?? []).join(", ") || "none"}\`,
    \`Approval Gates: \${draft.plan?.capabilitySummary?.approvalGates ?? 0}\`,
  ].join("\\n");
}

function renderWorkspaceCommandPlanDraft(data) {
  const draft = data?.draft ?? {};
  const proposal = data?.proposal ?? {};
  const governance = draft.governance ?? {};
  const policyDecision = draft.policy?.decision ?? {};
  const action = draft.action ?? {};
  const params = action.params ?? {};
  const commandShape = [params.command, ...(Array.isArray(params.args) ? params.args : [])].filter(Boolean).join(" ");
  workspaceCommandPlanRegistry.textContent = data?.registry ?? "workspace-command-plan-draft-v0";
  workspaceCommandPlanProposal.textContent = proposal.id ?? "none";
  workspaceCommandPlanDecision.textContent = policyDecision.decision ?? "unknown";
  workspaceCommandPlanApproval.textContent = governance.requiresExplicitApproval ? "required" : "not required";
  workspaceCommandPlanTask.textContent = String(governance.createsTask ?? false);
  workspaceCommandPlanMode.textContent = data?.mode ?? "plan-only";

  workspaceCommandPlanJson.textContent = [
    "Plan-only draft: no task, approval, or command execution is created.",
    "Script bodies are not displayed.",
    \`Registry: \${data?.registry ?? "workspace-command-plan-draft-v0"}\`,
    \`Mode: \${data?.mode ?? "plan-only"}\`,
    \`Proposal: \${proposal.id ?? "none"}\`,
    \`Command: \${commandShape || "none"}\`,
    \`Cwd: \${params.cwd ?? "unknown"}\`,
    \`Policy: \${policyDecision.decision ?? "unknown"} reason=\${policyDecision.reason ?? "none"} risk=\${policyDecision.risk ?? proposal.risk ?? "unknown"}\`,
    \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} execute=\${Boolean(governance.canExecute)} explicitApproval=\${Boolean(governance.requiresExplicitApproval)} scriptBody=\${Boolean(governance.exposesScriptBody)}\`,
    \`Capabilities: \${(draft.plan?.capabilitySummary?.ids ?? []).join(", ") || "none"}\`,
    \`Approval Gates: \${draft.plan?.capabilitySummary?.approvalGates ?? 0}\`,
  ].join("\\n");
}

function renderOperatorPanel(result) {
  if (!result) {
    renderOperatorState(null);
    operatorLoopRan.textContent = "none";
    operatorLoopCount.textContent = "0";
    operatorLoopJson.textContent = "No operator run yet.";
    return;
  }

  const steps = Array.isArray(result.steps) ? result.steps : result.task ? [result] : [];
  const operator = result.operator ?? null;
  const nextTask = result.nextTask ?? operator?.nextTask ?? null;
  const latestCommandTranscript = steps
    .map((step) => step.execution?.commandTranscript)
    .find((transcript) => Array.isArray(transcript) && transcript.length > 0);
  renderOperatorState({
    status: operator?.status ?? (result.blocked ? "paused" : result.ran ? "ran" : "idle"),
    blocked: result.blocked ?? operator?.blocked ?? false,
    nextTask,
  });
  operatorLoopRan.textContent = result.ran ? "yes" : "no";
  operatorLoopCount.textContent = String(result.count ?? steps.length);
  operatorLoopJson.textContent = [
    \`Ran: \${Boolean(result.ran)}\`,
    \`Blocked: \${Boolean(result.blocked ?? operator?.blocked)}\`,
    \`Reason: \${result.reason ?? operator?.reason ?? "none"}\`,
    \`Steps: \${result.count ?? steps.length}\`,
    \`Runtime: \${result.summary?.runtime?.status ?? result.summary?.status ?? "unknown"}\`,
    \`Next Task: \${nextTask?.id ?? "none"}\`,
    "",
    ...steps.map((step, index) => {
      const task = step.task ?? null;
      const verification = step.execution?.verification ?? null;
      return \`\${index + 1}. \${task?.id ?? "no-task"} \${task?.status ?? "idle"} phase=\${task?.executionPhase ?? "none"} \${task?.targetUrl ?? ""} verification=\${verification?.ok ?? "n/a"}\`;
    }),
  ].join("\\n");
  if (latestCommandTranscript) {
    renderCommandTranscript(latestCommandTranscript, { source: "operator" });
  }
}

async function refreshOperatorState() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/operator/state\`);
    renderOperatorState(data.operator);
    if (operatorLoopJson.textContent === "No operator run yet." || operatorLoopJson.textContent === "Unable to read operator state.") {
      operatorLoopJson.textContent = [
        \`Status: \${data.operator?.status ?? "idle"}\`,
        \`Blocked: \${Boolean(data.operator?.blocked)}\`,
        \`Reason: \${data.operator?.reason ?? "none"}\`,
        \`Next Task: \${data.operator?.nextTask?.id ?? "none"}\`,
      ].join("\\n");
    }
  } catch {
    operatorLoopStatus.textContent = "offline";
    operatorLoopBlocked.textContent = "unknown";
    operatorLoopNext.textContent = "unknown";
    operatorLoopJson.textContent = "Unable to read operator state.";
  }
}

async function refreshPolicyState() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/policy/state\`);
    renderPolicyState(data.policy);
  } catch {
    policyEngine.textContent = "offline";
    policyDecision.textContent = "unknown";
    policyDomain.textContent = "unknown";
    policyJson.textContent = "Unable to read policy state.";
  }
}

async function refreshApprovalState() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/approvals?limit=10\`);
    renderApprovalState(data);
  } catch {
    latestPendingApproval = null;
    approvalPendingCount.textContent = "0";
    approvalLatest.textContent = "unknown";
    approvalJson.textContent = "Unable to read approval inbox.";
  }
}

async function refreshCapabilityState() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/capabilities\`);
    renderCapabilityState(data);
  } catch {
    capabilityRegistry.textContent = "offline";
    capabilityOnline.textContent = "0";
    capabilityApproval.textContent = "unknown";
    capabilityJson.textContent = "Unable to read body capabilities.";
  }
}

async function refreshCapabilityHistory() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/capabilities/invocations?limit=8\`);
    renderCapabilityHistory(data);
  } catch {
    capabilityHistoryTotal.textContent = "0";
    capabilityHistoryInvoked.textContent = "0";
    capabilityHistoryBlocked.textContent = "0";
    capabilityHistoryLatest.textContent = "unknown";
    capabilityHistoryJson.textContent = "Unable to read capability invocation history.";
  }
}

async function refreshCommandLedger() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/commands/transcripts?limit=8\`);
    renderCommandLedger(data);
  } catch {
    commandLedgerTotal.textContent = "0";
    commandLedgerExecuted.textContent = "0";
    commandLedgerFailed.textContent = "0";
    commandLedgerSkipped.textContent = "0";
    commandLedgerTasks.textContent = "unknown";
    commandLedgerJson.textContent = "Unable to read command transcript ledger.";
  }
}

async function refreshFilesystemLedger() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/filesystem/changes?limit=8\`);
    renderFilesystemLedger(data);
  } catch {
    filesystemLedgerTotal.textContent = "0";
    filesystemLedgerMkdir.textContent = "0";
    filesystemLedgerWrites.textContent = "0";
    filesystemLedgerTasks.textContent = "unknown";
    filesystemLedgerJson.textContent = "Unable to read filesystem change ledger.";
  }
}

async function refreshFilesystemReadLedger() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/filesystem/reads?limit=8\`);
    renderFilesystemReadLedger(data);
  } catch {
    filesystemReadLedgerTotal.textContent = "0";
    filesystemReadLedgerMetadata.textContent = "0";
    filesystemReadLedgerQuery.textContent = "0";
    filesystemReadLedgerReadText.textContent = "0";
    filesystemReadLedgerTasks.textContent = "unknown";
    filesystemReadLedgerJson.textContent = "Unable to read filesystem read ledger.";
  }
}

async function refreshWorkspaceRegistry() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/workspaces\`);
    renderWorkspaceRegistry(data);
  } catch {
    workspaceRegistry.textContent = "offline";
    workspaceDetected.textContent = "0";
    workspaceMissing.textContent = "unknown";
    workspaceNode.textContent = "0";
    workspaceMode.textContent = "unknown";
    workspaceJson.textContent = "Unable to read OpenClaw workspace registry.";
  }
}

async function refreshWorkspaceCommandProposals() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/command-proposals\`);
    renderWorkspaceCommandProposals(data);
  } catch {
    workspaceCommandRegistry.textContent = "offline";
    workspaceCommandTotal.textContent = "0";
    workspaceCommandValidation.textContent = "0";
    workspaceCommandBuild.textContent = "0";
    workspaceCommandRuntime.textContent = "0";
    workspaceCommandMode.textContent = "unknown";
    workspaceCommandJson.textContent = "Unable to read workspace command proposals.";
  }
}

async function refreshSourceCommandProposals() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/source-command-proposals?query=command&limit=12\`);
    renderSourceCommandProposals(data);
  } catch {
    sourceCommandRegistry.textContent = "offline";
    sourceCommandTotal.textContent = "0";
    sourceCommandTools.textContent = "0";
    sourceCommandPrompts.textContent = "0";
    sourceCommandMode.textContent = "unknown";
    sourceCommandJson.textContent = "Unable to read source-derived command proposals.";
  }
}

async function refreshSourceCommandPlanDraft() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/source-command-proposals/plan?proposalId=openclaw:typecheck&query=command\`);
    renderSourceCommandPlanDraft(data);
  } catch {
    sourceCommandPlanRegistry.textContent = "offline";
    sourceCommandPlanProposal.textContent = "none";
    sourceCommandPlanDecision.textContent = "unknown";
    sourceCommandPlanTask.textContent = "false";
    sourceCommandPlanMode.textContent = "unknown";
    sourceCommandPlanJson.textContent = "Unable to read source-derived command plan draft.";
  }
}

async function refreshWorkspaceMigrationMap() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/openclaw-migration-map\`);
    renderWorkspaceMigrationMap(data);
  } catch {
    workspaceMigrationRegistry.textContent = "offline";
    workspaceMigrationTotal.textContent = "0";
    workspaceMigrationCapabilities.textContent = "0";
    workspaceMigrationHigh.textContent = "0";
    workspaceMigrationMode.textContent = "unknown";
    workspaceMigrationJson.textContent = "Unable to read OpenClaw source migration map.";
  }
}

async function refreshWorkspaceMigrationPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/openclaw-migration-plan\`);
    renderWorkspaceMigrationPlan(data);
  } catch {
    workspaceMigrationPlanRegistry.textContent = "offline";
    workspaceMigrationPlanTotal.textContent = "0";
    workspaceMigrationPlanCandidates.textContent = "0";
    workspaceMigrationPlanBacklog.textContent = "0";
    workspaceMigrationPlanMode.textContent = "unknown";
    workspaceMigrationPlanJson.textContent = "Unable to read OpenClaw source migration plan.";
  }
}

async function refreshPluginSdkContractReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/openclaw-plugin-sdk-contract-review\`);
    renderPluginSdkContractReview(data);
  } catch {
    pluginSdkReviewRegistry.textContent = "offline";
    pluginSdkReviewTotal.textContent = "0";
    pluginSdkReviewManifest.textContent = "0";
    pluginSdkReviewTypes.textContent = "0";
    pluginSdkReviewExports.textContent = "0";
    pluginSdkReviewMode.textContent = "unknown";
    pluginSdkReviewJson.textContent = "Unable to read plugin SDK contract review.";
  }
}

async function refreshPluginSdkSourceReviewScope() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/openclaw-plugin-sdk-source-review-scope\`);
    renderPluginSdkSourceReviewScope(data);
  } catch {
    pluginSdkSourceScopeRegistry.textContent = "offline";
    pluginSdkSourceScopeTotal.textContent = "0";
    pluginSdkSourceScopeContent.textContent = "unknown";
    pluginSdkSourceScopeApproval.textContent = "unknown";
    pluginSdkSourceScopeMode.textContent = "unknown";
    pluginSdkSourceScopeJson.textContent = "Unable to read plugin SDK source review scope.";
  }
}

async function refreshPluginSdkSourceContentReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/openclaw-plugin-sdk-source-content-review\`);
    renderPluginSdkSourceContentReview(data);
  } catch {
    pluginSdkSourceContentRegistry.textContent = "offline";
    pluginSdkSourceContentRead.textContent = "0";
    pluginSdkSourceContentExports.textContent = "0";
    pluginSdkSourceContentRaw.textContent = "unknown";
    pluginSdkSourceContentMode.textContent = "unknown";
    pluginSdkSourceContentJson.textContent = "Unable to read plugin SDK source content review.";
  }
}

async function refreshPluginSdkNativeContractTests() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/openclaw-plugin-sdk-native-contract-tests\`);
    renderPluginSdkNativeContractTests(data);
  } catch {
    pluginSdkNativeTestsRegistry.textContent = "offline";
    pluginSdkNativeTestsRequired.textContent = "0/0";
    pluginSdkNativeTestsSource.textContent = "0";
    pluginSdkNativeTestsCaps.textContent = "0";
    pluginSdkNativeTestsMode.textContent = "unknown";
    pluginSdkNativeTestsJson.textContent = "Unable to read plugin SDK native contract tests.";
  }
}

async function refreshNativeSdkContractImplementation() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/openclaw-native-plugin-sdk-contract-implementation\`);
    renderNativeSdkContractImplementation(data);
  } catch {
    nativeSdkImplementationRegistry.textContent = "offline";
    nativeSdkImplementationSlots.textContent = "0/0";
    nativeSdkImplementationReadOnly.textContent = "0";
    nativeSdkImplementationExecutable.textContent = "0";
    nativeSdkImplementationMode.textContent = "unknown";
    nativeSdkImplementationJson.textContent = "Unable to read native SDK contract implementation.";
  }
}

async function refreshOpenClawToolCatalog() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/openclaw-tool-catalog\`);
    renderOpenClawToolCatalog(data);
  } catch {
    openclawToolCatalogRegistry.textContent = "offline";
    openclawToolCatalogTools.textContent = "0";
    openclawToolCatalogDocs.textContent = "0";
    openclawToolCatalogCategories.textContent = "0";
    openclawToolCatalogMode.textContent = "unknown";
    openclawToolCatalogJson.textContent = "Unable to read OpenClaw tool catalog.";
  }
}

async function refreshPluginManifestMap() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/openclaw-plugin-manifest-map\`);
    renderPluginManifestMap(data);
  } catch {
    pluginManifestMapRegistry.textContent = "offline";
    pluginManifestMapManifests.textContent = "0";
    pluginManifestMapCategories.textContent = "0";
    pluginManifestMapAuth.textContent = "0";
    pluginManifestMapMode.textContent = "unknown";
    pluginManifestMapJson.textContent = "Unable to read OpenClaw plugin manifest map.";
  }
}

async function refreshPluginCapabilityPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-capability-plan?limit=40\`);
    renderPluginCapabilityPlan(data);
  } catch {
    pluginCapabilityPlanRegistry.textContent = "offline";
    pluginCapabilityPlanCandidates.textContent = "0";
    pluginCapabilityPlanBlocked.textContent = "0";
    pluginCapabilityPlanApproval.textContent = "0";
    pluginCapabilityPlanRuntime.textContent = "unknown";
    pluginCapabilityPlanJson.textContent = "Unable to read OpenClaw plugin capability plan.";
  }
}

async function refreshPluginCandidateContractTests() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-candidate-contract-tests?category=search_and_web&limit=8\`);
    renderPluginCandidateContractTests(data);
  } catch {
    pluginCandidateContractTestsRegistry.textContent = "offline";
    pluginCandidateContractTestsCategory.textContent = "unknown";
    pluginCandidateContractTestsRequired.textContent = "0/0";
    pluginCandidateContractTestsContracts.textContent = "0";
    pluginCandidateContractTestsRuntime.textContent = "unknown";
    pluginCandidateContractTestsJson.textContent = "Unable to read OpenClaw plugin candidate contract tests.";
  }
}

async function refreshPluginSearchWebAdapterContract() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-search-web-adapter-contract?limit=8\`);
    renderPluginSearchWebAdapterContract(data);
  } catch {
    pluginSearchWebContractRegistry.textContent = "offline";
    pluginSearchWebContractProviders.textContent = "0";
    pluginSearchWebContractRequired.textContent = "0/0";
    pluginSearchWebContractNetwork.textContent = "unknown";
    pluginSearchWebContractRuntime.textContent = "unknown";
    pluginSearchWebContractJson.textContent = "Unable to read OpenClaw search/web adapter contract.";
  }
}

async function refreshPluginSearchWebRuntimePreflight() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-search-web-adapter-runtime-preflight?providerContractId=openclaw.web-search&limit=8\`);
    renderPluginSearchWebRuntimePreflight(data);
  } catch {
    pluginSearchWebPreflightRegistry.textContent = "offline";
    pluginSearchWebPreflightEnvelope.textContent = "missing";
    pluginSearchWebPreflightApproval.textContent = "unknown";
    pluginSearchWebPreflightNetwork.textContent = "unknown";
    pluginSearchWebPreflightRuntime.textContent = "unknown";
    pluginSearchWebPreflightJson.textContent = "Unable to read OpenClaw search/web runtime preflight.";
  }
}

async function refreshPluginSearchWebRuntimeActivationPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-search-web-adapter-runtime-activation-plan?providerContractId=openclaw.web-search&limit=8\`);
    renderPluginSearchWebRuntimeActivationPlan(data);
  } catch {
    pluginSearchWebActivationRegistry.textContent = "offline";
    pluginSearchWebActivationStatus.textContent = "unknown";
    pluginSearchWebActivationRequired.textContent = "0/0";
    pluginSearchWebActivationNetwork.textContent = "unknown";
    pluginSearchWebActivationRuntime.textContent = "unknown";
    pluginSearchWebActivationJson.textContent = "Unable to read OpenClaw search/web runtime activation plan.";
  }
}

async function refreshPluginSearchWebProviderRuntimeSandbox() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox?providerContractId=openclaw.web-search&limit=8\`);
    renderPluginSearchWebProviderRuntimeSandbox(data);
  } catch {
    pluginSearchWebSandboxRegistry.textContent = "offline";
    pluginSearchWebSandboxStatus.textContent = "unknown";
    pluginSearchWebSandboxRequired.textContent = "0/0";
    pluginSearchWebSandboxNetwork.textContent = "unknown";
    pluginSearchWebSandboxRuntime.textContent = "unknown";
    pluginSearchWebSandboxJson.textContent = "Unable to read OpenClaw search/web provider runtime sandbox contract.";
  }
}

async function refreshToolCatalogAdapter() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/tool-catalog\`);
    renderToolCatalogAdapter(data);
  } catch {
    toolCatalogAdapterRegistry.textContent = "offline";
    toolCatalogAdapterMatches.textContent = "0";
    toolCatalogAdapterCategories.textContent = "0";
    toolCatalogAdapterExecution.textContent = "unknown";
    toolCatalogAdapterMode.textContent = "unknown";
    toolCatalogAdapterJson.textContent = "Unable to read native tool catalog adapter.";
  }
}

async function refreshSemanticIndex() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/workspace-semantic-index?scope=tools&limit=24\`);
    renderSemanticIndex(data);
  } catch {
    semanticIndexRegistry.textContent = "offline";
    semanticIndexFiles.textContent = "0";
    semanticIndexExports.textContent = "0";
    semanticIndexSource.textContent = "unknown";
    semanticIndexMode.textContent = "unknown";
    semanticIndexJson.textContent = "Unable to read native workspace semantic index.";
  }
}

async function refreshSymbolLookup() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/workspace-symbol-lookup?scope=tools&query=tool&limit=16\`);
    renderSymbolLookup(data);
  } catch {
    symbolLookupRegistry.textContent = "offline";
    symbolLookupMatches.textContent = "0";
    symbolLookupFiles.textContent = "0";
    symbolLookupExecution.textContent = "unknown";
    symbolLookupMode.textContent = "unknown";
    symbolLookupJson.textContent = "Unable to run native workspace symbol lookup.";
  }
}

async function refreshEditTargetSelection() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/workspace-edit-target-selection?scope=tools&query=edit&limit=8\`);
    renderEditTargetSelection(data);
  } catch {
    editTargetSelectionRegistry.textContent = "offline";
    editTargetSelectionCandidates.textContent = "0";
    editTargetSelectionSelected.textContent = "none";
    editTargetSelectionSource.textContent = "unknown";
    editTargetSelectionMode.textContent = "unknown";
    editTargetSelectionJson.textContent = "Unable to select native OpenClaw workspace edit targets.";
  }
}

async function refreshPromptSemantics() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/prompt-semantics?query=edit&limit=24\`);
    renderPromptSemantics(data);
  } catch {
    promptSemanticsRegistry.textContent = "offline";
    promptSemanticsFiles.textContent = "0";
    promptSemanticsChecks.textContent = "0";
    promptSemanticsContent.textContent = "unknown";
    promptSemanticsMode.textContent = "unknown";
    promptSemanticsJson.textContent = "Unable to read native OpenClaw prompt semantics.";
  }
}

async function refreshWorkspaceTextWriteDraft() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/workspace-text-write/draft?relativePath=scratch/observer-native-write.txt\`);
    renderWorkspaceTextWriteDraft(data);
  } catch {
    workspaceTextWriteRegistry.textContent = "offline";
    workspaceTextWriteCapability.textContent = "unknown";
    workspaceTextWriteApproval.textContent = "unknown";
    workspaceTextWriteContent.textContent = "unknown";
    workspaceTextWriteMode.textContent = "unknown";
    workspaceTextWriteJson.textContent = "Unable to read native workspace text write draft.";
  }
}

async function refreshWorkspacePatchApplyDraft() {
  try {
    const edits = encodeURIComponent(JSON.stringify([
      { search: "before", replacement: "after", occurrence: 1 },
      { search: "omega", replacement: "zeta", occurrence: 1 },
    ]));
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/source-authored-edit/draft?edits=\${edits}&proposalQuery=edit&targetSelectionQuery=edit&contextLines=0\`);
    renderWorkspacePatchApplyDraft(data);
  } catch {
    workspacePatchApplyRegistry.textContent = "offline";
    workspacePatchApplyCapability.textContent = "unknown";
    workspacePatchApplyApproval.textContent = "unknown";
    workspacePatchApplyPreview.textContent = "unknown";
    workspacePatchApplyMode.textContent = "unknown";
    workspacePatchApplyJson.textContent = "Unable to read native workspace patch apply draft.";
  }
}

async function refreshNativePluginContract() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/openclaw-native-plugin-contract\`);
    renderNativePluginContract(data);
  } catch {
    nativePluginContractRegistry.textContent = "offline";
    nativePluginContractOwner.textContent = "unknown";
    nativePluginContractTotal.textContent = "0";
    nativePluginContractApproval.textContent = "0";
    nativePluginContractMutation.textContent = "0";
    nativePluginContractValidation.textContent = "unknown";
    nativePluginContractJson.textContent = "Unable to read native plugin contract.";
  }
}

async function refreshNativePluginRegistry() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/openclaw-native-plugin-registry\`);
    renderNativePluginRegistry(data);
  } catch {
    nativePluginRegistryId.textContent = "offline";
    nativePluginRegistryTotal.textContent = "0";
    nativePluginRegistryCapabilities.textContent = "0";
    nativePluginRegistryActivation.textContent = "unknown";
    nativePluginRegistryValidation.textContent = "unknown";
    nativePluginRegistryJson.textContent = "Unable to read native plugin registry.";
  }
}

async function refreshFormalIntegrationReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/openclaw-formal-integration-readiness\`);
    renderFormalIntegrationReadiness(data);
  } catch {
    integrationReadinessRegistry.textContent = "offline";
    integrationReadinessStatus.textContent = "unknown";
    integrationReadinessRequired.textContent = "0/0";
    integrationReadinessRuntime.textContent = "unknown";
    integrationReadinessMode.textContent = "unknown";
    integrationReadinessJson.textContent = "Unable to read formal integration readiness.";
  }
}

async function refreshNativePluginAdapter() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/openclaw-native-plugin-adapter\`);
    renderNativePluginAdapter(data);
  } catch {
    nativePluginAdapterRegistry.textContent = "offline";
    nativePluginAdapterStatus.textContent = "unknown";
    nativePluginAdapterImplemented.textContent = "0";
    nativePluginAdapterRuntime.textContent = "unknown";
    nativePluginAdapterMode.textContent = "unknown";
    nativePluginAdapterJson.textContent = "Unable to read native plugin adapter.";
  }
}

async function refreshNativePluginPreflight() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/runtime-preflight\`);
    renderNativePluginPreflight(data);
  } catch {
    nativePluginPreflightRegistry.textContent = "offline";
    nativePluginPreflightEnvelope.textContent = "unknown";
    nativePluginPreflightApproval.textContent = "unknown";
    nativePluginPreflightRuntime.textContent = "unknown";
    nativePluginPreflightMode.textContent = "unknown";
    nativePluginPreflightJson.textContent = "Unable to read native plugin runtime preflight.";
  }
}

async function refreshNativePluginActivationPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/runtime-activation-plan\`);
    renderNativePluginActivationPlan(data);
  } catch {
    nativePluginActivationRegistry.textContent = "offline";
    nativePluginActivationStatus.textContent = "unknown";
    nativePluginActivationRequired.textContent = "0/0";
    nativePluginActivationRuntime.textContent = "unknown";
    nativePluginActivationMode.textContent = "unknown";
    nativePluginActivationJson.textContent = "Unable to read native plugin runtime activation plan.";
  }
}

async function refreshNativePluginRuntimeAdapterContract() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/runtime-adapter-contract\`);
    renderNativePluginRuntimeAdapterContract(data);
  } catch {
    nativePluginRuntimeContractRegistry.textContent = "offline";
    nativePluginRuntimeContractStatus.textContent = "unknown";
    nativePluginRuntimeContractRequired.textContent = "0/0";
    nativePluginRuntimeContractRuntime.textContent = "unknown";
    nativePluginRuntimeContractMode.textContent = "unknown";
    nativePluginRuntimeContractJson.textContent = "Unable to read native plugin runtime adapter contract.";
  }
}

async function refreshNativePluginInvokePlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/invoke-plan\`);
    renderNativePluginInvokePlan(data);
  } catch {
    nativePluginInvokePlanRegistry.textContent = "offline";
    nativePluginInvokePlanCapability.textContent = "unknown";
    nativePluginInvokePlanDecision.textContent = "unknown";
    nativePluginInvokePlanRuntime.textContent = "unknown";
    nativePluginInvokePlanMode.textContent = "unknown";
    nativePluginInvokePlanJson.textContent = "Unable to read native plugin invoke plan.";
  }
}

async function refreshWorkspaceCommandPlanDraft() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/command-proposals/plan?proposalId=openclaw:typecheck\`);
    renderWorkspaceCommandPlanDraft(data);
  } catch {
    workspaceCommandPlanRegistry.textContent = "offline";
    workspaceCommandPlanProposal.textContent = "unknown";
    workspaceCommandPlanDecision.textContent = "unknown";
    workspaceCommandPlanApproval.textContent = "unknown";
    workspaceCommandPlanTask.textContent = "false";
    workspaceCommandPlanMode.textContent = "unknown";
    workspaceCommandPlanJson.textContent = "Unable to read workspace command plan draft.";
  }
}

async function invokeCapabilityFromUi(kind) {
  const requests = {
    vitals: {
      capabilityId: "sense.system.vitals",
      intent: "system.observe",
    },
    process: {
      capabilityId: "sense.process.list",
      intent: "process.list",
      params: { limit: 10 },
    },
    commandDryRun: {
      capabilityId: "act.system.command.dry_run",
      intent: "system.command",
      params: { command: "rm", args: ["-rf", "/tmp/openclaw-danger"] },
    },
    approvedCommandDryRun: {
      capabilityId: "act.system.command.dry_run",
      intent: "system.command",
      approved: true,
      params: { command: "rm", args: ["-rf", "/tmp/openclaw-danger"] },
    },
  };
  const body = requests[kind];
  if (!body) {
    throw new Error(\`Unknown capability invocation kind: \${kind}\`);
  }

  const result = await fetchJson(\`\${observerConfig.coreUrl}/capabilities/invoke\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  renderCapabilityInvocation(result);
  setControlMessage(result.invoked
    ? \`Capability invoked: \${result.capability?.id ?? body.capabilityId}\`
    : \`Capability blocked: \${result.reason ?? "unknown"}\`);
  await refreshCapabilityState();
  await refreshCapabilityHistory();
  await refreshPolicyState();
  await refreshAuditState();
}

async function resolveLatestApproval(action) {
  if (!latestPendingApproval?.id) {
    throw new Error("No pending approval request.");
  }

  const result = await fetchJson(\`\${observerConfig.coreUrl}/approvals/\${latestPendingApproval.id}/\${action}\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      reason: action === "approve" ? "Approved from Observer UI." : "Denied from Observer UI.",
    }),
  });
  setControlMessage(\`Approval \${action} completed: \${result.approval?.id ?? latestPendingApproval.id}\`);
  await refreshApprovalState();
  await refreshPolicyState();
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshOperatorState();
}

function renderTaskSummary(task, { includeRecovery = true, includeOutcome = true } = {}) {
  if (!task) {
    return "No task selected.";
  }

  const taskLastAction = deriveTaskLastAction(task);
  const lines = [
    \`ID: \${task.id}\`,
    \`Goal: \${task.goal}\`,
    \`Type: \${task.type}\`,
    \`Status: \${task.status}\`,
    \`Phase: \${task.executionPhase ?? "queued"}\`,
    \`Target URL: \${task.targetUrl ?? "none"}\`,
    \`Work View Strategy: \${task.workViewStrategy ?? "none"}\`,
    \`Work View Session: \${task.workView?.sessionId ?? "none"}\`,
    \`Work View URL: \${task.workView?.activeUrl ?? "none"}\`,
    \`Work View: \${task.workView?.status ?? "none"} / \${task.workView?.visibility ?? "none"}\`,
    \`Policy: \${task.policy?.decision?.decision ?? "none"} / \${task.policy?.decision?.domain ?? "none"}\`,
    \`Task Lens: \${describeTaskRelationship(task)}\`,
  ];

  if (includeOutcome) {
    lines.push(\`Outcome: \${task.outcome?.kind ?? "open"}\${task.outcome?.summary ? \` - \${task.outcome.summary}\` : ""}\`);
    if (task.outcome?.reason) {
      lines.push(\`Failure Reason: \${task.outcome.reason}\`);
    }
    const taskVerification = task.outcome?.details?.verification ?? null;
    const taskWorkViewSummary = task.outcome?.details?.workViewSummary ?? taskVerification?.workViewSummary ?? null;
    const taskActionEvidence = task.outcome?.details?.actionEvidence ?? taskVerification?.actionEvidence ?? null;
    const taskRecoveryEvidence = task.outcome?.details?.recoveryEvidence ?? task.recovery?.recoveryEvidence ?? null;
    if (taskVerification) {
      lines.push(\`Verification: \${taskVerification.ok === true ? "passed" : taskVerification.ok === false ? "failed" : "unknown"}\`);
    }
    if (taskWorkViewSummary) {
      lines.push(\`Verification Work View Summary: \${taskWorkViewSummary.summaryText ?? "none"}\`);
      lines.push(\`Verification Work View URL: \${taskWorkViewSummary.url ?? "none"}\`);
      lines.push(\`Verification Visible Text: \${(taskWorkViewSummary.visibleTextBlocks ?? []).join(" | ") || "none"}\`);
    }
    if (taskActionEvidence) {
      lines.push(\`Action Evidence: \${taskActionEvidence.actionCount ?? 0} action(s), degraded=\${taskActionEvidence.degradedCount ?? 0}\`);
      lines.push(\`Action Evidence Observed URL: \${taskActionEvidence.observedAfterActions?.url ?? "none"}\`);
      lines.push(\`Action Evidence Kinds: \${(taskActionEvidence.actions ?? []).map((action) => action.kind).join(" -> ") || "none"}\`);
    }
    if (taskRecoveryEvidence) {
      lines.push(\`Recovery Evidence: \${taskRecoveryEvidence.reason ?? "none"}\`);
      lines.push(\`Recovery Evidence Observed URL: \${taskRecoveryEvidence.observedUrl ?? "none"}\`);
      lines.push(\`Recovery Recommendation: \${taskRecoveryEvidence.recommendation?.strategy ?? "none"} -> \${taskRecoveryEvidence.recommendation?.targetUrl ?? "none"}\`);
    }
  }

  if (includeRecovery) {
    lines.push(\`Recovery: \${task.recovery?.recoveredFromTaskId ? \`attempt \${task.recovery?.attempt ?? 1} from \${task.recovery.recoveredFromTaskId}\` : "original task"}\`);
    lines.push(\`Recovered By: \${task.recoveredByTaskId ?? "none"}\`);
    lines.push(\`Recoverable: \${task.restorable ? "yes" : "no"}\`);
  }

  if (task.plan) {
    const steps = Array.isArray(task.plan.steps) ? task.plan.steps : [];
    const completed = steps.filter((step) => step.status === "completed").length;
    lines.push(\`Plan: \${task.plan.strategy ?? "unknown"} / \${task.plan.status ?? "unknown"}\`);
    lines.push(\`Plan Steps: \${completed}/\${steps.length} completed\`);
  }

  lines.push(\`Last Action: \${taskLastAction?.kind ?? "none"}\${taskLastAction ? \` (degraded: \${taskLastAction.degraded})\` : ""}\`);
  lines.push(\`Recent Phases: \${(task.phaseHistory ?? []).slice(-4).map((entry) => entry.phase).join(" -> ") || "none"}\`);
  lines.push(\`Created: \${formatTimestamp(task.createdAt)}\`);
  lines.push(\`Updated: \${formatTimestamp(task.updatedAt)}\`);
  lines.push(\`Closed: \${formatTimestamp(task.closedAt)}\`);
  return lines.join("\\n");
}

function describeTaskRelationship(task) {
  if (!task) {
    return "none";
  }

  if (task.isCurrentTask) {
    return "current active task";
  }

  if (currentTaskState?.recovery?.recoveredFromTaskId === task.id) {
    return "ancestor of current recovered task";
  }

  if (task.recoveredByTaskId && task.recoveredByTaskId === currentTaskState?.id) {
    return "recovered into current active task";
  }

  if (task.isActive) {
    return "active task";
  }

  if (currentTaskState?.workView?.sessionId && task.workView?.sessionId === currentTaskState.workView.sessionId) {
    return "shares work view session with current task";
  }

  return "historical task";
}

function renderTaskSection(title, tasks) {
  if (!tasks.length) {
    return "";
  }

  return \`<section class="task-section">
    <h3>\${escapeHtml(title)}</h3>
    \${tasks.map((task) => renderTaskCard(task)).join("")}
  </section>\`;
}

function getDesiredWorkViewUrl() {
  return desiredWorkViewUrl || "https://example.com/work-view";
}

function getSelectedHistoryTaskId() {
  const value = taskDetailIdInput.value.trim();
  return value || null;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : { ok: false, error: await response.text() };

  if (!response.ok) {
    throw new Error(payload?.error ?? \`Request failed with status \${response.status}\`);
  }

  return payload;
}

function addEventItem(event) {
  const item = document.createElement("li");
  item.textContent = \`[\${event.timestamp}] \${event.type} from \${event.source}\`;
  eventsList.prepend(item);
  while (eventsList.children.length > 30) {
    eventsList.removeChild(eventsList.lastChild);
  }
}

async function refreshHealth() {
  try {
    const [core, hub, sessionManager, screen, screenAct, systemSense, systemHeal] = await Promise.all([
      fetchJson(\`\${observerConfig.coreUrl}/health\`),
      fetchJson(\`\${observerConfig.eventHubUrl}/health\`),
      fetchJson(\`\${observerConfig.sessionManagerUrl}/health\`),
      fetchJson(\`\${observerConfig.screenSenseUrl}/health\`),
      fetchJson(\`\${observerConfig.screenActUrl}/health\`),
      fetchJson(\`\${observerConfig.systemSenseUrl}/health\`),
      fetchJson(\`\${observerConfig.systemHealUrl}/health\`),
    ]);

    setHealthPill(coreHealth, !!core.ok, core.ok ? "healthy" : "unhealthy");
    setHealthPill(eventhubHealth, !!hub.ok, hub.ok ? "healthy" : "unhealthy");
    setHealthPill(sessionManagerHealth, !!sessionManager.ok, sessionManager.ok ? "healthy" : "unhealthy");
    setHealthPill(screenHealth, !!screen.ok, screen.ok ? "healthy" : "unhealthy");
    setHealthPill(screenActHealth, !!screenAct.ok, screenAct.ok ? "healthy" : "unhealthy");
    setHealthPill(systemHealthPill, !!systemSense.ok, systemSense.ok ? "healthy" : "unhealthy");
    setHealthPill(systemHealHealth, !!systemHeal.ok, systemHeal.ok ? "healthy" : "unhealthy");
  } catch (error) {
    setHealthPill(coreHealth, false, "offline");
    setHealthPill(eventhubHealth, false, "offline");
    setHealthPill(sessionManagerHealth, false, "offline");
    setHealthPill(screenHealth, false, "offline");
    setHealthPill(screenActHealth, false, "offline");
    setHealthPill(systemHealthPill, false, "offline");
    setHealthPill(systemHealHealth, false, "offline");
  }
}

async function refreshMvpRoute() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/mvp/route\`);
    const summary = data.summary ?? {};
    mvpRouteCurrent.textContent = data.mainline?.current ?? "unknown";
    mvpRouteTrunk.textContent = data.mainline?.trunk ?? "unknown";
    mvpRouteComplete.textContent = \`\${summary.complete ?? 0}/\${summary.totalPhases ?? 0}\`;
    mvpRouteNext.textContent = data.mainline?.nextRecommendedTrunk ?? summary.next ?? "unknown";
    mvpRouteJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`MVP Boundary: \${data.whitepaper?.mvpBoundary ?? "unknown"}\`,
      \`Current: \${data.mainline?.current ?? "unknown"}\`,
      \`Next Recommended Trunk: \${data.mainline?.nextRecommendedTrunk ?? "unknown"}\`,
      \`Next Milestone: \${data.mainline?.nextRecommendedMilestone ?? "unknown"}\`,
      \`Guardrail: \${(data.guardrails?.afterEachMilestone ?? []).join("; ") || "none"}\`,
      \`Avoid: \${(data.guardrails?.avoidLoops ?? []).join("; ") || "none"}\`,
      "",
      JSON.stringify(data.phases ?? [], null, 2),
    ].join("\\n");
  } catch {
    mvpRouteCurrent.textContent = "offline";
    mvpRouteJson.textContent = "Unable to read MVP route alignment.";
  }
}

async function refreshRuntime() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/state/runtime\`);
    const currentTask = data.currentTask ?? null;
    currentTaskState = currentTask;
    runtimeStatus.textContent = data.runtime.status;
    runtimeTask.textContent = currentTask ? currentTask.goal : "none";
    runtimePaused.textContent = String(data.runtime.paused);
    runtimeCount.textContent = String(data.taskCount);
    runtimeUpdated.textContent = data.runtime.lastUpdatedAt;
    const taskLastAction = deriveTaskLastAction(currentTask);
    taskJson.textContent = currentTask
      ? renderTaskSummary(currentTask, { includeRecovery: false, includeOutcome: false })
      : "No active task.";
    renderPlanPanel(currentTask ?? latestHistoryTask);
    renderCommandTranscriptFromTask(currentTask ?? latestHistoryTask, { source: currentTask ? "current-task" : "latest-history" });
  } catch {
    currentTaskState = null;
    runtimeStatus.textContent = "offline";
    taskJson.textContent = "Unable to read runtime state.";
    renderPlanPanel(latestHistoryTask);
    renderCommandTranscriptFromTask(latestHistoryTask, { source: "latest-history" });
  }
}

async function refreshTaskList() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/tasks?limit=8\`);
    const items = data.items ?? [];
    latestTaskSummary = data.summary ?? null;
    recentTasksState = items;
    const activeTasks = items.filter((task) => task.isActive);
    const historyTasks = items.filter((task) => !task.isActive);
    const summaryCounts = data.summary?.counts ?? {};
    const activeCount = summaryCounts.active ?? activeTasks.length;
    taskListCount.textContent = \`\${items.length} visible / \${activeCount} active\`;
    taskActiveCount.textContent = String(summaryCounts.active ?? activeTasks.length);
    taskRecoverableCount.textContent = String(summaryCounts.recoverable ?? items.filter((task) => task.restorable).length);
    taskFailedCount.textContent = String(summaryCounts.failed ?? items.filter((task) => task.status === "failed").length);
    taskCompletedCount.textContent = String(summaryCounts.completed ?? items.filter((task) => task.status === "completed").length);
    taskSupersededCount.textContent = String(summaryCounts.superseded ?? items.filter((task) => task.status === "superseded").length);
    taskQueuedCount.textContent = String(summaryCounts.queued ?? items.filter((task) => task.status === "queued").length);
    latestHistoryTask = items.find((task) => task.status !== "running" && task.status !== "queued" && task.status !== "paused")
      ?? items[0]
      ?? null;
    if (!selectedHistoryTaskId && latestHistoryTask?.id) {
      taskDetailIdInput.value = latestHistoryTask.id;
    }
    taskListItems.innerHTML = items.length > 0
      ? [
          renderTaskSection("Active Tasks", activeTasks),
          renderTaskSection("Task History", historyTasks),
        ].filter(Boolean).join("")
      : "<pre>No tasks recorded yet.</pre>";
  } catch {
    recentTasksState = [];
    latestHistoryTask = null;
    latestTaskSummary = null;
    taskListCount.textContent = "0";
    taskActiveCount.textContent = "0";
    taskRecoverableCount.textContent = "0";
    taskFailedCount.textContent = "0";
    taskCompletedCount.textContent = "0";
    taskSupersededCount.textContent = "0";
    taskQueuedCount.textContent = "0";
    taskListItems.innerHTML = "<pre>Unable to read recent tasks.</pre>";
  }
}

async function refreshTaskHistoryDetail() {
  try {
    const explicitTaskId = selectedHistoryTaskId ?? getSelectedHistoryTaskId();
    let historyTask = null;

    if (taskHistoryFocus === "current-task") {
      const data = await fetchJson(\`\${observerConfig.coreUrl}/tasks/focus/current\`);
      historyTask = data.task ?? null;
      latestTaskSummary = data.summary ?? latestTaskSummary;
    } else if (taskHistoryFocus === "latest-failed") {
      const data = await fetchJson(\`\${observerConfig.coreUrl}/tasks/focus/latest-failed\`);
      historyTask = data.task ?? null;
      latestTaskSummary = data.summary ?? latestTaskSummary;
    } else if (taskHistoryFocus === "selected-task" || explicitTaskId) {
      const data = await fetchJson(\`\${observerConfig.coreUrl}/tasks/\${explicitTaskId}\`);
      historyTask = data.task ?? latestHistoryTask ?? null;
    } else {
      const data = await fetchJson(\`\${observerConfig.coreUrl}/tasks/focus/latest-finished\`);
      historyTask = data.task ?? latestHistoryTask ?? null;
      latestTaskSummary = data.summary ?? latestTaskSummary;
    }

    latestHistoryTask = historyTask;
    selectedHistoryTaskId = taskHistoryFocus === "selected-task" || taskHistoryFocus === "latest-failed"
      ? historyTask?.id ?? explicitTaskId ?? null
      : historyTask?.id ?? selectedHistoryTaskId ?? explicitTaskId ?? null;
    if (historyTask?.id && taskHistoryFocus !== "current-task") {
      taskDetailIdInput.value = historyTask.id;
    }
    taskHistoryMeta.textContent = formatTaskFocusLabel(taskHistoryFocus, historyTask);
    taskHistoryJson.textContent = historyTask
      ? renderTaskSummary(historyTask)
      : taskHistoryFocus === "latest-failed"
        ? "No failed task recorded yet."
        : taskHistoryFocus === "current-task"
          ? "No active task selected."
          : "No finished task recorded yet.";
    renderPlanPanel(currentTaskState ?? historyTask);
    renderCommandTranscriptFromTask(historyTask ?? currentTaskState, { source: taskHistoryFocus });
  } catch {
    taskHistoryMeta.textContent = formatTaskFocusLabel(taskHistoryFocus, latestHistoryTask);
    taskHistoryJson.textContent = latestHistoryTask
      ? renderTaskSummary(latestHistoryTask)
      : "Unable to read task history detail.";
    renderPlanPanel(currentTaskState ?? latestHistoryTask);
    renderCommandTranscriptFromTask(latestHistoryTask ?? currentTaskState, { source: "latest-history" });
  }
}

async function refreshWorkView() {
  try {
    const data = await fetchJson(\`\${observerConfig.sessionManagerUrl}/work-view/state\`);
    const workView = data.workView ?? {};
    latestWorkViewState = workView;
    workViewStatus.textContent = workView.status ?? "unknown";
    workViewVisibility.textContent = workView.visibility ?? "unknown";
    workViewMode.textContent = workView.mode ?? "unknown";
    workViewHelper.textContent = workView.helperStatus ?? "unknown";
    workViewCapture.textContent = workView.captureStrategy ?? "unknown";
    if (!desiredWorkViewUrlPinned && document.activeElement !== workViewUrlInput) {
      setDesiredWorkViewUrl(workView.activeUrl ?? workView.entryUrl ?? "https://example.com/work-view", {
        pinned: false,
      });
    }
    updateDesiredUrlHint(workView.activeUrl ?? workView.entryUrl ?? null);
    workViewJson.textContent = [
      \`Session: \${data.session?.status ?? "unknown"}\`,
      \`Session ID: \${data.session?.sessionId ?? "none"}\`,
      \`Display: \${workView.displayTarget ?? "unknown"}\`,
      \`Browser: \${workView.browserStatus ?? "unknown"}\`,
      \`Entry URL: \${workView.entryUrl ?? "none"}\`,
      \`Active URL: \${workView.activeUrl ?? "none"}\`,
      \`Prepared: \${formatTimestamp(workView.preparedAt)}\`,
      \`Revealed: \${formatTimestamp(workView.lastRevealedAt)}\`,
      \`Hidden: \${formatTimestamp(workView.lastHiddenAt)}\`,
      \`Updated: \${formatTimestamp(workView.updatedAt)}\`,
    ].join("\\n");
  } catch {
    latestWorkViewState = null;
    workViewStatus.textContent = "offline";
    workViewVisibility.textContent = "offline";
    workViewMode.textContent = "offline";
    workViewHelper.textContent = "offline";
    workViewCapture.textContent = "offline";
    workViewJson.textContent = "Unable to read work view state.";
    updateDesiredUrlHint(null);
  }
}

async function refreshScreen() {
  try {
    const data = await fetchJson(\`\${observerConfig.screenSenseUrl}/screen/current\`);
    const screen = data.screen;
    screenWindow.textContent = screen.focusedWindow?.title ?? "none";
    screenSession.textContent = screen.sessionId ?? "none";
    screenReadiness.textContent = screen.readiness ?? "unknown";
    screenCaptureSource.textContent = screen.captureSource ?? "unknown";
    screenCaptureStrategy.textContent = screen.captureStrategy ?? "unknown";
    screenWorkViewUrl.textContent = screen.workView?.activeUrl ?? screen.captureMetadata?.activeUrl ?? "none";
    const workViewSummary = screen.workViewSummary ?? screen.workView?.summary ?? null;
    screenWorkViewSummary.textContent = workViewSummary
      ? [
          "Summary: " + (workViewSummary.summaryText ?? "none"),
          "Title: " + (workViewSummary.title ?? "none"),
          "URL: " + (workViewSummary.url ?? "none"),
          "Visible Text: " + ((workViewSummary.visibleTextBlocks ?? []).join(" | ") || "none"),
          "Recent Input: " + (workViewSummary.recentInteraction?.input ?? "none"),
        ].join("\\n")
      : "No work view summary yet.";
    screenSummary.textContent = screen.summary;
    screenSnapshot.textContent = screen.snapshotText ?? "No snapshot text.";
  } catch {
    screenWindow.textContent = "offline";
    screenSession.textContent = "unknown";
    screenReadiness.textContent = "degraded";
    screenCaptureSource.textContent = "unavailable";
    screenCaptureStrategy.textContent = "unavailable";
    screenWorkViewUrl.textContent = "none";
    screenWorkViewSummary.textContent = "No work view summary available.";
    screenSummary.textContent = "Unable to read screen state.";
    screenSnapshot.textContent = "No screen preview available.";
  }
}

async function refreshActionState() {
  try {
    const data = await fetchJson(\`\${observerConfig.screenActUrl}/act/state\`);
    const state = data.state;
    latestActionState = state;
    actionKind.textContent = state.lastAction?.kind ?? "none";
    actionCount.textContent = String(state.actionCount ?? 0);
    actionDegraded.textContent = String(state.lastAction?.degraded ?? false);
    actionJson.textContent = state.lastAction
      ? [
          \`Result: \${state.lastAction.result}\`,
          \`Executed: \${formatTimestamp(state.lastAction.executedAt)}\`,
          \`Window: \${state.lastAction.screenContext?.focusedWindow?.title ?? "none"}\`,
          \`Session: \${state.lastAction.screenContext?.sessionId ?? "none"}\`,
        ].join("\\n")
      : "No action executed yet.";
  } catch {
    latestActionState = null;
    actionKind.textContent = "offline";
    actionCount.textContent = "0";
    actionDegraded.textContent = "unknown";
    actionJson.textContent = "Unable to read action state.";
  }
}

async function refreshSystemState() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/health\`);
    const system = data.system;
    const onlineCount = Object.values(system.services).filter((service) => service.ok).length;
    systemServicesOnline.textContent = String(onlineCount);
    systemAlertCount.textContent = String(system.alerts.length);
    systemBodyUptime.textContent = \`\${system.body?.uptimeSeconds ?? 0}s\`;
    systemSummary.textContent = [
      \`Host: \${system.body?.hostname ?? "unknown"} (\${system.body?.platform ?? "unknown"} \${system.body?.arch ?? "unknown"})\`,
      \`Node: \${system.body?.node ?? "unknown"} PID: \${system.body?.pid ?? "unknown"}\`,
      \`CPU: \${system.resources?.cpuPercent ?? 0}%\`,
      \`Load: \${(system.resources?.loadAverage ?? []).join(", ") || "n/a"}\`,
      \`Memory: \${system.resources?.memoryPercent ?? 0}%\`,
      \`Disk: \${system.resources?.diskPercent ?? 0}%\`,
      \`Network: \${system.network?.online ? "online" : "offline"} (\${system.network?.checkedTargets ?? 0} targets)\`,
      \`Alerts: \${system.alerts?.length ?? 0}\`,
    ].join("\\n");
  } catch {
    systemServicesOnline.textContent = "0";
    systemAlertCount.textContent = "0";
    systemBodyUptime.textContent = "0s";
    systemSummary.textContent = "Unable to read system state.";
  }
}

async function refreshSystemdUnitInventory() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/units\`);
    const summary = data.summary ?? {};
    const source = data.source ?? {};
    const governance = data.governance ?? {};
    const units = Array.isArray(data.units) ? data.units : [];
    systemdUnitTotal.textContent = String(summary.total ?? units.length);
    systemdUnitActive.textContent = String(summary.active ?? 0);
    systemdUnitObserved.textContent = String(summary.observed ?? 0);
    systemdUnitMode.textContent = data.mode ?? "read_only";
    systemdUnitJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} canMutate=\${Boolean(data.canMutate)} canRestart=\${Boolean(data.canRestart)}\`,
      \`Systemd: \${source.systemdAvailable ? source.systemdVersion ?? "available" : source.unavailableReason ?? "unavailable"}\`,
      \`Governance: \${governance.autonomy ?? "observe_only"} domain=\${governance.domain ?? "body_internal"} mutation=\${Boolean(governance.hostMutation)}\`,
      \`Units: \${units.map((unit) => \`\${unit.unit}:\${unit.activeState ?? unit.status ?? "unknown"}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "plan-only repair proposal"}\`,
    ].join("\\n");
  } catch {
    systemdUnitTotal.textContent = "0";
    systemdUnitActive.textContent = "0";
    systemdUnitObserved.textContent = "0";
    systemdUnitMode.textContent = "offline";
    systemdUnitJson.textContent = "Unable to read OpenClaw systemd unit inventory.";
  }
}

async function refreshSystemdRepairPlan() {
  try {
    const [plan, dryRun] = await Promise.all([
      fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-plan?unit=openclaw-browser-runtime.service\`),
      fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-dry-run?unit=openclaw-browser-runtime.service\`),
    ]);
    const proposal = plan.proposal ?? {};
    const target = plan.target ?? {};
    systemdRepairPlanTarget.textContent = target.unit ?? "unknown";
    systemdRepairPlanRisk.textContent = proposal.risk ?? "unknown";
    systemdRepairPlanMode.textContent = plan.mode ?? "plan_only";
    systemdRepairDryRunMode.textContent = dryRun.mode ?? "operator_visible_dry_run";
    systemdRepairPlanJson.textContent = [
      \`Registry: \${plan.registry ?? "unknown"}\`,
      \`Target: \${target.unit ?? "unknown"} state=\${target.activeState ?? "unknown"}/\${target.subState ?? "unknown"}\`,
      \`Command: \${proposal.command?.command ?? "systemctl"} \${(proposal.command?.args ?? []).join(" ")}\`,
      \`Risk: \${proposal.risk ?? "unknown"} approvalForExecution=\${Boolean(proposal.approvalRequiredForExecution)}\`,
      \`Reason: \${proposal.reason ?? "none"}\`,
      \`Rollback: \${proposal.rollbackNote ?? "none"}\`,
    ].join("\\n");
    systemdRepairDryRunJson.textContent = [
      \`Registry: \${dryRun.registry ?? "unknown"}\`,
      \`Mode: \${dryRun.mode ?? "unknown"} wouldExecute=\${Boolean(dryRun.wouldExecute)} canRestart=\${Boolean(dryRun.canRestart)}\`,
      \`Dry Run: \${dryRun.dryRun?.command ?? "systemctl"} \${(dryRun.dryRun?.args ?? []).join(" ")}\`,
      \`Governance: \${dryRun.governance?.autonomy ?? "dry_run_only"} mutation=\${Boolean(dryRun.governance?.hostMutation)}\`,
      \`Checks: \${(dryRun.dryRun?.checks ?? []).map((check) => \`\${check.name}=\${Boolean(check.passed)}\`).join(", ")}\`,
      \`Next: \${dryRun.next?.recommendedSlice ?? "separate route review required"}\`,
    ].join("\\n");
  } catch {
    systemdRepairPlanTarget.textContent = "offline";
    systemdRepairPlanRisk.textContent = "unknown";
    systemdRepairPlanMode.textContent = "offline";
    systemdRepairDryRunMode.textContent = "offline";
    systemdRepairPlanJson.textContent = "Unable to read OpenClaw systemd repair plan.";
    systemdRepairDryRunJson.textContent = "Unable to read OpenClaw systemd repair dry-run envelope.";
  }
}

async function refreshHealState() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemHealUrl}/heal/history\`);
    healCount.textContent = String(data.count ?? 0);
    const latest = data.items?.[0] ?? null;
    healSummary.textContent = latest
      ? [
          \`Action: \${latest.action}\`,
          \`Service: \${latest.service}\`,
          \`Status: \${latest.status}\`,
          \`Completed: \${formatTimestamp(latest.completedAt)}\`,
        ].join("\\n")
      : "No heal actions yet.";
  } catch {
    healCount.textContent = "0";
    healSummary.textContent = "Unable to read heal history.";
  }
}

async function refreshMaintenanceState() {
  try {
    const [state, history] = await Promise.all([
      fetchJson(\`\${observerConfig.systemHealUrl}/maintenance/state\`),
      fetchJson(\`\${observerConfig.systemHealUrl}/maintenance/history?limit=5\`),
    ]);
    const policy = state.policy ?? {};
    const latestRun = state.latestRun ?? history.latestRun ?? history.items?.[0] ?? null;
    const lastTick = policy.lastTick ?? null;
    const intervalMs = Number.isFinite(policy.intervalMs) ? policy.intervalMs : 0;
    const intervalMinutes = Math.round(intervalMs / 60000);

    maintenancePolicyEnabled.textContent = policy.enabled ? "enabled" : "disabled";
    maintenanceNextDue.textContent = formatTimestamp(policy.nextDueAt);
    maintenanceLastTick.textContent = lastTick
      ? \`\${lastTick.status ?? "unknown"} (\${lastTick.reason ?? "unknown"})\`
      : "none";
    maintenanceRunCount.textContent = String(state.runCount ?? history.count ?? 0);
    maintenanceSummary.textContent = [
      \`Interval: \${intervalMinutes > 0 ? \`\${intervalMinutes}m\` : \`\${intervalMs}ms\`}\`,
      \`Autofix: \${policy.autofix === false ? "false" : "true"}\`,
      \`Last Checked: \${formatTimestamp(policy.lastCheckedAt)}\`,
      \`Latest Run: \${latestRun?.status ?? "none"}\`,
      latestRun ? \`Run Completed: \${formatTimestamp(latestRun.completedAt)}\` : "Run Completed: -",
      latestRun?.autonomy ? \`Governance: \${latestRun.autonomy.governance ?? "unknown"}\` : "Governance: -",
    ].join("\\n");
  } catch {
    maintenancePolicyEnabled.textContent = "unknown";
    maintenanceNextDue.textContent = "-";
    maintenanceLastTick.textContent = "unknown";
    maintenanceRunCount.textContent = "0";
    maintenanceSummary.textContent = "Unable to read maintenance state.";
  }
}

async function refreshAuditState() {
  try {
    const summary = await fetchJson(\`\${observerConfig.eventHubUrl}/events/audit/summary\`);
    const audit = summary.audit ?? {};
    const byType = audit.byType ?? {};
    const bySource = audit.bySource ?? {};
    const topTypes = Object.entries(byType)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([type, count]) => \`\${type}: \${count}\`);

    auditTotal.textContent = String(audit.total ?? 0);
    auditTypeCount.textContent = String(Object.keys(byType).length);
    auditSourceCount.textContent = String(Object.keys(bySource).length);
    auditSummary.textContent = [
      \`Log: \${audit.logFile ?? "unknown"}\`,
      \`Earliest: \${formatTimestamp(audit.earliestTimestamp)}\`,
      \`Latest: \${formatTimestamp(audit.latestTimestamp)}\`,
      \`Malformed Lines: \${audit.malformed ?? 0}\`,
      topTypes.length ? \`Top Types: \${topTypes.join(", ")}\` : "Top Types: none",
    ].join("\\n");
  } catch {
    auditTotal.textContent = "0";
    auditTypeCount.textContent = "0";
    auditSourceCount.textContent = "0";
    auditSummary.textContent = "Unable to read audit ledger.";
  }
}

async function loadRecentEvents() {
  try {
    const data = await fetchJson(\`\${observerConfig.eventHubUrl}/events/recent\`);
    eventsList.innerHTML = "";
    for (const event of [...data.items].reverse()) {
      addEventItem(event);
    }
  } catch {
    eventsList.innerHTML = "<li>Unable to load recent events.</li>";
  }
}

async function createDemoTask() {
  const targetUrl = getDesiredWorkViewUrl();
  const result = await fetchJson(\`\${observerConfig.coreUrl}/tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      goal: \`Open the AI work view at \${targetUrl}\`,
      type: "browser_task",
      targetUrl,
      workViewStrategy: "ai-work-view",
    }),
  });
  await launchTaskIntoWorkView(result.task?.id, targetUrl);
  taskHistoryFocus = "current-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  setControlMessage(\`Created task \${result.task?.id ?? "unknown"} for \${targetUrl}\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshWorkView();
  await refreshScreen();
}

async function createPlannedTask() {
  const targetUrl = getDesiredWorkViewUrl();
  const result = await fetchJson(\`\${observerConfig.coreUrl}/tasks/plan\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      goal: \`Plan an AI work view run for \${targetUrl}\`,
      type: "browser_task",
      targetUrl,
      workViewStrategy: "ai-work-view",
      actions: [
        { kind: "keyboard.type", params: { text: "hello from openclaw-operator" } },
        { kind: "mouse.click", params: { x: 640, y: 360, button: "left" } },
      ],
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task ?? { plan: result.plan });
  setControlMessage(\`Planned task \${result.task?.id ?? "unknown"} for \${targetUrl}. Use Operator Step or Run to execute it.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshOperatorState();
}

async function createWorkspaceCommandApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/workspaces/command-proposals/tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      proposalId: "openclaw:typecheck",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated workspace command task \${result.task?.id ?? "unknown"} for openclaw:typecheck.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshWorkspaceCommandPlanDraft();
}

async function createSourceCommandApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/source-command-proposals/tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      proposalId: "openclaw:typecheck",
      query: "command",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated source command task \${result.task?.id ?? "unknown"} for openclaw:typecheck.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshSourceCommandPlanDraft();
}

async function createNativePluginInvokeApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/invoke-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      capabilityId: "act.plugin.capability.invoke",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated native plugin invoke task \${result.task?.id ?? "unknown"}.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshNativePluginInvokePlan();
}

async function createNativePluginRuntimeActivationApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/runtime-activation-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      capabilityId: "act.plugin.capability.invoke",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated native plugin runtime activation task \${result.task?.id ?? "unknown"}; runtime remains deferred.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshNativePluginActivationPlan();
}

async function createNativePluginRuntimeAdapterApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/runtime-adapter-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      capabilityId: "act.plugin.capability.invoke",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated native plugin runtime adapter task \${result.task?.id ?? "unknown"}; implementation remains deferred.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshNativePluginRuntimeAdapterContract();
}

async function createPluginSearchWebApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-search-web-adapter-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: "openclaw native integration",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated search/web adapter task \${result.task?.id ?? "unknown"}; network execution remains deferred.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshPluginSearchWebAdapterContract();
}

async function createPluginSearchWebRuntimeActivationApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-search-web-adapter-runtime-activation-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerContractId: "openclaw.web-search",
      query: "openclaw native integration",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated search/web runtime activation task \${result.task?.id ?? "unknown"}; network runtime remains deferred.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshPluginSearchWebRuntimeActivationPlan();
}

async function createPluginSearchWebProviderSandboxApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerContractId: "openclaw.web-search",
      query: "openclaw native integration",
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated search/web provider sandbox task \${result.task?.id ?? "unknown"}; provider runtime remains deferred.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshPluginSearchWebProviderRuntimeSandbox();
}

async function createSourceAuthoredEditApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/source-authored-edit-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      edits: [
        { search: "before", replacement: "after", occurrence: 1 },
        { search: "omega", replacement: "zeta", occurrence: 1 },
      ],
      proposalQuery: "edit",
      targetSelectionQuery: "edit",
      contextLines: 0,
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated OpenClaw source-authored edit task \${result.task?.id ?? "unknown"}.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshWorkspacePatchApplyDraft();
}

async function createWorkspaceTextWriteApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/workspace-text-write-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      relativePath: "scratch/observer-native-write.txt",
      content: "hello from observer native OpenClaw workspace text write\\n",
      overwrite: true,
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated OpenClaw workspace text write task \${result.task?.id ?? "unknown"}.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshWorkspaceTextWriteDraft();
}

async function createWorkspacePatchApplyApprovalTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/workspace-patch-apply-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      relativePath: "scratch/observer-native-edit.txt",
      edits: [
        { search: "before", replacement: "after", occurrence: 1 },
        { search: "omega", replacement: "zeta", occurrence: 1 },
      ],
      proposal: {
        title: "Observer sample edit proposal",
        rationale: "Demonstrate proposal envelope metadata for an approval-gated OpenClaw workspace patch.",
        targetContext: { symbol: "observer-sample", fileRole: "workspace scratch fixture" },
      },
      deriveProposalFromSource: true,
      proposalQuery: "edit",
      contextLines: 0,
      confirm: true,
    }),
  });

  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  renderPlanPanel(result.task);
  setControlMessage(\`Created approval-gated OpenClaw workspace patch apply task \${result.task?.id ?? "unknown"}.\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshApprovalState();
  await refreshOperatorState();
  await refreshWorkspacePatchApplyDraft();
}

async function runOperatorStepFromUi() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/operator/step\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });

  renderOperatorPanel(result);
  taskHistoryFocus = result.task?.id ? "selected-task" : taskHistoryFocus;
  selectedHistoryTaskId = result.task?.id ?? selectedHistoryTaskId;
  if (result.task?.id) {
    taskDetailIdInput.value = result.task.id;
  }
  setControlMessage(result.ran
    ? \`Operator completed task \${result.task?.id ?? "unknown"}.\`
    : "Operator step found no queued task.");
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshActionState();
  await refreshWorkView();
  await refreshScreen();
  await refreshOperatorState();
  await refreshPolicyState();
  await refreshCapabilityHistory();
  await refreshCommandLedger();
}

async function runOperatorLoopFromUi() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/operator/run\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ maxSteps: 5 }),
  });

  renderOperatorPanel(result);
  const lastTask = [...(result.steps ?? [])].reverse().find((step) => step.task?.id)?.task ?? null;
  taskHistoryFocus = lastTask?.id ? "selected-task" : taskHistoryFocus;
  selectedHistoryTaskId = lastTask?.id ?? selectedHistoryTaskId;
  if (lastTask?.id) {
    taskDetailIdInput.value = lastTask.id;
  }
  setControlMessage(result.ran
    ? \`Operator run completed \${result.count ?? result.steps?.length ?? 0} task(s).\`
    : "Operator run found no queued tasks.");
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshActionState();
  await refreshWorkView();
  await refreshScreen();
  await refreshOperatorState();
  await refreshPolicyState();
  await refreshCapabilityHistory();
  await refreshCommandLedger();
}

async function launchTaskIntoWorkView(taskId, targetUrl) {
  if (!taskId || !targetUrl) {
    return;
  }

  await updateTaskPhase(taskId, "preparing_work_view", {
    targetUrl,
    displayTarget: "workspace-2",
  });
  const workViewResult = await openWorkViewUrl(taskId, targetUrl);
  await attachTaskToWorkView(taskId, workViewResult);
}

async function recoverLatestFinishedTask() {
  const latest = await fetchJson(\`\${observerConfig.coreUrl}/tasks/latest-finished\`);
  const sourceTask = latest.task ?? null;
  if (!sourceTask?.id) {
    throw new Error("No finished task available to recover.");
  }

  const targetUrl = sourceTask.targetUrl ?? sourceTask.workView?.activeUrl ?? null;
  if (targetUrl) {
    setDesiredWorkViewUrl(targetUrl);
  }

  const result = await fetchJson(\`\${observerConfig.coreUrl}/tasks/\${sourceTask.id}/recover\`, {
    method: "POST",
  });
  await launchTaskIntoWorkView(result.task?.id, targetUrl);
  taskHistoryFocus = "current-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  setControlMessage(\`Recovered task \${result.task?.id ?? "unknown"} from \${sourceTask.id}\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshWorkView();
  await refreshScreen();
}

async function recoverSelectedTask() {
  const sourceTaskId = getSelectedHistoryTaskId();
  if (!sourceTaskId) {
    throw new Error("Enter or load a task ID first.");
  }

  const taskResponse = await fetchJson(\`\${observerConfig.coreUrl}/tasks/\${sourceTaskId}\`);
  const sourceTask = taskResponse.task ?? null;
  if (!sourceTask?.id) {
    throw new Error("Selected task could not be loaded.");
  }

  if (!sourceTask.restorable) {
    throw new Error("Selected task is not recoverable.");
  }

  const targetUrl = sourceTask.targetUrl ?? sourceTask.workView?.activeUrl ?? null;
  if (targetUrl) {
    setDesiredWorkViewUrl(targetUrl);
  }
  const result = await fetchJson(\`\${observerConfig.coreUrl}/tasks/\${sourceTask.id}/recover\`, {
    method: "POST",
  });
  await launchTaskIntoWorkView(result.task?.id, targetUrl);
  taskHistoryFocus = "current-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  setControlMessage(\`Recovered task \${result.task?.id ?? "unknown"} from selected task \${sourceTask.id}\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshWorkView();
  await refreshScreen();
}

async function loadSelectedTaskDetail() {
  selectedHistoryTaskId = getSelectedHistoryTaskId();
  if (!selectedHistoryTaskId) {
    throw new Error("Enter a task ID first.");
  }

  taskHistoryFocus = "selected-task";
  await refreshTaskHistoryDetail();
  setControlMessage(\`Loaded task history detail for \${selectedHistoryTaskId}\`);
}

function useSelectedTaskUrl() {
  const selectedTask = latestHistoryTask ?? null;
  const taskUrl = selectedTask?.targetUrl ?? selectedTask?.workView?.activeUrl ?? null;
  if (!taskUrl) {
    throw new Error("Selected task does not have a recoverable URL.");
  }

  setDesiredWorkViewUrl(taskUrl);
  setControlMessage(\`Loaded task URL into work view input: \${taskUrl}\`);
}

async function recoverLatestFailedTask() {
  const latest = await fetchJson(\`\${observerConfig.coreUrl}/tasks/latest-failed\`);
  const failedTask = latest.task ?? recentTasksState.find((task) => task.status === "failed" && task.restorable) ?? null;
  if (!failedTask?.id) {
    throw new Error("No failed task available to recover.");
  }

  taskHistoryFocus = "latest-failed";
  selectedHistoryTaskId = failedTask.id;
  taskDetailIdInput.value = failedTask.id;
  await refreshTaskHistoryDetail();
  await recoverSelectedTask();
}

function renderTaskCard(task) {
  const selectedClass = selectedHistoryTaskId === task.id ? " selected" : "";
  const activeClass = task.id === currentTaskState?.id ? " active" : "";
  const taskUrl = task.targetUrl ?? task.workView?.activeUrl ?? "";
  const escapedUrl = escapeHtml(taskUrl);
  const statusClass = task.status === "failed" ? "status-pill warn" : "status-pill";
  const relationLabel = describeTaskRelationship(task);
  return \`<article class="task-card\${selectedClass}\${activeClass}" data-task-id="\${task.id}">
    <div class="task-card-top">
      <h3>\${escapeHtml(task.goal)}</h3>
      <div class="task-status-group">
        <span class="\${statusClass}">\${escapeHtml(task.status)}</span>
        \${task.isCurrentTask ? '<span class="status-pill">current</span>' : ""}
        \${task.restorable ? '<span class="status-pill">recoverable</span>' : ""}
      </div>
    </div>
    <pre>\${escapeHtml(renderTaskSummary(task))}</pre>
    <div class="hint">\${escapeHtml(relationLabel)}</div>
    <div class="task-card-actions">
      <button class="secondary" data-task-action="inspect" data-task-id="\${task.id}">Inspect</button>
      <button class="secondary" data-task-action="use-url" data-task-id="\${task.id}" data-task-url="\${escapedUrl}" \${taskUrl ? "" : "disabled"}>Use URL</button>
      <button class="secondary" data-task-action="recover" data-task-id="\${task.id}" \${task.restorable ? "" : "disabled"}>Recover</button>
    </div>
  </article>\`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function postWorkView(path, payload = {}) {
  const result = await fetchJson(\`\${observerConfig.sessionManagerUrl}\${path}\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (currentTaskState?.id) {
    const phase =
      path === "/work-view/prepare"
        ? "preparing_work_view"
        : path === "/work-view/reveal"
          ? "visible"
          : path === "/work-view/hide"
            ? "backgrounded"
            : null;
    if (phase) {
      await updateTaskPhase(currentTaskState.id, phase, {
        visibility: result.workView?.visibility ?? null,
        mode: result.workView?.mode ?? null,
      });
    }
  }
  setControlMessage(\`Work view \${result.workView?.status ?? "updated"} / \${result.workView?.visibility ?? "unknown"}\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshWorkView();
  await refreshScreen();
}

async function openWorkViewUrl(taskId = null) {
  const entryUrl = getDesiredWorkViewUrl();
  if (taskId) {
    await updateTaskPhase(taskId, "opening_target", {
      targetUrl: entryUrl,
    });
  }
  const prepareResult = await fetchJson(\`\${observerConfig.sessionManagerUrl}/work-view/prepare\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      displayTarget: "workspace-2",
      entryUrl,
    }),
  });

  const revealResult = await fetchJson(\`\${observerConfig.sessionManagerUrl}/work-view/reveal\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entryUrl }),
  });

  setControlMessage(\`Opened work view URL: \${revealResult.workView?.activeUrl ?? prepareResult.workView?.activeUrl ?? entryUrl}\`);
  await refreshWorkView();
  await refreshScreen();
  return revealResult;
}

async function updateTaskPhase(taskId, phase, details = null) {
  if (!taskId || !phase) {
    return null;
  }

  return fetchJson(\`\${observerConfig.coreUrl}/tasks/\${taskId}/phase\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      phase,
      status: "running",
      details,
    }),
  });
}

async function attachTaskToWorkView(taskId, workViewResult) {
  if (!taskId || !workViewResult?.workView) {
    return;
  }

  const activeUrl =
    workViewResult.workView?.activeUrl
    ?? workViewResult.browser?.activeUrl
    ?? workViewResult.tab?.url
    ?? currentTaskState?.targetUrl
    ?? getDesiredWorkViewUrl();

  await fetchJson(\`\${observerConfig.coreUrl}/tasks/\${taskId}/attach-work-view\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId: workViewResult.session?.sessionId ?? null,
      status: workViewResult.workView?.status ?? "ready",
      visibility: workViewResult.workView?.visibility ?? "visible",
      mode: workViewResult.workView?.mode ?? "foreground-observable",
      helperStatus: workViewResult.workView?.helperStatus ?? "active",
      displayTarget: workViewResult.workView?.displayTarget ?? "workspace-2",
      activeUrl,
    }),
  });
}

async function postControl(path) {
  const result = await fetchJson(\`\${observerConfig.coreUrl}\${path}\`, {
    method: "POST",
  });
  setControlMessage(\`Control request completed: \${path}\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshOperatorState();
}

async function refreshScreenNow() {
  const result = await fetchJson(\`\${observerConfig.screenSenseUrl}/screen/refresh\`, {
    method: "POST",
  });
  setControlMessage(\`Screen refreshed: \${result.screen?.readiness ?? "unknown"}\`);
  await refreshScreen();
}

async function runAction(path, payload) {
  const result = await fetchJson(\`\${observerConfig.screenActUrl}\${path}\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (currentTaskState?.id) {
    await updateTaskPhase(currentTaskState.id, "acting_on_target", {
      actionKind: result.action?.kind ?? null,
      degraded: result.action?.degraded ?? false,
    });
  }
  setControlMessage(\`Action \${result.action?.kind ?? "unknown"} completed (\${result.action?.result ?? "unknown"})\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshActionState();
  await refreshScreen();
  await refreshWorkView();
}

async function runHeal(service) {
  const result = await fetchJson(\`\${observerConfig.systemHealUrl}/heal/restart-service\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ service }),
  });
  setControlMessage(\`Heal completed for \${result.entry?.service ?? service}\`);
  await refreshHealState();
}

async function runMaintenanceTickFromUi() {
  const result = await fetchJson(\`\${observerConfig.systemHealUrl}/maintenance/tick\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      force: true,
      autofix: true,
      mode: "simulated",
    }),
  });
  const runStatus = result.run?.status ?? "no-run";
  setControlMessage(\`Maintenance tick \${result.tick?.status ?? "unknown"}: \${result.tick?.reason ?? "unknown"} / \${runStatus}\`);
  await refreshMaintenanceState();
  await refreshHealState();
  await refreshSystemState();
  await refreshAuditState();
}

async function completeCurrentTask() {
  if (!currentTaskState?.id) {
    throw new Error("No active task to complete.");
  }

  const completedWorkViewUrl = currentTaskState.workView?.activeUrl ?? currentTaskState.targetUrl ?? null;
  const hiddenResult = await fetchJson(\`\${observerConfig.sessionManagerUrl}/work-view/hide\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const hiddenState = await fetchJson(\`\${observerConfig.sessionManagerUrl}/work-view/state\`);
  const hiddenWorkView = hiddenState.workView ?? hiddenResult.workView ?? null;

  if (!hiddenWorkView || hiddenWorkView.visibility !== "hidden") {
    throw new Error("Work view did not transition to hidden state.");
  }

  const result = await fetchJson(\`\${observerConfig.coreUrl}/tasks/\${currentTaskState.id}/complete\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      details: {
        targetUrl: currentTaskState.targetUrl ?? null,
        workViewUrl: completedWorkViewUrl,
        summary: completedWorkViewUrl
          ? \`Completed task at \${completedWorkViewUrl}\`
          : "Completed task.",
        workView: hiddenWorkView
          ? {
            status: hiddenWorkView.status ?? null,
            visibility: hiddenWorkView.visibility ?? null,
            mode: hiddenWorkView.mode ?? null,
            helperStatus: hiddenWorkView.helperStatus ?? null,
            browserStatus: hiddenWorkView.browserStatus ?? null,
            entryUrl: hiddenWorkView.entryUrl ?? completedWorkViewUrl,
            displayTarget: hiddenWorkView.displayTarget ?? null,
            activeUrl: hiddenWorkView.activeUrl ?? completedWorkViewUrl,
          }
          : null,
      },
    }),
  });

  taskHistoryFocus = "latest-finished";
  selectedHistoryTaskId = result.task?.id ?? currentTaskState.id;
  taskDetailIdInput.value = selectedHistoryTaskId ?? "";
  setControlMessage(\`Completed task \${result.task?.id ?? currentTaskState.id}\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshActionState();
  await refreshWorkView();
  await refreshScreen();
}

async function stopCurrentTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/control/stop\`, {
    method: "POST",
  });
  taskHistoryFocus = "latest-failed";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  setControlMessage(\`Stopped task \${result.task?.id ?? "unknown"}\`);
  await refreshRuntime();
  await refreshTaskList();
  await refreshTaskHistoryDetail();
  await refreshActionState();
  await refreshWorkView();
  await refreshScreen();
}

function subscribeEvents() {
  const stream = new EventSource(\`\${observerConfig.eventHubUrl}/events/stream\`);
  stream.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data);
      addEventItem(event);
    } catch (error) {
      console.error("Unable to parse event stream payload", error);
    }
  };

  for (const eventName of [
    "task.created",
    "task.planned",
    "task.phase_changed",
    "task.running",
    "task.completed",
    "task.recovered",
    "task.paused",
    "task.resumed",
    "task.failed",
    "policy.evaluated",
    "approval.created",
    "approval.approved",
    "approval.denied",
    "capability.updated",
    "capability.invoked",
    "capability.blocked",
    "system.command.executed",
    "service.started",
    "browser.started",
    "browser.updated",
    "screen.updated",
    "action.completed",
    "system.updated",
    "service.failed",
    "heal.diagnosed",
    "heal.started",
    "heal.completed",
    "maintenance.policy.updated",
    "maintenance.tick",
    "maintenance.started",
    "maintenance.completed",
  ]) {
    stream.addEventListener(eventName, async (message) => {
      try {
        addEventItem(JSON.parse(message.data));
        await refreshRuntime();
        await refreshTaskList();
        await refreshTaskHistoryDetail();
        await refreshWorkView();
        if (eventName === "policy.evaluated") {
          await refreshPolicyState();
        }
        if (eventName === "approval.created" || eventName === "approval.approved" || eventName === "approval.denied") {
          await refreshApprovalState();
        }
        if (
          eventName === "capability.updated"
          || eventName === "capability.invoked"
          || eventName === "capability.blocked"
          || eventName === "service.started"
          || eventName === "service.failed"
        ) {
          await refreshCapabilityState();
        }
        if (eventName === "capability.invoked" || eventName === "capability.blocked") {
          await refreshCapabilityHistory();
        }
        if (eventName === "system.command.executed" || eventName === "task.completed" || eventName === "task.failed") {
          await refreshCommandLedger();
        }
        if (
          eventName === "screen.updated"
          || eventName === "service.started"
          || eventName === "browser.started"
          || eventName === "browser.updated"
          || eventName === "action.completed"
        ) {
          await refreshScreen();
        }
        if (eventName === "action.completed" || eventName === "service.started") {
          await refreshActionState();
        }
        if (eventName === "system.updated" || eventName === "service.failed" || eventName === "service.started") {
          await refreshSystemState();
        }
        if (eventName === "heal.diagnosed" || eventName === "heal.started" || eventName === "heal.completed" || eventName === "service.started") {
          await refreshHealState();
        }
        if (
          eventName === "maintenance.policy.updated"
          || eventName === "maintenance.tick"
          || eventName === "maintenance.started"
          || eventName === "maintenance.completed"
          || eventName === "service.started"
        ) {
          await refreshMaintenanceState();
        }
        await refreshAuditState();
      } catch (error) {
        console.error("Unable to process named event", error);
      }
    });
  }
}

createTaskButton.addEventListener("click", () => {
  createDemoTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

createPlannedTaskButton.addEventListener("click", () => {
  createPlannedTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

workspaceCommandTaskButton.addEventListener("click", () => {
  createWorkspaceCommandApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

sourceCommandTaskButton.addEventListener("click", () => {
  createSourceCommandApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

nativePluginInvokeTaskButton.addEventListener("click", () => {
  createNativePluginInvokeApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

nativePluginActivationTaskButton.addEventListener("click", () => {
  createNativePluginRuntimeActivationApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

nativePluginRuntimeAdapterTaskButton.addEventListener("click", () => {
  createNativePluginRuntimeAdapterApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

pluginSearchWebTaskButton.addEventListener("click", () => {
  createPluginSearchWebApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

pluginSearchWebActivationTaskButton.addEventListener("click", () => {
  createPluginSearchWebRuntimeActivationApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

pluginSearchWebSandboxTaskButton.addEventListener("click", () => {
  createPluginSearchWebProviderSandboxApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

workspaceTextWriteTaskButton.addEventListener("click", () => {
  createWorkspaceTextWriteApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

workspacePatchApplyTaskButton.addEventListener("click", () => {
  createWorkspacePatchApplyApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

sourceAuthoredEditTaskButton.addEventListener("click", () => {
  createSourceAuthoredEditApprovalTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

operatorStepButton.addEventListener("click", () => {
  runOperatorStepFromUi().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

operatorRunButton.addEventListener("click", () => {
  runOperatorLoopFromUi().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

approveLatestButton.addEventListener("click", () => {
  resolveLatestApproval("approve").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

denyLatestButton.addEventListener("click", () => {
  resolveLatestApproval("deny").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

invokeVitalsButton.addEventListener("click", () => {
  invokeCapabilityFromUi("vitals").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

invokeProcessButton.addEventListener("click", () => {
  invokeCapabilityFromUi("process").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

invokeCommandDryRunButton.addEventListener("click", () => {
  invokeCapabilityFromUi("commandDryRun").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

invokeApprovedCommandDryRunButton.addEventListener("click", () => {
  invokeCapabilityFromUi("approvedCommandDryRun").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

prepareWorkViewButton.addEventListener("click", () => {
  postWorkView("/work-view/prepare", {
    displayTarget: "workspace-2",
    entryUrl: getDesiredWorkViewUrl(),
  }).catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

revealWorkViewButton.addEventListener("click", () => {
  postWorkView("/work-view/reveal", {
    entryUrl: getDesiredWorkViewUrl(),
  }).catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

hideWorkViewButton.addEventListener("click", () => {
  postWorkView("/work-view/hide").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

refreshScreenButton.addEventListener("click", () => {
  refreshScreenNow().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

clickActionButton.addEventListener("click", () => {
  runAction("/act/mouse/click", {
    x: 640,
    y: 360,
    button: "left",
  }).catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

typeActionButton.addEventListener("click", () => {
  runAction("/act/keyboard/type", {
    text: "hello from openclaw-screen-act",
  }).catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

healBrowserButton.addEventListener("click", () => {
  runHeal("openclaw-browser-runtime").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

runMaintenanceButton.addEventListener("click", () => {
  runMaintenanceTickFromUi().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

completeTaskButton.addEventListener("click", () => {
  completeCurrentTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

pauseButton.addEventListener("click", () => {
  postControl("/control/pause").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

resumeButton.addEventListener("click", () => {
  postControl("/control/resume").catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

stopButton.addEventListener("click", () => {
  stopCurrentTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

openWorkViewUrlButton.addEventListener("click", () => {
  openWorkViewUrl().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

recoverLatestTaskButton.addEventListener("click", () => {
  recoverLatestFinishedTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

recoverLatestFailedTaskButton.addEventListener("click", () => {
  recoverLatestFailedTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

loadHistoryButton.addEventListener("click", () => {
  taskHistoryFocus = "latest-finished";
  selectedHistoryTaskId = null;
  refreshTaskHistoryDetail().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

followActiveUrlButton.addEventListener("click", () => {
  try {
    followActiveWorkViewUrl();
  } catch (error) {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  }
});

loadSelectedTaskButton.addEventListener("click", () => {
  loadSelectedTaskDetail().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

loadCurrentTaskButton.addEventListener("click", () => {
  if (!currentTaskState?.id) {
    setControlMessage("Request failed: No active task selected.");
    return;
  }
  taskHistoryFocus = "current-task";
  selectedHistoryTaskId = currentTaskState.id;
  taskDetailIdInput.value = currentTaskState.id;
  refreshTaskHistoryDetail().then(() => {
    setControlMessage(\`Viewing current task \${currentTaskState.id}\`);
  }).catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

loadLatestFailedTaskButton.addEventListener("click", () => {
  taskHistoryFocus = "latest-failed";
  refreshTaskHistoryDetail().then(() => {
    setControlMessage("Loaded latest failed task.");
  }).catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

recoverSelectedTaskButton.addEventListener("click", () => {
  recoverSelectedTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

useDetailUrlButton.addEventListener("click", () => {
  try {
    useSelectedTaskUrl();
  } catch (error) {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  }
});

workViewUrlInput.addEventListener("input", () => {
  desiredWorkViewUrl = workViewUrlInput.value.trim() || "https://example.com/work-view";
  desiredWorkViewUrlPinned = true;
  updateDesiredUrlHint(currentTaskState?.workView?.activeUrl ?? null);
});

taskListItems.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.taskAction;
  const taskId = target.dataset.taskId;
  const taskUrl = target.dataset.taskUrl;

  if (!action || !taskId) {
    return;
  }

  if (action === "inspect") {
    taskHistoryFocus = "selected-task";
    selectedHistoryTaskId = taskId;
    taskDetailIdInput.value = taskId;
    refreshTaskHistoryDetail().then(() => {
      setControlMessage(\`Loaded task history detail for \${taskId}\`);
    }).catch((error) => {
      setControlMessage(\`Request failed: \${formatError(error)}\`);
    });
    return;
  }

  if (action === "use-url") {
    try {
      if (!taskUrl) {
        throw new Error("Selected task does not have a recoverable URL.");
      }
      taskHistoryFocus = "selected-task";
      selectedHistoryTaskId = taskId;
      taskDetailIdInput.value = taskId;
      setDesiredWorkViewUrl(taskUrl);
      setControlMessage(\`Loaded task URL into work view input: \${taskUrl}\`);
    } catch (error) {
      setControlMessage(\`Request failed: \${formatError(error)}\`);
    }
    return;
  }

  if (action === "recover") {
    taskHistoryFocus = "selected-task";
    selectedHistoryTaskId = taskId;
    taskDetailIdInput.value = taskId;
    recoverSelectedTask().catch((error) => {
      setControlMessage(\`Request failed: \${formatError(error)}\`);
    });
    return;
  }

  if (target.closest(".task-card")) {
    taskHistoryFocus = "selected-task";
    selectedHistoryTaskId = taskId;
    taskDetailIdInput.value = taskId;
    refreshTaskHistoryDetail().catch((error) => {
      setControlMessage(\`Request failed: \${formatError(error)}\`);
    });
  }
});

await refreshHealth();
await refreshMvpRoute();
await refreshRuntime();
await refreshTaskList();
await refreshTaskHistoryDetail();
await refreshWorkView();
await refreshScreen();
await refreshActionState();
await refreshOperatorState();
await refreshPolicyState();
await refreshApprovalState();
await refreshCapabilityState();
await refreshCapabilityHistory();
await refreshCommandLedger();
await refreshFilesystemLedger();
await refreshFilesystemReadLedger();
await refreshWorkspaceRegistry();
await refreshWorkspaceMigrationMap();
await refreshWorkspaceMigrationPlan();
await refreshPluginSdkContractReview();
await refreshPluginSdkSourceReviewScope();
await refreshPluginSdkSourceContentReview();
await refreshPluginSdkNativeContractTests();
await refreshNativeSdkContractImplementation();
await refreshOpenClawToolCatalog();
await refreshPluginManifestMap();
await refreshPluginCapabilityPlan();
await refreshPluginCandidateContractTests();
await refreshPluginSearchWebAdapterContract();
await refreshPluginSearchWebRuntimePreflight();
await refreshPluginSearchWebRuntimeActivationPlan();
await refreshPluginSearchWebProviderRuntimeSandbox();
await refreshToolCatalogAdapter();
await refreshSemanticIndex();
await refreshSymbolLookup();
await refreshEditTargetSelection();
await refreshPromptSemantics();
await refreshWorkspaceTextWriteDraft();
await refreshWorkspacePatchApplyDraft();
await refreshNativePluginContract();
await refreshNativePluginRegistry();
await refreshFormalIntegrationReadiness();
await refreshNativePluginAdapter();
await refreshNativePluginPreflight();
await refreshNativePluginActivationPlan();
await refreshNativePluginRuntimeAdapterContract();
await refreshNativePluginInvokePlan();
await refreshWorkspaceCommandProposals();
await refreshSourceCommandProposals();
await refreshSourceCommandPlanDraft();
await refreshWorkspaceCommandPlanDraft();
await refreshSystemState();
await refreshSystemdUnitInventory();
await refreshSystemdRepairPlan();
await refreshHealState();
await refreshMaintenanceState();
await refreshAuditState();
await loadRecentEvents();
setControlMessage("Controls ready.");
subscribeEvents();
setInterval(refreshHealth, 5000);
setInterval(refreshMvpRoute, 5000);
setInterval(refreshRuntime, 5000);
setInterval(refreshTaskList, 5000);
setInterval(refreshTaskHistoryDetail, 5000);
setInterval(refreshWorkView, 5000);
setInterval(refreshScreen, 5000);
setInterval(refreshActionState, 5000);
setInterval(refreshOperatorState, 5000);
setInterval(refreshPolicyState, 5000);
setInterval(refreshApprovalState, 5000);
setInterval(refreshCapabilityState, 5000);
setInterval(refreshCapabilityHistory, 5000);
setInterval(refreshCommandLedger, 5000);
setInterval(refreshFilesystemLedger, 5000);
setInterval(refreshFilesystemReadLedger, 5000);
setInterval(refreshWorkspaceRegistry, 5000);
setInterval(refreshWorkspaceMigrationMap, 5000);
setInterval(refreshWorkspaceMigrationPlan, 5000);
setInterval(refreshPluginSdkContractReview, 5000);
setInterval(refreshPluginSdkSourceReviewScope, 5000);
setInterval(refreshPluginSdkSourceContentReview, 5000);
setInterval(refreshPluginSdkNativeContractTests, 5000);
setInterval(refreshNativeSdkContractImplementation, 5000);
setInterval(refreshOpenClawToolCatalog, 5000);
setInterval(refreshPluginManifestMap, 5000);
setInterval(refreshPluginCapabilityPlan, 5000);
setInterval(refreshPluginCandidateContractTests, 5000);
setInterval(refreshPluginSearchWebAdapterContract, 5000);
setInterval(refreshPluginSearchWebRuntimePreflight, 5000);
setInterval(refreshPluginSearchWebRuntimeActivationPlan, 5000);
setInterval(refreshPluginSearchWebProviderRuntimeSandbox, 5000);
setInterval(refreshToolCatalogAdapter, 5000);
setInterval(refreshSemanticIndex, 5000);
setInterval(refreshSymbolLookup, 5000);
setInterval(refreshEditTargetSelection, 5000);
setInterval(refreshPromptSemantics, 5000);
setInterval(refreshWorkspaceTextWriteDraft, 5000);
setInterval(refreshWorkspacePatchApplyDraft, 5000);
setInterval(refreshNativePluginContract, 5000);
setInterval(refreshNativePluginRegistry, 5000);
setInterval(refreshFormalIntegrationReadiness, 5000);
setInterval(refreshNativePluginAdapter, 5000);
setInterval(refreshNativePluginPreflight, 5000);
setInterval(refreshNativePluginActivationPlan, 5000);
setInterval(refreshNativePluginRuntimeAdapterContract, 5000);
setInterval(refreshNativePluginInvokePlan, 5000);
setInterval(refreshWorkspaceCommandProposals, 5000);
setInterval(refreshSourceCommandProposals, 5000);
setInterval(refreshSourceCommandPlanDraft, 5000);
setInterval(refreshWorkspaceCommandPlanDraft, 5000);
setInterval(refreshSystemState, 5000);
setInterval(refreshSystemdUnitInventory, 5000);
setInterval(refreshSystemdRepairPlan, 5000);
setInterval(refreshHealState, 5000);
setInterval(refreshMaintenanceState, 5000);
setInterval(refreshAuditState, 5000);`;
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);

  if (req.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "observer-ui",
      stage: "active",
      coreUrl,
      eventHubUrl,
      sessionManagerUrl,
      screenSenseUrl,
      screenActUrl,
      systemSenseUrl,
      systemHealUrl,
    });
    return;
  }

  if (req.method === "GET" && (requestUrl.pathname === "/client.js" || requestUrl.pathname === "/client-v5.js")) {
    sendJavaScript(res, clientScript());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/") {
    sendHtml(res, observerHtml());
    return;
  }

  sendJson(res, 404, { ok: false, error: "Route not found." });
});

server.listen(port, host, () => {
  console.log(`observer-ui listening on http://${host}:${port}`);
});

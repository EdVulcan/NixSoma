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
        <section class="panel" id="phase2-repair-demo-status-panel">
          <h2>Phase 2 Repair Demo</h2>
          <div class="metric"><span>Status</span><span id="phase2-repair-demo-status">loading</span></div>
          <div class="metric"><span>Evidence</span><span id="phase2-repair-demo-evidence">0/0</span></div>
          <div class="metric"><span>Target</span><span id="phase2-repair-demo-target">openclaw-browser-runtime.service</span></div>
          <div class="metric"><span>Next</span><span id="phase2-repair-demo-next">demo evidence bundle</span></div>
          <pre id="phase2-repair-demo-json">Loading Phase 2 repair demo status...</pre>
        </section>
        <section class="panel" id="phase2-next-repair-demo-status-panel">
          <h2>Phase 2 Next Repair Demo</h2>
          <div class="metric"><span>Status</span><span id="phase2-next-repair-demo-status">loading</span></div>
          <div class="metric"><span>Evidence</span><span id="phase2-next-repair-demo-evidence">0/0</span></div>
          <div class="metric"><span>Target</span><span id="phase2-next-repair-demo-target">openclaw-system-sense.service</span></div>
          <div class="metric"><span>Mutation</span><span id="phase2-next-repair-demo-mutation">false</span></div>
          <pre id="phase2-next-repair-demo-json">Loading next repair demo status...</pre>
        </section>
        <section class="panel" id="phase2-demo-control-room-panel">
          <h2>Phase 2 Demo Control Room</h2>
          <div class="metric"><span>Status</span><span id="phase2-demo-control-room-status">loading</span></div>
          <div class="metric"><span>Panels</span><span id="phase2-demo-control-room-panels">0/0</span></div>
          <div class="metric"><span>Selected Slice</span><span id="phase2-demo-control-room-slice">loading</span></div>
          <div class="metric"><span>Mutation</span><span id="phase2-demo-control-room-mutation">false</span></div>
          <pre id="phase2-demo-control-room-json">Loading Phase 2 demo control room...</pre>
        </section>
        <section class="panel" id="phase2-demo-walkthrough-panel">
          <h2>Phase 2 Demo Walkthrough</h2>
          <div class="metric"><span>Status</span><span id="phase2-demo-walkthrough-status">loading</span></div>
          <div class="metric"><span>Steps</span><span id="phase2-demo-walkthrough-steps">0/0</span></div>
          <div class="metric"><span>Control Room</span><span id="phase2-demo-walkthrough-control-room">false</span></div>
          <div class="metric"><span>Mutation</span><span id="phase2-demo-walkthrough-mutation">false</span></div>
          <pre id="phase2-demo-walkthrough-json">Loading Phase 2 demo walkthrough...</pre>
        </section>
        <section class="panel" id="phase2-demo-readiness-exit-panel">
          <h2>Phase 2 Demo Exit</h2>
          <div class="metric"><span>Status</span><span id="phase2-demo-readiness-exit-status">loading</span></div>
          <div class="metric"><span>Checks</span><span id="phase2-demo-readiness-exit-checks">0/0</span></div>
          <div class="metric"><span>Safe To Demo</span><span id="phase2-demo-readiness-exit-safe">false</span></div>
          <div class="metric"><span>Mutation</span><span id="phase2-demo-readiness-exit-mutation">false</span></div>
          <pre id="phase2-demo-readiness-exit-json">Loading Phase 2 demo readiness exit...</pre>
        </section>
        <section class="panel" id="phase2-next-capability-route-panel">
          <h2>Next Capability Route</h2>
          <div class="metric"><span>Selected Track</span><span id="phase2-next-capability-track">loading</span></div>
          <div class="metric"><span>Next Slice</span><span id="phase2-next-capability-slice">loading</span></div>
          <div class="metric"><span>Creates Task</span><span id="phase2-next-capability-creates-task">false</span></div>
          <div class="metric"><span>Mutation</span><span id="phase2-next-capability-mutation">false</span></div>
          <pre id="phase2-next-capability-json">Loading Phase 2 next capability route review...</pre>
        </section>
        <section class="panel" id="phase2-completion-readiness-panel">
          <h2>Phase 2 Completion Readiness</h2>
          <div class="metric"><span>Ready</span><span id="phase2-completion-readiness-ready">false</span></div>
          <div class="metric"><span>Checks</span><span id="phase2-completion-readiness-checks">0/0</span></div>
          <div class="metric"><span>Percent</span><span id="phase2-completion-readiness-percent">0</span></div>
          <div class="metric"><span>Mutation</span><span id="phase2-completion-readiness-mutation">false</span></div>
          <pre id="phase2-completion-readiness-json">Loading Phase 2 completion readiness...</pre>
        </section>
        <section class="panel" id="phase2-exit-panel">
          <h2>Phase 2 Exit</h2>
          <div class="metric"><span>Complete</span><span id="phase2-exit-complete">false</span></div>
          <div class="metric"><span>Percent</span><span id="phase2-exit-percent">0</span></div>
          <div class="metric"><span>Next</span><span id="phase2-exit-next">loading</span></div>
          <div class="metric"><span>Mutation</span><span id="phase2-exit-mutation">false</span></div>
          <pre id="phase2-exit-json">Loading Phase 2 exit gate...</pre>
        </section>
        <section class="panel" id="phase3-plan-panel">
          <h2>Phase 3 Plan</h2>
          <div class="metric"><span>Ready</span><span id="phase3-plan-ready">false</span></div>
          <div class="metric"><span>Next</span><span id="phase3-plan-next">loading</span></div>
          <div class="metric"><span>Foreground Steal</span><span id="phase3-plan-foreground">false</span></div>
          <pre id="phase3-plan-json">Loading Phase 3 plan...</pre>
        </section>
        <section class="panel" id="phase3-background-work-view-panel">
          <h2>Phase 3 Background Work View</h2>
          <div class="metric"><span>Ready</span><span id="phase3-background-ready">false</span></div>
          <div class="metric"><span>Visibility</span><span id="phase3-background-visibility">loading</span></div>
          <div class="metric"><span>Mode</span><span id="phase3-background-mode">loading</span></div>
          <pre id="phase3-background-json">Loading Phase 3 background work view...</pre>
        </section>
        <section class="panel" id="phase3-operator-interrupt-controls-panel">
          <h2>Phase 3 Operator Interrupt Controls</h2>
          <div class="metric"><span>Ready</span><span id="phase3-controls-ready">false</span></div>
          <div class="metric"><span>Takeover</span><span id="phase3-controls-takeover">false</span></div>
          <div class="metric"><span>Hidden Automation</span><span id="phase3-controls-hidden-automation">false</span></div>
          <pre id="phase3-controls-json">Loading Phase 3 operator controls...</pre>
        </section>
        <section class="panel" id="phase3-completion-readiness-panel">
          <h2>Phase 3 Completion Readiness</h2>
          <div class="metric"><span>Ready</span><span id="phase3-readiness-ready">false</span></div>
          <div class="metric"><span>Checks</span><span id="phase3-readiness-checks">0/0</span></div>
          <div class="metric"><span>Percent</span><span id="phase3-readiness-percent">0</span></div>
          <pre id="phase3-readiness-json">Loading Phase 3 completion readiness...</pre>
        </section>
        <section class="panel" id="phase3-exit-panel">
          <h2>Phase 3 Exit</h2>
          <div class="metric"><span>Complete</span><span id="phase3-exit-complete">false</span></div>
          <div class="metric"><span>Percent</span><span id="phase3-exit-percent">0</span></div>
          <div class="metric"><span>Next</span><span id="phase3-exit-next">loading</span></div>
          <pre id="phase3-exit-json">Loading Phase 3 exit gate...</pre>
        </section>
        <section class="panel" id="phase4-plan-panel">
          <h2>Phase 4 Plan</h2>
          <div class="metric"><span>Ready</span><span id="phase4-plan-ready">false</span></div>
          <div class="metric"><span>Next</span><span id="phase4-plan-next">loading</span></div>
          <div class="metric"><span>Real Host Repair</span><span id="phase4-plan-real-repair">false</span></div>
          <pre id="phase4-plan-json">Loading Phase 4 plan...</pre>
        </section>
        <section class="panel" id="phase4-self-heal-loop-panel">
          <h2>Phase 4 Self-Heal Loop</h2>
          <div class="metric"><span>Ready</span><span id="phase4-self-heal-ready">false</span></div>
          <div class="metric"><span>Executed</span><span id="phase4-self-heal-executed">0</span></div>
          <div class="metric"><span>Skipped</span><span id="phase4-self-heal-skipped">0</span></div>
          <pre id="phase4-self-heal-json">Loading Phase 4 self-heal loop...</pre>
        </section>
        <section class="panel" id="phase4-heal-history-evidence-panel">
          <h2>Phase 4 Heal History Evidence</h2>
          <div class="metric"><span>Ready</span><span id="phase4-history-ready">false</span></div>
          <div class="metric"><span>Heal Items</span><span id="phase4-history-heal-count">0</span></div>
          <div class="metric"><span>Maintenance Runs</span><span id="phase4-history-maintenance-count">0</span></div>
          <pre id="phase4-history-json">Loading Phase 4 heal history evidence...</pre>
        </section>
        <section class="panel" id="phase4-completion-readiness-panel">
          <h2>Phase 4 Completion Readiness</h2>
          <div class="metric"><span>Ready</span><span id="phase4-readiness-ready">false</span></div>
          <div class="metric"><span>Checks</span><span id="phase4-readiness-checks">0/0</span></div>
          <div class="metric"><span>Percent</span><span id="phase4-readiness-percent">0</span></div>
          <pre id="phase4-readiness-json">Loading Phase 4 completion readiness...</pre>
        </section>
        <section class="panel" id="phase4-exit-panel">
          <h2>Phase 4 Exit</h2>
          <div class="metric"><span>Complete</span><span id="phase4-exit-complete">false</span></div>
          <div class="metric"><span>Percent</span><span id="phase4-exit-percent">0</span></div>
          <div class="metric"><span>Next</span><span id="phase4-exit-next">loading</span></div>
          <pre id="phase4-exit-json">Loading Phase 4 exit gate...</pre>
        </section>
        <section class="panel" id="phase5-plan-panel">
          <h2>Phase 5 Plan</h2>
          <div class="metric"><span>Ready</span><span id="phase5-plan-ready">false</span></div>
          <div class="metric"><span>Next</span><span id="phase5-plan-next">loading</span></div>
          <div class="metric"><span>Release Action</span><span id="phase5-plan-release-action">false</span></div>
          <pre id="phase5-plan-json">Loading Phase 5 plan...</pre>
        </section>
        <section class="panel" id="phase5-deployment-inventory-panel">
          <h2>Phase 5 Deployment Inventory</h2>
          <div class="metric"><span>Ready</span><span id="phase5-deployment-ready">false</span></div>
          <div class="metric"><span>Services</span><span id="phase5-deployment-services">0</span></div>
          <div class="metric"><span>Modules</span><span id="phase5-deployment-modules">0</span></div>
          <pre id="phase5-deployment-json">Loading Phase 5 deployment inventory...</pre>
        </section>
        <section class="panel" id="phase5-rollback-readiness-panel">
          <h2>Phase 5 Rollback Readiness</h2>
          <div class="metric"><span>Ready</span><span id="phase5-rollback-ready">false</span></div>
          <div class="metric"><span>Surfaces</span><span id="phase5-rollback-surfaces">0</span></div>
          <div class="metric"><span>Executed</span><span id="phase5-rollback-executed">false</span></div>
          <pre id="phase5-rollback-json">Loading Phase 5 rollback readiness...</pre>
        </section>
        <section class="panel" id="phase5-release-control-readiness-panel">
          <h2>Phase 5 Release Control Readiness</h2>
          <div class="metric"><span>Ready</span><span id="phase5-release-ready">false</span></div>
          <div class="metric"><span>Percent</span><span id="phase5-release-percent">0</span></div>
          <div class="metric"><span>Mutation</span><span id="phase5-release-mutation">false</span></div>
          <pre id="phase5-release-json">Loading Phase 5 release control readiness...</pre>
        </section>
        <section class="panel" id="phase5-exit-panel">
          <h2>Phase 5 Exit</h2>
          <div class="metric"><span>Complete</span><span id="phase5-exit-complete">false</span></div>
          <div class="metric"><span>Percent</span><span id="phase5-exit-percent">0</span></div>
          <div class="metric"><span>Next</span><span id="phase5-exit-next">loading</span></div>
          <pre id="phase5-exit-json">Loading Phase 5 exit gate...</pre>
        </section>
        <section class="panel" id="mvp-final-readiness-panel">
          <h2>MVP Final Readiness</h2>
          <div class="metric"><span>Complete</span><span id="mvp-final-complete">false</span></div>
          <div class="metric"><span>Criteria</span><span id="mvp-final-criteria">0/0</span></div>
          <div class="metric"><span>Next</span><span id="mvp-final-next">loading</span></div>
          <pre id="mvp-final-json">Loading MVP final readiness...</pre>
        </section>
        <section class="panel" id="post-mvp-plan-panel">
          <h2>Post-MVP Plan</h2>
          <div class="metric"><span>Ready</span><span id="post-mvp-plan-ready">false</span></div>
          <div class="metric"><span>Selected Trunk</span><span id="post-mvp-plan-trunk">loading</span></div>
          <div class="metric"><span>Next</span><span id="post-mvp-plan-next">loading</span></div>
          <pre id="post-mvp-plan-json">Loading post-MVP plan...</pre>
        </section>
        <section class="panel" id="phase6-plan-panel">
          <h2>Phase 6 Consciousness Memory Plan</h2>
          <div class="metric"><span>Ready</span><span id="phase6-plan-ready">false</span></div>
          <div class="metric"><span>Next</span><span id="phase6-plan-next">loading</span></div>
          <div class="metric"><span>Writes Memory</span><span id="phase6-plan-writes-memory">false</span></div>
          <pre id="phase6-plan-json">Loading Phase 6 plan...</pre>
        </section>
        <section class="panel" id="phase6-memory-substrate-inventory-panel">
          <h2>Phase 6 Memory Substrate Inventory</h2>
          <div class="metric"><span>Ready</span><span id="phase6-memory-ready">false</span></div>
          <div class="metric"><span>Sources</span><span id="phase6-memory-sources">0</span></div>
          <div class="metric"><span>Writable</span><span id="phase6-memory-writable">0</span></div>
          <pre id="phase6-memory-json">Loading Phase 6 memory substrate inventory...</pre>
        </section>
        <section class="panel" id="phase6-consciousness-context-envelope-panel">
          <h2>Phase 6 Consciousness Context Envelope</h2>
          <div class="metric"><span>Ready</span><span id="phase6-context-ready">false</span></div>
          <div class="metric"><span>Memory Pointers</span><span id="phase6-context-pointers">0</span></div>
          <div class="metric"><span>Transmitted</span><span id="phase6-context-transmitted">false</span></div>
          <pre id="phase6-context-json">Loading Phase 6 consciousness context envelope...</pre>
        </section>
        <section class="panel" id="phase6-task-orchestration-records-panel">
          <h2>Phase 6 Task Orchestration Records</h2>
          <div class="metric"><span>Ready</span><span id="phase6-orchestration-ready">false</span></div>
          <div class="metric"><span>Records</span><span id="phase6-orchestration-records">0</span></div>
          <div class="metric"><span>Scheduled</span><span id="phase6-orchestration-scheduled">0</span></div>
          <pre id="phase6-orchestration-json">Loading Phase 6 task orchestration records...</pre>
        </section>
        <section class="panel" id="phase6-memory-write-route-review-panel">
          <h2>Phase 6 Memory Write Route Review</h2>
          <div class="metric"><span>Ready</span><span id="phase6-route-ready">false</span></div>
          <div class="metric"><span>Selected</span><span id="phase6-route-selected">loading</span></div>
          <div class="metric"><span>Writes Memory</span><span id="phase6-route-writes-memory">false</span></div>
          <pre id="phase6-route-json">Loading Phase 6 memory write route review...</pre>
        </section>
        <section class="panel" id="phase6-exit-panel">
          <h2>Phase 6 Exit</h2>
          <div class="metric"><span>Complete</span><span id="phase6-exit-complete">false</span></div>
          <div class="metric"><span>Percent</span><span id="phase6-exit-percent">0</span></div>
          <div class="metric"><span>Next</span><span id="phase6-exit-next">loading</span></div>
          <pre id="phase6-exit-json">Loading Phase 6 exit gate...</pre>
        </section>
        <section class="panel" id="long-term-memory-write-plan-panel">
          <h2>Long-term Memory Write Plan</h2>
          <div class="metric"><span>Ready</span><span id="long-term-memory-plan-ready">false</span></div>
          <div class="metric"><span>Scope</span><span id="long-term-memory-plan-scope">loading</span></div>
          <div class="metric"><span>Writes Now</span><span id="long-term-memory-plan-writes">false</span></div>
          <pre id="long-term-memory-plan-json">Loading long-term memory write plan...</pre>
        </section>
        <section class="panel" id="long-term-memory-schema-panel">
          <h2>Long-term Memory Schema</h2>
          <div class="metric"><span>Ready</span><span id="long-term-memory-schema-ready">false</span></div>
          <div class="metric"><span>Fields</span><span id="long-term-memory-schema-fields">0</span></div>
          <div class="metric"><span>Cloud Call</span><span id="long-term-memory-schema-cloud">false</span></div>
          <pre id="long-term-memory-schema-json">Loading long-term memory schema...</pre>
        </section>
        <section class="panel" id="long-term-memory-proposal-panel">
          <h2>Long-term Memory Proposal</h2>
          <div class="metric"><span>Ready</span><span id="long-term-memory-proposal-ready">false</span></div>
          <div class="metric"><span>Type</span><span id="long-term-memory-proposal-type">loading</span></div>
          <div class="metric"><span>Bulk Import</span><span id="long-term-memory-proposal-bulk">false</span></div>
          <pre id="long-term-memory-proposal-json">Loading long-term memory proposal...</pre>
        </section>
        <section class="panel" id="long-term-memory-write-route-review-panel">
          <h2>Long-term Memory Write Route Review</h2>
          <div class="metric"><span>Ready</span><span id="long-term-memory-route-ready">false</span></div>
          <div class="metric"><span>Selected</span><span id="long-term-memory-route-selected">loading</span></div>
          <div class="metric"><span>Writes Now</span><span id="long-term-memory-route-writes">false</span></div>
          <pre id="long-term-memory-route-json">Loading long-term memory write route review...</pre>
        </section>
        <section class="panel" id="long-term-memory-write-task-panel">
          <h2>Long-term Memory Write Task</h2>
          <div class="metric"><span>Route Ready</span><span id="long-term-memory-task-ready">false</span></div>
          <div class="metric"><span>Creates Task</span><span id="long-term-memory-task-creates">false</span></div>
          <div class="metric"><span>Approval</span><span id="long-term-memory-task-approval">required</span></div>
          <pre id="long-term-memory-task-json">Loading long-term memory write task boundary...</pre>
        </section>
        <section class="panel" id="long-term-memory-approved-write-panel">
          <h2>Long-term Memory Approved Write</h2>
          <div class="metric"><span>Records</span><span id="long-term-memory-approved-records">0</span></div>
          <div class="metric"><span>Latest</span><span id="long-term-memory-approved-latest">none</span></div>
          <div class="metric"><span>Cloud Call</span><span id="long-term-memory-approved-cloud">false</span></div>
          <pre id="long-term-memory-approved-json">Loading approved long-term memory write evidence...</pre>
        </section>
        <section class="panel" id="long-term-memory-readback-panel">
          <h2>Long-term Memory Readback</h2>
          <div class="metric"><span>Ready</span><span id="long-term-memory-readback-ready">false</span></div>
          <div class="metric"><span>Records</span><span id="long-term-memory-readback-records">0</span></div>
          <div class="metric"><span>Hash</span><span id="long-term-memory-readback-hash">none</span></div>
          <pre id="long-term-memory-readback-json">Loading long-term memory readback...</pre>
        </section>
        <section class="panel" id="long-term-memory-exit-panel">
          <h2>Long-term Memory Exit</h2>
          <div class="metric"><span>Complete</span><span id="long-term-memory-exit-complete">false</span></div>
          <div class="metric"><span>Percent</span><span id="long-term-memory-exit-percent">0</span></div>
          <div class="metric"><span>Next</span><span id="long-term-memory-exit-next">loading</span></div>
          <pre id="long-term-memory-exit-json">Loading long-term memory exit gate...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-context-review-panel">
          <h2>Cloud Consciousness Context Review</h2>
          <div class="metric"><span>Ready</span><span id="cloud-context-review-ready">false</span></div>
          <div class="metric"><span>Cloud Call</span><span id="cloud-context-review-call">false</span></div>
          <div class="metric"><span>Next</span><span id="cloud-context-review-next">loading</span></div>
          <pre id="cloud-context-review-json">Loading cloud consciousness context review...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-envelope-schema-panel">
          <h2>Cloud Consciousness Envelope Schema</h2>
          <div class="metric"><span>Ready</span><span id="cloud-envelope-schema-ready">false</span></div>
          <div class="metric"><span>Fields</span><span id="cloud-envelope-schema-fields">0</span></div>
          <div class="metric"><span>Transmission</span><span id="cloud-envelope-schema-transmission">false</span></div>
          <pre id="cloud-envelope-schema-json">Loading cloud consciousness envelope schema...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-context-package-panel">
          <h2>Cloud Consciousness Context Package</h2>
          <div class="metric"><span>Ready</span><span id="cloud-context-package-ready">false</span></div>
          <div class="metric"><span>Memory Records</span><span id="cloud-context-package-memory">0</span></div>
          <div class="metric"><span>Secrets</span><span id="cloud-context-package-secrets">false</span></div>
          <pre id="cloud-context-package-json">Loading cloud consciousness context package...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-redaction-review-panel">
          <h2>Cloud Consciousness Redaction Review</h2>
          <div class="metric"><span>Ready</span><span id="cloud-redaction-ready">false</span></div>
          <div class="metric"><span>Rejected</span><span id="cloud-redaction-rejected">0</span></div>
          <div class="metric"><span>Secrets</span><span id="cloud-redaction-secrets">false</span></div>
          <pre id="cloud-redaction-json">Loading cloud consciousness redaction review...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-transmission-route-review-panel">
          <h2>Cloud Consciousness Transmission Route Review</h2>
          <div class="metric"><span>Ready</span><span id="cloud-route-ready">false</span></div>
          <div class="metric"><span>Selected</span><span id="cloud-route-selected">loading</span></div>
          <div class="metric"><span>Cloud Call</span><span id="cloud-route-call">false</span></div>
          <pre id="cloud-route-json">Loading cloud consciousness transmission route review...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-handoff-task-panel">
          <h2>Cloud Consciousness Handoff Task</h2>
          <div class="metric"><span>Route Ready</span><span id="cloud-handoff-task-ready">false</span></div>
          <div class="metric"><span>Creates Task</span><span id="cloud-handoff-task-creates">false</span></div>
          <div class="metric"><span>Approval</span><span id="cloud-handoff-task-approval">required</span></div>
          <pre id="cloud-handoff-task-json">Loading cloud consciousness handoff task boundary...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-approved-handoff-panel">
          <h2>Cloud Consciousness Approved Handoff</h2>
          <div class="metric"><span>Records</span><span id="cloud-approved-handoff-records">0</span></div>
          <div class="metric"><span>Latest</span><span id="cloud-approved-handoff-latest">none</span></div>
          <div class="metric"><span>Transmitted</span><span id="cloud-approved-handoff-transmitted">false</span></div>
          <pre id="cloud-approved-handoff-json">Loading approved local handoff evidence...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-handoff-readback-panel">
          <h2>Cloud Consciousness Handoff Readback</h2>
          <div class="metric"><span>Ready</span><span id="cloud-handoff-readback-ready">false</span></div>
          <div class="metric"><span>Records</span><span id="cloud-handoff-readback-records">0</span></div>
          <div class="metric"><span>Hash</span><span id="cloud-handoff-readback-hash">none</span></div>
          <pre id="cloud-handoff-readback-json">Loading cloud consciousness handoff readback...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-exit-panel">
          <h2>Cloud Consciousness Exit</h2>
          <div class="metric"><span>Complete</span><span id="cloud-exit-complete">false</span></div>
          <div class="metric"><span>Percent</span><span id="cloud-exit-percent">0</span></div>
          <div class="metric"><span>Next</span><span id="cloud-exit-next">loading</span></div>
          <pre id="cloud-exit-json">Loading cloud consciousness exit gate...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-provider-adapter-plan-panel">
          <h2>Cloud Consciousness Provider Adapter Plan</h2>
          <div class="metric"><span>Ready</span><span id="cloud-provider-plan-ready">false</span></div>
          <div class="metric"><span>Cloud Call</span><span id="cloud-provider-plan-call">false</span></div>
          <div class="metric"><span>Next</span><span id="cloud-provider-plan-next">loading</span></div>
          <pre id="cloud-provider-plan-json">Loading cloud consciousness provider adapter plan...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-provider-contract-panel">
          <h2>Cloud Consciousness Provider Contract</h2>
          <div class="metric"><span>Ready</span><span id="cloud-provider-contract-ready">false</span></div>
          <div class="metric"><span>Methods</span><span id="cloud-provider-contract-methods">0</span></div>
          <div class="metric"><span>SDK Loaded</span><span id="cloud-provider-contract-sdk">false</span></div>
          <pre id="cloud-provider-contract-json">Loading cloud consciousness provider contract...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-provider-request-envelope-panel">
          <h2>Cloud Consciousness Provider Request Envelope</h2>
          <div class="metric"><span>Ready</span><span id="cloud-provider-envelope-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-provider-envelope-source">none</span></div>
          <div class="metric"><span>Secrets</span><span id="cloud-provider-envelope-secrets">false</span></div>
          <pre id="cloud-provider-envelope-json">Loading cloud consciousness provider request envelope...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-provider-dry-run-route-review-panel">
          <h2>Cloud Consciousness Provider Dry Run Route</h2>
          <div class="metric"><span>Ready</span><span id="cloud-provider-route-ready">false</span></div>
          <div class="metric"><span>Selected</span><span id="cloud-provider-route-selected">loading</span></div>
          <div class="metric"><span>Cloud Call</span><span id="cloud-provider-route-call">false</span></div>
          <pre id="cloud-provider-route-json">Loading cloud consciousness provider dry-run route review...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-provider-dry-run-task-panel">
          <h2>Cloud Consciousness Provider Dry Run Task</h2>
          <div class="metric"><span>Route Ready</span><span id="cloud-provider-task-ready">false</span></div>
          <div class="metric"><span>Creates Task</span><span id="cloud-provider-task-creates">false</span></div>
          <div class="metric"><span>Approval</span><span id="cloud-provider-task-approval">required</span></div>
          <pre id="cloud-provider-task-json">Loading cloud consciousness provider dry-run task boundary...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-approved-provider-dry-run-panel">
          <h2>Cloud Consciousness Approved Provider Dry Run</h2>
          <div class="metric"><span>Records</span><span id="cloud-provider-approved-records">0</span></div>
          <div class="metric"><span>Latest</span><span id="cloud-provider-approved-latest">none</span></div>
          <div class="metric"><span>Transmitted</span><span id="cloud-provider-approved-transmitted">false</span></div>
          <pre id="cloud-provider-approved-json">Loading approved provider dry-run evidence...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-provider-dry-run-readback-panel">
          <h2>Cloud Consciousness Provider Dry Run Readback</h2>
          <div class="metric"><span>Ready</span><span id="cloud-provider-readback-ready">false</span></div>
          <div class="metric"><span>Records</span><span id="cloud-provider-readback-records">0</span></div>
          <div class="metric"><span>Hash</span><span id="cloud-provider-readback-hash">none</span></div>
          <pre id="cloud-provider-readback-json">Loading cloud consciousness provider dry-run readback...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-provider-adapter-exit-panel">
          <h2>Cloud Consciousness Provider Adapter Exit</h2>
          <div class="metric"><span>Complete</span><span id="cloud-provider-exit-complete">false</span></div>
          <div class="metric"><span>Percent</span><span id="cloud-provider-exit-percent">0</span></div>
          <div class="metric"><span>Next</span><span id="cloud-provider-exit-next">loading</span></div>
          <pre id="cloud-provider-exit-json">Loading cloud consciousness provider adapter exit gate...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-real-provider-call-plan-panel">
          <h2>Cloud Consciousness Real Provider Call Plan</h2>
          <div class="metric"><span>Ready</span><span id="cloud-real-provider-plan-ready">false</span></div>
          <div class="metric"><span>Cloud Call</span><span id="cloud-real-provider-plan-call">false</span></div>
          <div class="metric"><span>Next</span><span id="cloud-real-provider-plan-next">loading</span></div>
          <pre id="cloud-real-provider-plan-json">Loading real provider call plan...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-provider-egress-contract-panel">
          <h2>Cloud Consciousness Provider Egress Contract</h2>
          <div class="metric"><span>Ready</span><span id="cloud-egress-contract-ready">false</span></div>
          <div class="metric"><span>Preflights</span><span id="cloud-egress-contract-preflights">0</span></div>
          <div class="metric"><span>Transmits</span><span id="cloud-egress-contract-transmits">false</span></div>
          <pre id="cloud-egress-contract-json">Loading provider egress contract...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-provider-credential-preflight-panel">
          <h2>Cloud Consciousness Provider Credential Preflight</h2>
          <div class="metric"><span>Ready</span><span id="cloud-credential-preflight-ready">false</span></div>
          <div class="metric"><span>Credential Read</span><span id="cloud-credential-preflight-read">false</span></div>
          <div class="metric"><span>Live Call</span><span id="cloud-credential-preflight-live">false</span></div>
          <pre id="cloud-credential-preflight-json">Loading provider credential preflight...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-provider-request-redaction-review-panel">
          <h2>Cloud Consciousness Provider Request Redaction Review</h2>
          <div class="metric"><span>Ready</span><span id="cloud-request-redaction-ready">false</span></div>
          <div class="metric"><span>Rejected</span><span id="cloud-request-redaction-rejected">0</span></div>
          <div class="metric"><span>Secrets</span><span id="cloud-request-redaction-secrets">false</span></div>
          <pre id="cloud-request-redaction-json">Loading provider request redaction review...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-real-provider-call-route-review-panel">
          <h2>Cloud Consciousness Real Provider Call Route</h2>
          <div class="metric"><span>Ready</span><span id="cloud-real-provider-route-ready">false</span></div>
          <div class="metric"><span>Selected</span><span id="cloud-real-provider-route-selected">loading</span></div>
          <div class="metric"><span>Cloud Call</span><span id="cloud-real-provider-route-call">false</span></div>
          <pre id="cloud-real-provider-route-json">Loading real provider call route review...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-real-provider-call-task-panel">
          <h2>Cloud Consciousness Real Provider Call Task</h2>
          <div class="metric"><span>Route Ready</span><span id="cloud-real-provider-task-ready">false</span></div>
          <div class="metric"><span>Creates Task</span><span id="cloud-real-provider-task-creates">false</span></div>
          <div class="metric"><span>Approval</span><span id="cloud-real-provider-task-approval">required</span></div>
          <pre id="cloud-real-provider-task-json">Loading real provider call task boundary...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-approved-provider-call-rehearsal-panel">
          <h2>Cloud Consciousness Approved Provider Call Rehearsal</h2>
          <div class="metric"><span>Records</span><span id="cloud-call-rehearsal-records">0</span></div>
          <div class="metric"><span>Latest</span><span id="cloud-call-rehearsal-latest">none</span></div>
          <div class="metric"><span>Transmitted</span><span id="cloud-call-rehearsal-transmitted">false</span></div>
          <pre id="cloud-call-rehearsal-json">Loading approved provider call rehearsal evidence...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-provider-response-readback-panel">
          <h2>Cloud Consciousness Provider Response Readback</h2>
          <div class="metric"><span>Ready</span><span id="cloud-response-readback-ready">false</span></div>
          <div class="metric"><span>Records</span><span id="cloud-response-readback-records">0</span></div>
          <div class="metric"><span>Hash</span><span id="cloud-response-readback-hash">none</span></div>
          <pre id="cloud-response-readback-json">Loading provider response readback...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-real-provider-call-exit-panel">
          <h2>Cloud Consciousness Real Provider Call Exit</h2>
          <div class="metric"><span>Complete</span><span id="cloud-real-provider-exit-complete">false</span></div>
          <div class="metric"><span>Percent</span><span id="cloud-real-provider-exit-percent">0</span></div>
          <div class="metric"><span>Next</span><span id="cloud-real-provider-exit-next">loading</span></div>
          <pre id="cloud-real-provider-exit-json">Loading real provider call exit gate...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-call-runbook-panel">
          <h2>Cloud Consciousness Live Provider Call Runbook</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-runbook-ready">false</span></div>
          <div class="metric"><span>Live Enabled</span><span id="cloud-live-runbook-enabled">false</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-runbook-next">loading</span></div>
          <pre id="cloud-live-runbook-json">Loading live provider call runbook...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-operator-checklist-panel">
          <h2>Cloud Consciousness Live Provider Operator Checklist</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-checklist-ready">false</span></div>
          <div class="metric"><span>Items</span><span id="cloud-live-checklist-items">0</span></div>
          <div class="metric"><span>Transmits</span><span id="cloud-live-checklist-transmits">false</span></div>
          <pre id="cloud-live-checklist-json">Loading live provider operator checklist...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-egress-transcript-schema-panel">
          <h2>Cloud Consciousness Live Provider Egress Transcript Schema</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-transcript-ready">false</span></div>
          <div class="metric"><span>Fields</span><span id="cloud-live-transcript-fields">0</span></div>
          <div class="metric"><span>Status</span><span id="cloud-live-transcript-status">loading</span></div>
          <pre id="cloud-live-transcript-json">Loading live provider egress transcript schema...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-final-authorization-review-panel">
          <h2>Cloud Consciousness Live Provider Final Authorization Review</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-auth-ready">false</span></div>
          <div class="metric"><span>Live Enabled</span><span id="cloud-live-auth-enabled">false</span></div>
          <div class="metric"><span>Credential Read</span><span id="cloud-live-auth-credential">false</span></div>
          <pre id="cloud-live-auth-json">Loading live provider final authorization review...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-runbook-route-review-panel">
          <h2>Cloud Consciousness Live Provider Runbook Route</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-route-ready">false</span></div>
          <div class="metric"><span>Selected</span><span id="cloud-live-route-selected">loading</span></div>
          <div class="metric"><span>Cloud Call</span><span id="cloud-live-route-call">false</span></div>
          <pre id="cloud-live-route-json">Loading live provider runbook route review...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-runbook-task-panel">
          <h2>Cloud Consciousness Live Provider Runbook Task</h2>
          <div class="metric"><span>Route Ready</span><span id="cloud-live-task-ready">false</span></div>
          <div class="metric"><span>Creates Task</span><span id="cloud-live-task-creates">false</span></div>
          <div class="metric"><span>Approval</span><span id="cloud-live-task-approval">required</span></div>
          <pre id="cloud-live-task-json">Loading live provider runbook task boundary...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-approved-live-provider-runbook-panel">
          <h2>Cloud Consciousness Approved Live Provider Runbook</h2>
          <div class="metric"><span>Records</span><span id="cloud-live-approved-records">0</span></div>
          <div class="metric"><span>Latest</span><span id="cloud-live-approved-latest">none</span></div>
          <div class="metric"><span>Live Enabled</span><span id="cloud-live-approved-enabled">false</span></div>
          <pre id="cloud-live-approved-json">Loading approved live provider runbook evidence...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-runbook-readback-panel">
          <h2>Cloud Consciousness Live Provider Runbook Readback</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-readback-ready">false</span></div>
          <div class="metric"><span>Records</span><span id="cloud-live-readback-records">0</span></div>
          <div class="metric"><span>Hash</span><span id="cloud-live-readback-hash">none</span></div>
          <pre id="cloud-live-readback-json">Loading live provider runbook readback...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-call-runbook-exit-panel">
          <h2>Cloud Consciousness Live Provider Call Runbook Exit</h2>
          <div class="metric"><span>Complete</span><span id="cloud-live-exit-complete">false</span></div>
          <div class="metric"><span>Percent</span><span id="cloud-live-exit-percent">0</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-exit-next">loading</span></div>
          <pre id="cloud-live-exit-json">Loading live provider call runbook exit gate...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-call-execution-plan-panel">
          <h2>Cloud Consciousness Live Provider Call Execution Plan</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-exec-plan-ready">false</span></div>
          <div class="metric"><span>Live Enabled</span><span id="cloud-live-exec-plan-enabled">false</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-exec-plan-next">loading</span></div>
          <pre id="cloud-live-exec-plan-json">Loading live provider execution plan...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-execution-route-review-panel">
          <h2>Cloud Consciousness Live Provider Execution Route</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-exec-route-ready">false</span></div>
          <div class="metric"><span>Selected</span><span id="cloud-live-exec-route-selected">loading</span></div>
          <div class="metric"><span>Calls Cloud</span><span id="cloud-live-exec-route-call">false</span></div>
          <pre id="cloud-live-exec-route-json">Loading live provider execution route...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-execution-plan-readback-panel">
          <h2>Cloud Consciousness Live Provider Execution Plan Readback</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-exec-readback-ready">false</span></div>
          <div class="metric"><span>Records</span><span id="cloud-live-exec-readback-records">0</span></div>
          <div class="metric"><span>Hash</span><span id="cloud-live-exec-readback-hash">none</span></div>
          <pre id="cloud-live-exec-readback-json">Loading live provider execution plan readback...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-call-execution-plan-exit-panel">
          <h2>Cloud Consciousness Live Provider Call Execution Plan Exit</h2>
          <div class="metric"><span>Complete</span><span id="cloud-live-exec-exit-complete">false</span></div>
          <div class="metric"><span>Percent</span><span id="cloud-live-exec-exit-percent">0</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-exec-exit-next">loading</span></div>
          <pre id="cloud-live-exec-exit-json">Loading live provider execution plan exit gate...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-call-runtime-adapter-plan-panel">
          <h2>Cloud Consciousness Live Provider Runtime Adapter Plan</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-runtime-adapter-plan-ready">false</span></div>
          <div class="metric"><span>Percent</span><span id="cloud-live-runtime-adapter-plan-percent">0</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-runtime-adapter-plan-next">loading</span></div>
          <pre id="cloud-live-runtime-adapter-plan-json">Loading live provider runtime adapter plan...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-runtime-adapter-exit-panel">
          <h2>Cloud Consciousness Live Provider Runtime Adapter Exit</h2>
          <div class="metric"><span>Complete</span><span id="cloud-live-runtime-adapter-exit-complete">false</span></div>
          <div class="metric"><span>Percent</span><span id="cloud-live-runtime-adapter-exit-percent">0</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-runtime-adapter-exit-next">loading</span></div>
          <pre id="cloud-live-runtime-adapter-exit-json">Loading live provider runtime adapter exit gate...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-call-final-authorization-panel">
          <h2>Cloud Consciousness Live Provider Call Final Authorization</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-final-auth-ready">false</span></div>
          <div class="metric"><span>Granted</span><span id="cloud-live-final-auth-granted">false</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-final-auth-next">loading</span></div>
          <pre id="cloud-live-final-auth-json">Loading live provider final authorization gate...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-call-operator-launch-review-panel">
          <h2>Cloud Consciousness Live Provider Call Operator Launch Review</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-launch-review-ready">false</span></div>
          <div class="metric"><span>Launch Authorized</span><span id="cloud-live-launch-review-authorized">false</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-launch-review-next">loading</span></div>
          <pre id="cloud-live-launch-review-json">Loading live provider operator launch review...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-call-runtime-implementation-plan-panel">
          <h2>Cloud Consciousness Live Provider Runtime Implementation Plan</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-runtime-impl-plan-ready">false</span></div>
          <div class="metric"><span>Implemented</span><span id="cloud-live-runtime-impl-plan-implemented">false</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-runtime-impl-plan-next">loading</span></div>
          <pre id="cloud-live-runtime-impl-plan-json">Loading live provider runtime implementation plan...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-call-runtime-adapter-implementation-panel">
          <h2>Cloud Consciousness Live Provider Runtime Adapter Implementation</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-runtime-adapter-impl-ready">false</span></div>
          <div class="metric"><span>Interface Defined</span><span id="cloud-live-runtime-adapter-impl-interface">false</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-runtime-adapter-impl-next">loading</span></div>
          <pre id="cloud-live-runtime-adapter-impl-json">Loading live provider runtime adapter implementation scaffold...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-runtime-adapter-module-contract-panel">
          <h2>Cloud Consciousness Live Provider Runtime Adapter Module Contract</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-runtime-adapter-module-ready">false</span></div>
          <div class="metric"><span>Module Boundary</span><span id="cloud-live-runtime-adapter-module-boundary">false</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-runtime-adapter-module-next">loading</span></div>
          <pre id="cloud-live-runtime-adapter-module-json">Loading live provider runtime adapter module contract...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-request-builder-panel">
          <h2>Cloud Consciousness Live Provider Request Builder</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-request-builder-ready">false</span></div>
          <div class="metric"><span>Messages</span><span id="cloud-live-provider-request-builder-messages">0</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-request-builder-next">loading</span></div>
          <pre id="cloud-live-provider-request-builder-json">Loading live provider request builder...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-reference-resolver-panel">
          <h2>Cloud Consciousness Live Provider Credential Reference Resolver</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-reference-resolver-ready">false</span></div>
          <div class="metric"><span>Reference Only</span><span id="cloud-live-provider-credential-reference-resolver-reference-only">false</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-reference-resolver-next">loading</span></div>
          <pre id="cloud-live-provider-credential-reference-resolver-json">Loading credential reference resolver...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-no-network-sender-panel">
          <h2>Cloud Consciousness Live Provider No-Network Sender</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-no-network-sender-ready">false</span></div>
          <div class="metric"><span>Dispatch Deferred</span><span id="cloud-live-provider-no-network-sender-dispatch">false</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-no-network-sender-next">loading</span></div>
          <pre id="cloud-live-provider-no-network-sender-json">Loading no-network sender...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-egress-transcript-recorder-panel">
          <h2>Cloud Consciousness Live Provider Egress Transcript Recorder</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-egress-transcript-recorder-ready">false</span></div>
          <div class="metric"><span>Local Only</span><span id="cloud-live-provider-egress-transcript-recorder-local">false</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-egress-transcript-recorder-next">loading</span></div>
          <pre id="cloud-live-provider-egress-transcript-recorder-json">Loading egress transcript recorder...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-response-verifier-panel">
          <h2>Cloud Consciousness Live Provider Response Verifier</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-response-verifier-ready">false</span></div>
          <div class="metric"><span>Verified</span><span id="cloud-live-provider-response-verifier-verified">false</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-response-verifier-next">loading</span></div>
          <pre id="cloud-live-provider-response-verifier-json">Loading response verifier...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-rollback-note-panel">
          <h2>Cloud Consciousness Live Provider Rollback Note</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-rollback-note-ready">false</span></div>
          <div class="metric"><span>Executed</span><span id="cloud-live-provider-rollback-note-executed">false</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-rollback-note-next">loading</span></div>
          <pre id="cloud-live-provider-rollback-note-json">Loading rollback note...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-runtime-adapter-completion-panel">
          <h2>Cloud Consciousness Live Provider Runtime Adapter Completion</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-runtime-adapter-completion-ready">false</span></div>
          <div class="metric"><span>Methods</span><span id="cloud-live-provider-runtime-adapter-completion-methods">0/0</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-runtime-adapter-completion-next">loading</span></div>
          <pre id="cloud-live-provider-runtime-adapter-completion-json">Loading runtime adapter completion...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-runtime-adapter-closure-panel">
          <h2>Cloud Consciousness Live Provider Runtime Adapter Closure</h2>
          <div class="metric"><span>Complete</span><span id="cloud-live-provider-runtime-adapter-closure-complete">false</span></div>
          <div class="metric"><span>Percent</span><span id="cloud-live-provider-runtime-adapter-closure-percent">0</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-runtime-adapter-closure-next">loading</span></div>
          <pre id="cloud-live-provider-runtime-adapter-closure-json">Loading runtime adapter closure...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-real-launch-route-review-panel">
          <h2>Cloud Consciousness Live Provider Real Launch Route Review</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-real-launch-route-review-ready">false</span></div>
          <div class="metric"><span>Selected</span><span id="cloud-live-provider-real-launch-route-review-selected">loading</span></div>
          <div class="metric"><span>Launch</span><span id="cloud-live-provider-real-launch-route-review-launch">not authorized</span></div>
          <pre id="cloud-live-provider-real-launch-route-review-json">Loading real launch route review...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-real-launch-execution-preflight-panel">
          <h2>Cloud Consciousness Live Provider Real Launch Execution Preflight</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-real-launch-execution-preflight-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-real-launch-execution-preflight-source">none</span></div>
          <div class="metric"><span>Launch</span><span id="cloud-live-provider-real-launch-execution-preflight-launch">not authorized</span></div>
          <pre id="cloud-live-provider-real-launch-execution-preflight-json">Loading real launch execution preflight...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-access-gate-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Access Gate</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-access-gate-ready">false</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-access-gate-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-access-gate-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-access-gate-json">Loading credential value access gate...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-endpoint-network-egress-gate-panel">
          <h2>Cloud Consciousness Live Provider Endpoint Network Egress Gate</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-endpoint-network-egress-gate-ready">false</span></div>
          <div class="metric"><span>Endpoint</span><span id="cloud-live-provider-endpoint-network-egress-gate-endpoint">not contacted</span></div>
          <div class="metric"><span>Network</span><span id="cloud-live-provider-endpoint-network-egress-gate-network">no egress</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-endpoint-network-egress-gate-next">loading</span></div>
          <pre id="cloud-live-provider-endpoint-network-egress-gate-json">Loading endpoint network egress gate...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-egress-execution-route-task-preflight-panel">
          <h2>Cloud Consciousness Live Provider Egress Execution Route Task Preflight</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-egress-execution-route-task-preflight-ready">false</span></div>
          <div class="metric"><span>Task</span><span id="cloud-live-provider-egress-execution-route-task-preflight-task">not created</span></div>
          <div class="metric"><span>Network</span><span id="cloud-live-provider-egress-execution-route-task-preflight-network">no egress</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-egress-execution-route-task-preflight-next">loading</span></div>
          <pre id="cloud-live-provider-egress-execution-route-task-preflight-json">Loading egress execution route task preflight...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-egress-execution-task-shell-panel">
          <h2>Cloud Consciousness Live Provider Egress Execution Task Shell</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-egress-execution-task-shell-ready">false</span></div>
          <div class="metric"><span>Approval</span><span id="cloud-live-provider-egress-execution-task-shell-approval">required</span></div>
          <div class="metric"><span>Network</span><span id="cloud-live-provider-egress-execution-task-shell-network">no egress</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-egress-execution-task-shell-next">loading</span></div>
          <pre id="cloud-live-provider-egress-execution-task-shell-json">Loading egress execution task shell...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-egress-execution-approved-deferred-panel">
          <h2>Cloud Consciousness Live Provider Egress Execution Approved Deferred</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-egress-execution-approved-deferred-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-egress-execution-approved-deferred-source">none</span></div>
          <div class="metric"><span>Network</span><span id="cloud-live-provider-egress-execution-approved-deferred-network">no egress</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-egress-execution-approved-deferred-next">loading</span></div>
          <pre id="cloud-live-provider-egress-execution-approved-deferred-json">Loading egress execution approved deferred evidence...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-authorization-route-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Authorization Route</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-authorization-route-ready">false</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-authorization-route-credential">not read</span></div>
          <div class="metric"><span>Network</span><span id="cloud-live-provider-credential-value-authorization-route-network">no egress</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-authorization-route-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-authorization-route-json">Loading credential value authorization route...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-authorization-task-shell-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Authorization Task Shell</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-authorization-task-shell-ready">false</span></div>
          <div class="metric"><span>Approval</span><span id="cloud-live-provider-credential-value-authorization-task-shell-approval">required</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-authorization-task-shell-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-authorization-task-shell-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-authorization-task-shell-json">Loading credential value authorization task shell...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-authorization-approved-deferred-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Authorization Approved Deferred</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-authorization-approved-deferred-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-authorization-approved-deferred-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-authorization-approved-deferred-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-authorization-approved-deferred-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-authorization-approved-deferred-json">Loading credential value authorization approved deferred evidence...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-readiness-preflight-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Readiness Preflight</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-readiness-preflight-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-readiness-preflight-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-readiness-preflight-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-readiness-preflight-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-readiness-preflight-json">Loading credential value readiness preflight...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-read-task-shell-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Read Task Shell</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-read-task-shell-ready">false</span></div>
          <div class="metric"><span>Approval</span><span id="cloud-live-provider-credential-value-read-task-shell-approval">required</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-read-task-shell-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-read-task-shell-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-read-task-shell-json">Loading credential value read task shell...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-read-approved-deferred-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Read Approved Deferred</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-read-approved-deferred-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-read-approved-deferred-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-read-approved-deferred-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-read-approved-deferred-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-read-approved-deferred-json">Loading credential value read approved deferred evidence...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-access-authorization-route-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Access Authorization Route</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-access-authorization-route-ready">false</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-access-authorization-route-credential">not read</span></div>
          <div class="metric"><span>Network</span><span id="cloud-live-provider-credential-value-access-authorization-route-network">no egress</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-access-authorization-route-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-access-authorization-route-json">Loading credential value access authorization route...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-access-authorization-task-shell-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Access Authorization Task Shell</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-access-authorization-task-shell-ready">false</span></div>
          <div class="metric"><span>Approval</span><span id="cloud-live-provider-credential-value-access-authorization-task-shell-approval">required</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-access-authorization-task-shell-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-access-authorization-task-shell-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-access-authorization-task-shell-json">Loading credential value access authorization task shell...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-access-authorization-approved-deferred-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Access Authorization Approved Deferred</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-access-authorization-approved-deferred-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-access-authorization-approved-deferred-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-access-authorization-approved-deferred-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-access-authorization-approved-deferred-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-access-authorization-approved-deferred-json">Loading credential value access authorization approved deferred evidence...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-final-readiness-preflight-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Final Readiness Preflight</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-final-readiness-preflight-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-final-readiness-preflight-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-final-readiness-preflight-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-final-readiness-preflight-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-final-readiness-preflight-json">Loading credential value final readiness preflight...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-access-authorization-decision-route-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Access Authorization Decision Route</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-access-authorization-decision-route-ready">false</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-access-authorization-decision-route-credential">not read</span></div>
          <div class="metric"><span>Network</span><span id="cloud-live-provider-credential-value-access-authorization-decision-route-network">no egress</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-access-authorization-decision-route-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-access-authorization-decision-route-json">Loading credential value access authorization decision route...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-access-authorization-decision-task-shell-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Access Authorization Decision Task Shell</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-access-authorization-decision-task-shell-ready">false</span></div>
          <div class="metric"><span>Approval</span><span id="cloud-live-provider-credential-value-access-authorization-decision-task-shell-approval">required</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-access-authorization-decision-task-shell-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-access-authorization-decision-task-shell-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-access-authorization-decision-task-shell-json">Loading credential value access authorization decision task shell...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-access-authorization-decision-approved-deferred-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Access Authorization Decision Approved Deferred</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-access-authorization-decision-approved-deferred-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-access-authorization-decision-approved-deferred-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-access-authorization-decision-approved-deferred-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-access-authorization-decision-approved-deferred-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-access-authorization-decision-approved-deferred-json">Loading credential value access authorization decision approved deferred evidence...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-access-authorized-local-proof-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Access Authorized Local Proof</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-access-authorized-local-proof-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-access-authorized-local-proof-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-access-authorized-local-proof-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-access-authorized-local-proof-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-access-authorized-local-proof-json">Loading credential value access authorized local proof...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-route-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Route</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-route-ready">false</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-route-credential">not read</span></div>
          <div class="metric"><span>Network</span><span id="cloud-live-provider-credential-value-local-read-route-network">no egress</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-route-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-route-json">Loading credential value local read route...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-task-shell-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Task Shell</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-task-shell-ready">false</span></div>
          <div class="metric"><span>Approval</span><span id="cloud-live-provider-credential-value-local-read-task-shell-approval">required</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-task-shell-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-task-shell-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-task-shell-json">Loading credential value local read task shell...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-approved-deferred-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Approved Deferred</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-approved-deferred-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-local-read-approved-deferred-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-approved-deferred-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-approved-deferred-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-approved-deferred-json">Loading credential value local read approved deferred evidence...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-final-readiness-preflight-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Final Readiness Preflight</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-final-readiness-preflight-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-local-read-final-readiness-preflight-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-final-readiness-preflight-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-final-readiness-preflight-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-final-readiness-preflight-json">Loading credential value local read final readiness preflight...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-route-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Route</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-route-ready">false</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-route-credential">not read</span></div>
          <div class="metric"><span>Network</span><span id="cloud-live-provider-credential-value-local-read-execution-route-network">no egress</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-route-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-route-json">Loading credential value local read execution route...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-task-shell-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Task Shell</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-task-shell-ready">false</span></div>
          <div class="metric"><span>Approval</span><span id="cloud-live-provider-credential-value-local-read-execution-task-shell-approval">required</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-task-shell-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-task-shell-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-task-shell-json">Loading credential value local read execution task shell...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-approved-deferred-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Approved Deferred</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-approved-deferred-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-local-read-execution-approved-deferred-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-approved-deferred-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-approved-deferred-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-approved-deferred-json">Loading credential value local read execution approved deferred evidence...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-final-readiness-preflight-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Final Readiness Preflight</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-final-readiness-preflight-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-local-read-execution-final-readiness-preflight-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-final-readiness-preflight-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-final-readiness-preflight-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-final-readiness-preflight-json">Loading credential value local read execution final readiness preflight...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-route-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Route</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-route-ready">false</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-route-credential">not read</span></div>
          <div class="metric"><span>Network</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-route-network">no egress</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-route-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-route-json">Loading credential value local read execution local read route...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-task-shell-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Task Shell</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-task-shell-ready">false</span></div>
          <div class="metric"><span>Approval</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-task-shell-approval">required</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-task-shell-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-task-shell-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-task-shell-json">Loading credential value local read execution local read task shell...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-approved-deferred-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Approved Deferred</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-approved-deferred-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-approved-deferred-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-approved-deferred-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-approved-deferred-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-approved-deferred-json">Loading credential value local read execution local read approved deferred evidence...</pre>
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
              <button id="takeover-button" class="secondary">Take Over Current Task</button>
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
        <section class="panel" id="system-health-trends">
          <h2>Health Trends</h2>
          <div class="metric"><span>Samples</span><span id="health-trend-sample-count">0</span></div>
          <div class="metric"><span>Stable Services</span><span id="health-trend-stable-services">0</span></div>
          <div class="metric"><span>Degraded</span><span id="health-trend-degraded-services">0</span></div>
          <div class="metric"><span>Latest Alerts</span><span id="health-trend-alert-count">0</span></div>
          <pre id="health-trend-json">Loading read-only OpenClaw health trend summary...</pre>
        </section>
        <section class="panel" id="route-aware-next-action">
          <h2>Route-Aware Next Action</h2>
          <div class="metric"><span>Action</span><span id="route-next-action-name">loading</span></div>
          <div class="metric"><span>Priority</span><span id="route-next-action-priority">unknown</span></div>
          <div class="metric"><span>Creates Task</span><span id="route-next-action-creates-task">false</span></div>
          <div class="metric"><span>Mutation</span><span id="route-next-action-mutation">false</span></div>
          <pre id="route-next-action-json">Loading route-aware body governance recommendation...</pre>
        </section>
        <section class="panel" id="conservative-recovery-policy">
          <h2>Recovery Policy</h2>
          <div class="metric"><span>Posture</span><span id="recovery-policy-posture">loading</span></div>
          <div class="metric"><span>Creates Task</span><span id="recovery-policy-creates-task">false</span></div>
          <div class="metric"><span>Executes Command</span><span id="recovery-policy-executes-command">false</span></div>
          <div class="metric"><span>Mutation</span><span id="recovery-policy-mutation">false</span></div>
          <pre id="recovery-policy-json">Loading conservative recovery policy explanation...</pre>
        </section>
        <section class="panel" id="body-governance-readiness">
          <h2>Body Governance Readiness</h2>
          <div class="metric"><span>Ready</span><span id="body-governance-ready">false</span></div>
          <div class="metric"><span>Checks</span><span id="body-governance-checks">0/0</span></div>
          <div class="metric"><span>Posture</span><span id="body-governance-posture">loading</span></div>
          <div class="metric"><span>Mutation</span><span id="body-governance-mutation">false</span></div>
          <pre id="body-governance-json">Loading body governance readiness bundle...</pre>
        </section>
        <section class="panel" id="body-evidence-timeline-panel">
          <h2>Body Evidence Timeline</h2>
          <div class="metric"><span>Ready</span><span id="body-evidence-timeline-ready">false</span></div>
          <div class="metric"><span>Entries</span><span id="body-evidence-timeline-entries">0</span></div>
          <div class="metric"><span>Latest</span><span id="body-evidence-timeline-latest">loading</span></div>
          <div class="metric"><span>Mutation</span><span id="body-evidence-timeline-mutation">false</span></div>
          <pre id="body-evidence-timeline-json">Loading body evidence timeline...</pre>
        </section>
        <section class="panel" id="body-evidence-timeline-readiness-panel">
          <h2>Evidence Timeline Readiness</h2>
          <div class="metric"><span>Ready</span><span id="body-evidence-timeline-readiness-ready">false</span></div>
          <div class="metric"><span>Checks</span><span id="body-evidence-timeline-readiness-checks">0/0</span></div>
          <div class="metric"><span>Latest</span><span id="body-evidence-timeline-readiness-latest">loading</span></div>
          <div class="metric"><span>Mutation</span><span id="body-evidence-timeline-readiness-mutation">false</span></div>
          <pre id="body-evidence-timeline-readiness-json">Loading body evidence timeline readiness...</pre>
        </section>
        <section class="panel" id="body-evidence-ledger-plan-panel">
          <h2>Body Evidence Ledger Plan</h2>
          <div class="metric"><span>Plan Ready</span><span id="body-evidence-ledger-plan-ready">false</span></div>
          <div class="metric"><span>Schema</span><span id="body-evidence-ledger-plan-schema">loading</span></div>
          <div class="metric"><span>Write Gates</span><span id="body-evidence-ledger-plan-gates">0</span></div>
          <div class="metric"><span>Storage Written</span><span id="body-evidence-ledger-plan-written">false</span></div>
          <pre id="body-evidence-ledger-plan-json">Loading body evidence ledger plan...</pre>
        </section>
        <section class="panel" id="body-evidence-ledger-route-review-panel">
          <h2>Body Evidence Ledger Route Review</h2>
          <div class="metric"><span>Status</span><span id="body-evidence-ledger-route-review-status">loading</span></div>
          <div class="metric"><span>Next Slice</span><span id="body-evidence-ledger-route-review-next">loading</span></div>
          <div class="metric"><span>Can Write</span><span id="body-evidence-ledger-route-review-write">false</span></div>
          <div class="metric"><span>Mutation</span><span id="body-evidence-ledger-route-review-mutation">false</span></div>
          <pre id="body-evidence-ledger-route-review-json">Loading body evidence ledger route review...</pre>
        </section>
        <section class="panel" id="body-evidence-ledger-storage-root-plan-panel">
          <h2>Body Evidence Ledger Storage Root Plan</h2>
          <div class="metric"><span>Plan Ready</span><span id="body-evidence-ledger-storage-root-plan-ready">false</span></div>
          <div class="metric"><span>Selected Root</span><span id="body-evidence-ledger-storage-root-plan-root">loading</span></div>
          <div class="metric"><span>Directory Created</span><span id="body-evidence-ledger-storage-root-plan-created">false</span></div>
          <div class="metric"><span>Storage Written</span><span id="body-evidence-ledger-storage-root-plan-written">false</span></div>
          <pre id="body-evidence-ledger-storage-root-plan-json">Loading body evidence ledger storage root plan...</pre>
        </section>
        <section class="panel" id="body-evidence-ledger-storage-root-route-review-panel">
          <h2>Body Evidence Ledger Storage Root Route Review</h2>
          <div class="metric"><span>Status</span><span id="body-evidence-ledger-storage-root-route-review-status">loading</span></div>
          <div class="metric"><span>Next Slice</span><span id="body-evidence-ledger-storage-root-route-review-next">loading</span></div>
          <div class="metric"><span>Create Dir</span><span id="body-evidence-ledger-storage-root-route-review-create">false</span></div>
          <div class="metric"><span>Storage Written</span><span id="body-evidence-ledger-storage-root-route-review-written">false</span></div>
          <pre id="body-evidence-ledger-storage-root-route-review-json">Loading body evidence ledger storage root route review...</pre>
        </section>
        <section class="panel" id="body-evidence-ledger-directory-task-panel">
          <h2>Body Evidence Ledger Directory Task</h2>
          <div class="metric"><span>Ready</span><span id="body-evidence-ledger-directory-task-ready">false</span></div>
          <div class="metric"><span>Target</span><span id="body-evidence-ledger-directory-task-target">loading</span></div>
          <div class="metric"><span>Approval</span><span id="body-evidence-ledger-directory-task-approval">pending-after-create</span></div>
          <div class="metric"><span>Directory Created</span><span id="body-evidence-ledger-directory-task-created">false</span></div>
          <div class="actions tight">
            <button id="create-body-evidence-ledger-directory-task-button" class="secondary">Create Ledger Directory Task</button>
          </div>
          <pre id="body-evidence-ledger-directory-task-json">Loading approval-gated ledger directory task boundary...</pre>
        </section>
        <section class="panel" id="body-evidence-ledger-first-record-plan-panel">
          <h2>Body Evidence Ledger First Record Plan</h2>
          <div class="metric"><span>Plan Ready</span><span id="body-evidence-ledger-first-record-plan-ready">false</span></div>
          <div class="metric"><span>Record Type</span><span id="body-evidence-ledger-first-record-plan-type">loading</span></div>
          <div class="metric"><span>Directory Exists</span><span id="body-evidence-ledger-first-record-plan-directory">false</span></div>
          <div class="metric"><span>Storage Written</span><span id="body-evidence-ledger-first-record-plan-written">false</span></div>
          <pre id="body-evidence-ledger-first-record-plan-json">Loading body evidence ledger first record plan...</pre>
        </section>
        <section class="panel" id="body-evidence-ledger-first-record-route-review-panel">
          <h2>Body Evidence Ledger First Record Route Review</h2>
          <div class="metric"><span>Status</span><span id="body-evidence-ledger-first-record-route-review-status">loading</span></div>
          <div class="metric"><span>Next Slice</span><span id="body-evidence-ledger-first-record-route-review-next">loading</span></div>
          <div class="metric"><span>Can Append</span><span id="body-evidence-ledger-first-record-route-review-write">false</span></div>
          <div class="metric"><span>Storage Written</span><span id="body-evidence-ledger-first-record-route-review-written">false</span></div>
          <pre id="body-evidence-ledger-first-record-route-review-json">Loading body evidence ledger first record route review...</pre>
        </section>
        <section class="panel" id="body-evidence-ledger-first-record-task-panel">
          <h2>Body Evidence Ledger First Record Task</h2>
          <div class="metric"><span>Ready</span><span id="body-evidence-ledger-first-record-task-ready">false</span></div>
          <div class="metric"><span>Record Type</span><span id="body-evidence-ledger-first-record-task-type">loading</span></div>
          <div class="metric"><span>Approval</span><span id="body-evidence-ledger-first-record-task-approval">pending-after-create</span></div>
          <div class="metric"><span>Record Appended</span><span id="body-evidence-ledger-first-record-task-appended">false</span></div>
          <div class="actions tight">
            <button id="create-body-evidence-ledger-first-record-task-button" class="secondary">Create First Record Task</button>
          </div>
          <pre id="body-evidence-ledger-first-record-task-json">Loading approval-gated first record task boundary...</pre>
        </section>
        <section class="panel" id="body-evidence-ledger-readiness-panel">
          <h2>Body Evidence Ledger Readiness</h2>
          <div class="metric"><span>Ready</span><span id="body-evidence-ledger-readiness-ready">false</span></div>
          <div class="metric"><span>Checks</span><span id="body-evidence-ledger-readiness-checks">0/0</span></div>
          <div class="metric"><span>Records</span><span id="body-evidence-ledger-readiness-records">0</span></div>
          <div class="metric"><span>Mutation</span><span id="body-evidence-ledger-readiness-mutation">false</span></div>
          <pre id="body-evidence-ledger-readiness-json">Loading body evidence ledger readiness...</pre>
        </section>
        <section class="panel" id="body-evidence-ledger-demo-status-panel">
          <h2>Body Evidence Ledger Demo Status</h2>
          <div class="metric"><span>Demo Ready</span><span id="body-evidence-ledger-demo-status-ready">false</span></div>
          <div class="metric"><span>Checklist</span><span id="body-evidence-ledger-demo-status-checks">0/0</span></div>
          <div class="metric"><span>Record</span><span id="body-evidence-ledger-demo-status-record">loading</span></div>
          <div class="metric"><span>Mutation</span><span id="body-evidence-ledger-demo-status-mutation">false</span></div>
          <pre id="body-evidence-ledger-demo-status-json">Loading body evidence ledger demo status...</pre>
        </section>
        <section class="panel" id="body-evidence-ledger-followup-record-plan-panel">
          <h2>Body Evidence Ledger Follow-up Record Plan</h2>
          <div class="metric"><span>Plan Ready</span><span id="body-evidence-ledger-followup-record-plan-ready">false</span></div>
          <div class="metric"><span>Record Type</span><span id="body-evidence-ledger-followup-record-plan-type">loading</span></div>
          <div class="metric"><span>Existing Records</span><span id="body-evidence-ledger-followup-record-plan-records">0</span></div>
          <div class="metric"><span>Storage Written</span><span id="body-evidence-ledger-followup-record-plan-written">false</span></div>
          <pre id="body-evidence-ledger-followup-record-plan-json">Loading body evidence ledger follow-up record plan...</pre>
        </section>
        <section class="panel" id="body-evidence-ledger-followup-record-route-review-panel">
          <h2>Body Evidence Ledger Follow-up Record Route Review</h2>
          <div class="metric"><span>Status</span><span id="body-evidence-ledger-followup-record-route-review-status">loading</span></div>
          <div class="metric"><span>Next Slice</span><span id="body-evidence-ledger-followup-record-route-review-next">loading</span></div>
          <div class="metric"><span>Can Append</span><span id="body-evidence-ledger-followup-record-route-review-write">false</span></div>
          <div class="metric"><span>Storage Written</span><span id="body-evidence-ledger-followup-record-route-review-written">false</span></div>
          <pre id="body-evidence-ledger-followup-record-route-review-json">Loading body evidence ledger follow-up record route review...</pre>
        </section>
        <section class="panel" id="body-evidence-ledger-followup-record-task-panel">
          <h2>Body Evidence Ledger Follow-up Record Task</h2>
          <div class="metric"><span>Ready</span><span id="body-evidence-ledger-followup-record-task-ready">false</span></div>
          <div class="metric"><span>Record Type</span><span id="body-evidence-ledger-followup-record-task-type">loading</span></div>
          <div class="metric"><span>Approval</span><span id="body-evidence-ledger-followup-record-task-approval">pending-after-create</span></div>
          <div class="metric"><span>Record Appended</span><span id="body-evidence-ledger-followup-record-task-appended">false</span></div>
          <div class="actions tight">
            <button id="create-body-evidence-ledger-followup-record-task-button" class="secondary">Create Follow-up Record Task</button>
          </div>
          <pre id="body-evidence-ledger-followup-record-task-json">Loading approval-gated follow-up record task boundary...</pre>
        </section>
        <section class="panel" id="body-evidence-ledger-followup-record-readiness-panel">
          <h2>Body Evidence Ledger Follow-up Record Readiness</h2>
          <div class="metric"><span>Ready</span><span id="body-evidence-ledger-followup-record-readiness-ready">false</span></div>
          <div class="metric"><span>Checks</span><span id="body-evidence-ledger-followup-record-readiness-checks">0/0</span></div>
          <div class="metric"><span>Ledger Records</span><span id="body-evidence-ledger-followup-record-readiness-records">0</span></div>
          <div class="metric"><span>Mutation</span><span id="body-evidence-ledger-followup-record-readiness-mutation">false</span></div>
          <pre id="body-evidence-ledger-followup-record-readiness-json">Loading follow-up record readiness bundle...</pre>
        </section>
        <section class="panel" id="body-evidence-ledger-followup-record-append-route-review-panel">
          <h2>Body Evidence Ledger Follow-up Append Route Review</h2>
          <div class="metric"><span>Status</span><span id="body-evidence-ledger-followup-record-append-route-review-status">loading</span></div>
          <div class="metric"><span>Next Slice</span><span id="body-evidence-ledger-followup-record-append-route-review-next">loading</span></div>
          <div class="metric"><span>Approves Task</span><span id="body-evidence-ledger-followup-record-append-route-review-approves">false</span></div>
          <div class="metric"><span>Record Appended</span><span id="body-evidence-ledger-followup-record-append-route-review-appended">false</span></div>
          <pre id="body-evidence-ledger-followup-record-append-route-review-json">Loading follow-up append route review...</pre>
        </section>
        <section class="panel" id="body-evidence-ledger-followup-record-append-readiness-panel">
          <h2>Body Evidence Ledger Follow-up Append Readiness</h2>
          <div class="metric"><span>Ready</span><span id="body-evidence-ledger-followup-record-append-readiness-ready">false</span></div>
          <div class="metric"><span>Checks</span><span id="body-evidence-ledger-followup-record-append-readiness-checks">0/0</span></div>
          <div class="metric"><span>Ledger Records</span><span id="body-evidence-ledger-followup-record-append-readiness-records">0</span></div>
          <div class="metric"><span>Mutation</span><span id="body-evidence-ledger-followup-record-append-readiness-mutation">false</span></div>
          <pre id="body-evidence-ledger-followup-record-append-readiness-json">Loading follow-up append readiness bundle...</pre>
        </section>
        <section class="panel" id="phase-2-route-review">
          <h2>Phase 2 Route Review</h2>
          <div class="metric"><span>Selected Track</span><span id="phase-2-route-selected-track">loading</span></div>
          <div class="metric"><span>Next Slice</span><span id="phase-2-route-next-slice">loading</span></div>
          <div class="metric"><span>Creates Task</span><span id="phase-2-route-creates-task">false</span></div>
          <div class="metric"><span>Mutation</span><span id="phase-2-route-mutation">false</span></div>
          <pre id="phase-2-route-json">Loading whitepaper-aligned Phase 2 route review...</pre>
        </section>
        <section class="panel" id="systemd-repair-candidates-panel">
          <h2>Repair Candidates</h2>
          <div class="metric"><span>Candidates</span><span id="systemd-repair-candidate-count">0</span></div>
          <div class="metric"><span>Recommended</span><span id="systemd-repair-candidate-recommended">loading</span></div>
          <div class="metric"><span>Creates Task</span><span id="systemd-repair-candidate-creates-task">false</span></div>
          <div class="metric"><span>Mutation</span><span id="systemd-repair-candidate-mutation">false</span></div>
          <pre id="systemd-repair-candidate-json">Loading read-only systemd repair candidate assessment...</pre>
        </section>
        <section class="panel" id="systemd-repair-candidate-plan-panel">
          <h2>Repair Candidate Plan</h2>
          <div class="metric"><span>Target</span><span id="systemd-repair-candidate-plan-target">loading</span></div>
          <div class="metric"><span>Mode</span><span id="systemd-repair-candidate-plan-mode">plan_only</span></div>
          <div class="metric"><span>Creates Task</span><span id="systemd-repair-candidate-plan-creates-task">false</span></div>
          <div class="metric"><span>Mutation</span><span id="systemd-repair-candidate-plan-mutation">false</span></div>
          <pre id="systemd-repair-candidate-plan-json">Loading plan-only systemd repair candidate scope...</pre>
        </section>
        <section class="panel" id="systemd-repair-candidate-task-route-panel">
          <h2>Repair Candidate Route</h2>
          <div class="metric"><span>Status</span><span id="systemd-repair-candidate-route-status">loading</span></div>
          <div class="metric"><span>Target</span><span id="systemd-repair-candidate-route-target">loading</span></div>
          <div class="metric"><span>Creates Task</span><span id="systemd-repair-candidate-route-creates-task">false</span></div>
          <div class="metric"><span>Mutation</span><span id="systemd-repair-candidate-route-mutation">false</span></div>
          <pre id="systemd-repair-candidate-route-json">Loading read-only repair candidate task route gate...</pre>
        </section>
        <section class="panel" id="systemd-repair-candidate-task-shell-panel">
          <h2>Repair Candidate Task Shell</h2>
          <div class="metric"><span>Ready</span><span id="systemd-repair-candidate-task-shell-ready">loading</span></div>
          <div class="metric"><span>Target</span><span id="systemd-repair-candidate-task-shell-target">loading</span></div>
          <div class="metric"><span>Approval</span><span id="systemd-repair-candidate-task-shell-approval">pending-after-create</span></div>
          <div class="metric"><span>Mutation</span><span id="systemd-repair-candidate-task-shell-mutation">false</span></div>
          <div class="actions tight">
            <button id="create-systemd-repair-candidate-task-shell-button" class="secondary">Create Candidate Task Shell</button>
          </div>
          <pre id="systemd-repair-candidate-task-shell-json">Loading approval-gated repair candidate task shell boundary...</pre>
        </section>
        <section class="panel" id="systemd-repair-candidate-readiness-panel">
          <h2>Repair Candidate Readiness</h2>
          <div class="metric"><span>Ready</span><span id="systemd-repair-candidate-readiness-ready">false</span></div>
          <div class="metric"><span>Checks</span><span id="systemd-repair-candidate-readiness-checks">0/0</span></div>
          <div class="metric"><span>Next</span><span id="systemd-repair-candidate-readiness-next">loading</span></div>
          <div class="metric"><span>Mutation</span><span id="systemd-repair-candidate-readiness-mutation">false</span></div>
          <pre id="systemd-repair-candidate-readiness-json">Loading repair candidate block readiness...</pre>
        </section>
        <section class="panel" id="systemd-repair-candidate-route-review-panel">
          <h2>Repair Candidate Route Review</h2>
          <div class="metric"><span>Selected Track</span><span id="systemd-repair-candidate-route-review-track">loading</span></div>
          <div class="metric"><span>Next Slice</span><span id="systemd-repair-candidate-route-review-slice">loading</span></div>
          <div class="metric"><span>Creates Task</span><span id="systemd-repair-candidate-route-review-creates-task">false</span></div>
          <div class="metric"><span>Mutation</span><span id="systemd-repair-candidate-route-review-mutation">false</span></div>
          <pre id="systemd-repair-candidate-route-review-json">Loading repair candidate route review...</pre>
        </section>
        <section class="panel" id="systemd-repair-candidate-demo-status-panel">
          <h2>Repair Candidate Demo Status</h2>
          <div class="metric"><span>Demo Ready</span><span id="systemd-repair-candidate-demo-status-ready">false</span></div>
          <div class="metric"><span>Checks</span><span id="systemd-repair-candidate-demo-status-checks">0/0</span></div>
          <div class="metric"><span>Target</span><span id="systemd-repair-candidate-demo-status-target">loading</span></div>
          <div class="metric"><span>Mutation</span><span id="systemd-repair-candidate-demo-status-mutation">false</span></div>
          <pre id="systemd-repair-candidate-demo-status-json">Loading repair candidate demo status...</pre>
        </section>
        <section class="panel" id="systemd-next-repair-scope-review-panel">
          <h2>Next Repair Scope Review</h2>
          <div class="metric"><span>Ready</span><span id="systemd-next-repair-scope-review-ready">false</span></div>
          <div class="metric"><span>Selected Unit</span><span id="systemd-next-repair-scope-review-unit">loading</span></div>
          <div class="metric"><span>Candidates</span><span id="systemd-next-repair-scope-review-candidates">0</span></div>
          <div class="metric"><span>Mutation</span><span id="systemd-next-repair-scope-review-mutation">false</span></div>
          <pre id="systemd-next-repair-scope-review-json">Loading read-only next repair scope review...</pre>
        </section>
        <section class="panel" id="systemd-next-repair-plan-panel">
          <h2>Next Repair Plan</h2>
          <div class="metric"><span>Target</span><span id="systemd-next-repair-plan-target">loading</span></div>
          <div class="metric"><span>Mode</span><span id="systemd-next-repair-plan-mode">plan_only</span></div>
          <div class="metric"><span>Creates Task</span><span id="systemd-next-repair-plan-creates-task">false</span></div>
          <div class="metric"><span>Mutation</span><span id="systemd-next-repair-plan-mutation">false</span></div>
          <pre id="systemd-next-repair-plan-json">Loading plan-only next repair scope...</pre>
        </section>
        <section class="panel" id="systemd-next-repair-route-review-panel">
          <h2>Next Repair Route Review</h2>
          <div class="metric"><span>Selected Track</span><span id="systemd-next-repair-route-review-track">loading</span></div>
          <div class="metric"><span>Next Slice</span><span id="systemd-next-repair-route-review-slice">loading</span></div>
          <div class="metric"><span>Creates Task</span><span id="systemd-next-repair-route-review-creates-task">false</span></div>
          <div class="metric"><span>Mutation</span><span id="systemd-next-repair-route-review-mutation">false</span></div>
          <pre id="systemd-next-repair-route-review-json">Loading read-only next repair route review...</pre>
        </section>
        <section class="panel" id="systemd-next-repair-dry-run-panel">
          <h2>Next Repair Dry Run</h2>
          <div class="metric"><span>Target</span><span id="systemd-next-repair-dry-run-target">loading</span></div>
          <div class="metric"><span>Mode</span><span id="systemd-next-repair-dry-run-mode">loading</span></div>
          <div class="metric"><span>Would Execute</span><span id="systemd-next-repair-dry-run-would-execute">false</span></div>
          <div class="metric"><span>Mutation</span><span id="systemd-next-repair-dry-run-mutation">false</span></div>
          <pre id="systemd-next-repair-dry-run-json">Loading operator-visible next repair dry-run envelope...</pre>
        </section>
        <section class="panel" id="systemd-next-repair-task-route-panel">
          <h2>Next Repair Task Route</h2>
          <div class="metric"><span>Status</span><span id="systemd-next-repair-task-route-status">loading</span></div>
          <div class="metric"><span>Next Slice</span><span id="systemd-next-repair-task-route-slice">loading</span></div>
          <div class="metric"><span>Creates Task</span><span id="systemd-next-repair-task-route-creates-task">false</span></div>
          <div class="metric"><span>Mutation</span><span id="systemd-next-repair-task-route-mutation">false</span></div>
          <pre id="systemd-next-repair-task-route-json">Loading read-only next repair task route...</pre>
        </section>
        <section class="panel" id="systemd-next-repair-task-shell-panel">
          <h2>Next Repair Task Shell</h2>
          <div class="metric"><span>Ready</span><span id="systemd-next-repair-task-shell-ready">loading</span></div>
          <div class="metric"><span>Target</span><span id="systemd-next-repair-task-shell-target">openclaw-system-sense.service</span></div>
          <div class="metric"><span>Approval</span><span id="systemd-next-repair-task-shell-approval">pending-after-create</span></div>
          <div class="metric"><span>Mutation</span><span id="systemd-next-repair-task-shell-mutation">false</span></div>
          <div class="actions tight">
            <button id="create-systemd-next-repair-task-shell-button" class="secondary">Create Next Repair Task Shell</button>
            <button id="create-systemd-next-repair-real-execution-button" class="secondary">Create Next Repair Real Execution Task</button>
          </div>
          <pre id="systemd-next-repair-task-shell-json">Loading approval-gated next repair task shell route...</pre>
        </section>
        <section class="panel" id="systemd-unit-inventory">
          <h2>Systemd Unit Inventory</h2>
          <div class="metric"><span>Total Units</span><span id="systemd-unit-total">0</span></div>
          <div class="metric"><span>Active</span><span id="systemd-unit-active">0</span></div>
          <div class="metric"><span>Observed</span><span id="systemd-unit-observed">0</span></div>
          <div class="metric"><span>Mode</span><span id="systemd-unit-mode">read_only</span></div>
          <pre id="systemd-unit-json">Loading read-only OpenClaw systemd unit inventory...</pre>
        </section>
        <section class="panel" id="systemd-dependency-map">
          <h2>Body Dependency Map</h2>
          <div class="metric"><span>Nodes</span><span id="systemd-dependency-node-count">0</span></div>
          <div class="metric"><span>Edges</span><span id="systemd-dependency-edge-count">0</span></div>
          <div class="metric"><span>Roots</span><span id="systemd-dependency-root-count">0</span></div>
          <div class="metric"><span>High Impact</span><span id="systemd-dependency-high-impact">0</span></div>
          <pre id="systemd-dependency-json">Loading read-only OpenClaw body dependency map...</pre>
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
        <section class="panel" id="systemd-repair-execution-task-panel">
          <h2>Systemd Repair Execution Task</h2>
          <div class="metric"><span>Registry</span><span id="systemd-repair-execution-task-registry">openclaw-systemd-repair-execution-task-v0</span></div>
          <div class="metric"><span>Target</span><span id="systemd-repair-execution-task-target">openclaw-browser-runtime.service</span></div>
          <div class="metric"><span>Approval</span><span id="systemd-repair-execution-task-approval">required</span></div>
          <div class="metric"><span>Executed</span><span id="systemd-repair-execution-task-executed">false</span></div>
          <div class="actions tight">
            <button id="create-systemd-repair-execution-task-button" class="secondary">Create Repair Execution Task</button>
            <button id="create-systemd-repair-real-execution-task-button" class="secondary">Create Real Repair Execution Task</button>
          </div>
          <pre id="systemd-repair-execution-task-json">Loading operator-reviewed systemd repair execution task draft...</pre>
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
  sessionManagerUrl: \`\${observerBase}:4100/proxy/session-manager\`,
  screenSenseUrl: \`\${observerBase}:4100/proxy/screen-sense\`,
  screenActUrl: \`\${observerBase}:4100/proxy/screen-act\`,
  systemSenseUrl: \`\${observerBase}:4100/proxy/system-sense\`,
  systemHealUrl: \`\${observerBase}:4100/proxy/system-heal\`,
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
const phase2RepairDemoStatus = document.querySelector("#phase2-repair-demo-status");
const phase2RepairDemoEvidence = document.querySelector("#phase2-repair-demo-evidence");
const phase2RepairDemoTarget = document.querySelector("#phase2-repair-demo-target");
const phase2RepairDemoNext = document.querySelector("#phase2-repair-demo-next");
const phase2RepairDemoJson = document.querySelector("#phase2-repair-demo-json");
const phase2NextRepairDemoStatus = document.querySelector("#phase2-next-repair-demo-status");
const phase2NextRepairDemoEvidence = document.querySelector("#phase2-next-repair-demo-evidence");
const phase2NextRepairDemoTarget = document.querySelector("#phase2-next-repair-demo-target");
const phase2NextRepairDemoMutation = document.querySelector("#phase2-next-repair-demo-mutation");
const phase2NextRepairDemoJson = document.querySelector("#phase2-next-repair-demo-json");
const phase2DemoControlRoomStatus = document.querySelector("#phase2-demo-control-room-status");
const phase2DemoControlRoomPanels = document.querySelector("#phase2-demo-control-room-panels");
const phase2DemoControlRoomSlice = document.querySelector("#phase2-demo-control-room-slice");
const phase2DemoControlRoomMutation = document.querySelector("#phase2-demo-control-room-mutation");
const phase2DemoControlRoomJson = document.querySelector("#phase2-demo-control-room-json");
const phase2DemoWalkthroughStatus = document.querySelector("#phase2-demo-walkthrough-status");
const phase2DemoWalkthroughSteps = document.querySelector("#phase2-demo-walkthrough-steps");
const phase2DemoWalkthroughControlRoom = document.querySelector("#phase2-demo-walkthrough-control-room");
const phase2DemoWalkthroughMutation = document.querySelector("#phase2-demo-walkthrough-mutation");
const phase2DemoWalkthroughJson = document.querySelector("#phase2-demo-walkthrough-json");
const phase2DemoReadinessExitStatus = document.querySelector("#phase2-demo-readiness-exit-status");
const phase2DemoReadinessExitChecks = document.querySelector("#phase2-demo-readiness-exit-checks");
const phase2DemoReadinessExitSafe = document.querySelector("#phase2-demo-readiness-exit-safe");
const phase2DemoReadinessExitMutation = document.querySelector("#phase2-demo-readiness-exit-mutation");
const phase2DemoReadinessExitJson = document.querySelector("#phase2-demo-readiness-exit-json");
const phase2NextCapabilityTrack = document.querySelector("#phase2-next-capability-track");
const phase2NextCapabilitySlice = document.querySelector("#phase2-next-capability-slice");
const phase2NextCapabilityCreatesTask = document.querySelector("#phase2-next-capability-creates-task");
const phase2NextCapabilityMutation = document.querySelector("#phase2-next-capability-mutation");
const phase2NextCapabilityJson = document.querySelector("#phase2-next-capability-json");
const phase2CompletionReadinessReady = document.querySelector("#phase2-completion-readiness-ready");
const phase2CompletionReadinessChecks = document.querySelector("#phase2-completion-readiness-checks");
const phase2CompletionReadinessPercent = document.querySelector("#phase2-completion-readiness-percent");
const phase2CompletionReadinessMutation = document.querySelector("#phase2-completion-readiness-mutation");
const phase2CompletionReadinessJson = document.querySelector("#phase2-completion-readiness-json");
const phase2ExitComplete = document.querySelector("#phase2-exit-complete");
const phase2ExitPercent = document.querySelector("#phase2-exit-percent");
const phase2ExitNext = document.querySelector("#phase2-exit-next");
const phase2ExitMutation = document.querySelector("#phase2-exit-mutation");
const phase2ExitJson = document.querySelector("#phase2-exit-json");
const phase3PlanReady = document.querySelector("#phase3-plan-ready");
const phase3PlanNext = document.querySelector("#phase3-plan-next");
const phase3PlanForeground = document.querySelector("#phase3-plan-foreground");
const phase3PlanJson = document.querySelector("#phase3-plan-json");
const phase3BackgroundReady = document.querySelector("#phase3-background-ready");
const phase3BackgroundVisibility = document.querySelector("#phase3-background-visibility");
const phase3BackgroundMode = document.querySelector("#phase3-background-mode");
const phase3BackgroundJson = document.querySelector("#phase3-background-json");
const phase3ControlsReady = document.querySelector("#phase3-controls-ready");
const phase3ControlsTakeover = document.querySelector("#phase3-controls-takeover");
const phase3ControlsHiddenAutomation = document.querySelector("#phase3-controls-hidden-automation");
const phase3ControlsJson = document.querySelector("#phase3-controls-json");
const phase3ReadinessReady = document.querySelector("#phase3-readiness-ready");
const phase3ReadinessChecks = document.querySelector("#phase3-readiness-checks");
const phase3ReadinessPercent = document.querySelector("#phase3-readiness-percent");
const phase3ReadinessJson = document.querySelector("#phase3-readiness-json");
const phase3ExitComplete = document.querySelector("#phase3-exit-complete");
const phase3ExitPercent = document.querySelector("#phase3-exit-percent");
const phase3ExitNext = document.querySelector("#phase3-exit-next");
const phase3ExitJson = document.querySelector("#phase3-exit-json");
const phase4PlanReady = document.querySelector("#phase4-plan-ready");
const phase4PlanNext = document.querySelector("#phase4-plan-next");
const phase4PlanRealRepair = document.querySelector("#phase4-plan-real-repair");
const phase4PlanJson = document.querySelector("#phase4-plan-json");
const phase4SelfHealReady = document.querySelector("#phase4-self-heal-ready");
const phase4SelfHealExecuted = document.querySelector("#phase4-self-heal-executed");
const phase4SelfHealSkipped = document.querySelector("#phase4-self-heal-skipped");
const phase4SelfHealJson = document.querySelector("#phase4-self-heal-json");
const phase4HistoryReady = document.querySelector("#phase4-history-ready");
const phase4HistoryHealCount = document.querySelector("#phase4-history-heal-count");
const phase4HistoryMaintenanceCount = document.querySelector("#phase4-history-maintenance-count");
const phase4HistoryJson = document.querySelector("#phase4-history-json");
const phase4ReadinessReady = document.querySelector("#phase4-readiness-ready");
const phase4ReadinessChecks = document.querySelector("#phase4-readiness-checks");
const phase4ReadinessPercent = document.querySelector("#phase4-readiness-percent");
const phase4ReadinessJson = document.querySelector("#phase4-readiness-json");
const phase4ExitComplete = document.querySelector("#phase4-exit-complete");
const phase4ExitPercent = document.querySelector("#phase4-exit-percent");
const phase4ExitNext = document.querySelector("#phase4-exit-next");
const phase4ExitJson = document.querySelector("#phase4-exit-json");
const phase5PlanReady = document.querySelector("#phase5-plan-ready");
const phase5PlanNext = document.querySelector("#phase5-plan-next");
const phase5PlanReleaseAction = document.querySelector("#phase5-plan-release-action");
const phase5PlanJson = document.querySelector("#phase5-plan-json");
const phase5DeploymentReady = document.querySelector("#phase5-deployment-ready");
const phase5DeploymentServices = document.querySelector("#phase5-deployment-services");
const phase5DeploymentModules = document.querySelector("#phase5-deployment-modules");
const phase5DeploymentJson = document.querySelector("#phase5-deployment-json");
const phase5RollbackReady = document.querySelector("#phase5-rollback-ready");
const phase5RollbackSurfaces = document.querySelector("#phase5-rollback-surfaces");
const phase5RollbackExecuted = document.querySelector("#phase5-rollback-executed");
const phase5RollbackJson = document.querySelector("#phase5-rollback-json");
const phase5ReleaseReady = document.querySelector("#phase5-release-ready");
const phase5ReleasePercent = document.querySelector("#phase5-release-percent");
const phase5ReleaseMutation = document.querySelector("#phase5-release-mutation");
const phase5ReleaseJson = document.querySelector("#phase5-release-json");
const phase5ExitComplete = document.querySelector("#phase5-exit-complete");
const phase5ExitPercent = document.querySelector("#phase5-exit-percent");
const phase5ExitNext = document.querySelector("#phase5-exit-next");
const phase5ExitJson = document.querySelector("#phase5-exit-json");
const mvpFinalComplete = document.querySelector("#mvp-final-complete");
const mvpFinalCriteria = document.querySelector("#mvp-final-criteria");
const mvpFinalNext = document.querySelector("#mvp-final-next");
const mvpFinalJson = document.querySelector("#mvp-final-json");
const postMvpPlanReady = document.querySelector("#post-mvp-plan-ready");
const postMvpPlanTrunk = document.querySelector("#post-mvp-plan-trunk");
const postMvpPlanNext = document.querySelector("#post-mvp-plan-next");
const postMvpPlanJson = document.querySelector("#post-mvp-plan-json");
const phase6PlanReady = document.querySelector("#phase6-plan-ready");
const phase6PlanNext = document.querySelector("#phase6-plan-next");
const phase6PlanWritesMemory = document.querySelector("#phase6-plan-writes-memory");
const phase6PlanJson = document.querySelector("#phase6-plan-json");
const phase6MemoryReady = document.querySelector("#phase6-memory-ready");
const phase6MemorySources = document.querySelector("#phase6-memory-sources");
const phase6MemoryWritable = document.querySelector("#phase6-memory-writable");
const phase6MemoryJson = document.querySelector("#phase6-memory-json");
const phase6ContextReady = document.querySelector("#phase6-context-ready");
const phase6ContextPointers = document.querySelector("#phase6-context-pointers");
const phase6ContextTransmitted = document.querySelector("#phase6-context-transmitted");
const phase6ContextJson = document.querySelector("#phase6-context-json");
const phase6OrchestrationReady = document.querySelector("#phase6-orchestration-ready");
const phase6OrchestrationRecords = document.querySelector("#phase6-orchestration-records");
const phase6OrchestrationScheduled = document.querySelector("#phase6-orchestration-scheduled");
const phase6OrchestrationJson = document.querySelector("#phase6-orchestration-json");
const phase6RouteReady = document.querySelector("#phase6-route-ready");
const phase6RouteSelected = document.querySelector("#phase6-route-selected");
const phase6RouteWritesMemory = document.querySelector("#phase6-route-writes-memory");
const phase6RouteJson = document.querySelector("#phase6-route-json");
const phase6ExitComplete = document.querySelector("#phase6-exit-complete");
const phase6ExitPercent = document.querySelector("#phase6-exit-percent");
const phase6ExitNext = document.querySelector("#phase6-exit-next");
const phase6ExitJson = document.querySelector("#phase6-exit-json");
const longTermMemoryPlanReady = document.querySelector("#long-term-memory-plan-ready");
const longTermMemoryPlanScope = document.querySelector("#long-term-memory-plan-scope");
const longTermMemoryPlanWrites = document.querySelector("#long-term-memory-plan-writes");
const longTermMemoryPlanJson = document.querySelector("#long-term-memory-plan-json");
const longTermMemorySchemaReady = document.querySelector("#long-term-memory-schema-ready");
const longTermMemorySchemaFields = document.querySelector("#long-term-memory-schema-fields");
const longTermMemorySchemaCloud = document.querySelector("#long-term-memory-schema-cloud");
const longTermMemorySchemaJson = document.querySelector("#long-term-memory-schema-json");
const longTermMemoryProposalReady = document.querySelector("#long-term-memory-proposal-ready");
const longTermMemoryProposalType = document.querySelector("#long-term-memory-proposal-type");
const longTermMemoryProposalBulk = document.querySelector("#long-term-memory-proposal-bulk");
const longTermMemoryProposalJson = document.querySelector("#long-term-memory-proposal-json");
const longTermMemoryRouteReady = document.querySelector("#long-term-memory-route-ready");
const longTermMemoryRouteSelected = document.querySelector("#long-term-memory-route-selected");
const longTermMemoryRouteWrites = document.querySelector("#long-term-memory-route-writes");
const longTermMemoryRouteJson = document.querySelector("#long-term-memory-route-json");
const longTermMemoryTaskReady = document.querySelector("#long-term-memory-task-ready");
const longTermMemoryTaskCreates = document.querySelector("#long-term-memory-task-creates");
const longTermMemoryTaskApproval = document.querySelector("#long-term-memory-task-approval");
const longTermMemoryTaskJson = document.querySelector("#long-term-memory-task-json");
const longTermMemoryApprovedRecords = document.querySelector("#long-term-memory-approved-records");
const longTermMemoryApprovedLatest = document.querySelector("#long-term-memory-approved-latest");
const longTermMemoryApprovedCloud = document.querySelector("#long-term-memory-approved-cloud");
const longTermMemoryApprovedJson = document.querySelector("#long-term-memory-approved-json");
const longTermMemoryReadbackReady = document.querySelector("#long-term-memory-readback-ready");
const longTermMemoryReadbackRecords = document.querySelector("#long-term-memory-readback-records");
const longTermMemoryReadbackHash = document.querySelector("#long-term-memory-readback-hash");
const longTermMemoryReadbackJson = document.querySelector("#long-term-memory-readback-json");
const longTermMemoryExitComplete = document.querySelector("#long-term-memory-exit-complete");
const longTermMemoryExitPercent = document.querySelector("#long-term-memory-exit-percent");
const longTermMemoryExitNext = document.querySelector("#long-term-memory-exit-next");
const longTermMemoryExitJson = document.querySelector("#long-term-memory-exit-json");
const cloudContextReviewReady = document.querySelector("#cloud-context-review-ready");
const cloudContextReviewCall = document.querySelector("#cloud-context-review-call");
const cloudContextReviewNext = document.querySelector("#cloud-context-review-next");
const cloudContextReviewJson = document.querySelector("#cloud-context-review-json");
const cloudEnvelopeSchemaReady = document.querySelector("#cloud-envelope-schema-ready");
const cloudEnvelopeSchemaFields = document.querySelector("#cloud-envelope-schema-fields");
const cloudEnvelopeSchemaTransmission = document.querySelector("#cloud-envelope-schema-transmission");
const cloudEnvelopeSchemaJson = document.querySelector("#cloud-envelope-schema-json");
const cloudContextPackageReady = document.querySelector("#cloud-context-package-ready");
const cloudContextPackageMemory = document.querySelector("#cloud-context-package-memory");
const cloudContextPackageSecrets = document.querySelector("#cloud-context-package-secrets");
const cloudContextPackageJson = document.querySelector("#cloud-context-package-json");
const cloudRedactionReady = document.querySelector("#cloud-redaction-ready");
const cloudRedactionRejected = document.querySelector("#cloud-redaction-rejected");
const cloudRedactionSecrets = document.querySelector("#cloud-redaction-secrets");
const cloudRedactionJson = document.querySelector("#cloud-redaction-json");
const cloudRouteReady = document.querySelector("#cloud-route-ready");
const cloudRouteSelected = document.querySelector("#cloud-route-selected");
const cloudRouteCall = document.querySelector("#cloud-route-call");
const cloudRouteJson = document.querySelector("#cloud-route-json");
const cloudHandoffTaskReady = document.querySelector("#cloud-handoff-task-ready");
const cloudHandoffTaskCreates = document.querySelector("#cloud-handoff-task-creates");
const cloudHandoffTaskApproval = document.querySelector("#cloud-handoff-task-approval");
const cloudHandoffTaskJson = document.querySelector("#cloud-handoff-task-json");
const cloudApprovedHandoffRecords = document.querySelector("#cloud-approved-handoff-records");
const cloudApprovedHandoffLatest = document.querySelector("#cloud-approved-handoff-latest");
const cloudApprovedHandoffTransmitted = document.querySelector("#cloud-approved-handoff-transmitted");
const cloudApprovedHandoffJson = document.querySelector("#cloud-approved-handoff-json");
const cloudHandoffReadbackReady = document.querySelector("#cloud-handoff-readback-ready");
const cloudHandoffReadbackRecords = document.querySelector("#cloud-handoff-readback-records");
const cloudHandoffReadbackHash = document.querySelector("#cloud-handoff-readback-hash");
const cloudHandoffReadbackJson = document.querySelector("#cloud-handoff-readback-json");
const cloudExitComplete = document.querySelector("#cloud-exit-complete");
const cloudExitPercent = document.querySelector("#cloud-exit-percent");
const cloudExitNext = document.querySelector("#cloud-exit-next");
const cloudExitJson = document.querySelector("#cloud-exit-json");
const cloudProviderPlanReady = document.querySelector("#cloud-provider-plan-ready");
const cloudProviderPlanCall = document.querySelector("#cloud-provider-plan-call");
const cloudProviderPlanNext = document.querySelector("#cloud-provider-plan-next");
const cloudProviderPlanJson = document.querySelector("#cloud-provider-plan-json");
const cloudProviderContractReady = document.querySelector("#cloud-provider-contract-ready");
const cloudProviderContractMethods = document.querySelector("#cloud-provider-contract-methods");
const cloudProviderContractSdk = document.querySelector("#cloud-provider-contract-sdk");
const cloudProviderContractJson = document.querySelector("#cloud-provider-contract-json");
const cloudProviderEnvelopeReady = document.querySelector("#cloud-provider-envelope-ready");
const cloudProviderEnvelopeSource = document.querySelector("#cloud-provider-envelope-source");
const cloudProviderEnvelopeSecrets = document.querySelector("#cloud-provider-envelope-secrets");
const cloudProviderEnvelopeJson = document.querySelector("#cloud-provider-envelope-json");
const cloudProviderRouteReady = document.querySelector("#cloud-provider-route-ready");
const cloudProviderRouteSelected = document.querySelector("#cloud-provider-route-selected");
const cloudProviderRouteCall = document.querySelector("#cloud-provider-route-call");
const cloudProviderRouteJson = document.querySelector("#cloud-provider-route-json");
const cloudProviderTaskReady = document.querySelector("#cloud-provider-task-ready");
const cloudProviderTaskCreates = document.querySelector("#cloud-provider-task-creates");
const cloudProviderTaskApproval = document.querySelector("#cloud-provider-task-approval");
const cloudProviderTaskJson = document.querySelector("#cloud-provider-task-json");
const cloudProviderApprovedRecords = document.querySelector("#cloud-provider-approved-records");
const cloudProviderApprovedLatest = document.querySelector("#cloud-provider-approved-latest");
const cloudProviderApprovedTransmitted = document.querySelector("#cloud-provider-approved-transmitted");
const cloudProviderApprovedJson = document.querySelector("#cloud-provider-approved-json");
const cloudProviderReadbackReady = document.querySelector("#cloud-provider-readback-ready");
const cloudProviderReadbackRecords = document.querySelector("#cloud-provider-readback-records");
const cloudProviderReadbackHash = document.querySelector("#cloud-provider-readback-hash");
const cloudProviderReadbackJson = document.querySelector("#cloud-provider-readback-json");
const cloudProviderExitComplete = document.querySelector("#cloud-provider-exit-complete");
const cloudProviderExitPercent = document.querySelector("#cloud-provider-exit-percent");
const cloudProviderExitNext = document.querySelector("#cloud-provider-exit-next");
const cloudProviderExitJson = document.querySelector("#cloud-provider-exit-json");
const cloudRealProviderPlanReady = document.querySelector("#cloud-real-provider-plan-ready");
const cloudRealProviderPlanCall = document.querySelector("#cloud-real-provider-plan-call");
const cloudRealProviderPlanNext = document.querySelector("#cloud-real-provider-plan-next");
const cloudRealProviderPlanJson = document.querySelector("#cloud-real-provider-plan-json");
const cloudEgressContractReady = document.querySelector("#cloud-egress-contract-ready");
const cloudEgressContractPreflights = document.querySelector("#cloud-egress-contract-preflights");
const cloudEgressContractTransmits = document.querySelector("#cloud-egress-contract-transmits");
const cloudEgressContractJson = document.querySelector("#cloud-egress-contract-json");
const cloudCredentialPreflightReady = document.querySelector("#cloud-credential-preflight-ready");
const cloudCredentialPreflightRead = document.querySelector("#cloud-credential-preflight-read");
const cloudCredentialPreflightLive = document.querySelector("#cloud-credential-preflight-live");
const cloudCredentialPreflightJson = document.querySelector("#cloud-credential-preflight-json");
const cloudRequestRedactionReady = document.querySelector("#cloud-request-redaction-ready");
const cloudRequestRedactionRejected = document.querySelector("#cloud-request-redaction-rejected");
const cloudRequestRedactionSecrets = document.querySelector("#cloud-request-redaction-secrets");
const cloudRequestRedactionJson = document.querySelector("#cloud-request-redaction-json");
const cloudRealProviderRouteReady = document.querySelector("#cloud-real-provider-route-ready");
const cloudRealProviderRouteSelected = document.querySelector("#cloud-real-provider-route-selected");
const cloudRealProviderRouteCall = document.querySelector("#cloud-real-provider-route-call");
const cloudRealProviderRouteJson = document.querySelector("#cloud-real-provider-route-json");
const cloudRealProviderTaskReady = document.querySelector("#cloud-real-provider-task-ready");
const cloudRealProviderTaskCreates = document.querySelector("#cloud-real-provider-task-creates");
const cloudRealProviderTaskApproval = document.querySelector("#cloud-real-provider-task-approval");
const cloudRealProviderTaskJson = document.querySelector("#cloud-real-provider-task-json");
const cloudCallRehearsalRecords = document.querySelector("#cloud-call-rehearsal-records");
const cloudCallRehearsalLatest = document.querySelector("#cloud-call-rehearsal-latest");
const cloudCallRehearsalTransmitted = document.querySelector("#cloud-call-rehearsal-transmitted");
const cloudCallRehearsalJson = document.querySelector("#cloud-call-rehearsal-json");
const cloudResponseReadbackReady = document.querySelector("#cloud-response-readback-ready");
const cloudResponseReadbackRecords = document.querySelector("#cloud-response-readback-records");
const cloudResponseReadbackHash = document.querySelector("#cloud-response-readback-hash");
const cloudResponseReadbackJson = document.querySelector("#cloud-response-readback-json");
const cloudRealProviderExitComplete = document.querySelector("#cloud-real-provider-exit-complete");
const cloudRealProviderExitPercent = document.querySelector("#cloud-real-provider-exit-percent");
const cloudRealProviderExitNext = document.querySelector("#cloud-real-provider-exit-next");
const cloudRealProviderExitJson = document.querySelector("#cloud-real-provider-exit-json");
const cloudLiveRunbookReady = document.querySelector("#cloud-live-runbook-ready");
const cloudLiveRunbookEnabled = document.querySelector("#cloud-live-runbook-enabled");
const cloudLiveRunbookNext = document.querySelector("#cloud-live-runbook-next");
const cloudLiveRunbookJson = document.querySelector("#cloud-live-runbook-json");
const cloudLiveChecklistReady = document.querySelector("#cloud-live-checklist-ready");
const cloudLiveChecklistItems = document.querySelector("#cloud-live-checklist-items");
const cloudLiveChecklistTransmits = document.querySelector("#cloud-live-checklist-transmits");
const cloudLiveChecklistJson = document.querySelector("#cloud-live-checklist-json");
const cloudLiveTranscriptReady = document.querySelector("#cloud-live-transcript-ready");
const cloudLiveTranscriptFields = document.querySelector("#cloud-live-transcript-fields");
const cloudLiveTranscriptStatus = document.querySelector("#cloud-live-transcript-status");
const cloudLiveTranscriptJson = document.querySelector("#cloud-live-transcript-json");
const cloudLiveAuthReady = document.querySelector("#cloud-live-auth-ready");
const cloudLiveAuthEnabled = document.querySelector("#cloud-live-auth-enabled");
const cloudLiveAuthCredential = document.querySelector("#cloud-live-auth-credential");
const cloudLiveAuthJson = document.querySelector("#cloud-live-auth-json");
const cloudLiveRouteReady = document.querySelector("#cloud-live-route-ready");
const cloudLiveRouteSelected = document.querySelector("#cloud-live-route-selected");
const cloudLiveRouteCall = document.querySelector("#cloud-live-route-call");
const cloudLiveRouteJson = document.querySelector("#cloud-live-route-json");
const cloudLiveTaskReady = document.querySelector("#cloud-live-task-ready");
const cloudLiveTaskCreates = document.querySelector("#cloud-live-task-creates");
const cloudLiveTaskApproval = document.querySelector("#cloud-live-task-approval");
const cloudLiveTaskJson = document.querySelector("#cloud-live-task-json");
const cloudLiveApprovedRecords = document.querySelector("#cloud-live-approved-records");
const cloudLiveApprovedLatest = document.querySelector("#cloud-live-approved-latest");
const cloudLiveApprovedEnabled = document.querySelector("#cloud-live-approved-enabled");
const cloudLiveApprovedJson = document.querySelector("#cloud-live-approved-json");
const cloudLiveReadbackReady = document.querySelector("#cloud-live-readback-ready");
const cloudLiveReadbackRecords = document.querySelector("#cloud-live-readback-records");
const cloudLiveReadbackHash = document.querySelector("#cloud-live-readback-hash");
const cloudLiveReadbackJson = document.querySelector("#cloud-live-readback-json");
const cloudLiveExitComplete = document.querySelector("#cloud-live-exit-complete");
const cloudLiveExitPercent = document.querySelector("#cloud-live-exit-percent");
const cloudLiveExitNext = document.querySelector("#cloud-live-exit-next");
const cloudLiveExitJson = document.querySelector("#cloud-live-exit-json");
const cloudLiveExecPlanReady = document.querySelector("#cloud-live-exec-plan-ready");
const cloudLiveExecPlanEnabled = document.querySelector("#cloud-live-exec-plan-enabled");
const cloudLiveExecPlanNext = document.querySelector("#cloud-live-exec-plan-next");
const cloudLiveExecPlanJson = document.querySelector("#cloud-live-exec-plan-json");
const cloudLiveExecRouteReady = document.querySelector("#cloud-live-exec-route-ready");
const cloudLiveExecRouteSelected = document.querySelector("#cloud-live-exec-route-selected");
const cloudLiveExecRouteCall = document.querySelector("#cloud-live-exec-route-call");
const cloudLiveExecRouteJson = document.querySelector("#cloud-live-exec-route-json");
const cloudLiveExecReadbackReady = document.querySelector("#cloud-live-exec-readback-ready");
const cloudLiveExecReadbackRecords = document.querySelector("#cloud-live-exec-readback-records");
const cloudLiveExecReadbackHash = document.querySelector("#cloud-live-exec-readback-hash");
const cloudLiveExecReadbackJson = document.querySelector("#cloud-live-exec-readback-json");
const cloudLiveExecExitComplete = document.querySelector("#cloud-live-exec-exit-complete");
const cloudLiveExecExitPercent = document.querySelector("#cloud-live-exec-exit-percent");
const cloudLiveExecExitNext = document.querySelector("#cloud-live-exec-exit-next");
const cloudLiveExecExitJson = document.querySelector("#cloud-live-exec-exit-json");
const cloudLiveRuntimeAdapterPlanReady = document.querySelector("#cloud-live-runtime-adapter-plan-ready");
const cloudLiveRuntimeAdapterPlanPercent = document.querySelector("#cloud-live-runtime-adapter-plan-percent");
const cloudLiveRuntimeAdapterPlanNext = document.querySelector("#cloud-live-runtime-adapter-plan-next");
const cloudLiveRuntimeAdapterPlanJson = document.querySelector("#cloud-live-runtime-adapter-plan-json");
const cloudLiveRuntimeAdapterExitComplete = document.querySelector("#cloud-live-runtime-adapter-exit-complete");
const cloudLiveRuntimeAdapterExitPercent = document.querySelector("#cloud-live-runtime-adapter-exit-percent");
const cloudLiveRuntimeAdapterExitNext = document.querySelector("#cloud-live-runtime-adapter-exit-next");
const cloudLiveRuntimeAdapterExitJson = document.querySelector("#cloud-live-runtime-adapter-exit-json");
const cloudLiveFinalAuthReady = document.querySelector("#cloud-live-final-auth-ready");
const cloudLiveFinalAuthGranted = document.querySelector("#cloud-live-final-auth-granted");
const cloudLiveFinalAuthNext = document.querySelector("#cloud-live-final-auth-next");
const cloudLiveFinalAuthJson = document.querySelector("#cloud-live-final-auth-json");
const cloudLiveLaunchReviewReady = document.querySelector("#cloud-live-launch-review-ready");
const cloudLiveLaunchReviewAuthorized = document.querySelector("#cloud-live-launch-review-authorized");
const cloudLiveLaunchReviewNext = document.querySelector("#cloud-live-launch-review-next");
const cloudLiveLaunchReviewJson = document.querySelector("#cloud-live-launch-review-json");
const cloudLiveRuntimeImplPlanReady = document.querySelector("#cloud-live-runtime-impl-plan-ready");
const cloudLiveRuntimeImplPlanImplemented = document.querySelector("#cloud-live-runtime-impl-plan-implemented");
const cloudLiveRuntimeImplPlanNext = document.querySelector("#cloud-live-runtime-impl-plan-next");
const cloudLiveRuntimeImplPlanJson = document.querySelector("#cloud-live-runtime-impl-plan-json");
const cloudLiveRuntimeAdapterImplReady = document.querySelector("#cloud-live-runtime-adapter-impl-ready");
const cloudLiveRuntimeAdapterImplInterface = document.querySelector("#cloud-live-runtime-adapter-impl-interface");
const cloudLiveRuntimeAdapterImplNext = document.querySelector("#cloud-live-runtime-adapter-impl-next");
const cloudLiveRuntimeAdapterImplJson = document.querySelector("#cloud-live-runtime-adapter-impl-json");
const cloudLiveRuntimeAdapterModuleReady = document.querySelector("#cloud-live-runtime-adapter-module-ready");
const cloudLiveRuntimeAdapterModuleBoundary = document.querySelector("#cloud-live-runtime-adapter-module-boundary");
const cloudLiveRuntimeAdapterModuleNext = document.querySelector("#cloud-live-runtime-adapter-module-next");
const cloudLiveRuntimeAdapterModuleJson = document.querySelector("#cloud-live-runtime-adapter-module-json");
const cloudLiveProviderRequestBuilderReady = document.querySelector("#cloud-live-provider-request-builder-ready");
const cloudLiveProviderRequestBuilderMessages = document.querySelector("#cloud-live-provider-request-builder-messages");
const cloudLiveProviderRequestBuilderNext = document.querySelector("#cloud-live-provider-request-builder-next");
const cloudLiveProviderRequestBuilderJson = document.querySelector("#cloud-live-provider-request-builder-json");
const cloudLiveProviderCredentialReferenceResolverReady = document.querySelector("#cloud-live-provider-credential-reference-resolver-ready");
const cloudLiveProviderCredentialReferenceResolverReferenceOnly = document.querySelector("#cloud-live-provider-credential-reference-resolver-reference-only");
const cloudLiveProviderCredentialReferenceResolverNext = document.querySelector("#cloud-live-provider-credential-reference-resolver-next");
const cloudLiveProviderCredentialReferenceResolverJson = document.querySelector("#cloud-live-provider-credential-reference-resolver-json");
const cloudLiveProviderNoNetworkSenderReady = document.querySelector("#cloud-live-provider-no-network-sender-ready");
const cloudLiveProviderNoNetworkSenderDispatch = document.querySelector("#cloud-live-provider-no-network-sender-dispatch");
const cloudLiveProviderNoNetworkSenderNext = document.querySelector("#cloud-live-provider-no-network-sender-next");
const cloudLiveProviderNoNetworkSenderJson = document.querySelector("#cloud-live-provider-no-network-sender-json");
const cloudLiveProviderEgressTranscriptRecorderReady = document.querySelector("#cloud-live-provider-egress-transcript-recorder-ready");
const cloudLiveProviderEgressTranscriptRecorderLocal = document.querySelector("#cloud-live-provider-egress-transcript-recorder-local");
const cloudLiveProviderEgressTranscriptRecorderNext = document.querySelector("#cloud-live-provider-egress-transcript-recorder-next");
const cloudLiveProviderEgressTranscriptRecorderJson = document.querySelector("#cloud-live-provider-egress-transcript-recorder-json");
const cloudLiveProviderResponseVerifierReady = document.querySelector("#cloud-live-provider-response-verifier-ready");
const cloudLiveProviderResponseVerifierVerified = document.querySelector("#cloud-live-provider-response-verifier-verified");
const cloudLiveProviderResponseVerifierNext = document.querySelector("#cloud-live-provider-response-verifier-next");
const cloudLiveProviderResponseVerifierJson = document.querySelector("#cloud-live-provider-response-verifier-json");
const cloudLiveProviderRollbackNoteReady = document.querySelector("#cloud-live-provider-rollback-note-ready");
const cloudLiveProviderRollbackNoteExecuted = document.querySelector("#cloud-live-provider-rollback-note-executed");
const cloudLiveProviderRollbackNoteNext = document.querySelector("#cloud-live-provider-rollback-note-next");
const cloudLiveProviderRollbackNoteJson = document.querySelector("#cloud-live-provider-rollback-note-json");
const cloudLiveProviderRuntimeAdapterCompletionReady = document.querySelector("#cloud-live-provider-runtime-adapter-completion-ready");
const cloudLiveProviderRuntimeAdapterCompletionMethods = document.querySelector("#cloud-live-provider-runtime-adapter-completion-methods");
const cloudLiveProviderRuntimeAdapterCompletionNext = document.querySelector("#cloud-live-provider-runtime-adapter-completion-next");
const cloudLiveProviderRuntimeAdapterCompletionJson = document.querySelector("#cloud-live-provider-runtime-adapter-completion-json");
const cloudLiveProviderRuntimeAdapterClosureComplete = document.querySelector("#cloud-live-provider-runtime-adapter-closure-complete");
const cloudLiveProviderRuntimeAdapterClosurePercent = document.querySelector("#cloud-live-provider-runtime-adapter-closure-percent");
const cloudLiveProviderRuntimeAdapterClosureNext = document.querySelector("#cloud-live-provider-runtime-adapter-closure-next");
const cloudLiveProviderRuntimeAdapterClosureJson = document.querySelector("#cloud-live-provider-runtime-adapter-closure-json");
const cloudLiveProviderRealLaunchRouteReviewReady = document.querySelector("#cloud-live-provider-real-launch-route-review-ready");
const cloudLiveProviderRealLaunchRouteReviewSelected = document.querySelector("#cloud-live-provider-real-launch-route-review-selected");
const cloudLiveProviderRealLaunchRouteReviewLaunch = document.querySelector("#cloud-live-provider-real-launch-route-review-launch");
const cloudLiveProviderRealLaunchRouteReviewJson = document.querySelector("#cloud-live-provider-real-launch-route-review-json");
const cloudLiveProviderRealLaunchExecutionPreflightReady = document.querySelector("#cloud-live-provider-real-launch-execution-preflight-ready");
const cloudLiveProviderRealLaunchExecutionPreflightSource = document.querySelector("#cloud-live-provider-real-launch-execution-preflight-source");
const cloudLiveProviderRealLaunchExecutionPreflightLaunch = document.querySelector("#cloud-live-provider-real-launch-execution-preflight-launch");
const cloudLiveProviderRealLaunchExecutionPreflightJson = document.querySelector("#cloud-live-provider-real-launch-execution-preflight-json");
const cloudLiveProviderCredentialValueAccessGateReady = document.querySelector("#cloud-live-provider-credential-value-access-gate-ready");
const cloudLiveProviderCredentialValueAccessGateCredential = document.querySelector("#cloud-live-provider-credential-value-access-gate-credential");
const cloudLiveProviderCredentialValueAccessGateNext = document.querySelector("#cloud-live-provider-credential-value-access-gate-next");
const cloudLiveProviderCredentialValueAccessGateJson = document.querySelector("#cloud-live-provider-credential-value-access-gate-json");
const cloudLiveProviderEndpointNetworkEgressGateReady = document.querySelector("#cloud-live-provider-endpoint-network-egress-gate-ready");
const cloudLiveProviderEndpointNetworkEgressGateEndpoint = document.querySelector("#cloud-live-provider-endpoint-network-egress-gate-endpoint");
const cloudLiveProviderEndpointNetworkEgressGateNetwork = document.querySelector("#cloud-live-provider-endpoint-network-egress-gate-network");
const cloudLiveProviderEndpointNetworkEgressGateNext = document.querySelector("#cloud-live-provider-endpoint-network-egress-gate-next");
const cloudLiveProviderEndpointNetworkEgressGateJson = document.querySelector("#cloud-live-provider-endpoint-network-egress-gate-json");
const cloudLiveProviderEgressExecutionRouteTaskPreflightReady = document.querySelector("#cloud-live-provider-egress-execution-route-task-preflight-ready");
const cloudLiveProviderEgressExecutionRouteTaskPreflightTask = document.querySelector("#cloud-live-provider-egress-execution-route-task-preflight-task");
const cloudLiveProviderEgressExecutionRouteTaskPreflightNetwork = document.querySelector("#cloud-live-provider-egress-execution-route-task-preflight-network");
const cloudLiveProviderEgressExecutionRouteTaskPreflightNext = document.querySelector("#cloud-live-provider-egress-execution-route-task-preflight-next");
const cloudLiveProviderEgressExecutionRouteTaskPreflightJson = document.querySelector("#cloud-live-provider-egress-execution-route-task-preflight-json");
const cloudLiveProviderEgressExecutionTaskShellReady = document.querySelector("#cloud-live-provider-egress-execution-task-shell-ready");
const cloudLiveProviderEgressExecutionTaskShellApproval = document.querySelector("#cloud-live-provider-egress-execution-task-shell-approval");
const cloudLiveProviderEgressExecutionTaskShellNetwork = document.querySelector("#cloud-live-provider-egress-execution-task-shell-network");
const cloudLiveProviderEgressExecutionTaskShellNext = document.querySelector("#cloud-live-provider-egress-execution-task-shell-next");
const cloudLiveProviderEgressExecutionTaskShellJson = document.querySelector("#cloud-live-provider-egress-execution-task-shell-json");
const cloudLiveProviderEgressExecutionApprovedDeferredReady = document.querySelector("#cloud-live-provider-egress-execution-approved-deferred-ready");
const cloudLiveProviderEgressExecutionApprovedDeferredSource = document.querySelector("#cloud-live-provider-egress-execution-approved-deferred-source");
const cloudLiveProviderEgressExecutionApprovedDeferredNetwork = document.querySelector("#cloud-live-provider-egress-execution-approved-deferred-network");
const cloudLiveProviderEgressExecutionApprovedDeferredNext = document.querySelector("#cloud-live-provider-egress-execution-approved-deferred-next");
const cloudLiveProviderEgressExecutionApprovedDeferredJson = document.querySelector("#cloud-live-provider-egress-execution-approved-deferred-json");
const cloudLiveProviderCredentialValueAuthorizationRouteReady = document.querySelector("#cloud-live-provider-credential-value-authorization-route-ready");
const cloudLiveProviderCredentialValueAuthorizationRouteCredential = document.querySelector("#cloud-live-provider-credential-value-authorization-route-credential");
const cloudLiveProviderCredentialValueAuthorizationRouteNetwork = document.querySelector("#cloud-live-provider-credential-value-authorization-route-network");
const cloudLiveProviderCredentialValueAuthorizationRouteNext = document.querySelector("#cloud-live-provider-credential-value-authorization-route-next");
const cloudLiveProviderCredentialValueAuthorizationRouteJson = document.querySelector("#cloud-live-provider-credential-value-authorization-route-json");
const cloudLiveProviderCredentialValueAuthorizationTaskShellReady = document.querySelector("#cloud-live-provider-credential-value-authorization-task-shell-ready");
const cloudLiveProviderCredentialValueAuthorizationTaskShellApproval = document.querySelector("#cloud-live-provider-credential-value-authorization-task-shell-approval");
const cloudLiveProviderCredentialValueAuthorizationTaskShellCredential = document.querySelector("#cloud-live-provider-credential-value-authorization-task-shell-credential");
const cloudLiveProviderCredentialValueAuthorizationTaskShellNext = document.querySelector("#cloud-live-provider-credential-value-authorization-task-shell-next");
const cloudLiveProviderCredentialValueAuthorizationTaskShellJson = document.querySelector("#cloud-live-provider-credential-value-authorization-task-shell-json");
const cloudLiveProviderCredentialValueAuthorizationApprovedDeferredReady = document.querySelector("#cloud-live-provider-credential-value-authorization-approved-deferred-ready");
const cloudLiveProviderCredentialValueAuthorizationApprovedDeferredSource = document.querySelector("#cloud-live-provider-credential-value-authorization-approved-deferred-source");
const cloudLiveProviderCredentialValueAuthorizationApprovedDeferredCredential = document.querySelector("#cloud-live-provider-credential-value-authorization-approved-deferred-credential");
const cloudLiveProviderCredentialValueAuthorizationApprovedDeferredNext = document.querySelector("#cloud-live-provider-credential-value-authorization-approved-deferred-next");
const cloudLiveProviderCredentialValueAuthorizationApprovedDeferredJson = document.querySelector("#cloud-live-provider-credential-value-authorization-approved-deferred-json");
const cloudLiveProviderCredentialValueReadinessPreflightReady = document.querySelector("#cloud-live-provider-credential-value-readiness-preflight-ready");
const cloudLiveProviderCredentialValueReadinessPreflightSource = document.querySelector("#cloud-live-provider-credential-value-readiness-preflight-source");
const cloudLiveProviderCredentialValueReadinessPreflightCredential = document.querySelector("#cloud-live-provider-credential-value-readiness-preflight-credential");
const cloudLiveProviderCredentialValueReadinessPreflightNext = document.querySelector("#cloud-live-provider-credential-value-readiness-preflight-next");
const cloudLiveProviderCredentialValueReadinessPreflightJson = document.querySelector("#cloud-live-provider-credential-value-readiness-preflight-json");
const cloudLiveProviderCredentialValueReadTaskShellReady = document.querySelector("#cloud-live-provider-credential-value-read-task-shell-ready");
const cloudLiveProviderCredentialValueReadTaskShellApproval = document.querySelector("#cloud-live-provider-credential-value-read-task-shell-approval");
const cloudLiveProviderCredentialValueReadTaskShellCredential = document.querySelector("#cloud-live-provider-credential-value-read-task-shell-credential");
const cloudLiveProviderCredentialValueReadTaskShellNext = document.querySelector("#cloud-live-provider-credential-value-read-task-shell-next");
const cloudLiveProviderCredentialValueReadTaskShellJson = document.querySelector("#cloud-live-provider-credential-value-read-task-shell-json");
const cloudLiveProviderCredentialValueReadApprovedDeferredReady = document.querySelector("#cloud-live-provider-credential-value-read-approved-deferred-ready");
const cloudLiveProviderCredentialValueReadApprovedDeferredSource = document.querySelector("#cloud-live-provider-credential-value-read-approved-deferred-source");
const cloudLiveProviderCredentialValueReadApprovedDeferredCredential = document.querySelector("#cloud-live-provider-credential-value-read-approved-deferred-credential");
const cloudLiveProviderCredentialValueReadApprovedDeferredNext = document.querySelector("#cloud-live-provider-credential-value-read-approved-deferred-next");
const cloudLiveProviderCredentialValueReadApprovedDeferredJson = document.querySelector("#cloud-live-provider-credential-value-read-approved-deferred-json");
const cloudLiveProviderCredentialValueAccessAuthorizationRouteReady = document.querySelector("#cloud-live-provider-credential-value-access-authorization-route-ready");
const cloudLiveProviderCredentialValueAccessAuthorizationRouteCredential = document.querySelector("#cloud-live-provider-credential-value-access-authorization-route-credential");
const cloudLiveProviderCredentialValueAccessAuthorizationRouteNetwork = document.querySelector("#cloud-live-provider-credential-value-access-authorization-route-network");
const cloudLiveProviderCredentialValueAccessAuthorizationRouteNext = document.querySelector("#cloud-live-provider-credential-value-access-authorization-route-next");
const cloudLiveProviderCredentialValueAccessAuthorizationRouteJson = document.querySelector("#cloud-live-provider-credential-value-access-authorization-route-json");
const cloudLiveProviderCredentialValueAccessAuthorizationTaskShellReady = document.querySelector("#cloud-live-provider-credential-value-access-authorization-task-shell-ready");
const cloudLiveProviderCredentialValueAccessAuthorizationTaskShellApproval = document.querySelector("#cloud-live-provider-credential-value-access-authorization-task-shell-approval");
const cloudLiveProviderCredentialValueAccessAuthorizationTaskShellCredential = document.querySelector("#cloud-live-provider-credential-value-access-authorization-task-shell-credential");
const cloudLiveProviderCredentialValueAccessAuthorizationTaskShellNext = document.querySelector("#cloud-live-provider-credential-value-access-authorization-task-shell-next");
const cloudLiveProviderCredentialValueAccessAuthorizationTaskShellJson = document.querySelector("#cloud-live-provider-credential-value-access-authorization-task-shell-json");
const cloudLiveProviderCredentialValueAccessAuthorizationApprovedDeferredReady = document.querySelector("#cloud-live-provider-credential-value-access-authorization-approved-deferred-ready");
const cloudLiveProviderCredentialValueAccessAuthorizationApprovedDeferredSource = document.querySelector("#cloud-live-provider-credential-value-access-authorization-approved-deferred-source");
const cloudLiveProviderCredentialValueAccessAuthorizationApprovedDeferredCredential = document.querySelector("#cloud-live-provider-credential-value-access-authorization-approved-deferred-credential");
const cloudLiveProviderCredentialValueAccessAuthorizationApprovedDeferredNext = document.querySelector("#cloud-live-provider-credential-value-access-authorization-approved-deferred-next");
const cloudLiveProviderCredentialValueAccessAuthorizationApprovedDeferredJson = document.querySelector("#cloud-live-provider-credential-value-access-authorization-approved-deferred-json");
const cloudLiveProviderCredentialValueFinalReadinessPreflightReady = document.querySelector("#cloud-live-provider-credential-value-final-readiness-preflight-ready");
const cloudLiveProviderCredentialValueFinalReadinessPreflightSource = document.querySelector("#cloud-live-provider-credential-value-final-readiness-preflight-source");
const cloudLiveProviderCredentialValueFinalReadinessPreflightCredential = document.querySelector("#cloud-live-provider-credential-value-final-readiness-preflight-credential");
const cloudLiveProviderCredentialValueFinalReadinessPreflightNext = document.querySelector("#cloud-live-provider-credential-value-final-readiness-preflight-next");
const cloudLiveProviderCredentialValueFinalReadinessPreflightJson = document.querySelector("#cloud-live-provider-credential-value-final-readiness-preflight-json");
const cloudLiveProviderCredentialValueAccessAuthorizationDecisionRouteReady = document.querySelector("#cloud-live-provider-credential-value-access-authorization-decision-route-ready");
const cloudLiveProviderCredentialValueAccessAuthorizationDecisionRouteCredential = document.querySelector("#cloud-live-provider-credential-value-access-authorization-decision-route-credential");
const cloudLiveProviderCredentialValueAccessAuthorizationDecisionRouteNetwork = document.querySelector("#cloud-live-provider-credential-value-access-authorization-decision-route-network");
const cloudLiveProviderCredentialValueAccessAuthorizationDecisionRouteNext = document.querySelector("#cloud-live-provider-credential-value-access-authorization-decision-route-next");
const cloudLiveProviderCredentialValueAccessAuthorizationDecisionRouteJson = document.querySelector("#cloud-live-provider-credential-value-access-authorization-decision-route-json");
const cloudLiveProviderCredentialValueAccessAuthorizationDecisionTaskShellReady = document.querySelector("#cloud-live-provider-credential-value-access-authorization-decision-task-shell-ready");
const cloudLiveProviderCredentialValueAccessAuthorizationDecisionTaskShellApproval = document.querySelector("#cloud-live-provider-credential-value-access-authorization-decision-task-shell-approval");
const cloudLiveProviderCredentialValueAccessAuthorizationDecisionTaskShellCredential = document.querySelector("#cloud-live-provider-credential-value-access-authorization-decision-task-shell-credential");
const cloudLiveProviderCredentialValueAccessAuthorizationDecisionTaskShellNext = document.querySelector("#cloud-live-provider-credential-value-access-authorization-decision-task-shell-next");
const cloudLiveProviderCredentialValueAccessAuthorizationDecisionTaskShellJson = document.querySelector("#cloud-live-provider-credential-value-access-authorization-decision-task-shell-json");
const cloudLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferredReady = document.querySelector("#cloud-live-provider-credential-value-access-authorization-decision-approved-deferred-ready");
const cloudLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferredSource = document.querySelector("#cloud-live-provider-credential-value-access-authorization-decision-approved-deferred-source");
const cloudLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferredCredential = document.querySelector("#cloud-live-provider-credential-value-access-authorization-decision-approved-deferred-credential");
const cloudLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferredNext = document.querySelector("#cloud-live-provider-credential-value-access-authorization-decision-approved-deferred-next");
const cloudLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferredJson = document.querySelector("#cloud-live-provider-credential-value-access-authorization-decision-approved-deferred-json");
const cloudLiveProviderCredentialValueAccessAuthorizedLocalProofReady = document.querySelector("#cloud-live-provider-credential-value-access-authorized-local-proof-ready");
const cloudLiveProviderCredentialValueAccessAuthorizedLocalProofSource = document.querySelector("#cloud-live-provider-credential-value-access-authorized-local-proof-source");
const cloudLiveProviderCredentialValueAccessAuthorizedLocalProofCredential = document.querySelector("#cloud-live-provider-credential-value-access-authorized-local-proof-credential");
const cloudLiveProviderCredentialValueAccessAuthorizedLocalProofNext = document.querySelector("#cloud-live-provider-credential-value-access-authorized-local-proof-next");
const cloudLiveProviderCredentialValueAccessAuthorizedLocalProofJson = document.querySelector("#cloud-live-provider-credential-value-access-authorized-local-proof-json");
const cloudLiveProviderCredentialValueLocalReadRouteReady = document.querySelector("#cloud-live-provider-credential-value-local-read-route-ready");
const cloudLiveProviderCredentialValueLocalReadRouteCredential = document.querySelector("#cloud-live-provider-credential-value-local-read-route-credential");
const cloudLiveProviderCredentialValueLocalReadRouteNetwork = document.querySelector("#cloud-live-provider-credential-value-local-read-route-network");
const cloudLiveProviderCredentialValueLocalReadRouteNext = document.querySelector("#cloud-live-provider-credential-value-local-read-route-next");
const cloudLiveProviderCredentialValueLocalReadRouteJson = document.querySelector("#cloud-live-provider-credential-value-local-read-route-json");
const cloudLiveProviderCredentialValueLocalReadTaskShellReady = document.querySelector("#cloud-live-provider-credential-value-local-read-task-shell-ready");
const cloudLiveProviderCredentialValueLocalReadTaskShellApproval = document.querySelector("#cloud-live-provider-credential-value-local-read-task-shell-approval");
const cloudLiveProviderCredentialValueLocalReadTaskShellCredential = document.querySelector("#cloud-live-provider-credential-value-local-read-task-shell-credential");
const cloudLiveProviderCredentialValueLocalReadTaskShellNext = document.querySelector("#cloud-live-provider-credential-value-local-read-task-shell-next");
const cloudLiveProviderCredentialValueLocalReadTaskShellJson = document.querySelector("#cloud-live-provider-credential-value-local-read-task-shell-json");
const cloudLiveProviderCredentialValueLocalReadApprovedDeferredReady = document.querySelector("#cloud-live-provider-credential-value-local-read-approved-deferred-ready");
const cloudLiveProviderCredentialValueLocalReadApprovedDeferredSource = document.querySelector("#cloud-live-provider-credential-value-local-read-approved-deferred-source");
const cloudLiveProviderCredentialValueLocalReadApprovedDeferredCredential = document.querySelector("#cloud-live-provider-credential-value-local-read-approved-deferred-credential");
const cloudLiveProviderCredentialValueLocalReadApprovedDeferredNext = document.querySelector("#cloud-live-provider-credential-value-local-read-approved-deferred-next");
const cloudLiveProviderCredentialValueLocalReadApprovedDeferredJson = document.querySelector("#cloud-live-provider-credential-value-local-read-approved-deferred-json");
const cloudLiveProviderCredentialValueLocalReadFinalReadinessPreflightReady = document.querySelector("#cloud-live-provider-credential-value-local-read-final-readiness-preflight-ready");
const cloudLiveProviderCredentialValueLocalReadFinalReadinessPreflightSource = document.querySelector("#cloud-live-provider-credential-value-local-read-final-readiness-preflight-source");
const cloudLiveProviderCredentialValueLocalReadFinalReadinessPreflightCredential = document.querySelector("#cloud-live-provider-credential-value-local-read-final-readiness-preflight-credential");
const cloudLiveProviderCredentialValueLocalReadFinalReadinessPreflightNext = document.querySelector("#cloud-live-provider-credential-value-local-read-final-readiness-preflight-next");
const cloudLiveProviderCredentialValueLocalReadFinalReadinessPreflightJson = document.querySelector("#cloud-live-provider-credential-value-local-read-final-readiness-preflight-json");
const cloudLiveProviderCredentialValueLocalReadExecutionRouteReady = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-route-ready");
const cloudLiveProviderCredentialValueLocalReadExecutionRouteCredential = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-route-credential");
const cloudLiveProviderCredentialValueLocalReadExecutionRouteNetwork = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-route-network");
const cloudLiveProviderCredentialValueLocalReadExecutionRouteNext = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-route-next");
const cloudLiveProviderCredentialValueLocalReadExecutionRouteJson = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-route-json");
const cloudLiveProviderCredentialValueLocalReadExecutionTaskShellReady = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-task-shell-ready");
const cloudLiveProviderCredentialValueLocalReadExecutionTaskShellApproval = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-task-shell-approval");
const cloudLiveProviderCredentialValueLocalReadExecutionTaskShellCredential = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-task-shell-credential");
const cloudLiveProviderCredentialValueLocalReadExecutionTaskShellNext = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-task-shell-next");
const cloudLiveProviderCredentialValueLocalReadExecutionTaskShellJson = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-task-shell-json");
const cloudLiveProviderCredentialValueLocalReadExecutionApprovedDeferredReady = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-approved-deferred-ready");
const cloudLiveProviderCredentialValueLocalReadExecutionApprovedDeferredSource = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-approved-deferred-source");
const cloudLiveProviderCredentialValueLocalReadExecutionApprovedDeferredCredential = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-approved-deferred-credential");
const cloudLiveProviderCredentialValueLocalReadExecutionApprovedDeferredNext = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-approved-deferred-next");
const cloudLiveProviderCredentialValueLocalReadExecutionApprovedDeferredJson = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-approved-deferred-json");
const cloudLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflightReady = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-final-readiness-preflight-ready");
const cloudLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflightSource = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-final-readiness-preflight-source");
const cloudLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflightCredential = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-final-readiness-preflight-credential");
const cloudLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflightNext = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-final-readiness-preflight-next");
const cloudLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflightJson = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-final-readiness-preflight-json");
const cloudLiveProviderCredentialValueLocalReadExecutionLocalReadRouteReady = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-local-read-route-ready");
const cloudLiveProviderCredentialValueLocalReadExecutionLocalReadRouteCredential = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-local-read-route-credential");
const cloudLiveProviderCredentialValueLocalReadExecutionLocalReadRouteNetwork = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-local-read-route-network");
const cloudLiveProviderCredentialValueLocalReadExecutionLocalReadRouteNext = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-local-read-route-next");
const cloudLiveProviderCredentialValueLocalReadExecutionLocalReadRouteJson = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-local-read-route-json");
const cloudLiveProviderCredentialValueLocalReadExecutionLocalReadTaskShellReady = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-local-read-task-shell-ready");
const cloudLiveProviderCredentialValueLocalReadExecutionLocalReadTaskShellApproval = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-local-read-task-shell-approval");
const cloudLiveProviderCredentialValueLocalReadExecutionLocalReadTaskShellCredential = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-local-read-task-shell-credential");
const cloudLiveProviderCredentialValueLocalReadExecutionLocalReadTaskShellNext = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-local-read-task-shell-next");
const cloudLiveProviderCredentialValueLocalReadExecutionLocalReadTaskShellJson = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-local-read-task-shell-json");
const cloudLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferredReady = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-local-read-approved-deferred-ready");
const cloudLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferredSource = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-local-read-approved-deferred-source");
const cloudLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferredCredential = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-local-read-approved-deferred-credential");
const cloudLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferredNext = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-local-read-approved-deferred-next");
const cloudLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferredJson = document.querySelector("#cloud-live-provider-credential-value-local-read-execution-local-read-approved-deferred-json");
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
const healthTrendSampleCount = document.querySelector("#health-trend-sample-count");
const healthTrendStableServices = document.querySelector("#health-trend-stable-services");
const healthTrendDegradedServices = document.querySelector("#health-trend-degraded-services");
const healthTrendAlertCount = document.querySelector("#health-trend-alert-count");
const healthTrendJson = document.querySelector("#health-trend-json");
const routeNextActionName = document.querySelector("#route-next-action-name");
const routeNextActionPriority = document.querySelector("#route-next-action-priority");
const routeNextActionCreatesTask = document.querySelector("#route-next-action-creates-task");
const routeNextActionMutation = document.querySelector("#route-next-action-mutation");
const routeNextActionJson = document.querySelector("#route-next-action-json");
const recoveryPolicyPosture = document.querySelector("#recovery-policy-posture");
const recoveryPolicyCreatesTask = document.querySelector("#recovery-policy-creates-task");
const recoveryPolicyExecutesCommand = document.querySelector("#recovery-policy-executes-command");
const recoveryPolicyMutation = document.querySelector("#recovery-policy-mutation");
const recoveryPolicyJson = document.querySelector("#recovery-policy-json");
const bodyGovernanceReady = document.querySelector("#body-governance-ready");
const bodyGovernanceChecks = document.querySelector("#body-governance-checks");
const bodyGovernancePosture = document.querySelector("#body-governance-posture");
const bodyGovernanceMutation = document.querySelector("#body-governance-mutation");
const bodyGovernanceJson = document.querySelector("#body-governance-json");
const bodyEvidenceTimelineReady = document.querySelector("#body-evidence-timeline-ready");
const bodyEvidenceTimelineEntries = document.querySelector("#body-evidence-timeline-entries");
const bodyEvidenceTimelineLatest = document.querySelector("#body-evidence-timeline-latest");
const bodyEvidenceTimelineMutation = document.querySelector("#body-evidence-timeline-mutation");
const bodyEvidenceTimelineJson = document.querySelector("#body-evidence-timeline-json");
const bodyEvidenceTimelineReadinessReady = document.querySelector("#body-evidence-timeline-readiness-ready");
const bodyEvidenceTimelineReadinessChecks = document.querySelector("#body-evidence-timeline-readiness-checks");
const bodyEvidenceTimelineReadinessLatest = document.querySelector("#body-evidence-timeline-readiness-latest");
const bodyEvidenceTimelineReadinessMutation = document.querySelector("#body-evidence-timeline-readiness-mutation");
const bodyEvidenceTimelineReadinessJson = document.querySelector("#body-evidence-timeline-readiness-json");
const bodyEvidenceLedgerPlanReady = document.querySelector("#body-evidence-ledger-plan-ready");
const bodyEvidenceLedgerPlanSchema = document.querySelector("#body-evidence-ledger-plan-schema");
const bodyEvidenceLedgerPlanGates = document.querySelector("#body-evidence-ledger-plan-gates");
const bodyEvidenceLedgerPlanWritten = document.querySelector("#body-evidence-ledger-plan-written");
const bodyEvidenceLedgerPlanJson = document.querySelector("#body-evidence-ledger-plan-json");
const bodyEvidenceLedgerRouteReviewStatus = document.querySelector("#body-evidence-ledger-route-review-status");
const bodyEvidenceLedgerRouteReviewNext = document.querySelector("#body-evidence-ledger-route-review-next");
const bodyEvidenceLedgerRouteReviewWrite = document.querySelector("#body-evidence-ledger-route-review-write");
const bodyEvidenceLedgerRouteReviewMutation = document.querySelector("#body-evidence-ledger-route-review-mutation");
const bodyEvidenceLedgerRouteReviewJson = document.querySelector("#body-evidence-ledger-route-review-json");
const bodyEvidenceLedgerStorageRootPlanReady = document.querySelector("#body-evidence-ledger-storage-root-plan-ready");
const bodyEvidenceLedgerStorageRootPlanRoot = document.querySelector("#body-evidence-ledger-storage-root-plan-root");
const bodyEvidenceLedgerStorageRootPlanCreated = document.querySelector("#body-evidence-ledger-storage-root-plan-created");
const bodyEvidenceLedgerStorageRootPlanWritten = document.querySelector("#body-evidence-ledger-storage-root-plan-written");
const bodyEvidenceLedgerStorageRootPlanJson = document.querySelector("#body-evidence-ledger-storage-root-plan-json");
const bodyEvidenceLedgerStorageRootRouteReviewStatus = document.querySelector("#body-evidence-ledger-storage-root-route-review-status");
const bodyEvidenceLedgerStorageRootRouteReviewNext = document.querySelector("#body-evidence-ledger-storage-root-route-review-next");
const bodyEvidenceLedgerStorageRootRouteReviewCreate = document.querySelector("#body-evidence-ledger-storage-root-route-review-create");
const bodyEvidenceLedgerStorageRootRouteReviewWritten = document.querySelector("#body-evidence-ledger-storage-root-route-review-written");
const bodyEvidenceLedgerStorageRootRouteReviewJson = document.querySelector("#body-evidence-ledger-storage-root-route-review-json");
const bodyEvidenceLedgerDirectoryTaskReady = document.querySelector("#body-evidence-ledger-directory-task-ready");
const bodyEvidenceLedgerDirectoryTaskTarget = document.querySelector("#body-evidence-ledger-directory-task-target");
const bodyEvidenceLedgerDirectoryTaskApproval = document.querySelector("#body-evidence-ledger-directory-task-approval");
const bodyEvidenceLedgerDirectoryTaskCreated = document.querySelector("#body-evidence-ledger-directory-task-created");
const bodyEvidenceLedgerDirectoryTaskJson = document.querySelector("#body-evidence-ledger-directory-task-json");
const bodyEvidenceLedgerFirstRecordPlanReady = document.querySelector("#body-evidence-ledger-first-record-plan-ready");
const bodyEvidenceLedgerFirstRecordPlanType = document.querySelector("#body-evidence-ledger-first-record-plan-type");
const bodyEvidenceLedgerFirstRecordPlanDirectory = document.querySelector("#body-evidence-ledger-first-record-plan-directory");
const bodyEvidenceLedgerFirstRecordPlanWritten = document.querySelector("#body-evidence-ledger-first-record-plan-written");
const bodyEvidenceLedgerFirstRecordPlanJson = document.querySelector("#body-evidence-ledger-first-record-plan-json");
const bodyEvidenceLedgerFirstRecordRouteReviewStatus = document.querySelector("#body-evidence-ledger-first-record-route-review-status");
const bodyEvidenceLedgerFirstRecordRouteReviewNext = document.querySelector("#body-evidence-ledger-first-record-route-review-next");
const bodyEvidenceLedgerFirstRecordRouteReviewWrite = document.querySelector("#body-evidence-ledger-first-record-route-review-write");
const bodyEvidenceLedgerFirstRecordRouteReviewWritten = document.querySelector("#body-evidence-ledger-first-record-route-review-written");
const bodyEvidenceLedgerFirstRecordRouteReviewJson = document.querySelector("#body-evidence-ledger-first-record-route-review-json");
const bodyEvidenceLedgerFirstRecordTaskReady = document.querySelector("#body-evidence-ledger-first-record-task-ready");
const bodyEvidenceLedgerFirstRecordTaskType = document.querySelector("#body-evidence-ledger-first-record-task-type");
const bodyEvidenceLedgerFirstRecordTaskApproval = document.querySelector("#body-evidence-ledger-first-record-task-approval");
const bodyEvidenceLedgerFirstRecordTaskAppended = document.querySelector("#body-evidence-ledger-first-record-task-appended");
const bodyEvidenceLedgerFirstRecordTaskJson = document.querySelector("#body-evidence-ledger-first-record-task-json");
const bodyEvidenceLedgerReadinessReady = document.querySelector("#body-evidence-ledger-readiness-ready");
const bodyEvidenceLedgerReadinessChecks = document.querySelector("#body-evidence-ledger-readiness-checks");
const bodyEvidenceLedgerReadinessRecords = document.querySelector("#body-evidence-ledger-readiness-records");
const bodyEvidenceLedgerReadinessMutation = document.querySelector("#body-evidence-ledger-readiness-mutation");
const bodyEvidenceLedgerReadinessJson = document.querySelector("#body-evidence-ledger-readiness-json");
const bodyEvidenceLedgerDemoStatusReady = document.querySelector("#body-evidence-ledger-demo-status-ready");
const bodyEvidenceLedgerDemoStatusChecks = document.querySelector("#body-evidence-ledger-demo-status-checks");
const bodyEvidenceLedgerDemoStatusRecord = document.querySelector("#body-evidence-ledger-demo-status-record");
const bodyEvidenceLedgerDemoStatusMutation = document.querySelector("#body-evidence-ledger-demo-status-mutation");
const bodyEvidenceLedgerDemoStatusJson = document.querySelector("#body-evidence-ledger-demo-status-json");
const bodyEvidenceLedgerFollowupRecordPlanReady = document.querySelector("#body-evidence-ledger-followup-record-plan-ready");
const bodyEvidenceLedgerFollowupRecordPlanType = document.querySelector("#body-evidence-ledger-followup-record-plan-type");
const bodyEvidenceLedgerFollowupRecordPlanRecords = document.querySelector("#body-evidence-ledger-followup-record-plan-records");
const bodyEvidenceLedgerFollowupRecordPlanWritten = document.querySelector("#body-evidence-ledger-followup-record-plan-written");
const bodyEvidenceLedgerFollowupRecordPlanJson = document.querySelector("#body-evidence-ledger-followup-record-plan-json");
const bodyEvidenceLedgerFollowupRecordRouteReviewStatus = document.querySelector("#body-evidence-ledger-followup-record-route-review-status");
const bodyEvidenceLedgerFollowupRecordRouteReviewNext = document.querySelector("#body-evidence-ledger-followup-record-route-review-next");
const bodyEvidenceLedgerFollowupRecordRouteReviewWrite = document.querySelector("#body-evidence-ledger-followup-record-route-review-write");
const bodyEvidenceLedgerFollowupRecordRouteReviewWritten = document.querySelector("#body-evidence-ledger-followup-record-route-review-written");
const bodyEvidenceLedgerFollowupRecordRouteReviewJson = document.querySelector("#body-evidence-ledger-followup-record-route-review-json");
const bodyEvidenceLedgerFollowupRecordTaskReady = document.querySelector("#body-evidence-ledger-followup-record-task-ready");
const bodyEvidenceLedgerFollowupRecordTaskType = document.querySelector("#body-evidence-ledger-followup-record-task-type");
const bodyEvidenceLedgerFollowupRecordTaskApproval = document.querySelector("#body-evidence-ledger-followup-record-task-approval");
const bodyEvidenceLedgerFollowupRecordTaskAppended = document.querySelector("#body-evidence-ledger-followup-record-task-appended");
const bodyEvidenceLedgerFollowupRecordTaskJson = document.querySelector("#body-evidence-ledger-followup-record-task-json");
const bodyEvidenceLedgerFollowupRecordReadinessReady = document.querySelector("#body-evidence-ledger-followup-record-readiness-ready");
const bodyEvidenceLedgerFollowupRecordReadinessChecks = document.querySelector("#body-evidence-ledger-followup-record-readiness-checks");
const bodyEvidenceLedgerFollowupRecordReadinessRecords = document.querySelector("#body-evidence-ledger-followup-record-readiness-records");
const bodyEvidenceLedgerFollowupRecordReadinessMutation = document.querySelector("#body-evidence-ledger-followup-record-readiness-mutation");
const bodyEvidenceLedgerFollowupRecordReadinessJson = document.querySelector("#body-evidence-ledger-followup-record-readiness-json");
const bodyEvidenceLedgerFollowupRecordAppendRouteReviewStatus = document.querySelector("#body-evidence-ledger-followup-record-append-route-review-status");
const bodyEvidenceLedgerFollowupRecordAppendRouteReviewNext = document.querySelector("#body-evidence-ledger-followup-record-append-route-review-next");
const bodyEvidenceLedgerFollowupRecordAppendRouteReviewApproves = document.querySelector("#body-evidence-ledger-followup-record-append-route-review-approves");
const bodyEvidenceLedgerFollowupRecordAppendRouteReviewAppended = document.querySelector("#body-evidence-ledger-followup-record-append-route-review-appended");
const bodyEvidenceLedgerFollowupRecordAppendRouteReviewJson = document.querySelector("#body-evidence-ledger-followup-record-append-route-review-json");
const bodyEvidenceLedgerFollowupRecordAppendReadinessReady = document.querySelector("#body-evidence-ledger-followup-record-append-readiness-ready");
const bodyEvidenceLedgerFollowupRecordAppendReadinessChecks = document.querySelector("#body-evidence-ledger-followup-record-append-readiness-checks");
const bodyEvidenceLedgerFollowupRecordAppendReadinessRecords = document.querySelector("#body-evidence-ledger-followup-record-append-readiness-records");
const bodyEvidenceLedgerFollowupRecordAppendReadinessMutation = document.querySelector("#body-evidence-ledger-followup-record-append-readiness-mutation");
const bodyEvidenceLedgerFollowupRecordAppendReadinessJson = document.querySelector("#body-evidence-ledger-followup-record-append-readiness-json");
const phase2RouteSelectedTrack = document.querySelector("#phase-2-route-selected-track");
const phase2RouteNextSlice = document.querySelector("#phase-2-route-next-slice");
const phase2RouteCreatesTask = document.querySelector("#phase-2-route-creates-task");
const phase2RouteMutation = document.querySelector("#phase-2-route-mutation");
const phase2RouteJson = document.querySelector("#phase-2-route-json");
const systemdRepairCandidateCount = document.querySelector("#systemd-repair-candidate-count");
const systemdRepairCandidateRecommended = document.querySelector("#systemd-repair-candidate-recommended");
const systemdRepairCandidateCreatesTask = document.querySelector("#systemd-repair-candidate-creates-task");
const systemdRepairCandidateMutation = document.querySelector("#systemd-repair-candidate-mutation");
const systemdRepairCandidateJson = document.querySelector("#systemd-repair-candidate-json");
const systemdRepairCandidatePlanTarget = document.querySelector("#systemd-repair-candidate-plan-target");
const systemdRepairCandidatePlanMode = document.querySelector("#systemd-repair-candidate-plan-mode");
const systemdRepairCandidatePlanCreatesTask = document.querySelector("#systemd-repair-candidate-plan-creates-task");
const systemdRepairCandidatePlanMutation = document.querySelector("#systemd-repair-candidate-plan-mutation");
const systemdRepairCandidatePlanJson = document.querySelector("#systemd-repair-candidate-plan-json");
const systemdRepairCandidateRouteStatus = document.querySelector("#systemd-repair-candidate-route-status");
const systemdRepairCandidateRouteTarget = document.querySelector("#systemd-repair-candidate-route-target");
const systemdRepairCandidateRouteCreatesTask = document.querySelector("#systemd-repair-candidate-route-creates-task");
const systemdRepairCandidateRouteMutation = document.querySelector("#systemd-repair-candidate-route-mutation");
const systemdRepairCandidateRouteJson = document.querySelector("#systemd-repair-candidate-route-json");
const systemdRepairCandidateTaskShellReady = document.querySelector("#systemd-repair-candidate-task-shell-ready");
const systemdRepairCandidateTaskShellTarget = document.querySelector("#systemd-repair-candidate-task-shell-target");
const systemdRepairCandidateTaskShellApproval = document.querySelector("#systemd-repair-candidate-task-shell-approval");
const systemdRepairCandidateTaskShellMutation = document.querySelector("#systemd-repair-candidate-task-shell-mutation");
const systemdRepairCandidateTaskShellJson = document.querySelector("#systemd-repair-candidate-task-shell-json");
const systemdRepairCandidateReadinessReady = document.querySelector("#systemd-repair-candidate-readiness-ready");
const systemdRepairCandidateReadinessChecks = document.querySelector("#systemd-repair-candidate-readiness-checks");
const systemdRepairCandidateReadinessNext = document.querySelector("#systemd-repair-candidate-readiness-next");
const systemdRepairCandidateReadinessMutation = document.querySelector("#systemd-repair-candidate-readiness-mutation");
const systemdRepairCandidateReadinessJson = document.querySelector("#systemd-repair-candidate-readiness-json");
const systemdRepairCandidateRouteReviewTrack = document.querySelector("#systemd-repair-candidate-route-review-track");
const systemdRepairCandidateRouteReviewSlice = document.querySelector("#systemd-repair-candidate-route-review-slice");
const systemdRepairCandidateRouteReviewCreatesTask = document.querySelector("#systemd-repair-candidate-route-review-creates-task");
const systemdRepairCandidateRouteReviewMutation = document.querySelector("#systemd-repair-candidate-route-review-mutation");
const systemdRepairCandidateRouteReviewJson = document.querySelector("#systemd-repair-candidate-route-review-json");
const systemdRepairCandidateDemoStatusReady = document.querySelector("#systemd-repair-candidate-demo-status-ready");
const systemdRepairCandidateDemoStatusChecks = document.querySelector("#systemd-repair-candidate-demo-status-checks");
const systemdRepairCandidateDemoStatusTarget = document.querySelector("#systemd-repair-candidate-demo-status-target");
const systemdRepairCandidateDemoStatusMutation = document.querySelector("#systemd-repair-candidate-demo-status-mutation");
const systemdRepairCandidateDemoStatusJson = document.querySelector("#systemd-repair-candidate-demo-status-json");
const systemdNextRepairScopeReviewReady = document.querySelector("#systemd-next-repair-scope-review-ready");
const systemdNextRepairScopeReviewUnit = document.querySelector("#systemd-next-repair-scope-review-unit");
const systemdNextRepairScopeReviewCandidates = document.querySelector("#systemd-next-repair-scope-review-candidates");
const systemdNextRepairScopeReviewMutation = document.querySelector("#systemd-next-repair-scope-review-mutation");
const systemdNextRepairScopeReviewJson = document.querySelector("#systemd-next-repair-scope-review-json");
const systemdNextRepairPlanTarget = document.querySelector("#systemd-next-repair-plan-target");
const systemdNextRepairPlanMode = document.querySelector("#systemd-next-repair-plan-mode");
const systemdNextRepairPlanCreatesTask = document.querySelector("#systemd-next-repair-plan-creates-task");
const systemdNextRepairPlanMutation = document.querySelector("#systemd-next-repair-plan-mutation");
const systemdNextRepairPlanJson = document.querySelector("#systemd-next-repair-plan-json");
const systemdNextRepairRouteReviewTrack = document.querySelector("#systemd-next-repair-route-review-track");
const systemdNextRepairRouteReviewSlice = document.querySelector("#systemd-next-repair-route-review-slice");
const systemdNextRepairRouteReviewCreatesTask = document.querySelector("#systemd-next-repair-route-review-creates-task");
const systemdNextRepairRouteReviewMutation = document.querySelector("#systemd-next-repair-route-review-mutation");
const systemdNextRepairRouteReviewJson = document.querySelector("#systemd-next-repair-route-review-json");
const systemdNextRepairDryRunTarget = document.querySelector("#systemd-next-repair-dry-run-target");
const systemdNextRepairDryRunMode = document.querySelector("#systemd-next-repair-dry-run-mode");
const systemdNextRepairDryRunWouldExecute = document.querySelector("#systemd-next-repair-dry-run-would-execute");
const systemdNextRepairDryRunMutation = document.querySelector("#systemd-next-repair-dry-run-mutation");
const systemdNextRepairDryRunJson = document.querySelector("#systemd-next-repair-dry-run-json");
const systemdNextRepairTaskRouteStatus = document.querySelector("#systemd-next-repair-task-route-status");
const systemdNextRepairTaskRouteSlice = document.querySelector("#systemd-next-repair-task-route-slice");
const systemdNextRepairTaskRouteCreatesTask = document.querySelector("#systemd-next-repair-task-route-creates-task");
const systemdNextRepairTaskRouteMutation = document.querySelector("#systemd-next-repair-task-route-mutation");
const systemdNextRepairTaskRouteJson = document.querySelector("#systemd-next-repair-task-route-json");
const systemdNextRepairTaskShellReady = document.querySelector("#systemd-next-repair-task-shell-ready");
const systemdNextRepairTaskShellTarget = document.querySelector("#systemd-next-repair-task-shell-target");
const systemdNextRepairTaskShellApproval = document.querySelector("#systemd-next-repair-task-shell-approval");
const systemdNextRepairTaskShellMutation = document.querySelector("#systemd-next-repair-task-shell-mutation");
const systemdNextRepairTaskShellJson = document.querySelector("#systemd-next-repair-task-shell-json");
const systemdUnitTotal = document.querySelector("#systemd-unit-total");
const systemdUnitActive = document.querySelector("#systemd-unit-active");
const systemdUnitObserved = document.querySelector("#systemd-unit-observed");
const systemdUnitMode = document.querySelector("#systemd-unit-mode");
const systemdUnitJson = document.querySelector("#systemd-unit-json");
const systemdDependencyNodeCount = document.querySelector("#systemd-dependency-node-count");
const systemdDependencyEdgeCount = document.querySelector("#systemd-dependency-edge-count");
const systemdDependencyRootCount = document.querySelector("#systemd-dependency-root-count");
const systemdDependencyHighImpact = document.querySelector("#systemd-dependency-high-impact");
const systemdDependencyJson = document.querySelector("#systemd-dependency-json");
const systemdRepairPlanTarget = document.querySelector("#systemd-repair-plan-target");
const systemdRepairPlanRisk = document.querySelector("#systemd-repair-plan-risk");
const systemdRepairPlanMode = document.querySelector("#systemd-repair-plan-mode");
const systemdRepairDryRunMode = document.querySelector("#systemd-repair-dry-run-mode");
const systemdRepairPlanJson = document.querySelector("#systemd-repair-plan-json");
const systemdRepairDryRunJson = document.querySelector("#systemd-repair-dry-run-json");
const systemdRepairExecutionTaskRegistry = document.querySelector("#systemd-repair-execution-task-registry");
const systemdRepairExecutionTaskTarget = document.querySelector("#systemd-repair-execution-task-target");
const systemdRepairExecutionTaskApproval = document.querySelector("#systemd-repair-execution-task-approval");
const systemdRepairExecutionTaskExecuted = document.querySelector("#systemd-repair-execution-task-executed");
const systemdRepairExecutionTaskJson = document.querySelector("#systemd-repair-execution-task-json");
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
const takeoverButton = document.querySelector("#takeover-button");
const stopButton = document.querySelector("#stop-button");
const openWorkViewUrlButton = document.querySelector("#open-work-view-url-button");
const workViewUrlInput = document.querySelector("#work-view-url-input");
const createSystemdRepairExecutionTaskButton = document.querySelector("#create-systemd-repair-execution-task-button");
const createSystemdRepairRealExecutionTaskButton = document.querySelector("#create-systemd-repair-real-execution-task-button");
const createSystemdRepairCandidateTaskShellButton = document.querySelector("#create-systemd-repair-candidate-task-shell-button");
const createSystemdNextRepairTaskShellButton = document.querySelector("#create-systemd-next-repair-task-shell-button");
const createSystemdNextRepairRealExecutionButton = document.querySelector("#create-systemd-next-repair-real-execution-button");
const createBodyEvidenceLedgerDirectoryTaskButton = document.querySelector("#create-body-evidence-ledger-directory-task-button");
const createBodyEvidenceLedgerFirstRecordTaskButton = document.querySelector("#create-body-evidence-ledger-first-record-task-button");
const createBodyEvidenceLedgerFollowupRecordTaskButton = document.querySelector("#create-body-evidence-ledger-followup-record-task-button");
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
    const data = await fetchJson(\`\${observerConfig.coreUrl}/plugins/native-adapter/workspace-patch-apply/draft?relativePath=scratch/observer-native-edit.txt&edits=\${edits}&contextLines=0\`);
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
    const taskPostExecutionVerification = task.outcome?.details?.postExecutionVerification ?? null;
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
    if (taskPostExecutionVerification) {
      const summary = taskPostExecutionVerification.summary ?? {};
      lines.push(\`Post Execution Verification: \${taskPostExecutionVerification.registry ?? "unknown"} / \${taskPostExecutionVerification.mode ?? "unknown"}\`);
      lines.push(\`Post Verification Unit: \${taskPostExecutionVerification.targetUnit ?? "unknown"} before=\${summary.beforeActiveState ?? "unknown"} after=\${summary.afterActiveState ?? "unknown"}\`);
      lines.push(\`Post Verification Health: beforeServiceOk=\${summary.beforeServiceOk ?? "unknown"} afterServiceOk=\${summary.afterServiceOk ?? "unknown"} noAutomaticRecovery=\${Boolean(summary.noAutomaticRecovery)}\`);
    }
    if (task.bodyEvidenceLedgerFirstRecord) {
      const firstRecord = task.bodyEvidenceLedgerFirstRecord;
      lines.push(\`Body Evidence Ledger First Record: \${firstRecord.plannedRecordType ?? "unknown"} appended=\${Boolean(firstRecord.recordAppended)} storageWritten=\${Boolean(firstRecord.durableStorageWritten)}\`);
      lines.push(\`Body Evidence Ledger File: \${firstRecord.ledgerFileDisplayPath ?? "pending"} recordId=\${firstRecord.recordId ?? "pending"} hash=\${firstRecord.contentHash ?? "pending"}\`);
    }
    if (task.bodyEvidenceLedgerFollowupRecord) {
      const followupRecord = task.bodyEvidenceLedgerFollowupRecord;
      lines.push(\`Body Evidence Ledger Follow-up Record: \${followupRecord.plannedRecordType ?? "unknown"} sequence=\${followupRecord.plannedSequence ?? "unknown"} appended=\${Boolean(followupRecord.recordAppended)} storageWritten=\${Boolean(followupRecord.durableStorageWritten)}\`);
      lines.push(\`Body Evidence Ledger Follow-up File: \${followupRecord.ledgerFileDisplayPath ?? "pending"} recordId=\${followupRecord.recordId ?? "pending"} previous=\${followupRecord.previousRecordId ?? "pending"} hash=\${followupRecord.contentHash ?? "pending"}\`);
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

async function refreshPhase2RepairDemoStatus() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/repair-demo-status\`);
    const summary = data.summary ?? {};
    const checklist = data.checklist ?? [];
    phase2RepairDemoStatus.textContent = data.status ?? "unknown";
    phase2RepairDemoEvidence.textContent = \`\${summary.passed ?? 0}/\${summary.total ?? checklist.length}\`;
    phase2RepairDemoTarget.textContent = summary.targetUnit ?? "openclaw-browser-runtime.service";
    phase2RepairDemoNext.textContent = data.route?.nextRecommendedSlice ?? "demo evidence bundle";
    phase2RepairDemoJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} readOnly=\${Boolean(data.governance?.readOnly)} executesCommand=\${Boolean(data.governance?.executesCommand)}\`,
      \`Status: \${data.status ?? "unknown"} demoReady=\${Boolean(summary.demoReady)}\`,
      \`Task: \${summary.latestTaskId ?? "none"} outcome=\${summary.latestOutcome ?? "none"}\`,
      \`Command: \${summary.command ?? "none"} exitCode=\${summary.exitCode ?? "none"}\`,
      \`Body: before=\${summary.beforeActiveState ?? "unknown"} after=\${summary.afterActiveState ?? "unknown"} serviceOk=\${summary.beforeServiceOk ?? "unknown"}->\${summary.afterServiceOk ?? "unknown"}\`,
      \`No Automatic Recovery: \${Boolean(summary.noAutomaticRecovery)}\`,
      \`Next: \${data.route?.nextRecommendedSlice ?? "unknown"} avoidsSafetyBoundaryLoop=\${Boolean(data.route?.avoidsSafetyBoundaryLoop)}\`,
      "",
      ...(checklist.map((item) => \`[\${item.status ?? "unknown"}] \${item.id ?? "check"} :: \${item.label ?? "no label"} evidence=\${item.evidence ?? "none"}\`)),
    ].join("\\n");
  } catch {
    phase2RepairDemoStatus.textContent = "offline";
    phase2RepairDemoEvidence.textContent = "0/0";
    phase2RepairDemoTarget.textContent = "offline";
    phase2RepairDemoNext.textContent = "unknown";
    phase2RepairDemoJson.textContent = "Unable to read Phase 2 repair demo status.";
  }
}

async function refreshPhase2NextRepairDemoStatus() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/next-repair-demo-status\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checklist = data.checklist ?? [];
    phase2NextRepairDemoStatus.textContent = data.status ?? "unknown";
    phase2NextRepairDemoEvidence.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checklist.length}\`;
    phase2NextRepairDemoTarget.textContent = summary.targetUnit ?? "openclaw-system-sense.service";
    phase2NextRepairDemoMutation.textContent = String(Boolean(governance.hostMutation));
    phase2NextRepairDemoJson.textContent = [
      \`Registry: \${data.registry ?? "openclaw-systemd-next-repair-demo-status-v0"}\`,
      \`Mode: \${data.mode ?? "unknown"} readsTaskHistoryOnly=\${Boolean(governance.readsTaskHistoryOnly)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)}\`,
      \`Status: \${data.status ?? "unknown"} ready=\${Boolean(summary.ready)} target=\${summary.targetUnit ?? "unknown"}\`,
      \`Outcome: \${summary.outcome ?? "none"} hostMutationAttempted=\${Boolean(summary.hostMutationAttempted)} executionSucceeded=\${summary.executionSucceeded ?? "unknown"}\`,
      \`Command: \${summary.command ?? "none"} exitCode=\${summary.exitCode ?? "none"}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-timeline"} boundary=\${data.next?.boundary ?? "read-only body memory"}\`,
      "",
      ...(checklist.map((item) => \`[\${item.status ?? "unknown"}] \${item.id ?? "check"} :: \${item.label ?? "no label"} evidence=\${typeof item.evidence === "string" ? item.evidence : JSON.stringify(item.evidence ?? null)}\`)),
    ].join("\\n");
  } catch {
    phase2NextRepairDemoStatus.textContent = "offline";
    phase2NextRepairDemoEvidence.textContent = "0/0";
    phase2NextRepairDemoTarget.textContent = "offline";
    phase2NextRepairDemoMutation.textContent = "false";
    phase2NextRepairDemoJson.textContent = "Unable to read Phase 2 next repair demo status.";
  }
}

async function refreshPhase2DemoControlRoom() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/demo-control-room\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const evidence = data.evidence ?? {};
    phase2DemoControlRoomStatus.textContent = data.status ?? "unknown";
    phase2DemoControlRoomPanels.textContent = \`\${summary.availablePanels ?? 0}/\${summary.totalPanels ?? 0}\`;
    phase2DemoControlRoomSlice.textContent = summary.selectedSlice ?? "unknown";
    phase2DemoControlRoomMutation.textContent = String(Boolean(governance.mutatesHost));
    phase2DemoControlRoomJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} readOnly=\${Boolean(governance.readOnly)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutatesHost=\${Boolean(governance.mutatesHost)}\`,
      \`Status: \${data.status ?? "unknown"} ready=\${Boolean(summary.ready)} panels=\${summary.availablePanels ?? 0}/\${summary.totalPanels ?? 0}\`,
      \`Route: track=\${summary.selectedTrack ?? "unknown"} slice=\${summary.selectedSlice ?? "unknown"} avoidsSafetyBoundaryLoop=\${Boolean(summary.avoidsSafetyBoundaryLoop)}\`,
      \`Repair Demo: status=\${summary.repairDemoStatus ?? "unknown"} ready=\${Boolean(summary.repairDemoReady)} target=\${evidence.repairDemo?.targetUnit ?? "unknown"}\`,
      \`Body Governance: ready=\${Boolean(summary.bodyGovernanceReady)} routeReview=\${data.source?.routeReviewRegistry ?? "unknown"}\`,
      \`Panels: \${(data.panels ?? []).map((panel) => \`\${panel.id}=\${panel.status}\`).join(", ")}\`,
      \`Script: \${(data.operatorScript ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "demo walkthrough"}\`,
    ].join("\\n");
  } catch {
    phase2DemoControlRoomStatus.textContent = "offline";
    phase2DemoControlRoomPanels.textContent = "0/0";
    phase2DemoControlRoomSlice.textContent = "unknown";
    phase2DemoControlRoomMutation.textContent = "false";
    phase2DemoControlRoomJson.textContent = "Unable to read Phase 2 demo control room.";
  }
}

async function refreshPhase2DemoWalkthrough() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/demo-walkthrough\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    phase2DemoWalkthroughStatus.textContent = data.status ?? "unknown";
    phase2DemoWalkthroughSteps.textContent = \`\${summary.readySteps ?? 0}/\${summary.totalSteps ?? 0}\`;
    phase2DemoWalkthroughControlRoom.textContent = String(Boolean(summary.controlRoomReady));
    phase2DemoWalkthroughMutation.textContent = String(Boolean(governance.mutatesHost));
    phase2DemoWalkthroughJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} readOnly=\${Boolean(governance.readOnly)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutatesHost=\${Boolean(governance.mutatesHost)}\`,
      \`Status: \${data.status ?? "unknown"} ready=\${Boolean(summary.ready)} steps=\${summary.readySteps ?? 0}/\${summary.totalSteps ?? 0}\`,
      \`Evidence: controlRoomReady=\${Boolean(summary.controlRoomReady)} bodyGovernanceReady=\${Boolean(summary.bodyGovernanceReady)} repairDemoReady=\${Boolean(summary.repairDemoReady)}\`,
      \`Steps: \${(data.steps ?? []).map((step) => \`\${step.id}=\${step.status}\`).join(", ")}\`,
      \`Script: \${(data.script ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "demo readiness exit"}\`,
    ].join("\\n");
  } catch {
    phase2DemoWalkthroughStatus.textContent = "offline";
    phase2DemoWalkthroughSteps.textContent = "0/0";
    phase2DemoWalkthroughControlRoom.textContent = "false";
    phase2DemoWalkthroughMutation.textContent = "false";
    phase2DemoWalkthroughJson.textContent = "Unable to read Phase 2 demo walkthrough.";
  }
}

async function refreshPhase2DemoReadinessExit() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/demo-readiness-exit\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const operatorOutcome = data.operatorOutcome ?? {};
    const completedBlock = data.completedBlock ?? {};
    phase2DemoReadinessExitStatus.textContent = data.status ?? "unknown";
    phase2DemoReadinessExitChecks.textContent = \`\${summary.passed ?? 0}/\${summary.total ?? 0}\`;
    phase2DemoReadinessExitSafe.textContent = String(Boolean(operatorOutcome.safeToDemo));
    phase2DemoReadinessExitMutation.textContent = String(Boolean(governance.mutatesHost));
    phase2DemoReadinessExitJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} readOnly=\${Boolean(governance.readOnly)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutatesHost=\${Boolean(governance.mutatesHost)}\`,
      \`Status: \${data.status ?? "unknown"} ready=\${Boolean(summary.ready)} checks=\${summary.passed ?? 0}/\${summary.total ?? 0}\`,
      \`Outcome: safeToDemo=\${Boolean(operatorOutcome.safeToDemo)} hiddenMutation=\${Boolean(operatorOutcome.hiddenMutation)}\`,
      \`Completed: \${completedBlock.name ?? "unknown"} claim=\${completedBlock.completionClaim ?? "unknown"}\`,
      \`Slices: \${(completedBlock.completedSlices ?? []).join(", ")}\`,
      \`Checks: \${(data.exitChecks ?? []).map((check) => \`\${check.id}=\${Boolean(check.passed)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "next capability route review"}\`,
    ].join("\\n");
  } catch {
    phase2DemoReadinessExitStatus.textContent = "offline";
    phase2DemoReadinessExitChecks.textContent = "0/0";
    phase2DemoReadinessExitSafe.textContent = "false";
    phase2DemoReadinessExitMutation.textContent = "false";
    phase2DemoReadinessExitJson.textContent = "Unable to read Phase 2 demo readiness exit.";
  }
}

async function refreshPhase2NextCapabilityRoute() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/next-capability-route-review\`);
    const decision = data.decision ?? {};
    const governance = data.governance ?? {};
    const evidence = data.evidence ?? {};
    const nextSlice = data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-plan";
    phase2NextCapabilityTrack.textContent = decision.selectedTrack ?? "unknown";
    phase2NextCapabilitySlice.textContent = decision.selectedSlice ?? nextSlice;
    phase2NextCapabilityCreatesTask.textContent = String(Boolean(governance.createsTask));
    phase2NextCapabilityMutation.textContent = String(Boolean(governance.mutatesHost));
    phase2NextCapabilityJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} readOnly=\${Boolean(governance.readOnly)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutatesHost=\${Boolean(governance.mutatesHost)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: demoReady=\${Boolean(evidence.demoReady)} exitChecks=\${evidence.demoExitChecks ?? "0/0"} candidateDemoReady=\${Boolean(evidence.candidateDemoReady)} timelineReady=\${Boolean(evidence.bodyEvidenceTimelineReady)} followupReadinessReady=\${Boolean(evidence.bodyEvidenceLedgerFollowupRecordReadinessReady)} followupTask=\${evidence.bodyEvidenceLedgerFollowupTaskId ?? "none"} candidateUnit=\${evidence.candidateDemoSelectedUnit ?? "none"} completed=\${evidence.completedDemoBlock?.completionClaim ?? "unknown"}\`,
      \`Candidates: \${(data.candidates ?? []).map((candidate) => \`\${candidate.track}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}\`).join(", ")}\`,
      \`Next: \${nextSlice}\`,
    ].join("\\n");
  } catch {
    phase2NextCapabilityTrack.textContent = "offline";
    phase2NextCapabilitySlice.textContent = "unknown";
    phase2NextCapabilityCreatesTask.textContent = "false";
    phase2NextCapabilityMutation.textContent = "false";
    phase2NextCapabilityJson.textContent = "Unable to read Phase 2 next capability route review.";
  }
}

async function refreshPhase2CompletionReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/completion-readiness\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    phase2CompletionReadinessReady.textContent = String(Boolean(summary.ready));
    phase2CompletionReadinessChecks.textContent = \`\${summary.passed ?? 0}/\${summary.total ?? 0}\`;
    phase2CompletionReadinessPercent.textContent = String(summary.completionPercent ?? 0);
    phase2CompletionReadinessMutation.textContent = String(Boolean(governance.mutatesHost));
    phase2CompletionReadinessJson.textContent = [
      \`Registry: \${data.registry ?? "openclaw-phase-2-completion-readiness-v0"}\`,
      \`Mode: \${data.mode ?? "unknown"} status=\${data.status ?? "unknown"} ready=\${Boolean(summary.ready)} percent=\${summary.completionPercent ?? 0}\`,
      \`Checks: \${summary.passed ?? 0}/\${summary.total ?? 0} firstRepair=\${Boolean(summary.firstRepairDemoReady)} nextRepair=\${Boolean(summary.nextRepairDemoReady)} candidate=\${Boolean(summary.candidateDemoReady)} demoExit=\${Boolean(summary.demoExitReady)} governance=\${Boolean(summary.bodyGovernanceReady)} ledgerRecords=\${summary.durableBodyMemoryRecords ?? 0}\`,
      \`Follow-up: record=\${summary.followupRecordId ?? "none"}\`,
      \`Governance: readOnly=\${Boolean(governance.readOnly)} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutatesHost=\${Boolean(governance.mutatesHost)} scheduler=\${Boolean(governance.schedulesWork)} backgroundWriter=\${Boolean(governance.backgroundWriter)} writesLedger=\${Boolean(governance.writesLedger)}\`,
      \`Next: \${data.next?.recommendedSlice ?? "unknown"} boundary=\${data.next?.boundary ?? "unknown"}\`,
    ].join("\\n");
  } catch {
    phase2CompletionReadinessReady.textContent = "false";
    phase2CompletionReadinessChecks.textContent = "0/0";
    phase2CompletionReadinessPercent.textContent = "0";
    phase2CompletionReadinessMutation.textContent = "false";
    phase2CompletionReadinessJson.textContent = "Unable to read Phase 2 completion readiness.";
  }
}

async function refreshPhase2Exit() {
  try {
    const phase2ExitNextFallback = "openclaw-phase-3-plan";
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/exit\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    phase2ExitComplete.textContent = String(Boolean(summary.complete));
    phase2ExitPercent.textContent = String(summary.completionPercent ?? 0);
    phase2ExitNext.textContent = data.next?.recommendedSlice ?? phase2ExitNextFallback;
    phase2ExitMutation.textContent = String(Boolean(governance.mutatesHost));
    phase2ExitJson.textContent = [
      \`Registry: \${data.registry ?? "openclaw-phase-2-exit-v0"}\`,
      \`Mode: \${data.mode ?? "unknown"} status=\${data.status ?? "unknown"} complete=\${Boolean(summary.complete)} percent=\${summary.completionPercent ?? 0}\`,
      \`Readiness: status=\${summary.readinessStatus ?? "unknown"} checks=\${summary.passed ?? 0}/\${summary.total ?? 0} records=\${summary.durableBodyMemoryRecords ?? 0} followup=\${summary.followupRecordId ?? "none"}\`,
      \`Completed: \${data.completedPhase?.completionClaim ?? "unknown"} tracks=\${(data.completedPhase?.completedTracks ?? []).length}\`,
      \`Governance: readOnly=\${Boolean(governance.readOnly)} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutatesHost=\${Boolean(governance.mutatesHost)} scheduler=\${Boolean(governance.schedulesWork)} backgroundWriter=\${Boolean(governance.backgroundWriter)} writesLedger=\${Boolean(governance.writesLedger)}\`,
      \`Next: \${data.next?.recommendedSlice ?? phase2ExitNextFallback} boundary=\${data.next?.boundary ?? "unknown"}\`,
    ].join("\\n");
  } catch {
    phase2ExitComplete.textContent = "false";
    phase2ExitPercent.textContent = "0";
    phase2ExitNext.textContent = "openclaw-phase-3-plan";
    phase2ExitMutation.textContent = "false";
    phase2ExitJson.textContent = "Unable to read Phase 2 exit gate.";
  }
}

async function refreshPhase3Plan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-3/plan\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    phase3PlanReady.textContent = String(Boolean(summary.ready));
    phase3PlanNext.textContent = data.next?.recommendedSlice ?? "openclaw-phase-3-background-work-view";
    phase3PlanForeground.textContent = String(Boolean(governance.stealsForeground));
    phase3PlanJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-3-plan-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown") + " ready=" + Boolean(summary.ready),
      "Theme: " + (data.whitepaperAlignment?.phaseTheme ?? "Let it work without stealing the foreground."),
      "Slices: " + ((data.selectedSlices ?? []).join(", ") || "none"),
      "Next: " + (data.next?.recommendedSlice ?? "unknown"),
    ].join("\\n");
  } catch {
    phase3PlanReady.textContent = "false";
    phase3PlanNext.textContent = "unknown";
    phase3PlanForeground.textContent = "false";
    phase3PlanJson.textContent = "Unable to read Phase 3 plan.";
  }
}

async function refreshPhase3BackgroundWorkView() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-3/background-work-view\`);
    const summary = data.summary ?? {};
    const workView = data.current?.workView ?? {};
    phase3BackgroundReady.textContent = String(Boolean(summary.ready));
    phase3BackgroundVisibility.textContent = workView.visibility ?? data.workViewContract?.defaultVisibility ?? "hidden";
    phase3BackgroundMode.textContent = workView.mode ?? data.workViewContract?.defaultMode ?? "background";
    phase3BackgroundJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-3-background-work-view-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " checks=" + (summary.passed ?? 0) + "/" + (summary.total ?? 0),
      "Default: visibility=" + (data.workViewContract?.defaultVisibility ?? "hidden") + " mode=" + (data.workViewContract?.defaultMode ?? "background"),
      "Current: visibility=" + (workView.visibility ?? "unknown") + " mode=" + (workView.mode ?? "unknown") + " capture=" + (workView.captureStrategy ?? "unknown"),
    ].join("\\n");
  } catch {
    phase3BackgroundReady.textContent = "false";
    phase3BackgroundVisibility.textContent = "unknown";
    phase3BackgroundMode.textContent = "unknown";
    phase3BackgroundJson.textContent = "Unable to read Phase 3 background work view.";
  }
}

async function refreshPhase3OperatorInterruptControls() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-3/operator-interrupt-controls\`);
    const summary = data.summary ?? {};
    phase3ControlsReady.textContent = String(Boolean(summary.ready));
    phase3ControlsTakeover.textContent = String(Boolean(summary.takeoverSupported));
    phase3ControlsHiddenAutomation.textContent = String(Boolean(summary.hiddenAutomation));
    phase3ControlsJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-3-operator-interrupt-controls-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Controls: " + ((data.controls ?? []).map((control) => control.id + " " + control.endpoint).join(" | ") || "none"),
      "Operator: status=" + (data.operator?.status ?? "unknown") + " blocked=" + Boolean(data.operator?.blocked),
      "Next: " + (data.next?.recommendedSlice ?? "unknown"),
    ].join("\\n");
  } catch {
    phase3ControlsReady.textContent = "false";
    phase3ControlsTakeover.textContent = "false";
    phase3ControlsHiddenAutomation.textContent = "false";
    phase3ControlsJson.textContent = "Unable to read Phase 3 operator controls.";
  }
}

async function refreshPhase3CompletionReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-3/completion-readiness\`);
    const summary = data.summary ?? {};
    phase3ReadinessReady.textContent = String(Boolean(summary.ready));
    phase3ReadinessChecks.textContent = (summary.passed ?? 0) + "/" + (summary.total ?? 0);
    phase3ReadinessPercent.textContent = String(summary.completionPercent ?? 0);
    phase3ReadinessJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-3-completion-readiness-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Foreground Steal: " + Boolean(summary.foregroundStealByDefault),
      "Tracks: " + ((data.completedTracks ?? []).map((track) => track.id + "=" + track.status).join(" | ") || "none"),
    ].join("\\n");
  } catch {
    phase3ReadinessReady.textContent = "false";
    phase3ReadinessChecks.textContent = "0/0";
    phase3ReadinessPercent.textContent = "0";
    phase3ReadinessJson.textContent = "Unable to read Phase 3 completion readiness.";
  }
}

async function refreshPhase3Exit() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-3/exit\`);
    const summary = data.summary ?? {};
    phase3ExitComplete.textContent = String(Boolean(summary.complete));
    phase3ExitPercent.textContent = String(summary.completionPercent ?? 0);
    phase3ExitNext.textContent = data.next?.recommendedSlice ?? "openclaw-phase-4-plan";
    phase3ExitJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-3-exit-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Complete: " + Boolean(summary.complete) + " percent=" + (summary.completionPercent ?? 0),
      "Completed: " + (data.completedPhase?.completionClaim ?? "unknown"),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-phase-4-plan"),
    ].join("\\n");
  } catch {
    phase3ExitComplete.textContent = "false";
    phase3ExitPercent.textContent = "0";
    phase3ExitNext.textContent = "openclaw-phase-4-plan";
    phase3ExitJson.textContent = "Unable to read Phase 3 exit gate.";
  }
}

async function refreshPhase4Plan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-4/plan\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    phase4PlanReady.textContent = String(Boolean(summary.ready));
    phase4PlanNext.textContent = data.next?.recommendedSlice ?? "openclaw-phase-4-self-heal-loop";
    phase4PlanRealRepair.textContent = String(Boolean(governance.realHostRepair));
    phase4PlanJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-4-plan-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown") + " ready=" + Boolean(summary.ready),
      "Theme: " + (data.whitepaperAlignment?.phaseTheme ?? "Let it care for its body."),
      "Slices: " + ((data.selectedSlices ?? []).join(", ") || "none"),
      "Next: " + (data.next?.recommendedSlice ?? "unknown"),
    ].join("\\n");
  } catch {
    phase4PlanReady.textContent = "false";
    phase4PlanNext.textContent = "unknown";
    phase4PlanRealRepair.textContent = "false";
    phase4PlanJson.textContent = "Unable to read Phase 4 plan.";
  }
}

async function refreshPhase4SelfHealLoop() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-4/self-heal-loop\`);
    const summary = data.summary ?? {};
    phase4SelfHealReady.textContent = String(Boolean(summary.ready));
    phase4SelfHealExecuted.textContent = String(summary.executedRepairs ?? 0);
    phase4SelfHealSkipped.textContent = String(summary.skippedHighRisk ?? 0);
    phase4SelfHealJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-4-self-heal-loop-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " checks=" + (summary.passed ?? 0) + "/" + (summary.total ?? 0),
      "Diagnosis: " + (data.diagnosis?.status ?? "unknown") + " steps=" + (data.diagnosis?.planSteps ?? 0),
      "Maintenance: run=" + (data.maintenance?.latestRunId ?? "none") + " status=" + (data.maintenance?.status ?? "unknown") + " executed=" + (summary.executedRepairs ?? 0) + " skipped=" + (summary.skippedHighRisk ?? 0),
    ].join("\\n");
  } catch {
    phase4SelfHealReady.textContent = "false";
    phase4SelfHealExecuted.textContent = "0";
    phase4SelfHealSkipped.textContent = "0";
    phase4SelfHealJson.textContent = "Unable to read Phase 4 self-heal loop.";
  }
}

async function refreshPhase4HealHistoryEvidence() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-4/heal-history-evidence\`);
    const summary = data.summary ?? {};
    const history = data.history ?? {};
    phase4HistoryReady.textContent = String(Boolean(summary.ready));
    phase4HistoryHealCount.textContent = String(history.healCount ?? 0);
    phase4HistoryMaintenanceCount.textContent = String(history.maintenanceCount ?? 0);
    phase4HistoryJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-4-heal-history-evidence-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " checks=" + (summary.passed ?? 0) + "/" + (summary.total ?? 0),
      "History: heal=" + (history.healCount ?? 0) + " maintenance=" + (history.maintenanceCount ?? 0) + " latestRun=" + (history.latestRunId ?? "none"),
      "Evidence: executed=" + (history.executedRepairs ?? 0) + " skipped=" + (history.skippedHighRisk ?? 0),
    ].join("\\n");
  } catch {
    phase4HistoryReady.textContent = "false";
    phase4HistoryHealCount.textContent = "0";
    phase4HistoryMaintenanceCount.textContent = "0";
    phase4HistoryJson.textContent = "Unable to read Phase 4 heal history evidence.";
  }
}

async function refreshPhase4CompletionReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-4/completion-readiness\`);
    const summary = data.summary ?? {};
    phase4ReadinessReady.textContent = String(Boolean(summary.ready));
    phase4ReadinessChecks.textContent = (summary.passed ?? 0) + "/" + (summary.total ?? 0);
    phase4ReadinessPercent.textContent = String(summary.completionPercent ?? 0);
    phase4ReadinessJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-4-completion-readiness-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Evidence: services=" + (summary.servicesObserved ?? 0) + " executed=" + (summary.executedRepairs ?? 0) + " skipped=" + (summary.skippedHighRisk ?? 0),
      "Tracks: " + ((data.completedTracks ?? []).map((track) => track.id + "=" + track.status).join(" | ") || "none"),
    ].join("\\n");
  } catch {
    phase4ReadinessReady.textContent = "false";
    phase4ReadinessChecks.textContent = "0/0";
    phase4ReadinessPercent.textContent = "0";
    phase4ReadinessJson.textContent = "Unable to read Phase 4 completion readiness.";
  }
}

async function refreshPhase4Exit() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-4/exit\`);
    const summary = data.summary ?? {};
    phase4ExitComplete.textContent = String(Boolean(summary.complete));
    phase4ExitPercent.textContent = String(summary.completionPercent ?? 0);
    phase4ExitNext.textContent = data.next?.recommendedSlice ?? "openclaw-phase-5-plan";
    phase4ExitJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-4-exit-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Complete: " + Boolean(summary.complete) + " percent=" + (summary.completionPercent ?? 0),
      "Completed: " + (data.completedPhase?.completionClaim ?? "unknown"),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-phase-5-plan"),
    ].join("\\n");
  } catch {
    phase4ExitComplete.textContent = "false";
    phase4ExitPercent.textContent = "0";
    phase4ExitNext.textContent = "openclaw-phase-5-plan";
    phase4ExitJson.textContent = "Unable to read Phase 4 exit gate.";
  }
}

async function refreshPhase5Plan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-5/plan\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    phase5PlanReady.textContent = String(Boolean(summary.ready));
    phase5PlanNext.textContent = data.next?.recommendedSlice ?? "openclaw-phase-5-deployment-inventory";
    phase5PlanReleaseAction.textContent = String(Boolean(governance.releaseAction));
    phase5PlanJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-5-plan-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown") + " ready=" + Boolean(summary.ready),
      "Theme: " + (data.whitepaperAlignment?.phaseTheme ?? "Make deployment and rollback controllable."),
      "Slices: " + ((data.selectedSlices ?? []).join(", ") || "none"),
      "Next: " + (data.next?.recommendedSlice ?? "unknown"),
    ].join("\\n");
  } catch {
    phase5PlanReady.textContent = "false";
    phase5PlanNext.textContent = "unknown";
    phase5PlanReleaseAction.textContent = "false";
    phase5PlanJson.textContent = "Unable to read Phase 5 plan.";
  }
}

async function refreshPhase5DeploymentInventory() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-5/deployment-inventory\`);
    const summary = data.summary ?? {};
    phase5DeploymentReady.textContent = String(Boolean(summary.ready));
    phase5DeploymentServices.textContent = String(summary.servicesObserved ?? 0);
    phase5DeploymentModules.textContent = String(summary.modulesObserved ?? 0);
    phase5DeploymentJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-5-deployment-inventory-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " checks=" + (summary.passed ?? 0) + "/" + (summary.total ?? 0),
      "Deployment: model=" + (data.deployment?.model ?? "unknown") + " profile=" + (data.deployment?.hostProfile ?? "unknown"),
      "Inventory: services=" + (summary.servicesObserved ?? 0) + " modules=" + (summary.modulesObserved ?? 0) + " scripts=" + (summary.scriptsObserved ?? 0),
    ].join("\\n");
  } catch {
    phase5DeploymentReady.textContent = "false";
    phase5DeploymentServices.textContent = "0";
    phase5DeploymentModules.textContent = "0";
    phase5DeploymentJson.textContent = "Unable to read Phase 5 deployment inventory.";
  }
}

async function refreshPhase5RollbackReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-5/rollback-readiness\`);
    const summary = data.summary ?? {};
    phase5RollbackReady.textContent = String(Boolean(summary.ready));
    phase5RollbackSurfaces.textContent = String(summary.rollbackSurfaces ?? 0);
    phase5RollbackExecuted.textContent = String(Boolean(summary.rollbackExecuted));
    phase5RollbackJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-5-rollback-readiness-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " checks=" + (summary.passed ?? 0) + "/" + (summary.total ?? 0),
      "Rollback: surfaces=" + (summary.rollbackSurfaces ?? 0) + " executed=" + Boolean(summary.rollbackExecuted),
      "Boundary: " + (data.rollback?.operatorBoundary ?? "read-only"),
    ].join("\\n");
  } catch {
    phase5RollbackReady.textContent = "false";
    phase5RollbackSurfaces.textContent = "0";
    phase5RollbackExecuted.textContent = "false";
    phase5RollbackJson.textContent = "Unable to read Phase 5 rollback readiness.";
  }
}

async function refreshPhase5ReleaseControlReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-5/release-control-readiness\`);
    const summary = data.summary ?? {};
    phase5ReleaseReady.textContent = String(Boolean(summary.ready));
    phase5ReleasePercent.textContent = String(summary.completionPercent ?? 0);
    phase5ReleaseMutation.textContent = String(Boolean(summary.mutatesHost));
    phase5ReleaseJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-5-release-control-readiness-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Controls: " + ((data.controls ?? []).join(" | ") || "none"),
      "Tracks: " + ((data.completedTracks ?? []).map((track) => track.id + "=" + track.status).join(" | ") || "none"),
    ].join("\\n");
  } catch {
    phase5ReleaseReady.textContent = "false";
    phase5ReleasePercent.textContent = "0";
    phase5ReleaseMutation.textContent = "false";
    phase5ReleaseJson.textContent = "Unable to read Phase 5 release control readiness.";
  }
}

async function refreshPhase5Exit() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-5/exit\`);
    const summary = data.summary ?? {};
    phase5ExitComplete.textContent = String(Boolean(summary.complete));
    phase5ExitPercent.textContent = String(summary.completionPercent ?? 0);
    phase5ExitNext.textContent = data.next?.recommendedSlice ?? "openclaw-mvp-final-readiness";
    phase5ExitJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-5-exit-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Complete: " + Boolean(summary.complete) + " percent=" + (summary.completionPercent ?? 0),
      "Completed: " + (data.completedPhase?.completionClaim ?? "unknown"),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-mvp-final-readiness"),
    ].join("\\n");
  } catch {
    phase5ExitComplete.textContent = "false";
    phase5ExitPercent.textContent = "0";
    phase5ExitNext.textContent = "openclaw-mvp-final-readiness";
    phase5ExitJson.textContent = "Unable to read Phase 5 exit gate.";
  }
}

async function refreshMvpFinalReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/mvp/final-readiness\`);
    const summary = data.summary ?? {};
    mvpFinalComplete.textContent = String(Boolean(summary.complete));
    mvpFinalCriteria.textContent = (summary.criteriaPassed ?? 0) + "/" + (summary.criteriaTotal ?? 0);
    mvpFinalNext.textContent = data.next?.recommendedSlice ?? "openclaw-post-mvp-plan";
    mvpFinalJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-mvp-final-readiness-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Complete: " + Boolean(summary.complete) + " percent=" + (summary.completionPercent ?? 0),
      "Criteria: " + (summary.criteriaPassed ?? 0) + "/" + (summary.criteriaTotal ?? 0),
      "Boundary: " + (data.whitepaperAlignment?.nextBoundary ?? "post-MVP plan required"),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-post-mvp-plan"),
    ].join("\\n");
  } catch {
    mvpFinalComplete.textContent = "false";
    mvpFinalCriteria.textContent = "0/0";
    mvpFinalNext.textContent = "openclaw-post-mvp-plan";
    mvpFinalJson.textContent = "Unable to read MVP final readiness.";
  }
}

async function refreshPostMvpPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/post-mvp/plan\`);
    const summary = data.summary ?? {};
    postMvpPlanReady.textContent = String(Boolean(summary.ready));
    postMvpPlanTrunk.textContent = summary.selectedTrunk ?? "unknown";
    postMvpPlanNext.textContent = data.next?.recommendedSlice ?? "openclaw-phase-6-consciousness-memory-plan";
    postMvpPlanJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-post-mvp-plan-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Theme: " + (data.whitepaperAlignment?.selectedTheme ?? "Give the body a memory-bearing task mind."),
      "Selected: " + (summary.selectedTrunk ?? "unknown"),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-phase-6-consciousness-memory-plan"),
    ].join("\\n");
  } catch {
    postMvpPlanReady.textContent = "false";
    postMvpPlanTrunk.textContent = "unknown";
    postMvpPlanNext.textContent = "openclaw-phase-6-consciousness-memory-plan";
    postMvpPlanJson.textContent = "Unable to read post-MVP plan.";
  }
}

async function refreshPhase6Plan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-6/plan\`);
    const summary = data.summary ?? {};
    phase6PlanReady.textContent = String(Boolean(summary.ready));
    phase6PlanNext.textContent = data.next?.recommendedSlice ?? "openclaw-phase-6-memory-substrate-inventory";
    phase6PlanWritesMemory.textContent = String(Boolean(summary.writesMemory));
    phase6PlanJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-6-consciousness-memory-plan-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Theme: " + (data.whitepaperAlignment?.phaseTheme ?? "Give the body a memory-bearing task mind."),
      "Slices: " + ((data.selectedSlices ?? []).join(", ") || "none"),
      "Next: " + (data.next?.recommendedSlice ?? "unknown"),
    ].join("\\n");
  } catch {
    phase6PlanReady.textContent = "false";
    phase6PlanNext.textContent = "unknown";
    phase6PlanWritesMemory.textContent = "false";
    phase6PlanJson.textContent = "Unable to read Phase 6 plan.";
  }
}

async function refreshPhase6MemorySubstrateInventory() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-6/memory-substrate-inventory\`);
    const summary = data.summary ?? {};
    phase6MemoryReady.textContent = String(Boolean(summary.ready));
    phase6MemorySources.textContent = String(summary.sourceCount ?? 0);
    phase6MemoryWritable.textContent = String(summary.writableSources ?? 0);
    phase6MemoryJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-6-memory-substrate-inventory-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " sources=" + (summary.sourceCount ?? 0) + " writable=" + (summary.writableSources ?? 0),
      "Sources: " + ((data.memorySources ?? []).map((source) => source.id).join(", ") || "none"),
    ].join("\\n");
  } catch {
    phase6MemoryReady.textContent = "false";
    phase6MemorySources.textContent = "0";
    phase6MemoryWritable.textContent = "0";
    phase6MemoryJson.textContent = "Unable to read Phase 6 memory substrate inventory.";
  }
}

async function refreshPhase6ConsciousnessContextEnvelope() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-6/consciousness-context-envelope\`);
    const summary = data.summary ?? {};
    phase6ContextReady.textContent = String(Boolean(summary.ready));
    phase6ContextPointers.textContent = String(summary.memoryPointers ?? 0);
    phase6ContextTransmitted.textContent = String(Boolean(summary.transmitted));
    phase6ContextJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-6-consciousness-context-envelope-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " pointers=" + (summary.memoryPointers ?? 0) + " transmitted=" + Boolean(summary.transmitted),
      "Schema: " + (data.envelope?.schema ?? "unknown"),
      "Cloud Call: " + Boolean(summary.callsCloudModel),
    ].join("\\n");
  } catch {
    phase6ContextReady.textContent = "false";
    phase6ContextPointers.textContent = "0";
    phase6ContextTransmitted.textContent = "false";
    phase6ContextJson.textContent = "Unable to read Phase 6 consciousness context envelope.";
  }
}

async function refreshPhase6TaskOrchestrationRecords() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-6/task-orchestration-records\`);
    const summary = data.summary ?? {};
    phase6OrchestrationReady.textContent = String(Boolean(summary.ready));
    phase6OrchestrationRecords.textContent = String(summary.recordCount ?? 0);
    phase6OrchestrationScheduled.textContent = String(summary.scheduledTasks ?? 0);
    phase6OrchestrationJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-6-task-orchestration-records-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " records=" + (summary.recordCount ?? 0) + " scheduled=" + (summary.scheduledTasks ?? 0),
      "Records: " + ((data.records ?? []).map((record) => record.id + "=" + record.status).join(" | ") || "none"),
    ].join("\\n");
  } catch {
    phase6OrchestrationReady.textContent = "false";
    phase6OrchestrationRecords.textContent = "0";
    phase6OrchestrationScheduled.textContent = "0";
    phase6OrchestrationJson.textContent = "Unable to read Phase 6 task orchestration records.";
  }
}

async function refreshPhase6MemoryWriteRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-6/memory-write-route-review\`);
    const summary = data.summary ?? {};
    phase6RouteReady.textContent = String(Boolean(summary.ready));
    phase6RouteSelected.textContent = summary.selectedSlice ?? "unknown";
    phase6RouteWritesMemory.textContent = String(Boolean(summary.writesMemory));
    phase6RouteJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-6-memory-write-route-review-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " selected=" + (summary.selectedSlice ?? "unknown"),
      "Deferred: " + (data.decision?.deferredSlice ?? "unknown"),
      "Writes Memory: " + Boolean(summary.writesMemory) + " cloud=" + Boolean(summary.callsCloudModel),
    ].join("\\n");
  } catch {
    phase6RouteReady.textContent = "false";
    phase6RouteSelected.textContent = "unknown";
    phase6RouteWritesMemory.textContent = "false";
    phase6RouteJson.textContent = "Unable to read Phase 6 memory write route review.";
  }
}

async function refreshPhase6Exit() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-6/exit\`);
    const summary = data.summary ?? {};
    phase6ExitComplete.textContent = String(Boolean(summary.complete));
    phase6ExitPercent.textContent = String(summary.completionPercent ?? 0);
    phase6ExitNext.textContent = data.next?.recommendedSlice ?? "openclaw-long-term-memory-write-plan";
    phase6ExitJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-phase-6-exit-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Complete: " + Boolean(summary.complete) + " percent=" + (summary.completionPercent ?? 0),
      "Evidence: sources=" + (summary.memorySources ?? 0) + " pointers=" + (summary.memoryPointers ?? 0) + " records=" + (summary.orchestrationRecords ?? 0),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-long-term-memory-write-plan"),
    ].join("\\n");
  } catch {
    phase6ExitComplete.textContent = "false";
    phase6ExitPercent.textContent = "0";
    phase6ExitNext.textContent = "openclaw-long-term-memory-write-plan";
    phase6ExitJson.textContent = "Unable to read Phase 6 exit gate.";
  }
}

async function refreshLongTermMemoryWritePlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/long-term-memory/write-plan\`);
    const summary = data.summary ?? {};
    longTermMemoryPlanReady.textContent = String(Boolean(summary.ready));
    longTermMemoryPlanScope.textContent = data.storage?.file ?? "unknown";
    longTermMemoryPlanWrites.textContent = String(Boolean(summary.writesMemory));
    longTermMemoryPlanJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-long-term-memory-write-plan-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Theme: " + (data.whitepaperAlignment?.phaseTheme ?? "Give the body its first governed long-term memory write."),
      "Scope: " + (data.storage?.file ?? "unknown"),
      "Next: " + (data.next?.recommendedSlice ?? "unknown"),
    ].join("\\n");
  } catch {
    longTermMemoryPlanReady.textContent = "false";
    longTermMemoryPlanScope.textContent = "unknown";
    longTermMemoryPlanWrites.textContent = "false";
    longTermMemoryPlanJson.textContent = "Unable to read long-term memory write plan.";
  }
}

async function refreshLongTermMemorySchema() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/long-term-memory/schema\`);
    const summary = data.summary ?? {};
    longTermMemorySchemaReady.textContent = String(Boolean(summary.ready));
    longTermMemorySchemaFields.textContent = String(summary.requiredFieldCount ?? 0);
    longTermMemorySchemaCloud.textContent = String(Boolean(summary.callsCloudModel));
    longTermMemorySchemaJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-long-term-memory-schema-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Schema: " + (data.schema?.id ?? "unknown"),
      "Fields: " + ((data.schema?.requiredFields ?? []).join(", ") || "none"),
      "Cloud Call: " + Boolean(summary.callsCloudModel),
    ].join("\\n");
  } catch {
    longTermMemorySchemaReady.textContent = "false";
    longTermMemorySchemaFields.textContent = "0";
    longTermMemorySchemaCloud.textContent = "false";
    longTermMemorySchemaJson.textContent = "Unable to read long-term memory schema.";
  }
}

async function refreshLongTermMemoryProposal() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/long-term-memory/proposal\`);
    const summary = data.summary ?? {};
    longTermMemoryProposalReady.textContent = String(Boolean(summary.ready));
    longTermMemoryProposalType.textContent = summary.memoryType ?? "unknown";
    longTermMemoryProposalBulk.textContent = String(Boolean(summary.bulkImport));
    longTermMemoryProposalJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-long-term-memory-proposal-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Proposal: " + (data.proposal?.id ?? "unknown"),
      "Type: " + (summary.memoryType ?? "unknown"),
      "Source: " + (data.proposal?.sourceRegistry ?? "unknown"),
    ].join("\\n");
  } catch {
    longTermMemoryProposalReady.textContent = "false";
    longTermMemoryProposalType.textContent = "unknown";
    longTermMemoryProposalBulk.textContent = "false";
    longTermMemoryProposalJson.textContent = "Unable to read long-term memory proposal.";
  }
}

async function refreshLongTermMemoryWriteRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/long-term-memory/write-route-review\`);
    const summary = data.summary ?? {};
    longTermMemoryRouteReady.textContent = String(Boolean(summary.ready));
    longTermMemoryRouteSelected.textContent = summary.selectedSlice ?? "unknown";
    longTermMemoryRouteWrites.textContent = String(Boolean(summary.writesMemory));
    longTermMemoryRouteJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-long-term-memory-write-route-review-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Selected: " + (summary.selectedSlice ?? "unknown"),
      "Can Append After Approval: " + Boolean(data.decision?.canAppendAfterApproval),
      "Writes Now: " + Boolean(summary.writesMemory),
    ].join("\\n");
  } catch {
    longTermMemoryRouteReady.textContent = "false";
    longTermMemoryRouteSelected.textContent = "unknown";
    longTermMemoryRouteWrites.textContent = "false";
    longTermMemoryRouteJson.textContent = "Unable to read long-term memory write route review.";
  }
}

async function refreshLongTermMemoryWriteTask() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/long-term-memory/write-route-review\`);
    const summary = data.summary ?? {};
    longTermMemoryTaskReady.textContent = String(Boolean(summary.ready));
    longTermMemoryTaskCreates.textContent = "true";
    longTermMemoryTaskApproval.textContent = data.decision?.canCreateTask === true ? "required" : "blocked";
    longTermMemoryTaskJson.textContent = [
      "Registry: openclaw-long-term-memory-write-task-v0",
      "Route: " + (data.registry ?? "openclaw-long-term-memory-write-route-review-v0"),
      "Ready: " + Boolean(summary.ready),
      "Creates Task: true",
      "Approval: required before JSONL append",
    ].join("\\n");
  } catch {
    longTermMemoryTaskReady.textContent = "false";
    longTermMemoryTaskCreates.textContent = "false";
    longTermMemoryTaskApproval.textContent = "unknown";
    longTermMemoryTaskJson.textContent = "Unable to read long-term memory write task boundary.";
  }
}

async function refreshLongTermMemoryApprovedWrite() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/long-term-memory/readback\`);
    const summary = data.summary ?? {};
    longTermMemoryApprovedRecords.textContent = String(summary.recordCount ?? 0);
    longTermMemoryApprovedLatest.textContent = summary.latestRecordId ?? "none";
    longTermMemoryApprovedCloud.textContent = String(Boolean(summary.callsCloudModel));
    longTermMemoryApprovedJson.textContent = [
      "Registry: openclaw-long-term-memory-approved-write-v0",
      "Readback: " + (data.registry ?? "openclaw-long-term-memory-readback-v0"),
      "Records: " + (summary.recordCount ?? 0),
      "Latest: " + (summary.latestRecordId ?? "none"),
      "Cloud Call: " + Boolean(summary.callsCloudModel),
    ].join("\\n");
  } catch {
    longTermMemoryApprovedRecords.textContent = "0";
    longTermMemoryApprovedLatest.textContent = "none";
    longTermMemoryApprovedCloud.textContent = "false";
    longTermMemoryApprovedJson.textContent = "No approved long-term memory write evidence yet.";
  }
}

async function refreshLongTermMemoryReadback() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/long-term-memory/readback\`);
    const summary = data.summary ?? {};
    longTermMemoryReadbackReady.textContent = String(Boolean(summary.ready));
    longTermMemoryReadbackRecords.textContent = String(summary.recordCount ?? 0);
    longTermMemoryReadbackHash.textContent = summary.latestContentHash ?? "none";
    longTermMemoryReadbackJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-long-term-memory-readback-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " records=" + (summary.recordCount ?? 0),
      "Latest: " + (summary.latestRecordId ?? "none"),
      "Hash: " + (summary.latestContentHash ?? "none"),
    ].join("\\n");
  } catch {
    longTermMemoryReadbackReady.textContent = "false";
    longTermMemoryReadbackRecords.textContent = "0";
    longTermMemoryReadbackHash.textContent = "none";
    longTermMemoryReadbackJson.textContent = "Unable to read long-term memory readback.";
  }
}

async function refreshLongTermMemoryExit() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/long-term-memory/exit\`);
    const summary = data.summary ?? {};
    longTermMemoryExitComplete.textContent = String(Boolean(summary.complete));
    longTermMemoryExitPercent.textContent = String(summary.completionPercent ?? 0);
    longTermMemoryExitNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-context-review";
    longTermMemoryExitJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-long-term-memory-exit-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Complete: " + Boolean(summary.complete) + " percent=" + (summary.completionPercent ?? 0),
      "Records: " + (summary.recordCount ?? 0),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-context-review"),
    ].join("\\n");
  } catch {
    longTermMemoryExitComplete.textContent = "false";
    longTermMemoryExitPercent.textContent = "0";
    longTermMemoryExitNext.textContent = "openclaw-cloud-consciousness-context-review";
    longTermMemoryExitJson.textContent = "Unable to read long-term memory exit gate.";
  }
}

async function refreshCloudConsciousnessContextReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/context-review\`);
    const summary = data.summary ?? {};
    cloudContextReviewReady.textContent = String(Boolean(summary.ready));
    cloudContextReviewCall.textContent = String(Boolean(summary.callsCloudModel));
    cloudContextReviewNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-envelope-schema";
    cloudContextReviewJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-context-review-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Theme: " + (data.whitepaperAlignment?.phaseTheme ?? "Prepare the first cloud-consciousness context without transmitting it."),
      "Cloud Call: " + Boolean(summary.callsCloudModel),
      "Next: " + (data.next?.recommendedSlice ?? "unknown"),
    ].join("\\n");
  } catch {
    cloudContextReviewReady.textContent = "false";
    cloudContextReviewCall.textContent = "false";
    cloudContextReviewNext.textContent = "openclaw-cloud-consciousness-envelope-schema";
    cloudContextReviewJson.textContent = "Unable to read cloud consciousness context review.";
  }
}

async function refreshCloudConsciousnessEnvelopeSchema() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/envelope-schema\`);
    const summary = data.summary ?? {};
    cloudEnvelopeSchemaReady.textContent = String(Boolean(summary.ready));
    cloudEnvelopeSchemaFields.textContent = String(summary.requiredFieldCount ?? 0);
    cloudEnvelopeSchemaTransmission.textContent = String(Boolean(summary.transmitsExternally));
    cloudEnvelopeSchemaJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-envelope-schema-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Schema: " + (data.schema?.id ?? "unknown"),
      "Fields: " + ((data.schema?.requiredFields ?? []).join(", ") || "none"),
      "Transmission: " + Boolean(summary.transmitsExternally),
    ].join("\\n");
  } catch {
    cloudEnvelopeSchemaReady.textContent = "false";
    cloudEnvelopeSchemaFields.textContent = "0";
    cloudEnvelopeSchemaTransmission.textContent = "false";
    cloudEnvelopeSchemaJson.textContent = "Unable to read cloud consciousness envelope schema.";
  }
}

async function refreshCloudConsciousnessContextPackage() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/context-package\`);
    const summary = data.summary ?? {};
    cloudContextPackageReady.textContent = String(Boolean(summary.ready));
    cloudContextPackageMemory.textContent = String(summary.memoryRecordCount ?? 0);
    cloudContextPackageSecrets.textContent = String(Boolean(summary.includesSecrets));
    cloudContextPackageJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-context-package-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Package: " + (data.package?.id ?? "unknown"),
      "Memory Records: " + (summary.memoryRecordCount ?? 0),
      "Transmitted: " + Boolean(summary.transmitsExternally),
    ].join("\\n");
  } catch {
    cloudContextPackageReady.textContent = "false";
    cloudContextPackageMemory.textContent = "0";
    cloudContextPackageSecrets.textContent = "false";
    cloudContextPackageJson.textContent = "Unable to read cloud consciousness context package.";
  }
}

async function refreshCloudConsciousnessRedactionReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/redaction-review\`);
    const summary = data.summary ?? {};
    cloudRedactionReady.textContent = String(Boolean(summary.ready));
    cloudRedactionRejected.textContent = String(summary.rejectedContentCount ?? 0);
    cloudRedactionSecrets.textContent = String(Boolean(summary.includesSecrets));
    cloudRedactionJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-redaction-review-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Policy: " + (data.redaction?.policy ?? "unknown"),
      "Rejected: " + ((data.redaction?.rejectedContent ?? []).join(", ") || "none"),
      "Secrets: " + Boolean(summary.includesSecrets),
    ].join("\\n");
  } catch {
    cloudRedactionReady.textContent = "false";
    cloudRedactionRejected.textContent = "0";
    cloudRedactionSecrets.textContent = "false";
    cloudRedactionJson.textContent = "Unable to read cloud consciousness redaction review.";
  }
}

async function refreshCloudConsciousnessTransmissionRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/transmission-route-review\`);
    const summary = data.summary ?? {};
    cloudRouteReady.textContent = String(Boolean(summary.ready));
    cloudRouteSelected.textContent = summary.selectedSlice ?? "unknown";
    cloudRouteCall.textContent = String(Boolean(summary.callsCloudModel));
    cloudRouteJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-transmission-route-review-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Selected: " + (summary.selectedSlice ?? "unknown"),
      "Deferred: " + (summary.deferredSlice ?? "unknown"),
      "Cloud Call: " + Boolean(summary.callsCloudModel),
    ].join("\\n");
  } catch {
    cloudRouteReady.textContent = "false";
    cloudRouteSelected.textContent = "unknown";
    cloudRouteCall.textContent = "false";
    cloudRouteJson.textContent = "Unable to read cloud consciousness transmission route review.";
  }
}

async function refreshCloudConsciousnessHandoffTask() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/transmission-route-review\`);
    const summary = data.summary ?? {};
    cloudHandoffTaskReady.textContent = String(Boolean(summary.ready));
    cloudHandoffTaskCreates.textContent = "true";
    cloudHandoffTaskApproval.textContent = data.decision?.canCreateTask === true ? "required" : "blocked";
    cloudHandoffTaskJson.textContent = [
      "Registry: openclaw-cloud-consciousness-handoff-task-v0",
      "Route: " + (data.registry ?? "openclaw-cloud-consciousness-transmission-route-review-v0"),
      "Ready: " + Boolean(summary.ready),
      "Creates Task: true",
      "Provider Call: deferred",
    ].join("\\n");
  } catch {
    cloudHandoffTaskReady.textContent = "false";
    cloudHandoffTaskCreates.textContent = "false";
    cloudHandoffTaskApproval.textContent = "unknown";
    cloudHandoffTaskJson.textContent = "Unable to read cloud consciousness handoff task boundary.";
  }
}

async function refreshCloudConsciousnessApprovedHandoff() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/handoff-readback\`);
    const summary = data.summary ?? {};
    cloudApprovedHandoffRecords.textContent = String(summary.recordCount ?? 0);
    cloudApprovedHandoffLatest.textContent = summary.latestRecordId ?? "none";
    cloudApprovedHandoffTransmitted.textContent = String(Boolean(summary.transmitsExternally));
    cloudApprovedHandoffJson.textContent = [
      "Registry: openclaw-cloud-consciousness-approved-handoff-v0",
      "Readback: " + (data.registry ?? "openclaw-cloud-consciousness-handoff-readback-v0"),
      "Records: " + (summary.recordCount ?? 0),
      "Latest: " + (summary.latestRecordId ?? "none"),
      "Transmitted: " + Boolean(summary.transmitsExternally),
    ].join("\\n");
  } catch {
    cloudApprovedHandoffRecords.textContent = "0";
    cloudApprovedHandoffLatest.textContent = "none";
    cloudApprovedHandoffTransmitted.textContent = "false";
    cloudApprovedHandoffJson.textContent = "No approved local handoff evidence yet.";
  }
}

async function refreshCloudConsciousnessHandoffReadback() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/handoff-readback\`);
    const summary = data.summary ?? {};
    cloudHandoffReadbackReady.textContent = String(Boolean(summary.ready));
    cloudHandoffReadbackRecords.textContent = String(summary.recordCount ?? 0);
    cloudHandoffReadbackHash.textContent = summary.latestContentHash ?? "none";
    cloudHandoffReadbackJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-handoff-readback-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " records=" + (summary.recordCount ?? 0),
      "Latest: " + (summary.latestRecordId ?? "none"),
      "Hash: " + (summary.latestContentHash ?? "none"),
    ].join("\\n");
  } catch {
    cloudHandoffReadbackReady.textContent = "false";
    cloudHandoffReadbackRecords.textContent = "0";
    cloudHandoffReadbackHash.textContent = "none";
    cloudHandoffReadbackJson.textContent = "Unable to read cloud consciousness handoff readback.";
  }
}

async function refreshCloudConsciousnessExit() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/exit\`);
    const summary = data.summary ?? {};
    cloudExitComplete.textContent = String(Boolean(summary.complete));
    cloudExitPercent.textContent = String(summary.completionPercent ?? 0);
    cloudExitNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-provider-adapter-plan";
    cloudExitJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-exit-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Complete: " + Boolean(summary.complete) + " percent=" + (summary.completionPercent ?? 0),
      "Records: " + (summary.recordCount ?? 0),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-provider-adapter-plan"),
    ].join("\\n");
  } catch {
    cloudExitComplete.textContent = "false";
    cloudExitPercent.textContent = "0";
    cloudExitNext.textContent = "openclaw-cloud-consciousness-provider-adapter-plan";
    cloudExitJson.textContent = "Unable to read cloud consciousness exit gate.";
  }
}

async function refreshCloudConsciousnessProviderAdapterPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/provider-adapter-plan\`);
    const summary = data.summary ?? {};
    cloudProviderPlanReady.textContent = String(Boolean(summary.ready));
    cloudProviderPlanCall.textContent = String(Boolean(summary.callsCloudModel));
    cloudProviderPlanNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-provider-contract";
    cloudProviderPlanJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-provider-adapter-plan-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Theme: " + (data.whitepaperAlignment?.phaseTheme ?? "Define and dry-run a cloud-consciousness provider adapter without external transmission."),
      "Cloud Call: " + Boolean(summary.callsCloudModel),
      "Next: " + (data.next?.recommendedSlice ?? "unknown"),
    ].join("\\n");
  } catch {
    cloudProviderPlanReady.textContent = "false";
    cloudProviderPlanCall.textContent = "false";
    cloudProviderPlanNext.textContent = "openclaw-cloud-consciousness-provider-contract";
    cloudProviderPlanJson.textContent = "Unable to read cloud consciousness provider adapter plan.";
  }
}

async function refreshCloudConsciousnessProviderContract() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/provider-contract\`);
    const summary = data.summary ?? {};
    cloudProviderContractReady.textContent = String(Boolean(summary.ready));
    cloudProviderContractMethods.textContent = String(summary.requiredMethodCount ?? 0);
    cloudProviderContractSdk.textContent = String(Boolean(summary.providerSdkLoaded));
    cloudProviderContractJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-provider-contract-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Contract: " + (data.contract?.id ?? "unknown"),
      "Methods: " + ((data.contract?.requiredMethods ?? []).join(", ") || "none"),
      "SDK Loaded: " + Boolean(summary.providerSdkLoaded),
    ].join("\\n");
  } catch {
    cloudProviderContractReady.textContent = "false";
    cloudProviderContractMethods.textContent = "0";
    cloudProviderContractSdk.textContent = "false";
    cloudProviderContractJson.textContent = "Unable to read cloud consciousness provider contract.";
  }
}

async function refreshCloudConsciousnessProviderRequestEnvelope() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/provider-request-envelope\`);
    const summary = data.summary ?? {};
    cloudProviderEnvelopeReady.textContent = String(Boolean(summary.ready));
    cloudProviderEnvelopeSource.textContent = summary.sourceHandoffRecordId ?? "none";
    cloudProviderEnvelopeSecrets.textContent = String(Boolean(summary.providerCredentialIncluded));
    cloudProviderEnvelopeJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-provider-request-envelope-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Envelope: " + (data.envelope?.id ?? "unknown"),
      "Source: " + (summary.sourceHandoffRecordId ?? "none"),
      "Transmitted: " + Boolean(summary.transmitsExternally),
    ].join("\\n");
  } catch {
    cloudProviderEnvelopeReady.textContent = "false";
    cloudProviderEnvelopeSource.textContent = "none";
    cloudProviderEnvelopeSecrets.textContent = "false";
    cloudProviderEnvelopeJson.textContent = "Unable to read cloud consciousness provider request envelope.";
  }
}

async function refreshCloudConsciousnessProviderDryRunRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/provider-dry-run-route-review\`);
    const summary = data.summary ?? {};
    cloudProviderRouteReady.textContent = String(Boolean(summary.ready));
    cloudProviderRouteSelected.textContent = summary.selectedSlice ?? "unknown";
    cloudProviderRouteCall.textContent = String(Boolean(summary.callsCloudModel));
    cloudProviderRouteJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-provider-dry-run-route-review-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Selected: " + (summary.selectedSlice ?? "unknown"),
      "Deferred: " + (summary.deferredSlice ?? "unknown"),
      "Cloud Call: " + Boolean(summary.callsCloudModel),
    ].join("\\n");
  } catch {
    cloudProviderRouteReady.textContent = "false";
    cloudProviderRouteSelected.textContent = "unknown";
    cloudProviderRouteCall.textContent = "false";
    cloudProviderRouteJson.textContent = "Unable to read cloud consciousness provider dry-run route review.";
  }
}

async function refreshCloudConsciousnessProviderDryRunTask() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/provider-dry-run-route-review\`);
    const summary = data.summary ?? {};
    cloudProviderTaskReady.textContent = String(Boolean(summary.ready));
    cloudProviderTaskCreates.textContent = "true";
    cloudProviderTaskApproval.textContent = data.decision?.canCreateTask === true ? "required" : "blocked";
    cloudProviderTaskJson.textContent = [
      "Registry: openclaw-cloud-consciousness-provider-dry-run-task-v0",
      "Route: " + (data.registry ?? "openclaw-cloud-consciousness-provider-dry-run-route-review-v0"),
      "Ready: " + Boolean(summary.ready),
      "Creates Task: true",
      "Provider Call: dry-run only",
    ].join("\\n");
  } catch {
    cloudProviderTaskReady.textContent = "false";
    cloudProviderTaskCreates.textContent = "false";
    cloudProviderTaskApproval.textContent = "unknown";
    cloudProviderTaskJson.textContent = "Unable to read cloud consciousness provider dry-run task boundary.";
  }
}

async function refreshCloudConsciousnessApprovedProviderDryRun() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/provider-dry-run-readback\`);
    const summary = data.summary ?? {};
    cloudProviderApprovedRecords.textContent = String(summary.recordCount ?? 0);
    cloudProviderApprovedLatest.textContent = summary.latestRecordId ?? "none";
    cloudProviderApprovedTransmitted.textContent = String(Boolean(summary.transmitsExternally));
    cloudProviderApprovedJson.textContent = [
      "Registry: openclaw-cloud-consciousness-approved-provider-dry-run-v0",
      "Readback: " + (data.registry ?? "openclaw-cloud-consciousness-provider-dry-run-readback-v0"),
      "Records: " + (summary.recordCount ?? 0),
      "Latest: " + (summary.latestRecordId ?? "none"),
      "Transmitted: " + Boolean(summary.transmitsExternally),
    ].join("\\n");
  } catch {
    cloudProviderApprovedRecords.textContent = "0";
    cloudProviderApprovedLatest.textContent = "none";
    cloudProviderApprovedTransmitted.textContent = "false";
    cloudProviderApprovedJson.textContent = "No approved provider dry-run evidence yet.";
  }
}

async function refreshCloudConsciousnessProviderDryRunReadback() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/provider-dry-run-readback\`);
    const summary = data.summary ?? {};
    cloudProviderReadbackReady.textContent = String(Boolean(summary.ready));
    cloudProviderReadbackRecords.textContent = String(summary.recordCount ?? 0);
    cloudProviderReadbackHash.textContent = summary.latestContentHash ?? "none";
    cloudProviderReadbackJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-provider-dry-run-readback-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " records=" + (summary.recordCount ?? 0),
      "Latest: " + (summary.latestRecordId ?? "none"),
      "Hash: " + (summary.latestContentHash ?? "none"),
    ].join("\\n");
  } catch {
    cloudProviderReadbackReady.textContent = "false";
    cloudProviderReadbackRecords.textContent = "0";
    cloudProviderReadbackHash.textContent = "none";
    cloudProviderReadbackJson.textContent = "Unable to read cloud consciousness provider dry-run readback.";
  }
}

async function refreshCloudConsciousnessProviderAdapterExit() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/provider-adapter-exit\`);
    const summary = data.summary ?? {};
    cloudProviderExitComplete.textContent = String(Boolean(summary.complete));
    cloudProviderExitPercent.textContent = String(summary.completionPercent ?? 0);
    cloudProviderExitNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-real-provider-call-plan";
    cloudProviderExitJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-provider-adapter-exit-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Complete: " + Boolean(summary.complete) + " percent=" + (summary.completionPercent ?? 0),
      "Records: " + (summary.recordCount ?? 0),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-real-provider-call-plan"),
    ].join("\\n");
  } catch {
    cloudProviderExitComplete.textContent = "false";
    cloudProviderExitPercent.textContent = "0";
    cloudProviderExitNext.textContent = "openclaw-cloud-consciousness-real-provider-call-plan";
    cloudProviderExitJson.textContent = "Unable to read cloud consciousness provider adapter exit gate.";
  }
}

async function refreshCloudConsciousnessRealProviderCallPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/real-provider-call-plan\`);
    const summary = data.summary ?? {};
    cloudRealProviderPlanReady.textContent = String(Boolean(summary.ready));
    cloudRealProviderPlanCall.textContent = String(Boolean(summary.callsCloudModel));
    cloudRealProviderPlanNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-provider-egress-contract";
    cloudRealProviderPlanJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-real-provider-call-plan-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Theme: " + (data.whitepaperAlignment?.phaseTheme ?? "Prepare the real provider-call path with a local response rehearsal, without external transmission."),
      "Cloud Call: " + Boolean(summary.callsCloudModel),
      "Next: " + (data.next?.recommendedSlice ?? "unknown"),
    ].join("\\n");
  } catch {
    cloudRealProviderPlanReady.textContent = "false";
    cloudRealProviderPlanCall.textContent = "false";
    cloudRealProviderPlanNext.textContent = "openclaw-cloud-consciousness-provider-egress-contract";
    cloudRealProviderPlanJson.textContent = "Unable to read real provider call plan.";
  }
}

async function refreshCloudConsciousnessProviderEgressContract() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/provider-egress-contract\`);
    const summary = data.summary ?? {};
    cloudEgressContractReady.textContent = String(Boolean(summary.ready));
    cloudEgressContractPreflights.textContent = String(summary.requiredPreflightCount ?? 0);
    cloudEgressContractTransmits.textContent = String(Boolean(summary.transmitsExternally));
    cloudEgressContractJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-provider-egress-contract-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Contract: " + (data.contract?.id ?? "unknown"),
      "Required: " + ((data.contract?.requiredBeforeLiveCall ?? []).join(", ") || "none"),
      "Transmits: " + Boolean(summary.transmitsExternally),
    ].join("\\n");
  } catch {
    cloudEgressContractReady.textContent = "false";
    cloudEgressContractPreflights.textContent = "0";
    cloudEgressContractTransmits.textContent = "false";
    cloudEgressContractJson.textContent = "Unable to read provider egress contract.";
  }
}

async function refreshCloudConsciousnessProviderCredentialPreflight() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/provider-credential-preflight\`);
    const summary = data.summary ?? {};
    cloudCredentialPreflightReady.textContent = String(Boolean(summary.ready));
    cloudCredentialPreflightRead.textContent = String(Boolean(summary.providerCredentialRead));
    cloudCredentialPreflightLive.textContent = String(Boolean(data.preflight?.liveCallPermitted));
    cloudCredentialPreflightJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-provider-credential-preflight-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Endpoint Env: " + (data.preflight?.endpointEnv ?? "unknown"),
      "Credential Env: " + (data.preflight?.credentialEnv ?? "unknown"),
      "Credential Read: " + Boolean(summary.providerCredentialRead),
    ].join("\\n");
  } catch {
    cloudCredentialPreflightReady.textContent = "false";
    cloudCredentialPreflightRead.textContent = "false";
    cloudCredentialPreflightLive.textContent = "false";
    cloudCredentialPreflightJson.textContent = "Unable to read provider credential preflight.";
  }
}

async function refreshCloudConsciousnessProviderRequestRedactionReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/provider-request-redaction-review\`);
    const summary = data.summary ?? {};
    cloudRequestRedactionReady.textContent = String(Boolean(summary.ready));
    cloudRequestRedactionRejected.textContent = String(summary.rejectedContentCount ?? 0);
    cloudRequestRedactionSecrets.textContent = String(Boolean(summary.includesSecrets));
    cloudRequestRedactionJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-provider-request-redaction-review-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Policy: " + (data.redaction?.policy ?? "unknown"),
      "Rejected: " + ((data.redaction?.rejectedContent ?? []).join(", ") || "none"),
      "Secrets: " + Boolean(summary.includesSecrets),
    ].join("\\n");
  } catch {
    cloudRequestRedactionReady.textContent = "false";
    cloudRequestRedactionRejected.textContent = "0";
    cloudRequestRedactionSecrets.textContent = "false";
    cloudRequestRedactionJson.textContent = "Unable to read provider request redaction review.";
  }
}

async function refreshCloudConsciousnessRealProviderCallRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/real-provider-call-route-review\`);
    const summary = data.summary ?? {};
    cloudRealProviderRouteReady.textContent = String(Boolean(summary.ready));
    cloudRealProviderRouteSelected.textContent = summary.selectedSlice ?? "unknown";
    cloudRealProviderRouteCall.textContent = String(Boolean(summary.callsCloudModel));
    cloudRealProviderRouteJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-real-provider-call-route-review-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Selected: " + (summary.selectedSlice ?? "unknown"),
      "Deferred: " + (summary.deferredSlice ?? "unknown"),
      "Cloud Call: " + Boolean(summary.callsCloudModel),
    ].join("\\n");
  } catch {
    cloudRealProviderRouteReady.textContent = "false";
    cloudRealProviderRouteSelected.textContent = "unknown";
    cloudRealProviderRouteCall.textContent = "false";
    cloudRealProviderRouteJson.textContent = "Unable to read real provider call route review.";
  }
}

async function refreshCloudConsciousnessRealProviderCallTask() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/real-provider-call-route-review\`);
    const summary = data.summary ?? {};
    cloudRealProviderTaskReady.textContent = String(Boolean(summary.ready));
    cloudRealProviderTaskCreates.textContent = "true";
    cloudRealProviderTaskApproval.textContent = data.decision?.canCreateTask === true ? "required" : "blocked";
    cloudRealProviderTaskJson.textContent = [
      "Registry: openclaw-cloud-consciousness-real-provider-call-task-v0",
      "Route: " + (data.registry ?? "openclaw-cloud-consciousness-real-provider-call-route-review-v0"),
      "Ready: " + Boolean(summary.ready),
      "Creates Task: true",
      "Provider Call: rehearsal only",
    ].join("\\n");
  } catch {
    cloudRealProviderTaskReady.textContent = "false";
    cloudRealProviderTaskCreates.textContent = "false";
    cloudRealProviderTaskApproval.textContent = "unknown";
    cloudRealProviderTaskJson.textContent = "Unable to read real provider call task boundary.";
  }
}

async function refreshCloudConsciousnessApprovedProviderCallRehearsal() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/provider-response-readback\`);
    const summary = data.summary ?? {};
    cloudCallRehearsalRecords.textContent = String(summary.recordCount ?? 0);
    cloudCallRehearsalLatest.textContent = summary.latestRecordId ?? "none";
    cloudCallRehearsalTransmitted.textContent = String(Boolean(summary.transmitsExternally));
    cloudCallRehearsalJson.textContent = [
      "Registry: openclaw-cloud-consciousness-approved-provider-call-rehearsal-v0",
      "Readback: " + (data.registry ?? "openclaw-cloud-consciousness-provider-response-readback-v0"),
      "Records: " + (summary.recordCount ?? 0),
      "Latest: " + (summary.latestRecordId ?? "none"),
      "Transmitted: " + Boolean(summary.transmitsExternally),
    ].join("\\n");
  } catch {
    cloudCallRehearsalRecords.textContent = "0";
    cloudCallRehearsalLatest.textContent = "none";
    cloudCallRehearsalTransmitted.textContent = "false";
    cloudCallRehearsalJson.textContent = "No approved provider call rehearsal evidence yet.";
  }
}

async function refreshCloudConsciousnessProviderResponseReadback() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/provider-response-readback\`);
    const summary = data.summary ?? {};
    cloudResponseReadbackReady.textContent = String(Boolean(summary.ready));
    cloudResponseReadbackRecords.textContent = String(summary.recordCount ?? 0);
    cloudResponseReadbackHash.textContent = summary.latestContentHash ?? "none";
    cloudResponseReadbackJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-provider-response-readback-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " records=" + (summary.recordCount ?? 0),
      "Latest: " + (summary.latestRecordId ?? "none"),
      "Hash: " + (summary.latestContentHash ?? "none"),
    ].join("\\n");
  } catch {
    cloudResponseReadbackReady.textContent = "false";
    cloudResponseReadbackRecords.textContent = "0";
    cloudResponseReadbackHash.textContent = "none";
    cloudResponseReadbackJson.textContent = "Unable to read provider response readback.";
  }
}

async function refreshCloudConsciousnessRealProviderCallExit() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/real-provider-call-exit\`);
    const summary = data.summary ?? {};
    cloudRealProviderExitComplete.textContent = String(Boolean(summary.complete));
    cloudRealProviderExitPercent.textContent = String(summary.completionPercent ?? 0);
    cloudRealProviderExitNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-call-runbook";
    cloudRealProviderExitJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-real-provider-call-exit-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Complete: " + Boolean(summary.complete) + " percent=" + (summary.completionPercent ?? 0),
      "Records: " + (summary.recordCount ?? 0),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-call-runbook"),
    ].join("\\n");
  } catch {
    cloudRealProviderExitComplete.textContent = "false";
    cloudRealProviderExitPercent.textContent = "0";
    cloudRealProviderExitNext.textContent = "openclaw-cloud-consciousness-live-provider-call-runbook";
    cloudRealProviderExitJson.textContent = "Unable to read real provider call exit gate.";
  }
}

async function refreshCloudConsciousnessLiveProviderCallRunbook() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-call-runbook\`);
    const summary = data.summary ?? {};
    cloudLiveRunbookReady.textContent = String(Boolean(summary.ready));
    cloudLiveRunbookEnabled.textContent = String(Boolean(summary.liveProviderCallEnabled));
    cloudLiveRunbookNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-operator-checklist";
    cloudLiveRunbookJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-call-runbook-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Theme: " + (data.whitepaperAlignment?.phaseTheme ?? "Prepare the live provider-call runbook without enabling external transmission."),
      "Live Enabled: " + Boolean(summary.liveProviderCallEnabled),
      "Next: " + (data.next?.recommendedSlice ?? "unknown"),
    ].join("\\n");
  } catch {
    cloudLiveRunbookReady.textContent = "false";
    cloudLiveRunbookEnabled.textContent = "false";
    cloudLiveRunbookNext.textContent = "openclaw-cloud-consciousness-live-provider-operator-checklist";
    cloudLiveRunbookJson.textContent = "Unable to read live provider call runbook.";
  }
}

async function refreshCloudConsciousnessLiveProviderOperatorChecklist() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-operator-checklist\`);
    const summary = data.summary ?? {};
    cloudLiveChecklistReady.textContent = String(Boolean(summary.ready));
    cloudLiveChecklistItems.textContent = String(summary.checklistItemCount ?? 0);
    cloudLiveChecklistTransmits.textContent = String(Boolean(summary.transmitsExternally));
    cloudLiveChecklistJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-operator-checklist-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Items: " + ((data.checklist?.operatorMustConfirm ?? []).join(", ") || "none"),
      "Transmits: " + Boolean(summary.transmitsExternally),
    ].join("\\n");
  } catch {
    cloudLiveChecklistReady.textContent = "false";
    cloudLiveChecklistItems.textContent = "0";
    cloudLiveChecklistTransmits.textContent = "false";
    cloudLiveChecklistJson.textContent = "Unable to read live provider operator checklist.";
  }
}

async function refreshCloudConsciousnessLiveProviderEgressTranscriptSchema() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-egress-transcript-schema\`);
    const summary = data.summary ?? {};
    cloudLiveTranscriptReady.textContent = String(Boolean(summary.ready));
    cloudLiveTranscriptFields.textContent = String(summary.requiredFieldCount ?? 0);
    cloudLiveTranscriptStatus.textContent = data.schema?.phase11AllowedStatus ?? "unknown";
    cloudLiveTranscriptJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-egress-transcript-schema-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Schema: " + (data.schema?.id ?? "unknown"),
      "Fields: " + ((data.schema?.requiredFields ?? []).join(", ") || "none"),
      "Allowed Status: " + (data.schema?.phase11AllowedStatus ?? "unknown"),
    ].join("\\n");
  } catch {
    cloudLiveTranscriptReady.textContent = "false";
    cloudLiveTranscriptFields.textContent = "0";
    cloudLiveTranscriptStatus.textContent = "unknown";
    cloudLiveTranscriptJson.textContent = "Unable to read live provider egress transcript schema.";
  }
}

async function refreshCloudConsciousnessLiveProviderFinalAuthorizationReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-final-authorization-review\`);
    const summary = data.summary ?? {};
    cloudLiveAuthReady.textContent = String(Boolean(summary.ready));
    cloudLiveAuthEnabled.textContent = String(Boolean(summary.liveProviderCallEnabled));
    cloudLiveAuthCredential.textContent = String(Boolean(summary.providerCredentialRead));
    cloudLiveAuthJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-final-authorization-review-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Authorization: " + (data.authorization?.status ?? "unknown"),
      "Response: " + (data.authorization?.reviewedResponseRecordId ?? "none"),
      "Live Enabled: " + Boolean(summary.liveProviderCallEnabled),
    ].join("\\n");
  } catch {
    cloudLiveAuthReady.textContent = "false";
    cloudLiveAuthEnabled.textContent = "false";
    cloudLiveAuthCredential.textContent = "false";
    cloudLiveAuthJson.textContent = "Unable to read live provider final authorization review.";
  }
}

async function refreshCloudConsciousnessLiveProviderRunbookRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-runbook-route-review\`);
    const summary = data.summary ?? {};
    cloudLiveRouteReady.textContent = String(Boolean(summary.ready));
    cloudLiveRouteSelected.textContent = summary.selectedSlice ?? "unknown";
    cloudLiveRouteCall.textContent = String(Boolean(summary.callsCloudModel));
    cloudLiveRouteJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-runbook-route-review-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Selected: " + (summary.selectedSlice ?? "unknown"),
      "Deferred: " + (summary.deferredSlice ?? "unknown"),
      "Cloud Call: " + Boolean(summary.callsCloudModel),
    ].join("\\n");
  } catch {
    cloudLiveRouteReady.textContent = "false";
    cloudLiveRouteSelected.textContent = "unknown";
    cloudLiveRouteCall.textContent = "false";
    cloudLiveRouteJson.textContent = "Unable to read live provider runbook route review.";
  }
}

async function refreshCloudConsciousnessLiveProviderRunbookTask() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-runbook-route-review\`);
    const summary = data.summary ?? {};
    cloudLiveTaskReady.textContent = String(Boolean(summary.ready));
    cloudLiveTaskCreates.textContent = "true";
    cloudLiveTaskApproval.textContent = data.decision?.canCreateTask === true ? "required" : "blocked";
    cloudLiveTaskJson.textContent = [
      "Registry: openclaw-cloud-consciousness-live-provider-call-runbook-task-v0",
      "Route: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-runbook-route-review-v0"),
      "Ready: " + Boolean(summary.ready),
      "Creates Task: true",
      "Provider Call: runbook only",
    ].join("\\n");
  } catch {
    cloudLiveTaskReady.textContent = "false";
    cloudLiveTaskCreates.textContent = "false";
    cloudLiveTaskApproval.textContent = "unknown";
    cloudLiveTaskJson.textContent = "Unable to read live provider runbook task boundary.";
  }
}

async function refreshCloudConsciousnessApprovedLiveProviderRunbook() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-runbook-readback\`);
    const summary = data.summary ?? {};
    cloudLiveApprovedRecords.textContent = String(summary.recordCount ?? 0);
    cloudLiveApprovedLatest.textContent = summary.latestRecordId ?? "none";
    cloudLiveApprovedEnabled.textContent = String(Boolean(summary.liveProviderCallEnabled));
    cloudLiveApprovedJson.textContent = [
      "Registry: openclaw-cloud-consciousness-approved-live-provider-runbook-v0",
      "Readback: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-runbook-readback-v0"),
      "Records: " + (summary.recordCount ?? 0),
      "Latest: " + (summary.latestRecordId ?? "none"),
      "Live Enabled: " + Boolean(summary.liveProviderCallEnabled),
    ].join("\\n");
  } catch {
    cloudLiveApprovedRecords.textContent = "0";
    cloudLiveApprovedLatest.textContent = "none";
    cloudLiveApprovedEnabled.textContent = "false";
    cloudLiveApprovedJson.textContent = "No approved live provider runbook evidence yet.";
  }
}

async function refreshCloudConsciousnessLiveProviderRunbookReadback() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-runbook-readback\`);
    const summary = data.summary ?? {};
    cloudLiveReadbackReady.textContent = String(Boolean(summary.ready));
    cloudLiveReadbackRecords.textContent = String(summary.recordCount ?? 0);
    cloudLiveReadbackHash.textContent = summary.latestContentHash ?? "none";
    cloudLiveReadbackJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-runbook-readback-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " records=" + (summary.recordCount ?? 0),
      "Latest: " + (summary.latestRecordId ?? "none"),
      "Hash: " + (summary.latestContentHash ?? "none"),
    ].join("\\n");
  } catch {
    cloudLiveReadbackReady.textContent = "false";
    cloudLiveReadbackRecords.textContent = "0";
    cloudLiveReadbackHash.textContent = "none";
    cloudLiveReadbackJson.textContent = "Unable to read live provider runbook readback.";
  }
}

async function refreshCloudConsciousnessLiveProviderCallRunbookExit() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-call-runbook-exit\`);
    const summary = data.summary ?? {};
    cloudLiveExitComplete.textContent = String(Boolean(summary.complete));
    cloudLiveExitPercent.textContent = String(summary.completionPercent ?? 0);
    cloudLiveExitNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-call-execution-plan";
    cloudLiveExitJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-call-runbook-exit-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Complete: " + Boolean(summary.complete) + " percent=" + (summary.completionPercent ?? 0),
      "Records: " + (summary.recordCount ?? 0),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-call-execution-plan"),
    ].join("\\n");
  } catch {
    cloudLiveExitComplete.textContent = "false";
    cloudLiveExitPercent.textContent = "0";
    cloudLiveExitNext.textContent = "openclaw-cloud-consciousness-live-provider-call-execution-plan";
    cloudLiveExitJson.textContent = "Unable to read live provider call runbook exit gate.";
  }
}

async function refreshCloudConsciousnessLiveProviderCallExecutionPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-call-execution-plan\`);
    const binding = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-endpoint-credential-binding\`).catch(() => null);
    const summary = data.summary ?? {};
    const bindingSummary = binding?.summary ?? {};
    cloudLiveExecPlanReady.textContent = String(Boolean(summary.ready));
    cloudLiveExecPlanEnabled.textContent = String(Boolean(summary.liveProviderCallEnabled));
    cloudLiveExecPlanNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-endpoint-credential-binding";
    cloudLiveExecPlanJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-call-execution-plan-v0"),
      "Binding Registry: " + (binding?.registry ?? "openclaw-cloud-consciousness-live-provider-endpoint-credential-binding-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Live enabled: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint contacted: " + Boolean(bindingSummary.endpointContacted),
      "Credential value read: " + Boolean(bindingSummary.credentialValueRead),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-endpoint-credential-binding"),
    ].join("\\n");
  } catch {
    cloudLiveExecPlanReady.textContent = "false";
    cloudLiveExecPlanEnabled.textContent = "false";
    cloudLiveExecPlanNext.textContent = "openclaw-cloud-consciousness-live-provider-endpoint-credential-binding";
    cloudLiveExecPlanJson.textContent = "Unable to read live provider execution plan.";
  }
}

async function refreshCloudConsciousnessLiveProviderExecutionRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-execution-route-review\`);
    const schema = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-execution-transcript-schema\`).catch(() => null);
    const summary = data.summary ?? {};
    cloudLiveExecRouteReady.textContent = String(Boolean(summary.ready));
    cloudLiveExecRouteSelected.textContent = summary.selectedSlice ?? "none";
    cloudLiveExecRouteCall.textContent = String(Boolean(summary.callsCloudModel));
    cloudLiveExecRouteJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-execution-route-review-v0"),
      "Schema Registry: " + (schema?.registry ?? "openclaw-cloud-consciousness-live-provider-execution-transcript-schema-v0"),
      "Task Registry: openclaw-cloud-consciousness-live-provider-call-execution-plan-task-v0",
      "Task Endpoint: /cloud-consciousness/live-provider-execution-plan-tasks",
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Selected: " + (summary.selectedSlice ?? "none"),
      "Deferred: " + (summary.deferredSlice ?? "none"),
      "Transcript Schema: " + (schema?.schema?.id ?? "openclaw.cloud_consciousness.live_provider.execution_plan_transcript.v0"),
      "Calls cloud: " + Boolean(summary.callsCloudModel),
    ].join("\\n");
  } catch {
    cloudLiveExecRouteReady.textContent = "false";
    cloudLiveExecRouteSelected.textContent = "none";
    cloudLiveExecRouteCall.textContent = "false";
    cloudLiveExecRouteJson.textContent = "Unable to read live provider execution route review.";
  }
}

async function refreshCloudConsciousnessLiveProviderExecutionPlanReadback() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-execution-plan-readback\`);
    const summary = data.summary ?? {};
    cloudLiveExecReadbackReady.textContent = String(Boolean(summary.ready));
    cloudLiveExecReadbackRecords.textContent = String(summary.recordCount ?? 0);
    cloudLiveExecReadbackHash.textContent = summary.latestContentHash ?? "none";
    cloudLiveExecReadbackJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-execution-plan-readback-v0"),
      "Approved Registry: openclaw-cloud-consciousness-approved-live-provider-execution-plan-v0",
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Ready: " + Boolean(summary.ready) + " records=" + (summary.recordCount ?? 0),
      "Latest: " + (summary.latestRecordId ?? "none"),
      "Hash: " + (summary.latestContentHash ?? "none"),
    ].join("\\n");
  } catch {
    cloudLiveExecReadbackReady.textContent = "false";
    cloudLiveExecReadbackRecords.textContent = "0";
    cloudLiveExecReadbackHash.textContent = "none";
    cloudLiveExecReadbackJson.textContent = "Unable to read live provider execution plan readback.";
  }
}

async function refreshCloudConsciousnessLiveProviderCallExecutionPlanExit() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-call-execution-plan-exit\`);
    const summary = data.summary ?? {};
    cloudLiveExecExitComplete.textContent = String(Boolean(summary.complete));
    cloudLiveExecExitPercent.textContent = String(summary.completionPercent ?? 0);
    cloudLiveExecExitNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-plan";
    cloudLiveExecExitJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-call-execution-plan-exit-v0"),
      "Mode: " + (data.mode ?? "unknown") + " status=" + (data.status ?? "unknown"),
      "Complete: " + Boolean(summary.complete) + " percent=" + (summary.completionPercent ?? 0),
      "Records: " + (summary.recordCount ?? 0),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-plan"),
    ].join("\\n");
  } catch {
    cloudLiveExecExitComplete.textContent = "false";
    cloudLiveExecExitPercent.textContent = "0";
    cloudLiveExecExitNext.textContent = "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-plan";
    cloudLiveExecExitJson.textContent = "Unable to read live provider execution plan exit gate.";
  }
}

async function refreshCloudConsciousnessLiveProviderCallRuntimeAdapterPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-call-runtime-adapter-plan\`);
    const summary = data.summary ?? {};
    cloudLiveRuntimeAdapterPlanReady.textContent = String(Boolean(summary.ready));
    cloudLiveRuntimeAdapterPlanPercent.textContent = String(summary.completionPercent ?? 0);
    cloudLiveRuntimeAdapterPlanNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-runtime-adapter-task";
    cloudLiveRuntimeAdapterPlanJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-plan-v0"),
      "Task Endpoint: /cloud-consciousness/live-provider-runtime-adapter-tasks",
      "Task Registry: openclaw-cloud-consciousness-live-provider-runtime-adapter-task-v0",
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "SDK loaded: " + Boolean(summary.providerSdkLoaded),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Live enabled: " + Boolean(summary.liveProviderCallEnabled),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-runtime-adapter-task"),
    ].join("\\n");
  } catch {
    cloudLiveRuntimeAdapterPlanReady.textContent = "false";
    cloudLiveRuntimeAdapterPlanPercent.textContent = "0";
    cloudLiveRuntimeAdapterPlanNext.textContent = "openclaw-cloud-consciousness-live-provider-runtime-adapter-task";
    cloudLiveRuntimeAdapterPlanJson.textContent = "Unable to read live provider runtime adapter plan.";
  }
}

async function refreshCloudConsciousnessLiveProviderRuntimeAdapterExit() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-runtime-adapter-exit\`);
    const summary = data.summary ?? {};
    cloudLiveRuntimeAdapterExitComplete.textContent = String(Boolean(summary.complete));
    cloudLiveRuntimeAdapterExitPercent.textContent = String(summary.completionPercent ?? 0);
    cloudLiveRuntimeAdapterExitNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-call-final-authorization";
    cloudLiveRuntimeAdapterExitJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-runtime-adapter-exit-v0"),
      "Complete: " + Boolean(summary.complete) + " percent=" + (summary.completionPercent ?? 0),
      "Creates task: " + Boolean(summary.createsTask),
      "Transmits externally: " + Boolean(summary.transmitsExternally),
      "Live enabled: " + Boolean(summary.liveProviderCallEnabled),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-call-final-authorization"),
    ].join("\\n");
  } catch {
    cloudLiveRuntimeAdapterExitComplete.textContent = "false";
    cloudLiveRuntimeAdapterExitPercent.textContent = "0";
    cloudLiveRuntimeAdapterExitNext.textContent = "openclaw-cloud-consciousness-live-provider-call-final-authorization";
    cloudLiveRuntimeAdapterExitJson.textContent = "Unable to read live provider runtime adapter exit gate.";
  }
}

async function refreshCloudConsciousnessLiveProviderCallFinalAuthorization() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-call-final-authorization\`);
    const summary = data.summary ?? {};
    cloudLiveFinalAuthReady.textContent = String(Boolean(summary.ready));
    cloudLiveFinalAuthGranted.textContent = String(Boolean(summary.grantsFinalAuthorization));
    cloudLiveFinalAuthNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-call-operator-launch-review";
    cloudLiveFinalAuthJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-call-final-authorization-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Final authorization granted: " + Boolean(summary.grantsFinalAuthorization),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live enabled: " + Boolean(summary.liveProviderCallEnabled),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-call-operator-launch-review"),
    ].join("\\n");
  } catch {
    cloudLiveFinalAuthReady.textContent = "false";
    cloudLiveFinalAuthGranted.textContent = "false";
    cloudLiveFinalAuthNext.textContent = "openclaw-cloud-consciousness-live-provider-call-operator-launch-review";
    cloudLiveFinalAuthJson.textContent = "Unable to read live provider final authorization gate.";
  }
}

async function refreshCloudConsciousnessLiveProviderCallOperatorLaunchReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-call-operator-launch-review\`);
    const summary = data.summary ?? {};
    cloudLiveLaunchReviewReady.textContent = String(Boolean(summary.ready));
    cloudLiveLaunchReviewAuthorized.textContent = String(Boolean(summary.launchAuthorized));
    cloudLiveLaunchReviewNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-call-runtime-implementation-plan";
    cloudLiveLaunchReviewJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-call-operator-launch-review-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Launch authorized: " + Boolean(summary.launchAuthorized),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live enabled: " + Boolean(summary.liveProviderCallEnabled),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-call-runtime-implementation-plan"),
    ].join("\\n");
  } catch {
    cloudLiveLaunchReviewReady.textContent = "false";
    cloudLiveLaunchReviewAuthorized.textContent = "false";
    cloudLiveLaunchReviewNext.textContent = "openclaw-cloud-consciousness-live-provider-call-runtime-implementation-plan";
    cloudLiveLaunchReviewJson.textContent = "Unable to read live provider operator launch review.";
  }
}

async function refreshCloudConsciousnessLiveProviderCallRuntimeImplementationPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-call-runtime-implementation-plan\`);
    const summary = data.summary ?? {};
    cloudLiveRuntimeImplPlanReady.textContent = String(Boolean(summary.ready));
    cloudLiveRuntimeImplPlanImplemented.textContent = String(Boolean(summary.implementsRuntimeAdapter));
    cloudLiveRuntimeImplPlanNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-call-runtime-implementation-task";
    cloudLiveRuntimeImplPlanJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-call-runtime-implementation-plan-v0"),
      "Task Endpoint: /cloud-consciousness/live-provider-runtime-implementation-tasks",
      "Task Registry: openclaw-cloud-consciousness-live-provider-runtime-implementation-task-v0",
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Runtime implemented: " + Boolean(summary.implementsRuntimeAdapter),
      "SDK loaded: " + Boolean(summary.providerSdkLoaded),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-call-runtime-implementation-task"),
    ].join("\\n");
  } catch {
    cloudLiveRuntimeImplPlanReady.textContent = "false";
    cloudLiveRuntimeImplPlanImplemented.textContent = "false";
    cloudLiveRuntimeImplPlanNext.textContent = "openclaw-cloud-consciousness-live-provider-call-runtime-implementation-task";
    cloudLiveRuntimeImplPlanJson.textContent = "Unable to read live provider runtime implementation plan.";
  }
}

async function refreshCloudConsciousnessLiveProviderCallRuntimeAdapterImplementation() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-call-runtime-adapter-implementation\`);
    const summary = data.summary ?? {};
    cloudLiveRuntimeAdapterImplReady.textContent = String(Boolean(summary.ready));
    cloudLiveRuntimeAdapterImplInterface.textContent = String(Boolean(summary.definesRuntimeAdapterInterface));
    cloudLiveRuntimeAdapterImplNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-implementation-task";
    cloudLiveRuntimeAdapterImplJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-implementation-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Interface defined: " + Boolean(summary.definesRuntimeAdapterInterface),
      "Runtime implemented: " + Boolean(summary.implementsRuntimeAdapter),
      "SDK loaded: " + Boolean(summary.providerSdkLoaded),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Task Endpoint: /cloud-consciousness/live-provider-runtime-adapter-implementation-tasks",
      "Task Registry: openclaw-cloud-consciousness-live-provider-runtime-adapter-implementation-task-v0",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-implementation-task"),
    ].join("\\n");
  } catch {
    cloudLiveRuntimeAdapterImplReady.textContent = "false";
    cloudLiveRuntimeAdapterImplInterface.textContent = "false";
    cloudLiveRuntimeAdapterImplNext.textContent = "openclaw-cloud-consciousness-live-provider-call-runtime-adapter-implementation-task";
    cloudLiveRuntimeAdapterImplJson.textContent = "Unable to read live provider runtime adapter implementation scaffold.";
  }
}

async function refreshCloudConsciousnessLiveProviderRuntimeAdapterModuleContract() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-runtime-adapter-module-contract\`);
    const summary = data.summary ?? {};
    cloudLiveRuntimeAdapterModuleReady.textContent = String(Boolean(summary.ready));
    cloudLiveRuntimeAdapterModuleBoundary.textContent = String(Boolean(summary.moduleBoundaryDefined));
    cloudLiveRuntimeAdapterModuleNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-runtime-adapter-module-task";
    cloudLiveRuntimeAdapterModuleJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-runtime-adapter-module-contract-v0"),
      "Module: " + (data.moduleContract?.module ?? "services/openclaw-core/src/cloud-live-provider-runtime-adapter.mjs"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Module boundary: " + Boolean(summary.moduleBoundaryDefined),
      "Runtime implemented: " + Boolean(summary.implementsRuntimeAdapter),
      "SDK loaded: " + Boolean(summary.providerSdkLoaded),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Task Endpoint: /cloud-consciousness/live-provider-runtime-adapter-module-tasks",
      "Task Registry: openclaw-cloud-consciousness-live-provider-runtime-adapter-module-task-v0",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-runtime-adapter-module-task"),
    ].join("\\n");
  } catch {
    cloudLiveRuntimeAdapterModuleReady.textContent = "false";
    cloudLiveRuntimeAdapterModuleBoundary.textContent = "false";
    cloudLiveRuntimeAdapterModuleNext.textContent = "openclaw-cloud-consciousness-live-provider-runtime-adapter-module-task";
    cloudLiveRuntimeAdapterModuleJson.textContent = "Unable to read live provider runtime adapter module contract.";
  }
}

async function refreshCloudConsciousnessLiveProviderRequestBuilder() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-request-builder\`);
    const summary = data.summary ?? {};
    cloudLiveProviderRequestBuilderReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderRequestBuilderMessages.textContent = String(summary.messageCount ?? 0);
    cloudLiveProviderRequestBuilderNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-request-builder-task";
    cloudLiveProviderRequestBuilderJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-request-builder-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Messages: " + (summary.messageCount ?? 0),
      "Credential value included: " + Boolean(summary.credentialValueIncluded),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Task Endpoint: /cloud-consciousness/live-provider-request-builder-tasks",
      "Task Registry: openclaw-cloud-consciousness-live-provider-request-builder-task-v0",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-request-builder-task"),
    ].join("\\n");
  } catch {
    cloudLiveProviderRequestBuilderReady.textContent = "false";
    cloudLiveProviderRequestBuilderMessages.textContent = "0";
    cloudLiveProviderRequestBuilderNext.textContent = "openclaw-cloud-consciousness-live-provider-request-builder-task";
    cloudLiveProviderRequestBuilderJson.textContent = "Unable to read live provider request builder.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialReferenceResolver() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-reference-resolver\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialReferenceResolverReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialReferenceResolverReferenceOnly.textContent = String(Boolean(summary.referenceOnly));
    cloudLiveProviderCredentialReferenceResolverNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-reference-resolver-task";
    cloudLiveProviderCredentialReferenceResolverJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-reference-resolver-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Credential reference present: " + Boolean(summary.credentialReferencePresent),
      "Valid reference: " + Boolean(summary.validReference),
      "Reference only: " + Boolean(summary.referenceOnly),
      "Credential value included: " + Boolean(summary.credentialValueIncluded),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Task Endpoint: /cloud-consciousness/live-provider-credential-reference-resolver-tasks",
      "Task Registry: openclaw-cloud-consciousness-live-provider-credential-reference-resolver-task-v0",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-reference-resolver-task"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialReferenceResolverReady.textContent = "false";
    cloudLiveProviderCredentialReferenceResolverReferenceOnly.textContent = "false";
    cloudLiveProviderCredentialReferenceResolverNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-reference-resolver-task";
    cloudLiveProviderCredentialReferenceResolverJson.textContent = "Unable to read live provider credential reference resolver.";
  }
}

async function refreshCloudConsciousnessLiveProviderNoNetworkSender() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-no-network-sender\`);
    const summary = data.summary ?? {};
    cloudLiveProviderNoNetworkSenderReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderNoNetworkSenderDispatch.textContent = String(Boolean(summary.dispatchDeferred));
    cloudLiveProviderNoNetworkSenderNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-send-provider-request-task";
    cloudLiveProviderNoNetworkSenderJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-send-provider-request-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Dispatch deferred: " + Boolean(summary.dispatchDeferred),
      "Reference only: " + Boolean(summary.referenceOnly),
      "Credential value included: " + Boolean(summary.credentialValueIncluded),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Task Endpoint: /cloud-consciousness/live-provider-no-network-sender-tasks",
      "Task Registry: openclaw-cloud-consciousness-live-provider-no-network-sender-task-v0",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-send-provider-request-task"),
    ].join("\\n");
  } catch {
    cloudLiveProviderNoNetworkSenderReady.textContent = "false";
    cloudLiveProviderNoNetworkSenderDispatch.textContent = "false";
    cloudLiveProviderNoNetworkSenderNext.textContent = "openclaw-cloud-consciousness-live-provider-send-provider-request-task";
    cloudLiveProviderNoNetworkSenderJson.textContent = "Unable to read live provider no-network sender.";
  }
}

async function refreshCloudConsciousnessLiveProviderEgressTranscriptRecorder() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-egress-transcript-recorder\`);
    const summary = data.summary ?? {};
    cloudLiveProviderEgressTranscriptRecorderReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderEgressTranscriptRecorderLocal.textContent = String(Boolean(summary.localOnly));
    cloudLiveProviderEgressTranscriptRecorderNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-egress-transcript-recorder-task";
    cloudLiveProviderEgressTranscriptRecorderJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-egress-transcript-recorder-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Transcript recorded: " + Boolean(summary.transcriptRecorded),
      "Local only: " + Boolean(summary.localOnly),
      "Dispatch deferred: " + Boolean(summary.dispatchDeferred),
      "Reference only: " + Boolean(summary.referenceOnly),
      "Credential value included: " + Boolean(summary.credentialValueIncluded),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Provider response created: " + Boolean(summary.providerResponseCreated),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Task Endpoint: /cloud-consciousness/live-provider-egress-transcript-recorder-tasks",
      "Task Registry: openclaw-cloud-consciousness-live-provider-egress-transcript-recorder-task-v0",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-egress-transcript-recorder-task"),
    ].join("\\n");
  } catch {
    cloudLiveProviderEgressTranscriptRecorderReady.textContent = "false";
    cloudLiveProviderEgressTranscriptRecorderLocal.textContent = "false";
    cloudLiveProviderEgressTranscriptRecorderNext.textContent = "openclaw-cloud-consciousness-live-provider-egress-transcript-recorder-task";
    cloudLiveProviderEgressTranscriptRecorderJson.textContent = "Unable to read live provider egress transcript recorder.";
  }
}

async function refreshCloudConsciousnessLiveProviderResponseVerifier() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-response-verifier\`);
    const summary = data.summary ?? {};
    cloudLiveProviderResponseVerifierReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderResponseVerifierVerified.textContent = String(Boolean(summary.responseVerified));
    cloudLiveProviderResponseVerifierNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-response-verifier-task";
    cloudLiveProviderResponseVerifierJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-response-verifier-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Response verified: " + Boolean(summary.responseVerified),
      "Local only: " + Boolean(summary.localOnly),
      "Response source: " + (summary.responseSource ?? "local_rehearsal_readback"),
      "Safe readback: " + Boolean(summary.safeReadback),
      "Transcript deferred: " + Boolean(summary.transcriptDeferred),
      "Credential value included: " + Boolean(summary.credentialValueIncluded),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Provider response created: " + Boolean(summary.providerResponseCreated),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Task Endpoint: /cloud-consciousness/live-provider-response-verifier-tasks",
      "Task Registry: openclaw-cloud-consciousness-live-provider-response-verifier-task-v0",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-response-verifier-task"),
    ].join("\\n");
  } catch {
    cloudLiveProviderResponseVerifierReady.textContent = "false";
    cloudLiveProviderResponseVerifierVerified.textContent = "false";
    cloudLiveProviderResponseVerifierNext.textContent = "openclaw-cloud-consciousness-live-provider-response-verifier-task";
    cloudLiveProviderResponseVerifierJson.textContent = "Unable to read live provider response verifier.";
  }
}

async function refreshCloudConsciousnessLiveProviderRollbackNote() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-rollback-note\`);
    const summary = data.summary ?? {};
    cloudLiveProviderRollbackNoteReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderRollbackNoteExecuted.textContent = String(Boolean(summary.rollbackExecuted));
    cloudLiveProviderRollbackNoteNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-rollback-note-task";
    cloudLiveProviderRollbackNoteJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-rollback-note-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Rollback note ready: " + Boolean(summary.rollbackNoteReady),
      "Local only: " + Boolean(summary.localOnly),
      "Rollback required: " + Boolean(summary.rollbackRequired),
      "Rollback executed: " + Boolean(summary.rollbackExecuted),
      "Rollback command created: " + Boolean(summary.rollbackCommandCreated),
      "Host mutation: " + Boolean(summary.hostMutation),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Provider response created: " + Boolean(summary.providerResponseCreated),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Task Endpoint: /cloud-consciousness/live-provider-rollback-note-tasks",
      "Task Registry: openclaw-cloud-consciousness-live-provider-rollback-note-task-v0",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-rollback-note-task"),
    ].join("\\n");
  } catch {
    cloudLiveProviderRollbackNoteReady.textContent = "false";
    cloudLiveProviderRollbackNoteExecuted.textContent = "false";
    cloudLiveProviderRollbackNoteNext.textContent = "openclaw-cloud-consciousness-live-provider-rollback-note-task";
    cloudLiveProviderRollbackNoteJson.textContent = "Unable to read live provider rollback note.";
  }
}

async function refreshCloudConsciousnessLiveProviderRuntimeAdapterCompletion() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-runtime-adapter-completion\`);
    const summary = data.summary ?? {};
    cloudLiveProviderRuntimeAdapterCompletionReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderRuntimeAdapterCompletionMethods.textContent = \`\${summary.readyMethodCount ?? 0}/\${summary.methodCount ?? 0}\`;
    cloudLiveProviderRuntimeAdapterCompletionNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-runtime-adapter-closure-task";
    cloudLiveProviderRuntimeAdapterCompletionJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-runtime-adapter-completion-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Methods: " + (summary.readyMethodCount ?? 0) + "/" + (summary.methodCount ?? 0),
      "Adapter complete: " + Boolean(summary.localRuntimeAdapterComplete),
      "Method table closed: " + Boolean(summary.adapterMethodTableClosed),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Provider response created: " + Boolean(summary.providerResponseCreated),
      "Rollback executed: " + Boolean(summary.rollbackExecuted),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Task Endpoint: /cloud-consciousness/live-provider-runtime-adapter-closure-tasks",
      "Task Registry: openclaw-cloud-consciousness-live-provider-runtime-adapter-closure-task-v0",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-runtime-adapter-closure-task"),
    ].join("\\n");
  } catch {
    cloudLiveProviderRuntimeAdapterCompletionReady.textContent = "false";
    cloudLiveProviderRuntimeAdapterCompletionMethods.textContent = "0/0";
    cloudLiveProviderRuntimeAdapterCompletionNext.textContent = "openclaw-cloud-consciousness-live-provider-runtime-adapter-closure-task";
    cloudLiveProviderRuntimeAdapterCompletionJson.textContent = "Unable to read live provider runtime adapter completion.";
  }
}

async function refreshCloudConsciousnessLiveProviderRuntimeAdapterClosure() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-runtime-adapter-closure-exit\`);
    const summary = data.summary ?? {};
    cloudLiveProviderRuntimeAdapterClosureComplete.textContent = String(Boolean(summary.complete));
    cloudLiveProviderRuntimeAdapterClosurePercent.textContent = String(summary.completionPercent ?? 0);
    cloudLiveProviderRuntimeAdapterClosureNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-real-launch-route-review";
    cloudLiveProviderRuntimeAdapterClosureJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-runtime-adapter-closure-exit-v0"),
      "Complete: " + Boolean(summary.complete) + " percent=" + (summary.completionPercent ?? 0),
      "Methods: " + (summary.implementedMethodCount ?? 0) + "/" + (summary.methodCount ?? 0),
      "Adapter complete: " + Boolean(summary.localRuntimeAdapterComplete),
      "Method table closed: " + Boolean(summary.adapterMethodTableClosed),
      "Creates approval: " + Boolean(summary.createsApproval),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Rollback executed: " + Boolean(summary.rollbackExecuted),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-real-launch-route-review"),
    ].join("\\n");
  } catch {
    cloudLiveProviderRuntimeAdapterClosureComplete.textContent = "false";
    cloudLiveProviderRuntimeAdapterClosurePercent.textContent = "0";
    cloudLiveProviderRuntimeAdapterClosureNext.textContent = "openclaw-cloud-consciousness-live-provider-real-launch-route-review";
    cloudLiveProviderRuntimeAdapterClosureJson.textContent = "Unable to read live provider runtime adapter closure.";
  }
}

async function refreshCloudConsciousnessLiveProviderRealLaunchRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-real-launch-route-review\`);
    const summary = data.summary ?? {};
    cloudLiveProviderRealLaunchRouteReviewReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderRealLaunchRouteReviewSelected.textContent = summary.selectedSlice ?? "openclaw-cloud-consciousness-live-provider-real-launch-task";
    cloudLiveProviderRealLaunchRouteReviewLaunch.textContent = summary.launchAuthorized === true ? "authorized" : "not authorized";
    cloudLiveProviderRealLaunchRouteReviewJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-real-launch-route-review-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Selected: " + (summary.selectedSlice ?? "openclaw-cloud-consciousness-live-provider-real-launch-task"),
      "Adapter complete: " + Boolean(summary.localRuntimeAdapterComplete),
      "Method table closed: " + Boolean(summary.adapterMethodTableClosed),
      "Launch authorized: " + Boolean(summary.launchAuthorized),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Provider response created: " + Boolean(summary.providerResponseCreated),
      "Rollback executed: " + Boolean(summary.rollbackExecuted),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Task Endpoint: /cloud-consciousness/live-provider-real-launch-tasks",
      "Task Registry: openclaw-cloud-consciousness-live-provider-real-launch-task-v0",
      "Deferred Status: real_launch_deferred_after_approval",
      "Execution Preflight: openclaw-cloud-consciousness-live-provider-real-launch-execution-preflight",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-real-launch-task"),
    ].join("\\n");
  } catch {
    cloudLiveProviderRealLaunchRouteReviewReady.textContent = "false";
    cloudLiveProviderRealLaunchRouteReviewSelected.textContent = "openclaw-cloud-consciousness-live-provider-real-launch-task";
    cloudLiveProviderRealLaunchRouteReviewLaunch.textContent = "not authorized";
    cloudLiveProviderRealLaunchRouteReviewJson.textContent = "Unable to read live provider real launch route review.";
  }
}

async function refreshCloudConsciousnessLiveProviderRealLaunchExecutionPreflight() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-real-launch-execution-preflight\`);
    const summary = data.summary ?? {};
    cloudLiveProviderRealLaunchExecutionPreflightReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderRealLaunchExecutionPreflightSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderRealLaunchExecutionPreflightLaunch.textContent = summary.launchAuthorized === true ? "authorized" : "not authorized";
    cloudLiveProviderRealLaunchExecutionPreflightJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-real-launch-execution-preflight-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Recorded: " + Boolean(summary.executionPreflightRecorded),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Approved deferred evidence: " + Boolean(summary.approvedDeferredEvidenceFound),
      "Launch authorized: " + Boolean(summary.launchAuthorized),
      "Launch executed: " + Boolean(summary.launchExecuted),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Provider response created: " + Boolean(summary.providerResponseCreated),
      "Rollback executed: " + Boolean(summary.rollbackExecuted),
      "Host mutation: " + Boolean(summary.hostMutation),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Record Endpoint: /cloud-consciousness/live-provider-real-launch-execution-preflight",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-gate"),
    ].join("\\n");
  } catch {
    cloudLiveProviderRealLaunchExecutionPreflightReady.textContent = "false";
    cloudLiveProviderRealLaunchExecutionPreflightSource.textContent = "none";
    cloudLiveProviderRealLaunchExecutionPreflightLaunch.textContent = "not authorized";
    cloudLiveProviderRealLaunchExecutionPreflightJson.textContent = "Unable to read live provider real launch execution preflight.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueAccessGate() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-access-gate\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueAccessGateReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueAccessGateCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueAccessGateNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-endpoint-network-egress-gate";
    cloudLiveProviderCredentialValueAccessGateJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-gate-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Recorded: " + Boolean(summary.credentialValueAccessGateRecorded),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Execution preflight found: " + Boolean(summary.executionPreflightFound),
      "Credential access authorized: " + Boolean(summary.credentialValueAccessAuthorized),
      "Credential access denied: " + Boolean(summary.credentialValueAccessDenied),
      "Credential value included: " + Boolean(summary.credentialValueIncluded),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Credential value exposed: " + Boolean(summary.credentialValueExposed),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Provider response created: " + Boolean(summary.providerResponseCreated),
      "Rollback executed: " + Boolean(summary.rollbackExecuted),
      "Host mutation: " + Boolean(summary.hostMutation),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Record Endpoint: /cloud-consciousness/live-provider-credential-value-access-gate",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-endpoint-network-egress-gate"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueAccessGateReady.textContent = "false";
    cloudLiveProviderCredentialValueAccessGateCredential.textContent = "not read";
    cloudLiveProviderCredentialValueAccessGateNext.textContent = "openclaw-cloud-consciousness-live-provider-endpoint-network-egress-gate";
    cloudLiveProviderCredentialValueAccessGateJson.textContent = "Unable to read live provider credential value access gate.";
  }
}

async function refreshCloudConsciousnessLiveProviderEndpointNetworkEgressGate() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-endpoint-network-egress-gate\`);
    const summary = data.summary ?? {};
    cloudLiveProviderEndpointNetworkEgressGateReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderEndpointNetworkEgressGateEndpoint.textContent = summary.endpointContacted === true ? "contacted" : "not contacted";
    cloudLiveProviderEndpointNetworkEgressGateNetwork.textContent = summary.networkEgress === true ? "egress" : "no egress";
    cloudLiveProviderEndpointNetworkEgressGateNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-egress-execution-route-task-preflight";
    cloudLiveProviderEndpointNetworkEgressGateJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-endpoint-network-egress-gate-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Recorded: " + Boolean(summary.endpointNetworkEgressGateRecorded),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Credential value access gate found: " + Boolean(summary.credentialValueAccessGateFound),
      "Credential access authorized: " + Boolean(summary.credentialValueAccessAuthorized),
      "Credential access denied: " + Boolean(summary.credentialValueAccessDenied),
      "Endpoint egress authorized: " + Boolean(summary.endpointNetworkEgressAuthorized),
      "Endpoint egress denied: " + Boolean(summary.endpointNetworkEgressDenied),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Provider response created: " + Boolean(summary.providerResponseCreated),
      "Rollback executed: " + Boolean(summary.rollbackExecuted),
      "Host mutation: " + Boolean(summary.hostMutation),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Record Endpoint: /cloud-consciousness/live-provider-endpoint-network-egress-gate",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-egress-execution-route-task-preflight"),
    ].join("\\n");
  } catch {
    cloudLiveProviderEndpointNetworkEgressGateReady.textContent = "false";
    cloudLiveProviderEndpointNetworkEgressGateEndpoint.textContent = "not contacted";
    cloudLiveProviderEndpointNetworkEgressGateNetwork.textContent = "no egress";
    cloudLiveProviderEndpointNetworkEgressGateNext.textContent = "openclaw-cloud-consciousness-live-provider-egress-execution-route-task-preflight";
    cloudLiveProviderEndpointNetworkEgressGateJson.textContent = "Unable to read live provider endpoint network egress gate.";
  }
}

async function refreshCloudConsciousnessLiveProviderEgressExecutionRouteTaskPreflight() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-egress-execution-route-task-preflight\`);
    const summary = data.summary ?? {};
    cloudLiveProviderEgressExecutionRouteTaskPreflightReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderEgressExecutionRouteTaskPreflightTask.textContent = summary.egressExecutionTaskCreated === true ? "created" : "not created";
    cloudLiveProviderEgressExecutionRouteTaskPreflightNetwork.textContent = summary.networkEgress === true ? "egress" : "no egress";
    cloudLiveProviderEgressExecutionRouteTaskPreflightNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-egress-execution-task-shell";
    cloudLiveProviderEgressExecutionRouteTaskPreflightJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-egress-execution-route-task-preflight-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Recorded: " + Boolean(summary.egressExecutionRouteTaskPreflightRecorded),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Endpoint network egress gate found: " + Boolean(summary.endpointNetworkEgressGateFound),
      "Egress execution task created: " + Boolean(summary.egressExecutionTaskCreated),
      "Egress execution task approved: " + Boolean(summary.egressExecutionTaskApproved),
      "Credential access authorized: " + Boolean(summary.credentialValueAccessAuthorized),
      "Credential access denied: " + Boolean(summary.credentialValueAccessDenied),
      "Endpoint egress authorized: " + Boolean(summary.endpointNetworkEgressAuthorized),
      "Endpoint egress denied: " + Boolean(summary.endpointNetworkEgressDenied),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Provider response created: " + Boolean(summary.providerResponseCreated),
      "Rollback executed: " + Boolean(summary.rollbackExecuted),
      "Host mutation: " + Boolean(summary.hostMutation),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Record Endpoint: /cloud-consciousness/live-provider-egress-execution-route-task-preflight",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-egress-execution-task-shell"),
    ].join("\\n");
  } catch {
    cloudLiveProviderEgressExecutionRouteTaskPreflightReady.textContent = "false";
    cloudLiveProviderEgressExecutionRouteTaskPreflightTask.textContent = "not created";
    cloudLiveProviderEgressExecutionRouteTaskPreflightNetwork.textContent = "no egress";
    cloudLiveProviderEgressExecutionRouteTaskPreflightNext.textContent = "openclaw-cloud-consciousness-live-provider-egress-execution-task-shell";
    cloudLiveProviderEgressExecutionRouteTaskPreflightJson.textContent = "Unable to read live provider egress execution route task preflight.";
  }
}

async function refreshCloudConsciousnessLiveProviderEgressExecutionTaskShell() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-egress-execution-route-task-preflight\`);
    const summary = data.summary ?? {};
    cloudLiveProviderEgressExecutionTaskShellReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderEgressExecutionTaskShellApproval.textContent = "required";
    cloudLiveProviderEgressExecutionTaskShellNetwork.textContent = summary.networkEgress === true ? "egress" : "no egress";
    cloudLiveProviderEgressExecutionTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-egress-execution-approved-deferred";
    cloudLiveProviderEgressExecutionTaskShellJson.textContent = [
      "Task Registry: openclaw-cloud-consciousness-live-provider-egress-execution-task-v0",
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-egress-execution-route-task-preflight-v0"),
      "Approval: required before task execution",
      "Task Endpoint: /cloud-consciousness/live-provider-egress-execution-tasks",
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Provider response created: " + Boolean(summary.providerResponseCreated),
      "Rollback executed: " + Boolean(summary.rollbackExecuted),
      "Host mutation: " + Boolean(summary.hostMutation),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Next: openclaw-cloud-consciousness-live-provider-egress-execution-approved-deferred",
    ].join("\\n");
  } catch {
    cloudLiveProviderEgressExecutionTaskShellReady.textContent = "false";
    cloudLiveProviderEgressExecutionTaskShellApproval.textContent = "required";
    cloudLiveProviderEgressExecutionTaskShellNetwork.textContent = "no egress";
    cloudLiveProviderEgressExecutionTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-egress-execution-task-shell";
    cloudLiveProviderEgressExecutionTaskShellJson.textContent = "Unable to read live provider egress execution task shell readiness.";
  }
}

async function refreshCloudConsciousnessLiveProviderEgressExecutionApprovedDeferred() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-egress-execution-approved-deferred\`);
    const summary = data.summary ?? {};
    cloudLiveProviderEgressExecutionApprovedDeferredReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderEgressExecutionApprovedDeferredSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderEgressExecutionApprovedDeferredNetwork.textContent = summary.networkEgress === true ? "egress" : "no egress";
    cloudLiveProviderEgressExecutionApprovedDeferredNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-authorization-route";
    cloudLiveProviderEgressExecutionApprovedDeferredJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-egress-execution-approved-deferred-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Approved deferred evidence found: " + Boolean(summary.approvedDeferredEvidenceFound),
      "Egress execution task created: " + Boolean(summary.egressExecutionTaskCreated),
      "Egress execution task approved: " + Boolean(summary.egressExecutionTaskApproved),
      "Egress execution deferred: " + Boolean(summary.egressExecutionDeferred),
      "Credential access authorized: " + Boolean(summary.credentialValueAccessAuthorized),
      "Endpoint egress authorized: " + Boolean(summary.endpointNetworkEgressAuthorized),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Provider response created: " + Boolean(summary.providerResponseCreated),
      "Rollback executed: " + Boolean(summary.rollbackExecuted),
      "Host mutation: " + Boolean(summary.hostMutation),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-egress-execution-approved-deferred",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-authorization-route"),
    ].join("\\n");
  } catch {
    cloudLiveProviderEgressExecutionApprovedDeferredReady.textContent = "false";
    cloudLiveProviderEgressExecutionApprovedDeferredSource.textContent = "none";
    cloudLiveProviderEgressExecutionApprovedDeferredNetwork.textContent = "no egress";
    cloudLiveProviderEgressExecutionApprovedDeferredNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-authorization-route";
    cloudLiveProviderEgressExecutionApprovedDeferredJson.textContent = "Unable to read live provider egress execution approved deferred evidence.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueAuthorizationRoute() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-authorization-route\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueAuthorizationRouteReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueAuthorizationRouteCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueAuthorizationRouteNetwork.textContent = summary.networkEgress === true ? "egress" : "no egress";
    cloudLiveProviderCredentialValueAuthorizationRouteNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-authorization-task-shell";
    cloudLiveProviderCredentialValueAuthorizationRouteJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-authorization-route-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Selected: " + (summary.selectedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-authorization-task-shell"),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Approved deferred evidence found: " + Boolean(summary.approvedDeferredEvidenceFound),
      "Credential authorization task created: " + Boolean(summary.credentialValueAuthorizationTaskCreated),
      "Credential access authorized: " + Boolean(summary.credentialValueAccessAuthorized),
      "Credential access denied: " + Boolean(summary.credentialValueAccessDenied),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-authorization-route",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-authorization-task-shell"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueAuthorizationRouteReady.textContent = "false";
    cloudLiveProviderCredentialValueAuthorizationRouteCredential.textContent = "not read";
    cloudLiveProviderCredentialValueAuthorizationRouteNetwork.textContent = "no egress";
    cloudLiveProviderCredentialValueAuthorizationRouteNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-authorization-task-shell";
    cloudLiveProviderCredentialValueAuthorizationRouteJson.textContent = "Unable to read live provider credential value authorization route.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueAuthorizationTaskShell() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-authorization-route\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueAuthorizationTaskShellReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueAuthorizationTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueAuthorizationTaskShellCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueAuthorizationTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-authorization-approved-deferred";
    cloudLiveProviderCredentialValueAuthorizationTaskShellJson.textContent = [
      "Task Registry: openclaw-cloud-consciousness-live-provider-credential-value-authorization-task-v0",
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-authorization-route-v0"),
      "Approval: required before authorization shell can be completed",
      "Task Endpoint: /cloud-consciousness/live-provider-credential-value-authorization-tasks",
      "Credential authorization task created: " + Boolean(summary.credentialValueAuthorizationTaskCreated),
      "Credential access authorized: " + Boolean(summary.credentialValueAccessAuthorized),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Next: openclaw-cloud-consciousness-live-provider-credential-value-authorization-approved-deferred",
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueAuthorizationTaskShellReady.textContent = "false";
    cloudLiveProviderCredentialValueAuthorizationTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueAuthorizationTaskShellCredential.textContent = "not read";
    cloudLiveProviderCredentialValueAuthorizationTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-authorization-task-shell";
    cloudLiveProviderCredentialValueAuthorizationTaskShellJson.textContent = "Unable to read live provider credential value authorization task shell readiness.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueAuthorizationApprovedDeferred() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-authorization-approved-deferred\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueAuthorizationApprovedDeferredReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueAuthorizationApprovedDeferredSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderCredentialValueAuthorizationApprovedDeferredCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueAuthorizationApprovedDeferredNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-readiness-preflight";
    cloudLiveProviderCredentialValueAuthorizationApprovedDeferredJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-authorization-approved-deferred-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Approved deferred evidence found: " + Boolean(summary.approvedDeferredEvidenceFound),
      "Credential authorization task created: " + Boolean(summary.credentialValueAuthorizationTaskCreated),
      "Credential authorization task approved: " + Boolean(summary.credentialValueAuthorizationTaskApproved),
      "Credential authorization deferred: " + Boolean(summary.credentialValueAuthorizationDeferred),
      "Credential access authorized: " + Boolean(summary.credentialValueAccessAuthorized),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-authorization-approved-deferred",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-readiness-preflight"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueAuthorizationApprovedDeferredReady.textContent = "false";
    cloudLiveProviderCredentialValueAuthorizationApprovedDeferredSource.textContent = "none";
    cloudLiveProviderCredentialValueAuthorizationApprovedDeferredCredential.textContent = "not read";
    cloudLiveProviderCredentialValueAuthorizationApprovedDeferredNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-readiness-preflight";
    cloudLiveProviderCredentialValueAuthorizationApprovedDeferredJson.textContent = "Unable to read live provider credential value authorization approved deferred evidence.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueReadinessPreflight() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-readiness-preflight\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueReadinessPreflightReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueReadinessPreflightSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderCredentialValueReadinessPreflightCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueReadinessPreflightNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-read-task-shell";
    cloudLiveProviderCredentialValueReadinessPreflightJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-readiness-preflight-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Approved deferred evidence found: " + Boolean(summary.credentialValueAuthorizationApprovedDeferredFound),
      "Readiness preflight recorded: " + Boolean(summary.credentialValueReadinessPreflightRecorded),
      "Credential authorization task approved: " + Boolean(summary.credentialValueAuthorizationTaskApproved),
      "Credential authorization deferred: " + Boolean(summary.credentialValueAuthorizationDeferred),
      "Credential access authorized: " + Boolean(summary.credentialValueAccessAuthorized),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-readiness-preflight",
      "Record Endpoint: /cloud-consciousness/live-provider-credential-value-readiness-preflight",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-read-task-shell"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueReadinessPreflightReady.textContent = "false";
    cloudLiveProviderCredentialValueReadinessPreflightSource.textContent = "none";
    cloudLiveProviderCredentialValueReadinessPreflightCredential.textContent = "not read";
    cloudLiveProviderCredentialValueReadinessPreflightNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-read-task-shell";
    cloudLiveProviderCredentialValueReadinessPreflightJson.textContent = "Unable to read live provider credential value readiness preflight.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueReadTaskShell() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-readiness-preflight\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueReadTaskShellReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueReadTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueReadTaskShellCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueReadTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-read-approved-deferred";
    cloudLiveProviderCredentialValueReadTaskShellJson.textContent = [
      "Task Registry: openclaw-cloud-consciousness-live-provider-credential-value-read-task-v0",
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-readiness-preflight-v0"),
      "Approval: required before read shell can be completed",
      "Task Endpoint: /cloud-consciousness/live-provider-credential-value-read-tasks",
      "Readiness preflight recorded: " + Boolean(summary.credentialValueReadinessPreflightRecorded),
      "Credential access authorized: " + Boolean(summary.credentialValueAccessAuthorized),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Next: openclaw-cloud-consciousness-live-provider-credential-value-read-approved-deferred",
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueReadTaskShellReady.textContent = "false";
    cloudLiveProviderCredentialValueReadTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueReadTaskShellCredential.textContent = "not read";
    cloudLiveProviderCredentialValueReadTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-read-task-shell";
    cloudLiveProviderCredentialValueReadTaskShellJson.textContent = "Unable to read live provider credential value read task shell readiness.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueReadApprovedDeferred() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-read-approved-deferred\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueReadApprovedDeferredReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueReadApprovedDeferredSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderCredentialValueReadApprovedDeferredCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueReadApprovedDeferredNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-route";
    cloudLiveProviderCredentialValueReadApprovedDeferredJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-read-approved-deferred-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Approved deferred evidence found: " + Boolean(summary.approvedDeferredEvidenceFound),
      "Credential read task created: " + Boolean(summary.credentialValueReadTaskCreated),
      "Credential read task approved: " + Boolean(summary.credentialValueReadTaskApproved),
      "Credential read deferred: " + Boolean(summary.credentialValueReadDeferred),
      "Credential access authorized: " + Boolean(summary.credentialValueAccessAuthorized),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-read-approved-deferred",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-route"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueReadApprovedDeferredReady.textContent = "false";
    cloudLiveProviderCredentialValueReadApprovedDeferredSource.textContent = "none";
    cloudLiveProviderCredentialValueReadApprovedDeferredCredential.textContent = "not read";
    cloudLiveProviderCredentialValueReadApprovedDeferredNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-route";
    cloudLiveProviderCredentialValueReadApprovedDeferredJson.textContent = "Unable to read live provider credential value read approved deferred evidence.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationRoute() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-access-authorization-route\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueAccessAuthorizationRouteReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueAccessAuthorizationRouteCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueAccessAuthorizationRouteNetwork.textContent = summary.networkEgress === true ? "egress" : "no egress";
    cloudLiveProviderCredentialValueAccessAuthorizationRouteNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-task-shell";
    cloudLiveProviderCredentialValueAccessAuthorizationRouteJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-route-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Selected: " + (summary.selectedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-task-shell"),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Approved deferred evidence found: " + Boolean(summary.approvedDeferredEvidenceFound),
      "Access authorization task created: " + Boolean(summary.credentialValueAccessAuthorizationTaskCreated),
      "Credential access authorized: " + Boolean(summary.credentialValueAccessAuthorized),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-access-authorization-route",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-task-shell"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueAccessAuthorizationRouteReady.textContent = "false";
    cloudLiveProviderCredentialValueAccessAuthorizationRouteCredential.textContent = "not read";
    cloudLiveProviderCredentialValueAccessAuthorizationRouteNetwork.textContent = "no egress";
    cloudLiveProviderCredentialValueAccessAuthorizationRouteNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-task-shell";
    cloudLiveProviderCredentialValueAccessAuthorizationRouteJson.textContent = "Unable to read live provider credential value access authorization route.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationTaskShell() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-access-authorization-route\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueAccessAuthorizationTaskShellReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueAccessAuthorizationTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueAccessAuthorizationTaskShellCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueAccessAuthorizationTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-approved-deferred";
    cloudLiveProviderCredentialValueAccessAuthorizationTaskShellJson.textContent = [
      "Task Registry: openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-task-v0",
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-route-v0"),
      "Approval: required before access authorization shell can be completed",
      "Task Endpoint: /cloud-consciousness/live-provider-credential-value-access-authorization-tasks",
      "Access authorization task created: " + Boolean(summary.credentialValueAccessAuthorizationTaskCreated),
      "Credential access authorized: " + Boolean(summary.credentialValueAccessAuthorized),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Next: openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-approved-deferred",
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueAccessAuthorizationTaskShellReady.textContent = "false";
    cloudLiveProviderCredentialValueAccessAuthorizationTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueAccessAuthorizationTaskShellCredential.textContent = "not read";
    cloudLiveProviderCredentialValueAccessAuthorizationTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-task-shell";
    cloudLiveProviderCredentialValueAccessAuthorizationTaskShellJson.textContent = "Unable to read live provider credential value access authorization task shell readiness.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationApprovedDeferred() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-access-authorization-approved-deferred\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueAccessAuthorizationApprovedDeferredReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueAccessAuthorizationApprovedDeferredSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderCredentialValueAccessAuthorizationApprovedDeferredCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueAccessAuthorizationApprovedDeferredNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-final-readiness-preflight";
    cloudLiveProviderCredentialValueAccessAuthorizationApprovedDeferredJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-approved-deferred-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Approved deferred evidence: " + Boolean(summary.approvedDeferredEvidenceFound),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-task-v0"),
      "Access authorization task approved: " + Boolean(summary.credentialValueAccessAuthorizationTaskApproved),
      "Access authorization deferred: " + Boolean(summary.credentialValueAccessAuthorizationDeferred),
      "Credential access authorized: " + Boolean(summary.credentialValueAccessAuthorized),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-access-authorization-approved-deferred",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-final-readiness-preflight"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueAccessAuthorizationApprovedDeferredReady.textContent = "false";
    cloudLiveProviderCredentialValueAccessAuthorizationApprovedDeferredSource.textContent = "none";
    cloudLiveProviderCredentialValueAccessAuthorizationApprovedDeferredCredential.textContent = "not read";
    cloudLiveProviderCredentialValueAccessAuthorizationApprovedDeferredNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-final-readiness-preflight";
    cloudLiveProviderCredentialValueAccessAuthorizationApprovedDeferredJson.textContent = "Unable to read live provider credential value access authorization approved deferred evidence.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueFinalReadinessPreflight() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-final-readiness-preflight\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueFinalReadinessPreflightReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueFinalReadinessPreflightSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderCredentialValueFinalReadinessPreflightCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueFinalReadinessPreflightNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-route";
    cloudLiveProviderCredentialValueFinalReadinessPreflightJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-final-readiness-preflight-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Recorded: " + Boolean(summary.credentialValueFinalReadinessPreflightRecorded),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-approved-deferred-v0"),
      "Credential access authorized: " + Boolean(summary.credentialValueAccessAuthorized),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-final-readiness-preflight",
      "Record Endpoint: /cloud-consciousness/live-provider-credential-value-final-readiness-preflight",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-route"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueFinalReadinessPreflightReady.textContent = "false";
    cloudLiveProviderCredentialValueFinalReadinessPreflightSource.textContent = "none";
    cloudLiveProviderCredentialValueFinalReadinessPreflightCredential.textContent = "not read";
    cloudLiveProviderCredentialValueFinalReadinessPreflightNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-route";
    cloudLiveProviderCredentialValueFinalReadinessPreflightJson.textContent = "Unable to read live provider credential value final readiness preflight.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecisionRoute() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-access-authorization-decision-route\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionRouteReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionRouteCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionRouteNetwork.textContent = summary.networkEgress === true ? "egress" : "no egress";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionRouteNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-task-shell";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionRouteJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-route-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-final-readiness-preflight-v0"),
      "Selected: " + (summary.selectedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-task-shell"),
      "Decision task created: " + Boolean(summary.credentialValueAccessAuthorizationDecisionTaskCreated),
      "Credential access authorized: " + Boolean(summary.credentialValueAccessAuthorized),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-access-authorization-decision-route",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-task-shell"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionRouteReady.textContent = "false";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionRouteCredential.textContent = "not read";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionRouteNetwork.textContent = "no egress";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionRouteNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-task-shell";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionRouteJson.textContent = "Unable to read live provider credential value access authorization decision route.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecisionTaskShell() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-access-authorization-decision-route\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionTaskShellReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionTaskShellCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-approved-deferred";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionTaskShellJson.textContent = [
      "Task Registry: openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-task-v0",
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-final-readiness-preflight-v0"),
      "Approval: required before decision shell can be completed",
      "Task Endpoint: /cloud-consciousness/live-provider-credential-value-access-authorization-decision-tasks",
      "Decision task created: " + Boolean(summary.credentialValueAccessAuthorizationDecisionTaskCreated),
      "Credential access authorized: " + Boolean(summary.credentialValueAccessAuthorized),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Next: openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-approved-deferred",
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionTaskShellReady.textContent = "false";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionTaskShellCredential.textContent = "not read";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-task-shell";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionTaskShellJson.textContent = "Unable to read live provider credential value access authorization decision task shell readiness.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferred() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-access-authorization-decision-approved-deferred\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferredReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferredSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferredCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferredNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorized-local-proof";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferredJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-approved-deferred-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Approved deferred evidence: " + Boolean(summary.approvedDeferredEvidenceFound),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-task-v0"),
      "Decision task approved: " + Boolean(summary.credentialValueAccessAuthorizationDecisionTaskApproved),
      "Decision deferred: " + Boolean(summary.credentialValueAccessAuthorizationDecisionDeferred),
      "Credential access authorized: " + Boolean(summary.credentialValueAccessAuthorized),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-access-authorization-decision-approved-deferred",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorized-local-proof"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferredReady.textContent = "false";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferredSource.textContent = "none";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferredCredential.textContent = "not read";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferredNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-access-authorized-local-proof";
    cloudLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferredJson.textContent = "Unable to read live provider credential value access authorization decision approved deferred evidence.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizedLocalProof() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-access-authorized-local-proof\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueAccessAuthorizedLocalProofReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueAccessAuthorizedLocalProofSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderCredentialValueAccessAuthorizedLocalProofCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueAccessAuthorizedLocalProofNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-route";
    cloudLiveProviderCredentialValueAccessAuthorizedLocalProofJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorized-local-proof-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Recorded: " + Boolean(summary.credentialValueAccessAuthorizedLocalProofRecorded),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorization-decision-approved-deferred-v0"),
      "Credential access authorized: " + Boolean(summary.credentialValueAccessAuthorized),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-access-authorized-local-proof",
      "Record Endpoint: /cloud-consciousness/live-provider-credential-value-access-authorized-local-proof",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-route"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueAccessAuthorizedLocalProofReady.textContent = "false";
    cloudLiveProviderCredentialValueAccessAuthorizedLocalProofSource.textContent = "none";
    cloudLiveProviderCredentialValueAccessAuthorizedLocalProofCredential.textContent = "not read";
    cloudLiveProviderCredentialValueAccessAuthorizedLocalProofNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-route";
    cloudLiveProviderCredentialValueAccessAuthorizedLocalProofJson.textContent = "Unable to read live provider credential value access authorized local proof.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadRoute() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-local-read-route\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadRouteReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadRouteCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadRouteNetwork.textContent = summary.networkEgress === true ? "egress" : "no egress";
    cloudLiveProviderCredentialValueLocalReadRouteNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-task-shell";
    cloudLiveProviderCredentialValueLocalReadRouteJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-route-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorized-local-proof-v0"),
      "Selected: " + (summary.selectedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-task-shell"),
      "Local read task created: " + Boolean(summary.credentialValueLocalReadTaskCreated),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-route",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-task-shell"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadRouteReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadRouteCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadRouteNetwork.textContent = "no egress";
    cloudLiveProviderCredentialValueLocalReadRouteNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-task-shell";
    cloudLiveProviderCredentialValueLocalReadRouteJson.textContent = "Unable to read live provider credential value local read route.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadTaskShell() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-local-read-route\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadTaskShellReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueLocalReadTaskShellCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-approved-deferred";
    cloudLiveProviderCredentialValueLocalReadTaskShellJson.textContent = [
      "Task Registry: openclaw-cloud-consciousness-live-provider-credential-value-local-read-task-v0",
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-access-authorized-local-proof-v0"),
      "Approval: required before local read shell can be completed",
      "Task Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-tasks",
      "Local read task created: " + Boolean(summary.credentialValueLocalReadTaskCreated),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Next: openclaw-cloud-consciousness-live-provider-credential-value-local-read-approved-deferred",
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadTaskShellReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueLocalReadTaskShellCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-task-shell";
    cloudLiveProviderCredentialValueLocalReadTaskShellJson.textContent = "Unable to read live provider credential value local read task shell readiness.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadApprovedDeferred() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-local-read-approved-deferred\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadApprovedDeferredReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadApprovedDeferredSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderCredentialValueLocalReadApprovedDeferredCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadApprovedDeferredNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-final-readiness-preflight";
    cloudLiveProviderCredentialValueLocalReadApprovedDeferredJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-approved-deferred-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Approved deferred evidence: " + Boolean(summary.approvedDeferredEvidenceFound),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-task-v0"),
      "Local read task approved: " + Boolean(summary.credentialValueLocalReadTaskApproved),
      "Local read deferred: " + Boolean(summary.credentialValueLocalReadDeferred),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-approved-deferred",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-final-readiness-preflight"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadApprovedDeferredReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadApprovedDeferredSource.textContent = "none";
    cloudLiveProviderCredentialValueLocalReadApprovedDeferredCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadApprovedDeferredNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-final-readiness-preflight";
    cloudLiveProviderCredentialValueLocalReadApprovedDeferredJson.textContent = "Unable to read live provider credential value local read approved deferred evidence.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadFinalReadinessPreflight() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-local-read-final-readiness-preflight\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadFinalReadinessPreflightReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadFinalReadinessPreflightSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderCredentialValueLocalReadFinalReadinessPreflightCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadFinalReadinessPreflightNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-route";
    cloudLiveProviderCredentialValueLocalReadFinalReadinessPreflightJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-final-readiness-preflight-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Recorded: " + Boolean(summary.credentialValueLocalReadFinalReadinessPreflightRecorded),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-approved-deferred-v0"),
      "Local read task approved: " + Boolean(summary.credentialValueLocalReadTaskApproved),
      "Local read deferred: " + Boolean(summary.credentialValueLocalReadDeferred),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-final-readiness-preflight",
      "Record Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-final-readiness-preflight",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-route"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadFinalReadinessPreflightReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadFinalReadinessPreflightSource.textContent = "none";
    cloudLiveProviderCredentialValueLocalReadFinalReadinessPreflightCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadFinalReadinessPreflightNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-route";
    cloudLiveProviderCredentialValueLocalReadFinalReadinessPreflightJson.textContent = "Unable to read live provider credential value local read final readiness preflight.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionRoute() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-local-read-execution-route\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadExecutionRouteReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadExecutionRouteCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionRouteNetwork.textContent = summary.networkEgress === true ? "egress" : "no egress";
    cloudLiveProviderCredentialValueLocalReadExecutionRouteNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-task-shell";
    cloudLiveProviderCredentialValueLocalReadExecutionRouteJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-route-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-final-readiness-preflight-v0"),
      "Selected: " + (summary.selectedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-task-shell"),
      "Local read execution task created: " + Boolean(summary.credentialValueLocalReadExecutionTaskCreated),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-route",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-task-shell"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadExecutionRouteReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionRouteCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionRouteNetwork.textContent = "no egress";
    cloudLiveProviderCredentialValueLocalReadExecutionRouteNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-task-shell";
    cloudLiveProviderCredentialValueLocalReadExecutionRouteJson.textContent = "Unable to read live provider credential value local read execution route.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionTaskShell() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-local-read-execution-route\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadExecutionTaskShellReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadExecutionTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueLocalReadExecutionTaskShellCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-approved-deferred";
    cloudLiveProviderCredentialValueLocalReadExecutionTaskShellJson.textContent = [
      "Task Registry: openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-task-v0",
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-route-v0"),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Ready: " + Boolean(summary.ready),
      "Approval required: true",
      "Task Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-tasks",
      "Credential value local read execution task created on demand: false",
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Next: openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-approved-deferred",
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadExecutionTaskShellReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueLocalReadExecutionTaskShellCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-task-shell";
    cloudLiveProviderCredentialValueLocalReadExecutionTaskShellJson.textContent = "Unable to read live provider credential value local read execution task shell readiness.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionApprovedDeferred() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-local-read-execution-approved-deferred\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadExecutionApprovedDeferredReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadExecutionApprovedDeferredSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderCredentialValueLocalReadExecutionApprovedDeferredCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionApprovedDeferredNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-final-readiness-preflight";
    cloudLiveProviderCredentialValueLocalReadExecutionApprovedDeferredJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-approved-deferred-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Approved deferred evidence: " + Boolean(summary.approvedDeferredEvidenceFound),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-task-v0"),
      "Local read execution task approved: " + Boolean(summary.credentialValueLocalReadExecutionTaskApproved),
      "Local read execution deferred: " + Boolean(summary.credentialValueLocalReadExecutionDeferred),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-approved-deferred",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-final-readiness-preflight"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadExecutionApprovedDeferredReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionApprovedDeferredSource.textContent = "none";
    cloudLiveProviderCredentialValueLocalReadExecutionApprovedDeferredCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionApprovedDeferredNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-final-readiness-preflight";
    cloudLiveProviderCredentialValueLocalReadExecutionApprovedDeferredJson.textContent = "Unable to read live provider credential value local read execution approved deferred evidence.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflight() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-local-read-execution-final-readiness-preflight\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflightReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflightSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflightCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflightNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-route";
    cloudLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflightJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-final-readiness-preflight-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Recorded: " + Boolean(summary.credentialValueLocalReadExecutionFinalReadinessPreflightRecorded),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-approved-deferred-v0"),
      "Local read execution task approved: " + Boolean(summary.credentialValueLocalReadExecutionTaskApproved),
      "Local read execution deferred: " + Boolean(summary.credentialValueLocalReadExecutionDeferred),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-final-readiness-preflight",
      "Record Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-final-readiness-preflight",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-route"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflightReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflightSource.textContent = "none";
    cloudLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflightCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflightNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-route";
    cloudLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflightJson.textContent = "Unable to read live provider credential value local read execution final readiness preflight.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadRoute() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-route\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadRouteReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadRouteCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadRouteNetwork.textContent = summary.networkEgress === true ? "egress" : "no egress";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadRouteNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-task-shell";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadRouteJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-route-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-final-readiness-preflight-v0"),
      "Selected: " + (summary.selectedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-task-shell"),
      "Local read execution local-read task created: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadTaskCreated),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Live provider call: " + Boolean(summary.liveProviderCallEnabled),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-route",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-task-shell"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadRouteReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadRouteCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadRouteNetwork.textContent = "no egress";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadRouteNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-task-shell";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadRouteJson.textContent = "Unable to read live provider credential value local read execution local read route.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadTaskShell() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-route\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadTaskShellReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadTaskShellCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-approved-deferred";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadTaskShellJson.textContent = [
      "Task Registry: openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-task-v0",
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-route-v0"),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Ready: " + Boolean(summary.ready),
      "Approval required: true",
      "Task Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-tasks",
      "Credential value local read execution local-read task created on demand: false",
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Next: openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-approved-deferred",
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadTaskShellReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadTaskShellApproval.textContent = "required";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadTaskShellCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadTaskShellNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-task-shell";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadTaskShellJson.textContent = "Unable to read live provider credential value local read execution local read task shell readiness.";
  }
}

async function refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferred() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-approved-deferred\`);
    const summary = data.summary ?? {};
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferredReady.textContent = String(Boolean(summary.ready));
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferredSource.textContent = summary.sourceTaskId ?? "none";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferredCredential.textContent = summary.credentialValueRead === true ? "read" : "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferredNext.textContent = data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-final-readiness-preflight";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferredJson.textContent = [
      "Registry: " + (data.registry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-approved-deferred-v0"),
      "Ready: " + Boolean(summary.ready) + " percent=" + (summary.completionPercent ?? 0),
      "Approved deferred evidence: " + Boolean(summary.approvedDeferredEvidenceFound),
      "Source Task: " + (summary.sourceTaskId ?? "none"),
      "Source Registry: " + (summary.sourceRegistry ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-task-v0"),
      "Local read execution local-read task approved: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadTaskApproved),
      "Local read execution local-read deferred: " + Boolean(summary.credentialValueLocalReadExecutionLocalReadDeferred),
      "Credential value read: " + Boolean(summary.credentialValueRead),
      "Provider credential read: " + Boolean(summary.providerCredentialRead),
      "Endpoint contacted: " + Boolean(summary.endpointContacted),
      "Network egress: " + Boolean(summary.networkEgress),
      "Endpoint: /cloud-consciousness/live-provider-credential-value-local-read-execution-local-read-approved-deferred",
      "Next: " + (data.next?.recommendedSlice ?? "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-final-readiness-preflight"),
    ].join("\\n");
  } catch {
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferredReady.textContent = "false";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferredSource.textContent = "none";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferredCredential.textContent = "not read";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferredNext.textContent = "openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-final-readiness-preflight";
    cloudLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferredJson.textContent = "Unable to read live provider credential value local read execution local read approved deferred evidence.";
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

async function refreshHealthTrends() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/health/trends\`);
    const summary = data.summary ?? {};
    const resources = data.resources ?? {};
    const services = Array.isArray(data.services) ? data.services : [];
    healthTrendSampleCount.textContent = String(summary.sampleCount ?? 0);
    healthTrendStableServices.textContent = String(summary.stableServices ?? 0);
    healthTrendDegradedServices.textContent = String(summary.degradedServices ?? 0);
    healthTrendAlertCount.textContent = String(summary.latestAlertCount ?? 0);
    healthTrendJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(data.governance?.hostMutation)} recovery=\${Boolean(data.governance?.triggersRecovery)}\`,
      \`Window: \${summary.windowStart ?? "none"} -> \${summary.windowEnd ?? "none"} samples=\${summary.sampleCount ?? 0}\`,
      \`Services: online=\${summary.latestOnlineServices ?? 0}/\${summary.latestTotalServices ?? 0} stable=\${summary.stableServices ?? 0} degraded=\${summary.degradedServices ?? 0}\`,
      \`Resources: cpu=\${resources.cpuPercent?.latest ?? "n/a"}% memory=\${resources.memoryPercent?.latest ?? "n/a"}% disk=\${resources.diskPercent?.latest ?? "n/a"}%\`,
      \`Service trends: \${services.map((service) => \`\${service.service}:\${service.latestStatus}/offline=\${service.offline}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "route-aware recommendation"}\`,
    ].join("\\n");
  } catch {
    healthTrendSampleCount.textContent = "0";
    healthTrendStableServices.textContent = "0";
    healthTrendDegradedServices.textContent = "0";
    healthTrendAlertCount.textContent = "0";
    healthTrendJson.textContent = "Unable to read OpenClaw health trend summary.";
  }
}

async function refreshRouteAwareNextAction() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/next-action\`);
    const recommendation = data.recommendation ?? {};
    const governance = data.governance ?? {};
    const evidence = data.evidence ?? {};
    routeNextActionName.textContent = recommendation.action ?? "unknown";
    routeNextActionPriority.textContent = recommendation.priority ?? "unknown";
    routeNextActionCreatesTask.textContent = String(Boolean(governance.createsTask));
    routeNextActionMutation.textContent = String(Boolean(governance.hostMutation));
    routeNextActionJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} recovery=\${Boolean(governance.triggersRecovery)}\`,
      \`Recommendation: \${recommendation.action ?? "unknown"} priority=\${recommendation.priority ?? "unknown"}\`,
      \`Reason: \${recommendation.reason ?? "none"}\`,
      \`Targets: \${(recommendation.targets ?? []).join(", ") || "none"}\`,
      \`Evidence: dependencyNodes=\${evidence.dependency?.nodes ?? 0} highImpact=\${evidence.dependency?.highImpact ?? 0} healthSamples=\${evidence.health?.samples ?? 0} degraded=\${evidence.health?.degradedServices ?? 0}\`,
      \`Candidates: \${(data.candidates ?? []).map((candidate) => \`\${candidate.id}:allowed=\${Boolean(candidate.allowedNow)} mutation=\${Boolean(candidate.mutation)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "policy explanation"}\`,
    ].join("\\n");
  } catch {
    routeNextActionName.textContent = "offline";
    routeNextActionPriority.textContent = "unknown";
    routeNextActionCreatesTask.textContent = "false";
    routeNextActionMutation.textContent = "false";
    routeNextActionJson.textContent = "Unable to read route-aware next-action recommendation.";
  }
}

async function refreshConservativeRecoveryPolicy() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/recovery-policy\`);
    const governance = data.governance ?? {};
    const policy = data.policy ?? {};
    const routeState = data.routeState ?? {};
    const hardBoundaries = data.hardBoundaries ?? {};
    recoveryPolicyPosture.textContent = policy.currentPosture ?? "unknown";
    recoveryPolicyCreatesTask.textContent = String(Boolean(governance.createsTask));
    recoveryPolicyExecutesCommand.textContent = String(Boolean(governance.executesCommand));
    recoveryPolicyMutation.textContent = String(Boolean(governance.hostMutation));
    recoveryPolicyJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)}\`,
      \`Policy: \${policy.name ?? "unknown"} posture=\${policy.currentPosture ?? "unknown"}\`,
      \`Reason: \${policy.currentReason ?? "none"}\`,
      \`Route: action=\${routeState.action ?? "unknown"} priority=\${routeState.priority ?? "unknown"} degraded=\${routeState.degradedServices ?? 0} alerts=\${routeState.latestAlertCount ?? 0}\`,
      \`Evidence: dependencyNodes=\${routeState.dependencyNodes ?? 0} highImpact=\${routeState.highImpactNodes ?? 0} healthSamples=\${routeState.healthSamples ?? 0}\`,
      \`Rules: \${(data.rules ?? []).map((rule) => \`\${rule.id}:mutation=\${Boolean(rule.mutation)} createsTask=\${Boolean(rule.createsTask)}\`).join(", ")}\`,
      \`Boundaries: noTask=\${Boolean(hardBoundaries.noTaskCreation)} noCommand=\${Boolean(hardBoundaries.noCommandExecution)} noMutation=\${Boolean(hardBoundaries.noHostMutation)} noScheduler=\${Boolean(hardBoundaries.noScheduler)}\`,
      \`Next: \${data.next?.recommendedSlice ?? "body governance readiness"}\`,
    ].join("\\n");
  } catch {
    recoveryPolicyPosture.textContent = "offline";
    recoveryPolicyCreatesTask.textContent = "false";
    recoveryPolicyExecutesCommand.textContent = "false";
    recoveryPolicyMutation.textContent = "false";
    recoveryPolicyJson.textContent = "Unable to read conservative recovery policy explanation.";
  }
}

async function refreshBodyGovernanceReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-governance-readiness\`);
    const governance = data.governance ?? {};
    const summary = data.summary ?? {};
    const evidence = data.evidence ?? {};
    const completedTrack = data.completedTrack ?? {};
    bodyGovernanceReady.textContent = String(Boolean(summary.ready));
    bodyGovernanceChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? 0}\`;
    bodyGovernancePosture.textContent = summary.currentPosture ?? "unknown";
    bodyGovernanceMutation.textContent = String(Boolean(governance.hostMutation));
    bodyGovernanceJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} ready=\${Boolean(summary.ready)} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)}\`,
      \`Checks: \${summary.passedChecks ?? 0}/\${summary.totalChecks ?? 0} posture=\${summary.currentPosture ?? "unknown"} action=\${summary.routeAction ?? "unknown"} priority=\${summary.routePriority ?? "unknown"}\`,
      \`Evidence: dependencyNodes=\${evidence.dependencyNodes ?? 0} highImpact=\${evidence.highImpactNodes ?? 0} healthSamples=\${evidence.healthSamples ?? 0} policyRules=\${evidence.policyRules ?? 0}\`,
      \`Completed: \${completedTrack.name ?? "unknown"} claim=\${completedTrack.completionClaim ?? "unknown"}\`,
      \`Slices: \${(completedTrack.completedSlices ?? []).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "phase 2 route review"}\`,
    ].join("\\n");
  } catch {
    bodyGovernanceReady.textContent = "false";
    bodyGovernanceChecks.textContent = "0/0";
    bodyGovernancePosture.textContent = "offline";
    bodyGovernanceMutation.textContent = "false";
    bodyGovernanceJson.textContent = "Unable to read body governance readiness bundle.";
  }
}

async function refreshBodyEvidenceTimeline() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-timeline\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const memory = data.memoryModel ?? {};
    bodyEvidenceTimelineReady.textContent = String(Boolean(summary.timelineReady));
    bodyEvidenceTimelineEntries.textContent = String(summary.entries ?? entries.length);
    bodyEvidenceTimelineLatest.textContent = summary.latestEntryId ?? "unknown";
    bodyEvidenceTimelineMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceTimelineJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} ready=\${Boolean(summary.timelineReady)} entries=\${summary.entries ?? entries.length} phases=\${(summary.phases ?? []).join(",")}\`,
      \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} recovery=\${Boolean(governance.triggersRecovery)}\`,
      \`Latest: \${summary.latestEntryId ?? "none"} registry=\${summary.latestRegistry ?? "none"} candidateDemoReady=\${Boolean(summary.candidateDemoReady)} nextRepairDemoReady=\${Boolean(summary.nextRepairDemoReady)} bodyGovernanceReady=\${Boolean(summary.bodyGovernanceReady)}\`,
      \`Entries: \${entries.map((entry) => \`\${entry.id}:\${entry.registry}:\${entry.phase}:mutation=\${Boolean(entry.mutation)}\`).join(", ")}\`,
      \`Memory: \${memory.label ?? "body_evidence_memory_v0"} purpose=\${memory.purpose ?? "none"}\`,
      \`Operator Use: \${(memory.operatorUse ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-timeline-readiness"} boundary=\${data.next?.boundary ?? "read-only readiness"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceTimelineReady.textContent = "false";
    bodyEvidenceTimelineEntries.textContent = "0";
    bodyEvidenceTimelineLatest.textContent = "offline";
    bodyEvidenceTimelineMutation.textContent = "false";
    bodyEvidenceTimelineJson.textContent = "Unable to read body evidence timeline.";
  }
}

async function refreshBodyEvidenceTimelineReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-timeline-readiness\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checks = Array.isArray(data.checks) ? data.checks : [];
    bodyEvidenceTimelineReadinessReady.textContent = String(Boolean(summary.ready));
    bodyEvidenceTimelineReadinessChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checks.length}\`;
    bodyEvidenceTimelineReadinessLatest.textContent = summary.latestEntryId ?? "unknown";
    bodyEvidenceTimelineReadinessMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceTimelineReadinessJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} ready=\${Boolean(summary.ready)} checks=\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checks.length} entries=\${summary.timelineEntries ?? 0}\`,
      \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} recovery=\${Boolean(governance.triggersRecovery)}\`,
      \`Checks: \${checks.map((check) => \`\${check.id}=\${Boolean(check.passed)}\`).join(", ")}\`,
      \`Completed: \${data.completedBlock?.completionClaim ?? "unknown"} slices=\${(data.completedBlock?.completedSlices ?? []).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-phase-2-next-capability-route-review"} boundary=\${data.next?.boundary ?? "whitepaper route review"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceTimelineReadinessReady.textContent = "false";
    bodyEvidenceTimelineReadinessChecks.textContent = "0/0";
    bodyEvidenceTimelineReadinessLatest.textContent = "offline";
    bodyEvidenceTimelineReadinessMutation.textContent = "false";
    bodyEvidenceTimelineReadinessJson.textContent = "Unable to read body evidence timeline readiness.";
  }
}

async function refreshBodyEvidenceLedgerPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-plan\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const plan = data.plan ?? {};
    const schema = plan.plannedRecordSchema ?? {};
    const gates = Array.isArray(plan.writeGates) ? plan.writeGates : [];
    bodyEvidenceLedgerPlanReady.textContent = String(Boolean(summary.planReady));
    bodyEvidenceLedgerPlanSchema.textContent = summary.plannedSchema ?? schema.version ?? "unknown";
    bodyEvidenceLedgerPlanGates.textContent = String(summary.writeGateCount ?? gates.length);
    bodyEvidenceLedgerPlanWritten.textContent = String(Boolean(summary.durableStorageWritten));
    bodyEvidenceLedgerPlanJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} planReady=\${Boolean(summary.planReady)} timelineReady=\${Boolean(summary.timelineReady)} durableStorageWritten=\${Boolean(summary.durableStorageWritten)}\`,
      \`Governance: canWriteLedger=\${Boolean(governance.canWriteLedger)} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} storageWritten=\${Boolean(governance.durableStorageWritten)}\`,
      \`Schema: \${schema.version ?? "unknown"} required=\${(schema.requiredFields ?? []).join(",")}\`,
      \`Content: \${schema.contentPolicy ?? "unknown"}\`,
      \`Storage: \${plan.storageMode ?? "unknown"} status=\${plan.implementationStatus ?? "unknown"}\`,
      \`Write Gates: \${gates.map((gate) => \`\${gate.id}:required=\${Boolean(gate.requiredBeforeWrite)} passed=\${Boolean(gate.passed)}\`).join(", ")}\`,
      \`Verification: \${(plan.verificationPlan ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-route-review"} boundary=\${data.next?.boundary ?? "route review before writes"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerPlanReady.textContent = "false";
    bodyEvidenceLedgerPlanSchema.textContent = "offline";
    bodyEvidenceLedgerPlanGates.textContent = "0";
    bodyEvidenceLedgerPlanWritten.textContent = "false";
    bodyEvidenceLedgerPlanJson.textContent = "Unable to read body evidence ledger plan.";
  }
}

async function refreshBodyEvidenceLedgerRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-route-review\`);
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    bodyEvidenceLedgerRouteReviewStatus.textContent = decision.status ?? "unknown";
    bodyEvidenceLedgerRouteReviewNext.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    bodyEvidenceLedgerRouteReviewWrite.textContent = String(Boolean(governance.canWriteLedger));
    bodyEvidenceLedgerRouteReviewMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceLedgerRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} canWriteLedger=\${Boolean(governance.canWriteLedger)} storageWritten=\${Boolean(governance.durableStorageWritten)} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: ledgerPlanReady=\${Boolean(evidence.ledgerPlanReady)} schema=\${evidence.plannedSchema ?? "unknown"} gates=\${evidence.writeGateCount ?? 0} unmet=\${(evidence.unmetWriteGateIds ?? []).join(",") || "none"} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      \`Candidates: \${candidates.map((candidate) => \`\${candidate.id}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}:write=\${Boolean(candidate.durableWrite)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-storage-root-plan"} boundary=\${data.next?.boundary ?? "storage root plan before writes"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerRouteReviewStatus.textContent = "offline";
    bodyEvidenceLedgerRouteReviewNext.textContent = "unknown";
    bodyEvidenceLedgerRouteReviewWrite.textContent = "false";
    bodyEvidenceLedgerRouteReviewMutation.textContent = "false";
    bodyEvidenceLedgerRouteReviewJson.textContent = "Unable to read body evidence ledger route review.";
  }
}

async function refreshBodyEvidenceLedgerStorageRootPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-storage-root-plan\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const plan = data.plan ?? {};
    const selectedRoot = plan.selectedRoot ?? {};
    const candidateRoots = Array.isArray(plan.candidateRoots) ? plan.candidateRoots : [];
    bodyEvidenceLedgerStorageRootPlanReady.textContent = String(Boolean(summary.planReady));
    bodyEvidenceLedgerStorageRootPlanRoot.textContent = summary.selectedDisplayPath ?? selectedRoot.displayPath ?? "unknown";
    bodyEvidenceLedgerStorageRootPlanCreated.textContent = String(Boolean(summary.directoryCreated));
    bodyEvidenceLedgerStorageRootPlanWritten.textContent = String(Boolean(summary.durableStorageWritten));
    bodyEvidenceLedgerStorageRootPlanJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} planReady=\${Boolean(summary.planReady)} routeReviewReady=\${Boolean(summary.routeReviewReady)} directoryCreated=\${Boolean(summary.directoryCreated)} durableStorageWritten=\${Boolean(summary.durableStorageWritten)}\`,
      \`Governance: canCreateDirectory=\${Boolean(governance.canCreateDirectory)} canWriteLedger=\${Boolean(governance.canWriteLedger)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} storageWritten=\${Boolean(governance.durableStorageWritten)}\`,
      \`Selected: \${selectedRoot.id ?? "unknown"} path=\${selectedRoot.displayPath ?? "unknown"} policy=\${selectedRoot.rootPolicy ?? "unknown"}\`,
      \`Candidates: \${candidateRoots.map((root) => \`\${root.id}:\${root.displayPath}:recommended=\${Boolean(root.recommended)}:createsNow=\${Boolean(root.createsDirectoryNow)}:writesNow=\${Boolean(root.writesRecordsNow)}\`).join(", ")}\`,
      \`Path Policy: workspace=\${Boolean(plan.pathPolicy?.mustStayInsideWorkspace)} observerVisible=\${Boolean(plan.pathPolicy?.mustBeObserverVisible)} noCreate=\${Boolean(plan.pathPolicy?.mustNotCreateDirectoryInThisSlice)}\`,
      \`Pre-write Checks: \${(plan.preWriteChecks ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-storage-root-route-review"} boundary=\${data.next?.boundary ?? "route review before directory creation"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerStorageRootPlanReady.textContent = "false";
    bodyEvidenceLedgerStorageRootPlanRoot.textContent = "offline";
    bodyEvidenceLedgerStorageRootPlanCreated.textContent = "false";
    bodyEvidenceLedgerStorageRootPlanWritten.textContent = "false";
    bodyEvidenceLedgerStorageRootPlanJson.textContent = "Unable to read body evidence ledger storage root plan.";
  }
}

async function refreshBodyEvidenceLedgerStorageRootRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-storage-root-route-review\`);
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    bodyEvidenceLedgerStorageRootRouteReviewStatus.textContent = decision.status ?? "unknown";
    bodyEvidenceLedgerStorageRootRouteReviewNext.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    bodyEvidenceLedgerStorageRootRouteReviewCreate.textContent = String(Boolean(governance.canCreateDirectory));
    bodyEvidenceLedgerStorageRootRouteReviewWritten.textContent = String(Boolean(governance.durableStorageWritten));
    bodyEvidenceLedgerStorageRootRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} canCreateDirectory=\${Boolean(governance.canCreateDirectory)} canWriteLedger=\${Boolean(governance.canWriteLedger)} storageWritten=\${Boolean(governance.durableStorageWritten)} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: root=\${evidence.selectedDisplayPath ?? "unknown"} insideWorkspace=\${Boolean(evidence.rootInsideWorkspace)} directoryCreated=\${Boolean(evidence.directoryCreated)} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      \`Pre-write Checks: \${(evidence.preWriteChecks ?? []).join(" | ")}\`,
      \`Candidates: \${candidates.map((candidate) => \`\${candidate.id}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}:mutation=\${Boolean(candidate.mutation)}:write=\${Boolean(candidate.durableWrite)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-directory-task"} boundary=\${data.next?.boundary ?? "directory task before record writes"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerStorageRootRouteReviewStatus.textContent = "offline";
    bodyEvidenceLedgerStorageRootRouteReviewNext.textContent = "unknown";
    bodyEvidenceLedgerStorageRootRouteReviewCreate.textContent = "false";
    bodyEvidenceLedgerStorageRootRouteReviewWritten.textContent = "false";
    bodyEvidenceLedgerStorageRootRouteReviewJson.textContent = "Unable to read body evidence ledger storage root route review.";
  }
}

async function refreshBodyEvidenceLedgerDirectoryTask() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-storage-root-route-review\`);
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const ready = decision.selectedSlice === "openclaw-body-evidence-ledger-directory-task"
      && decision.status === "selected"
      && evidence.rootInsideWorkspace === true;
    bodyEvidenceLedgerDirectoryTaskReady.textContent = String(ready);
    bodyEvidenceLedgerDirectoryTaskTarget.textContent = evidence.selectedDisplayPath ?? "unknown";
    bodyEvidenceLedgerDirectoryTaskApproval.textContent = ready ? "pending-after-create" : "route-blocked";
    bodyEvidenceLedgerDirectoryTaskCreated.textContent = String(Boolean(evidence.directoryCreated));
    bodyEvidenceLedgerDirectoryTaskJson.textContent = [
      "Registry: openclaw-body-evidence-ledger-directory-task-v0",
      \`Source Route: \${data.registry ?? "unknown"}\`,
      \`Mode: approval-gated-ledger-directory-task-shell ready=\${ready}\`,
      \`Target: \${evidence.selectedDisplayPath ?? "unknown"} insideWorkspace=\${Boolean(evidence.rootInsideWorkspace)} directoryCreated=\${Boolean(evidence.directoryCreated)} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      "Approval: creates pending medium-risk approval only after explicit button click",
      "Governance: createsTaskOnClick=true createsApprovalOnClick=true canCreateDirectory=false canWriteLedger=false mutation=false executed=false",
      "Endpoint: /body/evidence-ledger/directory-tasks",
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerDirectoryTaskReady.textContent = "false";
    bodyEvidenceLedgerDirectoryTaskTarget.textContent = "offline";
    bodyEvidenceLedgerDirectoryTaskApproval.textContent = "route-blocked";
    bodyEvidenceLedgerDirectoryTaskCreated.textContent = "false";
    bodyEvidenceLedgerDirectoryTaskJson.textContent = "Unable to read body evidence ledger directory task boundary.";
  }
}

async function refreshBodyEvidenceLedgerFirstRecordPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-first-record-plan\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const plan = data.plan ?? {};
    const record = plan.plannedRecord ?? {};
    bodyEvidenceLedgerFirstRecordPlanReady.textContent = String(Boolean(summary.planReady));
    bodyEvidenceLedgerFirstRecordPlanType.textContent = summary.plannedRecordType ?? record.evidenceType ?? "unknown";
    bodyEvidenceLedgerFirstRecordPlanDirectory.textContent = String(Boolean(summary.directoryExists));
    bodyEvidenceLedgerFirstRecordPlanWritten.textContent = String(Boolean(summary.durableStorageWritten));
    bodyEvidenceLedgerFirstRecordPlanJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} planReady=\${Boolean(summary.planReady)} ledgerPlanReady=\${Boolean(summary.ledgerPlanReady)} timelineReady=\${Boolean(summary.timelineReady)} directoryExists=\${Boolean(summary.directoryExists)} durableStorageWritten=\${Boolean(summary.durableStorageWritten)}\`,
      \`Governance: canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)}\`,
      \`Root: \${plan.ledgerRoot?.displayPath ?? "unknown"} resolved=\${plan.ledgerRoot?.resolvedPath ?? "unknown"} exists=\${Boolean(plan.ledgerRoot?.exists)}\`,
      \`Record: version=\${record.version ?? "unknown"} type=\${record.evidenceType ?? "unknown"} source=\${record.sourceRegistry ?? "unknown"} endpoint=\${record.sourceEndpoint ?? "unknown"}\`,
      \`Hash: \${record.contentHashStrategy ?? "unknown"}\`,
      \`Required: \${(plan.requiredFields ?? []).join(",")}\`,
      \`Pre-append Checks: \${(plan.preAppendChecks ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-first-record-route-review"} boundary=\${data.next?.boundary ?? "route review before first append"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFirstRecordPlanReady.textContent = "false";
    bodyEvidenceLedgerFirstRecordPlanType.textContent = "offline";
    bodyEvidenceLedgerFirstRecordPlanDirectory.textContent = "false";
    bodyEvidenceLedgerFirstRecordPlanWritten.textContent = "false";
    bodyEvidenceLedgerFirstRecordPlanJson.textContent = "Unable to read body evidence ledger first record plan.";
  }
}

async function refreshBodyEvidenceLedgerFirstRecordRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-first-record-route-review\`);
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    bodyEvidenceLedgerFirstRecordRouteReviewStatus.textContent = decision.status ?? "unknown";
    bodyEvidenceLedgerFirstRecordRouteReviewNext.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    bodyEvidenceLedgerFirstRecordRouteReviewWrite.textContent = String(Boolean(governance.canAppendLedgerRecord));
    bodyEvidenceLedgerFirstRecordRouteReviewWritten.textContent = String(Boolean(governance.durableStorageWritten));
    bodyEvidenceLedgerFirstRecordRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} storageWritten=\${Boolean(governance.durableStorageWritten)} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} scheduler=\${Boolean(governance.schedulesFollowUp)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: planReady=\${Boolean(evidence.firstRecordPlanReady)} recordType=\${evidence.plannedRecordType ?? "unknown"} directoryExists=\${Boolean(evidence.directoryExists)} source=\${evidence.sourceRegistry ?? "unknown"} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      \`Pre-append Checks: \${(evidence.preAppendChecks ?? []).join(" | ")}\`,
      \`Candidates: \${candidates.map((candidate) => \`\${candidate.id}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}:mutation=\${Boolean(candidate.mutation)}:write=\${Boolean(candidate.durableWrite)}:scheduler=\${Boolean(candidate.scheduler)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-first-record-task"} boundary=\${data.next?.boundary ?? "approval-gated task shell before first append"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFirstRecordRouteReviewStatus.textContent = "offline";
    bodyEvidenceLedgerFirstRecordRouteReviewNext.textContent = "unknown";
    bodyEvidenceLedgerFirstRecordRouteReviewWrite.textContent = "false";
    bodyEvidenceLedgerFirstRecordRouteReviewWritten.textContent = "false";
    bodyEvidenceLedgerFirstRecordRouteReviewJson.textContent = "Unable to read body evidence ledger first record route review.";
  }
}

async function refreshBodyEvidenceLedgerFirstRecordTask() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-first-record-route-review\`);
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const ready = decision.selectedSlice === "openclaw-body-evidence-ledger-first-record-task"
      && decision.status === "selected"
      && evidence.firstRecordPlanReady === true
      && evidence.directoryExists === true;
    bodyEvidenceLedgerFirstRecordTaskReady.textContent = String(ready);
    bodyEvidenceLedgerFirstRecordTaskType.textContent = evidence.plannedRecordType ?? "unknown";
    bodyEvidenceLedgerFirstRecordTaskApproval.textContent = ready ? "pending-after-create" : "route-blocked";
    bodyEvidenceLedgerFirstRecordTaskAppended.textContent = "false";
    bodyEvidenceLedgerFirstRecordTaskJson.textContent = [
      "Registry: openclaw-body-evidence-ledger-first-record-task-v0",
      \`Source Route: \${data.registry ?? "unknown"}\`,
      \`Mode: approval-gated-ledger-first-record-task-shell ready=\${ready}\`,
      \`Record: type=\${evidence.plannedRecordType ?? "unknown"} source=\${evidence.sourceRegistry ?? "unknown"} requiredFields=\${evidence.requiredFieldCount ?? 0} directoryExists=\${Boolean(evidence.directoryExists)} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      "Approval: creates pending medium-risk approval only after explicit button click",
      "Governance: createsTaskOnClick=true createsApprovalOnClick=true canAppendLedgerRecord=false canWriteLedger=false mutation=false appended=false",
      "Endpoint: /body/evidence-ledger/first-record-tasks",
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFirstRecordTaskReady.textContent = "false";
    bodyEvidenceLedgerFirstRecordTaskType.textContent = "offline";
    bodyEvidenceLedgerFirstRecordTaskApproval.textContent = "route-blocked";
    bodyEvidenceLedgerFirstRecordTaskAppended.textContent = "false";
    bodyEvidenceLedgerFirstRecordTaskJson.textContent = "Unable to read body evidence ledger first record task boundary.";
  }
}

async function refreshBodyEvidenceLedgerReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-readiness\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checks = Array.isArray(data.checks) ? data.checks : [];
    const records = Array.isArray(data.evidence?.records) ? data.evidence.records : [];
    bodyEvidenceLedgerReadinessReady.textContent = String(Boolean(summary.ready));
    bodyEvidenceLedgerReadinessChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checks.length}\`;
    bodyEvidenceLedgerReadinessRecords.textContent = String(summary.recordCount ?? records.length);
    bodyEvidenceLedgerReadinessMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceLedgerReadinessJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} ready=\${Boolean(summary.ready)} records=\${summary.recordCount ?? records.length} bootstrap=\${summary.bootstrapRecordCount ?? 0} file=\${summary.ledgerFile ?? "unknown"} exists=\${Boolean(summary.ledgerFileExists)}\`,
      \`Governance: canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)} bulkImport=\${Boolean(governance.bulkImport)}\`,
      \`Checks: \${checks.map((check) => \`\${check.id}=\${Boolean(check.passed)}\`).join(", ")}\`,
      \`Records: \${records.map((record) => \`\${record.id}:\${record.evidenceType}:hash=\${Boolean(record.hashValid)}:source=\${record.sourceRegistry}\`).join(", ") || "none"}\`,
      \`Completed: \${data.completedBlock?.completionClaim ?? "unknown"} slices=\${(data.completedBlock?.completedSlices ?? []).length}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-phase-2-next-capability-route-review"} boundary=\${data.next?.boundary ?? "route review before more ledger writes"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerReadinessReady.textContent = "false";
    bodyEvidenceLedgerReadinessChecks.textContent = "0/0";
    bodyEvidenceLedgerReadinessRecords.textContent = "0";
    bodyEvidenceLedgerReadinessMutation.textContent = "false";
    bodyEvidenceLedgerReadinessJson.textContent = "Unable to read body evidence ledger readiness.";
  }
}

async function refreshBodyEvidenceLedgerDemoStatus() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-demo-status\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checklist = Array.isArray(data.checklist) ? data.checklist : [];
    const narrative = Array.isArray(data.demoNarrative) ? data.demoNarrative : [];
    bodyEvidenceLedgerDemoStatusReady.textContent = String(Boolean(summary.demoReady));
    bodyEvidenceLedgerDemoStatusChecks.textContent = \`\${summary.passed ?? 0}/\${summary.total ?? checklist.length}\`;
    bodyEvidenceLedgerDemoStatusRecord.textContent = summary.bootstrapRecordId ?? "none";
    bodyEvidenceLedgerDemoStatusMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceLedgerDemoStatusJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} demoReady=\${Boolean(summary.demoReady)} ledgerReady=\${Boolean(summary.ledgerReady)} records=\${summary.recordCount ?? 0} file=\${summary.ledgerFile ?? "unknown"}\`,
      \`Record: id=\${summary.bootstrapRecordId ?? "none"} hash=\${summary.bootstrapRecordHash ?? "none"}\`,
      \`Governance: canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)} bulkImport=\${Boolean(governance.bulkImport)}\`,
      \`Checklist: \${checklist.map((item) => \`\${item.id}=\${Boolean(item.passed)}\`).join(", ")}\`,
      \`Narrative: \${narrative.join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-phase-2-next-capability-route-review"} boundary=\${data.next?.boundary ?? "route review before more body capability work"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerDemoStatusReady.textContent = "false";
    bodyEvidenceLedgerDemoStatusChecks.textContent = "0/0";
    bodyEvidenceLedgerDemoStatusRecord.textContent = "offline";
    bodyEvidenceLedgerDemoStatusMutation.textContent = "false";
    bodyEvidenceLedgerDemoStatusJson.textContent = "Unable to read body evidence ledger demo status.";
  }
}

async function refreshBodyEvidenceLedgerFollowupRecordPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-followup-record-plan\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const plan = data.plan ?? {};
    const record = plan.plannedRecord ?? {};
    const existingRecords = Array.isArray(plan.existingRecords) ? plan.existingRecords : [];
    bodyEvidenceLedgerFollowupRecordPlanReady.textContent = String(Boolean(summary.planReady));
    bodyEvidenceLedgerFollowupRecordPlanType.textContent = summary.plannedRecordType ?? record.evidenceType ?? "unknown";
    bodyEvidenceLedgerFollowupRecordPlanRecords.textContent = String(summary.existingRecordCount ?? existingRecords.length);
    bodyEvidenceLedgerFollowupRecordPlanWritten.textContent = String(Boolean(summary.durableStorageWritten));
    bodyEvidenceLedgerFollowupRecordPlanJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} planReady=\${Boolean(summary.planReady)} timelineReady=\${Boolean(summary.timelineReady)} ledgerReady=\${Boolean(summary.ledgerReady)} existingRecords=\${summary.existingRecordCount ?? existingRecords.length} plannedSequence=\${summary.plannedSequence ?? "unknown"}\`,
      \`Governance: canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)} bulkImport=\${Boolean(governance.bulkImport)}\`,
      \`Ledger: \${plan.ledgerFile?.displayPath ?? "unknown"} exists=\${Boolean(plan.ledgerFile?.exists)} lines=\${plan.ledgerFile?.lineCount ?? 0} latest=\${summary.latestRecordId ?? "none"} latestHashValid=\${Boolean(summary.latestRecordHashValid)}\`,
      \`Record: type=\${record.evidenceType ?? "unknown"} source=\${record.sourceRegistry ?? "unknown"} endpoint=\${record.sourceEndpoint ?? "unknown"} sequence=\${record.sequence ?? "unknown"}\`,
      \`Existing: \${existingRecords.map((item) => \`\${item.index}:\${item.id}:\${item.evidenceType}:hash=\${Boolean(item.hashValid)}\`).join(", ") || "none"}\`,
      \`Pre-append Checks: \${(plan.preAppendChecks ?? []).join(" | ")}\`,
      \`Deferred: \${(plan.deferredActions ?? []).join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-phase-2-next-capability-route-review"} boundary=\${data.next?.boundary ?? "route review before follow-up append"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFollowupRecordPlanReady.textContent = "false";
    bodyEvidenceLedgerFollowupRecordPlanType.textContent = "offline";
    bodyEvidenceLedgerFollowupRecordPlanRecords.textContent = "0";
    bodyEvidenceLedgerFollowupRecordPlanWritten.textContent = "false";
    bodyEvidenceLedgerFollowupRecordPlanJson.textContent = "Unable to read body evidence ledger follow-up record plan.";
  }
}

async function refreshBodyEvidenceLedgerFollowupRecordRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-followup-record-route-review\`);
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    bodyEvidenceLedgerFollowupRecordRouteReviewStatus.textContent = decision.status ?? "unknown";
    bodyEvidenceLedgerFollowupRecordRouteReviewNext.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    bodyEvidenceLedgerFollowupRecordRouteReviewWrite.textContent = String(Boolean(governance.canAppendLedgerRecord));
    bodyEvidenceLedgerFollowupRecordRouteReviewWritten.textContent = String(Boolean(governance.durableStorageWritten));
    bodyEvidenceLedgerFollowupRecordRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} storageWritten=\${Boolean(governance.durableStorageWritten)} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: planReady=\${Boolean(evidence.followupRecordPlanReady)} recordType=\${evidence.plannedRecordType ?? "unknown"} sequence=\${evidence.plannedSequence ?? "unknown"} existingRecords=\${evidence.existingRecordCount ?? 0} source=\${evidence.sourceRegistry ?? "unknown"} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      \`Pre-append Checks: \${(evidence.preAppendChecks ?? []).join(" | ")}\`,
      \`Deferred: \${(evidence.deferredActions ?? []).join(" | ")}\`,
      \`Candidates: \${candidates.map((candidate) => \`\${candidate.id}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}:mutation=\${Boolean(candidate.mutation)}:write=\${Boolean(candidate.durableWrite)}:scheduler=\${Boolean(candidate.scheduler)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-body-evidence-ledger-followup-record-task"} boundary=\${data.next?.boundary ?? "future task shell before follow-up append"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFollowupRecordRouteReviewStatus.textContent = "offline";
    bodyEvidenceLedgerFollowupRecordRouteReviewNext.textContent = "unknown";
    bodyEvidenceLedgerFollowupRecordRouteReviewWrite.textContent = "false";
    bodyEvidenceLedgerFollowupRecordRouteReviewWritten.textContent = "false";
    bodyEvidenceLedgerFollowupRecordRouteReviewJson.textContent = "Unable to read body evidence ledger follow-up record route review.";
  }
}

async function refreshBodyEvidenceLedgerFollowupRecordTask() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/body-evidence-ledger-followup-record-route-review\`);
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    const ready = decision.selectedSlice === "openclaw-body-evidence-ledger-followup-record-task"
      && decision.status === "selected"
      && evidence.followupRecordPlanReady === true
      && evidence.plannedRecordType === "body_evidence_timeline_followup"
      && evidence.plannedSequence === 2
      && evidence.existingRecordCount === 1;
    bodyEvidenceLedgerFollowupRecordTaskReady.textContent = String(ready);
    bodyEvidenceLedgerFollowupRecordTaskType.textContent = evidence.plannedRecordType ?? "unknown";
    bodyEvidenceLedgerFollowupRecordTaskApproval.textContent = ready ? "pending-after-create" : "route-blocked";
    bodyEvidenceLedgerFollowupRecordTaskAppended.textContent = "false";
    bodyEvidenceLedgerFollowupRecordTaskJson.textContent = [
      "Registry: openclaw-body-evidence-ledger-followup-record-task-v0",
      \`Source Route: \${data.registry ?? "unknown"}\`,
      \`Mode: approval-gated-ledger-followup-record-task-shell ready=\${ready}\`,
      \`Record: type=\${evidence.plannedRecordType ?? "unknown"} sequence=\${evidence.plannedSequence ?? "unknown"} existingRecords=\${evidence.existingRecordCount ?? 0} source=\${evidence.sourceRegistry ?? "unknown"} latest=\${evidence.latestRecordId ?? "none"} durableStorageWritten=\${Boolean(evidence.durableStorageWritten)}\`,
      "Approval: creates pending medium-risk approval only after explicit button click",
      "Governance: createsTaskOnClick=true createsApprovalOnClick=true canAppendLedgerRecord=false canWriteLedger=false mutation=false appended=false scheduler=false backgroundWriter=false",
      "Endpoint: /body/evidence-ledger/followup-record-tasks",
    ].join("\n");
  } catch {
    bodyEvidenceLedgerFollowupRecordTaskReady.textContent = "false";
    bodyEvidenceLedgerFollowupRecordTaskType.textContent = "offline";
    bodyEvidenceLedgerFollowupRecordTaskApproval.textContent = "route-blocked";
    bodyEvidenceLedgerFollowupRecordTaskAppended.textContent = "false";
    bodyEvidenceLedgerFollowupRecordTaskJson.textContent = "Unable to read body evidence ledger follow-up record task boundary.";
  }
}

async function refreshBodyEvidenceLedgerFollowupRecordReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/body-evidence-ledger-followup-record-readiness\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checklist = Array.isArray(data.checklist) ? data.checklist : [];
    const hardBoundary = Array.isArray(data.evidence?.hardBoundary) ? data.evidence.hardBoundary : [];
    bodyEvidenceLedgerFollowupRecordReadinessReady.textContent = String(Boolean(summary.ready));
    bodyEvidenceLedgerFollowupRecordReadinessChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checklist.length}\`;
    bodyEvidenceLedgerFollowupRecordReadinessRecords.textContent = String(summary.existingRecordCount ?? 0);
    bodyEvidenceLedgerFollowupRecordReadinessMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceLedgerFollowupRecordReadinessJson.textContent = [
      \`Registry: \${data.registry ?? "openclaw-body-evidence-ledger-followup-record-readiness-v0"}\`,
      \`Mode: \${data.mode ?? "unknown"} status=\${data.status ?? "unknown"} ready=\${Boolean(summary.ready)} task=\${summary.taskId ?? "none"} approval=\${summary.approvalStatus ?? "unknown"}\`,
      \`Record: type=\${summary.plannedRecordType ?? "unknown"} sequence=\${summary.plannedSequence ?? "unknown"} existingRecords=\${summary.existingRecordCount ?? 0} appended=\${Boolean(summary.recordAppended)} durableStorageWritten=\${Boolean(summary.durableStorageWritten)}\`,
      \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} canAppendLedgerRecord=\${Boolean(governance.canAppendLedgerRecord)} canWriteLedger=\${Boolean(governance.canWriteLedger)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)} bulkImport=\${Boolean(governance.bulkImport)}\`,
      \`Checklist: \${checklist.map((item) => \`\${item.id}=\${item.status}\`).join(", ")}\`,
      \`Boundary: \${hardBoundary.join(" | ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-phase-2-next-capability-route-review"} boundary=\${data.next?.boundary ?? "route review before any follow-up append"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFollowupRecordReadinessReady.textContent = "false";
    bodyEvidenceLedgerFollowupRecordReadinessChecks.textContent = "0/0";
    bodyEvidenceLedgerFollowupRecordReadinessRecords.textContent = "0";
    bodyEvidenceLedgerFollowupRecordReadinessMutation.textContent = "false";
    bodyEvidenceLedgerFollowupRecordReadinessJson.textContent = "Unable to read body evidence ledger follow-up record readiness.";
  }
}

async function refreshBodyEvidenceLedgerFollowupRecordAppendRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/body-evidence-ledger-followup-record-append-route-review\`);
    const decision = data.decision ?? {};
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewStatus.textContent = decision.status ?? data.status ?? "unknown";
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewNext.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewApproves.textContent = String(Boolean(governance.approvesTask));
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewAppended.textContent = String(Boolean(summary.recordAppended));
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "openclaw-body-evidence-ledger-followup-record-append-route-review-v0"}\`,
      \`Mode: \${data.mode ?? "unknown"} status=\${data.status ?? "unknown"} ready=\${Boolean(summary.ready)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Record: task=\${summary.taskId ?? "none"} approval=\${summary.approvalStatus ?? "unknown"} sequence=\${summary.plannedSequence ?? "unknown"} existingRecords=\${summary.existingRecordCount ?? 0} appended=\${Boolean(summary.recordAppended)}\`,
      \`Governance: readOnly=\${Boolean(governance.readOnly)} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} approvesTask=\${Boolean(governance.approvesTask)} canAppend=\${Boolean(governance.canAppendLedgerRecord)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)}\`,
      \`Append Registry: openclaw-body-evidence-ledger-followup-record-append-v0\`,
      \`Append Endpoint: /body/evidence-ledger/followup-record-append\`,
      \`Next: \${data.next?.recommendedSlice ?? "unknown"} boundary=\${data.next?.boundary ?? "unknown"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewStatus.textContent = "offline";
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewNext.textContent = "unknown";
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewApproves.textContent = "false";
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewAppended.textContent = "false";
    bodyEvidenceLedgerFollowupRecordAppendRouteReviewJson.textContent = "Unable to read body evidence ledger follow-up append route review.";
  }
}

async function refreshBodyEvidenceLedgerFollowupRecordAppendReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/phase-2/body-evidence-ledger-followup-record-append-readiness\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checklist = data.checklist ?? [];
    bodyEvidenceLedgerFollowupRecordAppendReadinessReady.textContent = String(Boolean(summary.ready));
    bodyEvidenceLedgerFollowupRecordAppendReadinessChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checklist.length}\`;
    bodyEvidenceLedgerFollowupRecordAppendReadinessRecords.textContent = String(summary.existingRecordCount ?? 0);
    bodyEvidenceLedgerFollowupRecordAppendReadinessMutation.textContent = String(Boolean(governance.hostMutation));
    bodyEvidenceLedgerFollowupRecordAppendReadinessJson.textContent = [
      \`Registry: \${data.registry ?? "openclaw-body-evidence-ledger-followup-record-append-readiness-v0"}\`,
      \`Mode: \${data.mode ?? "unknown"} status=\${data.status ?? "unknown"} ready=\${Boolean(summary.ready)} checks=\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checklist.length}\`,
      \`Record: task=\${summary.taskId ?? "none"} approval=\${summary.approvalStatus ?? "unknown"} record=\${summary.recordId ?? "none"} previous=\${summary.previousRecordId ?? "none"} records=\${summary.existingRecordCount ?? 0} appended=\${Boolean(summary.recordAppended)} durable=\${Boolean(summary.durableStorageWritten)}\`,
      \`Hash: previous=\${summary.previousRecordHash ?? "none"} current=\${summary.contentHash ?? "none"}\`,
      \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} canAppend=\${Boolean(governance.canAppendLedgerRecord)} mutation=\${Boolean(governance.hostMutation)} scheduler=\${Boolean(governance.schedulesFollowUp)} backgroundWriter=\${Boolean(governance.backgroundWriter)} recovery=\${Boolean(governance.triggersRecovery)}\`,
      \`Next: \${data.next?.recommendedSlice ?? "unknown"} boundary=\${data.next?.boundary ?? "unknown"}\`,
    ].join("\\n");
  } catch {
    bodyEvidenceLedgerFollowupRecordAppendReadinessReady.textContent = "false";
    bodyEvidenceLedgerFollowupRecordAppendReadinessChecks.textContent = "0/0";
    bodyEvidenceLedgerFollowupRecordAppendReadinessRecords.textContent = "0";
    bodyEvidenceLedgerFollowupRecordAppendReadinessMutation.textContent = "false";
    bodyEvidenceLedgerFollowupRecordAppendReadinessJson.textContent = "Unable to read body evidence ledger follow-up append readiness.";
  }
}

async function refreshPhase2RouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/route/phase-2-review\`);
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    phase2RouteSelectedTrack.textContent = decision.selectedTrack ?? "unknown";
    phase2RouteNextSlice.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    phase2RouteCreatesTask.textContent = String(Boolean(governance.createsTask));
    phase2RouteMutation.textContent = String(Boolean(governance.hostMutation));
    phase2RouteJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: trackCReady=\${Boolean(evidence.trackCReady)} checks=\${evidence.trackCChecks ?? "0/0"} completed=\${evidence.completedTrack?.completionClaim ?? "unknown"}\`,
      \`Candidates: \${(data.candidates ?? []).map((candidate) => \`\${candidate.track}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "demo control room"}\`,
    ].join("\\n");
  } catch {
    phase2RouteSelectedTrack.textContent = "offline";
    phase2RouteNextSlice.textContent = "unknown";
    phase2RouteCreatesTask.textContent = "false";
    phase2RouteMutation.textContent = "false";
    phase2RouteJson.textContent = "Unable to read Phase 2 route review.";
  }
}

async function refreshSystemdRepairCandidates() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidates\`);
    const governance = data.governance ?? {};
    const summary = data.summary ?? {};
    const candidates = data.candidates ?? [];
    systemdRepairCandidateCount.textContent = String(summary.totalCandidates ?? candidates.length);
    systemdRepairCandidateRecommended.textContent = summary.recommendedUnit ?? "unknown";
    systemdRepairCandidateCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdRepairCandidateMutation.textContent = String(Boolean(governance.hostMutation));
    systemdRepairCandidateJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Summary: total=\${summary.totalCandidates ?? 0} degraded=\${summary.degradedCandidates ?? 0} demoTargets=\${summary.existingDemoTargets ?? 0} highImpact=\${summary.highImpactCandidates ?? 0}\`,
      \`Recommended: \${summary.recommendedUnit ?? "none"} reason=\${summary.recommendedReason ?? "none"}\`,
      \`Candidates: \${candidates.map((candidate) => \`\${candidate.unit}:score=\${candidate.assessment?.score ?? 0}:demo=\${Boolean(candidate.assessment?.existingDemoTarget)}:degraded=\${Boolean(candidate.assessment?.degraded)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "repair candidate plan"}\`,
    ].join("\\n");
  } catch {
    systemdRepairCandidateCount.textContent = "0";
    systemdRepairCandidateRecommended.textContent = "offline";
    systemdRepairCandidateCreatesTask.textContent = "false";
    systemdRepairCandidateMutation.textContent = "false";
    systemdRepairCandidateJson.textContent = "Unable to read systemd repair candidate assessment.";
  }
}

async function refreshSystemdRepairCandidatePlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidate-plan\`);
    const governance = data.governance ?? {};
    const plan = data.plan ?? {};
    const selected = data.selectedCandidate ?? {};
    systemdRepairCandidatePlanTarget.textContent = plan.targetUnit ?? selected.unit ?? "unknown";
    systemdRepairCandidatePlanMode.textContent = data.mode ?? "plan_only";
    systemdRepairCandidatePlanCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdRepairCandidatePlanMutation.textContent = String(Boolean(governance.hostMutation));
    systemdRepairCandidatePlanJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Selected: \${selected.unit ?? "none"} score=\${selected.score ?? 0} demoTarget=\${Boolean(selected.existingDemoTarget)} degraded=\${Boolean(selected.degraded)}\`,
      \`Plan: intent=\${plan.intent ?? "unknown"} target=\${plan.targetUnit ?? "none"} previewOnly=\${Boolean(plan.commandPreviewOnly)} command=\${plan.commandPreview ?? "none"}\`,
      \`Steps: \${(plan.steps ?? []).map((step) => \`\${step.id}=\${step.status}\`).join(", ")}\`,
      \`Required: \${(plan.requiredBeforeExecution ?? []).join(", ") || "none"}\`,
      \`Next: \${data.next?.recommendedSlice ?? "observer candidate plan"}\`,
    ].join("\\n");
  } catch {
    systemdRepairCandidatePlanTarget.textContent = "offline";
    systemdRepairCandidatePlanMode.textContent = "plan_only";
    systemdRepairCandidatePlanCreatesTask.textContent = "false";
    systemdRepairCandidatePlanMutation.textContent = "false";
    systemdRepairCandidatePlanJson.textContent = "Unable to read systemd repair candidate plan.";
  }
}

async function refreshSystemdRepairCandidateRoute() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidate-task-route\`);
    const governance = data.governance ?? {};
    const decision = data.routeDecision ?? {};
    systemdRepairCandidateRouteStatus.textContent = decision.status ?? "unknown";
    systemdRepairCandidateRouteTarget.textContent = decision.targetUnit ?? "unknown";
    systemdRepairCandidateRouteCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdRepairCandidateRouteMutation.textContent = String(Boolean(governance.hostMutation));
    systemdRepairCandidateRouteJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} createsTask=\${Boolean(governance.createsTask)} executesCommand=\${Boolean(governance.executesCommand)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Decision: status=\${decision.status ?? "unknown"} target=\${decision.targetUnit ?? "none"} existingRoute=\${decision.existingRoute ?? "none"} available=\${Boolean(decision.existingRouteAvailable)}\`,
      \`Reason: \${decision.reason ?? "none"}\`,
      \`Required: \${(data.requiredBeforeTaskCreation ?? []).join(", ") || "none"}\`,
      \`Allowed Next: \${(data.allowedNextActions ?? []).map((action) => \`\${action.id}:allowed=\${Boolean(action.allowedNow)} createsTask=\${Boolean(action.createsTask)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "candidate task shell"}\`,
    ].join("\\n");
  } catch {
    systemdRepairCandidateRouteStatus.textContent = "offline";
    systemdRepairCandidateRouteTarget.textContent = "offline";
    systemdRepairCandidateRouteCreatesTask.textContent = "false";
    systemdRepairCandidateRouteMutation.textContent = "false";
    systemdRepairCandidateRouteJson.textContent = "Unable to read repair candidate task route gate.";
  }
}

async function refreshSystemdRepairCandidateTaskShell() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidate-task-route\`);
    const governance = data.governance ?? {};
    const decision = data.routeDecision ?? {};
    const ready = decision.existingRouteAvailable === true
      && decision.targetUnit === "openclaw-browser-runtime.service";
    systemdRepairCandidateTaskShellReady.textContent = String(ready);
    systemdRepairCandidateTaskShellTarget.textContent = decision.targetUnit ?? "unknown";
    systemdRepairCandidateTaskShellApproval.textContent = ready ? "pending-after-create" : "route-blocked";
    systemdRepairCandidateTaskShellMutation.textContent = "false";
    systemdRepairCandidateTaskShellJson.textContent = [
      "Registry: openclaw-systemd-repair-candidate-task-shell-v0",
      \`Source Route: \${data.registry ?? "unknown"}\`,
      \`Mode: approval-gated-candidate-task-shell ready=\${ready}\`,
      \`Target: \${decision.targetUnit ?? "none"} existingRoute=\${decision.existingRoute ?? "none"} available=\${Boolean(decision.existingRouteAvailable)}\`,
      \`Approval: creates pending high-risk approval only after explicit button click\`,
      \`Governance: createsTaskOnClick=true mutation=false executed=false hostMutation=false routeMutation=\${Boolean(governance.hostMutation)}\`,
      "Endpoint: /system/systemd/repair-candidate-tasks",
    ].join("\\n");
  } catch {
    systemdRepairCandidateTaskShellReady.textContent = "false";
    systemdRepairCandidateTaskShellTarget.textContent = "offline";
    systemdRepairCandidateTaskShellApproval.textContent = "route-blocked";
    systemdRepairCandidateTaskShellMutation.textContent = "false";
    systemdRepairCandidateTaskShellJson.textContent = "Unable to read repair candidate task shell boundary.";
  }
}

async function refreshSystemdRepairCandidateReadiness() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidate-readiness\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const checks = Array.isArray(data.checks) ? data.checks : [];
    const nextSlice = data.next?.recommendedSlice ?? "openclaw-systemd-repair-candidate-route-review";
    systemdRepairCandidateReadinessReady.textContent = String(Boolean(summary.ready));
    systemdRepairCandidateReadinessChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? checks.length}\`;
    systemdRepairCandidateReadinessNext.textContent = nextSlice;
    systemdRepairCandidateReadinessMutation.textContent = String(Boolean(governance.hostMutation));
    systemdRepairCandidateReadinessJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} ready=\${Boolean(summary.ready)} selectedUnit=\${summary.selectedUnit ?? "unknown"}\`,
      \`Checks: \${checks.map((check) => \`\${check.id}=\${Boolean(check.passed)}\`).join(", ")}\`,
      \`Completed: \${data.completedBlock?.completionClaim ?? "unknown"} slices=\${(data.completedBlock?.completedSlices ?? []).length}\`,
      \`Evidence: candidate=\${data.evidence?.recommendedCandidate ?? "none"} route=\${data.evidence?.routeStatus ?? "unknown"} command=\${data.evidence?.commandPreview ?? "none"}\`,
      \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} recovery=\${Boolean(governance.triggersRecovery)}\`,
      \`Next: \${nextSlice} boundary=\${data.next?.boundary ?? "whitepaper route review"}\`,
    ].join("\\n");
  } catch {
    systemdRepairCandidateReadinessReady.textContent = "false";
    systemdRepairCandidateReadinessChecks.textContent = "0/0";
    systemdRepairCandidateReadinessNext.textContent = "offline";
    systemdRepairCandidateReadinessMutation.textContent = "false";
    systemdRepairCandidateReadinessJson.textContent = "Unable to read repair candidate block readiness.";
  }
}

async function refreshSystemdRepairCandidateRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidate-route-review\`);
    const decision = data.decision ?? {};
    const governance = data.governance ?? {};
    const evidence = data.evidence ?? {};
    systemdRepairCandidateRouteReviewTrack.textContent = decision.selectedTrack ?? "unknown";
    systemdRepairCandidateRouteReviewSlice.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    systemdRepairCandidateRouteReviewCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdRepairCandidateRouteReviewMutation.textContent = String(Boolean(governance.hostMutation));
    systemdRepairCandidateRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: candidateReady=\${Boolean(evidence.candidateReady)} checks=\${evidence.candidateChecks ?? "0/0"} selectedUnit=\${evidence.selectedUnit ?? "unknown"}\`,
      \`Candidates: \${(data.candidates ?? []).map((candidate) => \`\${candidate.track}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-repair-candidate-demo-status"} boundary=\${data.next?.boundary ?? "read-only demo status"}\`,
    ].join("\\n");
  } catch {
    systemdRepairCandidateRouteReviewTrack.textContent = "offline";
    systemdRepairCandidateRouteReviewSlice.textContent = "offline";
    systemdRepairCandidateRouteReviewCreatesTask.textContent = "false";
    systemdRepairCandidateRouteReviewMutation.textContent = "false";
    systemdRepairCandidateRouteReviewJson.textContent = "Unable to read repair candidate route review.";
  }
}

async function refreshSystemdRepairCandidateDemoStatus() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/repair-candidate-demo-status\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const operatorView = data.operatorView ?? {};
    systemdRepairCandidateDemoStatusReady.textContent = String(Boolean(summary.demoReady));
    systemdRepairCandidateDemoStatusChecks.textContent = \`\${summary.passedChecks ?? 0}/\${summary.totalChecks ?? 0}\`;
    systemdRepairCandidateDemoStatusTarget.textContent = summary.selectedUnit ?? "unknown";
    systemdRepairCandidateDemoStatusMutation.textContent = String(Boolean(governance.hostMutation));
    systemdRepairCandidateDemoStatusJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} demoReady=\${Boolean(summary.demoReady)} target=\${summary.selectedUnit ?? "unknown"} hiddenMutation=\${Boolean(summary.hiddenMutation)}\`,
      \`Governance: createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} recovery=\${Boolean(governance.triggersRecovery)}\`,
      \`Checklist: \${(data.checklist ?? []).map((check) => \`\${check.id}=\${Boolean(check.passed)}\`).join(", ")}\`,
      \`Narrative: \${operatorView.narrative ?? "none"}\`,
      \`Speaking: \${(operatorView.speakingPoints ?? []).join(" | ")}\`,
      \`Evidence: candidate=\${data.evidence?.recommendedCandidate ?? "none"} route=\${data.evidence?.routeStatus ?? "unknown"} command=\${data.evidence?.commandPreview ?? "none"}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-phase-2-next-capability-route-review"} boundary=\${data.next?.boundary ?? "whitepaper route review"}\`,
    ].join("\\n");
  } catch {
    systemdRepairCandidateDemoStatusReady.textContent = "false";
    systemdRepairCandidateDemoStatusChecks.textContent = "0/0";
    systemdRepairCandidateDemoStatusTarget.textContent = "offline";
    systemdRepairCandidateDemoStatusMutation.textContent = "false";
    systemdRepairCandidateDemoStatusJson.textContent = "Unable to read repair candidate demo status.";
  }
}

async function refreshSystemdNextRepairScopeReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/next-repair-scope-review\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    systemdNextRepairScopeReviewReady.textContent = String(Boolean(summary.ready));
    systemdNextRepairScopeReviewUnit.textContent = summary.selectedUnit ?? decision.selectedUnit ?? "unknown";
    systemdNextRepairScopeReviewCandidates.textContent = String(summary.candidateCount ?? data.candidates?.length ?? 0);
    systemdNextRepairScopeReviewMutation.textContent = String(Boolean(governance.hostMutation));
    systemdNextRepairScopeReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"} unit=\${decision.selectedUnit ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: ledgerDemoReady=\${Boolean(summary.ledgerDemoReady)} ledgerRegistry=\${evidence.ledgerDemo?.registry ?? "unknown"} recordCount=\${evidence.ledgerDemo?.recordCount ?? 0} completedDemoUnit=\${summary.completedDemoUnit ?? "unknown"}\`,
      \`Candidates: \${(data.candidates ?? []).map((candidate) => \`\${candidate.unit}:score=\${candidate.score}:recommended=\${Boolean(candidate.recommended)}:mutation=\${Boolean(candidate.mutation)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-next-repair-plan"} boundary=\${data.next?.boundary ?? "plan-only repair scope"}\`,
    ].join("\\n");
  } catch {
    systemdNextRepairScopeReviewReady.textContent = "false";
    systemdNextRepairScopeReviewUnit.textContent = "offline";
    systemdNextRepairScopeReviewCandidates.textContent = "0";
    systemdNextRepairScopeReviewMutation.textContent = "false";
    systemdNextRepairScopeReviewJson.textContent = "Unable to read next repair scope review.";
  }
}

async function refreshSystemdNextRepairPlan() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/next-repair-plan\`);
    const governance = data.governance ?? {};
    const plan = data.plan ?? {};
    const scope = data.scope ?? {};
    systemdNextRepairPlanTarget.textContent = plan.targetUnit ?? data.target?.unit ?? "unknown";
    systemdNextRepairPlanMode.textContent = data.mode ?? "plan_only";
    systemdNextRepairPlanCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdNextRepairPlanMutation.textContent = String(Boolean(governance.hostMutation));
    systemdNextRepairPlanJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Scope: ready=\${Boolean(scope.scopeReady)} ledgerDemoReady=\${Boolean(scope.ledgerDemoReady)} completedDemoUnit=\${scope.completedDemoUnit ?? "unknown"}\`,
      \`Target: \${plan.targetUnit ?? "unknown"} impact=\${data.target?.impactClass ?? "unknown"} radius=\${data.target?.impactRadius ?? 0}\`,
      \`Command preview: \${plan.commandPreview ?? "none"} previewOnly=\${Boolean(plan.commandPreviewOnly)} restartsService=\${Boolean(plan.restartsService)}\`,
      \`Reason: \${plan.reason ?? "none"}\`,
      \`Required: \${(plan.requiredBeforeExecution ?? []).join(", ") || "none"}\`,
      \`Avoid: \${(plan.notSelected ?? []).join(", ") || "none"}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-next-repair-route-review"} boundary=\${data.next?.boundary ?? "route review before mutation"}\`,
    ].join("\\n");
  } catch {
    systemdNextRepairPlanTarget.textContent = "offline";
    systemdNextRepairPlanMode.textContent = "offline";
    systemdNextRepairPlanCreatesTask.textContent = "false";
    systemdNextRepairPlanMutation.textContent = "false";
    systemdNextRepairPlanJson.textContent = "Unable to read next repair plan.";
  }
}

async function refreshSystemdNextRepairRouteReview() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/next-repair-route-review\`);
    const governance = data.governance ?? {};
    const decision = data.decision ?? {};
    const evidence = data.evidence ?? {};
    systemdNextRepairRouteReviewTrack.textContent = decision.selectedTrack ?? "unknown";
    systemdNextRepairRouteReviewSlice.textContent = decision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    systemdNextRepairRouteReviewCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdNextRepairRouteReviewMutation.textContent = String(Boolean(governance.hostMutation));
    systemdNextRepairRouteReviewJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Decision: \${decision.status ?? "unknown"} track=\${decision.selectedTrack ?? "unknown"} slice=\${decision.selectedSlice ?? "unknown"} unit=\${decision.selectedUnit ?? "unknown"}\`,
      \`Rationale: \${decision.rationale ?? "none"}\`,
      \`Avoid: \${(decision.notSelected ?? []).join(", ") || "none"}\`,
      \`Evidence: planReady=\${Boolean(evidence.planReady)} target=\${evidence.targetUnit ?? "unknown"} previewOnly=\${Boolean(evidence.commandPreviewOnly)} command=\${evidence.commandPreview ?? "none"}\`,
      \`Candidates: \${(data.candidates ?? []).map((candidate) => \`\${candidate.track}:\${candidate.firstSlice}:recommended=\${Boolean(candidate.recommended)}:mutation=\${Boolean(candidate.mutation)}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-next-repair-dry-run"} boundary=\${data.next?.boundary ?? "dry-run envelope only"}\`,
    ].join("\\n");
  } catch {
    systemdNextRepairRouteReviewTrack.textContent = "offline";
    systemdNextRepairRouteReviewSlice.textContent = "offline";
    systemdNextRepairRouteReviewCreatesTask.textContent = "false";
    systemdNextRepairRouteReviewMutation.textContent = "false";
    systemdNextRepairRouteReviewJson.textContent = "Unable to read next repair route review.";
  }
}

async function refreshSystemdNextRepairDryRun() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/next-repair-dry-run\`);
    const governance = data.governance ?? {};
    const dryRun = data.dryRun ?? {};
    systemdNextRepairDryRunTarget.textContent = data.target?.unit ?? data.plan?.plan?.targetUnit ?? "unknown";
    systemdNextRepairDryRunMode.textContent = data.mode ?? "dry_run";
    systemdNextRepairDryRunWouldExecute.textContent = String(Boolean(dryRun.wouldExecute));
    systemdNextRepairDryRunMutation.textContent = String(Boolean(governance.hostMutation));
    systemdNextRepairDryRunJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} wouldExecute=\${Boolean(data.wouldExecute)} canRestart=\${Boolean(data.canRestart)} mutation=\${Boolean(governance.hostMutation)} executesCommand=\${Boolean(governance.executesCommand)} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)}\`,
      \`Route: \${data.routeReview?.status ?? "unknown"} selected=\${data.routeReview?.selectedSlice ?? "unknown"} unit=\${data.routeReview?.selectedUnit ?? "unknown"}\`,
      \`Target: \${data.target?.unit ?? "unknown"} impact=\${data.target?.impactClass ?? "unknown"} radius=\${data.target?.impactRadius ?? 0}\`,
      \`Command: \${dryRun.command ?? "none"} \${(dryRun.args ?? []).join(" ")} risk=\${dryRun.risk ?? "unknown"} requiresApproval=\${Boolean(dryRun.requiresApproval)} wouldExecute=\${Boolean(dryRun.wouldExecute)}\`,
      "Expected checks: no_execution, route_review_selected_dry_run, target_is_system_sense, operator_visible_before_mutation, no_restart_executed",
      \`Checks: \${(dryRun.checks ?? []).map((check) => \`\${check.name}=\${Boolean(check.passed)}\`).join(", ") || "none"}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-next-repair-task-route"} boundary=\${data.next?.boundary ?? "route-review task materialization"}\`,
    ].join("\\n");
  } catch {
    systemdNextRepairDryRunTarget.textContent = "offline";
    systemdNextRepairDryRunMode.textContent = "offline";
    systemdNextRepairDryRunWouldExecute.textContent = "false";
    systemdNextRepairDryRunMutation.textContent = "false";
    systemdNextRepairDryRunJson.textContent = "Unable to read next repair dry-run envelope.";
  }
}

async function refreshSystemdNextRepairTaskRoute() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/next-repair-task-route\`);
    const governance = data.governance ?? {};
    const routeDecision = data.routeDecision ?? {};
    const evidence = data.evidence ?? {};
    systemdNextRepairTaskRouteStatus.textContent = routeDecision.status ?? "unknown";
    systemdNextRepairTaskRouteSlice.textContent = routeDecision.selectedSlice ?? data.next?.recommendedSlice ?? "unknown";
    systemdNextRepairTaskRouteCreatesTask.textContent = String(Boolean(governance.createsTask));
    systemdNextRepairTaskRouteMutation.textContent = String(Boolean(governance.hostMutation));
    systemdNextRepairTaskRouteJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} createsTask=\${Boolean(governance.createsTask)} createsApproval=\${Boolean(governance.createsApproval)} executesCommand=\${Boolean(governance.executesCommand)} mutation=\${Boolean(governance.hostMutation)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Route: \${routeDecision.status ?? "unknown"} selected=\${routeDecision.selectedSlice ?? "unknown"} target=\${routeDecision.targetUnit ?? "unknown"} taskShellAllowed=\${Boolean(routeDecision.taskShellAllowed)}\`,
      \`Reason: \${routeDecision.reason ?? "none"}\`,
      \`Required: \${(data.requiredBeforeTaskCreation ?? []).join(", ") || "none"}\`,
      \`Evidence: dryRunReady=\${Boolean(evidence.dryRunReady)} command=\${evidence.command ?? "none"} \${(evidence.args ?? []).join(" ")} wouldExecute=\${Boolean(evidence.wouldExecute)}\`,
      \`Actions: \${(data.allowedNextActions ?? []).map((action) => \`\${action.id}:allowed=\${Boolean(action.allowedNow)}:createsTask=\${Boolean(action.createsTask)}:mutation=\${Boolean(action.mutatesHost)}\`).join(", ") || "none"}\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-next-repair-task-shell"} boundary=\${data.next?.boundary ?? "task shell only"}\`,
    ].join("\\n");
  } catch {
    systemdNextRepairTaskRouteStatus.textContent = "offline";
    systemdNextRepairTaskRouteSlice.textContent = "offline";
    systemdNextRepairTaskRouteCreatesTask.textContent = "false";
    systemdNextRepairTaskRouteMutation.textContent = "false";
    systemdNextRepairTaskRouteJson.textContent = "Unable to read next repair task route.";
  }
}

async function refreshSystemdNextRepairTaskShell() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/next-repair-task-route\`);
    const governance = data.governance ?? {};
    const routeDecision = data.routeDecision ?? {};
    const createShell = data.allowedNextActions?.find((action) => action.id === "create-task-shell") ?? {};
    systemdNextRepairTaskShellReady.textContent = String(Boolean(routeDecision.taskShellAllowed));
    systemdNextRepairTaskShellTarget.textContent = routeDecision.targetUnit ?? "openclaw-system-sense.service";
    systemdNextRepairTaskShellApproval.textContent = createShell.createsApproval === true ? "pending-after-create" : "unavailable";
    systemdNextRepairTaskShellMutation.textContent = String(Boolean(governance.hostMutation));
    systemdNextRepairTaskShellJson.textContent = [
      "Registry: openclaw-systemd-next-repair-task-shell-v0",
      "Real Execution Registry: openclaw-systemd-next-repair-real-execution-v0",
      "Endpoint: /system/systemd/next-repair-tasks",
      \`Route: \${data.registry ?? "unknown"} selected=\${routeDecision.selectedSlice ?? "unknown"} target=\${routeDecision.targetUnit ?? "unknown"}\`,
      \`Create: allowed=\${Boolean(createShell.allowedNow)} createsTask=\${Boolean(createShell.createsTask)} createsApproval=\${Boolean(createShell.createsApproval)} approvalState=pending-after-create\`,
      \`Boundary: executed=false hostMutation=\${Boolean(governance.hostMutation)} realExecutionEnabled=false\`,
      \`Next: \${data.next?.recommendedSlice ?? "openclaw-systemd-next-repair-task-shell"}\`,
    ].join("\\n");
  } catch {
    systemdNextRepairTaskShellReady.textContent = "false";
    systemdNextRepairTaskShellTarget.textContent = "offline";
    systemdNextRepairTaskShellApproval.textContent = "unavailable";
    systemdNextRepairTaskShellMutation.textContent = "false";
    systemdNextRepairTaskShellJson.textContent = "Unable to read next repair task shell route.";
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

async function refreshSystemdDependencyMap() {
  try {
    const data = await fetchJson(\`\${observerConfig.systemSenseUrl}/system/systemd/dependency-map\`);
    const summary = data.summary ?? {};
    const governance = data.governance ?? {};
    const nodes = Array.isArray(data.nodes) ? data.nodes : [];
    const edges = Array.isArray(data.edges) ? data.edges : [];
    const highImpact = nodes
      .filter((node) => node.impactClass === "foundational" || node.impactClass === "high")
      .map((node) => \`\${node.unit}:\${node.impactRadius ?? 0}\`);
    systemdDependencyNodeCount.textContent = String(summary.nodes ?? nodes.length);
    systemdDependencyEdgeCount.textContent = String(summary.edges ?? edges.length);
    systemdDependencyRootCount.textContent = String(summary.roots ?? data.roots?.length ?? 0);
    systemdDependencyHighImpact.textContent = String(summary.highImpact ?? highImpact.length);
    systemdDependencyJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"} mutation=\${Boolean(governance.hostMutation)} canRestart=\${Boolean(governance.canRestart)}\`,
      \`Roots: \${(data.roots ?? []).join(", ") || "none"}\`,
      \`Leaves: \${(data.leaves ?? []).join(", ") || "none"}\`,
      \`High impact: \${highImpact.join(", ") || "none"}\`,
      \`Layers: \${Object.entries(data.startupLayers ?? {}).map(([layer, units]) => \`\${layer}=[\${units.join(", ")}]\`).join(" ")}\`,
      \`Edges: \${edges.map((edge) => \`\${edge.from}->\${edge.to}\`).join(", ")}\`,
      \`Next: \${data.next?.recommendedSlice ?? "health trend summary"}\`,
    ].join("\\n");
  } catch {
    systemdDependencyNodeCount.textContent = "0";
    systemdDependencyEdgeCount.textContent = "0";
    systemdDependencyRootCount.textContent = "0";
    systemdDependencyHighImpact.textContent = "0";
    systemdDependencyJson.textContent = "Unable to read OpenClaw body dependency map.";
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

async function refreshSystemdRepairExecutionTaskDraft() {
  try {
    const data = await fetchJson(\`\${observerConfig.coreUrl}/system/systemd/repair-execution-task-draft?unit=openclaw-browser-runtime.service\`);
    const draft = data.draft ?? {};
    const systemdRepair = draft.systemdRepair ?? {};
    systemdRepairExecutionTaskRegistry.textContent = data.registry ?? "openclaw-systemd-repair-execution-task-v0";
    systemdRepairExecutionTaskTarget.textContent = data.target?.unit ?? systemdRepair.target?.unit ?? "unknown";
    systemdRepairExecutionTaskApproval.textContent = draft.policy?.decision?.decision === "require_approval" ? "required" : "unknown";
    systemdRepairExecutionTaskExecuted.textContent = String(Boolean(systemdRepair.execution?.executed));
    systemdRepairExecutionTaskJson.textContent = [
      \`Registry: \${data.registry ?? "unknown"}\`,
      \`Mode: \${data.mode ?? "unknown"}\`,
      \`Target: \${data.target?.unit ?? "unknown"}\`,
      \`Policy: \${draft.policy?.decision?.decision ?? "unknown"} risk=\${draft.policy?.decision?.risk ?? "unknown"}\`,
      \`Command: \${systemdRepair.command?.command ?? "systemctl"} \${(systemdRepair.command?.args ?? []).join(" ")}\`,
      \`Evidence: inventory=\${systemdRepair.inventoryRegistry ?? "unknown"} plan=\${systemdRepair.planRegistry ?? "unknown"} dryRun=\${systemdRepair.sourceRegistry ?? "unknown"}\`,
      \`Execution: shellOnly=\${Boolean(systemdRepair.execution?.shellOnly)} realExecutionEnabled=\${Boolean(systemdRepair.execution?.realExecutionEnabled)} executed=\${Boolean(systemdRepair.execution?.executed)} hostMutation=\${Boolean(systemdRepair.execution?.hostMutation)} hostMutationAttempted=\${Boolean(systemdRepair.execution?.hostMutationAttempted)}\`,
      \`Real execution unit: \${systemdRepair.execution?.selectedRealExecutionUnit ?? "not-enabled"}\`,
    ].join("\\n");
  } catch {
    systemdRepairExecutionTaskRegistry.textContent = "offline";
    systemdRepairExecutionTaskTarget.textContent = "offline";
    systemdRepairExecutionTaskApproval.textContent = "unknown";
    systemdRepairExecutionTaskExecuted.textContent = "false";
    systemdRepairExecutionTaskJson.textContent = "Unable to read OpenClaw systemd repair execution task draft.";
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

async function createSystemdRepairExecutionTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/system/systemd/repair-execution-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      unit: "openclaw-browser-runtime.service",
      confirm: true,
    }),
  });
  setControlMessage(\`Systemd repair execution task queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"}\`);
  await Promise.all([
    refreshSystemdRepairExecutionTaskDraft(),
    refreshTaskList(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createSystemdRepairRealExecutionTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/system/systemd/repair-execution-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      unit: "openclaw-browser-runtime.service",
      confirm: true,
      execute: true,
    }),
  });
  setControlMessage(\`Real systemd repair execution task queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} realExecutionEnabled=\${Boolean(result.governance?.realExecutionEnabled)}\`);
  await Promise.all([
    refreshSystemdRepairExecutionTaskDraft(),
    refreshTaskList(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createSystemdRepairCandidateTaskShell() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/system/systemd/repair-candidate-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
    }),
  });
  setControlMessage(\`Systemd repair candidate task shell queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} mutation=\${Boolean(result.governance?.hostMutation)}\`);
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  await Promise.all([
    refreshSystemdRepairCandidateTaskShell(),
    refreshTaskList(),
    refreshTaskHistoryDetail(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createSystemdNextRepairTaskShell() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/system/systemd/next-repair-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
    }),
  });
  setControlMessage(\`Next systemd repair task shell queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} approvalState=pending-after-create mutation=\${Boolean(result.governance?.hostMutation)}\`);
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  await Promise.all([
    refreshSystemdNextRepairTaskShell(),
    refreshTaskList(),
    refreshTaskHistoryDetail(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createSystemdNextRepairRealExecutionTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/system/systemd/next-repair-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
      execute: true,
    }),
  });
  setControlMessage(\`Next systemd repair real execution task queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} realExecutionEnabled=\${Boolean(result.governance?.realExecutionEnabled)}\`);
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  await Promise.all([
    refreshSystemdNextRepairTaskShell(),
    refreshTaskList(),
    refreshTaskHistoryDetail(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createBodyEvidenceLedgerDirectoryTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/body/evidence-ledger/directory-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
    }),
  });
  setControlMessage(\`Body evidence ledger directory task queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} target=\${result.ledgerDirectory?.displayPath ?? "unknown"} mutation=\${Boolean(result.governance?.hostMutation)}\`);
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  await Promise.all([
    refreshBodyEvidenceLedgerDirectoryTask(),
    refreshTaskList(),
    refreshTaskHistoryDetail(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createBodyEvidenceLedgerFirstRecordTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/body/evidence-ledger/first-record-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
    }),
  });
  setControlMessage(\`Body evidence ledger first record task queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} recordType=\${result.firstRecord?.plannedRecordType ?? "unknown"} appended=\${Boolean(result.firstRecord?.recordAppended)}\`);
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  await Promise.all([
    refreshBodyEvidenceLedgerFirstRecordTask(),
    refreshTaskList(),
    refreshTaskHistoryDetail(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
}

async function createBodyEvidenceLedgerFollowupRecordTask() {
  const result = await fetchJson(\`\${observerConfig.coreUrl}/body/evidence-ledger/followup-record-tasks\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      confirm: true,
    }),
  });
  setControlMessage(\`Body evidence ledger follow-up record task queued: \${result.task?.id ?? "unknown"} approval=\${result.approval?.id ?? "none"} recordType=\${result.followupRecord?.plannedRecordType ?? "unknown"} appended=\${Boolean(result.followupRecord?.recordAppended)}\`);
  taskHistoryFocus = "selected-task";
  selectedHistoryTaskId = result.task?.id ?? null;
  taskDetailIdInput.value = result.task?.id ?? "";
  await Promise.all([
    refreshBodyEvidenceLedgerFollowupRecordTask(),
    refreshTaskList(),
    refreshTaskHistoryDetail(),
    refreshApprovalState(),
    refreshOperatorState(),
  ]);
  return result;
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
    "systemd.repair.execution_completed",
    "systemd.repair.execution_failed",
    "systemd.next_repair.execution_completed",
    "systemd.next_repair.execution_failed",
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

createSystemdRepairExecutionTaskButton.addEventListener("click", () => {
  createSystemdRepairExecutionTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

createSystemdRepairRealExecutionTaskButton.addEventListener("click", () => {
  createSystemdRepairRealExecutionTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

createSystemdRepairCandidateTaskShellButton.addEventListener("click", () => {
  createSystemdRepairCandidateTaskShell().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

createSystemdNextRepairTaskShellButton.addEventListener("click", () => {
  createSystemdNextRepairTaskShell().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

createSystemdNextRepairRealExecutionButton.addEventListener("click", () => {
  createSystemdNextRepairRealExecutionTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

createBodyEvidenceLedgerDirectoryTaskButton.addEventListener("click", () => {
  createBodyEvidenceLedgerDirectoryTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

createBodyEvidenceLedgerFirstRecordTaskButton.addEventListener("click", () => {
  createBodyEvidenceLedgerFirstRecordTask().catch((error) => {
    setControlMessage(\`Request failed: \${formatError(error)}\`);
  });
});

createBodyEvidenceLedgerFollowupRecordTaskButton.addEventListener("click", () => {
  createBodyEvidenceLedgerFollowupRecordTask().catch((error) => {
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

takeoverButton.addEventListener("click", () => {
  postControl("/control/takeover").catch((error) => {
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
await refreshPhase2RepairDemoStatus();
await refreshPhase2NextRepairDemoStatus();
await refreshPhase2DemoControlRoom();
await refreshPhase2DemoWalkthrough();
await refreshPhase2DemoReadinessExit();
await refreshPhase2NextCapabilityRoute();
await refreshPhase2CompletionReadiness();
await refreshPhase2Exit();
await refreshPhase3Plan();
await refreshPhase3BackgroundWorkView();
await refreshPhase3OperatorInterruptControls();
await refreshPhase3CompletionReadiness();
await refreshPhase3Exit();
await refreshPhase4Plan();
await refreshPhase4SelfHealLoop();
await refreshPhase4HealHistoryEvidence();
await refreshPhase4CompletionReadiness();
await refreshPhase4Exit();
await refreshPhase5Plan();
await refreshPhase5DeploymentInventory();
await refreshPhase5RollbackReadiness();
await refreshPhase5ReleaseControlReadiness();
await refreshPhase5Exit();
await refreshMvpFinalReadiness();
await refreshPostMvpPlan();
await refreshPhase6Plan();
await refreshPhase6MemorySubstrateInventory();
await refreshPhase6ConsciousnessContextEnvelope();
await refreshPhase6TaskOrchestrationRecords();
await refreshPhase6MemoryWriteRouteReview();
await refreshPhase6Exit();
await refreshLongTermMemoryWritePlan();
await refreshLongTermMemorySchema();
await refreshLongTermMemoryProposal();
await refreshLongTermMemoryWriteRouteReview();
await refreshLongTermMemoryWriteTask();
await refreshLongTermMemoryApprovedWrite();
await refreshLongTermMemoryReadback();
await refreshLongTermMemoryExit();
await refreshCloudConsciousnessContextReview();
await refreshCloudConsciousnessEnvelopeSchema();
await refreshCloudConsciousnessContextPackage();
await refreshCloudConsciousnessRedactionReview();
await refreshCloudConsciousnessTransmissionRouteReview();
await refreshCloudConsciousnessHandoffTask();
await refreshCloudConsciousnessApprovedHandoff();
await refreshCloudConsciousnessHandoffReadback();
await refreshCloudConsciousnessExit();
await refreshCloudConsciousnessProviderAdapterPlan();
await refreshCloudConsciousnessProviderContract();
await refreshCloudConsciousnessProviderRequestEnvelope();
await refreshCloudConsciousnessProviderDryRunRouteReview();
await refreshCloudConsciousnessProviderDryRunTask();
await refreshCloudConsciousnessApprovedProviderDryRun();
await refreshCloudConsciousnessProviderDryRunReadback();
await refreshCloudConsciousnessProviderAdapterExit();
await refreshCloudConsciousnessRealProviderCallPlan();
await refreshCloudConsciousnessProviderEgressContract();
await refreshCloudConsciousnessProviderCredentialPreflight();
await refreshCloudConsciousnessProviderRequestRedactionReview();
await refreshCloudConsciousnessRealProviderCallRouteReview();
await refreshCloudConsciousnessRealProviderCallTask();
await refreshCloudConsciousnessApprovedProviderCallRehearsal();
await refreshCloudConsciousnessProviderResponseReadback();
await refreshCloudConsciousnessRealProviderCallExit();
await refreshCloudConsciousnessLiveProviderCallRunbook();
await refreshCloudConsciousnessLiveProviderOperatorChecklist();
await refreshCloudConsciousnessLiveProviderEgressTranscriptSchema();
await refreshCloudConsciousnessLiveProviderFinalAuthorizationReview();
await refreshCloudConsciousnessLiveProviderRunbookRouteReview();
await refreshCloudConsciousnessLiveProviderRunbookTask();
await refreshCloudConsciousnessApprovedLiveProviderRunbook();
await refreshCloudConsciousnessLiveProviderRunbookReadback();
await refreshCloudConsciousnessLiveProviderCallRunbookExit();
await refreshCloudConsciousnessLiveProviderCallExecutionPlan();
await refreshCloudConsciousnessLiveProviderExecutionRouteReview();
await refreshCloudConsciousnessLiveProviderExecutionPlanReadback();
await refreshCloudConsciousnessLiveProviderCallExecutionPlanExit();
await refreshCloudConsciousnessLiveProviderCallRuntimeAdapterPlan();
await refreshCloudConsciousnessLiveProviderRuntimeAdapterExit();
await refreshCloudConsciousnessLiveProviderCallFinalAuthorization();
await refreshCloudConsciousnessLiveProviderCallOperatorLaunchReview();
await refreshCloudConsciousnessLiveProviderCallRuntimeImplementationPlan();
await refreshCloudConsciousnessLiveProviderCallRuntimeAdapterImplementation();
await refreshCloudConsciousnessLiveProviderRuntimeAdapterModuleContract();
await refreshCloudConsciousnessLiveProviderRequestBuilder();
await refreshCloudConsciousnessLiveProviderCredentialReferenceResolver();
await refreshCloudConsciousnessLiveProviderNoNetworkSender();
await refreshCloudConsciousnessLiveProviderEgressTranscriptRecorder();
await refreshCloudConsciousnessLiveProviderResponseVerifier();
await refreshCloudConsciousnessLiveProviderRollbackNote();
await refreshCloudConsciousnessLiveProviderRuntimeAdapterCompletion();
await refreshCloudConsciousnessLiveProviderRuntimeAdapterClosure();
await refreshCloudConsciousnessLiveProviderRealLaunchRouteReview();
await refreshCloudConsciousnessLiveProviderRealLaunchExecutionPreflight();
await refreshCloudConsciousnessLiveProviderCredentialValueAccessGate();
await refreshCloudConsciousnessLiveProviderEndpointNetworkEgressGate();
await refreshCloudConsciousnessLiveProviderEgressExecutionRouteTaskPreflight();
await refreshCloudConsciousnessLiveProviderEgressExecutionTaskShell();
await refreshCloudConsciousnessLiveProviderEgressExecutionApprovedDeferred();
await refreshCloudConsciousnessLiveProviderCredentialValueAuthorizationRoute();
await refreshCloudConsciousnessLiveProviderCredentialValueAuthorizationTaskShell();
await refreshCloudConsciousnessLiveProviderCredentialValueAuthorizationApprovedDeferred();
await refreshCloudConsciousnessLiveProviderCredentialValueReadinessPreflight();
await refreshCloudConsciousnessLiveProviderCredentialValueReadTaskShell();
await refreshCloudConsciousnessLiveProviderCredentialValueReadApprovedDeferred();
await refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationRoute();
await refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationTaskShell();
await refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationApprovedDeferred();
await refreshCloudConsciousnessLiveProviderCredentialValueFinalReadinessPreflight();
await refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecisionRoute();
await refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecisionTaskShell();
await refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferred();
await refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizedLocalProof();
await refreshCloudConsciousnessLiveProviderCredentialValueLocalReadRoute();
await refreshCloudConsciousnessLiveProviderCredentialValueLocalReadTaskShell();
await refreshCloudConsciousnessLiveProviderCredentialValueLocalReadApprovedDeferred();
await refreshCloudConsciousnessLiveProviderCredentialValueLocalReadFinalReadinessPreflight();
await refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionRoute();
await refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionTaskShell();
await refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionApprovedDeferred();
await refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflight();
await refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadRoute();
await refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadTaskShell();
await refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferred();
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
await refreshHealthTrends();
await refreshRouteAwareNextAction();
await refreshConservativeRecoveryPolicy();
await refreshBodyGovernanceReadiness();
await refreshBodyEvidenceTimeline();
await refreshBodyEvidenceTimelineReadiness();
await refreshBodyEvidenceLedgerPlan();
await refreshBodyEvidenceLedgerRouteReview();
await refreshBodyEvidenceLedgerStorageRootPlan();
await refreshBodyEvidenceLedgerStorageRootRouteReview();
await refreshBodyEvidenceLedgerDirectoryTask();
await refreshBodyEvidenceLedgerFirstRecordPlan();
await refreshBodyEvidenceLedgerFirstRecordRouteReview();
await refreshBodyEvidenceLedgerFirstRecordTask();
await refreshBodyEvidenceLedgerReadiness();
await refreshBodyEvidenceLedgerDemoStatus();
await refreshBodyEvidenceLedgerFollowupRecordPlan();
await refreshBodyEvidenceLedgerFollowupRecordRouteReview();
await refreshBodyEvidenceLedgerFollowupRecordTask();
await refreshBodyEvidenceLedgerFollowupRecordReadiness();
await refreshBodyEvidenceLedgerFollowupRecordAppendRouteReview();
await refreshBodyEvidenceLedgerFollowupRecordAppendReadiness();
await refreshPhase2RouteReview();
await refreshSystemdRepairCandidates();
await refreshSystemdRepairCandidatePlan();
await refreshSystemdRepairCandidateRoute();
await refreshSystemdRepairCandidateTaskShell();
await refreshSystemdRepairCandidateReadiness();
await refreshSystemdRepairCandidateRouteReview();
await refreshSystemdRepairCandidateDemoStatus();
await refreshSystemdNextRepairScopeReview();
await refreshSystemdNextRepairPlan();
await refreshSystemdNextRepairRouteReview();
await refreshSystemdNextRepairDryRun();
await refreshSystemdNextRepairTaskRoute();
await refreshSystemdNextRepairTaskShell();
await refreshSystemdUnitInventory();
await refreshSystemdDependencyMap();
await refreshSystemdRepairPlan();
await refreshSystemdRepairExecutionTaskDraft();
await refreshHealState();
await refreshMaintenanceState();
await refreshAuditState();
await loadRecentEvents();
setControlMessage("Controls ready.");
subscribeEvents();
setInterval(refreshHealth, 5000);
setInterval(refreshMvpRoute, 5000);
setInterval(refreshPhase2RepairDemoStatus, 5000);
setInterval(refreshPhase2NextRepairDemoStatus, 5000);
setInterval(refreshPhase2DemoControlRoom, 5000);
setInterval(refreshPhase2DemoWalkthrough, 5000);
setInterval(refreshPhase2DemoReadinessExit, 5000);
setInterval(refreshPhase2NextCapabilityRoute, 5000);
setInterval(refreshPhase2CompletionReadiness, 5000);
setInterval(refreshPhase2Exit, 5000);
setInterval(refreshPhase3Plan, 5000);
setInterval(refreshPhase3BackgroundWorkView, 5000);
setInterval(refreshPhase3OperatorInterruptControls, 5000);
setInterval(refreshPhase3CompletionReadiness, 5000);
setInterval(refreshPhase3Exit, 5000);
setInterval(refreshPhase4Plan, 5000);
setInterval(refreshPhase4SelfHealLoop, 5000);
setInterval(refreshPhase4HealHistoryEvidence, 5000);
setInterval(refreshPhase4CompletionReadiness, 5000);
setInterval(refreshPhase4Exit, 5000);
setInterval(refreshPhase5Plan, 5000);
setInterval(refreshPhase5DeploymentInventory, 5000);
setInterval(refreshPhase5RollbackReadiness, 5000);
setInterval(refreshPhase5ReleaseControlReadiness, 5000);
setInterval(refreshPhase5Exit, 5000);
setInterval(refreshMvpFinalReadiness, 5000);
setInterval(refreshPostMvpPlan, 5000);
setInterval(refreshPhase6Plan, 5000);
setInterval(refreshPhase6MemorySubstrateInventory, 5000);
setInterval(refreshPhase6ConsciousnessContextEnvelope, 5000);
setInterval(refreshPhase6TaskOrchestrationRecords, 5000);
setInterval(refreshPhase6MemoryWriteRouteReview, 5000);
setInterval(refreshPhase6Exit, 5000);
setInterval(refreshLongTermMemoryWritePlan, 5000);
setInterval(refreshLongTermMemorySchema, 5000);
setInterval(refreshLongTermMemoryProposal, 5000);
setInterval(refreshLongTermMemoryWriteRouteReview, 5000);
setInterval(refreshLongTermMemoryWriteTask, 5000);
setInterval(refreshLongTermMemoryApprovedWrite, 5000);
setInterval(refreshLongTermMemoryReadback, 5000);
setInterval(refreshLongTermMemoryExit, 5000);
setInterval(refreshCloudConsciousnessContextReview, 5000);
setInterval(refreshCloudConsciousnessEnvelopeSchema, 5000);
setInterval(refreshCloudConsciousnessContextPackage, 5000);
setInterval(refreshCloudConsciousnessRedactionReview, 5000);
setInterval(refreshCloudConsciousnessTransmissionRouteReview, 5000);
setInterval(refreshCloudConsciousnessHandoffTask, 5000);
setInterval(refreshCloudConsciousnessApprovedHandoff, 5000);
setInterval(refreshCloudConsciousnessHandoffReadback, 5000);
setInterval(refreshCloudConsciousnessExit, 5000);
setInterval(refreshCloudConsciousnessProviderAdapterPlan, 5000);
setInterval(refreshCloudConsciousnessProviderContract, 5000);
setInterval(refreshCloudConsciousnessProviderRequestEnvelope, 5000);
setInterval(refreshCloudConsciousnessProviderDryRunRouteReview, 5000);
setInterval(refreshCloudConsciousnessProviderDryRunTask, 5000);
setInterval(refreshCloudConsciousnessApprovedProviderDryRun, 5000);
setInterval(refreshCloudConsciousnessProviderDryRunReadback, 5000);
setInterval(refreshCloudConsciousnessProviderAdapterExit, 5000);
setInterval(refreshCloudConsciousnessRealProviderCallPlan, 5000);
setInterval(refreshCloudConsciousnessProviderEgressContract, 5000);
setInterval(refreshCloudConsciousnessProviderCredentialPreflight, 5000);
setInterval(refreshCloudConsciousnessProviderRequestRedactionReview, 5000);
setInterval(refreshCloudConsciousnessRealProviderCallRouteReview, 5000);
setInterval(refreshCloudConsciousnessRealProviderCallTask, 5000);
setInterval(refreshCloudConsciousnessApprovedProviderCallRehearsal, 5000);
setInterval(refreshCloudConsciousnessProviderResponseReadback, 5000);
setInterval(refreshCloudConsciousnessRealProviderCallExit, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCallRunbook, 5000);
setInterval(refreshCloudConsciousnessLiveProviderOperatorChecklist, 5000);
setInterval(refreshCloudConsciousnessLiveProviderEgressTranscriptSchema, 5000);
setInterval(refreshCloudConsciousnessLiveProviderFinalAuthorizationReview, 5000);
setInterval(refreshCloudConsciousnessLiveProviderRunbookRouteReview, 5000);
setInterval(refreshCloudConsciousnessLiveProviderRunbookTask, 5000);
setInterval(refreshCloudConsciousnessApprovedLiveProviderRunbook, 5000);
setInterval(refreshCloudConsciousnessLiveProviderRunbookReadback, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCallRunbookExit, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCallExecutionPlan, 5000);
setInterval(refreshCloudConsciousnessLiveProviderExecutionRouteReview, 5000);
setInterval(refreshCloudConsciousnessLiveProviderExecutionPlanReadback, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCallExecutionPlanExit, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCallRuntimeAdapterPlan, 5000);
setInterval(refreshCloudConsciousnessLiveProviderRuntimeAdapterExit, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCallFinalAuthorization, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCallOperatorLaunchReview, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCallRuntimeImplementationPlan, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCallRuntimeAdapterImplementation, 5000);
setInterval(refreshCloudConsciousnessLiveProviderRuntimeAdapterModuleContract, 5000);
setInterval(refreshCloudConsciousnessLiveProviderRequestBuilder, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialReferenceResolver, 5000);
setInterval(refreshCloudConsciousnessLiveProviderNoNetworkSender, 5000);
setInterval(refreshCloudConsciousnessLiveProviderEgressTranscriptRecorder, 5000);
setInterval(refreshCloudConsciousnessLiveProviderResponseVerifier, 5000);
setInterval(refreshCloudConsciousnessLiveProviderRollbackNote, 5000);
setInterval(refreshCloudConsciousnessLiveProviderRuntimeAdapterCompletion, 5000);
setInterval(refreshCloudConsciousnessLiveProviderRuntimeAdapterClosure, 5000);
setInterval(refreshCloudConsciousnessLiveProviderRealLaunchRouteReview, 5000);
setInterval(refreshCloudConsciousnessLiveProviderRealLaunchExecutionPreflight, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueAccessGate, 5000);
setInterval(refreshCloudConsciousnessLiveProviderEndpointNetworkEgressGate, 5000);
setInterval(refreshCloudConsciousnessLiveProviderEgressExecutionRouteTaskPreflight, 5000);
setInterval(refreshCloudConsciousnessLiveProviderEgressExecutionTaskShell, 5000);
setInterval(refreshCloudConsciousnessLiveProviderEgressExecutionApprovedDeferred, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueAuthorizationRoute, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueAuthorizationTaskShell, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueAuthorizationApprovedDeferred, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueReadinessPreflight, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueReadTaskShell, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueReadApprovedDeferred, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationRoute, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationTaskShell, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationApprovedDeferred, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueFinalReadinessPreflight, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecisionRoute, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecisionTaskShell, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizationDecisionApprovedDeferred, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueAccessAuthorizedLocalProof, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueLocalReadRoute, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueLocalReadTaskShell, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueLocalReadApprovedDeferred, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueLocalReadFinalReadinessPreflight, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionRoute, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionTaskShell, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionApprovedDeferred, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionFinalReadinessPreflight, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadRoute, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadTaskShell, 5000);
setInterval(refreshCloudConsciousnessLiveProviderCredentialValueLocalReadExecutionLocalReadApprovedDeferred, 5000);
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
setInterval(refreshHealthTrends, 5000);
setInterval(refreshRouteAwareNextAction, 5000);
setInterval(refreshConservativeRecoveryPolicy, 5000);
setInterval(refreshBodyGovernanceReadiness, 5000);
setInterval(refreshBodyEvidenceTimeline, 5000);
setInterval(refreshBodyEvidenceTimelineReadiness, 5000);
setInterval(refreshBodyEvidenceLedgerPlan, 5000);
setInterval(refreshBodyEvidenceLedgerRouteReview, 5000);
setInterval(refreshBodyEvidenceLedgerStorageRootPlan, 5000);
setInterval(refreshBodyEvidenceLedgerStorageRootRouteReview, 5000);
setInterval(refreshBodyEvidenceLedgerDirectoryTask, 5000);
setInterval(refreshBodyEvidenceLedgerFirstRecordPlan, 5000);
setInterval(refreshBodyEvidenceLedgerFirstRecordRouteReview, 5000);
setInterval(refreshBodyEvidenceLedgerFirstRecordTask, 5000);
setInterval(refreshBodyEvidenceLedgerReadiness, 5000);
setInterval(refreshBodyEvidenceLedgerDemoStatus, 5000);
setInterval(refreshBodyEvidenceLedgerFollowupRecordPlan, 5000);
setInterval(refreshBodyEvidenceLedgerFollowupRecordRouteReview, 5000);
setInterval(refreshBodyEvidenceLedgerFollowupRecordTask, 5000);
setInterval(refreshBodyEvidenceLedgerFollowupRecordReadiness, 5000);
setInterval(refreshBodyEvidenceLedgerFollowupRecordAppendRouteReview, 5000);
setInterval(refreshBodyEvidenceLedgerFollowupRecordAppendReadiness, 5000);
setInterval(refreshPhase2RouteReview, 5000);
setInterval(refreshSystemdRepairCandidates, 5000);
setInterval(refreshSystemdRepairCandidatePlan, 5000);
setInterval(refreshSystemdRepairCandidateRoute, 5000);
setInterval(refreshSystemdRepairCandidateTaskShell, 5000);
setInterval(refreshSystemdRepairCandidateReadiness, 5000);
setInterval(refreshSystemdRepairCandidateRouteReview, 5000);
setInterval(refreshSystemdRepairCandidateDemoStatus, 5000);
setInterval(refreshSystemdNextRepairScopeReview, 5000);
setInterval(refreshSystemdNextRepairPlan, 5000);
setInterval(refreshSystemdNextRepairRouteReview, 5000);
setInterval(refreshSystemdNextRepairDryRun, 5000);
setInterval(refreshSystemdNextRepairTaskRoute, 5000);
setInterval(refreshSystemdNextRepairTaskShell, 5000);
setInterval(refreshSystemdUnitInventory, 5000);
setInterval(refreshSystemdDependencyMap, 5000);
setInterval(refreshSystemdRepairPlan, 5000);
setInterval(refreshSystemdRepairExecutionTaskDraft, 5000);
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

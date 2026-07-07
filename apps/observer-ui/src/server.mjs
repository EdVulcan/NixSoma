import http from "node:http";
import { clientScript } from "./client-script.mjs";

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
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-final-readiness-preflight-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Final Readiness Preflight</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-final-readiness-preflight-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-final-readiness-preflight-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-final-readiness-preflight-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-final-readiness-preflight-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-final-readiness-preflight-json">Loading credential value local read execution local read final readiness preflight...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-route-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Route</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-route-ready">false</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-route-credential">not read</span></div>
          <div class="metric"><span>Network</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-route-network">no egress</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-route-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-route-json">Loading credential value local read execution local read attempt route...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-task-shell-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Task Shell</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-task-shell-ready">false</span></div>
          <div class="metric"><span>Approval</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-task-shell-approval">required</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-task-shell-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-task-shell-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-task-shell-json">Loading credential value local read execution local read attempt task shell...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-approved-deferred-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Approved Deferred</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-approved-deferred-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-approved-deferred-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-approved-deferred-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-approved-deferred-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-approved-deferred-json">Loading credential value local read execution local read attempt approved deferred evidence...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-final-readiness-preflight-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Final Readiness Preflight</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-final-readiness-preflight-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-final-readiness-preflight-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-final-readiness-preflight-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-final-readiness-preflight-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-final-readiness-preflight-json">Loading credential value local read execution local read attempt final readiness preflight...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-route-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Route</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-route-ready">false</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-route-credential">not read</span></div>
          <div class="metric"><span>Network</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-route-network">no egress</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-route-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-route-json">Loading credential value local read execution local read attempt local read route...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-task-shell-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Task Shell</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-task-shell-ready">false</span></div>
          <div class="metric"><span>Approval</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-task-shell-approval">required</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-task-shell-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-task-shell-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-task-shell-json">Loading credential value local read execution local read attempt local read task shell...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-approved-deferred-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Approved Deferred</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-approved-deferred-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-approved-deferred-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-approved-deferred-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-approved-deferred-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-approved-deferred-json">Loading credential value local read execution local read attempt local read approved deferred evidence...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-final-readiness-preflight-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Final Readiness Preflight</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-final-readiness-preflight-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-final-readiness-preflight-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-final-readiness-preflight-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-final-readiness-preflight-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-final-readiness-preflight-json">Loading credential value local read execution local read attempt local read final readiness preflight...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-route-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Route</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-route-ready">false</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-route-credential">not read</span></div>
          <div class="metric"><span>Network</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-route-network">no egress</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-route-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-route-json">Loading credential value local read execution local read attempt local read result envelope route...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-task-shell-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Task Shell</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-task-shell-ready">false</span></div>
          <div class="metric"><span>Approval</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-task-shell-approval">required</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-task-shell-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-task-shell-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-task-shell-json">Loading credential value local read execution local read attempt local read result envelope task shell...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Approved Deferred</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-approved-deferred-json">Loading credential value local read execution local read attempt local read result envelope approved deferred evidence...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Final Readiness Preflight</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-final-readiness-preflight-json">Loading credential value local read execution local read attempt local read result envelope final readiness preflight...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Creation Route</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route-ready">false</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route-credential">not read</span></div>
          <div class="metric"><span>Network</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route-network">no egress</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-route-json">Loading credential value local read execution local read attempt local read result envelope creation route...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-task-shell-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Creation Task Shell</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-task-shell-ready">false</span></div>
          <div class="metric"><span>Approval</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-task-shell-approval">required</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-task-shell-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-task-shell-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-task-shell-json">Loading credential value local read execution local read attempt local read result envelope creation task shell...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-approved-deferred-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Creation Approved Deferred</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-approved-deferred-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-approved-deferred-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-approved-deferred-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-approved-deferred-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-approved-deferred-json">Loading credential value local read execution local read attempt local read result envelope creation approved deferred evidence...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Creation Final Readiness Preflight</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-final-readiness-preflight-json">Loading credential value local read execution local read attempt local read result envelope creation final readiness preflight...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-route-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Creation Execution Route</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-route-ready">false</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-route-credential">not read</span></div>
          <div class="metric"><span>Network</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-route-network">no egress</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-route-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-route-json">Loading credential value local read execution local read attempt local read result envelope creation execution route...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-shell-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Creation Execution Task Shell</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-shell-ready">false</span></div>
          <div class="metric"><span>Approval</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-shell-approval">required</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-shell-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-shell-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-task-shell-json">Loading credential value local read execution local read attempt local read result envelope creation execution task shell...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-approved-deferred-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Creation Execution Approved Deferred</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-approved-deferred-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-approved-deferred-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-approved-deferred-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-approved-deferred-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-approved-deferred-json">Loading credential value local read execution local read attempt local read result envelope creation execution approved deferred evidence...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Creation Execution Final Readiness Preflight</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight-credential">not read</span></div>
          <div class="metric"><span>Recorded</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight-recorded">false</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-final-readiness-preflight-json">Loading credential value local read execution local read attempt local read result envelope creation execution final readiness preflight...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Creation Execution Attempt Route</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route-ready">false</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route-credential">not read</span></div>
          <div class="metric"><span>Network</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route-network">no egress</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-route-json">Loading credential value local read execution local read attempt local read result envelope creation execution attempt route...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-shell-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Creation Execution Attempt Task Shell</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-shell-ready">false</span></div>
          <div class="metric"><span>Approval</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-shell-approval">required</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-shell-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-shell-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-task-shell-json">Loading credential value local read execution local read attempt local read result envelope creation execution attempt task shell...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Creation Execution Attempt Approved Deferred</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred-credential">not read</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-approved-deferred-json">Loading credential value local read execution local read attempt local read result envelope creation execution attempt approved deferred evidence...</pre>
        </section>
        <section class="panel" id="cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-panel">
          <h2>Cloud Consciousness Live Provider Credential Value Local Read Execution Local Read Attempt Local Read Result Envelope Creation Execution Attempt Final Readiness Preflight</h2>
          <div class="metric"><span>Ready</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-ready">false</span></div>
          <div class="metric"><span>Source</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-source">none</span></div>
          <div class="metric"><span>Credential</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-credential">not read</span></div>
          <div class="metric"><span>Recorded</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-recorded">false</span></div>
          <div class="metric"><span>Next</span><span id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-next">loading</span></div>
          <pre id="cloud-live-provider-credential-value-local-read-execution-local-read-attempt-local-read-result-envelope-creation-execution-attempt-final-readiness-preflight-json">Loading credential value local read execution local read attempt local read result envelope creation execution attempt final readiness preflight...</pre>
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

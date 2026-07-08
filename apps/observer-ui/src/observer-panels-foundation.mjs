export function observerFoundationPanels() {
  return `        <section class="panel">
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
`;
}

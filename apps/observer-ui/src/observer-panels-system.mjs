export function observerSystemPanels() {
  return `        <section class="panel" id="system-health-trends">
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
`;
}

export function observerOperationsPanels() {
  return `        <section class="panel">
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
          <h2>Engineering Loop State</h2>
          <div class="metric"><span>Kind</span><span id="engineering-loop-state-kind">none</span></div>
          <div class="metric"><span>Task</span><span id="engineering-loop-state-task">none</span></div>
          <div class="metric"><span>Approval</span><span id="engineering-loop-state-approval">none</span></div>
          <div class="metric"><span>Next</span><span id="engineering-loop-state-next">create task</span></div>
          <div class="metric"><span>Evidence</span><span id="engineering-loop-state-evidence">none</span></div>
          <div class="metric"><span>Completion</span><span id="engineering-loop-state-completion">not checked</span></div>
          <div class="actions tight">
            <button id="engineering-loop-completion-button" class="secondary" type="button">Refresh Completion</button>
            <button id="engineering-loop-restore-button" class="secondary" type="button">Restore Loop State</button>
          </div>
          <pre id="engineering-loop-state-json">No engineering loop task created from Observer controls yet.</pre>
        </section>
        <section class="panel">
          <h2>Engineering Verification Evidence</h2>
          <div class="metric"><span>Registry</span><span id="engineering-verification-registry">openclaw-native-engineering-verification-evidence-v0</span></div>
          <div class="metric"><span>Passed</span><span id="engineering-verification-passed">0</span></div>
          <div class="metric"><span>Failed</span><span id="engineering-verification-failed">0</span></div>
          <div class="metric"><span>Attached</span><span id="engineering-verification-attached">0</span></div>
          <div class="metric"><span>Execution</span><span id="engineering-verification-execution">blocked</span></div>
          <div class="control-stack">
            <div class="field">
              <label for="engineering-verification-proposal-input">Verification Proposal</label>
              <input id="engineering-verification-proposal-input" type="text" value="openclaw:typecheck" spellcheck="false" />
            </div>
            <div class="field">
              <label for="engineering-verification-query-input">Verification Query</label>
              <input id="engineering-verification-query-input" type="text" value="verify" spellcheck="false" />
            </div>
          </div>
          <div class="actions tight">
            <button id="engineering-verification-task-button" class="secondary" type="button">Create Verification Task</button>
          </div>
          <pre id="engineering-verification-json">Loading native engineering verification evidence...</pre>
        </section>
        <section class="panel">
          <h2>Engineering Recovery Evidence</h2>
          <div class="metric"><span>Registry</span><span id="engineering-recovery-registry">openclaw-native-engineering-recovery-evidence-v0</span></div>
          <div class="metric"><span>Failures</span><span id="engineering-recovery-failures">0</span></div>
          <div class="metric"><span>Recoverable</span><span id="engineering-recovery-recoverable">0</span></div>
          <div class="metric"><span>Recovered</span><span id="engineering-recovery-recovered">0</span></div>
          <div class="metric"><span>Execution</span><span id="engineering-recovery-execution">blocked</span></div>
          <div class="metric"><span>Action Draft</span><span id="engineering-recovery-action">none</span></div>
          <div class="actions tight">
            <button id="engineering-recovery-draft-button" class="secondary" type="button">Draft Recovery Action</button>
            <button id="engineering-recovery-task-button" class="secondary" type="button">Create Recovery Task</button>
          </div>
          <pre id="engineering-recovery-action-json">No engineering recovery action drafted yet.</pre>
          <pre id="engineering-recovery-json">Loading native engineering recovery evidence...</pre>
        </section>
        <section class="panel">
          <h2>Engineering Microcompact Evidence</h2>
          <div class="metric"><span>Registry</span><span id="engineering-microcompact-registry">openclaw-native-engineering-microcompact-evidence-v0</span></div>
          <div class="metric"><span>Items</span><span id="engineering-microcompact-items">0</span></div>
          <div class="metric"><span>Compactable</span><span id="engineering-microcompact-compactable">0</span></div>
          <div class="metric"><span>Reclaimed</span><span id="engineering-microcompact-reclaimed">0</span></div>
          <div class="metric"><span>Mutation</span><span id="engineering-microcompact-mutation">blocked</span></div>
          <pre id="engineering-microcompact-json">Loading native engineering microcompact evidence...</pre>
        </section>
        <section class="panel">
          <h2>Engineering Plan/Todo Evidence</h2>
          <div class="metric"><span>Registry</span><span id="engineering-plan-todo-registry">openclaw-native-engineering-plan-todo-evidence-v0</span></div>
          <div class="metric"><span>Tasks</span><span id="engineering-plan-todo-tasks">0</span></div>
          <div class="metric"><span>Todos</span><span id="engineering-plan-todo-todos">0</span></div>
          <div class="metric"><span>Done</span><span id="engineering-plan-todo-done">0</span></div>
          <div class="metric"><span>Mutation</span><span id="engineering-plan-todo-mutation">blocked</span></div>
          <div class="metric"><span>Workbench</span><span id="engineering-plan-todo-workbench">none</span></div>
          <div class="actions tight">
            <button id="engineering-plan-todo-bridge-button" class="secondary" type="button">Bridge Workbench State</button>
          </div>
          <pre id="engineering-plan-todo-workbench-json">No engineering planning workbench state bridged yet.</pre>
          <pre id="engineering-plan-todo-json">Loading native engineering plan/todo evidence...</pre>
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
          <h2>OpenClaw Engineering Tool Surface</h2>
          <div class="metric"><span>Registry</span><span id="engineering-tool-surface-registry">openclaw-native-engineering-tool-surface-inventory-v0</span></div>
          <div class="metric"><span>Tools</span><span id="engineering-tool-surface-tools">0</span></div>
          <div class="metric"><span>Deferred</span><span id="engineering-tool-surface-deferred">0</span></div>
          <div class="metric"><span>Execution</span><span id="engineering-tool-surface-execution">blocked</span></div>
          <div class="metric"><span>Mode</span><span id="engineering-tool-surface-mode">read-only-tool-contract-mapping</span></div>
          <pre id="engineering-tool-surface-json">Loading native engineering tool surface inventory...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Engineering Read/Search</h2>
          <div class="metric"><span>Registry</span><span id="engineering-read-search-registry">openclaw-native-engineering-read-search-v0</span></div>
          <div class="metric"><span>Read</span><span id="engineering-read-search-read">0</span></div>
          <div class="metric"><span>Glob</span><span id="engineering-read-search-glob">0</span></div>
          <div class="metric"><span>Grep</span><span id="engineering-read-search-grep">0</span></div>
          <div class="metric"><span>Bounds</span><span id="engineering-read-search-bounds">active</span></div>
          <pre id="engineering-read-search-json">Loading native engineering read/search evidence...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Engineering LSP Evidence / Lifecycle / Source Transfer</h2>
          <div class="metric"><span>Registry</span><span id="engineering-lsp-registry">openclaw-native-engineering-lsp-evidence-v0</span></div>
          <div class="metric"><span>Languages</span><span id="engineering-lsp-languages">none</span></div>
          <div class="metric"><span>Server</span><span id="engineering-lsp-server">not_checked</span></div>
          <div class="metric"><span>Runtime</span><span id="engineering-lsp-runtime">blocked</span></div>
          <div class="metric"><span>Mode</span><span id="engineering-lsp-mode">lsp-contract-and-availability-evidence-only</span></div>
          <div class="control-row">
            <button id="engineering-lsp-lifecycle-task-button" class="secondary" type="button">Create Lifecycle Task</button>
            <button id="engineering-lsp-source-transfer-task-button" class="secondary" type="button">Create Source Transfer Task</button>
          </div>
          <pre id="engineering-lsp-json">Loading native engineering LSP evidence, lifecycle draft, and source-transfer proposal...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Engineering Edit Proposal</h2>
          <div class="metric"><span>Registry</span><span id="engineering-edit-proposal-registry">openclaw-native-engineering-edit-proposal-v0</span></div>
          <div class="metric"><span>Target</span><span id="engineering-edit-proposal-target">none</span></div>
          <div class="metric"><span>Preview</span><span id="engineering-edit-proposal-preview">0 lines</span></div>
          <div class="metric"><span>Apply</span><span id="engineering-edit-proposal-apply">blocked</span></div>
          <div class="metric"><span>Audit</span><span id="engineering-edit-proposal-audit">missing</span></div>
          <div class="control-stack">
            <div class="field">
              <label for="engineering-edit-path-input">Edit Path</label>
              <input id="engineering-edit-path-input" type="text" value="package.json" spellcheck="false" />
            </div>
            <div class="field">
              <label for="engineering-edit-old-input">Search Text</label>
              <input id="engineering-edit-old-input" type="text" value="OpenClaw on NixOS monorepo skeleton" spellcheck="false" />
            </div>
            <div class="field">
              <label for="engineering-edit-new-input">Replacement Text</label>
              <input id="engineering-edit-new-input" type="text" value="OpenClaw on NixOS native agent body skeleton" spellcheck="false" />
            </div>
          </div>
          <div class="actions tight">
            <button id="engineering-edit-proposal-task-button" class="secondary" type="button">Create Edit Task</button>
          </div>
          <pre id="engineering-edit-proposal-json">Loading native engineering edit proposal evidence...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Engineering Write Proposal</h2>
          <div class="metric"><span>Registry</span><span id="engineering-write-proposal-registry">openclaw-native-engineering-write-proposal-v0</span></div>
          <div class="metric"><span>Kind</span><span id="engineering-write-proposal-kind">create_file_proposal</span></div>
          <div class="metric"><span>Target</span><span id="engineering-write-proposal-target">none</span></div>
          <div class="metric"><span>Bytes</span><span id="engineering-write-proposal-bytes">0</span></div>
          <div class="metric"><span>Mutation</span><span id="engineering-write-proposal-mutation">blocked</span></div>
          <div class="metric"><span>Mode</span><span id="engineering-write-proposal-mode">source-write-proposal-diff-metadata-preview-only</span></div>
          <div class="control-stack">
            <div class="field">
              <label for="engineering-write-path-input">Write Path</label>
              <input id="engineering-write-path-input" type="text" value="scratch/observer-engineering-loop.txt" spellcheck="false" />
            </div>
            <div class="field">
              <label for="engineering-write-content-input">Write Content</label>
              <input id="engineering-write-content-input" type="text" value="OpenClaw observer engineering loop write proposal" spellcheck="false" />
            </div>
          </div>
          <div class="actions tight">
            <button id="engineering-write-proposal-task-button" class="secondary" type="button">Create Write Task</button>
          </div>
          <pre id="engineering-write-proposal-json">Loading native engineering write proposal evidence...</pre>
        </section>
        <section class="panel">
          <h2>OpenClaw Engineering Write Execution</h2>
          <div class="metric"><span>Registry</span><span id="engineering-write-execution-registry">openclaw-native-engineering-write-execution-evidence-v0</span></div>
          <div class="metric"><span>Total</span><span id="engineering-write-execution-total">0</span></div>
          <div class="metric"><span>Passed</span><span id="engineering-write-execution-passed">0</span></div>
          <div class="metric"><span>Proposal</span><span id="engineering-write-execution-proposal">0</span></div>
          <div class="metric"><span>Mutation</span><span id="engineering-write-execution-mutation">blocked</span></div>
          <div class="metric"><span>Mode</span><span id="engineering-write-execution-mode">approved-workspace-text-write-execution-evidence</span></div>
          <pre id="engineering-write-execution-json">Loading native engineering write execution evidence...</pre>
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
          <h2>OpenClaw Native Runtime Refresh</h2>
          <div class="metric"><span>Registry</span><span id="native-plugin-runtime-refresh-registry">openclaw-native-plugin-runtime-refresh-evidence-v0</span></div>
          <div class="metric"><span>State</span><span id="native-plugin-runtime-refresh-state">unknown</span></div>
          <div class="metric"><span>Blocked</span><span id="native-plugin-runtime-refresh-blocked">0</span></div>
          <div class="metric"><span>Runtime</span><span id="native-plugin-runtime-refresh-runtime">blocked</span></div>
          <div class="metric"><span>Mode</span><span id="native-plugin-runtime-refresh-mode">governed-runtime-refresh-evidence-only</span></div>
          <pre id="native-plugin-runtime-refresh-json">Loading native plugin runtime refresh evidence...</pre>
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
`;
}

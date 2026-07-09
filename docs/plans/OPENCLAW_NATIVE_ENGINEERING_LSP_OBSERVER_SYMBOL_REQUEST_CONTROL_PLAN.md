# OpenClaw Native Engineering LSP Observer Symbol Request Control Plan

Updated: 2026-07-10

## Active Slice

Observer control and readback for approval-gated LSP symbol request tasks.

This slice connects the existing `symbol_request` lifecycle task to the
Observer LSP panel. It does not add a new route or evidence shell. The operator
can create the already-governed symbol request task from the LSP panel, then use
the Engineering Loop readback control to inspect task, approval, execution,
lifecycle state, recovery recommendation, and remaining long-lived-pool
deferral.

Identity alignment: Level 1, stable user-space control plane.

## UI Surface

```text
panel: OpenClaw Engineering LSP Evidence / Lifecycle / Source / Symbol
button: #engineering-lsp-symbol-request-task-button
client function: createEngineeringLspSymbolRequestLoopTask
task route: POST /plugins/native-adapter/engineering-lsp/lifecycle-tasks
readback route: GET /tasks/:taskId
```

The button creates:

```text
lifecycleAction: symbol_request
symbolAction: definition
relativePath: src/app.ts
line: 2
character: 14
confirm: true
```

The task still requires manual approval and an operator step before any LSP
process starts or any JSON-RPC operational request is sent.

## Implemented Behavior

The Observer now:

```text
shows a Create Symbol Request Task control beside lifecycle and source-transfer controls
creates the existing approval-gated symbol_request task only after an explicit click
focuses the created task in task history
records task/approval/evidence route in Engineering Loop State
refreshes LSP evidence after task creation/readback
displays symbol_request completion readback from /tasks/:taskId
shows symbolRequestSent state and lifecycle result state
keeps approval, operator step, and recovery decisions explicit
```

## Boundaries

This slice still blocks:

```text
automatic approval
automatic operator step
new core routes or duplicate evidence milestones
long-lived LSP process pools
multi-request symbol navigation sessions
provider calls, network egress, root/system daemon work
workspace mutation
```

## Evidence

Runtime:

```text
apps/observer-ui/src/observer-panels-operations.mjs
apps/observer-ui/src/client-script-config-dom-workspace-source.mjs
apps/observer-ui/src/client-script-runtime-bindings.mjs
apps/observer-ui/src/client-script-runtime-engineering-loop-controls.mjs
apps/observer-ui/src/client-script-renderers-engineering-lsp.mjs
```

Validation targets:

```text
nix/scripts/dev-observer-openclaw-native-engineering-lsp-evidence-check.sh
observer-openclaw-native-engineering-lsp-evidence
```

The core execution proof remains in:

```text
openclaw-native-engineering-lsp-evidence
```

## Next Slice

The next smallest real capability is:

```text
bounded LSP symbol response summary
```

That follow-up should parse the selected JSON-RPC response enough to expose
bounded result metadata for definition/references/hover without returning raw
source bodies, keeping long-lived process pools, provider egress, package
installation, and root/system daemon work deferred.

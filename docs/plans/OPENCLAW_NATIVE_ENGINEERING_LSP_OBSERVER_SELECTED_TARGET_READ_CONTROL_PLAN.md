# OpenClaw Native Engineering LSP Observer Selected-Target Read Control Plan

Updated: 2026-07-10

## Active Slice

Observer selected-target read control.

This slice turns the LSP selected-target read bridge into an explicit operator
control in Observer. After an LSP symbol request task has completed and exposed
selected target metadata, the operator can click `Read Selected Target` in
Engineering Loop State to call the bounded bridge and inspect a native read
preview.

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

Observer now exposes:

```text
button: #engineering-loop-selected-target-read-button
bridge route: GET /plugins/native-adapter/engineering-lsp/selected-target-read-bridge
state panel: #engineering-loop-state-json
```

The control:

```text
requires an existing or restored LSP lifecycle task in Engineering Loop State
uses the selected task id and language to call the bridge
passes includeRead=true only after the operator clicks
renders the bounded target path, line range, read summary, governance flags, and preview
keeps the task/approval/operator execution lifecycle unchanged
```

## Boundaries

This slice still blocks:

```text
automatic selected-target reads
automatic task or approval creation
additional JSON-RPC requests
LSP process start/reuse
workspace mutation
provider calls, network egress, root/system daemon work
```

## Evidence

Runtime:

```text
apps/observer-ui/src/observer-panels-operations.mjs
apps/observer-ui/src/client-script-config-dom.mjs
apps/observer-ui/src/client-script-runtime-bindings.mjs
apps/observer-ui/src/client-script-runtime-engineering-loop-controls.mjs
```

Validation targets:

```text
npm --workspace @openclaw/observer-ui run typecheck
observer-openclaw-native-engineering-lsp-evidence
```

## Next Slice

The next smallest real capability is:

```text
LSP selected-target edit proposal seed
```

That follow-up should let the operator turn a bounded selected-target read
preview into an explicit edit proposal draft, still without automatic approval
or mutation.

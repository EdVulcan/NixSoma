# OpenClaw Native Engineering LSP Observer Selected-Target Edit Seed Control Plan

Updated: 2026-07-10

## Active Slice

Observer selected-target edit seed control.

This slice connects the selected-target edit proposal seed endpoint to the
existing Observer edit proposal controls. After a completed LSP symbol request,
the operator can click `Seed Edit Proposal` to prefill the edit path and search
text from the bounded selected target read.

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

Observer now exposes:

```text
button: #engineering-loop-selected-target-edit-seed-button
seed route: GET /plugins/native-adapter/engineering-lsp/selected-target-edit-proposal-seed
existing edit inputs: #engineering-edit-path-input, #engineering-edit-old-input, #engineering-edit-new-input
```

The control:

```text
requires an existing or restored LSP lifecycle task in Engineering Loop State
calls the seed endpoint only after an explicit operator click
prefills the existing edit proposal path/search/replacement inputs
leaves Create Edit Task as the separate approval-gated next step
does not create tasks, approvals, patches, writes, or provider calls
```

## Boundaries

This slice still blocks:

```text
automatic edit task creation
automatic approval creation
patch application and workspace mutation
additional JSON-RPC requests
LSP process start/reuse
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
LSP selected-target edit closed-loop proof
```

That follow-up should prove the operator path from selected target -> seeded
edit inputs -> explicit edit task creation -> approval -> patch apply ->
existing ledger/evidence readback, without adding another readiness shell.

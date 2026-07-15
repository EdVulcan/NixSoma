# OpenClaw Native Engineering LSP Explicit Target Selection Plan

Updated: 2026-07-15

## Active Slice

Explicit operator selection of a bounded target from a completed LSP symbol
response.

Identity alignment: Level 1, stable user-space control plane.

## Demonstrated Gap

The native LSP response summary already retained up to eight bounded URI/range
targets and the existing read bridge and edit-proposal seed already accepted a
bounded `targetIndex`. Observer nevertheless displayed only the default first
target, so an operator could not choose which returned definition/reference to
read or seed for editing.

## Implemented Behavior

Observer now:

```text
shows the bounded response target list only after a completed symbol request
lets the operator select one target through an explicit option menu
keeps the selection in the current Observer loop state only
passes the selected bounded targetIndex to the existing read bridge
passes the same selected targetIndex to the existing edit-proposal seed
keeps Read Selected Target and Seed Edit Proposal as separate explicit actions
```

The selection does not mutate the task or persisted LSP lifecycle state. The
existing core bridge continues to re-resolve the target from the completed
response summary, constrain its URI to the workspace, and apply the native read
and edit-proposal bounds.

No additional JSON-RPC request, LSP process, task, approval, workspace write,
provider call, or network egress is introduced.

## Evidence

Observer runtime:

```text
apps/observer-ui/src/client-script-runtime-engineering-lsp-target-selection.mjs
apps/observer-ui/src/client-script-runtime-engineering-loop-controls.mjs
apps/observer-ui/src/client-script-config-dom-workspace-source.mjs
apps/observer-ui/src/observer-panels-operations.mjs
```

Focused tests and milestone:

```text
apps/observer-ui/test/client-script-engineering-lsp-target-selection.test.mjs
services/openclaw-core/test/native-engineering-lsp-selected-target-read-bridge-builders.test.mjs
services/openclaw-core/test/native-adapter-plugin-routes.test.mjs
observer-openclaw-native-engineering-lsp-evidence
```

## Deferred

```text
target selection by raw LSP payload
unbounded target lists or target URIs outside the existing summary bounds
automatic target selection or automatic read/edit task creation
selection persistence in core task state
long-lived LSP pools and multi-request sessions
provider egress, root/system daemon work, and arbitrary endpoint execution
```

## Next Smallest Capability

Keep the LSP target-selection and selected-target edit/verification loop closed.
Do not add another LSP variant or selection persistence layer unless a concrete
operator workflow demonstrates that the current explicit, page-local selection
is insufficient. Select the next capability from a new local engineering or
trusted work-view gap.

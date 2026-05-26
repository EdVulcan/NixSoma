# OpenClaw on NixOS Phase 25 Plan

Phase 25 starts after `openclaw-cloud-consciousness-live-provider-runtime-adapter-module-contract`. Phase 24 created the dedicated runtime adapter module boundary and proved it remains contract-only.

## Phase 25 Theme

Create the approval-gated live provider runtime adapter module task shell without mutating module source or implementing adapter behavior.

## Milestone Slice

1. `openclaw-cloud-consciousness-live-provider-runtime-adapter-module-task`
   - Creates an operator-reviewed task shell for future work on `cloud-live-provider-runtime-adapter.mjs`.
   - Requires explicit `confirm=true`.
   - Creates a linked pending approval.
   - Confirms source mutation remains disabled.
   - Confirms no SDK import, credential value read, endpoint contact, network egress, or live provider call occurs.

## Exit Boundary

Phase 25 is complete when core and Observer both expose the approval-gated runtime adapter module task shell, the task is queued behind approval, and all module mutation and live-provider activity remains disabled.

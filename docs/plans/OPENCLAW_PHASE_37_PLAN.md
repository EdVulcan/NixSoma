# OpenClaw on NixOS Phase 37 Plan

Phase 37 starts after `openclaw-cloud-consciousness-live-provider-no-network-sender`. Phase 36 implemented the deferred no-network sender envelope.

## Phase 37 Theme

Create an approval-gated task shell around the no-network sender envelope before it can be connected to any executable egress path.

## Milestone Slice

1. `openclaw-cloud-consciousness-live-provider-no-network-sender-task`
   - Requires explicit `confirm=true`.
   - Creates an operator-reviewed task shell for future sender-envelope use.
   - Links a pending high-risk approval.
   - Confirms dispatch remains deferred.
   - Confirms no endpoint contact, network egress, or live provider call occurs.

## Exit Boundary

Phase 37 is complete when core and Observer both expose the approval-gated no-network sender task shell and all live provider egress remains disabled.

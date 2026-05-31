# OpenClaw on NixOS Phase 42 Plan

Phase 42 starts after `openclaw-cloud-consciousness-live-provider-egress-transcript-recorder-task`. Phase 41 created the approval-gated transcript recorder task shell without attaching it to a live egress path.

## Phase 42 Theme

Approve the egress transcript recorder task shell while keeping executable provider egress deferred.

## Milestone Slice

1. `openclaw-cloud-consciousness-approved-live-provider-egress-transcript-recorder-deferred`
   - Approves the Phase 41 transcript recorder task.
   - Runs one operator step.
   - Completes into `deferred_after_approval`.
   - Confirms no source mutation, endpoint contact, network egress, provider response creation, or live provider call occurs.

## Exit Boundary

Phase 42 is complete when an approved transcript recorder task records deferred evidence and remains visible to Observer, while all live provider activity stays disabled.

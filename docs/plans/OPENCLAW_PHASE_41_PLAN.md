# OpenClaw on NixOS Phase 41 Plan

Phase 41 starts after `openclaw-cloud-consciousness-live-provider-egress-transcript-recorder`. Phase 40 implemented the local transcript recorder but did not attach it to any executable runtime path.

## Phase 41 Theme

Create an approval-gated task shell for the local egress transcript recorder.

## Milestone Slice

1. `openclaw-cloud-consciousness-live-provider-egress-transcript-recorder-task`
   - Requires `confirm=true` before task creation.
   - Creates a high-risk operator-reviewed task shell for the transcript recorder.
   - Keeps transcript recording local-only and keeps live provider egress disabled.

## Exit Boundary

Phase 41 is complete when the transcript recorder task shell is visible in core and Observer with pending approval and no endpoint contact, network egress, credential value read, provider response creation, or live provider call.

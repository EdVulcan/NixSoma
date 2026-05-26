# OpenClaw on NixOS Phase 34 Plan

Phase 34 starts after `openclaw-cloud-consciousness-live-provider-credential-reference-resolver-task`. Phase 33 created the approval-gated task shell for future credential reference resolver work.

## Phase 34 Theme

Prove an approved credential reference resolver task records deferred evidence instead of accessing credential values.

## Milestone Slice

1. `openclaw-cloud-consciousness-approved-live-provider-credential-reference-resolver-deferred`
   - Creates the Phase 33 credential reference resolver task shell.
   - Approves the linked operator approval.
   - Runs one operator step.
   - Confirms the task records `deferred_after_approval`.
   - Confirms credential-store access, credential value reads, endpoint contact, network egress, and live provider calls remain disabled.

## Exit Boundary

Phase 34 is complete when approved credential resolver work is visible as deferred evidence in core and Observer, while all credential value access remains disabled.

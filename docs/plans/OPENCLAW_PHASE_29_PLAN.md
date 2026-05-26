# OpenClaw on NixOS Phase 29 Plan

Phase 29 starts after `openclaw-cloud-consciousness-live-provider-request-builder`. Phase 28 implemented the first pure runtime adapter function, `buildProviderRequest`, and proved it serializes a local provider request without reading credentials or contacting endpoints.

## Phase 29 Theme

Create an approval-gated task shell around the pure live provider request builder without using it in an executable egress path.

## Milestone Slice

1. `openclaw-cloud-consciousness-live-provider-request-builder-task`
   - Requires explicit `confirm=true`.
   - Creates an operator-reviewed task shell for future use of `buildProviderRequest`.
   - Links a pending high-risk approval before request-builder output can be connected to any runtime adapter path.
   - Carries only credential references and request metadata.
   - Confirms no SDK import, credential value read, endpoint contact, network egress, or live provider call occurs.

## Exit Boundary

Phase 29 is complete when core and Observer both expose the approval-gated request-builder task shell, the task is queued behind approval, and live provider execution remains disabled.

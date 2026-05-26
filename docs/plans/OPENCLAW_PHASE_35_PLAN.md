# OpenClaw on NixOS Phase 35 Plan

Phase 35 starts after `openclaw-cloud-consciousness-approved-live-provider-credential-reference-resolver-deferred`. Phases 32-34 introduced the credential reference resolver, its task shell, and approved-deferred evidence.

## Phase 35 Theme

Run a focused regression for the credential reference resolver chain before advancing toward bounded credential-store integration.

## Milestone Slice

1. `openclaw-cloud-consciousness-live-provider-credential-reference-resolver-regression`
   - Replays the Phase 32 reference-only resolver.
   - Creates the Phase 33 approval-gated credential resolver task shell.
   - Approves and steps the Phase 34 deferred execution path.
   - Confirms credential references remain valid and reference-only.
   - Confirms no credential value read, credential value exposure, endpoint contact, network egress, or live provider call occurs.

## Exit Boundary

Phase 35 is complete when the credential reference resolver chain is regression-verified in core and Observer, preserving the whitepaper-aligned boundary before any credential-store access.

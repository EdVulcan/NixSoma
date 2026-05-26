# OpenClaw on NixOS Phase 32 Plan

Phase 32 starts after `openclaw-cloud-consciousness-live-provider-request-builder-regression`. Phase 31 closed the request builder chain and preserved the boundary between local request serialization and live provider egress.

## Phase 32 Theme

Implement a pure credential reference resolver that validates OpenClaw credential references without reading credential values.

## Milestone Slice

1. `openclaw-cloud-consciousness-live-provider-credential-reference-resolver`
   - Implements `resolveCredentialReference` in the dedicated live provider runtime adapter module.
   - Accepts credential references emitted by `buildProviderRequest`.
   - Validates reference shape and carries reference-only metadata.
   - Confirms credential value reads and credential value exposure remain disabled.
   - Confirms no endpoint contact, network egress, or live provider call occurs.

## Exit Boundary

Phase 32 is complete when the credential reference resolver is visible in core and Observer, validates reference-only metadata, and performs no credential value access or live provider activity.

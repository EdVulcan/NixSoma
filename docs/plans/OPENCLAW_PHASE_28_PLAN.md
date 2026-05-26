# OpenClaw on NixOS Phase 28 Plan

Phase 28 starts after `openclaw-cloud-consciousness-runtime-adapter-module-regression`. Phase 27 closed the runtime adapter module chain and proved approved module work remains deferred without source mutation.

## Phase 28 Theme

Implement the first pure runtime adapter function, `buildProviderRequest`, without enabling SDK loading, credential value reads, endpoint contact, network egress, or live provider calls.

## Milestone Slice

1. `openclaw-cloud-consciousness-live-provider-request-builder`
   - Implements a pure provider request builder in `cloud-live-provider-runtime-adapter.mjs`.
   - Serializes reviewed request metadata into a deterministic local request payload.
   - Carries credential references without reading credential values.
   - Marks endpoint contact and network egress as disabled.
   - Exposes the pure request builder through core and Observer.

## Exit Boundary

Phase 28 is complete when the pure request builder is visible in core and Observer, returns a deterministic local request body, and still performs no live provider activity.

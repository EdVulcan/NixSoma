# OpenClaw on NixOS Phase 20 Plan

Phase 20 starts after `openclaw-cloud-consciousness-approved-live-provider-runtime-implementation-deferred`. Phase 19 proved the approved runtime implementation shell still defers live work. Phase 20 defines the runtime adapter implementation interface scaffold before any provider code is created.

## Phase 20 Theme

Define the live provider-call runtime adapter implementation interface without implementing live egress.

This phase does not create provider runtime code, load a provider SDK, read credential values, contact endpoint hosts, transmit externally, or enable live provider calls.

## Milestone Slices

1. `openclaw-cloud-consciousness-live-provider-call-runtime-adapter-implementation`
   - Confirms the Phase 17 runtime implementation plan is ready.
   - Defines the future adapter methods: request serialization, credential reference resolution, provider send, egress transcript, response verification, and rollback note.
   - Reports `definesRuntimeAdapterInterface: true` and `implementsRuntimeAdapter: false`.
   - Keeps SDK, credential, endpoint, network, and live-call flags disabled.
   - Continues to use `cloud-live-provider-runtime-implementation.mjs` as the implementation Module.

## Exit Criteria

Phase 20 is complete when the runtime adapter interface scaffold is visible in core and Observer, reports 100% readiness, and still shows no runtime adapter implementation, SDK load, credential value read, endpoint contact, network egress, or live provider call.

## Boundary

Do not implement runtime code, import provider SDKs, read credential values, contact endpoints, transmit externally, execute a live call, or add unrelated approval hardening in this phase.

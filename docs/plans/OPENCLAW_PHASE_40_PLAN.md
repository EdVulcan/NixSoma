# OpenClaw on NixOS Phase 40 Plan

Phase 40 starts after `openclaw-cloud-consciousness-live-provider-no-network-sender-regression`. Phase 39 closed the no-network sender chain and proved dispatch remains deferred before any provider egress.

## Phase 40 Theme

Implement the local live-provider egress transcript recorder without enabling endpoint contact, network egress, provider responses, credential value reads, or live provider calls.

## Milestone Slice

1. `openclaw-cloud-consciousness-live-provider-egress-transcript-recorder`
   - Implements `recordEgressTranscript` in `cloud-live-provider-runtime-adapter.mjs`.
   - Converts the Phase 36 deferred no-network sender envelope into a local transcript object using `openclaw.cloud_consciousness.live_provider_egress_transcript.v0`.
   - Records request hash, credential reference, redaction policy, deferred dispatch, and no-network evidence.
   - Keeps credential values, endpoint contact, network egress, provider responses, and live provider calls disabled.

## Exit Boundary

Phase 40 is complete when core and Observer expose the transcript recorder as ready, local-only, and deferred. This phase does not persist transcript records, attach them to runtime execution, contact provider endpoints, read credential values, create provider responses, or enable live provider calls.

# OpenClaw on NixOS Phase 44 Plan

Phase 44 starts after `openclaw-cloud-consciousness-live-provider-egress-transcript-recorder-regression`. Phase 43 closed the local egress transcript recorder chain and proved dispatch remains deferred.

## Phase 44 Theme

Implement the local live-provider response verifier without creating provider responses, contacting endpoints, reading credential values, or enabling live provider calls.

## Milestone Slice

1. `openclaw-cloud-consciousness-live-provider-response-verifier`
   - Implements `verifyProviderResponse` in `cloud-live-provider-runtime-adapter.mjs`.
   - Validates a local provider-response rehearsal readback against the local egress transcript.
   - Confirms the response source is `local_rehearsal_readback`.
   - Confirms the transcript remains deferred and no live provider response is created.

## Exit Boundary

Phase 44 is complete when core and Observer expose the response verifier as ready, local-only, and non-live. This phase does not persist new response records, contact provider endpoints, read credential values, create provider responses, or enable live provider calls.

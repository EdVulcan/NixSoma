# OpenClaw Phase 80 Plan: Live Provider Credential Value Local Read Task Shell

Phase 80 starts after `openclaw-cloud-consciousness-live-provider-credential-value-local-read-route`. Phase 79 routed from local proof evidence to a separate approval-gated local read task shell.

## Purpose

Create an approval-gated credential value local read task shell without reading credential values. This gives the local body an explicit task object and approval envelope for the future read while preserving redaction, Observer visibility, and local-first auditability.

This phase still does not read credential values.

## Milestone Slice

1. `openclaw-cloud-consciousness-live-provider-credential-value-local-read-task-shell`
   - Requires Phase 79 credential value local read route evidence.
   - Exposes `POST /cloud-consciousness/live-provider-credential-value-local-read-tasks`.
   - Creates a task of type `cloud_consciousness_live_provider_credential_value_local_read_task`.
   - Requires approval before the shell can complete.
   - On approval, records `credentialValueLocalReadTaskApproved: true` and `credentialValueLocalReadDeferred: true`.
   - Keeps `credentialValueRead: false`, `credentialValueIncluded: false`, `credentialValueExposed: false`, and `providerCredentialRead: false`.
   - Keeps endpoint contact, network egress, provider response creation, rollback execution, host mutation, and live provider calls disabled.

2. `observer-openclaw-cloud-consciousness-live-provider-credential-value-local-read-task-shell`
   - Shows credential value local read task shell readiness in Observer.
   - Displays readiness, approval requirement, credential state, task endpoint, and next recommended slice.

## Deferred

- Actually reading credential values.
- Exposing credential values in API responses, task summaries, logs, or Observer.
- Recording a credential value read approved-deferred evidence endpoint.
- Authorizing endpoint/network egress.
- Contacting any provider endpoint.
- Performing network egress.
- Creating a provider response from a live call.
- Executing rollback or mutating host state.
- Enabling an actual live provider call.

## Next Likely Slice

`openclaw-cloud-consciousness-live-provider-credential-value-local-read-approved-deferred`: expose the approved local read task shell as stable local evidence while still keeping the value unread.

# OpenClaw Native Engineering LSP Symbol Response Summary Plan

Updated: 2026-07-10

## Active Slice

Bounded LSP symbol response summary.

This slice upgrades the approval-gated single symbol request task from
"response observed" to bounded result metadata. It parses the JSON-RPC response
for the selected `textDocument/definition`, `textDocument/references`, or
`textDocument/hover` request and records only shape/count metadata, not raw
source bodies or raw response payloads.

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

The LSP symbol request execution now records:

```text
response observed
request id
method
result kind
result count
unique URI count
range count
hover content kind and character count
error code and error message character count
rawResultIncluded=false
```

This summary appears in:

```text
execution.server.symbolResponseSummary
execution.processSupervision.protocolHandshake.symbolResponseSummary
task.engineeringLspLifecycle.symbolRequest.responseSummary
lifecycle state server.symbolResponseSummary
Observer Engineering Loop LSP completion readback
```

## Boundaries

This slice still blocks:

```text
raw symbol response payload exposure
raw source body exposure
multi-request symbol navigation sessions
long-lived language-server process pools
automatic retries and automatic recovery execution
package installation and PATH mutation
provider calls, network egress, root/system daemon work
workspace mutation
```

## Evidence

Runtime:

```text
services/openclaw-core/src/native-engineering-lsp-protocol-handshake.mjs
services/openclaw-core/src/native-engineering-lsp-lifecycle-tasks.mjs
services/openclaw-core/src/native-engineering-lsp-lifecycle-state.mjs
apps/observer-ui/src/client-script-runtime-engineering-loop-controls.mjs
```

Validation targets:

```text
services/openclaw-core/test/task-executor.test.mjs
openclaw-native-engineering-lsp-evidence
observer-openclaw-native-engineering-lsp-evidence
```

## Follow-up Completed

The variant request follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_VARIANT_REQUESTS_PLAN.md
```

It exercises the same approval-gated single-request path for `references` and
`hover`, proves the bounded response summary handles both shapes, and keeps
long-lived process pools, package installation, provider egress, network egress,
and root/system daemon work deferred.

# OpenClaw Native Engineering LSP Lifecycle Readiness Draft Plan

Updated: 2026-07-09

## Active Slice

Native governed engineering LSP lifecycle readiness draft.

This slice extends the existing `cc_lsp` migration beyond static availability
evidence by drafting a workspace-scoped language-server lifecycle action. It
does not start a language server, check server binaries, create tasks, create
approvals, persist lifecycle state, read source file contents into LSP, or send
JSON-RPC.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint

```text
GET /plugins/native-adapter/engineering-lsp/lifecycle-draft

registry: openclaw-native-engineering-lsp-lifecycle-draft-v0
mode: lsp-lifecycle-readiness-draft-only
```

Capability mapping:

```text
cc_lsp lifecycle -> plan.openclaw.engineering_tool.lsp_lifecycle
```

## Implemented Behavior

The native builder:

```text
selects an OpenClaw workspace root from the workspace registry
normalizes a supported language and lifecycle action
scans bounded workspace metadata for language/config signals
maps the intended server binary and args without executing checks
builds readiness gates for scope, metadata, Observer visibility, audit,
server-binary check, process supervision, lifecycle state, approval task bridge,
and JSON-RPC handshake
returns a draft-only lifecycle action for start/stop/restart/recover
embeds audit evidence in the response
```

Observer reuses the existing LSP panel and shows both the original evidence and
the lifecycle readiness draft. The existing LSP milestone checks now prove both
surfaces in one service run instead of adding a separate readiness shell.

## Boundaries

The lifecycle draft explicitly blocks:

```text
server binary version check
LSP server process start
lifecycle task creation
approval creation
lifecycle state persistence
source file content reads into LSP
textDocument/didOpen notification
definition / references / hover JSON-RPC requests
provider calls and network egress
```

## Evidence

Runtime builder:

```text
services/openclaw-core/src/native-engineering-lsp-evidence-builders.mjs
```

Route wiring:

```text
services/openclaw-core/src/native-adapter-plugin-routes.mjs
```

Observer visibility:

```text
apps/observer-ui/src/observer-panels-operations.mjs
apps/observer-ui/src/client-script-refreshers-workspace-source.mjs
apps/observer-ui/src/client-script-renderers-engineering-lsp.mjs
```

Validation target:

```text
services/openclaw-core/test/native-engineering-lsp-evidence-builders.test.mjs
services/openclaw-core/test/native-adapter-plugin-routes.test.mjs
openclaw-native-engineering-lsp-evidence
observer-openclaw-native-engineering-lsp-evidence
```

## Deferred

The following remain deliberately deferred:

```text
actual user-space language server process supervision
server binary/version checks
approval-gated lifecycle task creation
lifecycle state persistence and recovery readback
file open notifications and JSON-RPC symbol requests
automatic installation or provider/network access
```

## Follow-Up Status

The governed lifecycle pilot follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SUPERVISED_LIFECYCLE_PILOT_PLAN.md
```

That slice adds:

```text
POST /plugins/native-adapter/engineering-lsp/lifecycle-tasks
task registry: openclaw-native-engineering-lsp-lifecycle-task-v0
execution registry: openclaw-native-engineering-lsp-lifecycle-execution-v0
mode: approval-gated-lsp-lifecycle-binary-gate
```

It creates an approval-gated lifecycle task, blocks operator execution before
approval, records an approved binary gate after approval, starts and terminates
a bounded user-space process supervision probe when a mapped server binary
exists, records read-only lifecycle state for start/stop/restart/recovery
outcomes, records initialize/shutdown-only handshake evidence, exposes task
readback/recovery evidence, and keeps source-content transfer,
`textDocument/didOpen`, definition/references/hover requests, mutation,
provider calls, and network egress deferred.

## Next Slice

Do not add another standalone LSP evidence/readiness shell. The next meaningful
LSP step completed the governed initialize/shutdown handshake in the same
lifecycle lane. The next step should propose and display the exact
source-transfer boundary before any `textDocument/didOpen` or symbol request.

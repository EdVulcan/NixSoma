# OpenClaw Native Engineering LSP Evidence Plan

Updated: 2026-07-09

## Active Slice

Native governed LSP availability and contract evidence for enhanced-source
`cc_lsp`.

This slice migrates the useful LSP contract shape into OpenClaw-native
workspace evidence. It does not start language servers, check server binaries,
open files in an LSP connection, send JSON-RPC requests, or import the enhanced
source implementation.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint

```text
GET /plugins/native-adapter/engineering-lsp/evidence

registry: openclaw-native-engineering-lsp-evidence-v0
mode: lsp-contract-and-availability-evidence-only
```

Capability mapping:

```text
cc_lsp -> sense.openclaw.engineering_tool.lsp_evidence
```

## Implemented Behavior

The native builder:

```text
maps check / definition / references / hover action contracts
scans bounded workspace metadata for TypeScript, JavaScript, and Python files
reports relevant config file presence without reading config bodies
reports server binary names, args, and install hints without executing checks
validates requested file position for future definition/references/hover calls
reports Observer-visible governance and deferred lifecycle boundaries
```

The endpoint is evidence-only. It returns response-embedded audit evidence and
does not persist a new record.

## Deferred

The following remain deferred:

```text
server binary version check
LSP server process startup
file content read into LSP
textDocument/didOpen notification
definition / references / hover JSON-RPC request
language server pool lifecycle
task creation
approval creation
provider calls, network egress, result envelopes
```

Future LSP execution should be a governed workspace lifecycle action with
workspace scope, server lifecycle state, failure evidence, Observer recovery
visibility, and explicit boundaries before any long-lived process starts.

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
apps/observer-ui/src/client-script-renderers-engineering-lsp.mjs
```

Validation target:

```text
services/openclaw-core/test/native-engineering-lsp-evidence-builders.test.mjs
services/openclaw-core/test/native-adapter-plugin-routes.test.mjs
openclaw-native-engineering-lsp-evidence
observer-openclaw-native-engineering-lsp-evidence
```

## Follow-Up Status

The recommended source write proposal follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_WRITE_PROPOSAL_PLAN.md
```

That slice migrates `cc_write` as redacted create/overwrite proposal evidence.
It still does not write files directly; approval-gated workspace text write
remains the authoritative mutation path.

The LSP lifecycle readiness follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_LIFECYCLE_READINESS_DRAFT_PLAN.md
```

That slice adds:

```text
GET /plugins/native-adapter/engineering-lsp/lifecycle-draft
registry: openclaw-native-engineering-lsp-lifecycle-draft-v0
mode: lsp-lifecycle-readiness-draft-only
```

It drafts a governed workspace-scoped language-server lifecycle action and
readiness gate list while still blocking binary checks, process start, task
creation, approval creation, lifecycle state persistence, source-file content
reads, JSON-RPC, provider calls, and network egress.

The LSP supervised lifecycle pilot follow-up was completed as:

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

It creates an approval-gated task, proves pre-approval blocking and approved
binary-gate execution, records task readback/recovery evidence, and exposes the
workflow in Observer while still blocking process start, source-content reads,
JSON-RPC, mutation, provider calls, and network egress.

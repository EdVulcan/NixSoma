# OpenClaw Native Engineering LSP Source Transfer Task Plan

Updated: 2026-07-10

## Active Slice

Approval-gated LSP `didOpen` source-transfer task.

This slice closes the loop after the read-only source-transfer proposal. It
creates an approval-gated LSP task from an inspected workspace source file,
blocks execution before approval, re-reads and hash-checks the file after
approval, sends only `initialize`, `textDocument/didOpen`, `shutdown`, and
`exit` to a bounded short-lived user-space language-server process, and records
task/lifecycle state evidence.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint And Registries

```text
POST /plugins/native-adapter/engineering-lsp/lifecycle-tasks
GET /plugins/native-adapter/engineering-lsp/lifecycle-state

lifecycleAction: source_transfer
task registry: openclaw-native-engineering-lsp-lifecycle-task-v0
execution registry: openclaw-native-engineering-lsp-lifecycle-execution-v0
state registry: openclaw-native-engineering-lsp-lifecycle-state-v0
proposal registry: openclaw-native-engineering-lsp-source-transfer-proposal-v0
```

Capability mapping:

```text
plan.openclaw.engineering_tool.lsp_source_transfer
act.openclaw.engineering_tool.lsp_source_transfer_task
sense.openclaw.engineering_tool.lsp_lifecycle_state
```

## Implemented Behavior

The `source_transfer` task:

```text
requires confirm=true task creation
requires explicit approval before execution
stores proposal metadata, hash, and preview state without storing full source text in task metadata
checks the mapped language-server binary only after approval
re-reads the bounded workspace file after approval
verifies the approved proposal hash still matches the file content
starts a short-lived user-space language-server process in the bounded workspace
sends initialize, textDocument/didOpen, shutdown, and exit only
records didOpen/source-transfer evidence in task readback and lifecycle state
keeps symbol requests and long-lived process pools disabled
```

## Boundaries

This slice still blocks:

```text
definition / references / hover JSON-RPC requests
long-lived language-server process pools
automatic approval and automatic operator step
package installation and PATH mutation
provider calls, network egress, root/system daemon work
workspace mutation
```

It intentionally changes the previous boundary:

```text
source content may enter an approved short-lived language-server process through didOpen only
```

## Evidence

Runtime:

```text
services/openclaw-core/src/native-engineering-lsp-lifecycle-tasks.mjs
services/openclaw-core/src/native-engineering-lsp-protocol-handshake.mjs
services/openclaw-core/src/native-engineering-lsp-lifecycle-state.mjs
services/openclaw-core/src/workspace-native-ops-routes.mjs
apps/observer-ui/src/client-script-runtime-engineering-loop-controls.mjs
```

Validation targets:

```text
services/openclaw-core/test/task-executor.test.mjs
services/openclaw-core/test/workspace-native-ops-routes.test.mjs
openclaw-native-engineering-lsp-evidence
observer-openclaw-native-engineering-lsp-evidence
```

## Follow-up Completed

The next proposal boundary was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SYMBOL_REQUEST_PROPOSAL_PLAN.md
```

It drafts definition/references/hover JSON-RPC metadata over approved didOpen
state without sending an operational symbol request.

## Later Follow-up Completed

The symbol request task follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SYMBOL_REQUEST_TASK_PLAN.md
```

It sends exactly one approved definition/references/hover request through a
bounded short-lived LSP process after rebuilding approved didOpen setup and
continues to defer long-lived process pools, provider egress, package
installation, root/system daemon work, and automatic retries.

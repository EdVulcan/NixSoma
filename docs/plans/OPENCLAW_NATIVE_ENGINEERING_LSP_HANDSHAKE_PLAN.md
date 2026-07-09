# OpenClaw Native Engineering LSP Handshake Plan

Updated: 2026-07-10

## Active Slice

Native governed LSP initialize/shutdown handshake evidence.

This slice extends the existing approval-gated LSP lifecycle lane with a
short-lived JSON-RPC handshake probe. It sends only `initialize`, `shutdown`,
and `exit` to an approved workspace-scoped language-server process, records
bounded transcript metadata, and persists the result through lifecycle state.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint And Registries

```text
POST /plugins/native-adapter/engineering-lsp/lifecycle-tasks
GET /plugins/native-adapter/engineering-lsp/lifecycle-state

action: handshake
task registry: openclaw-native-engineering-lsp-lifecycle-task-v0
execution registry: openclaw-native-engineering-lsp-lifecycle-execution-v0
state registry: openclaw-native-engineering-lsp-lifecycle-state-v0
```

Capability mapping:

```text
cc_lsp initialize/shutdown -> act.openclaw.engineering_tool.lsp_lifecycle_task
cc_lsp handshake state -> sense.openclaw.engineering_tool.lsp_lifecycle_state
```

## Implemented Behavior

The handshake task:

```text
requires confirm=true task creation
requires explicit approval before execution
checks the mapped server binary only after approval
starts a short-lived user-space process in the bounded workspace
sends only initialize, shutdown, and exit JSON-RPC messages
records whether initialize and shutdown responses were observed
stores bounded stdout/stderr metadata and lifecycle-state readback
keeps long-lived process active=false
```

## Boundaries

The slice still explicitly blocks:

```text
textDocument/didOpen
source-content transfer into a language server
definition / references / hover LSP requests
long-lived language server process pools
automatic install or PATH mutation
automatic approval, automatic operator step, and automatic recovery execution
root/system daemon/polkit work
provider calls and network egress
```

## Evidence

Runtime:

```text
services/openclaw-core/src/native-engineering-lsp-protocol-handshake.mjs
services/openclaw-core/src/native-engineering-lsp-lifecycle-tasks.mjs
services/openclaw-core/src/native-engineering-lsp-lifecycle-state.mjs
```

Validation targets:

```text
services/openclaw-core/test/task-executor.test.mjs
openclaw-native-engineering-lsp-evidence
observer-openclaw-native-engineering-lsp-evidence
```

The existing LSP evidence milestone now proves static LSP evidence, lifecycle
draft, approval-gated task creation, missing-binary recovery, start/restart
process probes, explicit stop readback, lifecycle state, initialize/shutdown
handshake evidence, and continued blocking of source-content transfer and
operational LSP requests.

## Follow-up Completed

The next meaningful LSP step was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_SOURCE_TRANSFER_PROPOSAL_PLAN.md
```

That follow-up drafts and displays the bounded source file, hash, preview, and
future `textDocument/didOpen` metadata before any source content enters a
language-server process.

## Next Slice

Do not jump to full definition/references/hover. The next meaningful LSP step
is:

```text
approval-gated LSP didOpen source-transfer task
```

That follow-up should create an inspected task from the proposal, require
explicit approval, send only initialize plus `textDocument/didOpen` to a bounded
short-lived process, record source-transfer state, and keep symbol requests,
long-lived process pools, provider egress, and root/system daemon work
deferred.

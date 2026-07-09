# OpenClaw Native Engineering LSP Lifecycle State Plan

Updated: 2026-07-09

## Active Slice

Native governed LSP lifecycle state readback.

This slice extends the existing `cc_lsp` lifecycle lane with a persistent
OpenClaw state record for approved lifecycle tasks. It does not create a
long-lived language-server pool. Instead, it records approved start/restart
process probes, explicit stop actions, recovery-required failures, bounded
stdout/stderr summaries, and Observer-visible state transitions.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint And Registries

```text
GET /plugins/native-adapter/engineering-lsp/lifecycle-state

state registry: openclaw-native-engineering-lsp-lifecycle-state-v0
task registry: openclaw-native-engineering-lsp-lifecycle-task-v0
execution registry: openclaw-native-engineering-lsp-lifecycle-execution-v0
mode: read-only-lsp-lifecycle-state-readback
```

Capability mapping:

```text
cc_lsp lifecycle state -> sense.openclaw.engineering_tool.lsp_lifecycle_state
```

## Implemented Behavior

The state readback:

```text
persists one record per workspace/language lifecycle key
records approved start and restart process probes
records explicit stop actions without requiring a server binary
records missing-binary and process-start recovery states
stores bounded stdout/stderr previews and byte/truncation metadata
records initialize/shutdown-only handshake status when the approved handshake
action runs
keeps long-lived process active=false after every current action
keeps operational JSON-RPC requests, source-content transfer, provider egress,
and root/hostd false
exposes read-only lifecycle-state filters by workspacePath, language, and limit
adds Observer lifecycle-state status readback for LSP tasks
```

## Boundaries

The slice still explicitly blocks:

```text
long-lived language server process pool
textDocument/didOpen and symbol JSON-RPC requests
source-content transfer into a language server
definition / references / hover LSP responses
automatic install or PATH mutation
automatic approval, automatic operator step, and automatic recovery execution
root/system daemon/polkit work
provider calls and network egress
```

## Evidence

Runtime:

```text
services/openclaw-core/src/native-engineering-lsp-lifecycle-state.mjs
services/openclaw-core/src/native-engineering-lsp-lifecycle-tasks.mjs
services/openclaw-core/src/runtime-state.mjs
```

Route and adapter visibility:

```text
services/openclaw-core/src/native-adapter-plugin-routes.mjs
services/openclaw-core/src/plugin-review.mjs
apps/observer-ui/src/client-script-runtime-engineering-loop-controls.mjs
```

Validation targets:

```text
services/openclaw-core/test/task-executor.test.mjs
services/openclaw-core/test/native-adapter-plugin-routes.test.mjs
openclaw-native-engineering-lsp-evidence
observer-openclaw-native-engineering-lsp-evidence
```

The existing LSP evidence milestones now prove static LSP evidence, lifecycle
draft, approval-gated task creation, missing-binary recovery, bounded start
probe, explicit stop readback, restart readback, persisted lifecycle state,
Observer lifecycle-state tokens, initialize/shutdown-only handshake evidence,
and the continued absence of source-content transfer and operational LSP
requests.

## Next Slice

The governed initialize/shutdown handshake follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_HANDSHAKE_PLAN.md
```

That slice sends only bounded protocol initialization and shutdown messages to
an approved short-lived server process. The next step should not jump straight
to definition/references/hover; it should first propose and display the exact
source-transfer boundary for `textDocument/didOpen`.

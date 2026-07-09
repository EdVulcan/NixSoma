# OpenClaw Native Engineering LSP Symbol Request Task Plan

Updated: 2026-07-10

## Active Slice

Approval-gated LSP symbol request task.

This slice follows the read-only symbol request proposal. It creates a task from
approved `textDocument/didOpen` state, blocks execution before explicit
approval, rebuilds the short-lived LSP setup after approval, sends exactly one
selected `textDocument/definition`, `textDocument/references`, or
`textDocument/hover` request, and records bounded task/lifecycle-state evidence.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint And Registries

```text
POST /plugins/native-adapter/engineering-lsp/lifecycle-tasks
GET /plugins/native-adapter/engineering-lsp/lifecycle-state

lifecycleAction: symbol_request
task registry: openclaw-native-engineering-lsp-lifecycle-task-v0
execution registry: openclaw-native-engineering-lsp-lifecycle-execution-v0
state registry: openclaw-native-engineering-lsp-lifecycle-state-v0
proposal registry: openclaw-native-engineering-lsp-symbol-request-proposal-v0
```

Capability mapping:

```text
plan.openclaw.engineering_tool.lsp_symbol_request
act.openclaw.engineering_tool.lsp_symbol_request_task
sense.openclaw.engineering_tool.lsp_lifecycle_state
```

## Implemented Behavior

The `symbol_request` task:

```text
requires confirm=true task creation
requires an approved didOpen source-transfer lifecycle state
requires explicit approval before execution
keeps proposal request metadata in task readback with sent=false until approval
checks the mapped language-server binary only after approval
re-reads and hash-checks the bounded source file after approval
starts a short-lived user-space language-server process in the bounded workspace
sends initialize, textDocument/didOpen, exactly one selected symbol request, shutdown, and exit
records symbol request method/id/response-observed metadata
records lifecycle state with jsonRpcOperationalRequestsEnabled=true
keeps long-lived process pools disabled
does not store or return the source file body in execution evidence
```

## Boundaries

This slice still blocks:

```text
long-lived language-server process pools
automatic retries and automatic recovery execution
package installation and PATH mutation
provider calls, network egress, root/system daemon work
workspace mutation
unapproved symbol requests
```

It intentionally changes the previous boundary:

```text
after approval, exactly one definition/references/hover request may be sent to a short-lived user-space LSP process
```

## Evidence

Runtime:

```text
services/openclaw-core/src/native-engineering-lsp-lifecycle-tasks.mjs
services/openclaw-core/src/native-engineering-lsp-protocol-handshake.mjs
services/openclaw-core/src/native-engineering-lsp-lifecycle-state.mjs
services/openclaw-core/src/workspace-native-ops-routes.mjs
```

Validation targets:

```text
services/openclaw-core/test/task-executor.test.mjs
services/openclaw-core/test/workspace-native-ops-routes.test.mjs
openclaw-native-engineering-lsp-evidence
observer-openclaw-native-engineering-lsp-evidence
```

## Deferred

The LSP lane still does not provide:

```text
long-lived connection reuse
workspace-wide open-file synchronization
language-server installation or dependency management
multi-request symbol navigation sessions
bounded parsed symbol response summary
Level 2 trusted session/work-view integration
Level 3 hostd/system daemon integration
```

## Follow-up Completed

The Observer control follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_OBSERVER_SYMBOL_REQUEST_CONTROL_PLAN.md
```

It lets the operator create the existing approval-gated symbol request task from
the LSP panel and inspect task/approval/completion readback without adding
another standalone evidence milestone.

## Next Slice

The next smallest real capability is:

```text
bounded LSP symbol response summary
```

That follow-up should expose bounded definition/references/hover result metadata
from the approved single-request execution without returning raw source bodies
or starting long-lived language-server pools.

# OpenClaw Native Engineering LSP Supervised Lifecycle Pilot Plan

Updated: 2026-07-09

## Active Slice

Native governed LSP supervised lifecycle pilot, implemented as an
approval-gated lifecycle task, binary gate, and short supervised process probe.

This slice moves `cc_lsp` migration beyond read-only evidence and draft-only
readiness. It creates a real OpenClaw task, requires operator approval, runs one
bounded lifecycle gate after approval, starts and supervises a user-space process
probe when the mapped server binary exists, records task outcome/readback, and
makes the recovery recommendation visible to Observer.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint And Registries

```text
POST /plugins/native-adapter/engineering-lsp/lifecycle-tasks

task registry: openclaw-native-engineering-lsp-lifecycle-task-v0
execution registry: openclaw-native-engineering-lsp-lifecycle-execution-v0
mode: approval-gated-lsp-lifecycle-binary-gate
```

Capability mapping:

```text
cc_lsp lifecycle -> act.openclaw.engineering_tool.lsp_lifecycle_task
```

## Implemented Behavior

The native lifecycle task bridge:

```text
reuses the existing bounded lifecycle draft builder
creates a native task and approval request only when confirm=true
blocks operator execution before approval with policy_requires_approval
after approval, checks only whether the mapped server binary is executable in PATH
records binary gate execution evidence on the task
fails with recoverable lsp_lifecycle_recovery evidence when the binary is absent
when the binary is present for start/restart/recover, starts a short user-space
process supervision probe
captures bounded stdout/stderr metadata, records pid/exit/signal/readback, and
terminates the probe process
exposes readback through /tasks/:id and the Observer engineering loop state
```

Observer reuses the existing Engineering LSP panel and Engineering Loop state
controls. It can create the lifecycle task, guide the operator to approve and
step manually, and refresh completion readback from the task record.

## Boundaries

The pilot still explicitly blocks:

```text
long-lived server process persistence
long-lived lifecycle state persistence and process reuse
source file content reads into LSP
textDocument/didOpen notification
definition / references / hover JSON-RPC requests
workspace mutation
provider calls and network egress
automatic approval, automatic operator step, and automatic recovery execution
```

The binary gate and process probe are intentionally not package installers. If `pylsp` or
`typescript-language-server` is missing from the OpenClaw service PATH, the task
records recoverable evidence and a recommendation instead of mutating the host.
If a server binary exists, the probe is bounded and torn down before JSON-RPC or
source-content transfer.

## Evidence

Runtime task builders:

```text
services/openclaw-core/src/native-engineering-lsp-lifecycle-tasks.mjs
```

Route wiring:

```text
services/openclaw-core/src/workspace-native-ops-routes.mjs
services/openclaw-core/src/workspace-ops.mjs
services/openclaw-core/src/task-executor.mjs
```

Observer visibility:

```text
apps/observer-ui/src/observer-panels-operations.mjs
apps/observer-ui/src/client-script-runtime-engineering-loop-controls.mjs
apps/observer-ui/src/client-script-runtime-bindings.mjs
apps/observer-ui/src/client-script-config-dom-workspace-source.mjs
```

Validation targets:

```text
services/openclaw-core/test/workspace-native-ops-routes.test.mjs
services/openclaw-core/test/task-executor.test.mjs
openclaw-native-engineering-lsp-evidence
observer-openclaw-native-engineering-lsp-evidence
```

The existing LSP evidence milestones now prove evidence, lifecycle draft,
approval-gated task creation, pre-approval block, approval transition, missing
binary recovery, supervised process probe with controlled termination, task
readback, audit events, and Observer-visible controls in one cohesive lane.

## Deferred

The following remain deliberately deferred:

```text
long-lived language server process pool
server lifecycle state store and reusable stop/restart process management
bounded initialize/didOpen/definition/references/hover JSON-RPC
source-content transfer into a language server
automatic install or PATH mutation
automatic recovery task creation
```

## Next Slice

Do not add another standalone LSP evidence/readiness shell. The next meaningful
LSP step is to extend this same lifecycle lane with a persistent lifecycle state
store and explicit stop/restart readback. Keep JSON-RPC disabled until process
ownership, bounded IO, stale-process recovery, and Observer recovery controls
are proven against that state store.

# OpenClaw Native Engineering Plan/Todo Evidence Plan

Updated: 2026-07-09

## Active Slice

Planning/todo evidence surface for the enhanced-source `cc_plan_enter`,
`cc_plan_exit`, and `cc_todo_write` semantics.

This slice migrates the useful planning discipline into OpenClaw-native
task/workbench evidence. It does not create a hidden agent mode, does not write
`.openclaw/cc-todo.md`, and does not mutate task state.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint

```text
GET /plugins/native-adapter/engineering-plan-todo/evidence

registry: openclaw-native-engineering-plan-todo-evidence-v0
mode: planning-todo-evidence-only
```

Capability mapping:

```text
cc_plan_enter / cc_plan_exit / cc_todo_write
-> sense.openclaw.engineering_context.plan_todo_evidence
```

## Implemented Behavior

The native builder:

```text
maps cc_plan_enter, cc_plan_exit, and cc_todo_write into native contract metadata
reads visible task/workbench plan steps as todo evidence
accepts bounded query todo fixtures for checkable contract evidence
reports pending / in_progress / done counts
links evidence to selected or current task plan state
reports audit evidence and Observer-visible governance boundaries
```

The endpoint is read-only. It returns response-embedded audit evidence and
does not persist a new record.

## Deferred

The following remain deferred:

```text
hidden planning-mode switch
execution transition from plan_exit
.openclaw/cc-todo.md file creation or update
task/workbench state mutation
planning task creation
approval creation
verification command execution
provider calls, network egress, result envelopes
```

Future todo persistence should use governed workbench storage with policy,
audit, Observer readback, and recovery evidence. It should not silently write the
enhanced-source `.openclaw/cc-todo.md` file.

## Evidence

Runtime builder:

```text
services/openclaw-core/src/native-engineering-plan-todo-evidence-builders.mjs
```

Route wiring:

```text
services/openclaw-core/src/observer-read-model-routes.mjs
```

Observer visibility:

```text
apps/observer-ui/src/observer-panels-operations.mjs
apps/observer-ui/src/client-script-renderers-engineering-plan-todo.mjs
```

Validation target:

```text
services/openclaw-core/test/native-engineering-plan-todo-evidence-builders.test.mjs
services/openclaw-core/test/route-handlers.test.mjs
openclaw-native-engineering-plan-todo-evidence
observer-openclaw-native-engineering-plan-todo-evidence
```

## Follow-Up Status

The recommended LSP follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_EVIDENCE_PLAN.md
```

That slice migrated `cc_lsp` only as governed availability and contract
evidence. It still does not start language servers, check server binaries,
open source files in LSP, or send JSON-RPC.

The next recommended real capability is native governed source write proposal
evidence for `cc_write`, as a create/overwrite proposal with diff/metadata
preview only.

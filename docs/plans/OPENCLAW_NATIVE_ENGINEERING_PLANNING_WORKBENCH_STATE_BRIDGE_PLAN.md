# OpenClaw Native Engineering Planning Workbench State Bridge Plan

Updated: 2026-07-09

## Active Slice

Native governed engineering planning workbench state bridge.

This slice turns existing plan/todo evidence into an operator-visible
Engineering Loop State. It advances the enhanced-source `cc_plan_enter`,
`cc_plan_exit`, and `cc_todo_write` migration beyond a standalone evidence
panel without adding hidden planning modes, todo-file writes, or task mutation.

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

The Observer now exposes:

```text
engineering-plan-todo-workbench
engineering-plan-todo-bridge-button
engineering-plan-todo-workbench-json
```

The bridge reads:

```text
GET /plugins/native-adapter/engineering-plan-todo/evidence?taskId=:taskId
```

It maps the selected engineering task plan into:

```text
registry: openclaw-native-engineering-planning-workbench-state-v0
mode: operator-visible-planning-workbench-state
task id and status
planner/strategy
todo source
done / in-progress / pending counts
current todo hint
governance boundaries
```

The Engineering Loop State panel can now show `planning-workbench` as a loop
kind, with the selected task id, evidence route, todo counts, and the current
visible todo hint.

## Boundaries

This slice does not:

```text
switch hidden planning modes
write .openclaw/cc-todo.md
mutate task state
create tasks or approvals
execute commands
call providers or perform network egress
read credentials
create result envelopes
```

## Evidence

Observer implementation:

```text
apps/observer-ui/src/observer-panels-operations.mjs
apps/observer-ui/src/client-script-config-dom.mjs
apps/observer-ui/src/client-script-renderers-engineering-plan-todo.mjs
apps/observer-ui/src/client-script-runtime-engineering-loop-controls.mjs
apps/observer-ui/src/client-script-runtime-bindings.mjs
```

Validation target:

```text
openclaw-native-engineering-loop-operator-controls
```

The targeted milestone now proves:

```text
Observer exposes planning workbench bridge controls
client script contains the workbench state builder and bridge function
an actual approval-gated engineering edit task has readable plan/todo evidence
the selected task remains queued before approval
plan steps become visible todo counts
hidden planning mode, todo-file write, task mutation, command execution, and provider call remain blocked
```

## Deferred

The following remain deferred:

```text
persisted governed todo/workbench storage
task state mutation from plan/todo controls
plan_exit execution transition
automatic approval or operator execution
state restoration after Observer reload from core task/approval history
provider calls, network egress, result envelopes
raw credential reads
```

## Next Slice

The workbench state restoration follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_WORKBENCH_STATE_RESTORATION_PLAN.md
```

It rebuilds the latest engineering loop state from core task history after
Observer reload without relying only on browser-local state and without creating
new execution paths.

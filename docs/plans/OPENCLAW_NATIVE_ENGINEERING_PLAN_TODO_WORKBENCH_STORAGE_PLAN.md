# OpenClaw Native Engineering Plan/Todo Workbench Storage Plan

Updated: 2026-07-10

## Active Slice

Native governed engineering plan/todo workbench storage and suggested-action
task/readback linkage.

This slice moves the `cc_plan_enter`, `cc_plan_exit`, and `cc_todo_write`
migration beyond read-only evidence by giving OpenClaw a small, explicit,
core-state-backed workbench record for visible planning and todo state.

Identity alignment: Level 1, stable user-space control plane.

## Real Capability

The core now exposes:

```text
GET /plugins/native-adapter/engineering-plan-todo/workbench-state
POST /plugins/native-adapter/engineering-plan-todo/workbench-state

registry: openclaw-native-engineering-plan-todo-workbench-storage-v0
capability: act.openclaw.engineering_context.plan_todo_workbench_state
```

`POST` requires:

```text
confirm: true
existing taskId
bounded plan summary / confirmed plan
bounded todo list
```

The route stores one revisioned workbench record per task in OpenClaw core
state. The plan/todo evidence endpoint now reads this storage and reports
`todoSource: workbench_storage` when a stored record exists and no explicit
query todo fixture overrides it.

Observer adds:

```text
engineering-plan-todo-save-button
Save Workbench State
engineering-plan-todo-use-suggestion-button
Use Suggested Action
```

The button saves the currently visible planning workbench state and refreshes
the existing Engineering Loop State and Plan/Todo Evidence panels.

The same readback now derives a guidance-only next action suggestion:

```text
registry: openclaw-native-engineering-plan-todo-next-action-v0
mode: operator-guidance-only
```

The suggestion selects the current visible todo, classifies it into an existing
governed Observer control when possible, and records the recommended control
and capability id. It is not an endpoint and does not create tasks, approvals,
commands, workspace mutations, provider calls, or result envelopes.

Observer can now explicitly use the suggestion through a local whitelist:

```text
review_current_todo -> engineering-plan-todo-bridge-button
save_workbench_state -> engineering-plan-todo-save-button
create_edit_proposal_task -> engineering-edit-proposal-task-button
create_write_proposal_task -> engineering-write-proposal-task-button
create_verification_task -> engineering-verification-task-button
```

The UI dispatches only to those existing controls after the suggested control id
matches the expected whitelist entry. It does not execute arbitrary endpoints,
command text, provider payloads, or file paths from a suggestion object.

When the explicit action creates an edit, write, or verification task, the core
now recomputes the suggestion from the persisted workbench record and attaches:

```text
registry: openclaw-native-engineering-plan-todo-suggestion-link-v0
source task id and status
workbench record id and revision
current todo id and status
suggested action and capability id
expected whitelisted Observer control id
source evidence route
```

The link is visible in task readback, Engineering Loop State, restoration, and
completion readback. It excludes todo descriptions, workspace content, edit or
write payloads, commands, provider payloads, credential material, and arbitrary
endpoint strings. Recovered verification tasks retain the same compact source
link.

## Boundaries

This slice does not:

```text
switch hidden planning modes
write .openclaw/cc-todo.md
mutate task status or task plan steps
automatically create tasks or approvals without the explicit suggested-action click
execute verification commands
call providers or perform network egress
create result envelopes
execute arbitrary endpoints or command payloads returned by suggestion readback
```

The stored record is an OpenClaw core-state workbench record, not a direct copy
of the enhanced-source `.openclaw/cc-todo.md` persistence model.

## Evidence

Runtime storage:

```text
services/openclaw-core/src/native-engineering-plan-todo-workbench-storage.mjs
services/openclaw-core/src/native-engineering-plan-todo-workbench-routes.mjs
services/openclaw-core/src/native-engineering-plan-todo-next-action.mjs
services/openclaw-core/src/native-engineering-plan-todo-suggestion-link.mjs
services/openclaw-core/src/runtime-state.mjs
services/openclaw-core/src/task-manager.mjs
services/openclaw-core/src/task-recovery.mjs
```

Evidence integration:

```text
services/openclaw-core/src/native-engineering-plan-todo-evidence-builders.mjs
services/openclaw-core/src/observer-read-model-routes.mjs
```

Observer:

```text
apps/observer-ui/src/observer-panels-operations.mjs
apps/observer-ui/src/client-script-runtime-engineering-loop-controls.mjs
apps/observer-ui/src/client-script-runtime-engineering-suggested-action.mjs
```

Validation targets:

```text
services/openclaw-core/test/native-engineering-plan-todo-evidence-builders.test.mjs
services/openclaw-core/test/native-engineering-plan-todo-suggestion-link.test.mjs
services/openclaw-core/test/route-handlers.test.mjs
openclaw-native-engineering-plan-todo-evidence
observer-openclaw-native-engineering-plan-todo-evidence
```

## Deferred

The following remain deferred:

```text
hidden planning mode semantics
plan_exit execution transition
todo-file persistence to .openclaw/cc-todo.md
task-state mutation from todo controls
automatic approval or operator execution
provider calls, network egress, result envelopes
```

## Next Slice

The Level 1 engineering continuity loop is now complete enough to stop
horizontal evidence expansion:

```text
stored suggestion -> governed task -> approval/operator path -> linked readback
```

The next autonomous slice should advance the Level 2 trusted AI work-view and
session-helper boundary through an existing work-view owner. Do not add another
plan/todo evidence endpoint or milestone. Actual helper process start, root,
desktop-wide capture, provider egress, and arbitrary recommendation execution
remain deferred.

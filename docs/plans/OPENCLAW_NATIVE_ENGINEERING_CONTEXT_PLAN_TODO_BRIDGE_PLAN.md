# OpenClaw Native Engineering Context Plan/Todo Bridge Plan

Updated: 2026-07-14

## Active Slice

Explicit plan/todo workbench context in the existing local Engineering Context
Packet.

Identity alignment: Level 1, stable user-space control plane.

## Demonstrated Gap

The existing packet carried bounded task and command evidence, verification,
recovery, and optional trusted work-view metadata. It did not carry the
operator's existing visible plan/todo state, so a local context consumer had to
reconstruct the current engineering intent from command history alone.

## Implemented Behavior

The existing packet request may add:

```json
{ "includePlanTodo": true }
```

Core reuses `buildNativeEngineeringPlanTodoEvidence` and adds one protected
`engineering_plan_todo_evidence` message containing only its bounded summary,
task-plan evidence, workbench persistence metadata, and existing guidance-only
next-action suggestion. Observer requests this context explicitly with the
existing packet action.

The microcompact projection treats this evidence as protected, so plan/todo
state is not silently elided when older tool results are compacted.

## Governance

```text
explicit packet request only
existing task/workbench read models only
no hidden planning mode
no .openclaw/cc-todo.md write
no task mutation or plan transition
no automatic task/approval creation
no command execution, provider call, or network egress
```

The suggestion remains guidance-only and resolves to the existing Observer
control allowlist; the packet never executes it.

## Evidence

Runtime:

```text
services/openclaw-core/src/native-engineering-context-routes.mjs
services/openclaw-core/src/native-engineering-context-packet.mjs
services/openclaw-core/src/native-engineering-microcompact-projection.mjs
services/openclaw-core/src/native-engineering-plan-todo-evidence-builders.mjs
```

Observer and validation continue through the existing context packet panel and
pair milestone:

```text
apps/observer-ui/src/client-script-refreshers-engineering-context.mjs
services/openclaw-core/test/native-engineering-context-packet.test.mjs
services/openclaw-core/test/native-engineering-context-routes.test.mjs
openclaw-native-engineering-context-packet-pair-batch-reuse
```

## Deferred

```text
automatic use of the suggestion
hidden planning-mode transitions
todo-file persistence
automatic task/approval/execution creation
provider egress and result envelopes
```

## Next Smallest Capability

Keep plan/todo context as protected readback until a concrete operator gap
requires linking it to an existing governed control. Do not create a second
planning endpoint or an automatic plan-to-action bridge.

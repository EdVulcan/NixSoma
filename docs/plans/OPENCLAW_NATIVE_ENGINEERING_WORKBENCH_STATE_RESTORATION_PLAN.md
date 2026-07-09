# OpenClaw Native Engineering Workbench State Restoration Plan

Updated: 2026-07-09

## Active Slice

Native governed engineering workbench state restoration.

This slice lets the Observer rebuild the Engineering Loop State from core task
history after reload. It removes reliance on browser-local state for the latest
engineering loop task while keeping restoration read-only.

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

The Engineering Loop State panel now exposes:

```text
engineering-loop-restore-button
```

Clicking it reads:

```text
GET /tasks?limit=20
```

The client classifies the first restorable engineering task in public core task
history:

```text
recovered source-command task -> recovery state
source-command recovery link -> recovery state
engineering edit proposal task -> edit state
engineering write proposal task -> write state
source-command task -> verification state
task plan steps -> planning-workbench state
```

The restored state includes:

```text
loop kind
task id
source task id when applicable
approval id when present
task status
evidence route
verification rerun route when applicable
next operator step guidance
```

## Boundaries

Restoration is read-only. It does not:

```text
create tasks
create or resolve approvals
run operator step
execute commands
mutate files or task state
call providers or perform network egress
read credentials
create result envelopes
```

## Evidence

Observer implementation:

```text
apps/observer-ui/src/observer-panels-operations.mjs
apps/observer-ui/src/client-script-config-dom.mjs
apps/observer-ui/src/client-script-runtime-engineering-loop-controls.mjs
apps/observer-ui/src/client-script-runtime-bindings.mjs
```

Validation target:

```text
openclaw-native-engineering-loop-operator-controls
```

The targeted milestone now proves:

```text
Observer exposes the restore control
client script contains the restoration classifier and action
core task history exposes redacted edit metadata
failed source-command task exposes the recovery link
recovered task exposes source-command recovery state
restoration can classify a latest engineering loop state from /tasks history
```

## Deferred

The following remain deferred:

```text
automatic restoration on page load
server-side engineering loop restoration route
persisted browser-independent UI selection preferences
automatic approval or execution
provider calls, network egress, result envelopes
raw credential reads
```

## Next Slice

The Observer startup auto-restore follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_WORKBENCH_STATE_AUTO_RESTORE_PLAN.md
```

It calls the read-only restoration flow during Observer startup when no local
loop state exists, while keeping operator action creation explicit and
approval-gated.

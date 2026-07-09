# OpenClaw Native Engineering Loop Recovery Action Draft Plan

Updated: 2026-07-09

## Active Slice

Native governed engineering loop recovery action draft.

This slice turns failed native engineering verification recovery evidence into
an explicit Observer operator action. It does not create a second backend
recovery executor; it drafts and invokes the existing governed
`/tasks/:taskId/recover` route only after the operator confirms the action.

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

The Observer now exposes:

```text
engineering-recovery-action
engineering-recovery-draft-button
engineering-recovery-task-button
engineering-recovery-action-json
```

The client reads:

```text
GET /plugins/native-adapter/engineering-recovery/evidence
```

It selects the latest recoverable, not-yet-recovered native engineering failure
that includes the existing governed recovery recommendation:

```text
POST /tasks/:taskId/recover
```

The draft reports:

```text
source task id
failure kind
source recovery evidence registry
operator-confirmed recovery endpoint
task creation boundary
approval-before-rerun boundary
no automatic command execution or mutation boundary
```

Clicking `Create Recovery Task` calls the existing recovery endpoint and updates
the Engineering Loop State panel with the recovered task id, approval id when
present, next operator action, and recovery evidence readback route.

## Boundaries

This slice does not:

```text
auto-create recovery tasks during evidence refresh
auto-approve recovered tasks
auto-run operator step
retry commands without approval
mutate files from the Observer
call providers or perform network egress
read credentials
create result envelopes
add a new backend recovery wrapper
```

Actual recovery task creation remains the existing task recovery route plus the
existing approval-gated source-command task path.

## Evidence

Observer implementation:

```text
apps/observer-ui/src/observer-panels-operations.mjs
apps/observer-ui/src/client-script-config-dom.mjs
apps/observer-ui/src/client-script-renderers-engineering-recovery.mjs
apps/observer-ui/src/client-script-runtime-engineering-loop-controls.mjs
apps/observer-ui/src/client-script-runtime-bindings.mjs
```

Validation target:

```text
openclaw-native-engineering-loop-operator-controls
```

The targeted milestone now proves:

```text
Observer exposes recovery action draft controls
failed approval-gated source-command verification produces recovery evidence
the recovery evidence recommends the existing /tasks/:taskId/recover endpoint
the Observer client contains the action draft and explicit recovery task functions
explicit recovery task creation returns a queued recovered task
the recovered task preserves source-command metadata and recovery linkage
operator step remains blocked before approving the recovered task
recovery evidence readback marks the source task already recovered
```

## Deferred

The following remain deferred:

```text
automatic recovery task creation
automatic approval
automatic command rerun
automatic recovery completion after task creation
state restoration after Observer reload from core task/approval history
provider calls, network egress, result envelopes
raw credential reads
```

## Next Slice

The next highest-density capability slice is:

```text
Native governed engineering recovery rerun readback
```

That slice should approve and execute a recovered verification task through the
existing approval/operator path, then attach the rerun verification evidence and
recovery readback to the Observer loop state. It should not introduce a new
shell executor or auto-approval path.

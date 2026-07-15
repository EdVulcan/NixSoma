# OpenClaw Native Engineering Operator Execution Binding Plan

Updated: 2026-07-15

## Active Slice

Bind the existing governed browser-task operator path to the reviewed rule-v1
execution shape.

Identity alignment: Level 1, stable user-space control plane.

## Demonstrated Gap

The task planner stored a browser target and actions, but `/operator/step` and
`/operator/run` could accept a temporary target or action list at execution.
That allowed an operator request to approve or review one task shape and execute
another target or non-input action shape. The operator still had to act
explicitly, but the task and execution evidence did not describe the same
request.

## Implemented Behavior

Rule-v1 browser task creation now stores the compact
`openclaw-browser-task-execution-binding-v0` evidence:

```text
targetUrl
actionCount
actionShapeHash
transientInputKinds
inputTextBound: false
persisted: true
```

The hash covers the normalized target, action order, action kinds, and all
non-input parameters. It covers the complete planned action list, including
completed steps, so a plan cannot silently change after approval.

Before either operator route executes, core:

```text
re-derives the rule-v1 binding from the current task plan
rejects a missing or stale stored binding
rejects a changed target
rejects a changed action count, order, kind, or non-input parameter
allows only the pending plan actions to execute
```

`keyboard.type` and `browser.semantic_type` may receive a bounded transient
`text` value at the current execution boundary. The value is not included in
the binding hash, task binding, event evidence, or persisted outcome. No other
action parameter may vary.

An unplanned browser task or a browser task without the persisted binding fails
closed before work-view preparation and screen-act. No route, action kind,
approval family, provider call, or recovery loop was added.

## Evidence

Runtime:

```text
services/openclaw-core/src/browser-task-action-contract.mjs
services/openclaw-core/src/browser-task-execution-binding.mjs
services/openclaw-core/src/task-manager.mjs
services/openclaw-core/src/task-executor.mjs
```

Tests:

```text
services/openclaw-core/test/browser-task-execution-binding.test.mjs
services/openclaw-core/test/task-manager.test.mjs
services/openclaw-core/test/task-executor.test.mjs
```

Real operator evidence:

```text
nix/scripts/dev-operator-loop-check.sh
```

The check creates two planned browser tasks, asserts compact hashes and
`inputTextBound: false`, runs them through `/operator/step` and
`/operator/run`, restarts core, and verifies the binding evidence remains
available without the input text.

## Governance

```text
reviewed task plan and execution shape remain linked
transient write-only input is never persisted or hashed
missing or stale binding fails closed
screen-act is not reached after a binding mismatch
operator execution remains explicit
provider, root, desktop-wide capture, and arbitrary endpoint boundaries remain unchanged
```

## Deferred

```text
automatic operator execution
automatic action replay after restart
arbitrary browser actions or caller-supplied selectors
provider/model execution changes
root/system daemon ownership
desktop-wide capture
long-lived helper/LSP process pools
```

## Next Smallest Capability

After the existing operator route has this consistency proof, return to the
selected Level 2 trusted work-view/session-helper route. Do not add another
browser action variant or a provider/readiness wrapper unless a concrete
operator gap requires it.

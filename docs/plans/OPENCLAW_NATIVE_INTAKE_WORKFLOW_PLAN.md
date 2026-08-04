# NixSoma Fixed Native Intake Workflow Plan

Updated: 2026-08-04

## Capability

Advance Level 4 beyond the browser-only application boundary with one second
fixed native application and one complete task-bound workflow:

```text
explicit reviewed task
-> require nixsoma-ai-native-intake.service to be stopped
-> start that exact non-autostarting user unit through session-manager
-> bind its matching activated numeric surface and inventory sequence
-> reuse the existing objective-bound OCR Type owner once
-> require task/frame/surface/native receipt/post-OCR/audit evidence
-> stop the exact unit and clear its transient process state
-> terminate
```

The capability id is `act.ai.workspace.native_intake_workflow`; its result
registry is `nixsoma-ai-workspace-native-intake-workflow-v0`.

## Ownership

- `nixsoma-ai-native-intake.service` launches one fixed Weston terminal shell.
- The shell accepts only `[A-Za-z0-9 .,_-]`, stores at most 32 characters in
  process memory, renders the value transiently, executes no command, and has
  no network address family beyond `AF_UNIX`.
- Session Manager owns start/stop, surface/PID matching, execution-grant
  verification, and durable pre-action audit.
- Core owns the task-bound workflow, shared AI single-flight, lifecycle cleanup,
  provider/action budgets, exact started-surface binding, and terminal audit.
- The existing OCR Type owner remains the only keyboard actuator. Its new
  internal expected-surface guard cannot be supplied through the public OCR Type
  capability request.
- Observer exposes lifecycle status, manual fixed start/stop recovery, and one
  task-bound `Native Intake` command. It accepts no unit, process, text, surface,
  action, retry, or budget fields from the operator.

## Hard Bounds

- At most one provider call and one write-only keyboard type.
- At most two separately counted lifecycle actions: one start and one stop.
- No click, Enter, hotkey, modifier, retry, automatic repeat, or second provider
  decision.
- No arbitrary process/window selection, shell command, browser API, parent
  display, desktop-wide input, root action, host mutation, task mutation,
  approval creation, or automatic task completion.
- Input text is absent from workflow results, summaries, audits, tasks, events,
  Observer storage, and filesystem state.
- A start transport uncertainty still triggers one fixed stop attempt. Missing
  or invalid stop evidence is terminal and never causes the type action to
  repeat.

## Acceptance Evidence

- Session Manager tests cover shared lifecycle compatibility, exact native unit
  ownership, allowed lifecycle sources, execution-grant audit ordering, and
  cleanup.
- Core tests cover started-surface binding, OCR Type race rejection, one-call
  workflow completion, exact task-id rejection, unverified action termination,
  unknown cleanup, standing authorization, compact summaries, and production
  runtime assembly.
- Observer tests cover lifecycle projection, manual recovery routes, shared
  in-flight exclusion, strict result validation, and absence of caller text/unit
  controls or browser storage.
- Release evidence uses full workspace tests/typecheck, real Core and Observer
  capability gates, body-config, exact Nix source closures, registry/script
  audit, changed-check selection, and Windows path budget.
- Final source evidence is all `1427/1427` workspace tests, Core `980/980`,
  Observer `120/120`, Session Manager `85/85`, typecheck, both real capability
  gates, the 835-entry registry, 1023-file/1007-shell-script audit, zero Windows path
  violations, and exact `289/36/116`-file Core/Session Manager/Observer closures.

## Deferred

Physical generation activation and a live provider run are not part of this
source slice. The source mission-bound browser -> native composition is now
owned by `OPENCLAW_REVIEWED_MULTI_APPLICATION_MISSION_PLAN.md`; provider-authored
task supply, retry/skip policy, wider
Level 3 body actions, and physical Phase D mutation/rollback remain separate
explicitly governed routes.

## Stop Condition

This owner is frozen after its representative source, real-service, and closure
checks passed. Cross-application continuation belongs to the separate reviewed
multi-application mission owner; do not widen this owner into arbitrary process,
window, desktop, or keyboard control.

# Bounded Operator Work Session

Updated: 2026-08-01

Status: implemented and accepted in source, isolated real development services,
full workspace validation, and exact store-native Core/Observer closures.
Physical generation deployment is not authorized or included.

## Selected Capability

Turn the existing fixed Operator Run into one usable, explicitly bounded work
session:

```text
operator selects 1-20 queued tasks
-> previews the exact next task without mutation
-> explicitly starts one finite queue run
-> execution stops at the selected bound or the first existing stop condition
```

This advances the user-space control plane toward useful bounded autonomy. It
does not add a scheduler, daemon loop, automatic retry, or provider-driven
execution.

## Contract

- Core accepts exactly integer `maxSteps` from 1 through 20 and optional boolean
  `dryRun`; all extra fields are rejected before the operator loop is invoked.
- Callers cannot supply task ids, actions, URLs, policy, approvals, credentials,
  retry behavior, or execution context through `/operator/run`.
- A dry run returns the exact next queued task through existing public
  serialization and does not change task state.
- A real run reuses the existing task policy, pause, approval, execution,
  verification, persistence, audit, and stop-condition owners.
- Observer exposes a numeric 1-20 task limit plus separate Preview Queue and Run
  Queue commands. Invalid input is rejected before network contact.
- Every request is an explicit foreground operator trigger. Background
  scheduling, automatic repeat/retry, open loops, task/approval creation,
  provider calls, and host mutation remain false.

## Evidence

- Core contract tests prove exact request normalization, the 20-task ceiling,
  dry-run status, governance flags, and rejection of malformed limits and
  caller execution authority.
- Production route tests prove the normalized body is the only input reaching
  the operator loop and rejected overrides never invoke it.
- Observer VM tests prove exact preview/run request bodies, strict limit parsing,
  next/last task selection, refresh behavior, and finite panel controls.
- The real `operator-control` gate proves queue preview, no mutation, override
  rejection, pause/resume, one bounded execution, verification, and idle final
  state through isolated services.
- The real `observer-operator` gate proves served controls/client wiring,
  preview of the exact queued task, explicit execution, and zero residual queue.
- Both gates stream large JSON into Node or read it from temporary files, so
  growing task state cannot exceed the host command-line argument limit.

Acceptance on 2026-08-01 passed 57 focused route/contract/client tests, all 1297
workspace tests, workspace typecheck, generated-client syntax, the exact
seven-check `@changed` selection, the 833-entry milestone registry, the
1021-file script audit, the Windows path budget, both isolated real-service
gates, and resource-bounded body-config. The read-only 273-file Core closure is
`/nix/store/bzmpdwckm0mvrsgrm0j7n21g5kswda9p-openclaw-core-0.1.0`; the
99-file Observer closure is
`/nix/store/8rdvphr1mx0cra5848l3maix6sq23brs-openclaw-observer-ui-0.1.0`.
The body-config run used one Nix job and two cores; post-run swap remained
unused and CPU package temperature was 46 C. No provider request, deployed
service mutation, physical generation switch, or reboot occurred.

## Deferred

- timers, background scheduling, automatic pickup, repeat, or retry;
- open-ended sessions and limits above 20;
- provider-selected execution, caller-authored actions/policy, and automatic
  approval;
- physical deployment, generation activation, host mutation, and reboot.

## Stop Condition

This request and UI contract are now frozen. Select the next distinct
operator-visible workflow gap rather than extending this session into an open
autonomy loop.

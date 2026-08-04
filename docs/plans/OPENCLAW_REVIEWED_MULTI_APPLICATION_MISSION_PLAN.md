# NixSoma Reviewed Multi-Application Mission Plan

Updated: 2026-08-04

## Capability

Advance Level 4 from two independent fixed-application workflows to one finite
reviewed mission across both applications. The exact task objective is:

```text
Enter exact text "VALUE" in the current browser form, submit it, then type it into the fixed native intake
```

`VALUE` is 1-32 characters from `[A-Za-z0-9 .,_-]`. The public capability is
`act.ai.workspace.reviewed_multi_application_mission`; its result registry is
`nixsoma-ai-workspace-reviewed-multi-application-mission-v0`.

```text
explicit reviewed task and confirm=true
-> require current trusted browser work view and stopped Native Intake
-> bind exact task/objective/version and transient objective value
-> run existing semantic form type -> verified submit workflow
-> revalidate the same task/objective/version/value and stopped Native Intake
-> require durable cross-application continuation audit
-> run existing fixed Native Intake start -> OCR Type -> verified stop workflow
-> require both compact completion receipts and mission completion audit
-> terminate
```

## Ownership

- The existing task-objective owner validates the reviewed task and trusted work
  view before either application receives authority.
- The existing semantic form owner remains the browser type/submit owner. One
  internal-only exact-input guard requires its provider type value to equal the
  complete mission objective before the existing semantic type actuator runs.
- The existing Native Intake owner remains the only application lifecycle owner.
  Its internal mission binding carries the exact task hashes and transient value
  into the existing OCR Type owner; the public Native Intake and OCR Type
  requests cannot supply these fields.
- The shared AI workspace coordinator owns one single-flight across both
  applications. Neither child owner can run concurrently through another AI
  workspace command.
- Observer exposes one `Browser + Native` command and a compact status. It has no
  value, task-order, unit, process, surface, action, retry, or budget control.

## Hard Bounds

- Exactly two fixed applications in server-owned order:
  `fixed_browser_form`, then `fixed_native_intake`.
- At most three provider calls: semantic type, semantic submit, and native OCR
  Type.
- At most three input/click actions: browser type, browser submit click, and
  native type.
- At most two lifecycle actions: start and stop the exact Native Intake unit.
- The combined fixed-action ceiling is five. No browser/application start,
  arbitrary process/window selection, caller target, coordinates, selector,
  Enter, hotkey, modifier, retry, skip, repeat, or third application is allowed.
- The already-reviewed task objective remains the durable authority and contains
  the exact value under the existing task-retention contract. The mission does
  not create a second plaintext copy: mission results, compact application
  receipts, capability summaries, audit payloads, Observer storage, and action
  state retain only existing task/objective hashes plus bounded write-only
  length evidence.
- The mission does not mutate or complete the task, create a task/approval,
  change policy, persist continuation authority, access the parent display, use
  root, or mutate the host.

## Failure Semantics

- Invalid task, objective grammar, work-view authority, or Native Intake state
  blocks before the browser provider call.
- Browser no-op/fallback/unverified evidence terminates before Native Intake.
- Task/objective/value drift after browser submit terminates before continuation.
- Missing continuation audit terminates before Native Intake.
- Native failure still uses the child workflow's mandatory stop path. Any
  transport or cleanup uncertainty is terminal and never replays browser or
  keyboard actions.
- A missing mission completion audit converts apparent success into
  `completed_audit_unavailable`.

## Evidence

- Core tests cover the exact objective grammar, internal semantic-form input
  equality, pre/post-browser task revalidation, fixed order, compact aggregate
  counts, continuation audit, native cleanup ownership, unknown outcomes, and
  no plaintext result/audit projection.
- Capability tests cover the exact public request, standing authorization,
  production descriptor/dispatch/summary assembly, and rejection of caller
  application order.
- Observer tests cover one task-bound command, strict two-application receipt
  validation, shared in-flight exclusion, and absence of text/order/budget or
  browser-storage controls.
- Final source evidence is all `1442/1442` workspace tests, typecheck, Core
  `994/994`, Observer `121/121`, Session Manager `85/85`, the real Core and
  Observer capability gates, body-config, exact `291/36/117`-file
  Core/Session Manager/Observer Nix closures, the 835-entry registry,
  1023-file/1007-shell-script audit, exact changed-check selection, and Windows
  path budget.

## Deferred

Physical generation activation and a live three-call provider mission are not
part of this source slice. Provider-authored tasks, automatic workflow choice,
retry/skip policy, a third application, wider Level 3 actions, and physical
Phase D mutation/rollback remain separately governed routes.

## Stop Condition

Freeze this owner when source, real-service, and closure checks pass. The next
source capability should bind a finite reviewed worklist item to one existing
fixed workflow choice without allowing provider task invention, arbitrary
application routing, or open-ended execution.

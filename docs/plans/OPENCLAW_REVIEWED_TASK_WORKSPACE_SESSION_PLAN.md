# Reviewed Task Workspace Session

Updated: 2026-08-01

Status: implemented in source with focused client and existing-cycle contract
evidence. Physical deployment and a real provider call remain outside this
slice; the underlying reviewed-cycle owner is already separately proven.

## Selected Capability

Connect the real reviewed browser-task entry to the existing governed AI
workspace cycle in one operator-visible workflow:

```text
create reviewed goal + URL
-> bind the task to the current work view
-> select that task in Observer
-> explicitly Run + Assess Selected Task
-> reuse the existing bounded run, assessment, audit, and acceptance owners
```

The new behavior is the task-context bridge and the adjacent operator control.
It does not create a second provider route or a hidden automatic continuation.

## Contract

- Observer adds explicit Run + Assess and Accept buttons beside the reviewed task
  composer.
- The bridge reads only the already-selected task id, copies it into the task
  detail selector, and delegates to the existing `runAiWorkspaceReviewedCycle`
  owner.
- No selected task means a local error and zero network requests.
- The acceptance bridge reads the same selected task id and delegates to the
  existing `acceptAiWorkspaceAssessment` owner; it does not manufacture or
  accept a receipt locally.
- The existing cycle retains its explicit trigger, bounded maximum of three
  provider calls and two actions, task/work-view revalidation, read-only
  assessment, required operator acceptance, no automatic task completion, and
  no host mutation.
- The bridge owns no provider credentials, target URL, action, policy, approval,
  retry, scheduler, or task-creation authority.

## Evidence

- Observer bridge tests prove selected-task forwarding for both cycle and
  acceptance, fallback to the current selector, local failure without a task,
  and both panel controls.
- Existing reviewed-cycle tests continue to prove the delegated owner contract.
- The Observer operator service gate checks the served HTML/client bridge tokens;
  the capability-invoke gate remains the production capability surface.
- Body-config will prove the new bridge is present in the read-only Observer
  closure; no Core closure changes are expected.

Acceptance on 2026-08-01 passed 92 Observer workspace tests, including six
bridge tests, Observer typecheck/build, the exact six-check `@changed`
selection, the 833-entry registry, 1021-file script audit, Windows path budget,
the isolated `observer-operator` and `observer-capability-invoke` gates, and
resource-bounded body-config. The read-only Observer closure is the 100-file
store path
`/nix/store/cmpllcg18wi4jib02ggcr9y0s9dg2wxl-openclaw-observer-ui-0.1.0`.
The first body-config attempt stopped at an unavailable DNS substituter; the
validated retry used `substitute = false`, one Nix job, and two cores and
completed locally. No real provider call, physical generation switch, host
mutation, or reboot occurred.

## Deferred

- automatic cycle start after task creation;
- provider calls in this source acceptance slice;
- automatic assessment acceptance or task completion;
- background scheduling, retry, open-ended autonomy, physical deployment, and
  host mutation.

## Stop Condition

After the bridge and existing owner pass focused, served-client, structural, and
store-closure checks, freeze this integration. Reassess the next missing
operator-visible workflow instead of adding more cycle variants.

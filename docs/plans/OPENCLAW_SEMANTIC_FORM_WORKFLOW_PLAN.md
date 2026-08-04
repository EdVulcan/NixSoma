# AI Workspace Semantic Form Workflow

Updated: 2026-08-04

Status: implemented and integration-validated in source. Full workspace,
real-service, and exact Nix closure evidence pass. Physical deployment and live
provider evidence are recorded separately and must not be inferred from this
checkpoint.

## Selected Capability

Close one concrete Level 4 multi-step workflow over the existing semantic type
and receipt-bound submit owners:

```text
operator explicitly starts one reviewed task-bound form workflow
-> provider may select only one enabled semantic textbox and bounded value
-> existing semantic type owner executes once and verifies the post-action frame
-> Core audits the exact task/version/response/scene-bound continuation
-> provider may select only one eligible Submit/Send/Continue/Confirm button
-> existing semantic click owner executes once and verifies the post-action frame
-> workflow emits one compact completion receipt and terminates
```

This is one finite workflow, not a general planner or open action loop.

## Contract

- The public capability is `act.ai.workspace.semantic_form_workflow` and accepts
  only one reviewed `taskId` plus `params.confirm=true`.
- Step one uses a dedicated `semantic_form_type` decision mode. The provider may
  return only `type_item` or `no_op`; click, scroll, Enter, hotkeys, coordinates,
  selectors, URLs, commands, and caller-supplied input are rejected before an
  actuator call.
- The input value exists only in the current semantic-type execution payload.
  Workflow, capability, audit, task, event, Observer, and persistence surfaces
  retain only write-only length evidence.
- Step two is allowed only when step one is `executed`, task/scene/surface bound,
  post-action verified, completion-audited, and provider-generated input evidence
  is valid. The continuation audit binds the exact task, objective hash, task
  version hash, response hash, scene hash, and compact input evidence.
- Step two reuses the existing semantic-submit decision mode and eligible target
  policy. It must be a verified `click_item` on one enabled submit-like button.
- Task or scene drift, no-op, fallback, missing audit, unverified action, malformed
  result, and unknown transport outcome stop the workflow. There is no retry,
  replay, alternate action, or third step.
- A later workflow action invalidates any older standalone semantic-type receipt
  for the same task, preventing a second submit through the separate receipt path.

## Governance

```text
explicitOperatorTrigger=true
standingAuthorization=true
maximumProviderCalls=2
maximumActions=2
continuationAfterVerifiedTypeOnly=true
terminalAfterSubmitStep=true
boundedAutomaticContinuation=true only after exact verified type
automaticRepeat=false
inputTextExposed=false
inputTextPersisted=false
taskMutated=false
automaticTaskCompletion=false
createsTask=false
createsApproval=false
parentDisplayConnected=false
mutatesHost=false
```

The workflow does not accept an assessment, complete the task, create a mission,
change policy, activate an experience profile, control another process/window,
or touch the host.

## Evidence

- Policy tests prove type-only parsing and rejection of click/scroll variants.
- Single-step tests prove the constrained mode reaches only the existing
  write-only semantic type owner.
- Workflow tests prove exact type-to-submit continuation, no plaintext readback,
  stop-before-submit on unverified type, and no retry after unknown submit outcome.
- Capability runtime tests prove the production descriptor, standing
  authorization, exact request shape, compact invocation summary, and runtime
  assembly.
- Observer tests prove one `Type + Submit` control, strict receipt validation,
  no caller action/ordinal/value fields, and no browser storage.
- The real Core and Observer capability-invoke gates prove production assembly,
  operator identity, compact audit/readback, and served Observer behavior over
  isolated nine-service lifecycles.
- Full workspace tests and typecheck pass. Body configuration builds exact
  `287`-file Core and `115`-file Observer store closures containing the new
  owners; the 835-entry registry, 1007-script audit, and Windows path budget
  also pass.

## Stop Condition

This stop condition is reached: focused suites, full workspace tests/typecheck,
both representative real-service capability paths, body configuration, and
exact Core and Observer closures pass. Freeze this workflow. Physical generation
activation and a real provider form run require separate authorization.

The next route must advance a distinct missing capability: a second fixed native
application workflow, durable reviewed task planning/supply, wider fixed body
composition, or separately authorized physical Phase D promotion. Do not add a
third semantic form step, generic Enter, arbitrary keyboard input, retry, or an
open-ended browser loop to this owner.

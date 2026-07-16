# OpenClaw Native Engineering Capability Runtime Workspace Mutations

Updated: 2026-07-16

## Purpose

Close the declared-versus-runtime gap for the existing native workspace
mutation capabilities:

```text
act.openclaw.workspace_text_write
act.openclaw.workspace_patch_apply
```

This is a common capability-runtime bridge, not a new filesystem implementation.
Both capabilities delegate task creation to the existing `workspaceOps` owner
and preserve its approval, filesystem-boundary, task, and ledger contracts.

## Contract

`POST /capabilities/invoke` now uses two independent gates for these high-risk
actions:

1. Core policy approval must allow the invocation through `approved: true`.
2. The capability parameters must include `confirm: true`, which is passed to
   the existing task owner as its explicit task-creation confirmation.

An approved request without `confirm: true` returns an operator-confirmation
blocked result and creates no task or approval. An unapproved request is blocked
by the normal capability policy before the workspace owner is called.

Text write inputs are forwarded only to the existing bounded text-write task
builder. Patch inputs are forwarded only to the existing diff-preview patch
task builder, including exact/multi-edit and source-derived target options.
Task and approval responses use the existing public serializers. Content,
search/replacement strings, and full diff previews remain transient response
data; the capability invocation ledger and capability events retain only
compact task, target, approval, and governance summaries.

## Implementation

```text
services/openclaw-core/src/capability-runtime-workspace-mutations.mjs
services/openclaw-core/src/capability-runtime.mjs
services/openclaw-core/src/plan-builder.mjs
services/openclaw-core/src/server.mjs
```

The handler is deliberately separate from the existing runtime dispatcher. It
owns only capability-id routing, input shaping, public task serialization, and
summary redaction. It does not duplicate workspace target resolution, patch
validation, approval creation, task lifecycle, filesystem writes, or ledger
recording.

## Evidence

Focused unit and common-runtime tests:

```text
services/openclaw-core/test/capability-runtime-workspace-mutations.test.mjs
services/openclaw-core/test/capability-runtime-workspace-mutations.integration.test.mjs
```

The existing real capability-invoke pair now proves:

```text
nix/scripts/dev-capability-invoke-check.sh
nix/scripts/dev-observer-capability-invoke-check.sh
```

The checks cover the unconfirmed block, approved text-write task, approved
patch-apply task, pending approvals, public redaction, compact invocation/event
evidence, and registry approval metadata. No new milestone shell or duplicate
workspace task route was added.

## Identity And Deferral

This is a Level 1 user-space control-plane closure. It makes the existing
operator-visible mutation lifecycle available through the canonical capability
registry and invoke path.

The following remain deliberately unchanged:

```text
automatic approval
automatic operator execution
unbounded filesystem access
content persistence in capability history or audit events
provider calls or network egress
plugin module execution
root/system-daemon mutation
```

After this contract is closed, do not add another mutation/readiness wrapper.
Select the next concrete operator or Level 2 identity need from current
evidence; `act.plugin.capability.invoke` and live ACPX/Codex execution remain
explicit deferred authorization boundaries.

# OpenClaw Native Engineering Capability Runtime Verification Evidence Plan

Updated: 2026-07-18

## Active Slice

Expose the existing bounded `cc_verify` verification-evidence builder through
the common `POST /capabilities/invoke` runtime.

Identity alignment: Level 1, stable user-space control plane.

## Demonstrated Gap

The native verification route already reads approval-gated command transcripts,
joins completed task outcomes, applies output budgets, and exposes Observer
readback. It was not present in the common capability registry, so a caller
could not use the normal capability policy, invocation ledger, and capability
event path for the same read-only verification evidence.

## Implemented Behavior

The registry now exposes:

```text
sense.openclaw.engineering_tool.verify_evidence
```

The capability dispatches to the existing verification-evidence builder using a
lazy core transcript accessor, the existing capability invocation records, and
the existing task map. The response remains bounded and may contain only the
builder's transient stdout/stderr previews. Invocation summaries persist only
counts and governance flags.

The existing direct route and Observer panel remain unchanged. The common
runtime is an additional governed entry point, not a second verification
implementation.

## Second-Stage Mutation Follow-Up

The completed workspace write loop now has a separate bounded autonomy path. In
`sovereign_body`, a completed `act.openclaw.workspace_text_write` or
`act.openclaw.workspace_patch_apply` task may create at most one follow-up
through the existing source-command owner. The follow-up carries a compact
`sourceTaskId` and `mutationHash` trigger and can execute only the registered
shell-free `typecheck`, `test`, or `lint` proposal. The existing task, step, and
capability request binding is checked again before the command reaches
system-sense.

In `guardian`, the same post-write follow-up remains a normal pending-approval
task. Neither mode auto-approves the write, creates recovery tasks, retries a
failed validation, reads credentials, calls a provider, uses external network
egress, or mutates the host. Follow-up lookup/creation/execution failure is
attached as compact source-task evidence and does not change a completed write
to a different result.

## Governance

```text
audit-only local body capability
existing policy decision is recorded before dispatch
existing capability invocation ledger and events are used
no command execution, task creation, approval creation, retry, mutation, provider call, or network egress
command transcript and output limits remain owned by the existing builder
```

## Evidence

Runtime bridge:

```text
services/openclaw-core/src/capability-descriptors.mjs
services/openclaw-core/src/capability-runtime-engineering-verification.mjs
services/openclaw-core/src/capability-runtime.mjs
services/openclaw-core/src/plan-builder.mjs
services/openclaw-core/src/server.mjs
```

Focused and real checks:

```text
services/openclaw-core/test/capability-runtime.test.mjs
capability-invoke
observer-capability-invoke
openclaw-native-engineering-verification-evidence
observer-openclaw-native-engineering-verification-evidence
```

## Deferred

Actual command execution remains on the existing source-command task path. In
the default `guardian` mode it remains approval-gated. The separate bounded
post-write follow-up supports `sovereign_body` standing authorization only for
registered low-risk `typecheck`, `test`, and `lint` proposals with a
source-task/mutation, task/step, and parameter binding; it does not authorize
build/runtime scripts, mutation, recovery reruns, provider/root authority, or
arbitrary shell execution. This read-only evidence capability itself still does
not create a verification task, approve one, or run a command.

Focused evidence includes:

```text
services/openclaw-core/src/task-executor-verification-followup.mjs
services/openclaw-core/test/task-executor-verification-followup.test.mjs
services/openclaw-core/test/task-executor.test.mjs
services/openclaw-core/test/capability-runtime-approval-binding.test.mjs
nix/scripts/dev-openclaw-native-engineering-write-closed-loop-check.sh
```

The real write closed-loop check passes in both modes: `guardian` records one
approval-gated verification task, while `sovereign_body` records one successful
automatic verification and no verification approval.

## Next Smallest Capability

The common Level 1 verification entry-point gap is closed. Do not add another
verification/readiness wrapper; continue with the smallest concrete Level 2
trusted work-view/session-helper capability while preserving local workspace,
provider, root, and desktop-wide capture boundaries.

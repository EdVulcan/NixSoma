# OpenClaw Native Engineering Prompt Work Standards Plan

Updated: 2026-07-16

## Active Slice

Engineering prompt semantics as Observer-verifiable work standards.

This slice deepens the existing native prompt semantics surface. It does not
copy enhanced-source prompts, enforce a hidden prompt wall, or create a new task
lane. Instead, `openclaw-native-prompt-semantics-v0` now derives a compact
`openclaw-engineering-work-standards-v0` assessment from bounded prompt/tool
signals.

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

Existing endpoint:

```text
GET /plugins/native-adapter/prompt-semantics
```

now returns:

```text
workStandards.registry: openclaw-engineering-work-standards-v0
workStandards.status
workStandards.score
workStandards.standards[]
workStandards.operatorContract
```

The assessment maps useful enhanced-source engineering semantics into product
standards:

```text
plan before mutation
bounded diff preview before apply
explicit approval for mutation
filesystem ledger after apply
patch validation for edits
verification evidence before report
prompt content is not product authority
```

Observer renders the assessment in the existing OpenClaw Prompt Semantics panel.

## Task-Aware Engineering Loop Readback

The Observer Engineering Loop State now consumes the same read-only assessment
with a fixed query selected from the current task kind:

```text
edit -> edit
write -> write
verification -> verify
recovery/recovery-draft -> verify
planning-workbench -> plan
lsp-lifecycle -> verify
```

The existing panel shows the standards status, missing required standard count,
and a bounded next-standards action. The JSON readback includes the selected
query and the same guidance. Restored tasks refresh this state from core
history, so a reload does not leave stale edit guidance attached to a write,
verification, or recovery task.

This remains read-only guidance: it does not create tasks, approvals, operator
steps, mutations, command executions, provider requests, or recovery actions.

The same profile is now declared in the common capability registry as
`sense.openclaw.prompt_pack`. Its `/capabilities/invoke` bridge is documented
in `OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_PROMPT_STANDARDS_PLAN.md`.
The bridge records only bounded counts, work-standards status, and explicit
negative authority flags; prompt bodies remain transient and are absent from
invocation history and audit events.

## Governance

The surface remains read-only:

```text
no prompt body exposure
no prompt code execution
no legacy enhanced-source module import
no task creation
no approval creation
no mutation
no provider call
```

This is intentionally a standards contract for the existing engineering loop,
not a replacement for policy, approval, ledgers, verification tasks, or recovery
readback.

## Evidence

Runtime helper:

```text
services/openclaw-core/src/plugin-review-prompt-work-standards.mjs
```

Existing prompt semantics builder:

```text
services/openclaw-core/src/plugin-review-workspace-intelligence.mjs
```

Observer renderer:

```text
apps/observer-ui/src/client-script-renderers-workspace-source.mjs
```

Validation targets:

```text
services/openclaw-core/test/plugin-review-workspace-intelligence.test.mjs
openclaw-prompt-semantics-edit-plan
observer-openclaw-prompt-semantics-edit-plan
openclaw-native-engineering-loop-operator-controls
```

## Deferred

The following remain deferred:

```text
hidden prompt-wall enforcement
copying HEARTBEAT/SOUL/TOOLS as product authority
automatic task approval or execution
automatic verification or recovery rerun
provider/network egress
root/system daemon work
```

## Next Slice

Task-aware standards readback and the common capability-runtime bridge are
complete. Continue with the Level 2 trusted work-view/session-helper route. Keep
provider egress, credential access, ACP/Codex live process execution, and
root/system daemon work deferred; do not reopen this lane with another
evidence-only shell.

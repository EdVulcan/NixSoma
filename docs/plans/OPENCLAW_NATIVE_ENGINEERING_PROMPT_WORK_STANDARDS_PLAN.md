# OpenClaw Native Engineering Prompt Work Standards Plan

Updated: 2026-07-10

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

The next safe capability should keep strengthening the existing engineering
loop without requiring live ACP/Codex process execution. A good candidate is a
small Observer-side improvement that uses `workStandards` to highlight missing
engineering-loop evidence for an existing task, while keeping task creation and
mutation explicit.

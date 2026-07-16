# OpenClaw Native Engineering Capability Runtime Prompt Standards Plan

Updated: 2026-07-16

## Active Slice

Expose the existing bounded prompt-semantics profile through the common
`POST /capabilities/invoke` runtime as:

```text
sense.openclaw.prompt_pack
```

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

The capability descriptor points to the existing read-only prompt semantics
route and delegates to the existing
`buildNativeOpenClawPromptSemanticsProfile` builder. The runtime handler keeps
the builder's bounded inputs (`workspacePath`, `query`, and `limit`) and emits a
compact invocation summary containing file counts, expected-check counts, and
work-standards score/status.

The capability is now available through the same registry, policy evaluation,
invocation ledger, and capability events as the other native engineering
surfaces. The direct prompt-semantics route remains the authoritative detailed
response for the existing Observer panel.

## Governance

```text
audit-only local body capability
prompt files may be read internally for derived signals, but prompt bodies are not exposed in the invocation summary or audit event
prompt and tool code are not executed
no mutation, task creation, or approval creation
no provider call, network use, or runtime activation
no source-module import
```

The capability does not add a task, approval, provider, or network path. It
only makes the already-proven product behavior reachable through the canonical
capability runtime.

## Evidence

Runtime and focused unit tests:

```text
services/openclaw-core/src/capability-runtime-prompt-pack.mjs
services/openclaw-core/src/capability-runtime.mjs
services/openclaw-core/src/capability-descriptors.mjs
services/openclaw-core/test/capability-runtime-prompt-pack.test.mjs
```

Real Core and Observer checks:

```text
nix/scripts/dev-capability-invoke-check.sh
nix/scripts/dev-observer-capability-invoke-check.sh
```

Both checks invoke the capability against a local `AGENTS.md` fixture and
assert work-standards metadata, prompt-content redaction, and the negative
authority boundary.

## Deferred

```text
hidden prompt-wall enforcement
automatic approval or task creation from prompt semantics
prompt/tool code execution
provider or network egress
root/system daemon work
```

The next route remains the Level 2 trusted work-view/session-helper boundary;
this capability is not a reason to reopen provider-readiness work.

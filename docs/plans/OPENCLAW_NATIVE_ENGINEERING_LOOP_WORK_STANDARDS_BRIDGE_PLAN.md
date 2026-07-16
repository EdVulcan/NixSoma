# OpenClaw Native Engineering Loop Work Standards Bridge Plan

Updated: 2026-07-16

## Active Slice

Engineering Loop State work standards bridge.

This slice connects the existing prompt-derived work standards assessment to
the existing Observer Engineering Loop State panel. It does not add a backend
route, new milestone lane, task creation path, approval path, command
execution, or mutation.

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

When Engineering Loop State has an active task, the Observer now reads:

```text
GET /plugins/native-adapter/prompt-semantics?query=edit&limit=24
```

and appends `openclaw-engineering-work-standards-v0` status to the same state
readback:

```text
standards registry
status
satisfied / required score
missing required standards
operator contract flags
prompt-wall boundary
```

This keeps standards visible where the operator is already deciding the next
engineering action.

## Governance

The bridge remains UI/readback-only:

```text
no task creation
no approval creation
no operator step
no mutation
no prompt execution
no provider call
```

The standards bridge guides the existing loop; it does not replace policy,
approval, ledgers, verification evidence, or recovery evidence.

## Evidence

Observer runtime:

```text
apps/observer-ui/src/client-script-runtime-engineering-loop-controls.mjs
```

Validation target:

```text
openclaw-native-engineering-loop-operator-controls
```

The existing operator-controls milestone checks that the served client contains
the standards bridge functions, route, registry token, and no-mutation boundary.

The profile is also available through the common `sense.openclaw.prompt_pack`
capability. That bridge keeps the backend invocation summary bounded and does
not turn Observer guidance into policy, task, approval, execution, provider, or
network authority.

## Deferred

The following remain deferred:

```text
automatic task approval based on standards
automatic execution based on standards
automatic recovery rerun
server-side policy enforcement from prompt standards
provider/network egress
root/system daemon work
```

## Next Slice

The standards visibility and common capability bridge are complete. The next
route is the Level 2 trusted work-view/session-helper capability; do not add
another standards-only coverage or readiness chain.

# OpenClaw Native Engineering Capability Runtime Workspace Navigation Plan

Updated: 2026-07-17

## Active Slice

Route the existing read-only workspace semantic index and symbol lookup panels
through the common capability runtime.

Identity alignment: Level 1, stable user-space control plane.

## Demonstrated Gap

Core already exposed `sense.openclaw.workspace_semantic_index` and
`sense.openclaw.workspace_symbol_lookup` through `/capabilities/invoke`, but
Observer refreshed the same panels through their dedicated routes. That left
the operator-facing navigation surface without the common policy, invocation
ledger, and capability-event evidence used by the other engineering tools.

## Implemented Behavior

Observer now invokes both existing capabilities with the same bounded `scope`,
`query`, and `limit` inputs. The existing builders remain authoritative and
their detailed result stays transient for rendering. Invocation history keeps
only the existing bounded summary and governance fields.

## Governance

```text
read-only derived workspace navigation
no source-body or documentation exposure in the navigation projection
no module import or tool-code execution
no task or approval creation
no workspace mutation
no LSP start or JSON-RPC request
no provider call or network egress
```

## Evidence

Implementation:

```text
apps/observer-ui/src/client-script-refreshers-workspace-source.mjs
```

Existing real Core/Observer checks now also assert that each refresh function
uses `/capabilities/invoke` and does not call the dedicated route directly:

```text
nix/scripts/dev-observer-openclaw-native-workspace-semantic-index-check.sh
nix/scripts/dev-observer-openclaw-native-workspace-symbol-lookup-check.sh
```

## Stop Condition

The semantic-index and symbol-lookup common-path pair is complete when the
focused Core/Observer checks pass and their invocation history shows one
audit-only invocation each. Do not add another navigation wrapper or broaden
this slice into a generic tool dispatcher.

## Deferred

```text
source-content editing
LSP process pools or multi-request sessions
plugin import or runtime activation
provider/network egress
root or hostd mutation
```

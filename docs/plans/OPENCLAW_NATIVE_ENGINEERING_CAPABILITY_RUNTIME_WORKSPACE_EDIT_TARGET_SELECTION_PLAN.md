# OpenClaw Native Engineering Capability Runtime Workspace Edit Target Selection Plan

Updated: 2026-07-16

## Active Slice

Expose the existing bounded source-derived workspace edit target selection
through the common `POST /capabilities/invoke` runtime as:

```text
sense.openclaw.workspace_edit_target_select
```

Identity alignment: Level 1, stable user-space control plane.

## Demonstrated Gap

The native plugin descriptor, direct target-selection route, and builder already
existed. The common capability descriptor did not include the capability, so
the capability registry could not discover it and `/capabilities/invoke` could
not apply the normal policy, invocation ledger, or capability-event path.

## Implemented Behavior

The common descriptor now points to the existing
`/plugins/native-adapter/workspace-edit-target-selection` route. A focused
runtime handler delegates bounded `workspacePath`, `scope`, `query`, and
`limit` inputs to the existing builder and returns a compact invocation summary
with:

```text
registry, scope, candidate count, selected state, selected relative path
canFeedPatchProposal
no source-content exposure
no mutation, task creation, approval creation, plugin execution, or runtime activation
canCallProvider=false, canUseNetwork=false, noProviderEgress=true
```

The direct route remains the detailed target-selection read model used by the
existing workspace proposal and Observer surfaces. The common runtime now
provides the canonical policy, invocation, and event boundary without creating
a second selection algorithm or mutation path.

## Governance

```text
audit-only local body sensor
source files may be read internally for derived metadata, but file bodies remain transient and are not in the invocation summary
declaration previews remain bounded metadata; function bodies are not exposed
no file mutation, task creation, or approval creation
no plugin-code execution or runtime activation
no provider call or network use
```

## Evidence

Runtime and focused unit test:

```text
services/openclaw-core/src/capability-runtime-workspace-edit-target.mjs
services/openclaw-core/src/capability-runtime.mjs
services/openclaw-core/src/capability-descriptors.mjs
services/openclaw-core/test/capability-runtime-workspace-edit-target.test.mjs
services/openclaw-core/test/plugin-review-workspace-intelligence.test.mjs
```

Real Core and Observer checks reuse the existing target-selection lifecycle:

```text
nix/scripts/dev-openclaw-workspace-edit-target-selection-check.sh
nix/scripts/dev-observer-openclaw-workspace-edit-target-selection-check.sh
```

Both checks invoke the common capability against the same local fixture and
assert selected-target identity, proposal eligibility, source-content
redaction, and every negative authority boundary.

## Observer Common-Path Closure

The existing Observer Edit Target Selection refresh now invokes
`sense.openclaw.workspace_edit_target_select` through
`POST /capabilities/invoke` and unwraps only the transient bounded builder
result for the existing renderer. The dedicated selection route remains the
detailed read-model owner; edit proposals, task creation, approval, patch
execution, and mutation remain separate explicit paths.

The real Observer check proves the served client no longer refreshes through
the dedicated route while preserving selected-target identity and all negative
authority flags.

## Deferred

```text
automatic edit proposal or task creation from target selection
automatic approval or patch execution
provider or network egress
plugin module import, plugin-code execution, and runtime activation
root/system daemon work and arbitrary workspace paths
```

The target-selection capability closes this declared/runtime boundary. Do not
open another horizontal read-only bridge unless a concrete operator gap appears;
the next route remains the smallest real Level 2 trusted work-view/session
capability.

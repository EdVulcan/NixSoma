# OpenClaw Native Engineering LSP Selected-Target Read Bridge Plan

Updated: 2026-07-10

## Active Slice

LSP selected-target read bridge.

This slice connects the bounded target metadata from an approved single LSP
symbol request to the existing native bounded workspace read/search surface. It
turns a selected `file://` URI/range into a concrete read request and can, when
explicitly requested, return the bounded native read preview for that target.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint And Registry

```text
GET /plugins/native-adapter/engineering-lsp/selected-target-read-bridge
registry: openclaw-native-engineering-lsp-selected-target-read-bridge-v0
mode: lsp-selected-target-to-native-read-bridge
```

Capability mapping:

```text
cc_lsp selected target + cc_read
-> sense.openclaw.engineering_tool.lsp_selected_target_read_bridge
```

## Implemented Behavior

The bridge:

```text
finds the latest completed symbol_request lifecycle record, or a requested taskId
reads only bounded response-summary target metadata already recorded by OpenClaw
requires a file:// selected target
converts the target path back to a workspace-relative path only when it is inside the selected workspace root
rejects path traversal and hidden/generated/cache target directories
maps LSP zero-based ranges to one-based native read line ranges with bounded context
returns the existing engineering-read-search/read URL and query
returns no file content by default
returns a native bounded read result only when includeRead=true is explicit
records embedded audit evidence for the bridge response
```

## Boundaries

This slice still blocks:

```text
automatic target follow-up task creation
automatic approval creation
additional JSON-RPC requests
long-lived LSP process pools
raw LSP response payload exposure
raw source exposure outside the existing native read/search budget
workspace mutation
provider calls, network egress, root/system daemon work
```

## Evidence

Runtime:

```text
services/openclaw-core/src/native-engineering-lsp-selected-target-read-bridge-builders.mjs
services/openclaw-core/src/plugin-review.mjs
services/openclaw-core/src/native-adapter-plugin-routes.mjs
apps/observer-ui/src/client-script-runtime-engineering-loop-controls.mjs
```

Validation targets:

```text
services/openclaw-core/test/native-engineering-lsp-selected-target-read-bridge-builders.test.mjs
services/openclaw-core/test/native-adapter-plugin-routes.test.mjs
openclaw-native-engineering-lsp-evidence
observer-openclaw-native-engineering-lsp-evidence
```

## Follow-up Completed

The Observer selected-target read control follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_OBSERVER_SELECTED_TARGET_READ_CONTROL_PLAN.md
```

That slice adds a `Read Selected Target` Observer control that calls the bridge
only after an explicit operator click and renders bounded read preview evidence
without automatic task creation, approval creation, JSON-RPC, LSP process start,
provider egress, or mutation.

# OpenClaw Native Engineering Read/Search Plan

Updated: 2026-07-15

## Active Slice

Native governed read/search surface.

This slice migrates the useful behavior of enhanced-source `cc_read`,
`cc_glob`, and `cc_grep` into OpenClaw-native read-only workspace operations.
It does not import or execute the preserved enhanced `cc-tools` implementation.

Identity alignment: Level 1, stable user-space control plane.

## Endpoints

```text
GET /plugins/native-adapter/engineering-read-search/read
GET /plugins/native-adapter/engineering-read-search/glob
GET /plugins/native-adapter/engineering-read-search/grep

registry: openclaw-native-engineering-read-search-v0
```

Capability mapping:

```text
cc_read -> sense.openclaw.engineering_tool.read
cc_glob -> sense.openclaw.engineering_tool.glob
cc_grep -> sense.openclaw.engineering_tool.grep
```

## Implemented Boundaries

The native builder enforces:

```text
workspace root selection through OPENCLAW_WORKSPACE_ROOTS
workspace-relative path input only
path traversal rejection
realpath containment checks for resolved files
symlink skip during discovery/search
max file size bounds
max result count bounds
max output character bounds
max scanned-file bound
binary file skip
hidden/generated/cache/dependency directory skip
embedded audit evidence on every response
Observer visibility for read/glob/grep status and bounds
```

Hidden/generated/cache policy:

```text
Discovery/search skips hidden directories, generated directories, cache
directories, dependency/build directories, and symlinks.
Direct read rejects paths that cross those skipped path segments.
```

## Deferred

The following remain deferred:

```text
write, edit, patch, or filesystem mutation
approval task creation
shell execution or verification command execution
LSP startup or language-server lifecycle
enhanced cc-tools module import
provider calls, network egress, result envelopes
```

## Evidence

Runtime builder:

```text
services/openclaw-core/src/native-engineering-read-search-builders.mjs
```

Route wiring:

```text
services/openclaw-core/src/native-adapter-plugin-routes.mjs
```

Observer visibility:

```text
apps/observer-ui/src/observer-panels-operations.mjs
apps/observer-ui/src/client-script-config-dom-workspace-source.mjs
apps/observer-ui/src/client-script-refreshers-workspace-source.mjs
apps/observer-ui/src/client-script-renderers-workspace-source.mjs
apps/observer-ui/src/client-script-startup-refreshes.mjs
```

Validation targets:

```text
services/openclaw-core/test/native-engineering-read-search-builders.test.mjs
openclaw-native-engineering-read-search
observer-openclaw-native-engineering-read-search
```

## Capability Runtime Follow-up

The bounded builders are now also exposed through the common capability
runtime, documented in:

```text
OPENCLAW_NATIVE_ENGINEERING_CAPABILITY_RUNTIME_READ_SEARCH_PLAN.md
```

The registry and `POST /capabilities/invoke` route apply the normal local
policy decision and persist only compact invocation summaries. The dedicated
native adapter routes and their Observer evidence remain unchanged.

## Route Correction

The historical surgical edit proposal follow-up is complete through the
existing diff-preview, approval bridge, execution evidence, verification, and
recovery loop. The capability-runtime follow-up above is also complete; do not
open another read/search or edit evidence shell from this document.

The next identity-upgrade route is the smallest real Level 2 trusted
work-view/session-helper behavior, with local workspace scope and explicit
authority boundaries preserved.

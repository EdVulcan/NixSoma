# OpenClaw Native ACPX/Codex Bridge Compatibility Plan

Updated: 2026-07-10

## Active Slice

ACPX/Codex bridge compatibility and runtime persistence evidence.

This slice migrates the useful enhanced-source ACPX/Codex bridge lessons into
OpenClaw-native Level 1 behavior:

```text
GET /plugins/native-adapter/acpx-codex-bridge-compatibility
POST /plugins/native-adapter/acpx-codex-session-records
```

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

The compatibility read model records:

- POSIX `npx` and Windows `npx.cmd` command compatibility lessons
- future ACP/Codex bridge target scoped to the NixOS body
- command override support as a contract, not an executed wrapper
- explicit auth isolation boundaries
- session metadata persistence status
- selected-session readback and missing-session null behavior

The session persistence store records bounded metadata for future ACPX/Codex
sessions:

- independent session keys
- overwrite revision increments
- restart persistence through the core state file
- secret-like metadata key redaction
- no credential value reads
- no auth material copies
- no wrapper writes
- no `npx` or ACP process spawn
- no provider/network egress

## Governance

Capability mapping:

```text
ACPX/Codex bridge compatibility -> sense.openclaw.acpx_codex_bridge.compatibility
ACPX runtime persistence tests -> state.openclaw.acpx_codex_bridge.session_metadata
```

This is intentionally not a live bridge execution path. It creates a native
compatibility contract and persistence primitive that later bridge work can
depend on.

## Evidence

Core builder:

```text
services/openclaw-core/src/native-acpx-codex-bridge-builders.mjs
```

State persistence:

```text
services/openclaw-core/src/runtime-state.mjs
acpxBridgeSessionRecords
```

Route wiring:

```text
services/openclaw-core/src/native-adapter-plugin-routes.mjs
```

Validation target:

```text
services/openclaw-core/test/native-acpx-codex-bridge-builders.test.mjs
services/openclaw-core/test/native-adapter-plugin-routes.test.mjs
openclaw-native-acpx-codex-bridge-compatibility
```

## Deferred

The following remain deferred:

```text
CODEX_HOME read
auth.json/config.toml read
auth material copy
wrapper file write
npx/npx.cmd execution
ACP/Codex process spawn
provider calls
network egress
Observer UI panel
root/system daemon work
```

## Next Smallest Real Capability

The next smallest useful bridge follow-up is:

```text
Observer visibility for ACPX/Codex bridge compatibility and persistence state
```

That should expose the existing read model in Observer without adding live auth
copy, wrapper execution, or provider egress.

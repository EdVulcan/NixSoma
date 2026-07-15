# OpenClaw Native ACPX/Codex Capability Runtime Plan

Updated: 2026-07-15

## Active Slice

Expose the existing bounded ACPX/Codex compatibility and session-metadata read
model through the common `POST /capabilities/invoke` runtime.

Identity alignment: Level 1, stable user-space control plane.

## Demonstrated Gap

The native ACPX/Codex compatibility route already provided useful local
governance evidence, but a capability consumer had to bypass the common policy,
invocation ledger, and capability-event path to read it. This bridge closes that
contract gap without adding a second ACPX implementation.

## Implemented Behavior

The registry now exposes:

```text
sense.openclaw.acpx_codex_bridge.compatibility
```

The capability delegates to the existing compatibility builder and optionally
accepts the same bounded `sessionKey` selector. Invocation summaries retain only
record counts, selection presence, persistence readiness, and governance flags;
session metadata remains transient response data.

## Governance

```text
normal capability policy decision, invocation ledger, and capability events
existing native ACPX/Codex compatibility builder remains authoritative
no CODEX_HOME, auth.json, config.toml, or credential-value read
no auth-material copy, wrapper write, chmod, or task creation
no wrapper execution, ACP/Codex process spawn, provider call, or network egress
```

## Evidence

Runtime and focused test:

```text
services/openclaw-core/src/capability-runtime-acpx-codex.mjs
services/openclaw-core/src/capability-runtime.mjs
services/openclaw-core/src/capability-descriptors.mjs
services/openclaw-core/test/capability-runtime-acpx-codex.test.mjs
```

Real Core and Observer checks:

```text
nix/scripts/dev-capability-invoke-check.sh
nix/scripts/dev-observer-capability-invoke-check.sh
```

## Deferred

```text
explicit live ACPX/Codex process authorization
CODEX_HOME and auth material access
npx/npx.cmd execution and ACP/Codex process spawn
provider calls, network egress, root/system daemon work
```

The live process boundary remains blocked until the operator explicitly
authorizes those local process, auth, provider, and network boundaries.

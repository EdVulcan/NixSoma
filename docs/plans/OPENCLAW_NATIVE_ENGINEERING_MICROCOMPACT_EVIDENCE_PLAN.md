# OpenClaw Native Engineering Microcompact Evidence Plan

Updated: 2026-07-15

## Active Slice

Microcompact context-management evidence through the direct and common
capability-runtime paths.

This slice migrates the useful enhanced-source `microcompact` idea into
OpenClaw-native read-model evidence. It does not rewrite transcript state. It
reads existing command transcript, verification, and recovery read models, then
calculates which historical tool-result outputs would be compactable and how
much context budget could be reclaimed.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint

```text
GET /plugins/native-adapter/engineering-microcompact/evidence

registry: openclaw-native-engineering-microcompact-evidence-v0
mode: context-management-evidence-only
```

Capability mapping:

```text
microcompact -> sense.openclaw.engineering_context.microcompact_evidence
```

## Implemented Behavior

The native builder:

```text
reads command transcript metadata and output lengths without returning raw output
uses a configurable threshold for compactable historical tool results
protects recent engineering evidence by default
joins verification and recovery summaries as protected evidence links
returns estimated reclaimed context characters
returns audit evidence and Observer-visible governance boundaries
```

## Deferred

The following remain deferred:

```text
runtime message mutation
persisted log mutation
automatic prompt/context rewrite
provider calls, network egress, result envelopes
command execution or retry execution
task or approval creation
```

Actual LLM-context transformation remains deferred until the read-model evidence
is consumed by an explicitly selected local context owner. The bounded
caller-owned projection route is already implemented separately and remains
transient.

## Common Capability Runtime Bridge

The existing evidence builder is available through the common
`POST /capabilities/invoke` path as:

```text
sense.openclaw.engineering_context.microcompact_evidence
```

The bounded caller-owned projection is also available as:

```text
act.openclaw.engineering_context.microcompact_projection
```

Both bridges reuse the existing builders. Evidence reads the command,
verification, and recovery read models; projection transforms only the supplied
message copy and publishes the existing summary-only
`native_engineering.microcompact_projection_built` audit event. Common
invocation/event records retain counts and governance flags only; raw command
output and message content remain transient.

## Evidence

Runtime builder:

```text
services/openclaw-core/src/native-engineering-microcompact-evidence-builders.mjs
services/openclaw-core/src/capability-runtime-engineering-microcompact.mjs
services/openclaw-core/src/capability-runtime.mjs
services/openclaw-core/src/capability-descriptors.mjs
```

Route wiring:

```text
services/openclaw-core/src/observer-read-model-routes.mjs
```

Observer visibility:

```text
apps/observer-ui/src/observer-panels-operations.mjs
apps/observer-ui/src/client-script-renderers-engineering-microcompact.mjs
```

Validation target:

```text
services/openclaw-core/test/native-engineering-microcompact-evidence-builders.test.mjs
services/openclaw-core/test/capability-runtime-engineering-microcompact.test.mjs
openclaw-native-engineering-microcompact-evidence
observer-openclaw-native-engineering-microcompact-evidence
capability-invoke
observer-capability-invoke
```

Direct route validated on 2026-07-09:

```text
node --test services/openclaw-core/test/native-engineering-microcompact-evidence-builders.test.mjs services/openclaw-core/test/route-handlers.test.mjs services/openclaw-core/test/native-adapter-plugin-routes.test.mjs
npm --workspace @openclaw/openclaw-core run typecheck
npm --workspace @openclaw/observer-ui run typecheck
OPENCLAW_MILESTONE_CHECKS=openclaw-native-engineering-microcompact-evidence,observer-openclaw-native-engineering-microcompact-evidence bash nix/scripts/dev-milestone-check.sh
OPENCLAW_MILESTONE_CHECKS=milestone-registry,milestone-script-audit bash nix/scripts/dev-milestone-check.sh
```

Common capability bridge validated on 2026-07-15:

```text
node --test services/openclaw-core/test/capability-runtime-engineering-microcompact.test.mjs services/openclaw-core/test/native-engineering-microcompact-evidence-builders.test.mjs services/openclaw-core/test/native-engineering-microcompact-projection.test.mjs services/openclaw-core/test/native-engineering-context-routes.test.mjs
bash nix/scripts/dev-openclaw-native-engineering-microcompact-evidence-check.sh
bash nix/scripts/dev-observer-openclaw-native-engineering-microcompact-evidence-check.sh
```

## Route Status

The direct evidence route, bounded projection, Observer readback, and common
capability-runtime entry points are closed for this Level 1 context-management
slice. The bounded in-memory projection remains a caller-owned transformation;
it does not authorize automatic provider/context rewriting.

```text
OPENCLAW_NATIVE_ENGINEERING_MICROCOMPACT_PROJECTION_PLAN.md
```

It transforms only a caller-owned message copy, protects recent assistant turns
and verification/recovery evidence, and does not mutate persisted transcripts,
tasks, or provider state.

The later route remains:

```text
Live plugin runtime refresh as a governed lifecycle action
```

It is tracked in:

```text
OPENCLAW_NATIVE_PLUGIN_RUNTIME_REFRESH_EVIDENCE_PLAN.md
```

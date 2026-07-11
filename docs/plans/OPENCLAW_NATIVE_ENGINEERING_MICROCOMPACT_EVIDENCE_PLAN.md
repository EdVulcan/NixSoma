# OpenClaw Native Engineering Microcompact Evidence Plan

Updated: 2026-07-09

## Active Slice

Microcompact context-management evidence.

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
is stable and governed.

## Evidence

Runtime builder:

```text
services/openclaw-core/src/native-engineering-microcompact-evidence-builders.mjs
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
openclaw-native-engineering-microcompact-evidence
observer-openclaw-native-engineering-microcompact-evidence
```

Validated on 2026-07-09:

```text
node --test services/openclaw-core/test/native-engineering-microcompact-evidence-builders.test.mjs services/openclaw-core/test/route-handlers.test.mjs services/openclaw-core/test/native-adapter-plugin-routes.test.mjs
npm --workspace @openclaw/openclaw-core run typecheck
npm --workspace @openclaw/observer-ui run typecheck
OPENCLAW_MILESTONE_CHECKS=openclaw-native-engineering-microcompact-evidence,observer-openclaw-native-engineering-microcompact-evidence bash nix/scripts/dev-milestone-check.sh
OPENCLAW_MILESTONE_CHECKS=milestone-registry,milestone-script-audit bash nix/scripts/dev-milestone-check.sh
```

## Follow-On Slice

The bounded in-memory projection follow-up is complete:

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

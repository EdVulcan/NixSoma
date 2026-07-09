# OpenClaw Native Engineering Verification Evidence Plan

Updated: 2026-07-09

## Active Slice

Verification command evidence attached to task completion.

This slice migrates the useful `cc_verify` idea into OpenClaw-native evidence
readback. It does not introduce a new shell executor. It reads existing
approval-gated command transcripts, capability invocation records, and completed
task outcomes, then converts them into bounded verification evidence.

Identity alignment: Level 1, stable user-space control plane.

## Endpoint

```text
GET /plugins/native-adapter/engineering-verification/evidence

registry: openclaw-native-engineering-verification-evidence-v0
mode: completed-command-transcript-verification-evidence
```

Capability mapping:

```text
cc_verify -> sense.openclaw.engineering_tool.verify_evidence
```

## Implemented Behavior

The native builder:

```text
reads command transcript records from the existing task executor read model
joins capability invocation metadata where available
checks whether each transcript is attached to a completed task outcome
checks exit code, timeout, and task completion state
returns bounded stdout/stderr previews with output truncation flags
returns retry-policy metadata without retrying commands
returns audit evidence and Observer-visible governance boundaries
```

## Deferred

The following remain deferred:

```text
new verification command execution
shell invocation outside existing approval-gated command tasks
automatic retries
task or approval creation from the evidence endpoint
provider calls, network egress, result envelopes
LSP startup
```

Actual command execution remains the existing approval-gated source/workspace
command task path.

## Evidence

Runtime builder:

```text
services/openclaw-core/src/native-engineering-verification-evidence-builders.mjs
```

Route wiring:

```text
services/openclaw-core/src/observer-read-model-routes.mjs
```

Observer visibility:

```text
apps/observer-ui/src/observer-panels-operations.mjs
apps/observer-ui/src/client-script-renderers-engineering-verification.mjs
```

Validation target:

```text
services/openclaw-core/test/native-engineering-verification-evidence-builders.test.mjs
openclaw-native-engineering-verification-evidence
observer-openclaw-native-engineering-verification-evidence
```

Validated on 2026-07-09:

```text
node --test services/openclaw-core/test/native-engineering-verification-evidence-builders.test.mjs services/openclaw-core/test/route-handlers.test.mjs
npm --workspace @openclaw/openclaw-core run typecheck
npm --workspace @openclaw/observer-ui run typecheck
OPENCLAW_MILESTONE_CHECKS=openclaw-native-engineering-verification-evidence,observer-openclaw-native-engineering-verification-evidence bash nix/scripts/dev-milestone-check.sh
```

## Follow-On Slice

The direct follow-on slice is:

```text
Observer visibility and recovery evidence for native engineering tool failures
```

It is tracked in:

```text
OPENCLAW_NATIVE_ENGINEERING_RECOVERY_EVIDENCE_PLAN.md
```

# OpenClaw Native Engineering Capability Runtime Read/Search Plan

Updated: 2026-07-15

## Active Slice

Expose the existing bounded native engineering `cc_read`, `cc_glob`, and
`cc_grep` implementations through the common `POST /capabilities/invoke`
runtime.

Identity alignment: Level 1, stable user-space control plane.

## Demonstrated Gap

The dedicated native adapter routes already enforced workspace scope, traversal
protection, file-size/output/result limits, binary skipping, and hidden or
generated directory policy. The common capability registry and invoke route did
not list or dispatch those three capabilities, so callers had to bypass the
normal capability policy decision, invocation ledger, and capability event
stream.

## Implemented Behavior

The capability registry now exposes:

```text
sense.openclaw.engineering_tool.read
sense.openclaw.engineering_tool.glob
sense.openclaw.engineering_tool.grep
```

Each capability is a low-risk, body-internal, `audit_only` sensor. The runtime
dispatches directly to the existing native builders and preserves their
workspace and output bounds. Every invocation goes through the existing policy
evaluation, compact invocation ledger, `policy.evaluated`, and
`capability.invoked` event path.

The invocation ledger stores only the existing compact request and result
summary. File bodies and search match content remain in the current response
only; they are not copied into persisted capability history.

## Evidence

Runtime:

```text
services/openclaw-core/src/capability-descriptors.mjs
services/openclaw-core/src/capability-runtime.mjs
services/openclaw-core/src/capability-runtime-engineering-read-search.mjs
```

Focused tests:

```text
services/openclaw-core/test/capability-runtime.test.mjs
```

Real service evidence reuses the existing capability runtime milestone pair:

```text
nix/scripts/dev-capability-invoke-check.sh
nix/scripts/dev-observer-capability-invoke-check.sh
```

Observer reads the same capability registry and invocation history panels; no
new UI route or parallel audit surface is needed.

## Governance

```text
no approval is needed for the bounded local read-only sensors
all requests receive the normal policy decision
all successful and blocked results use the existing invocation ledger/events
workspace boundaries remain enforced by the native builders
no task, approval, write, command, LSP, provider, or network path is added
```

## Deferred

```text
unbounded filesystem reads or searches
write, edit, patch, or filesystem mutation
shell or verification command execution
automatic task or approval creation
LSP lifecycle expansion
provider calls and network egress
```

## Next Smallest Capability

The Level 1 read/search entry-point gap is closed. Do not add another evidence
wrapper; return to the smallest real Level 2 trusted work-view/session-helper
capability when its authority boundary is explicit. Keep workspace scope,
provider egress, root, and desktop-wide capture boundaries unchanged.

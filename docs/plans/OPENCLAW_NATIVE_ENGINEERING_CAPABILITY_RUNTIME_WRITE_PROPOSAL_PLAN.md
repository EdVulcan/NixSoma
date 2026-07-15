# OpenClaw Native Engineering Capability Runtime Write Proposal Plan

Updated: 2026-07-15

## Active Slice

Expose the existing bounded `cc_write` redacted diff-metadata proposal through
the common `POST /capabilities/invoke` runtime.

Identity alignment: Level 1, stable user-space control plane.

## Demonstrated Gap

The native write proposal builder already constrains workspace paths, content
size, existing-file reads, overwrite intent, redacted diff metadata, and the
approval-gated write bridge. Its dedicated route was governed, but a local
capability consumer could not request the same proposal through the common
policy, invocation ledger, and capability-event path.

## Implemented Behavior

The registry now exposes:

```text
act.openclaw.engineering_tool.write_proposal
```

The common handler delegates to the existing
`buildNativeEngineeringWriteProposal` owner. Proposal response data retains
only the builder's bounded redacted metadata; content text is not returned by
the write proposal. Invocation and audit evidence retain hashes, target state,
byte/line counts, and governance flags only.

## Governance

```text
audit-only proposal capability
workspace/path, content, existing-file, and overwrite bounds remain active
no filesystem write or overwrite
no task or approval creation
approval remains required before the existing write task
no command execution, provider call, credential read, or network egress
```

## Evidence

Runtime and tests:

```text
services/openclaw-core/src/capability-runtime-engineering-proposals.mjs
services/openclaw-core/src/capability-runtime.mjs
services/openclaw-core/test/capability-runtime.test.mjs
nix/scripts/dev-capability-invoke-check.sh
nix/scripts/dev-observer-capability-invoke-check.sh
```

The real core and Observer checks invoke a new-file proposal against a fixture,
verify redacted metadata, and prove the requested content is absent from the
response and audit event ledger.

## Deferred

```text
automatic proposal application
automatic task or approval creation
unbounded content, arbitrary selectors, shell commands, provider egress, and credentials
```

The existing explicit `workspace-text-write-tasks` route remains the approval
bridge and is unchanged by this common entry point.

## Next Smallest Capability

Keep `cc_edit`/`cc_write` proposal generation separate from mutation. Extend
common runtime access only when an existing approval bridge can carry a concrete
operator decision without persisting proposal content.

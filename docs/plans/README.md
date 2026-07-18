# NixSoma Plans Directory

Updated: 2026-07-18

This directory contains current decision records and historical milestone
evidence. It is not a queue ordered by phase number. Use
[`docs/README.md`](../README.md) for the current source, validation, deployment,
and route baseline.

## Active Decision Records

Only these documents should guide current route selection:

| Document | Decision owned |
| --- | --- |
| [`../OPENCLAW_FORWARD_WORK_DIRECTIVE.md`](../OPENCLAW_FORWARD_WORK_DIRECTIVE.md) | Mainline selection, anti-nesting rules, current physical-host boundary, and next real capability. |
| [`../architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md`](../architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md) | Level 1-4 identity progression and maturity baseline. |
| [`OPENCLAW_NATIVE_ENGINEERING_TOOL_SURFACE_PLAN.md`](./OPENCLAW_NATIVE_ENGINEERING_TOOL_SURFACE_PLAN.md) | Governed Level 1 engineering capability frontier. |
| [`OPENCLAW_TRUSTED_WORK_VIEW_SESSION_CONTRACT_PLAN.md`](./OPENCLAW_TRUSTED_WORK_VIEW_SESSION_CONTRACT_PLAN.md) | Bounded Level 2 browser/work-view contract. |
| [`OPENCLAW_INTERNAL_SERVICE_IDENTITY_PLAN.md`](./OPENCLAW_INTERNAL_SERVICE_IDENTITY_PLAN.md) | Operator identity, per-service credentials, and execution grants. |
| [`OPENCLAW_DBUS_NATIVE_SYSTEMD_CONTROL_PLAN.md`](./OPENCLAW_DBUS_NATIVE_SYSTEMD_CONTROL_PLAN.md) | Fixed Level 3 restart owners and bounded journal diagnosis. |
| [`OPENCLAW_SYSTEMD_INCIDENT_AI_HANDOFF_PLAN.md`](./OPENCLAW_SYSTEMD_INCIDENT_AI_HANDOFF_PLAN.md) | Exact request-bound, guidance-only AI diagnosis from a compact terminal repair receipt. |
| [`OPENCLAW_PHASE_D_DECLARATIVE_EVOLUTION_CANDIDATE_PLAN.md`](./OPENCLAW_PHASE_D_DECLARATIVE_EVOLUTION_CANDIDATE_PLAN.md) | Declarative-evolution evidence and deferred activation boundary. |
| [`OPENCLAW_EXPERT_REVIEW_OPTIMIZATION_PLAN.md`](./OPENCLAW_EXPERT_REVIEW_OPTIMIZATION_PLAN.md) | Measured validation, runtime, and review debt that blocks the mainline. |

The kernel whitepaper remains the long-horizon authority:
[`KERNEL_LEVEL_EVOLUTION_WHITEPAPER.md`](../architecture/KERNEL_LEVEL_EVOLUTION_WHITEPAPER.md).

## Current Route

Completed capability families must not be reopened for another wrapper,
readiness marker, readback mirror, or horizontal variant. The completed Level 3
diagnosis route is:

```text
bound Event Hub audit-log memory and retention
-> combine body health with bounded journal diagnosis
-> reuse the existing fixed restart owner
-> verify post-repair health
-> expose task and Observer evidence
-> project the compact terminal receipt through the approved DeepSeek handoff
-> return one transient structured recommendation
```

This route advances the Level 3 body loop without widening hostd authority and
without introducing a new provider response schema. The immediate next real
capability is local, bounded incident experience recall through the existing
advisory memory owner. Real generation activation, rollback, arbitrary systemd
control, desktop-wide capture, and automatic provider egress remain deferred.

## Completed Capability Evidence

The following plan families are retained because they describe implemented
contracts or are referenced by milestone scripts:

- Enhanced-source gap audit and native read/search/edit/write/verify/recovery.
- Engineering planning, todo, workbench restoration, and microcompact context.
- LSP lifecycle, bounded symbol requests, target selection, and verification
  recovery.
- Trusted work-view association, control, semantic action, and recovery.
- Provider context packets, explicit DeepSeek handoff, and structured plan
  recommendation.
- Plugin runtime refresh and ACPX/Codex compatibility contracts.
- Phase A Nix-store packaging, Phase B fixed systemd control, Phase C eBPF
  observation, and Phase D declarative-evolution evidence.

Their `Next Slice` sections record historical decisions. They do not override
the current route above.

## Historical Migration Records

These remain useful source evidence but are not active next-work instructions:

| Document | Historical role |
| --- | --- |
| [`OPENCLAW_ENHANCED_SOURCE_MIGRATION_BRIEF.md`](./OPENCLAW_ENHANCED_SOURCE_MIGRATION_BRIEF.md) | Preserved enhanced-source inventory and migration constraints. |
| [`OPENCLAW_ENHANCED_SOURCE_GAP_AUDIT.md`](./OPENCLAW_ENHANCED_SOURCE_GAP_AUDIT.md) | Completed capability classification and migration evidence. |
| [`OPENCLAW_SOURCE_INTEGRATION_STAGE_PLAN.md`](./OPENCLAW_SOURCE_INTEGRATION_STAGE_PLAN.md) | Earlier source-integration stage log. |
| [`OPENCLAW_POST_MVP_PLAN.md`](./OPENCLAW_POST_MVP_PLAN.md) | Earlier post-MVP route selection. |

## Numbered Phase Plans

`OPENCLAW_PHASE_*_PLAN.md` files are retained because milestone scripts and
runtime evidence still reference them. They are historical check fixtures, not
the live roadmap. Do not delete, rename, or move them until every dependent
registry and script has migrated.

## Plan Creation Rule

- Prefer updating an active decision record.
- Create a plan only for a real capability with a distinct owner and proof.
- Do not create a numbered plan for documentation cleanup, readiness wording,
  or another mirror of existing evidence.
- State `delivered`, `evidence`, `deferred`, and `next real capability` at
  closure.
- Move completed guidance into historical evidence by changing the index, not
  by deleting referenced files.

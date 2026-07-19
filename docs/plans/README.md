# NixSoma Plans Directory

Updated: 2026-07-19

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
| [`OPENCLAW_DBUS_NATIVE_SYSTEMD_CONTROL_PLAN.md`](./OPENCLAW_DBUS_NATIVE_SYSTEMD_CONTROL_PLAN.md) | Fixed Level 3 restart owners, bounded journal diagnosis, resource-pressure sensing, and declarative cgroup envelopes. |
| [`OPENCLAW_SYSTEMD_INCIDENT_AI_HANDOFF_PLAN.md`](./OPENCLAW_SYSTEMD_INCIDENT_AI_HANDOFF_PLAN.md) | Exact request-bound, guidance-only AI diagnosis from a compact terminal repair receipt. |
| [`OPENCLAW_SYSTEMD_INCIDENT_EXPERIENCE_MEMORY_PLAN.md`](./OPENCLAW_SYSTEMD_INCIDENT_EXPERIENCE_MEMORY_PLAN.md) | Local target-specific outcome absorption and advisory recall from verified incident receipts. |
| [`OPENCLAW_SYSTEMD_INCIDENT_LEARNED_PROVIDER_CONTEXT_PLAN.md`](./OPENCLAW_SYSTEMD_INCIDENT_LEARNED_PROVIDER_CONTEXT_PLAN.md) | Up to three matching-target learned patterns inside the existing exact approved diagnosis request. |
| [`OPENCLAW_SYSTEMD_INCIDENT_REVIEWED_ACTION_PLAN.md`](./OPENCLAW_SYSTEMD_INCIDENT_REVIEWED_ACTION_PLAN.md) | Reviewed read-only opening of the exact incident receipt and recovery evidence bound to provider guidance. |
| [`OPENCLAW_SYSTEMD_INCIDENT_REVIEWED_REFRESH_PLAN.md`](./OPENCLAW_SYSTEMD_INCIDENT_REVIEWED_REFRESH_PLAN.md) | Reviewed same-unit refresh of existing health, fixed-unit inventory, and bounded journal evidence. |
| [`OPENCLAW_SYSTEMD_INCIDENT_OBSERVATION_RECEIPT_PLAN.md`](./OPENCLAW_SYSTEMD_INCIDENT_OBSERVATION_RECEIPT_PLAN.md) | Compact hash-bound evidence from the reviewed same-unit observation refresh. |
| [`OPENCLAW_SYSTEMD_OBSERVATION_AI_HANDOFF_PLAN.md`](./OPENCLAW_SYSTEMD_OBSERVATION_AI_HANDOFF_PLAN.md) | Exact approval-bound AI diagnosis and reviewed readback from the compact observation receipt. |
| [`OPENCLAW_FIXED_UNIT_INCIDENT_SCHEDULER_PLAN.md`](./OPENCLAW_FIXED_UNIT_INCIDENT_SCHEDULER_PLAN.md) | Periodic local observation and restart-safe deduplicated incident tasks for fixed units. |
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
-> retain and recall one bounded local matching-target incident pattern
-> bind up to three prior matching patterns into the approved diagnosis request
-> review provider guidance and open the exact bound incident evidence
-> review provider guidance and refresh same-unit read-only observation
-> persist one compact hash-bound local observation receipt
-> create one exact approval-bound diagnosis from that receipt
-> review the exact observation task without recursive refresh
-> periodically observe the three fixed hostd targets locally
-> create one compact completed task per new failure fingerprint
-> automatically bind the current incident to the existing local repair draft
-> create one completed triage evidence task without approval or execution
-> automatically promote that triage into one pending fixed-target repair approval
-> require explicit operator approval or denial
-> after approval, reserve and dispatch that exact task once through Executor
-> preserve the existing post-repair health and incident receipt
-> fail a non-terminal dispatch reservation closed after Core restart
```

This route advances the Level 3 body loop without widening hostd authority and
without introducing a new provider response schema. The deployed baseline is
proven through non-mutating health, auth, scheduler, and Observer probes, and
automatic local triage, pending repair promotion, approval-triggered one-shot
dispatch, and fail-closed restart reconciliation are deployed in generation
`/nix/store/yzjwwp67apgv4rrzpm3g2gz12bqkq7vj-nixos-system-nixos-26.05.4808.569d57850992`.
Non-mutating health, auth, scheduler, live-closure, and Observer probes passed;
the first post-switch tick observed all fixed targets healthy without changing
task or approval counts. Freeze this lane and select a distinct concrete
whitepaper capability. Real hostd mutation, generation rollback, arbitrary
systemd control, desktop-wide capture, and automatic provider egress remain
deferred.

The bounded resource-pressure route and its declarative envelope are complete
in source. The native inventory and Observer retain the fixed read-only
telemetry and four-sample trend. The desktop Nix profile adds independent
`openclaw-body.slice` and `openclaw-session.slice` envelopes, each with 1.5 GiB
`MemoryHigh`, 3 GiB `MemoryMax`, and `TasksMax=1024`; hostd and credential
initializers remain excluded. Physical-host generation `9bbc00da...` is now
deployed and read-only probed. It also preconfigures the fixed DeepSeek
endpoint/model with live egress disabled and no secret dependency. Current
generation `6dm12j7...` delivers the root-only API key through Core
`LoadCredential` and has completed one request-bound, explicitly approved real
advisory call. Both slices and all assigned services remain active; health,
restart-count, auth, failed-unit, and warning journal probes passed. Freeze the
resource and provider-transport lanes. Do not synthesize memory pressure on the
only physical host. The bounded standing advisory policy is now complete in
source and validated through the common capability runtime. It cannot accept a
caller prompt/model/context, create a task or approval, execute a recommendation,
or mutate the host. Generation `czq8arvh...` now deploys it, and one real
459-token call returned `observe_current_screen` without changing task or
approval counts. Audit and persistent hashes matched, and service health stayed
green. Freeze this lane and select a distinct whitepaper capability instead of
opening another readiness phase or provider-call surface.

The selected active route is now Level 4 graphical identity:

```text
login-user systemd owner
-> isolated Weston headless compositor
-> fixed nixsoma-ai-0 Wayland socket
-> existing session resource envelope
-> session-manager ownership/health evidence
-> Observer readback with explicit negative authority
-> physical-host coexistence proof with GNOME wayland-0 (complete)
-> AI-owned browser attachment as the next real slice
```

The current source stops before browser attachment, pixel capture, input,
projection, desktop-wide observation, root, host mutation, or network access.
Do not reopen the completed provider or Level 2 action lanes while this Level 4
vertical capability is incomplete.

Generation `kxv2ypwp...` completed the coexistence proof with a current-user
`0700` nested runtime/socket, no parent display environment or DRM handle, about
14 MiB memory, one task, zero restarts, unchanged GNOME PID, and unchanged
`wayland-0`. Session-manager reports `ready` and Observer serves the bounded
Level 4 readback. Browser attachment is now the active missing vertical step.

The attachment implementation is now source-validated. Browser-runtime owns a
fixed nested-Wayland binding, validates the compositor socket before launch,
starts the existing Nix Firefox headed with a credential-free child environment,
and returns compact attachment through existing state. Session-manager and
Observer reuse the existing Level 4 readback. A real isolated Puppeteer probe
opened and closed a nested page without changing GNOME. The remaining gate is a
reviewed generation switch and live proof through the existing Level 2 capture,
lease, action, audit, and recovery path; do not open another graphics evidence
wrapper before that proof.

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

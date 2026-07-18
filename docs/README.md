# NixSoma Documentation Control Room

Updated: 2026-07-18

This is the canonical entry point for current NixSoma development. Historical
OpenClaw names remain in service identifiers, environment variables, milestone
registries, and evidence documents because they are compatibility contracts.

Do not select work from the largest phase number or an old `Next Slice`
paragraph. Reconcile this baseline with the repository and live host first.

## Current Baseline

| Layer | Evidence at this checkpoint | Status |
| --- | --- | --- |
| Capability source | Current `main` through the Level 3 fixed-unit incident scheduler, automatic local triage/promotion, and approval-triggered one-shot repair dispatch | Implemented; commit history is authoritative |
| Local validation | 884 workspace tests and typecheck pass; body-config and event-audit integration pass; 811 registry entries pass | Validated |
| Installed system | NixOS `26.05.4808.569d57850992`, generation `/nix/store/gb72w3qavm6b0vv114ml723g7y8jv5qh-nixos-system-nixos-26.05.4808.569d57850992` | Current source baseline deployed 2026-07-18 |
| Deployed journal probe | Bounded `/system/systemd/journal-evidence` returns live read-only JSON; `openclaw-system-sense` has the `systemd-journal` supplementary group | Deployed and probed |
| Deployed scheduler | First five-minute tick recorded all three fixed targets healthy with no incident task | Deployed and probed |
| Deployed audit store | Current Event Hub package is active; retention and rotation remain source-validated without destructive live rehearsal | Deployed |
| Privileged actions | Physical-host generation switch is proven; real repair, hostd activation, and rollback | Deferred to explicit/disposable mutation checks |

The current checkout is on the only available physical host
(`systemd-detect-virt=none`). Historical VM results remain acceptance evidence,
not an available execution environment.

## Start Here

Read in this order:

1. [Forward Work Directive](./OPENCLAW_FORWARD_WORK_DIRECTIVE.md)
2. [System Identity Upgrade Path](./architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md)
3. [Kernel-Level Evolution Whitepaper](./architecture/KERNEL_LEVEL_EVOLUTION_WHITEPAPER.md)
4. [Native Engineering Tool Surface](./plans/OPENCLAW_NATIVE_ENGINEERING_TOOL_SURFACE_PLAN.md)
5. [D-Bus And Fixed Systemd Control](./plans/OPENCLAW_DBUS_NATIVE_SYSTEMD_CONTROL_PLAN.md)
6. [Phase D Declarative Evolution](./plans/OPENCLAW_PHASE_D_DECLARATIVE_EVOLUTION_CANDIDATE_PLAN.md)
7. [Plans Directory Guide](./plans/README.md)

The enhanced-source migration brief and gap audit are retained as source and
migration evidence. They are no longer instructions to repeat preservation or
the initial capability audit.

## Current Frontier

The completed bounded frontier is:

- Level 1 operator authentication, sensitive-read protection, per-service
  identity, exact execution grants, reservation recovery, and governed
  engineering read/edit/write/verify/recovery workflows.
- Level 2 trusted browser/work-view observation, semantic action, takeover,
  recovery, and Observer control within the bounded AI-owned workspace.
- Level 3 independent hostd ownership, exact Polkit and peer boundaries, three
  fixed systemd repair targets, read-only eBPF process evidence, bounded journal
  diagnosis, and target-specific post-repair application health receipts in
  source.
- Phase D candidate generation, approval-bound staging/build, real closure
  receipt, independent host-health oracle, controlled activation contract,
  manual rollback evidence, and a physical-host-safe failure rehearsal.
- Explicitly approved DeepSeek context handoff and structured engineering-plan
  recommendation without automatic task creation, execution, or provider use.
- Exact request-bound DeepSeek diagnosis handoff for a verified terminal
  systemd incident receipt, with journal messages and private runtime details
  excluded and no recommendation-driven repair authority.
- Local target-specific incident experience recording and recall through the
  existing advisory Context Packet and Observer owners.
- Up to three safe prior matching-target patterns inside the exact approved
  incident diagnosis request, with execution-time drift rejection.
- One operator-reviewed provider action that opens only the exact bound terminal
  incident receipt and recovery evidence in existing Observer task detail.
- One operator-reviewed provider action that refreshes body health, fixed-unit
  inventory, and bounded journal evidence for that exact incident unit.
- One compact hash-bound local receipt for that reviewed observation, excluding
  journal messages and provider output and carrying no repair authority.
- One operator-created, approval-bound fresh diagnosis from that observation
  receipt, with execution-time drift rejection and exact observation readback.
- One five-minute local scheduler for the three fixed hostd targets, with
  compact audited incident tasks, restart-safe dedupe, recovery re-arming, and
  existing Observer task-detail visibility.
- Automatic local triage that binds each current scheduler incident's source
  task, fingerprint, and fixed unit to the existing read-only repair draft and
  creates or reuses a completed evidence task without approval or execution.
- Automatic repair promotion that revalidates the triage/source/current
  scheduler chain and creates or reuses the existing fixed-target real repair
  task with one pending approval, without approval resolution or hostd
  invocation.
- One approval-triggered dispatch coordinator that revalidates and reserves the
  exact automatic repair task, then enters the existing Executor once with
  automatic recovery disabled. The systemd handler rejects automatic tasks
  without that reservation.
- Restart reconciliation that aligns terminal dispatch state and fails every
  missing or non-terminal reservation closed without Executor/hostd replay.

Real repair execution and rollback remain unproven on a disposable mutation
environment. Level 4 graphics-stack ownership remains future work.

## Active Route

The Event Hub development-log blocker is closed in validated source. Tail
queries read fixed-size blocks newest-first, summaries stream once and then
update incrementally, writes rotate at 64 MiB, and eight rotated segments are
retained by default. A legacy oversized segment is preserved on first rotation
instead of being silently truncated. Against the current 438 MiB development
log, a 200-event tail query took about 41 ms and the first full summary about
1.9 s with roughly 20 MiB heap; a cached repeat took 0 ms.

The Level 3 incident and guidance loop is complete in source:

```text
body health + bounded journal evidence
-> bounded diagnosis
-> existing fixed restart owner
-> post-repair health verification
-> task and Observer evidence
-> approved compact incident handoff
-> transient engineering_recommendation_v0 guidance
-> local matching-target incident experience recall
-> approved diagnosis informed by bounded prior outcomes
-> reviewed opening of the exact bound incident evidence
-> reviewed same-unit read-only observation refresh
-> compact hash-bound local observation receipt
-> exact approval-bound observation diagnosis
-> reviewed opening of the exact observation task
-> periodic local fixed-unit observation
-> deduplicated completed incident task in Observer
-> automatic local triage bound to the current repair draft
-> automatic promotion into one pending fixed-target repair approval
-> explicit operator approval or denial
-> one-shot approved dispatch through the existing fixed hostd executor
-> post-repair health and incident receipt
```

Do not broaden hostd into arbitrary systemd control or add another provider
readiness wrapper. The validated source baseline is now deployed: all service
health probes returned 200, anonymous protected reads/mutations returned 401,
the journal endpoint is live, Observer contains both incident controls, and the
first scheduler tick observed all fixed targets healthy. Automatic low-risk
local triage, pending repair promotion, one-shot dispatch after explicit
approval, and fail-closed restart reconciliation are complete in source. This
source baseline is not deployed. The next gate is an explicitly authorized
physical-host switch followed only by non-mutating health, auth, scheduler, and
Observer probes; real repair and generation rollback remain deferred to an
explicit/disposable mutation check.

## Progress Estimate

These figures are capability-maturity estimates, not test coverage:

| Scope | Current estimate |
| --- | --- |
| Level 1 user-space control plane | about 90% |
| Level 2 bounded trusted work view | 95-100% |
| Level 3 controlled system body | about 50% |
| Level 4 graphics-stack-native body | 0-5% |
| Current bounded product scope | 75-80% |
| Final whitepaper vision | 45-55% |

## Current Decision Records

| Document | Role |
| --- | --- |
| [OPENCLAW_NATIVE_ENGINEERING_TOOL_SURFACE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_TOOL_SURFACE_PLAN.md) | Completed Level 1 governed engineering capability frontier and remaining boundaries. |
| [OPENCLAW_TRUSTED_WORK_VIEW_SESSION_CONTRACT_PLAN.md](./plans/OPENCLAW_TRUSTED_WORK_VIEW_SESSION_CONTRACT_PLAN.md) | Completed bounded Level 2 browser/work-view contract. |
| [OPENCLAW_INTERNAL_SERVICE_IDENTITY_PLAN.md](./plans/OPENCLAW_INTERNAL_SERVICE_IDENTITY_PLAN.md) | Current operator, service identity, and execution-grant boundary. |
| [OPENCLAW_DBUS_NATIVE_SYSTEMD_CONTROL_PLAN.md](./plans/OPENCLAW_DBUS_NATIVE_SYSTEMD_CONTROL_PLAN.md) | Current fixed Level 3 restart and journal-diagnosis boundary. |
| [OPENCLAW_SYSTEMD_INCIDENT_AI_HANDOFF_PLAN.md](./plans/OPENCLAW_SYSTEMD_INCIDENT_AI_HANDOFF_PLAN.md) | Completed exact request-bound incident diagnosis handoff and provider boundary. |
| [OPENCLAW_SYSTEMD_INCIDENT_EXPERIENCE_MEMORY_PLAN.md](./plans/OPENCLAW_SYSTEMD_INCIDENT_EXPERIENCE_MEMORY_PLAN.md) | Completed local incident outcome absorption and matching-target advisory recall. |
| [OPENCLAW_SYSTEMD_INCIDENT_LEARNED_PROVIDER_CONTEXT_PLAN.md](./plans/OPENCLAW_SYSTEMD_INCIDENT_LEARNED_PROVIDER_CONTEXT_PLAN.md) | Completed learned-pattern inclusion in the exact approved incident diagnosis request. |
| [OPENCLAW_SYSTEMD_INCIDENT_REVIEWED_ACTION_PLAN.md](./plans/OPENCLAW_SYSTEMD_INCIDENT_REVIEWED_ACTION_PLAN.md) | Completed reviewed read-only opening of provider-bound incident evidence. |
| [OPENCLAW_SYSTEMD_INCIDENT_REVIEWED_REFRESH_PLAN.md](./plans/OPENCLAW_SYSTEMD_INCIDENT_REVIEWED_REFRESH_PLAN.md) | Completed reviewed same-unit health, inventory, and bounded journal refresh. |
| [OPENCLAW_SYSTEMD_INCIDENT_OBSERVATION_RECEIPT_PLAN.md](./plans/OPENCLAW_SYSTEMD_INCIDENT_OBSERVATION_RECEIPT_PLAN.md) | Completed compact hash-bound local evidence for the reviewed observation. |
| [OPENCLAW_SYSTEMD_OBSERVATION_AI_HANDOFF_PLAN.md](./plans/OPENCLAW_SYSTEMD_OBSERVATION_AI_HANDOFF_PLAN.md) | Completed approval-bound diagnosis and reviewed readback for the observation receipt. |
| [OPENCLAW_FIXED_UNIT_INCIDENT_SCHEDULER_PLAN.md](./plans/OPENCLAW_FIXED_UNIT_INCIDENT_SCHEDULER_PLAN.md) | Completed periodic local observation and deduplicated incident task creation for fixed units. |
| [OPENCLAW_PHASE_C_KERNEL_PROCESS_EXEC_PLAN.md](./plans/OPENCLAW_PHASE_C_KERNEL_PROCESS_EXEC_PLAN.md) | Completed first bounded read-only kernel event slice. |
| [OPENCLAW_PHASE_D_DECLARATIVE_EVOLUTION_CANDIDATE_PLAN.md](./plans/OPENCLAW_PHASE_D_DECLARATIVE_EVOLUTION_CANDIDATE_PLAN.md) | Current declarative-evolution evidence and explicitly deferred activation boundary. |
| [OPENCLAW_MONOLITH_REDUCTION_PLAN.md](./plans/OPENCLAW_MONOLITH_REDUCTION_PLAN.md) | Active coupling and maintainability debt record. |
| [OPENCLAW_EXPERT_REVIEW_OPTIMIZATION_PLAN.md](./plans/OPENCLAW_EXPERT_REVIEW_OPTIMIZATION_PLAN.md) | Active validation and expert-review debt record. |

## Windows Checkout Path Policy

Run `bash nix/scripts/dev-windows-path-budget-check.sh` before committing. The
repository-relative path budget is 160 characters. Public milestone names,
capability IDs, endpoint paths, and audit tokens remain unchanged; only physical
filenames may use manifest-backed short aliases.

Use a short checkout directory on Windows. `git -c core.longpaths=true clone`
may add headroom, but it is not a substitute for the repository path budget.

## Historical Evidence

The files under `docs/plans/` include historical phase plans referenced by
milestone scripts. Do not delete, rename, or move them until those references
are migrated. Historical `Next Slice` sections are evidence of earlier route
decisions, not current instructions.

Useful historical indexes:

- [Enhanced Source Migration Brief](./plans/OPENCLAW_ENHANCED_SOURCE_MIGRATION_BRIEF.md)
- [Enhanced Source Gap Audit](./plans/OPENCLAW_ENHANCED_SOURCE_GAP_AUDIT.md)
- [MVP Demo Guide](./guides/OPENCLAW_MVP_DEMO_GUIDE.md)
- [Handover Summary](./HANDOVER_SUMMARY.md)

## Documentation Policy

- Update this baseline when capability source and installed generation diverge.
- Keep one active route and one next real capability.
- Prefer updating an existing decision record over creating a numbered phase.
- Mark completed plans as historical evidence instead of leaving them Active.
- Record source, validation, deployment, and privileged-mutation status
  separately.

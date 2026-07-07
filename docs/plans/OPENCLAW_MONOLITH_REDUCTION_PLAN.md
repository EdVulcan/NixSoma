# OpenClaw Coupling Reduction Plan

Created after Phase 116. Updated after the first live-provider runtime
extraction slices and milestone registry/audit slices.

## Audit Policy

Line count is no longer a decision metric.

The project should reduce files and workflows that bundle unrelated
responsibilities, require repeated hand synchronization, or make one small
feature touch many stateful surfaces. A large cohesive domain module can be
acceptable temporarily. A smaller file should still be split when it mixes
route dispatch, state mutation, approval logic, UI ids, validation fixtures, or
milestone orchestration.

Primary coupling signals:

- Mixed responsibilities in one module.
- Hand-synchronized tokens across core routes, runtime builders, task
  executors, Observer panels, DOM selectors, refreshers, startup timers, and
  milestone scripts.
- State, approval, event, and persistence operations interleaved with route or
  presentation code.
- Recursive milestone checks that rebuild long prerequisite chains when an
  artifact could prove the prerequisite safely.
- Changes that require broad validation because ownership boundaries are not
  explicit.

Audit sources used for this revision:

- Core static scan and read-only subagent audit of `services/openclaw-core` and
  shared packages.
- Observer UI static scan and read-only subagent audit of HTML, DOM selectors,
  refreshers, runtime actions, and startup polling.
- `nix/scripts` and docs read-only subagent audit of recursive common-checks,
  artifact naming, observer/core drift, and milestone registry coupling.

## Completed Coupling Work

1. Extracted live-provider governance helpers from
   `services/openclaw-core/src/cloud-live-provider-runtime-implementation.mjs`.
2. Extracted Phase 115-116 local-read task shell runtime into a focused module.
3. Extracted Phase 111-114 result-envelope creation execution attempt runtime
   into a focused module.
4. Extracted Phase 107-110 result-envelope creation execution runtime into a
   focused module.
5. Extracted Phase 103-106 result-envelope creation runtime into a focused
   module.
6. Externalized the milestone runner registry into
   `nix/scripts/dev-milestone-checks.tsv` with registry validation and
   `@changed` affected-check selection.
7. Added a milestone script taxonomy audit for script counts, registry
   coverage, long filename pressure, and unregistered non-common check scripts.
8. Added a Phase 99-116 live-provider result-envelope milestone manifest that
   statically proves registry rows, phase plans, core wrappers, Observer
   wrappers, and common checks still align with one metadata source.
9. Replaced the 36 Phase 99-116 core/Observer wrapper bodies with a shared
   manifest-driven wrapper helper while preserving every public script filename
   and registry entry.
10. Extended the Phase 99-116 manifest check to derive each phase primary
    registry and verify the repeated common-check registry inputs.
11. Extended the same manifest check to derive and verify the repeated
    route/approved/final-readiness/task-shell status markers in common checks.
12. Extended the manifest check to derive and verify the repeated Phase 99-116
    core/system-heal state artifact filenames in common checks.
13. Extracted the repeated Phase 99-116 common-check environment setup into a
    manifest-driven helper for ports, plan docs, state artifacts, and core /
    Observer URLs.
14. Extracted the repeated Phase 99-116 fast prerequisite reuse setup into a
    bounded helper while preserving each milestone's local service assertions
    and fallback predecessor script.

These slices reduced live-provider runtime and milestone orchestration coupling
while preserving the public runtime API and existing milestone entry names.

## High-Coupling Hotspots

| Priority | Area | Coupling Evidence | Safe First Boundary |
| --- | --- | --- | --- |
| P0 | `nix/scripts` late credential-value/result-envelope phase chain | Phase number, slug, predecessor, artifact path, registry, status marker, docs token, observer token, endpoint, and `next.recommendedSlice` are repeated across the Phase 99-116 chain. Partial fast-prereq reuse means validation speed and evidence quality depend on per-script string wiring. | Introduce a metadata table for Phases 99-116 and keep existing scripts as shims. First proof should statically compare metadata to current script/doc strings, then run representative phases 100, 108, and 116 in full and fast modes. |
| P0 | `services/openclaw-core/src/route-handlers.mjs` | Core HTTP dispatch, proxying, phase route mapping, plugin routes, task POST routes, approval surfaces, and workspace/body routes are all in one request chain. Route tokens must be hand-synced with runtime exports, Observer refreshers, and milestone scripts. | Add a route group registration layer while keeping `registerRoutes(deps)` stable. Start with the live-provider credential POST cluster because branches share `{ confirm }` parsing and `201` response shape. |
| P0 | `services/openclaw-core/src/task-executor.mjs` | Execution dispatch imports many `is...Task`/`execute...Task` pairs and uses a long ordered branch chain for systemd, body evidence, plugins, workspace commands, long-term memory, and cloud live-provider tasks. | Introduce a task execution registry keyed by predicate/handler. Start with cloud live-provider handlers so `executeTaskWithRecovery` can iterate a table instead of growing branches. |
| P0 | Observer UI startup and panel synchronization (`client-script-startup.mjs`, `server.mjs`, `client-script-config-dom.mjs`, `client-script-refreshers-cloud.mjs`) | Current contracts are internally consistent, but adding one panel requires matching HTML ids, DOM constants, refresh function, startup call, interval, and milestone token checks. Startup hard-codes every refresher twice: initial `await` sequence and `setInterval` registry. | Introduce a refresh descriptor list grouped by surface and generate startup calls/intervals from it. Then add grouped DOM descriptors for one cloud lane while preserving legacy aliases. |
| P1 | `services/openclaw-core/src/plan-builder.mjs` | Plugin plans, runtime activation, systemd repair, body evidence, long-term memory, cloud live-provider wiring, policy intent, task creation, approval creation, event publishing, and system-sense fetches share one builder. | Extract the capability registry/invocation slice first: `baseCapabilities`, backend dispatch, result summarization, invocation logging, and registry build behind the same public return names. |
| P1 | `services/openclaw-core/src/cloud-live-provider-runtime-implementation.mjs` | Still mixes early live-provider route/task lanes with registry constants, approval gates, task phase mutation, persistence, event publication, and repeated deferred execution envelopes. Recent extraction reduced the worst phase-lane coupling. | Continue lane extraction only where it removes cross-phase coupling. Next cohesive target is Phase 99-102 result-envelope route/task/approved-deferred/final-readiness. Separately consider an approved-deferred lifecycle helper that preserves status strings. |
| P1 | `services/openclaw-system-sense/src/server.mjs` | HTTP server, filesystem operations, command execution, process listing, service discovery, health trends, route-aware recommendations, systemd inventory/dependency maps, and body evidence route reviews share one service file. | Extract system-sense domain modules behind stable endpoints: filesystem ops, command/process ops, health/systemd sensing, body-evidence route builders. |
| P1 | `services/openclaw-core/src/plugin-review.mjs` | Plugin contract review, source review, native adapter checks, capability planning, runtime activation checks, and policy/approval evidence are bundled together. | Split review surfaces into contract/source/runtime/capability modules. Keep public plugin review methods stable. |
| P1 | `services/openclaw-core/src/task-manager.mjs` | Task serialization manually knows domain-specific extension fields, recovery predicates, phase histories, persistence, and lifecycle events. Every new task family risks adding another top-level serialization field by hand. | Add a local `TASK_EXTENSION_FIELDS` descriptor used by serialization and creation while preserving today's top-level output keys. |
| P1 | `nix/scripts` milestone script taxonomy | The runner registry is externalized, but common/core/observer scripts still grow by hand and include long filenames, unregistered helper checks, and repeated shell wiring. | Use the `milestone-script-audit` artifact as the baseline, then add metadata-generated shims for the repeated Phase 99-116 live-provider chain before deleting or renaming legacy scripts. |
| P2 | `apps/observer-ui/src/client-script-runtime-actions.mjs` | Runtime action handlers combine form reads, fetch calls, approval flows, command/workspace actions, event-to-refresh fan-out, task focus state, and display updates. | Extract an event-to-refresh map and button-action registration table while preserving global function names. |
| P2 | `services/openclaw-core/src/workspace-ops.mjs` | Target resolution, patch parsing, diff preview, proposals, source-derived proposals, policy metadata, task creation, approval, and event publication share one operational surface. | Split pure patch/diff/proposal builders from task materializers. Keep registry strings and task payload shape unchanged. |
| P2 | Shared plugin contract (`packages/shared-types/src/plugin-registry.mjs`, `plugin-contract.mjs`) | Native capability IDs and validators are small but drive plan-builder capability mapping, plugin review, workspace ops, route behavior, executor handling, and milestone assertions. | Move capability descriptors into a data module while preserving `createOpenClawNativePluginRegistry` and exact capability IDs. |

## Deprioritized By Coupling

- Long docs are not refactor targets unless they cause process drift.
- Files under any line threshold are not automatically acceptable.
- Files over any line threshold are not automatically bad when they own one
  cohesive domain and have stable validation.

## Refactor Order

1. Finish reducing active live-provider lane coupling while it remains the
   current development surface.
2. Use the active credential/result-envelope manifest to extract repeated
   assertion helpers so validation no longer depends on hand-repeated docs,
   Observer, and state JSON assertions.
3. Split `route-handlers.mjs` by domain so future phases do not keep editing
   one router chain.
4. Split `task-executor.mjs` dispatch so new task types register through a
   domain table instead of a global branch chain.
5. Add Observer startup/panel/selector descriptors to stop HTML/DOM/refresher/startup
   drift.
6. Add broader milestone phase descriptors and shared assertion helpers to reduce slow,
   recursive, hand-written validation scripts.
7. Split `plan-builder.mjs`, `plugin-review.mjs`, and `openclaw-system-sense`
   after the active provider lane no longer forces changes through the current
   monoliths.

## Minimum Proof For Each Slice

- The extracted boundary has one clear responsibility.
- Public entry points remain stable or are explicitly shimmed.
- No new replacement module bundles unrelated domains.
- `npm run typecheck` and `npm run build` pass for JavaScript changes.
- A focused milestone or regression check exercises the moved behavior.
- Validation notes state whether fast prerequisite reuse or full-chain
  validation was used.

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
15. Replaced the hand-written Phase 99-116 core / Observer milestone registry
    rows with manifest-generated registry directives, preserving public check
    names while reducing duplicated TSV wiring.
16. Scoped Unix dev service lifecycle state by explicit run id while preserving
    default legacy state / pid / log compatibility, enabling parallel and batch
    validation without global process killing.
17. Added a Phase 99-102 result-envelope batch validation lane that starts one
    scoped service stack and reuses it across adjacent core and Observer checks.
18. Confirmed `task-executor.mjs` now uses a `NON_RECOVERABLE_TASK_HANDLERS`
    predicate/handler registry instead of the previous long task branch chain.
19. Extracted the Phase 99-115 result-envelope GET route cluster from
    `route-handlers.mjs` into a focused route group module while preserving all
    public endpoint paths and builder names.
20. Extracted the live-provider credential POST route cluster from
    `route-handlers.mjs` into a focused table-driven route group module. The
    main router now delegates these public POST endpoints through one cohesive
    handler while preserving confirm parsing, task / approval serialization,
    raw preflight task envelopes, and response status codes.
21. Extracted the earlier live-provider task / preflight POST route cluster
    into a second focused route group. Both live-provider POST groups now share
    a small confirm-POST response-envelope helper so future route extraction
    does not copy error handling, `{ confirm }` parsing, task serialization, or
    approval serialization.
22. Extracted the Observer/core read-model GET route cluster for capabilities,
    capability invocation history, command transcripts, filesystem changes, and
    filesystem reads into a focused read-only route group. The main router keeps
    mutable capability refresh/invoke routes local while the extracted module
    preserves public endpoint paths, limit semantics, summary serializers, and
    response status codes.
23. Extracted the approval inbox/action route family from the main router into
    a focused approval route module. The module owns `/approvals`,
    `/approvals/summary`, `/approvals/:id/approve`, and `/approvals/:id/deny`
    while preserving status filtering, limit clamping, default actor/reason
    text, approval events, denied-task failure events, task serialization, and
    response status codes.
24. Extracted the operator/control route family into a focused autonomous
    control module. The module owns `/operator/state`, `/operator/step`,
    `/operator/run`, `/control/pause`, `/control/resume`, `/control/takeover`,
    and `/control/stop` while preserving operator loop response shapes, task
    serialization, runtime state responses, phase updates, takeover metadata,
    and task lifecycle events.
25. Extracted the task read/lifecycle route family into a focused task route
    module. The module owns task summary/active/focus/list/detail endpoints,
    task creation, planning, planned execution, direct execution, recovery,
    phase updates, work-view attachment, and completion while preserving task
    events, approval publication hooks, default task input values, recovery
    conflict semantics, execution serialization, and runtime state responses.
26. Extracted the system/body/memory/cloud task POST cluster into a table-driven
    domain task route module. The module owns systemd repair task creation,
    body evidence ledger task shells and append arming, long-term memory write
    task creation, and early cloud-consciousness handoff/provider task shells
    while preserving per-route input shaping, 200/201 status codes, task and
    approval serialization, route-specific evidence fields, and task summaries.
27. Extracted the read-only workspace and plugin review route family into a
    focused workspace/plugin read route module. The module owns workspace
    registry summaries, command proposal read models, OpenClaw migration and
    plugin SDK review routes, tool catalog/manifest-map read models, native
    plugin contract/registry/readiness routes, and their summary projections
    while preserving public paths, query aliases, response field selection, and
    existing 400 error contracts.
28. Extracted the workspace-native operations route family into a focused route
    module. The module owns native workspace text-write, patch-apply,
    source-authored edit, workspace command, and source command draft/task
    routes while preserving draft plan serialization, JSON query parsing,
    strict confirmation handling, 200/201 success codes, 400/404 error
    contracts, serialized task/approval envelopes, and task summaries.
29. Extracted the native-adapter plugin/profile/search-web/workspace-index
    route family into a focused route module. The module owns plugin profile
    and tool catalog readbacks, search-web adapter plans/preflights/sandbox
    readbacks, their approval-gated task creation routes, workspace semantic
    index and symbol lookup routes, and prompt semantics while preserving query
    aliases, limit parsing, 400/404 error contracts, task and approval
    serialization, and public endpoint paths.
30. Extracted the generic native-plugin invocation/runtime route family into a
    focused plan-builder-backed route module. The module owns invoke plans,
    runtime preflight and activation plan readbacks, runtime adapter contracts
    and task drafts, and the invoke/runtime-adapter/runtime-activation task
    creation routes while preserving default capability IDs, the invoke-plan
    response wrapper and 404 error contract, runtime 400 error contracts,
    strict confirmation parsing, route-specific response fields, task/approval
    serialization, governance fields, and task summaries.
31. Extracted the policy/capability mutation route family into a focused
    governance route module. The module owns policy state/evaluation,
    capability registry refresh, and capability invocation while preserving
    event names and payloads, policy evaluation stage strings, direct
    invocation status passthrough, local 400 error envelopes, and the refresh
    response shape.
32. Extracted the MVP, Phase 2-6, and long-term-memory read-only route family
    into a focused phase/memory read-model module. The module owns the early
    phase planning/readiness/exit endpoints and local long-term-memory
    readbacks while preserving public paths, the Phase 2 route-review query
    flags, direct response bodies, and server-level error handling.
33. Extracted the cloud-consciousness read-only GET route cluster into a
    focused route module. The module owns the local handoff, provider adapter,
    real-provider rehearsal, live-provider runbook/execution/runtime,
    real-launch, and credential-value local-read ladder readbacks while keeping
    result-envelope GET routes and POST/task routes in their existing focused
    modules.
34. Extracted the `plan-builder.mjs` capability registry/invocation boundary
    into `services/openclaw-core/src/capability-runtime.mjs` and
    `services/openclaw-core/src/capability-descriptors.mjs`. The descriptor
    module owns local body capability metadata, while the runtime module owns
    service health probing, capability policy inputs, backend dispatch, result
    summaries, invocation history, and capability invocation events while
    preserving the existing plan-builder public method names used by routes
    and task execution.
35. Extracted the `plan-builder.mjs` systemd repair task builders and body
    evidence ledger task-shell builders into
    `services/openclaw-core/src/systemd-task-builders.mjs` and
    `services/openclaw-core/src/body-evidence-task-builders.mjs`. The split
    preserves the public plan-builder method names used by the main router and
    domain task POST routes while keeping systemd repair materialization
    separate from body evidence ledger task-shell materialization.
36. Extracted the `plan-builder.mjs` Phase 7 long-term memory builder lane into
    `services/openclaw-core/src/long-term-memory-builders.mjs`. The module owns
    the local JSONL write plan, schema, proposal, route review, task shell,
    approved append executor, readback, and exit gate while injecting only the
    Phase 6 read-model builders and task lifecycle helpers it needs.
37. Extracted the `plan-builder.mjs` Phase 8 cloud-consciousness local handoff
    lane into `services/openclaw-core/src/cloud-consciousness-handoff-builders.mjs`.
    The module owns local context review, handoff schema/package/redaction,
    transmission route review, task shell, approved local handoff append,
    readback, and exit while keeping real provider adapters and later provider
    dry-run/egress lanes in `plan-builder.mjs`.
38. Extracted the `plan-builder.mjs` Phase 9 cloud-consciousness provider
    adapter dry-run lane into
    `services/openclaw-core/src/cloud-consciousness-provider-dry-run-builders.mjs`.
    The module owns the provider adapter plan/contract/request envelope,
    dry-run route review, task shell, approved local dry-run transcript,
    readback, and exit while leaving real provider-call rehearsal/live-provider
    lanes in `plan-builder.mjs`.
39. Extracted the `plan-builder.mjs` Phase 10 cloud-consciousness provider-call
    rehearsal lane into
    `services/openclaw-core/src/cloud-consciousness-provider-call-rehearsal-builders.mjs`.
    The module owns the real-call preflight plan, egress contract, credential
    preflight, request redaction review, route review, approval-gated rehearsal
    task, local response readback, and exit while leaving live-provider runbook
    and later egress lanes in `plan-builder.mjs`.
40. Extracted the `plan-builder.mjs` Phase 11 cloud-consciousness live-provider
    runbook lane into
    `services/openclaw-core/src/cloud-consciousness-live-provider-runbook-builders.mjs`.
    The module owns the live-provider runbook plan, operator checklist, egress
    transcript schema, final authorization review, runbook route review,
    approval-gated runbook task, readback, and exit while leaving Phase 12
    execution-plan and later runtime-adapter lanes in `plan-builder.mjs`.
41. Split the shared task-builder test harness into
    `services/openclaw-core/test/task-builder-harness.mjs` so new extracted
    builder-lane tests do not keep growing one large test file.

These slices reduced live-provider runtime and milestone orchestration coupling
while preserving the public runtime API and existing milestone entry names.

## High-Coupling Hotspots

| Priority | Area | Coupling Evidence | Safe First Boundary |
| --- | --- | --- | --- |
| P0 | `nix/scripts` late credential-value/result-envelope phase chain | Phase number, slug, predecessor, artifact path, registry, status marker, docs token, observer token, endpoint, and `next.recommendedSlice` are repeated across the Phase 99-116 chain. Partial fast-prereq reuse means validation speed and evidence quality depend on per-script string wiring. | Introduce a metadata table for Phases 99-116 and keep existing scripts as shims. First proof should statically compare metadata to current script/doc strings, then run representative phases 100, 108, and 116 in full and fast modes. |
| P0 | `services/openclaw-core/src/route-handlers.mjs` | Core HTTP dispatch, proxying, phase route mapping, plugin routes, task POST routes, approval surfaces, and workspace/body routes are all in one request chain. Route tokens must be hand-synced with runtime exports, Observer refreshers, and milestone scripts. Phase 99-115 result-envelope GET routes, both live-provider POST route groups, the Observer/core read-model GET routes, approval inbox/action routes, operator/control routes, task read/lifecycle routes, system/body/memory/cloud task POST routes, read-only workspace/plugin review routes, workspace-native operation routes, native-adapter plugin/profile/search-web/workspace-index routes, generic native-plugin invocation/runtime task routes, policy/capability mutation routes, MVP/Phase 2-6/long-term-memory read routes, and cloud-consciousness read-only GET routes are now grouped. Only proxy/health and systemd draft routes still live directly in the main chain. | Continue route group extraction while keeping `registerRoutes(deps)` stable. Next cohesive targets are the small proxy/health/systemd draft surfaces, then move to larger P1 hotspots such as `plan-builder.mjs`, Observer startup descriptors, and `plugin-review.mjs`. |
| P0 | `services/openclaw-core/src/task-executor.mjs` | Execution dispatch still imports many `is...Task`/`execute...Task` pairs, but task matching now uses a `NON_RECOVERABLE_TASK_HANDLERS` registry instead of an ordered if/else branch chain. Remaining coupling is the broad import/destructure surface and mixed local executor domains. | Deprioritize branch-chain work; next improvement should split handler groups only when moving a cohesive domain and preserving the registry entry order. |
| P0 | Observer UI startup and panel synchronization (`client-script-startup.mjs`, `server.mjs`, `client-script-config-dom.mjs`, `client-script-refreshers-cloud.mjs`) | Current contracts are internally consistent, but adding one panel requires matching HTML ids, DOM constants, refresh function, startup call, interval, and milestone token checks. Startup hard-codes every refresher twice: initial `await` sequence and `setInterval` registry. | Introduce a refresh descriptor list grouped by surface and generate startup calls/intervals from it. Then add grouped DOM descriptors for one cloud lane while preserving legacy aliases. |
| P1 | `services/openclaw-core/src/plan-builder.mjs` | Plugin plans, runtime activation, cloud live-provider execution/runtime-adapter wiring, body evidence append/readiness read models, task creation, approval creation, event publishing, and phase evidence builders still share one builder. The capability registry/invocation slice, systemd/body task-shell builders, Phase 7 long-term memory lane, Phase 8 cloud handoff lane, Phase 9 provider dry-run lane, Phase 10 provider-call rehearsal lane, and Phase 11 live-provider runbook lane are now extracted. | Next safe boundaries are the Phase 12 live-provider execution-plan builders or the separate body evidence append/readiness read-model lane; keep the returned plan-builder method names stable while moving one cohesive family at a time. |
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
3. Continue splitting `route-handlers.mjs` by domain so future phases do not
   keep editing one router chain.
4. Split `task-executor.mjs` handler groups only after the current route
   extraction work, since the global branch chain has already been replaced by
   a registry table.
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

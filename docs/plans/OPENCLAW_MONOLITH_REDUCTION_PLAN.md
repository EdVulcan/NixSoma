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
8. Added a Phase 99-120 live-provider result-envelope milestone manifest that
   statically proves registry rows, phase plans, core wrappers, Observer
   wrappers, and common checks still align with one metadata source.
9. Replaced the Phase 99-120 core/Observer wrapper bodies with a shared
   manifest-driven wrapper helper while preserving every public script filename
   and registry entry.
10. Extended the Phase 99-120 manifest check to derive each phase primary
    registry and verify the repeated common-check registry inputs.
11. Extended the same manifest check to derive and verify the repeated
    route/approved/final-readiness/task-shell status markers in common checks.
12. Extended the manifest check to derive and verify the repeated Phase 99-120
    core/system-heal state artifact filenames in common checks.
13. Extracted the repeated Phase 99-120 common-check environment setup into a
    manifest-driven helper for ports, plan docs, state artifacts, and core /
    Observer URLs.
14. Extracted the repeated Phase 99-120 fast prerequisite reuse setup into a
    bounded helper while preserving each milestone's local service assertions
    and fallback predecessor script.
15. Replaced the hand-written Phase 99-120 core / Observer milestone registry
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
42. Extracted the `plan-builder.mjs` Phase 12 cloud-consciousness live-provider
    execution-plan lane into
    `services/openclaw-core/src/cloud-consciousness-live-provider-execution-plan-builders.mjs`.
    The module owns the execution plan, endpoint/credential metadata binding,
    execution transcript schema, route review, approval-gated execution-plan
    task, readback, exit, and shared Phase 12 evidence projection used by later
    live-provider phases.
43. Extracted the `plan-builder.mjs` Phase 13-17 cloud-consciousness live-provider
    runtime-readiness lane into
    `services/openclaw-core/src/cloud-consciousness-live-provider-runtime-readiness-builders.mjs`.
    The module owns the runtime-adapter plan and approval-gated task shell,
    final authorization and operator launch review read models, and the runtime
    implementation plan bridge while preserving live egress, credential value
    reads, provider SDK loading, and endpoint contact as disabled/deferred.
44. Extracted the `plan-builder.mjs` native plugin planning/runtime shell lane
    into `services/openclaw-core/src/native-plugin-plan-builders.mjs`.
    The module owns native capability invoke plans, runtime preflight,
    activation plans, adapter contracts, task drafts, and approval-gated native
    plugin invoke/runtime task shells while preserving the public plan-builder
    method names used by native plugin runtime routes.
45. Extracted the early `cloud-live-provider-runtime-implementation.mjs`
    runtime task lanes into focused modules:
    `cloud-live-provider-runtime-initial-builders.mjs` owns Phase 18-29
    runtime implementation, adapter implementation/module, and request-builder
    task shells; `cloud-live-provider-runtime-credential-reference-builders.mjs`
    owns Phase 32-37 credential-reference resolver and no-network sender task
    shells; `cloud-live-provider-runtime-transcript-builders.mjs` owns Phase
    40-48 local transcript recorder, provider response verifier, and rollback
    note task shells; `cloud-live-provider-runtime-closure-builders.mjs` owns
    Phase 52-55 local runtime adapter method-table completion and closure task
    shells; `cloud-live-provider-runtime-real-launch-builders.mjs` owns Phase
    56-59 real-launch route review, approval-gated launch task shell, approved
    deferred execution, and execution preflight recording;
    `cloud-live-provider-runtime-credential-egress-gate-builders.mjs` owns
    Phase 60-64 credential-value access gate, endpoint network egress gate,
    egress execution route/task preflight, approval-gated egress execution task
    shell, executor, and approved-deferred readback;
    `cloud-live-provider-runtime-credential-value-authorization-builders.mjs`
    owns Phase 65-70 credential-value authorization route/task shell,
    approved-deferred readback, readiness preflight, read task shell, executor,
    and approved-deferred readback;
    `cloud-live-provider-runtime-credential-value-access-authorization-builders.mjs`
    owns Phase 71-78 credential-value access authorization route/task shell,
    approved-deferred readback, final readiness preflight, authorization
    decision route/task shell, decision approved-deferred readback, local-proof
    build/record behavior, and both approval-gated executors;
    `cloud-live-provider-runtime-credential-value-local-read-builders.mjs`
    owns Phase 79-86 credential-value local-read route/task shell,
    approved-deferred readback, final readiness preflight, local-read execution
    route/task shell, execution approved-deferred readback, execution final
    readiness preflight, and both approval-gated executors. The main runtime
    implementation now
    composes those factories while preserving public method names, registry
    strings, endpoint behavior, approval gates, event publication, persistence
    calls, task predicates, and deferred executor summaries.
46. Extracted the `cloud-live-provider-runtime-implementation.mjs` Phase 87-90
    credential-value local-read execution-local-read lane into
    `cloud-live-provider-runtime-credential-value-local-read-execution-local-read-builders.mjs`.
    The module owns the execution-local-read route, approval-gated task shell,
    approved-deferred readback, final readiness preflight recording, and
    approval-gated executor while preserving public runtime method names,
    registry strings, deferred credential-value-read semantics, event
    publication, persistence calls, and task predicates.
47. Extracted the `plan-builder.mjs` body-evidence follow-up readiness lane
    into `services/openclaw-core/src/body-evidence-readiness-builders.mjs`.
    The module owns follow-up ledger task lookup, durable JSONL readback,
    follow-up task readiness, append route review, explicit append arming, and
    append-readiness read models while preserving the public plan-builder
    method names used by Phase 2 read routes, task routes, and milestone
    assertions.
48. Extracted the `plan-builder.mjs` Phase 4 conservative self-heal read-model
    family into `services/openclaw-core/src/phase4-self-heal-builders.mjs`.
    The module owns Phase 4 route selection, system-sense/system-heal evidence
    reads, self-heal loop evidence, heal/maintenance history packaging,
    completion readiness, and exit while preserving all Phase 4 public
    plan-builder method names, registry strings, read-only governance, and
    route contracts.
49. Extracted the `plan-builder.mjs` Phase 3 work-view and operator-interrupt
    read-model family into
    `services/openclaw-core/src/phase3-work-view-builders.mjs`. The module
    owns Phase 3 route selection, session-manager work-view state readback,
    background work-view evidence, pause/resume/stop/takeover control
    readiness, completion readiness, and exit while preserving all Phase 3
    public plan-builder method names, registry strings, non-intrusive
    governance, and route contracts.
50. Extracted the `plan-builder.mjs` Phase 5/MVP/Post-MVP/Phase 6 read-only
    evidence chain into
    `services/openclaw-core/src/phase5-mvp-phase6-readiness-builders.mjs`.
    The module owns deployment inventory, rollback readiness, release control,
    MVP final readiness, post-MVP route selection, Phase 6 memory substrate
    inventory, consciousness context envelopes, task orchestration records,
    memory-write route review, and Phase 6 exit while preserving all public
    plan-builder method names, registry strings, route contracts, and the
    `buildPhase6Exit` / `buildPhase6ConsciousnessContextEnvelope` dependency
    names used by the long-term-memory and cloud handoff lanes.
51. Extracted the capability-aware rule-plan helper cluster into
    `services/openclaw-core/src/rule-plan-builders.mjs`. The module owns
    public plan redaction, rule-plan action normalization, planner intent
    inference, capability annotation, capability summary generation, plan-build
    selection, and plan phase updates while preserving the public
    `serialisePlanForPublic`, `buildRulePlan`, `shouldBuildPlan`, and
    `updatePlanForPhase` names used by task-manager, task routes, route
    handlers, workspace operations, and task executors.
52. Extracted the Phase 2/MVP legacy read-model family into
    `services/openclaw-core/src/phase2-mvp-readiness-builders.mjs`. The module
    owns MVP route alignment, repair demo status, next repair demo status,
    Phase 2 demo control room, walkthrough, demo readiness exit, next
    capability route review, Phase 2 completion readiness, and Phase 2 exit
    while preserving the public method names and the body-evidence readiness
    route-review dependency through a lazy wrapper in `plan-builder.mjs`.
53. Extracted the `plugin-review.mjs` workspace/source intake surface into
    `services/openclaw-core/src/plugin-review-workspace-discovery.mjs`,
    `services/openclaw-core/src/plugin-review-source-command-proposals.mjs`,
    and `services/openclaw-core/src/plugin-review-source-migration.mjs`.
    These modules now own read-only workspace detection, package-manager and
    script command proposals, source-command signal composition, and
    migration candidate/plan projections while preserving the public plugin
    review method names, registry strings, no-execution governance, and
    workspace plugin read-route contracts.
54. Extracted the `plugin-review.mjs` Plugin SDK contract/source/native-contract
    lane into `services/openclaw-core/src/plugin-review-sdk-contracts.mjs` and
    moved shared object-key sorting into
    `services/openclaw-core/src/plugin-review-common.mjs`. The SDK module now
    owns plugin SDK contract review, source review scope, derived source-content
    signals, native contract tests, native SDK contract implementation slots,
    native contract/registry envelopes, and reviewed package selection while
    preserving public plugin review method names, route contracts, native
    registry strings, and no-import/no-execution governance.
55. Extracted the `plugin-review.mjs` manifest/capability planning lane into
    `services/openclaw-core/src/plugin-review-manifest-capability.mjs`. The
    module now owns native plugin manifest profile, extension manifest map,
    manifest-derived capability plan, and candidate contract tests while
    preserving public plugin review method names, native adapter registry
    strings, metadata-only privacy boundaries, and no-runtime-activation
    governance.
56. Extracted the `plugin-review.mjs` search-web task materializer into
    `services/openclaw-core/src/plugin-review-search-web-tasks.mjs`. The module
    owns approval-gated task creation for search-web adapter invocation,
    runtime activation, and provider runtime sandbox shells while preserving
    public method names, task types, registry strings, lifecycle event
    publication, approval creation, persistence calls, and no-network/no-runtime
    execution governance.
57. Extracted the `plugin-review.mjs` search-web read-model/planning lane into
    `services/openclaw-core/src/plugin-review-search-web-plans.mjs`. The module
    owns provider contract shells, provider selection, approval-gated task
    drafts, runtime preflight envelopes, activation gates, and provider runtime
    sandbox contracts while preserving public method names, native search/web
    registry strings, query redaction, no-network/no-import/no-runtime
    activation boundaries, and explicit approval task-draft semantics.
58. Extracted the `plugin-review.mjs` workspace intelligence surfaces into
    `services/openclaw-core/src/plugin-review-workspace-intelligence.mjs`. The
    module owns OpenClaw workspace selection, tool catalog metadata, native tool
    catalog profile filtering, prompt semantics, semantic index, symbol lookup,
    and edit-target selection while preserving public method names, read-only
    metadata/source-derived outputs, bounded declaration previews, and no
    source-body/no-import/no-execution governance.
59. Split the Observer runtime action script by extracting runtime/system/body
    and systemd refreshers from
    `apps/observer-ui/src/client-script-runtime-actions.mjs` into
    `apps/observer-ui/src/client-script-refreshers-runtime.mjs`. The served
    client script remains byte-for-byte identical through `clientScript()`
    assembly while the action file now owns event streams, button actions,
    task/work-view control helpers, and task card event delegation only.
60. Extracted task recovery classification and recovered-task creation from
    `services/openclaw-core/src/task-manager.mjs` into
    `services/openclaw-core/src/task-recovery.mjs`. The module now owns
    operator-capability recovery predicates, native runtime/search-web deferred
    task classifiers, eye-hand recovery evidence, policy/plan reset, and
    recovered task creation while `task-manager.mjs` and `task-executor.mjs`
    share the same source of truth for restorable/deferred recovery semantics.
61. Split the Observer cloud refresher script by extracting
    `apps/observer-ui/src/client-script-refreshers-cloud-context.mjs`,
    `apps/observer-ui/src/client-script-refreshers-cloud-live-runbook.mjs`,
    `apps/observer-ui/src/client-script-refreshers-cloud-live-launch.mjs`,
    `apps/observer-ui/src/client-script-refreshers-cloud-live-local-read.mjs`,
    and
    `apps/observer-ui/src/client-script-refreshers-cloud-live-result-envelope.mjs`.
    The public `observerClientCloudRefreshersScript` export now only assembles
    phase-family chunks, and `clientScript()` was proven byte-for-byte identical
    after the split, preserving every global refresh function, DOM id, endpoint,
    registry token, and startup-visible symbol.
62. Extracted bounded local filesystem operations from
    `services/openclaw-system-sense/src/server.mjs` into
    `services/openclaw-system-sense/src/system-file-operations.mjs`. The module
    now owns allowed-root boundary checks, file metadata/list/search/read,
    bounded text write/append, and directory creation while the HTTP server
    keeps the existing `/system/files/*` routes, event names, response fields,
    error codes, and body-sovereign local filesystem semantics.
63. Replaced Observer startup refresh double-entry wiring with
    `apps/observer-ui/src/client-script-startup-refreshes.mjs`. The startup
    entrypoint now renders initial `await refresh...()` calls and matching
    `setInterval(..., 5000)` registrations from one grouped descriptor list of
    247 refresh names while preserving the one-shot event hooks and proving
    `clientScript()` byte-for-byte identical.
64. Extracted system-sense process and command operations into
    `services/openclaw-system-sense/src/system-command-operations.mjs`. The
    module now owns process listing, command dry-run risk classification,
    allowlisted command execution, root/path refusal, timeout/output bounding,
    and injectable execution dependencies while preserving the existing
    `/system/processes`, `/system/command/dry-run`, and
    `/system/command/execute` route contracts.
65. Extracted read-only systemd inspection and body service dependency mapping
    into `services/openclaw-system-sense/src/systemd-inspection.mjs`. The module
    now owns planned OpenClaw unit inventory, non-mutating `systemctl --version`
    and `systemctl show` reads, dependency graph/layer/impact calculations, and
    injectable platform/exec dependencies while preserving
    `/system/systemd/unit-inventory` and `/system/body/dependency-map` outputs.
66. Extracted system-sense health and body-governance read models into
    `services/openclaw-system-sense/src/system-health-governance.mjs`. The
    module now owns body/resource snapshots, health trend retention, route-aware
    next-action recommendations, conservative recovery policy explanation, body
    governance readiness, and the Phase 2 route review while preserving read-only
    registry names and endpoint payload contracts.
67. Extracted system-sense body-evidence timeline and ledger route-review
    builders into `services/openclaw-system-sense/src/system-body-evidence.mjs`.
    The module now owns body evidence timeline/readiness, ledger plan,
    storage-root and first-record route reviews, ledger readiness/demo status,
    and follow-up record planning while the HTTP server injects systemd,
    health-governance, repair-demo, and next-repair read dependencies. Focused
    unit tests instantiate the factory directly and prove the read-only
    timeline and plan-only ledger boundaries without starting services.
68. Extracted the system-sense next systemd repair planning chain into
    `services/openclaw-system-sense/src/systemd-next-repair-planning.mjs`.
    The module now owns scope review, plan-only command preview, route review,
    dry-run envelope, and task-route read models for the selected
    `openclaw-system-sense.service` repair path while the HTTP server injects
    inventory/dependency builders, body-evidence ledger demo status, command
    dry-run construction, and local unit/risk helpers. Focused unit tests prove
    the chain remains non-mutating and stops before task creation, approval, or
    `systemctl` execution.
69. Extracted the system-sense systemd repair-candidate planning chain into
    `services/openclaw-system-sense/src/systemd-repair-candidate-planning.mjs`.
    The module now owns candidate assessment, plan-only command preview, task
    route gate, readiness closeout, route review, and demo-status evidence for
    the existing browser-runtime repair demo target while the HTTP server
    injects inventory, dependency, health trend, and unit lookup dependencies.
    Focused unit tests prove the chain remains read-only and closes without
    task creation, approval, command execution, or host mutation.
70. Extracted generic systemd repair proposal and dry-run envelopes into
    `services/openclaw-system-sense/src/systemd-repair-proposals.mjs`. The
    module owns operator-visible plan-only restart proposals, default/custom
    repair reasons, inventory-bounded unit rejection, and dry-run envelopes
    while the HTTP server injects inventory, dry-run construction, unit lookup,
    and risk classification dependencies. Focused unit tests prove unknown
    units are rejected and the dry-run path remains non-executing.
71. Extracted the Observer UI HTML shell from
    `apps/observer-ui/src/server.mjs` into `observer-html.mjs`, split the
    static document into style, foundation, cloud, operations, and system panel
    chunks, and changed the Observer package syntax checks to cover all
    `src/*.mjs` modules automatically. The HTTP server now owns service
    endpoint wiring and `/`, `/health`, `/client.js`, and `/client-v5.js`
    dispatch only, while generated HTML remains byte-for-byte identical.
72. Extracted the system-sense local file and command/process HTTP adapters
    into `services/openclaw-system-sense/src/system-file-routes.mjs` and
    `services/openclaw-system-sense/src/system-command-routes.mjs`. The route
    modules now own `/system/files/*`, `/system/processes`, and
    `/system/command/*` HTTP parsing, event publication, error envelopes, and
    response status codes while the server injects existing operation factories
    and keeps system state, health, systemd, body evidence, refresh, and
    service lifecycle wiring local.
73. Extracted the system-sense systemd HTTP adapter into
    `services/openclaw-system-sense/src/systemd-routes.mjs`. The table-driven
    route module now owns `/system/systemd/*` GET dispatch, repair query alias
    parsing, and repair error envelopes while the server injects the existing
    inventory, dependency-map, repair-candidate, next-repair, and generic
    repair proposal builders.
74. Extracted the system-sense body-evidence HTTP adapter into
    `services/openclaw-system-sense/src/system-body-evidence-routes.mjs`. The
    table-driven route module now owns `/system/route/body-evidence-*`
    read-model dispatch while the server injects the existing timeline,
    ledger, storage-root, first-record, readiness, demo-status, and follow-up
    evidence builders.
75. Extracted the system-sense health/body/governance/refresh HTTP adapter into
    `services/openclaw-system-sense/src/system-health-routes.mjs`. The route
    module now owns `/system/health`, `/system/body`, `/system/services`,
    `/system/alerts`, `/system/refresh`, and route-governance read-model
    dispatch while the server injects state refresh, state snapshots, event
    publication, and governance builders.
76. Extracted pure workspace patch/diff utilities from
    `services/openclaw-core/src/workspace-ops.mjs` into
    `services/openclaw-core/src/workspace-patch-utils.mjs`. The utility module
    now owns bounded edit normalization, non-overlap validation, line/text
    replacement application, bounded diff preview construction, and preview
    validation while `workspace-ops.mjs` keeps workspace target selection,
    draft/task materialization, approval creation, persistence, and event
    publication.
77. Extracted workspace proposal/rationale utilities from
    `services/openclaw-core/src/workspace-ops.mjs` into
    `services/openclaw-core/src/workspace-proposal-utils.mjs`. The module now
    owns metadata truncation, rationale/check/risk bundle normalization,
    source-derived proposal bundle construction, and public patch proposal
    envelopes while `workspace-ops.mjs` keeps source signal collection,
    workspace target selection, task/approval materialization, persistence, and
    event publication.
78. Extracted workspace command plan-only builders from
    `services/openclaw-core/src/workspace-ops.mjs` into
    `services/openclaw-core/src/workspace-command-plan-builders.mjs`. The
    factory now owns workspace command proposal lookup, workspace command plan
    drafts, source command proposal lookup, and source command plan overlays
    while `workspace-ops.mjs` keeps approval-gated task creation, approval
    publication, persistence, and task lifecycle events.
79. Extracted Observer approval-gated task creation functions from
    `apps/observer-ui/src/client-script-runtime-actions.mjs` into
    `apps/observer-ui/src/client-script-runtime-approval-tasks.mjs`. The
    approval task chunk now owns workspace/native-adapter/search-web task
    creation flows and their post-create refresh sequence while
    `client-script-runtime-actions.mjs` keeps operator, work-view, event
    subscription, task recovery, and button binding behavior. The assembled
    `/client.js` output was proven byte-for-byte identical after extraction.
80. Extracted Observer system/body task-shell creation functions from
    `apps/observer-ui/src/client-script-runtime-actions.mjs` into
    `apps/observer-ui/src/client-script-runtime-system-body-tasks.mjs`. The new
    chunk owns systemd repair task shells, real-execution task shells, and body
    evidence ledger task-shell creation while `client-script-runtime-actions.mjs`
    keeps operator, work-view, task completion/recovery, event stream, and
    button binding behavior. The assembled `/client.js` output remained
    byte-for-byte identical.
81. Extracted Observer runtime DOM/input/task-card bindings from
    `apps/observer-ui/src/client-script-runtime-actions.mjs` into
    `apps/observer-ui/src/client-script-runtime-bindings.mjs`. The binding chunk
    now owns button click handlers, work-view URL input pinning, and task-card
    delegated actions while `client-script-runtime-actions.mjs` keeps the
    underlying runtime action functions and event stream subscription. The
    assembled `/client.js` output remained byte-for-byte identical.
82. Extracted Observer workspace/source/native-adapter renderer functions from
    `apps/observer-ui/src/client-script-renderers.mjs` into
    `apps/observer-ui/src/client-script-renderers-workspace-source.mjs`. The
    new renderer chunk owns workspace registry/migration, plugin SDK/source
    review, tool catalog/search-web, semantic index, source command, and
    workspace patch/text draft renderers while the main renderer chunk keeps
    shared formatting, task/policy/capability/ledger renderers, native plugin
    runtime renderers, and the operator panel. The assembled `/client.js` output
    remained byte-for-byte identical.
83. Extracted Observer workspace/source/native-adapter refreshers from
    `apps/observer-ui/src/client-script-refreshers-app.mjs` into
    `apps/observer-ui/src/client-script-refreshers-workspace-source.mjs`. The
    new refresher chunk owns workspace registry, command/source proposal,
    migration, plugin SDK/source review, tool catalog/search-web, semantic
    index, and workspace patch/text draft refreshers while the main app
    refresher chunk keeps core operator/policy/capability/ledger helpers and
    generic task/render utilities. The assembled `/client.js` output remained
    byte-for-byte identical.
84. Extracted Observer MVP/Phase 2-5 and memory-phase refreshers from
    `apps/observer-ui/src/client-script-refreshers-app.mjs` into
    `apps/observer-ui/src/client-script-refreshers-mvp-phases.mjs` and
    `apps/observer-ui/src/client-script-refreshers-memory-phases.mjs`. The main
    app refresher chunk is now a compact core/operator/policy/capability/task
    helper surface while the phase-family modules own milestone-specific
    refreshers. The assembled `/client.js` output remained byte-for-byte
    identical.
85. Extracted Observer body governance/body-evidence runtime refreshers from
    `apps/observer-ui/src/client-script-refreshers-runtime.mjs` into
    `apps/observer-ui/src/client-script-refreshers-body-evidence.mjs`. The new
    chunk owns health trends, route-aware body governance, evidence timeline,
    body evidence ledger planning, storage root, first record, readiness, demo,
    and follow-up record refreshers while the runtime refresher chunk keeps
    core runtime/task/work-view/screen/action/system state and heal/maintenance
    audit refreshers. The assembled `/client.js` output remained byte-for-byte
    identical.
86. Extracted Observer systemd repair runtime refreshers from
    `apps/observer-ui/src/client-script-refreshers-runtime.mjs` into
    `apps/observer-ui/src/client-script-refreshers-systemd.mjs`. The new chunk
    owns Phase 2 route review, repair candidate, next repair, unit inventory,
    dependency map, repair plan, and repair execution task draft refreshers
    while the runtime refresher chunk keeps non-systemd runtime surfaces. The
    assembled `/client.js` output remained byte-for-byte identical.
87. Extracted Observer config/DOM declaration groups from
    `apps/observer-ui/src/client-script-config-dom.mjs` into focused MVP/memory,
    cloud/provider, system/body, and workspace/source chunks. The main config
    module now keeps base service URLs, shared runtime/task/work-view/health
    DOM refs, core operator/approval/capability/ledger refs, and runtime state
    variables. The assembled `/client.js` output remained byte-for-byte
    identical.
88. Replaced hand-written task extension serialization in
    `services/openclaw-core/src/task-manager.mjs` with a local
    `TASK_EXTENSION_FIELDS` descriptor shared by public task serialization and
    task creation cloning. Only the historically accepted create-time extension
    fields are copied from task input, so task creation does not gain a broader
    mutation surface while late-bound builder/executor fields still serialize
    under their existing public keys.
89. Extracted the system/body non-recoverable executor lane from
    `services/openclaw-core/src/task-executor.mjs` into
    `services/openclaw-core/src/task-executor-system-body-handlers.mjs`. The
    new factory owns systemd repair execution/deferred shells, body evidence
    ledger directory/record execution, their predicates, ledger read helpers,
    systemd command verification, and handler registry entries while the main
    executor keeps generic operator execution, native/search-web deferrals,
    cloud delegated handlers, capability invocation, and read models.
90. Extracted native plugin and OpenClaw search-web deferred executor handlers
    from `services/openclaw-core/src/task-executor.mjs` into
    `services/openclaw-core/src/task-executor-native-deferred-handlers.mjs`.
    The new factory owns native capability/runtime adapter deferrals,
    search-web runtime/provider sandbox deferrals, their predicates, policy
    stages, blocked task events, approval serialization, and handler registry
    entries while preserving the main non-recoverable dispatch order.
91. Replaced the long delegated plan-builder handler list in
    `services/openclaw-core/src/task-executor.mjs` with
    `services/openclaw-core/src/task-executor-delegated-plan-handlers.mjs`.
    The descriptor-backed factory maps stable long-term-memory and
    cloud/live-provider handler names to the corresponding plan-builder
    predicate/executor functions, preserving dispatch order while removing
    dozens of manual destructured `is...Task`/`execute...Task` pairs from the
    main executor.
92. Extracted the remaining direct core infrastructure/readback route surfaces
    from `services/openclaw-core/src/route-handlers.mjs` into focused route
    modules. `core-infrastructure-routes.mjs` now owns `/health` and
    `/proxy/*` gateway forwarding, `core-runtime-read-routes.mjs` owns
    `/state/runtime`, and `systemd-draft-routes.mjs` owns
    `/system/systemd/repair-execution-task-draft` while preserving public
    endpoint paths, response bodies, proxy target mapping, systemd unit/target
    aliases, execute flag parsing, and error contracts. The main router is now
    a small dependency assembly and route-group dispatcher.
93. Extracted the `cloud-live-provider-runtime-implementation.mjs` Phase
    91-116 late credential/result-envelope composition chain into
    `cloud-live-provider-runtime-credential-local-read-late-builders.mjs`.
    The new factory owns the local-read attempt, attempt-local-read,
    result-envelope, result-envelope creation, creation execution, creation
    execution attempt, and final local-read attempt composition order while
    preserving every public runtime method name, registry string, task
    predicate, executor, approval gate, and no-egress/no-credential-value-read
    boundary. The main runtime implementation now composes one cohesive late
    lane instead of destructuring seven separate phase factories.
94. Extended the manifest-backed result-envelope lane through Phase 117 and
    added the approved-deferred local-read readback endpoint, Observer panel,
    and common-check wrapper while keeping the new phase in the existing
    focused local-read module instead of reintroducing route/runtime/Observer
    branches in the core router.
95. Extracted the repeated Phase 99-120 Observer HTML/client token assertions
    in result-envelope common checks into
    `nix/scripts/dev-openclaw-live-provider-result-envelope-assertions.sh`.
    Each common check now validates the same served Observer evidence through
    manifest-derived title, panel id, endpoint, refresh function, predecessor
    registry, current registry, and next-slice tokens instead of hand-copying
    those strings per phase. The manifest check now covers the assertion helper
    and all common-check call sites.
96. Introduced a descriptor-backed Observer refresher pilot for the Phase
    99-102 result-envelope route/task-shell/approved-deferred/final-readiness
    quartet. The pilot preserves the four public refresh function names, DOM
    ids, endpoint tokens, registry tokens, JSON lines, and fallback behavior
    while moving repeated endpoint-to-DOM rendering into a shared helper and
    descriptor table. The same slice fixed escaped newline handling in touched
    client-template output and added assembled `/client.js` syntax validation
    as proof.
97. Extended the same Observer result-envelope descriptor table through the
    Phase 103-106 creation route/task-shell/approved-deferred/final-readiness
    quartet. The four creation refresh functions are now thin wrappers over
    the shared endpoint-to-DOM helper while preserving their public names, DOM
    ids, endpoint tokens, registry tokens, JSON lines, and fallback behavior.
98. Extended the Observer result-envelope descriptor table through the Phase
    107-110 creation-execution route/task-shell/approved-deferred/final-readiness
    quartet. The shared helper now supports optional recorded DOM fields, so
    the creation-execution final-readiness refresher keeps its recorded status
    display without a bespoke function body.
99. Extended the Observer result-envelope descriptor table through the Phase
    111-114 creation-execution-attempt route/task-shell/approved-deferred/final
    readiness quartet. The attempt final-readiness descriptor keeps the
    approved-deferred-found line and recorded DOM behavior in metadata instead
    of a bespoke refresher body.
100. Completed the Observer result-envelope descriptor table through the Phase
    115-117 final local-read route/task-shell/approved-deferred sequence. The
    final three refresh functions now use the same endpoint-to-DOM descriptor
    helper while preserving their global function names, DOM ids, registry
    tokens, JSON lines, fallback text, and served `/client.js` syntax checks.
101. Extracted native plugin SDK capability descriptors from
    `packages/plugin-runtime/src/plugin-registry.mjs` into
    `plugin-capability-descriptors.mjs`. The registry factory now composes the
    plugin identity, governance descriptor, and capability data from one
    focused module while preserving `createOpenClawNativePluginRegistry()`, the
    exact capability id order, shared-types runtime shims, and native plugin
    milestone checks.
102. Added Phase 118 final local-read readiness preflight to the existing
    result-envelope manifest lane. The slice records final readiness after the
    Phase 117 approved-deferred local-read evidence through the focused late
    runtime module, manifest-generated wrappers, batch reuse validation, and a
    descriptor-backed Observer panel without reintroducing main router,
    executor, or Observer refresher branches.
103. Started the post-Phase-118 local-read result-envelope route lane in
    `services/openclaw-core/src/cloud-live-provider-runtime-credential-local-read-result-envelope-creation-execution-attempt-local-read-result-envelope.mjs`
    instead of adding another read-model block to the Phase 115-118 runtime
    module. The new module owns Phase 119 route evidence and keeps downstream
    local-read result-envelope phases from turning the Phase 115-118 module
    into the next catch-all.
104. Extended the same post-Phase-118 runtime lane through Phase 120 by adding
    the approval-gated local-read result-envelope task shell, POST route, and
    delegated executor handler in the new focused module. The slice keeps task
    creation, approval, deferred completion, Observer tokens, and milestone
    assertions in the Phase 119+ lane instead of growing the older Phase
    115-118 local-read module.
105. Extended the Phase 119+ runtime lane through Phase 122 by adding the
    approved-deferred local-read result-envelope readback route plus the final
    readiness preflight route/record path and Observer descriptor without
    introducing a new route hub branch, executor branch, or non-manifest
    milestone wrapper.

These slices reduced live-provider runtime and milestone orchestration coupling
while preserving the public runtime API and existing milestone entry names.

## High-Coupling Hotspots

| Priority | Area | Coupling Evidence | Safe First Boundary |
| --- | --- | --- | --- |
| P0 | `nix/scripts` late credential-value/result-envelope phase chain | Phase number, slug, predecessor, artifact path, registry, status marker, docs token, observer token, endpoint, and `next.recommendedSlice` are now manifest-backed across the Phase 99-122 chain. Observer HTML/client token assertions now use a manifest-derived helper. Remaining repetition lives mostly in phase-specific JSON business assertions. | Keep extending the manifest lane for adjacent result-envelope phases and extract assertion helpers only when they preserve local service evidence and reduce repeated token wiring. |
| P0 | `services/openclaw-core/src/route-handlers.mjs` | Core HTTP dispatch, proxying, phase route mapping, plugin routes, task POST routes, approval surfaces, and workspace/body routes were all in one request chain. Phase 99-115 result-envelope GET routes, both live-provider POST route groups, the Observer/core read-model GET routes, approval inbox/action routes, operator/control routes, task read/lifecycle routes, system/body/memory/cloud task POST routes, read-only workspace/plugin review routes, workspace-native operation routes, native-adapter plugin/profile/search-web/workspace-index routes, generic native-plugin invocation/runtime task routes, policy/capability mutation routes, MVP/Phase 2-6/long-term-memory read routes, cloud-consciousness read-only GET routes, proxy/health, runtime-state readback, and systemd draft routes are now grouped. | Treat the main router as substantially reduced. Keep `registerRoutes(deps)` as a route-group composition surface, and avoid reintroducing direct feature branches. Next higher-ROI hotspots are `cloud-live-provider-runtime-implementation.mjs` Phase 91+ composition, Observer startup/DOM descriptors, and milestone assertion helpers. |
| P0 | `services/openclaw-core/src/task-executor.mjs` | Task matching uses a `NON_RECOVERABLE_TASK_HANDLERS` registry instead of an ordered if/else branch chain. System/body execution now lives in `task-executor-system-body-handlers.mjs`, native/search-web deferred runtime handlers now live in `task-executor-native-deferred-handlers.mjs`, and long-term-memory/cloud delegated plan-builder dispatch now uses `task-executor-delegated-plan-handlers.mjs` descriptors. Remaining coupling is generic work-view execution, capability invocation, and read models. | Treat dispatch coupling as substantially reduced; next executor split should target generic work-view/capability/read-model helpers only if they block feature work. |
| P0 | Observer UI startup and panel synchronization (`client-script-startup.mjs`, `client-script-startup-refreshes.mjs`, `observer-html.mjs`, `client-script-config-dom.mjs`) | Startup initial refresh calls and polling intervals are generated from one grouped descriptor list, `server.mjs` is now a small HTTP shell that delegates static HTML assembly to focused style/foundation/cloud/operations/system panel chunks, and DOM declarations are split into MVP/memory, cloud/provider, system/body, and workspace/source chunks while preserving served `/client.js` bytes. Remaining coupling is HTML ids, DOM constants, refresh function implementation, and milestone token checks still being manually coordinated. | Introduce descriptor-backed DOM binding for one cloud or system/body lane only when it removes HTML/id/refresher drift; preserve legacy aliases, served `/client.js` token compatibility, and byte-for-byte or token-equivalent Observer HTML output. |
| P1 | `services/openclaw-core/src/plan-builder.mjs` | The file is now mostly a composition root plus operator state, task lifecycle helpers, capability runtime wiring, and extracted factory wiring. The Phase 2/MVP legacy read-model family, capability-aware rule-plan helper cluster, native plugin planning/runtime shell lane, capability registry/invocation slice, systemd/body task-shell builders, body-evidence follow-up readiness lane, Phase 3 work-view read-model family, Phase 4 self-heal read-model family, Phase 5/MVP/Post-MVP/Phase 6 read-only evidence chain, Phase 7 long-term memory lane, Phase 8 cloud handoff lane, Phase 9 provider dry-run lane, Phase 10 provider-call rehearsal lane, Phase 11 live-provider runbook lane, Phase 12 live-provider execution-plan lane, and Phase 13-17 live-provider runtime-readiness lane are now extracted. | Deprioritize as a large-file hotspot unless task lifecycle helpers grow again; next higher-ROI core hotspots are `plugin-review.mjs`, `cloud-live-provider-runtime-implementation.mjs` Phase 91+ composition, `route-handlers.mjs` residual proxy/health/systemd draft surfaces, and `task-manager.mjs` serialization descriptors. |
| P1 | `services/openclaw-core/src/cloud-live-provider-runtime-implementation.mjs` | Now composes extracted live-provider runtime lanes through focused factories. The Phase 18-29, Phase 32-37, Phase 40-48, Phase 52-55, Phase 56-59, Phase 60-64, Phase 65-70, Phase 71-78, Phase 79-86, Phase 87-90, and Phase 91-122 late credential/result-envelope runtime lanes are extracted into focused modules. Remaining coupling is the broad top-level dependency bag shared by all runtime lane factories. | Treat as substantially reduced. Consider a shared approved-deferred lifecycle helper only if future phase work repeats status/evidence mutation across multiple lane modules; otherwise return to Observer startup/DOM descriptors or milestone assertion helpers. |
| P1 | `services/openclaw-system-sense/src/server.mjs` | Bounded filesystem operations, command/process operations, read-only systemd inventory/dependency mapping, health/body-governance read models, body-evidence timeline/ledger route-review builders, repair-candidate planning, next systemd repair planning, and generic repair proposal/dry-run helpers are extracted into focused modules. File, command/process, systemd, body-evidence, and health/body/governance HTTP route adapters are also extracted, so the server is now mostly a composition, service registry refresh, state update, and service lifecycle shell. | Treat as largely reduced. Only split service registry/state-refresh wiring if it starts blocking future body-sense work or if multiple services need the same lifecycle helper. |
| P1 | `services/openclaw-core/src/plugin-review.mjs` | Now a small composition surface for workspace/source intake, source migration, source command proposals, SDK contracts, manifest/capability planning, search-web planning/tasks, workspace intelligence, formal readiness, and native adapter status. The high-coupling workspace tool catalog/prompt/semantic/symbol/edit-target logic is extracted. | Treat as largely reduced; only split formal readiness/native adapter status if those status summaries start growing again. Next higher-ROI core hotspots are `cloud-live-provider-runtime-implementation.mjs`, `route-handlers.mjs`, and `task-manager.mjs`. |
| P1 | `services/openclaw-core/src/task-manager.mjs` | Task recovery predicates, recovered-plan reset, and recovered-task creation are now extracted into `task-recovery.mjs` and shared by `task-executor.mjs`. Task extension output fields are now centralized in `TASK_EXTENSION_FIELDS`, which is shared by public serialization and the conservative create-input cloning allowlist. Remaining coupling is lifecycle/persistence helpers. | Treat as mostly reduced; split lifecycle/persistence helpers only if future task state work must touch this file heavily. |
| P1 | `nix/scripts` milestone script taxonomy | The runner registry is externalized, and the Phase 99-122 live-provider result-envelope core/Observer registry rows and wrappers are metadata-backed. Common-check assertions still grow by hand and include long filenames plus repeated endpoint/status checks. | Use the `milestone-script-audit` artifact as the baseline, then extract assertion helpers only for repeated checks that can preserve real service evidence and public check names. |
| P2 | `apps/observer-ui/src/client-script-runtime-actions.mjs` | Runtime/system/body/systemd refreshers are extracted into `client-script-refreshers-runtime.mjs`, approval-gated workspace/native-adapter/search-web task creation now lives in `client-script-runtime-approval-tasks.mjs`, system/body task-shell creation now lives in `client-script-runtime-system-body-tasks.mjs`, and DOM/input/task-card bindings now live in `client-script-runtime-bindings.mjs`; these splits preserved byte-for-byte assembled `/client.js` output. Remaining coupling is event stream refresh fan-out, task focus state, work-view helpers, and task completion/recovery flows. | Extract event-to-refresh descriptors or task focus helpers while preserving global function names and byte-for-byte or token-equivalent served output where feasible. |
| P2 | `apps/observer-ui/src/client-script-renderers.mjs` | Workspace/source/native-adapter renderers now live in `client-script-renderers-workspace-source.mjs`, leaving the main renderer chunk focused on shared formatting, task/policy/capability/ledger renderers, native plugin runtime renderers, and the operator panel. The served client script was proven byte-for-byte identical after extraction. | Treat as largely reduced unless the remaining native plugin runtime renderer group grows; next higher-ROI Observer hotspots are `client-script-refreshers-runtime.mjs` and `client-script-config-dom.mjs`. |
| P2 | `apps/observer-ui/src/client-script-refreshers-app.mjs` | Workspace/source/native-adapter refreshers now live in `client-script-refreshers-workspace-source.mjs`; MVP/Phase 2-5 refreshers live in `client-script-refreshers-mvp-phases.mjs`; Phase 6 and long-term-memory refreshers live in `client-script-refreshers-memory-phases.mjs`. The main app refresher chunk is now focused on core operator, policy, approval, capability, ledger, health, task summary, fetch, and event helpers. The assembled `/client.js` output was proven byte-for-byte identical. | Treat as largely reduced; keep future phase refreshers in phase-family modules rather than growing the core app refresher chunk. |
| P2 | `apps/observer-ui/src/client-script-refreshers-runtime.mjs` | Body governance/body-evidence refreshers now live in `client-script-refreshers-body-evidence.mjs`, and systemd repair refreshers now live in `client-script-refreshers-systemd.mjs`. The runtime refresher chunk is now focused on core runtime, task list/history, work-view, screen/action, system state, heal, maintenance, and audit refreshers. The assembled `/client.js` output was proven byte-for-byte identical. | Treat as largely reduced; route future body-evidence and systemd refreshers into their domain chunks rather than growing the core runtime refresher chunk. |
| P2 | `apps/observer-ui/src/client-script-refreshers-cloud.mjs` | Cloud/live-provider refreshers are now split into context/provider rehearsal, live runbook/runtime adapter, real launch/credential authorization, local-read, and result-envelope chunks, and startup refresh registration is descriptor-backed. The Phase 99-122 result-envelope route/task-shell/approved/final-readiness/local-read sequence now uses a descriptor-backed endpoint-to-DOM helper while preserving global refresh names and served `/client.js` token compatibility. Remaining coupling is other phase-family chunks that still coordinate HTML ids, DOM constants, refresh implementations, and milestone tokens manually. | Introduce descriptor-backed DOM/read-model binding for one next cloud or system/body lane only when it removes HTML/id/refresher drift and can preserve served client token compatibility. |
| P2 | `services/openclaw-core/src/workspace-ops.mjs` | Target resolution, source signal collection, task creation, approval, and event publication still share one operational surface, but pure patch edit/diff utilities now live in `workspace-patch-utils.mjs`, proposal/rationale/check/risk bundle construction now lives in `workspace-proposal-utils.mjs`, and workspace/source command plan-only builders now live in `workspace-command-plan-builders.mjs` with direct unit coverage. | Treat as substantially reduced for now. Next split should target source-authored edit orchestration only if it grows, or separate approval-gated task materializers if future native workspace work touches this file heavily. |
| P2 | Shared plugin contract (`packages/plugin-runtime/src/plugin-registry.mjs`, `packages/shared-types/src/plugin-registry.mjs`, `plugin-contract.mjs`) | Native capability IDs now live in `plugin-capability-descriptors.mjs` with direct package tests preserving the exact id order, while `createOpenClawNativePluginRegistry()` and shared-types runtime shims remain stable. Remaining coupling is contract validation/default primitive ownership across plugin runtime and shared type definitions. | Centralize remaining duplicated policy/risk/event primitives only when it removes a real caller-facing duplicate or unlocks typed shared-package validation. |

## Deprioritized By Coupling

- Long docs are not refactor targets unless they cause process drift.
- Files under any line threshold are not automatically acceptable.
- Files over any line threshold are not automatically bad when they own one
  cohesive domain and have stable validation.

## Refactor Order

1. Finish reducing active live-provider lane coupling while it remains the
   current development surface.
2. Continue splitting `route-handlers.mjs` by domain so future phases do not
   keep editing one router chain.
3. Split `task-executor.mjs` handler groups only after the current route
   extraction work, since the global branch chain has already been replaced by
   a registry table.
4. Add Observer startup/panel/selector descriptors to stop HTML/DOM/refresher/startup
   drift.
5. Add broader milestone phase descriptors and shared assertion helpers to reduce slow,
   recursive, hand-written validation scripts.
6. Continue splitting remaining `openclaw-system-sense` route registration
   groups, then return to the highest-coupling
   core/Observer hotspots that still force broad edits.

## Minimum Proof For Each Slice

- The extracted boundary has one clear responsibility.
- Public entry points remain stable or are explicitly shimmed.
- No new replacement module bundles unrelated domains.
- `npm run typecheck` and `npm run build` pass for JavaScript changes.
- A focused milestone or regression check exercises the moved behavior.
- Validation notes state whether fast prerequisite reuse or full-chain
  validation was used.

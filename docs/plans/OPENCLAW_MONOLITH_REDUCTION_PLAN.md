# OpenClaw Monolith Reduction Plan

Created after Phase 116. Updated after the first live-provider runtime
extraction slices.

## Current Audit

Hard governance threshold: tracked files over 2000 lines.

Tracked files over 2000 lines: 10.

Tracked files between 1000 and 2000 lines: 4. These are acceptable for now and
kept in observation only.

Tracked files over 5000 lines: 4.

Largest files:

| Lines | File | Priority | Notes |
| ---: | --- | --- | --- |
| 12575 | `services/openclaw-core/src/plan-builder.mjs` | P0 | Plan construction and many phase surfaces share one module. |
| 12360 | `services/openclaw-core/src/cloud-live-provider-runtime-implementation.mjs` | P0 | Reduced from 16195 lines by extracting governance and Phase 107-116 local-read/result-envelope runtime slices; still contains registry, earlier local-read/result-envelope route builders, task factories, executor helpers, and future live-provider growth risk. |
| 5723 | `services/openclaw-core/src/plugin-review.mjs` | P1 | Plugin review flows should be split by review surface and provider/runtime checks. |
| 5004 | `services/openclaw-system-sense/src/server.mjs` | P1 | HTTP server, probes, summaries, and body/system sensing logic share one file. |
| 4388 | `services/openclaw-core/src/route-handlers.mjs` | P0 | Core route router is a single branch chain; live-provider routes are especially dense. |
| 3423 | `services/openclaw-core/src/task-executor.mjs` | P0 | Execution dispatch and executor implementations are mixed. |
| 3259 | `apps/observer-ui/src/client-script-refreshers-cloud.mjs` | P1 | Cloud refreshers should be split by provider/runtime/credential lane. |
| 2993 | `apps/observer-ui/src/client-script-runtime-actions.mjs` | P1 | Runtime actions should be split by command domain. |
| 2371 | `apps/observer-ui/src/server.mjs` | P1 | HTML shell is still embedded in the HTTP server. |
| 2347 | `docs/plans/OPENCLAW_SOURCE_INTEGRATION_STAGE_PLAN.md` | P3 | Long documentation, lower risk. |

Observation-only files under the hard threshold:

| Lines | File | Priority | Notes |
| ---: | --- | --- | --- |
| 1803 | `apps/observer-ui/src/client-script-refreshers-app.mjs` | P2 | App refreshers can be split after cloud refreshers. |
| 1746 | `services/openclaw-core/src/workspace-ops.mjs` | P2 | Workspace operations can be grouped by read/index/edit surfaces. |
| 1503 | `apps/observer-ui/src/client-script-renderers.mjs` | P2 | Renderer helpers can be grouped by task/event/workspace surfaces. |
| 1266 | `apps/observer-ui/src/client-script-config-dom.mjs` | P2 | DOM selector registry can be split after Observer panels are modularized. |

## Guardrails

- Do not change runtime behavior while reducing monoliths unless a phase explicitly requires it.
- Prefer thin compatibility shims so existing exports and routes remain stable.
- Move pure constants, governance records, route groups, and renderer/refresh groups before moving stateful execution logic.
- Keep new modules under 1000 lines whenever practical, and require an explicit
  reason before any new or edited module exceeds 2000 lines.
- Treat 1000-2000 line files as acceptable observation targets, not immediate
  blockers.
- Every extraction slice must pass `npm run typecheck`, `npm run build`, and a focused milestone/regression check that exercises the moved code.
- Do not continue feature phases in the live-provider lane until the P0 live-provider/core-router/task-executor split has started.

## Completed Slices

1. Extracted live-provider governance helpers from
   `cloud-live-provider-runtime-implementation.mjs`.
2. Extracted Phase 115-116 local-read task shell runtime into a focused module.
3. Extracted Phase 111-114 result-envelope creation execution attempt runtime
   into a focused module.
4. Extracted Phase 107-110 result-envelope creation execution runtime into a
   focused module.

The largest live-provider runtime file is now 12360 lines, down from 16195.

## Optimization Order

1. Split `cloud-live-provider-runtime-implementation.mjs` pure phase metadata:
   - Extract registry constants into focused registry modules.
   - Extract phase governance helpers into stage-scoped modules.
   - Keep the public `createCloudLiveProviderRuntimeImplementation(deps)` API unchanged.

2. Continue splitting the credential local-read/result-envelope lane:
   - Next low-risk target: Phase 103-106 result-envelope creation route/task/
     approved-deferred/final-readiness preflight.
   - Then split Phase 99-102 result-envelope route/task/approved-deferred/
     final-readiness preflight.
   - Keep the public runtime return API unchanged.

3. Split the remaining Phase 107-116 credential local-read/result-envelope execution-attempt lane if new growth appears:
   - Move route builders, task shell factories, `is...Task` predicates, and executor helpers into a lane module.
   - Pass only the required runtime context from the main implementation.
   - Verify Phase 111-116 route/task/deferred/preflight/local-read checks still pass.

4. Split `route-handlers.mjs` by route domain:
   - Move cloud live-provider GET/POST route groups to `route-handlers-cloud-live-provider.mjs`.
   - Move plugin/native-adapter route groups to a plugin route module.
   - Preserve `registerRoutes(deps)` as the stable entry point.

5. Split `task-executor.mjs` dispatch:
   - Extract cloud live-provider executor dispatch into a table-driven module.
   - Extract body/systemd/plugin/workspace executors into domain modules.
   - Keep `runOperatorStep` and recovery behavior stable.

6. Split Observer cloud scripts:
   - Split `client-script-refreshers-cloud.mjs` by cloud lane.
   - Split cloud DOM selector declarations in parallel or move to grouped selector objects.
   - Keep `/client-v5.js` assembly stable through `client-script.mjs`.

7. Split remaining P1 files:
   - `plan-builder.mjs` by phase family.
   - `plugin-review.mjs` by review surface.
   - `openclaw-system-sense/src/server.mjs` into HTTP, probe, and summary modules.
   - Keep `workspace-ops.mjs`, app refreshers, renderers, and config DOM in
     observation unless they exceed 2000 lines or become active edit surfaces.

## First Slice

Start with a behavior-preserving extraction from `cloud-live-provider-runtime-implementation.mjs` because it remains one of the largest files and is most likely to keep growing during future provider phases.

Minimum proof:

- File line count decreases for `cloud-live-provider-runtime-implementation.mjs`.
- No new file exceeds 1000 lines.
- `npm run typecheck` passes.
- `npm run build` passes.
- Phase 116 core and observer milestone pair still passes.

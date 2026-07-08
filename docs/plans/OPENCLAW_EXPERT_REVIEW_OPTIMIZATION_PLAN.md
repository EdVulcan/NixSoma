# OpenClaw Expert Review Optimization Plan

This plan tracks the optimization work required before returning to giant-file decoupling or normal phase development.

## Completion Rule

The expert review items are considered complete only when each item has code-level mitigation, local validation evidence, and milestone/check coverage where the item affects routine development.

## Status

| Area | Review Finding | Status | Evidence |
| --- | --- | --- | --- |
| Test lifecycle P0/T3 | `dev-down.sh` used global process killing and prevented parallel runs. | Complete | Commit `6a7fcf3`; `openclaw-service-lifecycle-scope` milestone. |
| Test batch reuse P0/T1 | Every selected milestone restarted the full service stack. | Partial, result-envelope lane, Phase 24-98 live-provider lanes, and expanded core/Observer pair reuse complete | Commit `eff4beb`; `openclaw-live-provider-result-envelope-batch-reuse` milestone; `openclaw-live-provider-result-envelope-phase-115-116-batch-reuse` covers the old bespoke 115-116 batch through the manifest runner; table-driven `openclaw-core-observer-pair-batch-reuse` covers compatible Phase 59-72 non-result-envelope core/Observer pairs; `openclaw-live-provider-pre-credential-pair-batch-reuse` covers Phase 24-57 pre-credential core/Observer pairs; `openclaw-live-provider-credential-value-local-read-batch-reuse` covers Phase 73-90 core and Observer checks; `openclaw-live-provider-credential-value-local-read-attempt-batch-reuse` covers Phase 91-98 core and Observer checks in one reusable service lifecycle. Broader non-live-provider and early-phase lane batching remains pending. |
| Task executor branch chain | Large independent task dispatch branches. | Already complete before this plan | `NON_RECOVERABLE_TASK_HANDLERS` registry is present in `services/openclaw-core/src/task-executor.mjs`. |
| Shared types runtime coupling C1 | `shared-types` owned plugin runtime `.mjs` logic. | Complete | Runtime moved to `packages/plugin-runtime`; old `shared-types` paths are compatibility re-export shims. |
| Shared type exports E3 | Domain type files were not exported. | Complete | `@openclaw/shared-types` now exposes `api`, `events`, `policy`, `screen`, `session`, `system`, and `task` type subpaths. |
| Duplicate policy/risk types C2 | Policy domain and risk literals were duplicated. | Complete | `packages/shared-types/src/policy.ts` is the single source for `OpenClawPolicyDomain`, `PolicyDomain`, and `OpenClawRisk`. |
| Event schema duplication C2 | `OpenClawEvent<T>` and `EventSchema` described the same event payload contract independently. | Complete | `EventSchema<T>` reuses `OpenClawEvent<T>` payload typing from shared-types. |
| Shared package engineering E3 | Shared packages lacked independent tsconfig/barrel/type declarations. | Complete | Shared package `tsconfig.json` files, barrel entries, and `shared-utils` declarations added. |
| Unit tests E2 | No focused unit tests existed for shared packages or services. | Complete, focused service-layer and dispatch coverage established | Node built-in tests added for plugin runtime, shared-events, shared-utils, and `openclaw-core` policy evaluation, service-client behavior, route handler contract helpers, task-executor read models, delegated non-recoverable dispatch, internal deferred dispatch, capability-plan dispatch, and representative systemd/body-evidence deferred dispatch. |
| Shared-client empty shell C5 | `shared-client` only exported tiny service constants. | Complete | `service-descriptors` now provides typed and runtime service ids, default ports, URL env vars, and resolver helpers; core and Observer consume the shared runtime descriptors for defaults. |
| Shared-events identity helper C5 | `createEventName` was a no-op identity function. | Complete | Runtime and typed event factory validate names against `eventNames`; shared registry now covers existing maintenance, screen-act, command, body evidence, long-term memory, cloud-consciousness, and systemd repair publish events; core route/task/plan publish call sites and non-core service publish call sites now use registry-backed event names. |
| Root package script redundancy E1/P2 | `package.json` had many hard-coded `dev:*check:unix` milestone scripts. | Complete | Root scripts reduced to one milestone runner plus stable lifecycle/smoke aliases; `dev-milestone-check.sh` accepts milestone names as npm args. |
| Shell helper duplication E4 | `post_json()` was copied across many scripts. | Complete | 257 local definitions migrated to `dev-openclaw-http-json-helper.sh`; helper mode compatibility covered by `openclaw-http-json-helper`. |
| Observer mirror test duplication T2 | Observer checks duplicate core setup. | Partial, reusable pair runner expanded | Result-envelope batch milestone covers core and Observer in one live service lifecycle; `dev-openclaw-core-observer-pair-runner.sh` lets compatible core/Observer pairs reuse one service lifecycle while preserving real Observer HTML/client checks; the pair batch covers Phase 24-57 pre-credential pairs and Phase 59-72 compatible pairs; Phase 73-90 local-read and Phase 91-98 local-read-attempt batches now run core and Observer assertions in one service lifecycle. Legacy standalone Observer scripts remain for compatibility. |
| Fixed sleeps T4 | Scripts use fixed sleeps instead of polling. | Complete | `dev-openclaw-wait-helper.sh` replaces fixed numeric sleeps with bounded polling; audit has no `sleep N` matches under `nix/scripts`; `openclaw-wait-helper` and `@changed` passed. |
| State reuse P1/T5 | Heavy prerequisite chains are replayed. | Partial, Phase 4/body-evidence/credential-value-local-read/result-envelope reuse complete | Fast prerequisite helper exists for live-provider result-envelope chain; Phase 4 system-heal prerequisite state can be reused by downstream Phase 6 checks; body-evidence demo-status core state and ledger JSONL can be reused by all current follow-up/Observer/Phase 2 completion consumers in explicit fast mode; Phase 73-90 credential-value local-read and Phase 91-98 local-read-attempt common checks can reuse manifest-validated persisted predecessor state in explicit fast mode while preserving default full-chain fallback. Broader non-body-evidence common prerequisite migration remains pending. |

## Current Slice Exit Evidence

- `OPENCLAW_MILESTONE_CHECKS=openclaw-shared-package-contracts bash nix/scripts/dev-milestone-check.sh` passed.
- `OPENCLAW_MILESTONE_CHECKS=@changed bash nix/scripts/dev-milestone-check.sh` passed and selected only static/shared contract checks for this slice.
- `npm run typecheck --workspaces --if-present` passed inside a dev shell with TypeScript.
- `npm run build --workspaces --if-present` passed inside a dev shell with TypeScript.
- `npm run test --workspaces --if-present` passed inside a dev shell with TypeScript.
- `git diff --check` passed.

## Package Script Reduction Evidence

- Root `package.json` scripts reduced from 229 entries to 14 entries.
- Unix check aliases reduced to `dev:state-check:unix`, `dev:command-capture-check:unix`, and `dev:milestone-check:unix`.
- `npm run dev:milestone-check:unix -- openclaw-shared-package-contracts` passed, proving argument-based milestone selection.
- `OPENCLAW_MILESTONE_CHECKS=@changed bash nix/scripts/dev-milestone-check.sh` passed and selected only static/shared checks for the script reduction slice.
- `npm run typecheck --workspaces --if-present`, `npm run build --workspaces --if-present`, `npm run test --workspaces --if-present`, and `git diff --check` passed.

## Shell HTTP Helper Evidence

- Local `post_json()` helper definitions reduced to the single shared definition in `nix/scripts/dev-openclaw-http-json-helper.sh`.
- The helper preserves default fail, `-d`, no-fail, fail-with-body, and file upload modes through explicit per-script configuration.
- `OPENCLAW_MILESTONE_CHECKS=openclaw-http-json-helper bash nix/scripts/dev-milestone-check.sh` passed.
- `OPENCLAW_MILESTONE_CHECKS=@changed bash nix/scripts/dev-milestone-check.sh` passed and selected `task-workbench` as the representative real service check for the mechanical extraction.
- `bash -n` passed for all changed shell scripts.

## Wait Helper Evidence

- Fixed numeric sleeps in `nix/scripts/*.sh` were replaced with bounded polling via `nix/scripts/dev-openclaw-wait-helper.sh`.
- `rg -n '\bsleep [0-9]+(\.[0-9]+)?\b' nix/scripts -g '*.sh'` returned no matches.
- `OPENCLAW_MILESTONE_CHECKS=openclaw-wait-helper bash nix/scripts/dev-milestone-check.sh` passed.
- `OPENCLAW_MILESTONE_CHECKS=@changed bash nix/scripts/dev-milestone-check.sh` passed and selected structural checks plus representative real service checks: `openclaw-service-lifecycle-scope`, `openclaw-live-provider-result-envelope-batch-reuse`, `state-settling`, `openclaw-ai-work-view-capture`, and `openclaw-workspace-command-hardening`.
- `bash -n` passed for all changed shell scripts and `git diff --check` passed.

## Core/Observer Pair Reuse Evidence

- `dev-openclaw-core-observer-pair-runner.sh` runs a compatible common-check once for core behavior and once for Observer HTML/client tokens while reusing the same live service lifecycle.
- `openclaw-core-observer-pair-batch-reuse` is table-driven and covers Phase 59-72 cloud-consciousness launch/credential/egress/credential-authorization pairs outside the result-envelope lane.
- `openclaw-live-provider-pre-credential-pair-milestone-manifest` validates the Phase 24-57 pre-credential public milestone name, Observer milestone name, wrapper script, common-check script, port env, Observer env, and Phase 52-55 `PHASE52_55_CHECK_KIND` mapping for every covered pair.
- `openclaw-live-provider-pre-credential-pair-batch-reuse` runs Phase 24-57 pre-credential core checks and their Observer mirrors through the shared pair runner, preserving real endpoint and Observer HTML/client checks while cutting each pair from two service lifecycles to one.
- Representative Phase 8/9/10/24 behavior checks passed after compacting nested cloud-consciousness evidence references: `openclaw-cloud-consciousness-handoff-task`, `openclaw-cloud-consciousness-provider-dry-run-task`, `openclaw-cloud-consciousness-real-provider-call-task`, and `openclaw-cloud-consciousness-live-provider-runtime-adapter-module-contract`.
- `OPENCLAW_MILESTONE_CHECKS=@changed bash nix/scripts/dev-milestone-check.sh` passed 9/9 for this slice, including `openclaw-service-lifecycle-scope`, `openclaw-live-provider-pre-credential-pair-batch-reuse` in 2378s, and `openclaw-live-provider-result-envelope-batch-reuse` in 11s.
- Phase 73-90 and Phase 91-98 core checks now use manifest-backed prerequisite helpers for persisted predecessor state reuse in explicit fast mode, so their bottleneck is no longer treated as simple Observer mirror duplication. Batch reuse for these lanes remains a separate optimization step.
- The pair runner preserves existing public core and Observer milestone scripts; it adds a faster co-validation path without deleting compatibility wrappers.
- The pair runner now uses scoped event logs and cleans up its scoped services before returning even when a child core or Observer check fails.

## Result-Envelope 115-116 Batch Evidence

- The Phase 115-116 local-read batch script is now a thin wrapper over `dev-openclaw-live-provider-result-envelope-batch-reuse-check.sh`.
- `openclaw-live-provider-result-envelope-phase-115-116-batch-reuse` registers that wrapper as a milestone and keeps the public script path stable.
- The wrapper uses the same manifest-backed core and Observer assertions as the broader Phase 99-116 result-envelope batch runner.

## Core Service Unit Test Evidence

- `services/openclaw-core` now has a workspace `test` script using Node's built-in test runner.
- `policy-evaluator.test.mjs` covers cross-boundary approval gating, body-internal audit-only decisions, absolute deny boundaries, audit log capping/counts, and task approval creation without starting dev services.
- `service-client.test.mjs` covers JSON fetch/post behavior, error propagation, tolerant JSON file reads, and system-sense URL construction without starting dev services.
- `task-executor.test.mjs` covers command transcript and filesystem read/change read models without starting dev services.
- `task-executor.test.mjs` covers 33 plan-builder delegated non-recoverable dispatch entries through table-driven predicate/executor stubs, so registry wiring and option forwarding fail fast without starting services.
- `task-executor.test.mjs` covers native-plugin and OpenClaw search-web internal deferred dispatch, capability-plan dispatch, systemd repair/next-repair deferred dispatch, and body-evidence follow-up deferred dispatch without executing plugins, network calls, systemd commands, or ledger appends.
- `route-handlers.test.mjs` covers executor-backed GET response contracts and body-evidence follow-up task-shell POST serialization without starting dev services.
- `openclaw-core-service-unit-tests` runs the focused service-layer unit tests as a milestone.

## Shared Client Runtime Descriptor Evidence

- `shared-client` now exposes runtime `.mjs` service descriptors plus `.d.ts` declarations and Node unit tests.
- `openclaw-core` and `observer-ui` use shared descriptor helpers for service default ports and URLs while preserving the existing environment variable names.
- `openclaw-shared-package-contracts` checks the shared-client runtime modules and tests.

## Shared Events Runtime Registry Evidence

- `shared-events` now includes the event names currently published by maintenance, screen action, system command, body evidence, long-term memory, cloud-consciousness, and systemd repair paths.
- `screen-act`, `system-heal`, and `system-sense` use `createEventName()` on representative previously-unregistered publish events.
- `openclaw-core` route handlers, task executor, and plan builder now use `createEventName()` for their direct publish call sites, so task, policy, approval, capability, body-evidence, long-term-memory, cloud-consciousness, and systemd event names are registry-validated at runtime.
- `browser-runtime`, `screen-act`, `screen-sense`, `session-manager`, `system-heal`, and `system-sense` now wrap their direct `publishEvent()` names in `createEventName()` for startup, browser, screen, action, heal, file, process, command, and system refresh events.
- `shared-events` unit tests cover the newly registered names.

## Phase 4 Fast Prerequisite Evidence

- `dev-openclaw-phase4-prereq-state.sh` reuses a validated Phase 4 system-heal artifact only when `OPENCLAW_MILESTONE_PREREQ_MODE=fast`.
- `dev-openclaw-phase-6-consciousness-context-envelope-check.sh` can consume the reused Phase 4 state before service startup, then run the real Phase 6 endpoint check without replaying maintenance setup.
- `openclaw-phase4-fast-prereq-state` is a self-contained milestone that creates the Phase 4 source artifact if needed and then requires fast reuse for the Phase 6 proof.

## Body Evidence Fast Prerequisite Evidence

- `dev-openclaw-body-evidence-fast-prereq-state.sh` reuses validated body-evidence demo-status core state plus the matching one-line bootstrap ledger JSONL only when `OPENCLAW_MILESTONE_PREREQ_MODE=fast`.
- `dev-body-evidence-prereqs.sh` exposes a shared pre-start hook so every current `prepare_body_evidence_ledger_demo_status` consumer can reuse body-evidence state before service startup, then fall back to the original full bootstrap when fast mode is not enabled.
- Follow-up core checks, Observer mirrors, Phase 2 route-review follow-up checks, and Phase 2 completion/exit checks now have one pre-start hook before `dev-up.sh` and keep their real endpoint/task/Observer assertions.
- `openclaw-body-evidence-fast-prereq-state` creates the source demo-status evidence if needed, statically audits all demo-status consumers for the pre-start hook, and requires fast reuse through representative core, Observer, and completion-readiness checks.

## Credential-Value Local-Read Prerequisite Evidence

- `openclaw-live-provider-credential-value-local-read-milestones.tsv` captures Phase 73-90 slugs, predecessor/next links, registry descriptions, and state-level prerequisite registry/marker evidence.
- `dev-openclaw-live-provider-credential-value-local-read-prereq.sh` replaces the repeated predecessor replay block in Phase 73-90 common checks; default mode still runs the previous common check, while `OPENCLAW_MILESTONE_PREREQ_MODE=fast` copies a validated direct predecessor artifact.
- `dev-openclaw-live-provider-credential-value-local-read-milestone-manifest-check.sh` validates registry rows, wrappers, common-check helper calls, plan docs, state paths, and adjacent manifest links.
- `OPENCLAW_MILESTONE_CHECKS=milestone-registry,milestone-script-audit,openclaw-live-provider-credential-value-local-read-milestone-manifest bash nix/scripts/dev-milestone-check.sh` passed.
- `OPENCLAW_MILESTONE_PREREQ_MODE=fast` representative checks passed for Phase 82, 86, and 90 core milestones plus their Observer mirrors; core logs show direct predecessor state reuse.
- Default full-mode fallback was preserved: `OPENCLAW_MILESTONE_CHECKS=openclaw-cloud-consciousness-live-provider-credential-value-local-read-final-readiness-preflight bash nix/scripts/dev-milestone-check.sh` passed in 227s.

## Credential-Value Local-Read Batch Evidence

- `dev-openclaw-live-provider-credential-value-local-read-batch-reuse-check.sh` runs Phase 73-90 core checks, then their Observer mirrors, using one scoped `OPENCLAW_DEV_RUN_ID`, one port range, and one shared state file.
- `openclaw-live-provider-credential-value-local-read-batch-reuse` passed through `@changed`.
- Batch evidence recorded `phaseRange: "73-90"`, `coreChecks: 18`, `observerChecks: 18`, and `servicesStartedOnce: true`.

## Credential-Value Local-Read Attempt Prerequisite Evidence

- `openclaw-live-provider-credential-value-local-read-attempt-milestones.tsv` captures Phase 91-98 slugs, public predecessor/next links, fast-source persisted state links, and prerequisite registry/marker evidence.
- `dev-openclaw-live-provider-credential-value-local-read-attempt-prereq.sh` replaces the inline fast-prerequisite blocks in Phase 91-98 common checks while preserving default fallback to the public predecessor common check.
- `dev-openclaw-live-provider-credential-value-local-read-attempt-milestone-manifest-check.sh` validates registry rows, wrappers, common-check helper calls, plan docs, state paths, adjacent public links, and fast-source metadata.
- `OPENCLAW_MILESTONE_CHECKS=milestone-registry,milestone-script-audit,openclaw-live-provider-credential-value-local-read-attempt-milestone-manifest bash nix/scripts/dev-milestone-check.sh` passed.
- `OPENCLAW_MILESTONE_PREREQ_MODE=fast` representative checks passed for Phase 91, 92, 94, and 98 core milestones plus their Observer mirrors; core logs show persisted predecessor state reuse.
- Default full-mode fallback was preserved: `OPENCLAW_MILESTONE_CHECKS=openclaw-cloud-consciousness-live-provider-credential-value-local-read-execution-local-read-attempt-final-readiness-preflight bash nix/scripts/dev-milestone-check.sh` passed in 476s.

## Credential-Value Local-Read Attempt Batch Evidence

- `dev-openclaw-live-provider-credential-value-local-read-attempt-batch-reuse-check.sh` runs Phase 91-98 core checks, then their Observer mirrors, using one scoped `OPENCLAW_DEV_RUN_ID`, one port range, and one shared state file.
- `openclaw-live-provider-credential-value-local-read-attempt-batch-reuse` passed through `@changed`.
- Batch evidence recorded `phaseRange: "91-98"`, `coreChecks: 8`, `observerChecks: 8`, and `servicesStartedOnce: true`.

## Next Expert Items After This Slice

1. Continue state-reuse and batch-reuse inventory for remaining long-running milestone lanes without weakening real service assertions.
2. Keep adding focused service-layer unit tests for real-execution branches only when those branches are touched or can be safely isolated without host mutation.
3. Keep moving remaining core helper-module event names behind the shared registry as those modules are touched.

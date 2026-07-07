# OpenClaw Expert Review Optimization Plan

This plan tracks the optimization work required before returning to giant-file decoupling or normal phase development.

## Completion Rule

The expert review items are considered complete only when each item has code-level mitigation, local validation evidence, and milestone/check coverage where the item affects routine development.

## Status

| Area | Review Finding | Status | Evidence |
| --- | --- | --- | --- |
| Test lifecycle P0/T3 | `dev-down.sh` used global process killing and prevented parallel runs. | Complete | Commit `6a7fcf3`; `openclaw-service-lifecycle-scope` milestone. |
| Test batch reuse P0/T1 | Every selected milestone restarted the full service stack. | Partial, result-envelope lane complete | Commit `eff4beb`; `openclaw-live-provider-result-envelope-batch-reuse` milestone. Broader lane batching remains pending. |
| Task executor branch chain | Large independent task dispatch branches. | Already complete before this plan | `NON_RECOVERABLE_TASK_HANDLERS` registry is present in `services/openclaw-core/src/task-executor.mjs`. |
| Shared types runtime coupling C1 | `shared-types` owned plugin runtime `.mjs` logic. | Complete | Runtime moved to `packages/plugin-runtime`; old `shared-types` paths are compatibility re-export shims. |
| Shared type exports E3 | Domain type files were not exported. | Complete | `@openclaw/shared-types` now exposes `api`, `events`, `policy`, `screen`, `session`, `system`, and `task` type subpaths. |
| Duplicate policy/risk types C2 | Policy domain and risk literals were duplicated. | Complete | `packages/shared-types/src/policy.ts` is the single source for `OpenClawPolicyDomain`, `PolicyDomain`, and `OpenClawRisk`. |
| Event schema duplication C2 | `OpenClawEvent<T>` and `EventSchema` described the same event payload contract independently. | Complete | `EventSchema<T>` reuses `OpenClawEvent<T>` payload typing from shared-types. |
| Shared package engineering E3 | Shared packages lacked independent tsconfig/barrel/type declarations. | Complete | Shared package `tsconfig.json` files, barrel entries, and `shared-utils` declarations added. |
| Unit tests E2 | No focused unit tests existed for shared packages. | Partial | Node built-in tests added for plugin runtime, shared-events, and shared-utils. Broader service-layer unit tests remain pending. |
| Shared-client empty shell C5 | `shared-client` only exported tiny service constants. | Complete | `service-descriptors.ts` provides typed service ids, default ports, and env var names while preserving old exports. |
| Shared-events identity helper C5 | `createEventName` was a no-op identity function. | Complete | Runtime and typed event factory now validate names against `eventNames`. |
| Root package script redundancy E1/P2 | `package.json` had many hard-coded `dev:*check:unix` milestone scripts. | Complete | Root scripts reduced to one milestone runner plus stable lifecycle/smoke aliases; `dev-milestone-check.sh` accepts milestone names as npm args. |
| Shell helper duplication E4 | `post_json()` is copied across many scripts. | Pending | Add shared shell helper and migrate representative lanes before broad rewrite. |
| Observer mirror test duplication T2 | Observer checks duplicate core setup. | Partial | Result-envelope batch milestone covers core and Observer in one live service lifecycle; broader migration pending. |
| Fixed sleeps T4 | Scripts use fixed sleeps instead of polling. | Pending | Audit complete; high-impact waits still need helper-based migration. |
| State reuse P1/T5 | Heavy prerequisite chains are replayed. | Partial | Fast prerequisite helper exists for live-provider result-envelope chain; broader coverage pending. |

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

## Next Expert Items After This Slice

1. Reduce root `package.json` milestone script redundancy while preserving `dev:milestone-check:unix`.
2. Introduce a shared shell HTTP helper and migrate high-churn scripts away from duplicated `post_json()`.
3. Convert high-impact fixed sleeps to bounded polling helpers.
4. Extend batch/observer co-validation beyond the result-envelope lane without weakening real service evidence.

# OpenClaw Native Engineering Provider Recommendation Semantic Task Link Plan

Updated: 2026-07-17
Status: completed

## Purpose

Close one concrete Level 2 continuity gap between the existing approved live
provider recommendation and the existing trusted work-view semantic-click task
planner:

```text
completed provider recommendation
-> explicit Observer review
-> current enabled semantic target selection
-> queued browser.semantic_click task
-> existing Operator Step/Run execution gate
```

This is a task-planning bridge. It does not add a provider, browser action,
executor, approval bypass, automatic task creation, or automatic execution.

## Contract

- The Observer keeps the completed provider task ID alongside the transient
  recommendation result.
- `Use AI Recommendation` is still an explicit operator click.
- Only `create_semantic_click_task` can use this bridge.
- The semantic target comes from the current Observer work-view inventory; the
  link cannot contain a target ID, coordinates, selector, URL override, page
  script, prompt, credential, or provider payload.
- Core recomputes the link from the referenced completed
  `cloud_consciousness_live_provider_egress_execution_task` before storing the
  new task extension.
- Public task readback exposes compact provenance only. Provider response
  content remains transient, and the queued task remains subject to the
  existing approval and Operator Step/Run boundaries.

## Identity Progress

This advances the Level 2 trusted AI work-view/session-helper route by making a
reviewed provider recommendation continue into an existing local body action
plan. It does not claim Level 3 host control, desktop-wide capture, ACPX live
process execution, or unconfigured provider egress.

## Evidence

- Core: `services/openclaw-core/src/native-engineering-recommendation-link.mjs`
- Core task boundary: `services/openclaw-core/src/task-manager.mjs`
- Observer recommendation bridge:
  `apps/observer-ui/src/client-script-runtime-engineering-recommendation.mjs`
- Observer semantic planner:
  `apps/observer-ui/src/client-script-runtime-semantic-target-task.mjs`
- Focused Core tests:
  `services/openclaw-core/test/native-engineering-recommendation-link.test.mjs`
  and `services/openclaw-core/test/task-manager.test.mjs`
- Focused Observer tests:
  `apps/observer-ui/test/client-script-runtime-engineering-recommendation.test.mjs`
  and `apps/observer-ui/test/client-script-runtime-semantic-target-task.test.mjs`
- Store closure proof remains part of `dev-body-config-check.sh`; the
  semantic-target runtime module is explicitly included in the Observer
  closure.

## Completion Record

- Core full suite: `519/519` passed.
- Observer full suite: `29/29` passed.
- Focused final milestone set: `5/5` passed.
- Nix body-config: passed with Core closure count `189` and Observer closure
  count `68`; all nine store-native service checks completed.
- The first body-config attempt exposed two missing Observer runtime imports;
  both were added to the explicit closure and the packaged Observer process
  was then started successfully from `/nix/store`.
- No live provider request was made and no credential was read during this
  slice.

## Deferred

- Real provider egress still requires the existing explicit configuration and
  authorization contract.
- AI cannot create tasks or approvals automatically and cannot execute them.
- Target reference materialization and frame/inventory validation remain owned
  by the existing semantic-click dispatch path.
- Credentials, arbitrary endpoints, browser selectors, page scripts, root
  actions, desktop-wide capture, and ACPX/Codex live process execution remain
  outside this slice.

## Next Real Capability

After this closure is proven, return to route selection from the forward
directive. Do not add another recommendation wrapper or response schema. The
next slice must close a concrete missing operator-visible Level 2 or Level 3
capability with a complete local proof.

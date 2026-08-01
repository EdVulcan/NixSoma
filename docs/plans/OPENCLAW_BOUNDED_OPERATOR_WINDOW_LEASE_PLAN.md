# Bounded Operator Window Lease

Updated: 2026-08-01

Status: implemented in source and proven through focused unit, Core route,
Observer, and real nine-service development gates. A physical NixOS candidate
is built and reviewed separately; the active physical generation remains
unchanged until explicit activation authorization.

## Selected Capability

Extend the existing finite operator run into a small, lease-bound continuation
window:

```text
operator reviews a queue and explicitly arms one lease
-> Core runs at most one existing bounded operator session per due window
-> the lease continues only while its window budget and deadline remain valid
-> the lease closes at the window budget, deadline, cancellation, or a block
```

This is the smallest real step toward governed sustained operation. It is not an
unbounded resident autonomous loop and does not add a second task executor.

## Contract

- `POST /operator/window` accepts only `confirm=true`, `windowCount` from 1
  through 8, `maxStepsPerWindow` from 1 through 20, an interval from 0 through
  24 hours, and a deadline from 1 second through 24 hours.
- The first window is due immediately. Later windows are due only after the
  configured interval and only while the original hard deadline has not passed.
- One lease is active at a time. Every window reuses the existing
  `operatorRunSessionManager` and `runOperatorLoop` owner; it cannot supply a
  task, action, URL, policy, approval, provider, or host override.
- A lease stops after its finite window budget, deadline, cancellation, blocked
  executor result, or execution failure. There is no automatic retry or
  automatic repeat after terminal closure.
- Core startup converts `running` leases to `blocked` and `armed` leases to
  `paused`. `POST /operator/window/:id/rearm` requires the exact lease id and
  `confirm=true`; it preserves the original budget and deadline and cannot
  extend an expired lease.
- Lease persistence contains only bounded counters, timestamps, status,
  compact run result, and the existing run-session id. No input text, pixels,
  provider response, credentials, or raw task payload is persisted.
- The timer is controlled by `services.openclaw.boundedOperatorWindow.enable`,
  which defaults to `false`. Enabling the timer is a deployment decision and
  does not arm a lease.
- Observer exposes arm, status, refresh, cancellation, and explicit re-arm. It
  does not expose the internal tick route or accept task execution authority.

## Identity Advancement

This advances the Level 1 user-space control plane from a one-shot delayed run
to a finite, restart-aware continuation contract. It does not complete the
whitepaper's long-term autonomy target: there is still no open-ended loop,
automatic planning, causal learning, provider-selected execution, root, or
host-wide mutation.

## Evidence

- Window lease unit tests prove explicit arming, 1-8/1-20 bounds, continuation
  within budget, restart pause, exact re-arm, deadline preservation, blocked
  closure, and no retry.
- Runtime-state tests prove compact lease records persist and restore across a
  Core restart.
- Core route tests prove the four lease paths forward only bounded lease
  controls.
- Observer tests prove parameter conversion, Core-returned lease-id binding,
  local range rejection, and served controls.
- The real `dev-operator-control-check.sh` gate completed two windows and
  observed `window_budget_consumed`, with automatic repeat false.
- The real `dev-observer-operator-check.sh` gate served the arm/re-arm/cancel
  controls through the generated Observer client.
- Body-config built the Core and Observer Nix-store closures with the new
  module files and passed the read-only exact-closure checks.
- Physical candidate
  `/nix/store/48n622mrrqzhaa3kxf8hrgn25niv0pwf-nixos-system-nixos-26.05.4808.569d57850992`
  passed the current immutable target marker, all six protected-path checks,
  root-owned/switchable checks, and Core/Observer Nix-store module presence.
  Its closure contains 1826 store paths and about 9.93 GB of NAR data. The
  candidate keeps `OPENCLAW_BOUNDED_OPERATOR_WINDOW_ENABLED=0`; current
  generation `n23b58...` and all nine services remained unchanged and healthy.
- Full workspace validation is `1355/1355` tests and typecheck passed. The
  changed-check selector selects registry, script audit, Windows path budget,
  Core tests, body-config, Core operator control, and Observer operator gates.

## Deferred

- unbounded resident autonomy, automatic task creation/planning, retry, and
  causal learning;
- provider authority over lease parameters or task execution;
- arbitrary process/window/desktop control, root, and host mutation;
- physical enabling of the window timer or physical lease execution without a
  separate operator deployment decision;
- physical Phase D mutation/rollback and broader Level 3 body nerves.

## Stop Condition

Freeze this workflow after the physical candidate marker, protected-path,
closure, and service-health checks. Select the next distinct missing product
capability rather than adding more lease variants. Physical activation remains
an explicit separate deployment decision.

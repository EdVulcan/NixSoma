# Reviewed Task Work-View Continuity

Updated: 2026-08-01

Status: implemented in source with focused, served-client, structural, and
existing-owner evidence. The existing Core bind/rebind owner remains the
authority boundary; physical browser recovery and provider execution are
outside this slice.

## Selected Capability

Keep one reviewed browser task usable after its trusted work-view authority
changes by giving the operator an explicit selected-task rebind path:

```text
selected reviewed task
-> explicit Rebind Selected Task
-> existing authoritative work-view bind/rebind owner
-> same task id and status with durable bind audit
-> execution remains a separate operator action
```

This closes a real continuity gap between reviewed-task entry and the existing
Level 2 session authority contract. It does not create a second bind route.

## Contract

- Observer reads only the already-selected task id.
- The bridge invokes only `act.openclaw.engineering_context.work_view_bind`
  with `confirm=true` and `rebind=true`.
- Core revalidates the current session, work-view, helper authority, and lease
  through the existing owner before changing task binding.
- A successful rebind preserves the task id and task status, records the
  existing task binding event, and exposes no session id, lease id, URL, or
  browser payload through the bridge.
- An already-current binding is reported as an explicit no-op.
- No prepare/reveal action, provider call, action dispatch, retry, task or
  approval creation, automatic continuation, or host mutation is performed.
- A missing selection fails locally without network contact.

## Evidence

- Observer tests prove selected-task forwarding, exact `confirm/rebind` request
  shape, successful receipt validation, all read-only refresh readbacks, no-op
  acceptance, and local failure without a selected task.
- Served Observer and body-config checks require the new control and bridge
  tokens; the existing Core bind contract remains covered by its route and
  capability tests.
- The source closure remains Observer-only; no Core/provider/runtime module or
  credential boundary changes are introduced.

Validation evidence on 2026-08-01:

- Observer test suite: 95/95 passed, including the selected-task rebind and
  already-bound no-op cases.
- Observer `npm run typecheck`/build and all touched shell `bash -n` checks
  passed; `git diff --check` passed.
- Existing Core work-view bind, stale-binding, explicit-rebind, and capability
  regression tests passed (5/5 selected tests).
- `dev-milestone-select-changed-checks.sh` selected the expected structural,
  body-config, capability-invoke, and Observer checks without selecting any
  provider, browser live gate, or Nix build.
- Isolated `dev-observer-operator-check.sh` passed on ports 5600-5670 with a
  temporary development token. Its served HTML/client readback included the
  new control and `act.openclaw.engineering_context.work_view_bind` bridge.
- No provider call, browser launch, physical generation switch, reboot, or
  host mutation was performed for this slice.

## Deferred

- automatic rebind after authority loss;
- automatic work-view preparation or browser restart;
- task execution or assessment retry after rebind;
- physical browser interruption proof, provider calls, and host mutation.

## Stop Condition

Freeze this bridge after focused, served-client, structural, and Observer
closure checks. Select the next missing product capability instead of adding
more reviewed-task buttons or automatic recovery behavior.

# Six Workpackages Checkpoint

Updated: 2026-08-01

This record closes the six workpackages selected from the current NixSoma
frontier. It is a bounded product continuation, not permission to create an
unbounded autonomous loop.

## Status

| Workpackage | Source status | Runtime/deployment status | Boundary |
| --- | --- | --- | --- |
| 1. Physical generation deployment | Implemented and validated in source | The later process-lifecycle generation 109 (`y2f0fnrb...`) is now active after the fixed helper passed marker/protected-path checks; current/profile match, nine health endpoints, seven system plus two user owners, zero failed units, scheduler-disabled state, and no reboot were verified | No password transport, arbitrary sudo, or reboot |
| 2. In-flight task recovery | Implemented | Startup reconciliation and explicit task recovery are tested and carried by the active physical generation | No automatic replay or automatic resume |
| 3. Level 2 work-view/session recovery | Implemented | Explicit rebind reuses the authoritative session/lease owner; Observer recovery controls are tested | Fresh authority is required before actions resume |
| 4. Controlled long-running operation | Implemented as a finite one-shot schedule | Scheduler is default-off; when explicitly enabled it runs at most one 1-20 step schedule | No daemon loop, repeat, retry, planning, task creation, or provider authority |
| 5. Learning effectiveness | Implemented as a read-only effectiveness model and Observer panel | Reads terminal outcomes, feedback observations, and advisory-application observations | No causal claims, ranking, policy adaptation, or provider training |
| 6. Privileged capability boundary | Implemented and tested | Six known high-privilege ids are registry-visible but unavailable and return HTTP 403 | Root, host-wide mutation, desktop-wide capture/input, arbitrary process/window control remain closed |

## Workpackage Contracts

### Recovery

Core persists an operator session checkpoint before dispatch, after completed
steps, and at terminal boundaries. Startup converts process-bound unfinished
work into an explicit recoverable interruption. A completed task only repairs
the missing session checkpoint; it is not replayed as recovery. Observer keeps
Resume disabled until the operator creates the explicit recovery task, after
which the existing task recovery and trusted work-view bind owners restore
fresh authority.

The same rule applies to Level 2 work-view state: persisted session metadata is
intent/readback, not action authority. A stale or missing trusted binding must
be explicitly rebound before capture or actions can continue.

### Finite Scheduled Operation

`/operator/schedule` accepts an explicit `confirm=true`, an integer step budget
from 1 through 20, and an optional delay bounded to 24 hours. Each schedule is
one-shot. A Core restart blocks a running schedule and pauses an armed schedule
so it must be re-armed. The background timer is started only when
`OPENCLAW_BOUNDED_OPERATOR_SCHEDULER_ENABLED=1`; the default is disabled.

This is controlled delayed execution, not long-running autonomy. A future
unbounded resident loop would require a separate product decision, resource
budget, approval model, recovery proof, and release gate.

The subsequent finite continuation is recorded separately in
[`OPENCLAW_BOUNDED_OPERATOR_WINDOW_LEASE_PLAN.md`](./OPENCLAW_BOUNDED_OPERATOR_WINDOW_LEASE_PLAN.md).
It adds a hard-deadline lease with at most eight windows while preserving this
workpackage's no-open-loop boundary; it does not reopen the six workpackages.

### Effectiveness

`GET /plugins/native-adapter/engineering-context/experience-effectiveness`
returns bounded aggregates by task type. It reports completed/failed terminal
records, completion rate, feedback observations, and whether downstream
advisory application was observed. It explicitly reports
`causalAttribution=false` and `policyInfluence=false`, emits an audit event,
and never mutates experience records or execution policy.

### Privileged Boundary

The following ids are known by the capability registry so an attempted use is
diagnosable rather than an ambiguous 404:

```text
act.host.root
act.host.mutate
sense.desktop.capture
act.desktop.input
act.process.any
act.window.any
```

They are marked `deferred`, `unavailable`, and `critical`. Invocation returns
`403 privileged_capability_deferred` before policy evaluation or backend
dispatch, records a compact blocked audit, and does not echo request
parameters. Existing bounded work-view, screen-act, hostd, and system-sense
owners remain the only valid routes for their narrower capabilities.

## Evidence

- Core test suite: 918/918 passed.
- Observer test suite: 97/97 passed.
- Core and Observer typecheck/build checks passed.
- Privileged boundary integration tests prove registry visibility, HTTP 403,
  no policy/backend dispatch, no parameter echo, and deferred health state.
- Scheduler tests prove explicit arm, one-shot consumption, restart blocking,
  and no retry/continuation.
- Existing recovery, work-view association, and experience-memory tests remain
  green.

## Deployment Rule

Build a clean NixOS candidate from the reviewed source, inspect its physical
target marker and protected-path closure, then invoke only:

```bash
sudo -n nixsoma-dev-generation-switch /nix/store/<candidate-nixos-system>
```

The helper must reject non-canonical, non-physical, or protected-path-changing
closures. Do not substitute `sudo nixos-rebuild switch`, pass a password,
enable the scheduler during deployment, or reboot as part of this workpackage.

## Next Slice

With deployment proof complete, freeze this six-workpackage slice. The next
finite continuation is owned by
[`OPENCLAW_BOUNDED_OPERATOR_WINDOW_LEASE_PLAN.md`](./OPENCLAW_BOUNDED_OPERATOR_WINDOW_LEASE_PLAN.md).
After that slice, product work must again be selected from a concrete missing
user workflow, not another nested readiness shell. Unbounded autonomy, causal
learning, broader body nerves, and physical Phase D evolution remain separate
design and authorization decisions.

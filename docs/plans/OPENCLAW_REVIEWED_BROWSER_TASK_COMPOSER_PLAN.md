# Reviewed Browser Task Composer

Updated: 2026-08-01

Status: implemented and accepted in source, isolated real development services,
and store-native Core/Observer closures. Physical generation deployment is not
part of this slice.

## Selected Capability

Replace the Observer demo-only task entry with one real operator-authored task
workflow:

```text
bounded goal + credential-free HTTP(S) URL
-> Core reviewed submission contract
-> current browser task or capability-aware plan
-> existing work-view prepare/navigation/bind
-> explicit Operator Step/Run remains separate
```

This is a product-entry capability, not another receipt or provider wrapper.

## Contract

- Observer accepts one 1-400 character single-line goal and one HTTP(S) URL,
  then sends only `goal`, `targetUrl`, and boolean `includePlan`.
- Core is authoritative. It rejects extra fields, caller actions, policy,
  credential-bearing URLs, non-HTTP(S) schemes, control characters, oversized
  goals/URLs, and non-boolean plan mode.
- Core fixes `type=browser_task`, `workViewStrategy=ai-work-view`, and
  `intent=task.execute`, supplies an explicit zero-action list, then reuses
  existing task policy, persistence, event, supersession, plan, and public
  serialization owners. The planner now distinguishes this explicit empty list
  from a missing action list that retains legacy demo compatibility.
- Create Task reuses existing work-view prepare/navigation/bind. Create Plan
  returns the existing capability-aware plan without navigation or execution.
- Neither mode starts Operator Step/Run, accepts action payloads, creates an
  approval, calls a provider, continues automatically, or mutates the host.
- Local HTTP fixtures remain allowed for development; Browser Runtime retains
  final network and navigation enforcement when a task is later executed.

## Evidence

- Contract tests cover fixed authority, bounded Unicode goals, local fixtures,
  extra-field rejection, URL credentials/schemes, controls, and limits.
- Production route assembly proves reviewed plan creation, compact governance,
  and task-created/task-planned events without execution.
- Observer tests prove real goal/URL submission, work-view binding only for
  Create Task, plan-only behavior, empty-goal rejection, and removal of the
  demo control.
- The existing real operator-loop gate creates the second task through the new
  reviewed route and completes its zero-caller-action navigation plan.
- Store validation requires the new Core and Observer modules in exact 272-file
  and 98-file closures.

Acceptance on 2026-08-01 passed 62 focused tests, all 1290 workspace tests,
workspace typecheck, generated-client syntax, the exact seven-check `@changed`
selection, three structural gates, the real operator-loop and Observer service
gates, and resource-bounded body-config. The operator-loop created and completed
one reviewed zero-action navigation plan, then preserved it across Core restart.
The read-only Core closure is
`/nix/store/sf70j4229n3c7w69lbaydz96lqxbyfnm-openclaw-core-0.1.0`; the Observer
closure is
`/nix/store/6jp45ynd3cq0shvrmfgkqzdk6m5hl088-openclaw-observer-ui-0.1.0`.
The first body-config pass exposed the missing new Observer module in its
explicit Nix manifest; after adding that ownership entry, exact 272/98-file
closure validation passed. Nix used one job and two cores, peak observed
temperature stayed below 50 C, and swap remained unused. No provider request,
physical service mutation, generation switch, or reboot occurred.

## Deferred

- automatic execution, scheduling, retries, open loops, and long-running
  autonomy;
- caller-authored actions, policy, approvals, provider selection, or arbitrary
  task types;
- browser credential URLs, non-HTTP(S) resources, and broad desktop control;
- physical generation activation, host mutation, switch, and reboot.

## Next Real Capability

After acceptance, freeze task submission and reassess the next operator-visible
workflow gap. Do not turn this composer into a generic action/policy editor or
automatic task runner.

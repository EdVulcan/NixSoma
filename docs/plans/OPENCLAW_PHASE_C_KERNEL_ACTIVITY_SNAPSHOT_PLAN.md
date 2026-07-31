# Phase C Kernel Activity Snapshot Plan

Status: source, closure, Observer, and disposable-KVM acceptance complete;
physical deployment deferred, 2026-07-31

## Purpose

Turn the three completed Phase C body nerves into one operator-visible body
state without adding another kernel hook. One explicit request starts the
existing process-exec, network connect-attempt, and file open-attempt captures
in parallel and returns only a compact three-lane snapshot.

## Capability Contract

- Endpoint: `/system/kernel/activity-snapshot` through System Sense and the
  existing Core read-only proxy.
- Trigger: explicit Observer button or exact GET; the aggregate function is not
  registered in Observer's five-second refresh interval.
- Capture owners: the existing three probe owners remain unchanged and retain
  their own limits, field validation, and continuity state.
- Aggregate concurrency: one snapshot at a time. A concurrent aggregate request
  returns `busy`; a busy or unavailable underlying lane produces truthful
  `partial` or `unavailable` state without retry.
- Returned data: lane registry/status/availability, event and unique-value
  counts, plus compact continuity status/sequence/activity/new-comm count.
- Explicit omissions: raw events, comm names/count lists, executable identity,
  address/family values, file flags/mode/path/name/content/result, and capture
  timestamps.
- Governance: read-only, in-memory, no persistence, no automatic repeat, no
  provider/browser activity, no policy execution, and no host mutation.

## Evidence

- `kernel-activity-snapshot.test.mjs` proves complete/partial/busy behavior,
  simultaneous invocation, compact projection, and private-field omission.
- System Sense and Core production-shape route tests prove the exact existing
  proxy path.
- Observer assembly tests prove the explicit button and absence from automatic
  intervals.
- `openclaw-kernel-activity-snapshot` and its Observer pair are installed-host
  gates for a future separately authorized generation.
- `checks.x86_64-linux.openclaw-kernel-activity-snapshot-vm` is the disposable
  KVM release gate for all three real probes in one capture window. It passed
  with 208 compact events: 40 process exec, 40 network connect-attempt, and 128
  file open-attempt events. All three lanes were available and captured while
  raw metadata, persistence, automatic repeat, provider/browser activity, and
  host mutation remained false.
- The store-native body configuration check passed with the staged System Sense
  and Observer closures. Both installed-host milestone gates remain deferred
  until a separately authorized physical generation deployment.

## Deliberately Deferred

- a fourth eBPF hook or widened event fields;
- continuous background aggregate capture or automatic retries;
- raw-event aggregation, persistence, black-box storage, or cross-restart
  continuity;
- anomaly inference, policy enforcement, actions, provider assessment, browser
  work, and host mutation;
- physical generation activation and rollback.

## Stop Condition

This aggregate is frozen after focused, closure, and disposable-KVM evidence
passed. Physical deployment requires separate authorization. The next canonical
review must choose a distinct operator capability, not another snapshot variant.

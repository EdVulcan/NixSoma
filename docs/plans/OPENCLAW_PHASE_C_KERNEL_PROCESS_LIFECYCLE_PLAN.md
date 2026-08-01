# Phase C Kernel Process Lifecycle Observation Plan

Status: source implementation, focused validation, exact closure, and
disposable-KVM acceptance complete, 2026-08-01

## Purpose

Extend the existing read-only process-exec nerve with bounded process-exit
observation. One explicit lifecycle snapshot then reports whether process
starts and exits were observed during two concurrent capture windows, without
turning the body nerve into a process inventory, a policy engine, or an action
owner.

## Identity Alignment

- Whitepaper level: Phase C, Level 3 read-only kernel body observation.
- Runtime owner: store-native `openclaw-system-sense`.
- User-visible result: Core and Observer expose a compact two-lane lifecycle
  snapshot with event counts, lane availability, and in-memory continuity.
- Privilege boundary: System Sense receives the same bounded `CAP_BPF` and
  `CAP_PERFMON` envelope as the existing process-exec observation; hostd
  authority is unchanged.
- Deployment boundary: source and disposable-VM proof are separate from
  physical generation activation. This slice does not authorize a host switch,
  reboot, rollback, or process control.

## Implementation Contract

- Attachment: libbpf `raw_tracepoint/sched_process_exit`.
- Internal event fields: timestamp, PID, UID, and bounded command name. These
  fields are consumed by the System Sense readback owner and are not returned
  by the public lifecycle snapshot.
- Transport: libbpf ring buffer with a capture window of at most five seconds
  and at most 4096 internal events.
- Snapshot: the existing process-exec owner and the new process-exit owner run
  concurrently behind one single-flight aggregate. The result contains only
  lane status, event counts, unique-count summaries, and compact continuity.
- Privacy boundary: the public snapshot contains no raw events, process-name
  values, PID values, UID values, executable identity, or exit status/signal.
- Runtime behavior: explicit request only, in-memory state only, no retry, no
  persistence, no provider/browser activity, no policy execution, and no host
  mutation.
- Integration: the existing Core System Sense proxy, one explicit Observer
  panel/button, exact Nix source closures, changed-check mapping, installed
  service checks, and a disposable NixOS VM release gate.

## Evidence

- System Sense capture/readback tests prove the event allowlist, bounded
  parsing, redacted failures, busy serialization, compact counts, and
  in-memory continuity.
- The aggregate tests prove simultaneous process-start/process-exit capture,
  complete/partial/unavailable states, single-flight behavior, and omission of
  raw process metadata.
- System Sense, Core proxy, and Observer tests prove the exact route,
  served panel, client assembly, and absence from automatic refresh intervals.
- `dev-body-config-check.sh` proves the process-exit source closure, probe
  artifacts, service environment, and capability boundary.
- `openclaw-kernel-process-lifecycle-snapshot` and its Observer pair are the
  targeted real-service gates. The VM check is the disposable release proof
  that both lanes capture real churn while the public result remains compact.
- `checks.x86_64-linux.openclaw-kernel-process-lifecycle-snapshot-vm` passed in
  disposable KVM: the Core proxy captured 55 process-start and 55 process-exit
  events, both lanes were available, the served Observer panel/client tokens
  were present, all four services were active, and failed-unit output was
  empty. The public result retained no raw process metadata.

## Deliberately Deferred

- executable path, parent/child identity, cgroup/service ownership, exit code,
  signal, CPU/memory attribution, and cross-capture process correlation;
- persistent process history, black-box storage, anomaly inference, causal
  learning, policy enforcement, provider assessment, browser work, and
  automatic actions;
- arbitrary process control, root authority, physical rollback, and automatic
  NixOS generation mutation.

## Stop Condition

Freeze this lane after focused tests, exact store closure, and disposable-KVM
proof pass. This lane is now frozen. A future process diagnosis or control capability requires a new
route review and a separate privacy/governance contract; it must not be added
as polish to this snapshot.

## Physical Deployment Rule

The current physical host remains evidence-only for this slice. A future
physical deployment would require the existing immutable-generation candidate
review, protected-path checks, explicit operator authorization, and post-switch
health evidence. No `sudo`, `nixos-rebuild switch`, reboot, rollback, or host
mutation is part of this source completion.

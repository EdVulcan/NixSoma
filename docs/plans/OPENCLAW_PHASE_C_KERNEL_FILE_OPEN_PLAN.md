# Phase C Kernel File Open Observation Plan

Status: source implementation, focused validation, closure validation,
disposable-KVM acceptance, and physical deployment complete, 2026-07-31

## Purpose

Extend the Level 3 read-only kernel body nerves with one privacy-bounded file
open-attempt observation. The capability answers which local process attempted
an `openat2` call and which numeric flags and mode it supplied. It does not
identify the file and cannot determine whether the call succeeded.

## Identity Alignment

- Whitepaper level: Phase C, third read-only kernel nerve.
- Runtime owner: store-native `openclaw-system-sense`.
- User-visible result: Core and Observer expose bounded recent file open-attempt
  metadata and an in-memory continuity summary.
- Privilege boundary: the existing System Sense owner receives only `CAP_BPF`
  and `CAP_PERFMON`; hostd authority is unchanged.
- Deployment boundary: the exact reviewed generation was activated through the
  fixed developer-generation helper after separate operator authorization. No
  reboot, rollback, arbitrary sudo command, or other host mutation was used.

## Implementation Contract

- Attachment: `fentry/do_sys_openat2`.
- Transport: libbpf ring buffer with a capture window of at most five seconds
  and at most 4096 events.
- Exact event fields: `timestampNs`, `pid`, `uid`, `comm`, `flags`, and `mode`.
- Privacy boundary: the eBPF program deliberately ignores the filename pointer.
  Path, filename, content, inode, mount identity, and syscall result never enter
  the event contract.
- Numeric boundary: `flags` and `mode` are canonical decimal strings validated
  against the full unsigned 64-bit range.
- Runtime behavior: one capture at a time, no retry, no policy execution, no
  persistence, and no automatic action.
- Integration: the existing generic Core System Sense proxy, a dedicated
  Observer panel, exact Nix source closures, changed-check mapping, installed
  service gates, and a disposable NixOS VM release gate.

## Evidence

- System Sense capture/readback tests prove the six-field allowlist, uint64
  bounds, rejection of extra path/content fields, redacted failures, busy
  serialization, deterministic summaries, and in-memory continuity.
- The System Sense route test proves `/system/kernel/file-open-events`; no new
  Core route family is required because the existing generic proxy owns it.
- The Observer test proves served panel and client refresh assembly without a
  path field.
- `dev-body-config-check.sh` proves probe and service source closures, desktop
  enablement, probe environment, and the existing capability boundary.
- `openclaw-kernel-file-open-capture` and its Observer pair passed on physical
  generation `qcv5ggpr...`. Each captured the configured 128-event maximum;
  the first saw six unique comm values and the second five, both saw four flag
  values, and continuity advanced from `baseline` to `compared`.
- `checks.x86_64-linux.openclaw-kernel-file-open-capture-vm` loaded the real
  fentry probe and captured exactly the configured 128-event maximum, including
  validation `cat` processes, three unique comm values, and four unique flag
  values. It also proved Core/Observer readback, healthy services, zero failed
  units, and all explicit no-path/no-mutation boundaries.
- The first KVM pass exposed the missing Core read-only proxy allowlist entry.
  The second exposed that one libbpf poll batch could invoke the callback after
  the event limit. The final implementation adds the exact proxy path and
  enforces the output cap at callback entry; the third KVM run passed.

## Deliberately Deferred

- physical rollback;
- filename, path, content, inode, mount, file descriptor, and return-value
  capture;
- VFS-wide tracing, blocking, policy enforcement, or arbitrary probes;
- persistence, automatic actions, provider egress, browser activity, and
  runtime host mutation.

## Stop Condition

Freeze this lane after focused tests, exact closures, and disposable KVM proof
pass. Do not add path capture, an `fexit` outcome hook, or enforcement as polish.
Those are distinct higher-risk capabilities requiring a concrete operator need
and a fresh route decision.

## Physical Closure

Candidate
`/nix/store/qcv5ggprl82xv75nc8nhkblnb53v759k-nixos-system-nixos-26.05.4808.569d57850992`
matched the current physical marker and the exact kernel, initrd, fstab, GDM,
NetworkManager, and SSH store targets. Its closure changed only Core, System
Sense, Observer, and the kernel probe. The fixed passwordless helper activated
it without reboot; current and system-profile links match, and the boot ID
remained `0fe071ee-879d-4f65-b037-6cea208ca7cd`.

After both installed gates, all nine health endpoints and system/user services
were active, failed-unit counts were zero, relevant restart counts were zero,
and warning journals were empty. Path, filename, content, inode, mount identity,
syscall result, persistence, policy execution, provider activity, browser
activity, and additional host mutation remained absent. Freeze this lane.

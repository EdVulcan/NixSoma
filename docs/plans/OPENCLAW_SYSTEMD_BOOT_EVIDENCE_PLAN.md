# OpenClaw Systemd Boot Evidence Plan

Updated: 2026-07-31

Status: deployed in physical generation `1xh4x8ls...`; direct System Sense and
Core proxy live probes return HTTP 200. The registered Core/Observer acceptance
record remains to be closed.

## Capability

The concrete operator gap is explaining whether the previous boot ended with a
bounded systemd reboot or poweroff sequence, an abnormal watchdog, kernel fault,
OOM, or Ctrl+Alt+Delete marker after an unexpected restart. The capability is a
read-only system-sense route:

```text
GET /system/systemd/boot-evidence
```

It reads a bounded `journalctl --list-boots --output=json` summary, at most 64
terminal records from `--boot=-1`, and the current kernel boot ID. It returns
only boot IDs, timestamps, duration, a finite classification, marker names,
inspection count, and governance metadata. Journal messages are inspected
transiently and are never returned, persisted, sent to a provider, or shown in
Observer.

## Identity Level

This is a Level 3 body-sense read model. It extends the existing systemd
journal/health observation owner without adding hostd, recovery, task,
approval, provider, or physical-mutation authority.

## Evidence

- `services/openclaw-system-sense/src/systemd-boot-evidence.mjs` owns parsing,
  classification, boot-ID normalization, and the fixed command shape.
- `services/openclaw-system-sense/src/systemd-routes.mjs` exposes the route;
  Core exposes the same response through its read-only system-sense proxy.
- Observer renders current/previous boot, classification, marker names, and
  read-only governance without journal entries.
- Unit tests cover explicit reboot, UUID normalization, abnormal watchdog,
  unknown cause, route dispatch, and failure redaction.
- `dev-openclaw-systemd-boot-evidence-check.sh` and
  `dev-observer-openclaw-systemd-boot-evidence-check.sh` prove real local
  service access, Core proxy binding, Observer output, and no journal payload.
- Physical generation
  `/nix/store/1xh4x8ls64yzl919j2bssd9ilms98knv-nixos-system-nixos-26.05.4808.569d57850992`
  contains the route. Direct deployed System Sense and Core proxy requests both
  return HTTP 200.
- The deployed read model reports the previous boot as
  `explicit_reboot_sequence` with reboot and shutdown markers. It does not
  prove the original trigger or user intent.

## Governance Boundary

The route remains `read_only`, `observe_only`, and command-argument-bound. It
does not create tasks or approvals, trigger recovery, schedule follow-up,
persist evidence, expose journal text, or mutate the host. A classification is
bounded evidence, not a causal proof. Normal hardware-watchdog shutdown
messages and normal OOM-service lifecycle messages are excluded from abnormal
cause markers.

## Remaining Acceptance

This lane needs proof reconciliation, not another deployment:

1. Run `dev-openclaw-systemd-boot-evidence-check.sh` and
   `dev-observer-openclaw-systemd-boot-evidence-check.sh` from the current
   checkout.
2. Recheck the deployed direct and Core proxy route and bind the compact result
   to generation `1xh4x8ls...`, current/previous boot IDs, classification,
   marker names, and the no-journal-payload boundary.
3. Record the raw compact result in ignored timing/acceptance evidence, then
   summarize its generation, boot binding, classification, and gate result in
   this committed plan and update the status to accepted. Freeze the
   boot-evidence lane afterward.

The acceptance must not switch generations, reboot, call a provider, drive the
browser, trigger recovery, persist journal text, or mutate the host.

## Deferred

- Kernel crash-dump, pstore, hardware reset-reason, or firmware evidence.
- Recovery, automatic restart, watchdog policy, OOM policy, and user-intent
  inference.
- Arbitrary journal queries or journal-message display in Observer.

## Next Capability

After the remaining acceptance closes, continue with the task-bound semantic
activation/submit candidate in
[`OPENCLAW_AI_WORKSPACE_SEMANTIC_SUBMIT_CANDIDATE_PLAN.md`](./OPENCLAW_AI_WORKSPACE_SEMANTIC_SUBMIT_CANDIDATE_PLAN.md).
Do not add another boot marker, evidence wrapper, or readback variant until a
concrete operator gap requires it.

# Bounded Operator Work Session Continuity

Updated: 2026-08-01

Status: implemented in source with focused Core/Observer tests and an isolated
real-service restart/resume check. Physical generation deployment, browser live
gates, provider calls, and host mutation remain outside this slice.

## Selected Capability

Keep one explicit finite operator run inspectable and recoverable across a Core
restart without creating an open loop:

```text
explicit finite run
-> durable session record
-> per-step checkpoint
-> Core restart marks an unfinished run interrupted
-> Observer exposes a resumable session
-> explicit Resume consumes only the saved remaining budget
```

This is a Level 1 user-space control-plane capability. It makes recovery of a
bounded local run real while preserving the existing task, policy, approval,
execution, verification, and stop-condition owners.

## Contract

- A non-preview `POST /operator/run` creates one session with a strict 1-20
  step budget. A preview remains read-only and creates no session.
- Core flushes the session state after creation, every completed step, an
  interruption/failure, a terminal result, and an explicit Resume transition.
- Startup converts any persisted `running` session into `interrupted` with
  `stopReason=core_restart`; it never resumes work automatically.
- `POST /operator/resume` accepts only `{ sessionId, confirm: true }`. It takes
  the server-stored `remainingSteps`; caller task, action, URL, policy, and
  budget overrides are rejected or ignored before dispatch.
- Session readbacks contain only registry, session id, status, step counts,
  task id reference, bounded timestamps, stop reason, and governance flags. They
  do not contain task goals, action parameters, provider content, input text,
  URLs, or credentials.
- A paused, blocked, or interrupted session can be resumed only while it has
  remaining budget and no other run is active. Completed sessions are not
  resumable.
- Existing write-only input restart protection remains authoritative: a queued
  task containing transient keyboard or semantic type input becomes
  `input_reentry_required` after Core restart rather than replaying plaintext.
- Observer shows the latest resumable session, remaining steps, and an explicit
  `Resume Interrupted Run` control. It does not poll, retry, schedule, or
  dispatch an implicit resume.

## Evidence

- `services/openclaw-core/test/operator-run-session.test.mjs`: 4/4 session
  manager tests pass, covering checkpointing, startup interruption, and strict
  Resume request validation.
- `services/openclaw-core/test/route-handlers.test.mjs`: 52/52 pass,
  including bounded run and remaining-budget Resume route contracts.
- `apps/observer-ui/test/client-script-runtime-operator-session.test.mjs`:
  5/5 pass, including selected-session Resume forwarding and panel tokens.
- Touched JavaScript syntax checks and `bash -n` for the control check pass;
  `git diff --check` passes.
- `bash nix/scripts/dev-operator-control-check.sh` passes with an isolated
  run-scoped token/state/event set. Its real local service flow starts all nine
  services, checkpoints a paused session, cleanly restarts the dev services,
  restores the session with two remaining steps, and accepts one explicit
  Resume that executes one task. The same lane preserves the existing
  write-only-input restart rejection behavior.

## Deferred

- background scheduling, automatic resume, automatic retry, and task replay;
- checkpointing an in-flight action as exactly-once execution;
- changing or extending task/action/provider/credential authority;
- provider egress, browser live deployment, physical generation activation,
  privileged host mutation, and reboot;
- long-term learning or autonomous multi-session planning.

## Stop Condition

Freeze this continuity lane after the focused tests, served Observer contract,
isolated restart/resume check, and documentation closure. The next route review
must select a distinct whitepaper capability, preferably the smallest remaining
Level 2 trusted work-view/session-helper behavior, rather than adding scheduler
or Resume variants to this Level 1 session owner.

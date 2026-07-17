# Phase D: Declarative Evolution Candidate

## Status

Complete on 2026-07-17 as the first bounded Phase D capability.

## Delivered Capability

OpenClaw can now build a structured, allowlisted candidate for the managed
NixOS fragment at `/etc/nixos/openclaw-managed.nix` through:

```text
POST /plugins/native-adapter/declarative-evolution/candidate
plan.openclaw.declarative_evolution.managed_config_candidate
```

The accepted changes are deliberately narrow:

```text
enable_component
enable_kernel_event_capture
set_kernel_event_capture_limits
```

Component names, numeric limits, operation count, duplicate operations, and
unknown fields are rejected. OpenClaw renders the Nix module itself; callers
cannot submit raw Nix text, shell commands, paths, credentials, or arbitrary
options.

The candidate is written to a temporary file and checked with
`nix-instantiate --eval --json --strict`. The validator forces the generated
module with a minimal `lib.mkAfter` implementation and requires an attribute
set result. The candidate text is returned only in the current response. The
capability invocation ledger and events retain the candidate hash, byte count,
validation status, target path, and governance flags only.

## Governance Boundary

This slice does not:

```text
write /etc/nixos/openclaw-managed.nix
create a task or approval
run nixos-rebuild
switch to a new system generation
run rollback
read credentials
call a provider or use the network
```

The candidate is therefore a real, validated input to the future declarative
evolution loop, not an automatic self-modification path.

## Evidence

```text
services/openclaw-core/src/native-declarative-evolution-builders.mjs
services/openclaw-core/src/capability-runtime-declarative-evolution.mjs
services/openclaw-core/test/native-declarative-evolution-builders.test.mjs
services/openclaw-core/test/capability-runtime.test.mjs
services/openclaw-core/test/native-adapter-plugin-routes.test.mjs
nix/scripts/dev-capability-invoke-check.sh
```

The focused builder, capability-runtime, and route tests pass. The existing
Core capability integration check passes with real services and confirms a
real `nix-instantiate` validation result of `set`.

## Next Real Slice

The next step is an explicitly approved staging task that binds one validated
candidate hash to an OpenClaw-owned staging file, then runs a bounded
read-only NixOS evaluation/build check against that exact candidate. Host
activation, health-gated switching, and physical rollback remain separate
follow-up capabilities; none may be inferred from candidate validation.

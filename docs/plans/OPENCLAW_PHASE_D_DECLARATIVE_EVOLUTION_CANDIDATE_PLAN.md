# Phase D: Declarative Evolution Candidate

## Status

Complete on 2026-07-17 as the first bounded Phase D capability and its
approval-bound staging/build loop.

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

The next staging slice is also complete through:

```text
POST /plugins/native-adapter/declarative-evolution/staging-tasks
act.openclaw.declarative_evolution.staging_task
```

After explicit confirmation and approval, Core rebuilds the candidate from its
structured changes, requires the same SHA-256 candidate hash, writes the exact
candidate to an OpenClaw-owned staging directory, and runs `nix-instantiate`,
`nix eval`, and a no-link read-only `nix build` check against that file. The
candidate body remains transient; task, approval, state, and events retain
only compact hash/path/validation metadata.

## Evidence

```text
services/openclaw-core/src/native-declarative-evolution-builders.mjs
services/openclaw-core/src/capability-runtime-declarative-evolution.mjs
services/openclaw-core/src/native-declarative-evolution-execution.mjs
services/openclaw-core/src/native-declarative-evolution-task-builders.mjs
services/openclaw-core/src/native-declarative-evolution-task-routes.mjs
services/openclaw-core/src/task-executor-native-declarative-evolution-handlers.mjs
services/openclaw-core/test/native-declarative-evolution-builders.test.mjs
services/openclaw-core/test/native-declarative-evolution-execution.test.mjs
services/openclaw-core/test/native-declarative-evolution-task-builders.test.mjs
services/openclaw-core/test/native-declarative-evolution-task-routes.test.mjs
services/openclaw-core/test/capability-runtime.test.mjs
services/openclaw-core/test/native-adapter-plugin-routes.test.mjs
nix/scripts/dev-openclaw-native-declarative-evolution-staging-common-check.sh
nix/scripts/dev-openclaw-native-declarative-evolution-staging-check.sh
nix/scripts/dev-observer-openclaw-native-declarative-evolution-staging-check.sh
nix/scripts/dev-capability-invoke-check.sh
```

The focused builder, execution, task-builder, route, capability-runtime, and
executor tests pass. The Core and Observer staging checks pass with real
services. Core proves approval binding, staging-file hash equality, real
`nix-instantiate`, `nix eval`, and read-only `nix build --dry-run` evidence;
Observer proves the generic capability registry, blocked confirmation path,
invocation history, and no candidate-text exposure.

## Next Real Slice

The next mainline slice is a read-only health-gate assessment bound to the
same staged candidate and its evaluated system closure. It may report whether
the candidate is eligible for a future activation decision, but it must not
switch a generation, mutate `/etc/nixos`, run rollback, or infer host health
from build success. Host activation and physical rollback remain separate
follow-up capabilities.

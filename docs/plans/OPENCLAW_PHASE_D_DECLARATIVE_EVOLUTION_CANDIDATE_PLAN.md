# Phase D: Declarative Evolution Candidate

## Status

Complete on 2026-07-18 as the first bounded Phase D capability, its
approval-bound staging/build loop, read-only health-gate assessment, explicit
host-health-bound activation decision boundary, and controlled hostd activation
contract. Physical generation activation remains disabled by default.

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

The read-only health-gate slice is complete through:

```text
GET /plugins/native-adapter/declarative-evolution/health-gate?taskId=...
sense.openclaw.declarative_evolution.health_gate
```

For a completed staging task, Core re-reads the exact OpenClaw-owned staging
file, recomputes its hash and byte count, verifies the candidate/approval/
execution bindings, reads the current approval record, and re-queries the
evaluated `/nix/store/...` output through `nix path-info`. The gate requires the
observed output path, deriver, NAR hash, staging bytes, and approval record to
remain bound to a tamper-evident closure-integrity receipt. A passing assessment
is `eligible_for_activation_review`; host health remains `not_assessed`.

The explicit activation-decision boundary is complete through:

```text
GET /plugins/native-adapter/declarative-evolution/activation-decision?taskId=...
POST /plugins/native-adapter/declarative-evolution/activation-decisions
act.openclaw.declarative_evolution.activation_decision
```

Core now reads the host health endpoint from `openclaw-system-sense`, binds the
candidate hash, staged-file hash, closure-integrity receipt, and host-health
hash into one decision, and rejects approval creation when the host is not healthy. The
approved task revalidates that binding before recording either
`approved_for_future_activation` or `rejected`. It never writes managed
configuration, switches a generation, runs `nixos-rebuild`, activates a
generation, or rolls back.

The controlled Level 3 activation contract is also present through:

```text
POST /plugins/native-adapter/declarative-evolution/activation-tasks
act.openclaw.declarative_evolution.activation
hostd.activate_managed_config
```

Core accepts only a completed approved activation-decision task and carries the
candidate hash, staged-file hash, fixed staging path, evaluated closure path,
health fingerprint, task lineage, and bounded expiry into the activation task.
Execution revalidates those fields, requires the generic step-bound approval,
calls hostd only through its Unix socket peer boundary, validates an immutable
receipt, and reads post-action health through `openclaw-system-sense`. The hostd
descriptor fixes the target to `/etc/nixos/openclaw-managed.nix` and the command
to the configured flake rebuild; `OPENCLAW_HOSTD_ACTIVATION_ENABLED=false` is
the default, so the real NixOS mutation remains opt-in and is not exercised by
the daily milestone.

When a validated hostd receipt reports a successful generation switch but the
independent post-activation health oracle reports a non-healthy result, Core
now records a bounded manual rollback evidence object. It binds the activation
receipt hash and pre/post health hashes, names `deferred_manual_operator` as the
rollback owner, and recommends operator review. It does not create a task or
approval, call hostd again, execute rollback, or enable automatic recovery.

The Core/Observer staging pair additionally proves that `confirm=false` creates
no activation task or approval and performs no hostd call, managed-config write,
generation switch, or rollback. The hostd protocol rejects oversized input,
non-canonical or out-of-window expiry, target widening, replayed request IDs,
and unmatched peer identity. Generic `planId + stepId + requestHash` approval
bindings are accepted by the staging, decision, and activation executors while
the historical binding shape remains readable for compatibility.

## Evidence

```text
services/openclaw-core/src/native-declarative-evolution-builders.mjs
services/openclaw-core/src/capability-runtime-declarative-evolution.mjs
services/openclaw-core/src/native-declarative-evolution-execution.mjs
services/openclaw-core/src/native-declarative-evolution-closure-integrity.mjs
services/openclaw-core/src/native-declarative-evolution-health-gate.mjs
services/openclaw-core/src/native-declarative-evolution-host-health-oracle.mjs
services/openclaw-core/src/native-declarative-evolution-rollback-evidence.mjs
services/openclaw-core/src/native-declarative-evolution-paths.mjs
services/openclaw-core/src/native-declarative-evolution-task-builders.mjs
services/openclaw-core/src/native-declarative-evolution-task-routes.mjs
services/openclaw-core/src/native-declarative-evolution-activation-decision.mjs
services/openclaw-core/src/task-executor-native-declarative-evolution-handlers.mjs
services/openclaw-core/src/task-executor-native-declarative-evolution-activation-handlers.mjs
services/openclaw-core/src/task-executor-native-declarative-evolution-activation-execution-handlers.mjs
services/openclaw-core/test/native-declarative-evolution-builders.test.mjs
services/openclaw-core/test/native-declarative-evolution-execution.test.mjs
services/openclaw-core/test/native-declarative-evolution-closure-integrity.test.mjs
services/openclaw-core/test/native-declarative-evolution-health-gate.test.mjs
services/openclaw-core/test/native-declarative-evolution-rollback-evidence.test.mjs
services/openclaw-core/test/native-declarative-evolution-task-builders.test.mjs
services/openclaw-core/test/native-declarative-evolution-task-routes.test.mjs
services/openclaw-core/test/native-declarative-evolution-activation-decision.test.mjs
services/openclaw-core/test/task-executor-native-declarative-evolution-activation-handlers.test.mjs
services/openclaw-core/test/task-executor-native-declarative-evolution-activation-execution-handlers.test.mjs
services/openclaw-core/test/task-executor-native-declarative-evolution-staging-handlers.test.mjs
services/openclaw-core/test/native-declarative-evolution-activation.test.mjs
services/openclaw-core/test/capability-runtime.test.mjs
services/openclaw-core/test/native-adapter-plugin-routes.test.mjs
nix/scripts/dev-openclaw-native-declarative-evolution-staging-common-check.sh
nix/scripts/dev-openclaw-native-declarative-evolution-staging-check.sh
nix/scripts/dev-observer-openclaw-native-declarative-evolution-staging-check.sh
nix/scripts/dev-capability-invoke-check.sh
apps/observer-ui/src/observer-panels-declarative-evolution.mjs
apps/observer-ui/src/client-script-config-dom-declarative-evolution.mjs
apps/observer-ui/src/client-script-refreshers-declarative-evolution.mjs
apps/observer-ui/src/client-script-renderers-declarative-evolution.mjs
apps/observer-ui/test/client-script-declarative-evolution.test.mjs
services/openclaw-hostd/src/hostd-activation-protocol.mjs
services/openclaw-hostd/src/managed-config-activation.mjs
services/openclaw-hostd/test/hostd-activation.test.mjs
packages/shared-systemd/src/openclaw-hostd-activation.mjs
```

The focused builder, closure-query/receipt, execution, task-builder, route,
capability-runtime, hostd, and executor tests pass. The Core positive lane now
uses the installed read-only NixOS `nixos` channel on this host when available,
records that `nixpkgsSource`, and proves real `nix-instantiate`, `nix eval`,
`nix build --no-link --print-out-paths`, `nix path-info` deriver/NAR binding,
task-bound receipt stability, current approval-record lookup, healthy-host
revalidation, and approved future activation without mutation. The Observer
pair proves the served activation panel, bounded closure status readback,
capability registry, blocked confirmation and missing-task fail-closed paths,
invocation history, and no candidate-text exposure. The pinned `26.11` flake
remains the default outside this host optimization; its cold materialization
can exceed the bounded check timeout. No managed config write, generation
switch, activation, or rollback is performed.

## Next Real Slice

The closure-integrity receipt contract, positive real-output materialization
proof, and fail-closed daily lane are complete. The Core-owned
`openclaw-native-declarative-evolution-host-health-oracle-v0` now independently
evaluates fresh bounded system-sense facts and emits the authority split used
by the activation decision and post-action readback: health is owned by the
oracle, activation by fixed `openclaw-hostd`, and rollback by a manual operator.
This is an independent decision module, not a separate privileged daemon. The
Core manual rollback evidence contract is now also complete for the
post-activation health-failure path. The next mainline slice is a
physical-host-safe activation/health-failure rehearsal: inject a validated
hostd receipt and degraded/unavailable oracle result through the existing
user-space executor/test boundary, then prove the task and Observer readback.
It must not connect to the real hostd socket, write `/etc/nixos`, run
`nixos-rebuild`, switch a generation, or execute rollback. A disposable VM may
be a later release gate if one is provisioned; it is not a current workspace
precondition.

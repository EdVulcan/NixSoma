# OpenClaw Native Engineering Workbench State Auto-Restore Plan

Updated: 2026-07-09

## Active Slice

Native governed engineering workbench state auto-restore on Observer startup.

This slice calls the read-only engineering loop restoration flow during Observer
startup when no browser-local engineering loop state exists. It improves
operator continuity after page reloads without creating tasks, approvals, or
execution paths.

Identity alignment: Level 1, stable user-space control plane.

## Implemented Behavior

Observer startup now runs:

```text
await autoRestoreEngineeringLoopStateOnStartup();
```

The startup hook:

```text
checks whether latestEngineeringLoopControlState already exists
calls restoreEngineeringLoopStateFromHistory({ startup: true }) only when local state is empty
reads /tasks?limit=20 through the existing restoration path
updates Engineering Loop State when a restorable engineering task is found
quietly leaves the panel in a no-restorable-history state when none exists
```

## Boundaries

Auto-restore is read-only. It does not:

```text
create tasks
create or resolve approvals
run operator step
execute commands
mutate files or task state
call providers or perform network egress
read credentials
create result envelopes
```

## Evidence

Observer implementation:

```text
apps/observer-ui/src/client-script-runtime-engineering-loop-controls.mjs
apps/observer-ui/src/client-script-startup-refreshes.mjs
```

Validation target:

```text
openclaw-native-engineering-loop-operator-controls
```

The targeted milestone now proves:

```text
Observer client contains the startup auto-restore hook
startup script calls the hook after normal refresh setup
manual restoration still classifies core task history
restoration evidence remains read-only and approval-gated actions stay explicit
```

## Deferred

The following remain deferred:

```text
server-side engineering loop restoration route
persisted browser-independent UI selection preferences
automatic task or approval creation
automatic operator execution
provider calls, network egress, result envelopes
raw credential reads
```

## Next Slice

The LSP lifecycle readiness draft follow-up was completed as:

```text
OPENCLAW_NATIVE_ENGINEERING_LSP_LIFECYCLE_READINESS_DRAFT_PLAN.md
```

That slice should move beyond static LSP evidence by drafting a governed,
workspace-scoped language-server lifecycle action without starting servers,
reading arbitrary files, creating tasks/approvals, persisting lifecycle state,
or sending JSON-RPC until approval/lifecycle boundaries are explicit.

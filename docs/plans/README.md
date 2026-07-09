# OpenClaw Plans Directory

Updated: 2026-07-09

This directory contains both active route documents and historical milestone
evidence. Do not infer the next development task from the highest numbered phase
file.

## Active Route Documents

Read these first:

```text
../OPENCLAW_FORWARD_WORK_DIRECTIVE.md
OPENCLAW_ENHANCED_SOURCE_MIGRATION_BRIEF.md
OPENCLAW_ENHANCED_SOURCE_GAP_AUDIT.md
OPENCLAW_NATIVE_ENGINEERING_TOOL_SURFACE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_READ_SEARCH_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_EDIT_PROPOSAL_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_EDIT_APPROVAL_BRIDGE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_EDIT_CLOSED_LOOP_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_WRITE_PROPOSAL_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_WRITE_APPROVAL_BRIDGE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_WRITE_EXECUTION_EVIDENCE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_WRITE_CLOSED_LOOP_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_VERIFICATION_EVIDENCE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_RECOVERY_EVIDENCE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_MICROCOMPACT_EVIDENCE_PLAN.md
OPENCLAW_NATIVE_PLUGIN_RUNTIME_REFRESH_EVIDENCE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_PLAN_TODO_EVIDENCE_PLAN.md
OPENCLAW_NATIVE_ENGINEERING_LSP_EVIDENCE_PLAN.md
../architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md
../architecture/KERNEL_LEVEL_EVOLUTION_WHITEPAPER.md
```

Use these as supporting documents:

```text
OPENCLAW_MONOLITH_REDUCTION_PLAN.md
OPENCLAW_EXPERT_REVIEW_OPTIMIZATION_PLAN.md
OPENCLAW_SOURCE_INTEGRATION_STAGE_PLAN.md
```

## Current Route Correction

The current route is no longer "continue to the next numbered cloud-provider
phase." The corrected route is:

```text
preserve enhanced openclaw source on GitHub
-> perform enhanced source gap audit
-> migrate governed engineering tool capabilities into OpenClawOnNixOS
-> return to identity-upgrade work-view/session-helper/hostd route
```

## Historical Phase Plans

`OPENCLAW_PHASE_2_PLAN.md` through `OPENCLAW_PHASE_136_PLAN.md` are retained
because milestone scripts and runtime evidence still reference them.

They are historical records and check fixtures. They are not the live roadmap.

Do not delete, rename, or move them until the milestone scripts that read them
are updated.

## Cleanup Rule

When adding a new plan:

- Prefer updating an active route document over creating another numbered phase.
- Create a new numbered phase only when a real capability slice needs an
  executable milestone check.
- If the document is historical evidence, say so at the top.
- If the document is active guidance, link it from this README and from
  `docs/README.md`.

# OpenClaw Documentation Control Room

Updated: 2026-07-09

This is the active documentation entry point for `OpenClawOnNixOS`.

The project has many historical phase plans. Do not use the largest phase number
as the next task. Start from the active route below.

## Start Here

Read in this order:

1. [Forward Work Directive](./OPENCLAW_FORWARD_WORK_DIRECTIVE.md)
2. [Enhanced Source Migration Brief](./plans/OPENCLAW_ENHANCED_SOURCE_MIGRATION_BRIEF.md)
3. [System Identity Upgrade Path](./architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md)
4. [Kernel-Level Evolution Whitepaper](./architecture/KERNEL_LEVEL_EVOLUTION_WHITEPAPER.md)
5. [Plans Directory Guide](./plans/README.md)

## Current Project Correction

The project is not fundamentally off-course, but the recent provider/credential
phase ladder has become too fine-grained. The active route is now:

```text
preserve enhanced openclaw source on GitHub
-> audit which enhanced capabilities are already absorbed
-> migrate Claude Code-grade engineering capabilities as governed body tools
-> return to identity-upgrade work: work-view/session helper, then hostd
```

Do not continue with Phase 137-style provider wrappers unless the next slice
creates a real capability and explicitly passes the progress test in the forward
directive.

## Active Architecture

| Document | Role |
| --- | --- |
| [OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md](./architecture/OPENCLAW_SYSTEM_IDENTITY_UPGRADE_PATH.md) | Governs how OpenClaw evolves from user-space control plane to trusted session component, system daemon, and graphics-stack-native body. |
| [KERNEL_LEVEL_EVOLUTION_WHITEPAPER.md](./architecture/KERNEL_LEVEL_EVOLUTION_WHITEPAPER.md) | Long-horizon architecture for NixOS, eBPF, declarative mutation, and kernel-level body nerves. |
| [AI_WORK_VIEW_CAPTURE_STRATEGY.md](./architecture/AI_WORK_VIEW_CAPTURE_STRATEGY.md) | Work-view capture strategy for AI-owned graphical work. |
| [DESKTOP_CAPTURE_CONTRACT_V1.md](./architecture/DESKTOP_CAPTURE_CONTRACT_V1.md) | Screen-sense capture contract. |
| [DECOUPLING_REPORT.md](./architecture/DECOUPLING_REPORT.md) | Historical and still useful service decoupling report. |
| [coupling_analysis.md](./architecture/coupling_analysis.md) | Coupling audit after the large service split. |

## Active Plans

| Document | Role |
| --- | --- |
| [OPENCLAW_ENHANCED_SOURCE_MIGRATION_BRIEF.md](./plans/OPENCLAW_ENHANCED_SOURCE_MIGRATION_BRIEF.md) | Records the optimized Windows-host `openclaw` source inventory, preservation strategy, and integration rules. |
| [OPENCLAW_ENHANCED_SOURCE_GAP_AUDIT.md](./plans/OPENCLAW_ENHANCED_SOURCE_GAP_AUDIT.md) | Audits which preserved enhanced-source capabilities are absorbed, partially absorbed, not absorbed, should not migrate, or require source transfer. |
| [OPENCLAW_NATIVE_ENGINEERING_TOOL_SURFACE_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_TOOL_SURFACE_PLAN.md) | Active native engineering tool contract inventory route. |
| [OPENCLAW_NATIVE_ENGINEERING_READ_SEARCH_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_READ_SEARCH_PLAN.md) | Active bounded workspace read/search route for `cc_read`, `cc_glob`, and `cc_grep`. |
| [OPENCLAW_NATIVE_ENGINEERING_EDIT_PROPOSAL_PLAN.md](./plans/OPENCLAW_NATIVE_ENGINEERING_EDIT_PROPOSAL_PLAN.md) | Active surgical edit proposal and bounded diff-preview route for `cc_edit`. |
| [OPENCLAW_MONOLITH_REDUCTION_PLAN.md](./plans/OPENCLAW_MONOLITH_REDUCTION_PLAN.md) | Tracks current coupling reduction and milestone-batch improvements. |
| [OPENCLAW_EXPERT_REVIEW_OPTIMIZATION_PLAN.md](./plans/OPENCLAW_EXPERT_REVIEW_OPTIMIZATION_PLAN.md) | Tracks expert-review fixes around test lifecycle, shared packages, helpers, batching, and profiling. |
| [OPENCLAW_SOURCE_INTEGRATION_STAGE_PLAN.md](./plans/OPENCLAW_SOURCE_INTEGRATION_STAGE_PLAN.md) | Historical source-integration stage log; use with the enhanced migration brief, not as the sole roadmap. |
| [OPENCLAW_POST_MVP_PLAN.md](./plans/OPENCLAW_POST_MVP_PLAN.md) | Historical post-MVP route selection that remains useful for memory/consciousness context. |

## Historical Phase Plans

`docs/plans/OPENCLAW_PHASE_*_PLAN.md` files are retained because many milestone
scripts still read them as evidence fixtures. They are not active next-work
instructions.

Do not delete, rename, or move them until the milestone scripts that reference
them are refactored.

## Guides And Evidence

| Document | Role |
| --- | --- |
| [OPENCLAW_MVP_DEMO_GUIDE.md](./guides/OPENCLAW_MVP_DEMO_GUIDE.md) | Historical MVP demo guide; still referenced by milestone checks. |
| [OPENCLAW_MVP_STATUS.md](./guides/OPENCLAW_MVP_STATUS.md) | Historical MVP status; still referenced by milestone checks. |
| [OPENCLAW_MVP_FINAL_READINESS.md](./guides/OPENCLAW_MVP_FINAL_READINESS.md) | Historical MVP final readiness; still referenced by milestone checks. |
| [fix_log.md](./guides/fix_log.md) | Historical diagnosis and repair log. |
| [HANDOVER_SUMMARY.md](./HANDOVER_SUMMARY.md) | Historical handoff for the decoupling/restructure era. |

## Documentation Cleanup Policy

- Active guidance must be linked from this file.
- Historical evidence may remain in place when milestone checks reference it.
- Do not create a new numbered phase just to continue a pattern.
- Prefer updating an active route document when correcting direction.
- If a document becomes obsolete but is referenced by tests, mark it historical
  in the index rather than moving it.

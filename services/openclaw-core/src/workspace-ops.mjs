import { createHash, randomUUID } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createOpenClawNativePluginRegistry } from "../../../packages/plugin-runtime/src/plugin-registry.mjs";
import {
  applyWorkspacePatchEdits,
  buildDiffPreview,
  buildWorkspacePatchDiffPreview,
  normaliseWorkspacePatchEdits,
  validateWorkspacePatchDiffPreview,
} from "./workspace-patch-utils.mjs";
import {
  buildSourceDerivedProposalBundles,
  buildWorkspacePatchProposalEnvelope,
  normalisePatchMetadataList,
  truncatePatchMetadata,
} from "./workspace-proposal-utils.mjs";
import { createWorkspaceCommandPlanBuilders } from "./workspace-command-plan-builders.mjs";
import { createNativeEngineeringLspLifecycleTaskBuilders } from "./native-engineering-lsp-lifecycle-tasks.mjs";

export function createWorkspaceOps(deps) {
  const {
    client,
    state,
    selectOpenClawToolCatalogWorkspace,
    buildWorkspaceCommandProposals,
    buildOpenClawSourceCommandProposals,
    buildNativeOpenClawToolCatalogProfile,
    buildNativeOpenClawWorkspaceSemanticIndex,
    buildNativeOpenClawWorkspaceEditTargetSelection,
    buildNativeOpenClawPromptSemanticsProfile,
    buildNativeEngineeringLspLifecycleDraft,
    buildNativeEngineeringLspSourceTransferProposal,
    buildNativeEngineeringLspSymbolRequestProposal,
    buildRulePlan,
    createTask,
    supersedeOtherActiveTasks,
    reconcileRuntimeState,
    serialiseTask,
    serialisePlanForPublic,
    createApprovalRequestForTask,
    serialiseApproval,
    publishTaskApprovalIfPending,
    publishEvent,
  } = deps;
  const { postJson } = client;
  const { tasks, persistState, workspaceRoots, autonomyMode } = state;

  // L5977-7324
function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeStat(rootPath) {
  try {
    return statSync(rootPath);
  } catch {
    return null;
  }
}

function redactPublicParams(params) {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return params ?? {};
  }
  const redacted = { ...params };
  for (const key of ["content", "body", "data"]) {
    if (typeof redacted[key] === "string") {
      redacted[key] = `[redacted:${Buffer.byteLength(redacted[key], "utf8")} bytes]`;
    }
  }
  return redacted;
}

function normaliseWorkspaceOpsContent({ content = "", contentBase64 = null } = {}) {
  if (typeof contentBase64 === "string" && contentBase64) {
    return Buffer.from(contentBase64, "base64").toString("utf8");
  }
  return typeof content === "string" ? content : "";
}

function resolveOpenClawWorkspaceTarget({ workspacePath = null, relativePath = null } = {}) {
  const { item } = selectOpenClawToolCatalogWorkspace({ workspacePath });
  const safeRelativePath = typeof relativePath === "string" && relativePath.trim()
    ? relativePath.trim().replaceAll("\\", "/")
    : null;
  if (!safeRelativePath) {
    throw new Error("relativePath is required for OpenClaw workspace text writes.");
  }
  if (safeRelativePath.startsWith("/") || safeRelativePath.includes("..")) {
    throw new Error("OpenClaw workspace text writes require a bounded relative path inside the workspace.");
  }

  const absolutePath = path.resolve(item.path, safeRelativePath);
  const workspaceRoot = path.resolve(item.path);
  const normalisedTarget = process.platform === "win32" ? absolutePath.toLowerCase() : absolutePath;
  const normalisedRoot = process.platform === "win32" ? workspaceRoot.toLowerCase() : workspaceRoot;
  if (normalisedTarget !== normalisedRoot && !normalisedTarget.startsWith(`${normalisedRoot}${path.sep}`)) {
    throw new Error("OpenClaw workspace text write target is outside the selected workspace.");
  }

  return {
    workspace: item,
    relativePath: safeRelativePath,
    absolutePath,
  };
}

function buildNativeOpenClawWorkspaceTextWriteDraft({
  workspacePath = null,
  relativePath = "scratch/native-write.txt",
  content = "",
  overwrite = true,
} = {}) {
  const target = resolveOpenClawWorkspaceTarget({ workspacePath, relativePath });
  const safeContent = typeof content === "string" ? content : "";
  const contentBytes = Buffer.byteLength(safeContent, "utf8");
  const contentSha256 = sha256Hex(safeContent);
  const nativeRegistry = createOpenClawNativePluginRegistry();
  const capability = nativeRegistry.items[0]?.contract?.capabilities
    ?.find((entry) => entry.id === "act.openclaw.workspace_text_write") ?? null;
  const now = new Date().toISOString();
  const goal = `Apply approved OpenClaw workspace text write to ${target.relativePath}`;
  const policyRequest = {
    intent: "openclaw.workspace.write_text",
    domain: "body_internal",
    risk: "high",
    requiresApproval: true,
    tags: ["openclaw_native_adapter", "workspace_mutation", "explicit_approval_required"],
  };
  const action = {
    kind: "filesystem.write_text",
    intent: "filesystem.write_text",
    params: {
      path: target.absolutePath,
      content: safeContent,
      encoding: "utf8",
      overwrite: overwrite !== false,
    },
  };
  const plan = buildRulePlan({
    goal,
    type: "system_task",
    intent: "filesystem.write_text",
    policy: policyRequest,
    targetUrl: null,
    actions: [action],
  });
  const policyDecision = {
    id: randomUUID(),
    at: now,
    engine: "openclaw-native-workspace-text-write-v0",
    stage: "openclaw.native.workspace_text_write.task",
    subject: {
      taskId: null,
      type: "system_task",
      goal,
      targetUrl: null,
      intent: "openclaw.workspace.write_text",
    },
    domain: "body_internal",
    risk: "high",
    decision: "require_approval",
    reason: "openclaw_workspace_text_write_requires_explicit_user_approval",
    approved: false,
    autonomyMode,
    autonomous: false,
  };

  return {
    registry: "openclaw-native-workspace-text-write-draft-v0",
    mode: "approval-gated-draft",
    generatedAt: now,
    sourceRegistry: "openclaw-native-plugin-adapter-v0",
    capability: {
      id: capability?.id ?? "act.openclaw.workspace_text_write",
      kind: capability?.kind ?? "act",
      risk: capability?.risk ?? "high",
      approvalRequired: capability?.approval?.required ?? true,
      runtimeOwner: capability?.runtimeOwner ?? "openclaw_on_nixos",
    },
    workspace: {
      id: target.workspace.id,
      name: target.workspace.name,
      path: target.workspace.path,
    },
    target: {
      relativePath: target.relativePath,
      path: target.absolutePath,
      contentBytes,
      contentSha256,
      overwrite: overwrite !== false,
      contentExposed: false,
    },
    draft: {
      goal,
      type: "system_task",
      action: {
        ...action,
        params: redactPublicParams(action.params),
      },
      plan,
      policy: {
        request: policyRequest,
        decision: policyDecision,
      },
      governance: {
        createsTask: false,
        createsApproval: false,
        canExecuteWithoutApproval: false,
        requiresExplicitApproval: true,
        usesFilesystemWriteCapability: true,
        exposesContent: false,
      },
    },
  };
}

async function createNativeOpenClawWorkspaceTextWriteTask({
  workspacePath = null,
  relativePath = "scratch/native-write.txt",
  content = "",
  overwrite = true,
  confirm = false,
} = {}) {
  if (confirm !== true) {
    throw new Error("OpenClaw workspace text write task creation requires confirm=true.");
  }

  const draftEnvelope = buildNativeOpenClawWorkspaceTextWriteDraft({
    workspacePath,
    relativePath,
    content,
    overwrite,
  });
  const draft = draftEnvelope.draft;
  const task = createTask({
    goal: draft.goal,
    type: draft.type,
    workViewStrategy: "openclaw-native-workspace-text-write",
    plan: draft.plan,
    policy: draft.policy.request,
  }, { skipInitialPolicy: true });
  task.policy = draft.policy;
  const approval = createApprovalRequestForTask(task, draft.policy.decision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent("task.created", { task: serialiseTask(task), planner: "openclaw-native-workspace-text-write-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    registry: "openclaw-native-workspace-text-write-task-v0",
    mode: "approval-gated",
    generatedAt: new Date().toISOString(),
    sourceRegistry: draftEnvelope.registry,
    capability: draftEnvelope.capability,
    workspace: draftEnvelope.workspace,
    target: draftEnvelope.target,
    task,
    approval,
    governance: {
      mode: "native_workspace_text_write_approval_gated",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      usesFilesystemWriteCapability: true,
      recordsCapabilityHistory: true,
      recordsFilesystemLedger: true,
      exposesContent: false,
      executed: false,
    },
  };
}

async function createNativeEngineeringWriteProposalTask({
  workspacePath = null,
  relativePath = "scratch/native-engineering-write-proposal.txt",
  content = "",
  contentBase64 = null,
  overwrite = false,
  contextLines = 1,
  maxContentBytes = 16 * 1024,
  maxExistingFileBytes = 24 * 1024,
  confirm = false,
} = {}) {
  if (confirm !== true) {
    throw new Error("native engineering write proposal task creation requires confirm=true.");
  }
  if (typeof deps.buildNativeEngineeringWriteProposal !== "function") {
    throw new Error("native engineering write proposal builder is unavailable.");
  }
  const safeContent = normaliseWorkspaceOpsContent({ content, contentBase64 });
  const engineeringWriteProposal = deps.buildNativeEngineeringWriteProposal({
    workspacePath,
    relativePath,
    content: safeContent,
    overwrite,
    contextLines,
    maxContentBytes,
    maxExistingFileBytes,
  });
  if (!engineeringWriteProposal.ok || engineeringWriteProposal.blocked) {
    throw new Error(`native engineering write proposal task cannot bridge blocked proposal: ${engineeringWriteProposal.target?.blockedReason ?? engineeringWriteProposal.summary?.reason ?? "proposal_blocked"}`);
  }
  const taskResult = await createNativeOpenClawWorkspaceTextWriteTask({
    workspacePath,
    relativePath: engineeringWriteProposal.target.relativePath,
    content: safeContent,
    overwrite: engineeringWriteProposal.target.overwriteRequested,
    confirm: true,
  });
  taskResult.task.engineeringWriteProposal = {
    registry: engineeringWriteProposal.registry,
    proposalId: engineeringWriteProposal.proposal.id,
    proposalKind: engineeringWriteProposal.summary.proposalKind,
    sourceCapabilityId: engineeringWriteProposal.capability.id,
    approvedMutationCapabilityId: "act.openclaw.workspace_text_write",
    target: engineeringWriteProposal.target,
    contentExposed: false,
  };
  persistState();
  const generatedAt = new Date().toISOString();

  return {
    registry: "openclaw-native-engineering-write-proposal-task-v0",
    mode: "approval-gated-write-proposal-bridge",
    generatedAt,
    sourceRegistry: engineeringWriteProposal.registry,
    capability: engineeringWriteProposal.capability,
    workspace: engineeringWriteProposal.workspace,
    target: engineeringWriteProposal.target,
    engineeringWriteProposal: {
      registry: engineeringWriteProposal.registry,
      mode: engineeringWriteProposal.mode,
      proposal: engineeringWriteProposal.proposal,
      target: engineeringWriteProposal.target,
      summary: engineeringWriteProposal.summary,
      governance: engineeringWriteProposal.governance,
      auditEvidence: engineeringWriteProposal.auditEvidence,
      deferredExecutionBoundaries: engineeringWriteProposal.deferredExecutionBoundaries,
      contentExposed: false,
    },
    workspaceTextWrite: {
      registry: taskResult.registry,
      mode: taskResult.mode,
      capability: taskResult.capability,
      target: taskResult.target,
      contentExposed: false,
    },
    task: taskResult.task,
    approval: taskResult.approval,
    governance: {
      mode: "native_engineering_write_proposal_to_workspace_text_write_approval_bridge",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      executed: false,
      canMutateBeforeApproval: false,
      delegatesApprovedMutationTo: "act.openclaw.workspace_text_write",
      recordsCapabilityHistory: true,
      recordsFilesystemLedgerAfterApproval: true,
      exposesContent: false,
    },
  };
}

async function createNativeEngineeringEditProposalTask({
  workspacePath = null,
  relativePath = "scratch/native-edit.txt",
  oldString = "",
  newString = "",
  contextLines = 1,
  maxOutputChars = 24_000,
  maxFileSizeBytes = 128 * 1024,
  confirm = false,
} = {}) {
  if (confirm !== true) {
    throw new Error("native engineering edit proposal task creation requires confirm=true.");
  }
  if (typeof deps.buildNativeEngineeringEditProposal !== "function") {
    throw new Error("native engineering edit proposal builder is unavailable.");
  }

  const engineeringEditProposal = deps.buildNativeEngineeringEditProposal({
    workspacePath,
    relativePath,
    oldString,
    newString,
    contextLines,
    maxOutputChars,
    maxFileSizeBytes,
  });
  if (!engineeringEditProposal.ok || engineeringEditProposal.blocked) {
    throw new Error(`native engineering edit proposal task cannot bridge blocked proposal: ${engineeringEditProposal.target?.blockedReason ?? engineeringEditProposal.summary?.reason ?? "proposal_blocked"}`);
  }

  const taskResult = await createNativeOpenClawWorkspacePatchApplyTask({
    workspacePath,
    relativePath: engineeringEditProposal.target.relativePath,
    search: oldString,
    replacement: typeof newString === "string" ? newString : "",
    occurrence: 1,
    contextLines,
    proposal: {
      ...engineeringEditProposal.proposal,
      source: engineeringEditProposal.registry,
      targetContext: {
        relativePath: engineeringEditProposal.target.relativePath,
        fileRole: "native engineering cc_edit proposal",
      },
      expectedChecks: engineeringEditProposal.proposal?.expectedChecks ?? [
        "diff-preview",
        "unique-exact-match",
        "approval-required-before-apply",
      ],
    },
    confirm: true,
  });
  if (
    taskResult.target?.originalSha256 !== engineeringEditProposal.target?.originalSha256
    || taskResult.target?.nextSha256 !== engineeringEditProposal.target?.proposedSha256
  ) {
    throw new Error("native engineering edit proposal task target changed before approval task creation.");
  }

  taskResult.task.engineeringEditProposal = {
    registry: engineeringEditProposal.registry,
    proposalId: engineeringEditProposal.proposal.id,
    proposalKind: engineeringEditProposal.proposal.kind,
    sourceCapabilityId: engineeringEditProposal.capability.id,
    approvedMutationCapabilityId: "act.openclaw.workspace_patch_apply",
    target: engineeringEditProposal.target,
    contentExposed: false,
    diffPreviewExposed: true,
  };
  persistState();
  const generatedAt = new Date().toISOString();

  return {
    registry: "openclaw-native-engineering-edit-proposal-task-v0",
    mode: "approval-gated-edit-proposal-bridge",
    generatedAt,
    sourceRegistry: engineeringEditProposal.registry,
    capability: engineeringEditProposal.capability,
    workspace: engineeringEditProposal.workspace,
    target: engineeringEditProposal.target,
    validation: engineeringEditProposal.validation,
    proposal: engineeringEditProposal.proposal,
    edits: engineeringEditProposal.edits,
    diffPreview: engineeringEditProposal.diffPreview,
    engineeringEditProposal: {
      registry: engineeringEditProposal.registry,
      mode: engineeringEditProposal.mode,
      proposal: engineeringEditProposal.proposal,
      target: engineeringEditProposal.target,
      summary: engineeringEditProposal.summary,
      governance: engineeringEditProposal.governance,
      auditEvidence: engineeringEditProposal.auditEvidence,
      deferredExecutionBoundaries: engineeringEditProposal.deferredExecutionBoundaries,
      contentExposed: false,
      diffPreviewExposed: true,
    },
    workspacePatchApply: {
      registry: taskResult.registry,
      mode: taskResult.mode,
      capability: taskResult.capability,
      target: taskResult.target,
      validation: taskResult.validation,
      proposal: taskResult.proposal,
      contentExposed: false,
      diffPreviewExposed: true,
    },
    task: taskResult.task,
    approval: taskResult.approval,
    governance: {
      mode: "native_engineering_edit_proposal_to_workspace_patch_apply_approval_bridge",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      executed: false,
      canMutateBeforeApproval: false,
      delegatesApprovedMutationTo: "act.openclaw.workspace_patch_apply",
      recordsCapabilityHistory: true,
      recordsFilesystemLedgerAfterApproval: true,
      exposesFullContent: false,
      exposesDiffPreview: true,
    },
  };
}

function readBoundedWorkspaceTextFile(target, { maxBytes = 64 * 1024 } = {}) {
  const stats = safeStat(target.absolutePath);
  if (!stats?.isFile()) {
    throw new Error("OpenClaw workspace patch target must be an existing regular file.");
  }
  if (stats.size > maxBytes) {
    throw new Error("OpenClaw workspace patch target exceeds the bounded read limit.");
  }
  return readFileSync(target.absolutePath, "utf8");
}

function buildOpenClawSourceDerivedPatchProposal({
  workspacePath = null,
  relativePath = "scratch/native-edit.txt",
  query = "edit",
} = {}) {
  const catalogProfile = buildNativeOpenClawToolCatalogProfile({
    workspacePath,
    query,
    limit: 8,
  });
  const semanticIndex = buildNativeOpenClawWorkspaceSemanticIndex({
    workspacePath,
    scope: "tools",
    query,
    limit: 8,
  });
  const primaryTool = catalogProfile.tools?.[0] ?? null;
  const primarySemanticFile = semanticIndex.files?.[0] ?? null;
  const categories = [...new Set((catalogProfile.tools ?? []).map((tool) => tool.category).filter(Boolean))];
  let promptSemantics = null;
  try {
    promptSemantics = buildNativeOpenClawPromptSemanticsProfile({
      workspacePath,
      query,
      limit: 12,
    });
  } catch {
    promptSemantics = null;
  }
  const promptExpectedChecks = promptSemantics?.derivedPlanSemantics?.expectedChecks ?? [];
  const expectedChecks = normalisePatchMetadataList([
    ...promptExpectedChecks,
    "patch-validation",
    "diff-preview",
    "approval-required",
    "filesystem-ledger",
  ]);
  const sourceSignals = {
    registry: "openclaw-source-derived-edit-proposal-v0",
    mode: "read-only-source-signal-derivation",
    sourceRegistries: [catalogProfile.registry, semanticIndex.registry, promptSemantics?.registry].filter(Boolean),
    query,
    toolSignals: {
      matchedTools: catalogProfile.summary?.matchedTools ?? 0,
      categories,
      primaryTool: primaryTool ? {
        relativePath: primaryTool.relativePath,
        category: primaryTool.category,
        documented: Boolean(primaryTool.documented),
        contentRead: false,
      } : null,
    },
    semanticSignals: {
      matchedFiles: semanticIndex.files?.length ?? 0,
      totalDeclarations: semanticIndex.summary?.exportedFunctions ?? 0,
      primaryFile: primarySemanticFile ? {
        relativePath: primarySemanticFile.relativePath,
        kind: primarySemanticFile.kind,
        category: primarySemanticFile.category,
        lineCount: primarySemanticFile.lineCount,
        contentExposed: false,
      } : null,
    },
    promptSignals: promptSemantics ? {
      registry: promptSemantics.registry,
      matchedFiles: promptSemantics.summary?.totalFiles ?? 0,
      editVocabularyFiles: promptSemantics.summary?.editVocabularyFiles ?? 0,
      verificationVocabularyFiles: promptSemantics.summary?.verificationVocabularyFiles ?? 0,
      governanceVocabularyFiles: promptSemantics.summary?.governanceVocabularyFiles ?? 0,
      expectedChecks,
      contentExposed: false,
    } : null,
    governance: {
      canReadMetadata: true,
      canReadSourceFileContent: true,
      canReadPromptContent: true,
      exposesSourceFileContent: false,
      exposesPromptContent: false,
      canExecuteToolCode: false,
      canImportModule: false,
      canMutate: false,
    },
  };
  const targetSymbol = primarySemanticFile?.signals?.exports?.[0] ?? primaryTool?.fileName ?? "openclaw-source-signal";
  const fileRole = categories[0] ? `openclaw ${categories[0]} source signal` : "openclaw source signal";
  const bundles = buildSourceDerivedProposalBundles({
    sourceSignals,
    expectedChecks,
    relativePath,
    query,
    primarySymbol: targetSymbol,
    fileRole,
  });

  return {
    id: `source-derived-${sha256Hex(`${catalogProfile.workspace?.path ?? ""}:${relativePath}:${query}`).slice(0, 12)}`,
    title: `Source-derived OpenClaw edit proposal for ${relativePath}`,
    rationale: [
      `Derived from enhanced OpenClaw read-only tool catalog and semantic index signals for query "${query}".`,
      `Matched ${sourceSignals.toolSignals.matchedTools} tool metadata entries, ${sourceSignals.semanticSignals.matchedFiles} semantic files, and ${sourceSignals.promptSignals?.matchedFiles ?? 0} prompt semantic files without importing or executing source modules.`,
    ].join(" "),
    source: sourceSignals.registry,
    targetContext: {
      symbol: targetSymbol,
      fileRole,
    },
    editIntent: {
      kind: "source_derived_workspace_edit",
      objective: `Patch ${relativePath} using enhanced OpenClaw prompt/tool semantics for "${query}".`,
      planningStyle: promptSemantics?.derivedPlanSemantics?.editIntent?.planningStyle ?? "direct_patch_review",
      targetSafety: promptSemantics?.derivedPlanSemantics?.editIntent?.targetSafety ?? "approval_gated",
      verificationStyle: promptSemantics?.derivedPlanSemantics?.editIntent?.verificationStyle ?? [],
    },
    expectedChecks,
    semanticPlan: promptSemantics ? {
      registry: promptSemantics.registry,
      mode: promptSemantics.mode,
      promptFiles: promptSemantics.summary?.totalFiles ?? 0,
      expectedChecks,
    } : null,
    ...bundles,
    sourceSignals,
  };
}

function buildNativeOpenClawWorkspacePatchApplyDraft({
  workspacePath = null,
  relativePath = null,
  search = "",
  replacement = "",
  occurrence = 1,
  edits = null,
  contextLines = 1,
  proposal = null,
  deriveProposalFromSource = false,
  proposalQuery = "edit",
  selectTargetFromSource = false,
  targetSelectionQuery = null,
  targetSelectionScope = "tools",
} = {}) {
  const targetSelection = selectTargetFromSource
    ? buildNativeOpenClawWorkspaceEditTargetSelection({
      workspacePath,
      scope: targetSelectionScope,
      query: targetSelectionQuery ?? proposalQuery,
      limit: 8,
    })
    : null;
  const effectiveRelativePath = targetSelection?.selectedTarget?.relativePath
    ?? relativePath
    ?? "scratch/native-edit.txt";
  const target = resolveOpenClawWorkspaceTarget({ workspacePath, relativePath: effectiveRelativePath });
  const safeEdits = normaliseWorkspacePatchEdits({ edits, search, replacement, occurrence });
  const originalContent = readBoundedWorkspaceTextFile(target);
  const { nextContent, appliedEdits, validation } = applyWorkspacePatchEdits(originalContent, safeEdits);
  const diffPreview = buildWorkspacePatchDiffPreview(originalContent, nextContent, appliedEdits, { contextLines });
  const previewValidation = validateWorkspacePatchDiffPreview(diffPreview);
  const originalBytes = Buffer.byteLength(originalContent, "utf8");
  const replacementBytes = appliedEdits.reduce((total, edit) => total + edit.replacementBytes, 0);
  const nextBytes = Buffer.byteLength(nextContent, "utf8");
  const nativeRegistry = createOpenClawNativePluginRegistry();
  const capability = nativeRegistry.items[0]?.contract?.capabilities
    ?.find((entry) => entry.id === "act.openclaw.workspace_patch_apply") ?? null;
  const now = new Date().toISOString();
  const goal = `Apply approved OpenClaw workspace patch to ${target.relativePath}`;
  const policyRequest = {
    intent: "openclaw.workspace.patch_apply",
    domain: "body_internal",
    risk: "high",
    requiresApproval: true,
    tags: ["openclaw_native_adapter", "workspace_patch", "workspace_mutation", "explicit_approval_required"],
  };
  const action = {
    kind: "filesystem.write_text",
    intent: "filesystem.write_text",
    params: {
      path: target.absolutePath,
      content: nextContent,
      encoding: "utf8",
      overwrite: true,
    },
  };
  const plan = buildRulePlan({
    goal,
    type: "system_task",
    intent: "filesystem.write_text",
    policy: policyRequest,
    targetUrl: null,
    actions: [action],
  });
  const policyDecision = {
    id: randomUUID(),
    at: now,
    engine: "openclaw-native-workspace-patch-apply-v0",
    stage: "openclaw.native.workspace_patch_apply.task",
    subject: {
      taskId: null,
      type: "system_task",
      goal,
      targetUrl: null,
      intent: "openclaw.workspace.patch_apply",
    },
    domain: "body_internal",
    risk: "high",
    decision: "require_approval",
    reason: "openclaw_workspace_patch_apply_requires_explicit_user_approval",
    approved: false,
    autonomyMode,
    autonomous: false,
  };
  const capabilityEnvelope = {
    id: capability?.id ?? "act.openclaw.workspace_patch_apply",
    kind: capability?.kind ?? "act",
    risk: capability?.risk ?? "high",
    approvalRequired: capability?.approval?.required ?? true,
    runtimeOwner: capability?.runtimeOwner ?? "openclaw_on_nixos",
  };
  const validationEnvelope = {
    ok: true,
    structuredPatch: validation,
    preview: previewValidation,
  };
  const sourceDerivedProposal = deriveProposalFromSource
    ? buildOpenClawSourceDerivedPatchProposal({
      workspacePath,
      relativePath: target.relativePath,
      query: proposalQuery,
    })
    : null;
  const proposalEnvelope = buildWorkspacePatchProposalEnvelope({
    proposal: sourceDerivedProposal ?? proposal,
    target,
    capability: capabilityEnvelope,
    safeEdits,
    diffPreview,
    validation: validationEnvelope,
  });

  return {
    registry: "openclaw-native-workspace-patch-apply-draft-v0",
    mode: "diff-preview-approval-gated-draft",
    generatedAt: now,
    sourceRegistry: "openclaw-native-plugin-adapter-v0",
    capability: capabilityEnvelope,
    workspace: {
      id: target.workspace.id,
      name: target.workspace.name,
      path: target.workspace.path,
    },
    target: {
      relativePath: target.relativePath,
      path: target.absolutePath,
      originalBytes,
      nextBytes,
      replacementBytes,
      originalSha256: sha256Hex(originalContent),
      nextSha256: sha256Hex(nextContent),
      editCount: safeEdits.length,
      replacementsAvailable: appliedEdits.reduce((total, edit) => total + edit.replacementsAvailable, 0),
      occurrence: safeEdits.length === 1 ? safeEdits[0].occurrence : null,
      changedAtLine: appliedEdits[0]?.changedAtLine ?? null,
      changedAtLines: appliedEdits.map((edit) => edit.changedAtLine),
      contentExposed: false,
      diffPreviewExposed: true,
    },
    validation: validationEnvelope,
    proposal: proposalEnvelope,
    proposalSourceSignals: sourceDerivedProposal?.sourceSignals ?? null,
    targetSelection,
    edits: appliedEdits.map((edit) => ({
      index: edit.index,
      kind: edit.kind,
      occurrence: edit.occurrence,
      startLine: edit.startLine,
      endLine: edit.endLine,
      originalStart: edit.originalStart,
      originalEnd: edit.originalEnd,
      searchBytes: edit.searchBytes,
      replacementsAvailable: edit.replacementsAvailable,
      replacementBytes: edit.replacementBytes,
      changedAtLine: edit.changedAtLine,
      searchExposed: false,
      replacementExposed: false,
    })),
    diffPreview,
    draft: {
      goal,
      type: "system_task",
      action: {
        ...action,
        params: redactPublicParams(action.params),
      },
      plan,
      policy: {
        request: policyRequest,
        decision: policyDecision,
      },
      governance: {
        createsTask: false,
        createsApproval: false,
        canExecuteWithoutApproval: false,
        requiresExplicitApproval: true,
        usesFilesystemWriteCapability: true,
        exposesFullContent: false,
        exposesDiffPreview: true,
      },
    },
  };
}

async function createNativeOpenClawWorkspacePatchApplyTask({
  workspacePath = null,
  relativePath = null,
  search = "",
  replacement = "",
  occurrence = 1,
  edits = null,
  contextLines = 1,
  proposal = null,
  deriveProposalFromSource = false,
  proposalQuery = "edit",
  selectTargetFromSource = false,
  targetSelectionQuery = null,
  targetSelectionScope = "tools",
  confirm = false,
} = {}) {
  if (confirm !== true) {
    throw new Error("OpenClaw workspace patch apply task creation requires confirm=true.");
  }

  const draftEnvelope = buildNativeOpenClawWorkspacePatchApplyDraft({
    workspacePath,
    relativePath,
    search,
    replacement,
    occurrence,
    edits,
    contextLines,
    proposal,
    deriveProposalFromSource,
    proposalQuery,
    selectTargetFromSource,
    targetSelectionQuery,
    targetSelectionScope,
  });
  const draft = draftEnvelope.draft;
  const task = createTask({
    goal: draft.goal,
    type: draft.type,
    workViewStrategy: "openclaw-native-workspace-patch-apply",
    plan: draft.plan,
    policy: draft.policy.request,
  }, { skipInitialPolicy: true });
  task.policy = draft.policy;
  const approval = createApprovalRequestForTask(task, draft.policy.decision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent("task.created", { task: serialiseTask(task), planner: "openclaw-native-workspace-patch-apply-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    registry: "openclaw-native-workspace-patch-apply-task-v0",
    mode: "diff-preview-approval-gated",
    generatedAt: new Date().toISOString(),
    sourceRegistry: draftEnvelope.registry,
    capability: draftEnvelope.capability,
    workspace: draftEnvelope.workspace,
    target: draftEnvelope.target,
    validation: draftEnvelope.validation,
    proposal: draftEnvelope.proposal,
    proposalSourceSignals: draftEnvelope.proposalSourceSignals,
    targetSelection: draftEnvelope.targetSelection,
    edits: draftEnvelope.edits,
    diffPreview: draftEnvelope.diffPreview,
    task,
    approval,
    governance: {
      mode: "native_workspace_patch_apply_approval_gated",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      usesFilesystemWriteCapability: true,
      recordsCapabilityHistory: true,
      recordsFilesystemLedger: true,
      exposesFullContent: false,
      exposesDiffPreview: true,
      executed: false,
    },
  };
}

function buildOpenClawSourceAuthoredEditDraft({
  workspacePath = null,
  proposalQuery = "edit",
  targetSelectionQuery = null,
  targetSelectionScope = "tools",
  edits = null,
  search = "",
  replacement = "",
  occurrence = 1,
  contextLines = 0,
} = {}) {
  const draft = buildNativeOpenClawWorkspacePatchApplyDraft({
    workspacePath,
    search,
    replacement,
    occurrence,
    edits,
    contextLines,
    deriveProposalFromSource: true,
    proposalQuery,
    selectTargetFromSource: true,
    targetSelectionQuery: targetSelectionQuery ?? proposalQuery,
    targetSelectionScope,
  });
  const sourceAuthoredEdit = {
    registry: "openclaw-source-authored-edit-v0",
    mode: "approval-gated-source-authored-edit-draft",
    sourceRegistry: draft.proposal?.source ?? "openclaw-source-derived-edit-proposal-v0",
    proposalRegistry: draft.proposal?.registry ?? "openclaw-native-workspace-edit-proposal-v0",
    rationaleBundleRegistry: draft.proposal?.rationaleBundle?.registry ?? "openclaw-rationale-check-bundle-v0",
    checkBundleRegistry: draft.proposal?.checkBundle?.registry ?? "openclaw-rationale-check-bundle-v0",
    riskRegistry: draft.proposal?.riskNotes?.registry ?? "openclaw-rationale-check-bundle-v0",
    targetSelectionRegistry: draft.targetSelection?.registry ?? "openclaw-native-workspace-edit-target-selection-v0",
    promptSemanticsRegistry: draft.proposal?.semanticPlan?.registry ?? "openclaw-native-prompt-semantics-v0",
    entrypoint: "/plugins/native-adapter/source-authored-edit-tasks",
    query: truncatePatchMetadata(proposalQuery, 120),
    contentExposed: false,
  };

  return {
    ...draft,
    registry: "openclaw-source-authored-edit-v0",
    mode: "approval-gated-source-authored-edit-draft",
    sourceRegistry: draft.registry,
    sourceAuthoredEdit,
    governance: {
      ...(draft.draft?.governance ?? {}),
      mode: "openclaw_source_authored_edit_draft",
      runtimeOwner: "openclaw_on_nixos",
      derivesFromEnhancedOpenClawSignals: true,
      canExecuteLegacyOpenClawCode: false,
      canImportLegacyOpenClawModules: false,
      canMutateWithoutApproval: false,
      usesWorkspacePatchApplyAdapter: true,
      exposesPromptContent: false,
      exposesSourceFileContent: false,
    },
  };
}

async function createOpenClawSourceAuthoredEditTask({
  workspacePath = null,
  proposalQuery = "edit",
  targetSelectionQuery = null,
  targetSelectionScope = "tools",
  edits = null,
  search = "",
  replacement = "",
  occurrence = 1,
  contextLines = 0,
  confirm = false,
} = {}) {
  const result = await createNativeOpenClawWorkspacePatchApplyTask({
    workspacePath,
    search,
    replacement,
    occurrence,
    edits,
    contextLines,
    deriveProposalFromSource: true,
    proposalQuery,
    selectTargetFromSource: true,
    targetSelectionQuery: targetSelectionQuery ?? proposalQuery,
    targetSelectionScope,
    confirm,
  });
  const sourceAuthoredEdit = {
    registry: "openclaw-source-authored-edit-v0",
    mode: "approval-gated-source-authored-edit-task",
    sourceRegistry: result.proposal?.source ?? "openclaw-source-derived-edit-proposal-v0",
    proposalRegistry: result.proposal?.registry ?? "openclaw-native-workspace-edit-proposal-v0",
    rationaleBundleRegistry: result.proposal?.rationaleBundle?.registry ?? "openclaw-rationale-check-bundle-v0",
    checkBundleRegistry: result.proposal?.checkBundle?.registry ?? "openclaw-rationale-check-bundle-v0",
    riskRegistry: result.proposal?.riskNotes?.registry ?? "openclaw-rationale-check-bundle-v0",
    targetSelectionRegistry: result.targetSelection?.registry ?? "openclaw-native-workspace-edit-target-selection-v0",
    promptSemanticsRegistry: result.proposal?.semanticPlan?.registry ?? "openclaw-native-prompt-semantics-v0",
    entrypoint: "/plugins/native-adapter/source-authored-edit-tasks",
    query: truncatePatchMetadata(proposalQuery, 120),
    contentExposed: false,
  };

  return {
    ...result,
    registry: "openclaw-source-authored-edit-task-v0",
    mode: "approval-gated-source-authored-edit-task",
    sourceRegistry: result.registry,
    sourceAuthoredEdit,
    governance: {
      ...(result.governance ?? {}),
      mode: "openclaw_source_authored_edit_task",
      runtimeOwner: "openclaw_on_nixos",
      derivesFromEnhancedOpenClawSignals: true,
      canExecuteLegacyOpenClawCode: false,
      canImportLegacyOpenClawModules: false,
      canMutateWithoutApproval: false,
      usesWorkspacePatchApplyAdapter: true,
      exposesPromptContent: false,
      exposesSourceFileContent: false,
    },
  };
}

const {
  findWorkspaceCommandProposal,
  buildWorkspaceCommandPlanDraft,
  findSourceCommandProposal,
  buildOpenClawSourceCommandPlanDraft,
} = createWorkspaceCommandPlanBuilders({
  buildWorkspaceCommandProposals,
  buildOpenClawSourceCommandProposals,
  buildRulePlan,
  autonomyMode,
});

const {
  createNativeEngineeringLspLifecycleTask,
} = createNativeEngineeringLspLifecycleTaskBuilders({
  autonomyMode,
  buildNativeEngineeringLspLifecycleDraft,
  buildNativeEngineeringLspSourceTransferProposal,
  buildNativeEngineeringLspSymbolRequestProposal,
  buildRulePlan,
  createTask,
  createApprovalRequestForTask,
  persistState,
  publishEvent,
  publishTaskApprovalIfPending,
  reconcileRuntimeState,
  serialisePlanForPublic,
  serialiseTask,
  supersedeOtherActiveTasks,
});

async function createWorkspaceCommandTask({ proposalId = null, workspaceId = null, scriptName = null, confirm = false } = {}) {
  if (confirm !== true) {
    throw new Error("Workspace command task creation requires confirm=true.");
  }

  const draftEnvelope = buildWorkspaceCommandPlanDraft({ proposalId, workspaceId, scriptName });
  const draft = draftEnvelope.draft;
  const task = createTask({
    goal: draft.goal,
    type: draft.type,
    workViewStrategy: "workspace-command",
    plan: draft.plan,
    policy: draft.policy.request,
  }, { skipInitialPolicy: true });
  task.policy = draft.policy;
  const approval = createApprovalRequestForTask(task, draft.policy.decision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent("task.created", { task: serialiseTask(task), planner: draft.plan?.planner ?? "workspace-command-plan-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    registry: "workspace-command-task-v0",
    mode: "approval-gated",
    generatedAt: new Date().toISOString(),
    sourceRegistry: draftEnvelope.registry,
    proposal: draftEnvelope.proposal,
    task,
    approval,
    governance: {
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      executed: false,
      requiresExplicitApproval: true,
      exposesScriptBody: false,
    },
  };
}

async function createOpenClawSourceCommandTask({
  proposalId = null,
  workspaceId = null,
  scriptName = null,
  workspacePath = null,
  query = "command",
  confirm = false,
} = {}) {
  if (confirm !== true) {
    throw new Error("OpenClaw source command task creation requires confirm=true.");
  }

  const sourceDraft = buildOpenClawSourceCommandPlanDraft({
    proposalId,
    workspaceId,
    scriptName,
    workspacePath,
    query,
  });
  const sourceProposal = sourceDraft.sourceCommandProposal;
  const workspaceTask = await createWorkspaceCommandTask({
    proposalId: sourceProposal.id,
    confirm: true,
  });
  workspaceTask.task.sourceCommand = {
    registry: "openclaw-source-command-task-v0",
    sourceProposalRegistry: sourceDraft.sourceRegistry,
    sourcePlanRegistry: sourceDraft.registry,
    proposalId: sourceProposal.id,
    sourceSignalsRegistry: sourceDraft.sourceCommandSignals?.registry ?? "openclaw-source-command-proposals-v0",
    absorbedFromEnhancedOpenClaw: true,
    contentExposed: false,
    exposesScriptBodies: false,
    exposesPromptContent: false,
    exposesSourceFileContent: false,
  };
  persistState();

  return {
    registry: "openclaw-source-command-task-v0",
    mode: "approval-gated-source-command",
    generatedAt: new Date().toISOString(),
    sourceRegistry: sourceDraft.registry,
    sourceMode: sourceDraft.mode,
    sourceCommandProposal: sourceProposal,
    sourceCommandSignals: sourceDraft.sourceCommandSignals,
    sourceCommandPlan: sourceDraft.sourceCommandPlan,
    sourceCommandTask: {
      registry: "openclaw-source-command-task-v0",
      mode: "approval-gated-source-command",
      workspaceTaskRegistry: workspaceTask.registry,
      proposalId: sourceProposal.id,
      approvalId: workspaceTask.approval?.id ?? null,
      taskId: workspaceTask.task?.id ?? null,
      executed: false,
      contentExposed: false,
    },
    workspaceCommandTask: {
      registry: workspaceTask.registry,
      mode: workspaceTask.mode,
      sourceRegistry: workspaceTask.sourceRegistry,
    },
    task: workspaceTask.task,
    approval: workspaceTask.approval,
    governance: {
      mode: "source_command_task_approval_gated",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      canExecute: false,
      canMutate: false,
      executed: false,
      requiresExplicitApproval: true,
      requiresExplicitApprovalBeforeExecution: true,
      delegatesExecutionTo: "workspace-command-task-v0",
      exposesScriptBodies: false,
      exposesPromptContent: false,
      exposesSourceFileContent: false,
    },
  };
}


  return {
    sha256Hex,
    resolveOpenClawWorkspaceTarget,
    buildNativeOpenClawWorkspaceTextWriteDraft,
    createNativeOpenClawWorkspaceTextWriteTask,
    createNativeEngineeringEditProposalTask,
    createNativeEngineeringWriteProposalTask,
    createNativeEngineeringLspLifecycleTask,
    readBoundedWorkspaceTextFile,
    normaliseWorkspacePatchEdits,
    applyWorkspacePatchEdits,
    buildDiffPreview,
    buildWorkspacePatchDiffPreview,
    buildWorkspacePatchProposalEnvelope,
    buildOpenClawSourceDerivedPatchProposal,
    buildNativeOpenClawWorkspacePatchApplyDraft,
    createNativeOpenClawWorkspacePatchApplyTask,
    buildOpenClawSourceAuthoredEditDraft,
    createOpenClawSourceAuthoredEditTask,
    findWorkspaceCommandProposal,
    buildWorkspaceCommandPlanDraft,
    findSourceCommandProposal,
    buildOpenClawSourceCommandPlanDraft,
    createWorkspaceCommandTask,
    createOpenClawSourceCommandTask,
  };
}

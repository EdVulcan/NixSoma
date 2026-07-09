import { createHash } from "node:crypto";
import {
  applyWorkspacePatchEdits,
  buildWorkspacePatchDiffPreview,
  countOccurrences,
  normaliseWorkspacePatchEdits,
  validateWorkspacePatchDiffPreview,
} from "./workspace-patch-utils.mjs";

export const NATIVE_ENGINEERING_EDIT_PROPOSAL_REGISTRY = "openclaw-native-engineering-edit-proposal-v0";

const MAX_SEARCH_BYTES = 16 * 1024;
const MAX_REPLACEMENT_BYTES = 16 * 1024;

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function boundedText(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}

function normaliseInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function ensureBoundedEditText(search, replacement) {
  if (byteLength(search) > MAX_SEARCH_BYTES) {
    throw new Error("native engineering edit proposal search text exceeds the per-hunk size limit.");
  }
  if (byteLength(replacement) > MAX_REPLACEMENT_BYTES) {
    throw new Error("native engineering edit proposal replacement text exceeds the per-hunk size limit.");
  }
}

function buildGovernance() {
  return {
    mode: "native_engineering_edit_proposal_diff_preview_only",
    runtimeOwner: "openclaw_on_nixos",
    canReadWorkspaceContent: true,
    canReadArbitrarySystemPath: false,
    canImportModule: false,
    canExecuteToolCode: false,
    canRunVerification: false,
    canStartLsp: false,
    canMutate: false,
    createsTask: false,
    createsApproval: false,
    canApplyPatch: false,
    requiresApprovalBeforeApply: true,
    observerVisible: true,
  };
}

export function createNativeEngineeringEditProposalBuilders({
  buildNativeEngineeringReadFile,
} = {}) {
  if (typeof buildNativeEngineeringReadFile !== "function") {
    throw new Error("buildNativeEngineeringReadFile is required.");
  }

  function buildNativeEngineeringEditProposal({
    workspacePath = null,
    relativePath = null,
    oldString = null,
    newString = null,
    contextLines = 1,
    maxOutputChars = 24_000,
    maxFileSizeBytes = 128 * 1024,
  } = {}) {
    const search = boundedText(oldString, "oldString");
    const replacement = typeof newString === "string" ? newString : "";
    const safeContextLines = normaliseInteger(contextLines, 1, 0, 3);
    ensureBoundedEditText(search, replacement);
    const read = buildNativeEngineeringReadFile({
      workspacePath,
      relativePath,
      startLine: 1,
      maxOutputChars,
      maxFileSizeBytes,
    });
    if (!read.ok || read.blocked) {
      throw new Error(`native engineering edit proposal cannot read target: ${read.target?.blockedReason ?? "read_blocked"}`);
    }
    if (read.summary?.outputTruncated) {
      throw new Error("native engineering edit proposal requires the full bounded file content; read output was truncated.");
    }

    const originalContent = read.content;
    const replacementsAvailable = countOccurrences(originalContent, search);
    if (replacementsAvailable !== 1) {
      throw new Error(`native engineering edit proposal requires exactly one match; found ${replacementsAvailable}.`);
    }

    const safeEdits = normaliseWorkspacePatchEdits({
      search,
      replacement,
      occurrence: 1,
    });
    const { nextContent, appliedEdits, validation } = applyWorkspacePatchEdits(originalContent, safeEdits);
    const diffPreview = buildWorkspacePatchDiffPreview(originalContent, nextContent, appliedEdits, { contextLines: safeContextLines });
    const previewValidation = validateWorkspacePatchDiffPreview(diffPreview);
    const appliedEdit = appliedEdits[0];
    const originalSha256 = sha256Hex(originalContent);
    const proposedSha256 = sha256Hex(nextContent);
    const generatedAt = new Date().toISOString();
    const bounds = {
      ...read.bounds,
      maxSearchBytes: MAX_SEARCH_BYTES,
      maxReplacementBytes: MAX_REPLACEMENT_BYTES,
      uniqueExactMatchRequired: true,
      diffPreviewMaxLines: previewValidation.maxPreviewLines,
      noWriteApply: true,
    };
    const target = {
      relativePath: read.target.relativePath,
      originalBytes: byteLength(originalContent),
      proposedBytes: byteLength(nextContent),
      originalSha256,
      proposedSha256,
      changedAtLine: appliedEdit.changedAtLine,
      replacementsAvailable,
      searchBytes: byteLength(search),
      replacementBytes: byteLength(replacement),
      contentExposed: false,
      diffPreviewExposed: true,
    };
    const summary = {
      editCount: 1,
      replacementsAvailable,
      changedAtLine: appliedEdit.changedAtLine,
      previewLineCount: diffPreview.previewLineCount,
      previewTruncated: diffPreview.truncated,
      createsTask: false,
      createsApproval: false,
      canMutate: false,
      nextRequiredStep: "approval_gated_patch_apply_task",
    };

    return {
      ok: true,
      registry: NATIVE_ENGINEERING_EDIT_PROPOSAL_REGISTRY,
      mode: "surgical-edit-proposal-diff-preview-only",
      generatedAt,
      identityLevel: "Level 1: stable user-space control plane",
      sourceCapability: {
        sourceToolName: "cc_edit",
        intendedNativeCapabilityId: "act.openclaw.engineering_tool.edit_proposal",
        migrationMode: "proposal_and_diff_preview_only",
      },
      capability: {
        id: "act.openclaw.engineering_tool.edit_proposal",
        sourceToolName: "cc_edit",
        risk: "high",
        approvalRequired: true,
      },
      workspace: read.workspace,
      target,
      proposal: {
        id: `engineering-edit-${sha256Hex(`${read.workspace?.path ?? ""}:${target.relativePath}:${originalSha256}:${proposedSha256}`).slice(0, 16)}`,
        title: `Surgical edit proposal for ${target.relativePath}`,
        kind: "exact_replacement_diff_preview",
        rationale: "Native OpenClaw exact-match edit proposal derived from the enhanced cc_edit semantics without applying the patch.",
        expectedChecks: ["diff-preview", "unique-exact-match", "approval-required-before-apply"],
      },
      validation: {
        ok: true,
        exactReplacement: {
          ok: true,
          engine: "openclaw-native-engineering-edit-proposal-v0",
          uniqueExactMatch: true,
          replacementsAvailable,
        },
        structuredPatch: validation,
        preview: previewValidation,
      },
      edits: [{
        index: appliedEdit.index,
        kind: appliedEdit.kind,
        occurrence: appliedEdit.occurrence,
        changedAtLine: appliedEdit.changedAtLine,
        originalStart: appliedEdit.originalStart,
        originalEnd: appliedEdit.originalEnd,
        searchBytes: appliedEdit.searchBytes,
        replacementBytes: appliedEdit.replacementBytes,
        searchExposed: false,
        replacementExposed: false,
      }],
      diffPreview,
      bounds,
      governance: buildGovernance(),
      auditEvidence: {
        operation: "edit_proposal",
        capabilityId: "act.openclaw.engineering_tool.edit_proposal",
        generatedAt,
        workspace: read.workspace,
        target,
        summary,
        bounds,
        persisted: false,
        evidenceKind: "response_embedded_audit_evidence",
      },
      summary,
      deferredExecutionBoundaries: [
        "no filesystem write",
        "no patch apply",
        "no task creation",
        "no approval creation",
        "no shell execution",
        "no provider call",
      ],
    };
  }

  return {
    buildNativeEngineeringEditProposal,
  };
}

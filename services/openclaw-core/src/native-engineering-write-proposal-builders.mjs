import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import path from "node:path";
import { buildDiffPreview } from "./workspace-patch-utils.mjs";

export const NATIVE_ENGINEERING_WRITE_PROPOSAL_REGISTRY = "openclaw-native-engineering-write-proposal-v0";

const DEFAULT_MAX_CONTENT_BYTES = 16 * 1024;
const MAX_CONTENT_BYTES = 24 * 1024;
const DEFAULT_MAX_EXISTING_FILE_BYTES = 24 * 1024;
const MAX_EXISTING_FILE_BYTES = 24 * 1024;
const MAX_PREVIEW_LINES = 64;
const SKIPPED_DIRECTORY_NAMES = new Set([
  ".cache",
  ".git",
  ".next",
  ".openclaw",
  ".serena",
  ".turbo",
  ".vite",
  "__generated__",
  "build",
  "cache",
  "coverage",
  "dist",
  "generated",
  "node_modules",
  "out",
  "target",
  "vendor",
]);

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}

function safeRealpath(filePath) {
  try {
    return realpathSync(filePath);
  } catch {
    return null;
  }
}

function isInsidePath(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalisePositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function normaliseBoolean(value, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return fallback;
  }
  const lower = value.trim().toLowerCase();
  if (["false", "0", "no", "off"].includes(lower)) {
    return false;
  }
  if (["true", "1", "yes", "on"].includes(lower)) {
    return true;
  }
  return fallback;
}

function shouldSkipDirectoryName(name) {
  const lower = name.toLowerCase();
  return name.startsWith(".")
    || SKIPPED_DIRECTORY_NAMES.has(lower)
    || lower.includes("cache")
    || lower.includes("generated");
}

function hasSkippedDirectorySegment(relativePath) {
  return relativePath
    .split("/")
    .filter(Boolean)
    .slice(0, -1)
    .some((segment) => shouldSkipDirectoryName(segment));
}

function normaliseRelativePath(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("relativePath is required for native engineering write proposals.");
  }
  const raw = value.trim().replaceAll("\\", "/");
  if (raw.includes("\0") || path.isAbsolute(raw) || raw.startsWith("/")) {
    throw new Error("relativePath must be a workspace-relative path.");
  }
  const normalised = path.posix.normalize(raw).replace(/^\.\//u, "");
  if (normalised === "." || normalised === ".." || normalised.startsWith("../") || normalised.includes("/../")) {
    throw new Error("relativePath must stay inside the selected workspace.");
  }
  if (hasSkippedDirectorySegment(normalised)) {
    throw new Error("relativePath is blocked by the hidden/generated/cache directory policy.");
  }
  return normalised;
}

function normaliseContent({ content = "", contentBase64 = null, maxContentBytes }) {
  const text = typeof contentBase64 === "string" && contentBase64
    ? Buffer.from(contentBase64, "base64").toString("utf8")
    : typeof content === "string"
      ? content
      : "";
  const bytes = byteLength(text);
  if (bytes > maxContentBytes) {
    throw new Error("native engineering write proposal content exceeds the bounded content size.");
  }
  return {
    text,
    bytes,
    sha256: sha256Hex(text),
    lineCount: text.length === 0 ? 0 : text.split(/\r?\n/u).length,
  };
}

function resolveWorkspace({ selectOpenClawToolCatalogWorkspace, workspacePath }) {
  const { registry, item } = selectOpenClawToolCatalogWorkspace({ workspacePath });
  const rootPath = path.resolve(item.path);
  const rootRealPath = safeRealpath(rootPath) ?? rootPath;
  return {
    registry,
    item,
    rootPath,
    rootRealPath,
  };
}

function assertExistingParentInsideWorkspace({ rootRealPath, absolutePath, safeStat }) {
  let current = path.dirname(absolutePath);
  while (current && current !== path.dirname(current)) {
    const stats = safeStat(current);
    if (stats) {
      const realPath = safeRealpath(current);
      if (!realPath || !isInsidePath(rootRealPath, realPath)) {
        throw new Error("resolved parent path escapes the selected workspace.");
      }
      return;
    }
    if (path.resolve(current) === path.resolve(rootRealPath)) {
      return;
    }
    current = path.dirname(current);
  }
}

function resolveTarget({ workspace, relativePath, safeStat }) {
  const safeRelativePath = normaliseRelativePath(relativePath);
  const absolutePath = path.resolve(workspace.rootRealPath, safeRelativePath);
  if (!isInsidePath(workspace.rootRealPath, absolutePath)) {
    throw new Error("resolved path escapes the selected workspace.");
  }
  assertExistingParentInsideWorkspace({
    rootRealPath: workspace.rootRealPath,
    absolutePath,
    safeStat,
  });
  const stats = safeStat(absolutePath);
  if (!stats) {
    return {
      relativePath: safeRelativePath,
      absolutePath,
      exists: false,
      sizeBytes: 0,
      realPath: null,
    };
  }
  if (!stats.isFile()) {
    throw new Error("native engineering write proposal target is not a regular file.");
  }
  const realPath = safeRealpath(absolutePath);
  if (!realPath || !isInsidePath(workspace.rootRealPath, realPath)) {
    throw new Error("resolved real path escapes the selected workspace.");
  }
  return {
    relativePath: safeRelativePath,
    absolutePath,
    exists: true,
    sizeBytes: stats.size,
    realPath,
  };
}

function buildBounds({ maxContentBytes, maxExistingFileBytes }) {
  return {
    workspaceRootConstrained: true,
    pathTraversalProtection: true,
    existingParentRealpathConstrained: true,
    skippedDirectoryPolicy: "hidden_generated_cache_dependency_directories_rejected",
    maxContentBytes,
    maxExistingFileBytes,
    maxPreviewLines: MAX_PREVIEW_LINES,
    noFilesystemWrite: true,
    noTaskCreation: true,
    noApprovalCreation: true,
    noShellExecution: true,
    noProviderCall: true,
  };
}

function buildGovernance() {
  return {
    mode: "native_engineering_write_proposal_diff_metadata_preview_only",
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
    canWriteFile: false,
    canOverwriteFile: false,
    requiresApprovalBeforeWrite: true,
    approvedMutationCapabilityId: "act.openclaw.workspace_text_write",
    observerVisible: true,
  };
}

function redactDiffPreview(diffPreview) {
  return {
    ...diffPreview,
    contentExposed: false,
    lines: diffPreview.lines.map((line) => ({
      type: line.type,
      oldLine: line.oldLine ?? null,
      newLine: line.newLine ?? null,
      textRedacted: true,
      textChars: typeof line.text === "string" ? line.text.length : 0,
      textSha256: sha256Hex(line.text ?? ""),
    })),
  };
}

function buildBlockedResponse({
  workspace,
  target,
  content,
  overwrite,
  reason,
  bounds,
}) {
  const generatedAt = new Date().toISOString();
  const summary = {
    blocked: true,
    reason,
    targetExists: target.exists,
    overwriteRequested: overwrite,
    proposedBytes: content.bytes,
    createsTask: false,
    createsApproval: false,
    canMutate: false,
  };
  return {
    ok: false,
    blocked: true,
    registry: NATIVE_ENGINEERING_WRITE_PROPOSAL_REGISTRY,
    mode: "source-write-proposal-diff-metadata-preview-only",
    generatedAt,
    identityLevel: "Level 1: stable user-space control plane",
    sourceCapability: {
      sourceToolName: "cc_write",
      intendedNativeCapabilityId: "act.openclaw.engineering_tool.write_proposal",
      migrationMode: "proposal_and_redacted_diff_metadata_preview_only",
    },
    capability: {
      id: "act.openclaw.engineering_tool.write_proposal",
      sourceToolName: "cc_write",
      risk: "high",
      approvalRequired: true,
    },
    workspace: {
      id: workspace.item.id,
      name: workspace.item.name,
      path: workspace.item.path,
      sourceRegistry: workspace.registry?.registry ?? null,
    },
    target: {
      relativePath: target.relativePath,
      exists: target.exists,
      existingBytes: target.sizeBytes,
      proposedBytes: content.bytes,
      proposedSha256: content.sha256,
      overwriteRequested: overwrite,
      blockedReason: reason,
      contentExposed: false,
    },
    bounds,
    governance: buildGovernance(),
    auditEvidence: {
      operation: "write_proposal",
      capabilityId: "act.openclaw.engineering_tool.write_proposal",
      generatedAt,
      summary,
      persisted: false,
      evidenceKind: "response_embedded_audit_evidence",
    },
    summary,
    deferredExecutionBoundaries: [
      "no filesystem write",
      "no overwrite",
      "no task creation",
      "no approval creation",
      "no shell execution",
      "no provider call",
    ],
  };
}

export function createNativeEngineeringWriteProposalBuilders({
  buildNativeEngineeringReadFile,
  safeStat,
  selectOpenClawToolCatalogWorkspace,
} = {}) {
  if (typeof buildNativeEngineeringReadFile !== "function") {
    throw new Error("buildNativeEngineeringReadFile is required.");
  }
  if (typeof safeStat !== "function") {
    throw new Error("safeStat is required.");
  }
  if (typeof selectOpenClawToolCatalogWorkspace !== "function") {
    throw new Error("selectOpenClawToolCatalogWorkspace is required.");
  }

  function buildNativeEngineeringWriteProposal({
    workspacePath = null,
    relativePath = "scratch/native-engineering-write-proposal.txt",
    content = "",
    contentBase64 = null,
    overwrite = false,
    contextLines = 1,
    maxContentBytes = DEFAULT_MAX_CONTENT_BYTES,
    maxExistingFileBytes = DEFAULT_MAX_EXISTING_FILE_BYTES,
  } = {}) {
    const safeMaxContentBytes = normalisePositiveInteger(maxContentBytes, DEFAULT_MAX_CONTENT_BYTES, MAX_CONTENT_BYTES);
    const safeMaxExistingFileBytes = normalisePositiveInteger(maxExistingFileBytes, DEFAULT_MAX_EXISTING_FILE_BYTES, MAX_EXISTING_FILE_BYTES);
    const safeOverwrite = normaliseBoolean(overwrite, false);
    const workspace = resolveWorkspace({ selectOpenClawToolCatalogWorkspace, workspacePath });
    const target = resolveTarget({ workspace, relativePath, safeStat });
    const proposed = normaliseContent({
      content,
      contentBase64,
      maxContentBytes: safeMaxContentBytes,
    });
    const bounds = buildBounds({
      maxContentBytes: safeMaxContentBytes,
      maxExistingFileBytes: safeMaxExistingFileBytes,
    });

    if (target.exists && !safeOverwrite) {
      return buildBlockedResponse({
        workspace,
        target,
        content: proposed,
        overwrite: safeOverwrite,
        reason: "target_exists_overwrite_false",
        bounds,
      });
    }

    let existingContent = "";
    let existingSha256 = null;
    let existingRead = null;
    if (target.exists) {
      existingRead = buildNativeEngineeringReadFile({
        workspacePath,
        relativePath: target.relativePath,
        startLine: 1,
        maxOutputChars: safeMaxExistingFileBytes,
        maxFileSizeBytes: safeMaxExistingFileBytes,
      });
      if (!existingRead.ok || existingRead.blocked) {
        return buildBlockedResponse({
          workspace,
          target,
          content: proposed,
          overwrite: safeOverwrite,
          reason: existingRead.target?.blockedReason ?? "existing_target_read_blocked",
          bounds,
        });
      }
      if (existingRead.summary?.outputTruncated) {
        return buildBlockedResponse({
          workspace,
          target,
          content: proposed,
          overwrite: safeOverwrite,
          reason: "existing_target_preview_truncated",
          bounds,
        });
      }
      existingContent = existingRead.content;
      existingSha256 = sha256Hex(existingContent);
    }

    const diffPreview = redactDiffPreview(buildDiffPreview(existingContent, proposed.text, {
      contextLines: normalisePositiveInteger(contextLines, 1, 3),
      maxPreviewLines: MAX_PREVIEW_LINES,
    }));
    const generatedAt = new Date().toISOString();
    const proposalKind = target.exists ? "overwrite_file_proposal" : "create_file_proposal";
    const targetEvidence = {
      relativePath: target.relativePath,
      exists: target.exists,
      existingBytes: target.exists ? target.sizeBytes : 0,
      existingSha256,
      proposedBytes: proposed.bytes,
      proposedSha256: proposed.sha256,
      overwriteRequested: safeOverwrite,
      contentExposed: false,
      diffPreviewTextExposed: false,
      diffMetadataExposed: true,
    };
    const summary = {
      proposalKind,
      targetExists: target.exists,
      overwriteRequested: safeOverwrite,
      proposedBytes: proposed.bytes,
      proposedLineCount: proposed.lineCount,
      previewLineCount: diffPreview.previewLineCount,
      previewTruncated: diffPreview.truncated,
      createsTask: false,
      createsApproval: false,
      canMutate: false,
      nextRequiredStep: "approval_gated_workspace_text_write_task",
    };

    return {
      ok: true,
      blocked: false,
      registry: NATIVE_ENGINEERING_WRITE_PROPOSAL_REGISTRY,
      mode: "source-write-proposal-diff-metadata-preview-only",
      generatedAt,
      identityLevel: "Level 1: stable user-space control plane",
      sourceCapability: {
        sourceToolName: "cc_write",
        intendedNativeCapabilityId: "act.openclaw.engineering_tool.write_proposal",
        migrationMode: "proposal_and_redacted_diff_metadata_preview_only",
      },
      capability: {
        id: "act.openclaw.engineering_tool.write_proposal",
        sourceToolName: "cc_write",
        risk: "high",
        approvalRequired: true,
      },
      workspace: {
        id: workspace.item.id,
        name: workspace.item.name,
        path: workspace.item.path,
        sourceRegistry: workspace.registry?.registry ?? null,
      },
      target: targetEvidence,
      proposal: {
        id: `engineering-write-${sha256Hex(`${workspace.item.path}:${target.relativePath}:${existingSha256 ?? "new"}:${proposed.sha256}:${safeOverwrite}`).slice(0, 16)}`,
        title: `${target.exists ? "Overwrite" : "Create"} file proposal for ${target.relativePath}`,
        kind: proposalKind,
        rationale: "Native OpenClaw cc_write-style proposal generated without writing files; approved mutation remains on the workspace_text_write path.",
        expectedChecks: ["diff-metadata-preview", "approval-required-before-write", "filesystem-ledger-after-approved-write"],
      },
      validation: {
        ok: true,
        engine: "openclaw-native-engineering-write-proposal-v0",
        target: {
          workspaceBounded: true,
          parentRealpathBounded: true,
          overwriteAllowedByRequest: !target.exists || safeOverwrite,
        },
        preview: {
          engine: "openclaw-native-write-redacted-preview-validation-v0",
          format: diffPreview.format,
          previewLineCount: diffPreview.previewLineCount,
          truncated: diffPreview.truncated,
          contentExposed: false,
        },
      },
      diffPreview,
      bounds,
      governance: buildGovernance(),
      auditEvidence: {
        operation: "write_proposal",
        capabilityId: "act.openclaw.engineering_tool.write_proposal",
        generatedAt,
        workspace: {
          id: workspace.item.id,
          name: workspace.item.name,
          path: workspace.item.path,
        },
        target: targetEvidence,
        summary,
        bounds,
        persisted: false,
        evidenceKind: "response_embedded_audit_evidence",
      },
      summary,
      deferredExecutionBoundaries: [
        "no filesystem write",
        "no overwrite",
        "no task creation",
        "no approval creation",
        "no shell execution",
        "no provider call",
      ],
    };
  }

  return {
    buildNativeEngineeringWriteProposal,
  };
}

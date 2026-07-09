import { readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const NATIVE_ENGINEERING_LSP_SOURCE_TRANSFER_PROPOSAL_REGISTRY =
  "openclaw-native-engineering-lsp-source-transfer-proposal-v0";

const DEFAULT_MAX_FILE_SIZE_BYTES = 128 * 1024;
const MAX_FILE_SIZE_BYTES = 512 * 1024;
const DEFAULT_MAX_PREVIEW_CHARS = 8_000;
const MAX_PREVIEW_CHARS = 24_000;
const DEFAULT_TEXT_DOCUMENT_VERSION = 1;

const SKIPPED_PATH_SEGMENTS = new Set([
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

const LANGUAGE_PROFILES = Object.freeze({
  typescript: Object.freeze({
    languageId: "typescript",
    extensions: Object.freeze([".ts", ".tsx"]),
    serverBinary: "typescript-language-server",
  }),
  javascript: Object.freeze({
    languageId: "javascript",
    extensions: Object.freeze([".js", ".jsx", ".mjs", ".cjs"]),
    serverBinary: "typescript-language-server",
  }),
  python: Object.freeze({
    languageId: "python",
    extensions: Object.freeze([".py"]),
    serverBinary: "pylsp",
  }),
});

function normalisePositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
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

function shouldSkipPathSegment(segment) {
  const lower = segment.toLowerCase();
  return lower.startsWith(".")
    || SKIPPED_PATH_SEGMENTS.has(lower)
    || lower.includes("cache")
    || lower.includes("generated");
}

function hasSkippedPathSegment(relativePath) {
  return relativePath
    .split("/")
    .filter(Boolean)
    .some((segment) => shouldSkipPathSegment(segment));
}

function normaliseRelativePath(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("relativePath is required for LSP source-transfer proposal.");
  }
  const raw = value.trim().replaceAll("\\", "/");
  if (raw.includes("\0") || path.isAbsolute(raw) || raw.startsWith("/")) {
    throw new Error("relativePath must be a workspace-relative path.");
  }
  const normalised = path.posix.normalize(raw).replace(/^\.\//u, "");
  if (normalised === "." || normalised === ".." || normalised.startsWith("../") || normalised.includes("/../")) {
    throw new Error("relativePath must stay inside the selected workspace.");
  }
  if (hasSkippedPathSegment(normalised)) {
    throw new Error("relativePath is blocked by the hidden/generated/cache directory policy.");
  }
  return normalised;
}

function normaliseLanguage(value) {
  const language = typeof value === "string" ? value.trim().toLowerCase() : "";
  return Object.hasOwn(LANGUAGE_PROFILES, language) ? language : "typescript";
}

function looksBinary(buffer) {
  if (buffer.includes(0)) {
    return true;
  }
  const sampleSize = Math.min(buffer.length, 4096);
  let controlBytes = 0;
  for (let index = 0; index < sampleSize; index += 1) {
    const byte = buffer[index];
    if (byte < 7 || (byte > 13 && byte < 32)) {
      controlBytes += 1;
    }
  }
  return sampleSize > 0 && controlBytes / sampleSize > 0.3;
}

function truncateText(value, maxChars) {
  if (value.length <= maxChars) {
    return { text: value, truncated: false };
  }
  return {
    text: value.slice(0, maxChars),
    truncated: true,
  };
}

function sha256Hex(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function countLines(text) {
  return text.length === 0 ? 0 : text.split(/\r\n|\r|\n/u).length;
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

function resolveWorkspaceFile({ workspace, relativePath, safeStat }) {
  const safeRelativePath = normaliseRelativePath(relativePath);
  const absolutePath = path.resolve(workspace.rootRealPath, safeRelativePath);
  if (!isInsidePath(workspace.rootRealPath, absolutePath)) {
    throw new Error("resolved path escapes the selected workspace.");
  }
  const stats = safeStat(absolutePath);
  if (!stats?.isFile()) {
    throw new Error(`workspace file is not readable: ${safeRelativePath}`);
  }
  const realPath = safeRealpath(absolutePath);
  if (!realPath || !isInsidePath(workspace.rootRealPath, realPath)) {
    throw new Error("resolved real path escapes the selected workspace.");
  }
  return {
    relativePath: safeRelativePath,
    absolutePath,
    realPath,
    stats,
  };
}

function readBoundedSourceFile({ file, maxFileSizeBytes }) {
  if (file.stats.size > maxFileSizeBytes) {
    throw new Error(`workspace file exceeds maxFileSizeBytes: ${file.relativePath}`);
  }
  const buffer = readFileSync(file.realPath);
  if (looksBinary(buffer)) {
    throw new Error(`workspace file appears binary and is not eligible for LSP source-transfer proposal: ${file.relativePath}`);
  }
  return {
    buffer,
    text: buffer.toString("utf8"),
  };
}

function buildGovernance() {
  return {
    mode: "native_engineering_lsp_source_transfer_proposal_read_only",
    runtimeOwner: "openclaw_on_nixos",
    canReadWorkspaceSourceForProposal: true,
    canTransferSourceContentToLsp: false,
    canSendDidOpen: false,
    canSendSymbolRequests: false,
    canStartLspServer: false,
    canReuseLongLivedProcess: false,
    canMutateWorkspace: false,
    canCreateTask: false,
    canCreateApproval: false,
    canCallProvider: false,
    futureSourceTransferRequiresApproval: true,
    observerVisible: true,
  };
}

function buildBounds({ maxFileSizeBytes, maxPreviewChars }) {
  return {
    workspaceRootConstrained: true,
    pathTraversalProtection: true,
    realPathMustStayInsideWorkspace: true,
    maxFileSizeBytes,
    maxPreviewChars,
    binaryFileSkipped: true,
    skippedDirectoryPolicy: "hidden_generated_cache_dependency_path_segments_rejected",
    noServerBinaryCheck: true,
    noLspServerStart: true,
    noLongLivedProcessPool: true,
    noJsonRpcSent: true,
    noDidOpenSent: true,
    noSymbolRequestSent: true,
    noWorkspaceMutation: true,
    noProviderCall: true,
  };
}

export function createNativeEngineeringLspSourceTransferProposalBuilders({
  safeStat,
  selectOpenClawToolCatalogWorkspace,
}) {
  function buildNativeEngineeringLspSourceTransferProposal({
    workspacePath = null,
    language = "typescript",
    relativePath = "src/app.ts",
    maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES,
    maxPreviewChars = DEFAULT_MAX_PREVIEW_CHARS,
  } = {}) {
    const safeLanguage = normaliseLanguage(language);
    const safeMaxFileSizeBytes = normalisePositiveInteger(maxFileSizeBytes, DEFAULT_MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_BYTES);
    const safeMaxPreviewChars = normalisePositiveInteger(maxPreviewChars, DEFAULT_MAX_PREVIEW_CHARS, MAX_PREVIEW_CHARS);
    const workspace = resolveWorkspace({ selectOpenClawToolCatalogWorkspace, workspacePath });
    const file = resolveWorkspaceFile({
      workspace,
      relativePath,
      safeStat,
    });
    const profile = LANGUAGE_PROFILES[safeLanguage];
    const extension = path.extname(file.relativePath).toLowerCase();
    const languageMatchesExtension = profile.extensions.includes(extension);
    if (!languageMatchesExtension) {
      throw new Error(`relativePath extension does not match selected LSP language: ${file.relativePath}`);
    }

    const { buffer, text } = readBoundedSourceFile({
      file,
      maxFileSizeBytes: safeMaxFileSizeBytes,
    });
    const textHash = sha256Hex(buffer);
    const preview = truncateText(text, safeMaxPreviewChars);
    const generatedAt = new Date().toISOString();
    const fileUri = pathToFileURL(file.realPath).href;
    const textBytes = Buffer.byteLength(text, "utf8");
    const lineCount = countLines(text);
    const summary = {
      language: safeLanguage,
      relativePath: file.relativePath,
      textBytes,
      lineCount,
      textSha256: textHash,
      previewChars: preview.text.length,
      previewTruncated: preview.truncated,
      didOpenSent: false,
      sourceContentTransferred: false,
      approvalRequiredBeforeTransfer: true,
    };

    return {
      ok: true,
      registry: NATIVE_ENGINEERING_LSP_SOURCE_TRANSFER_PROPOSAL_REGISTRY,
      mode: "lsp-didopen-source-transfer-proposal-only",
      generatedAt,
      identityLevel: "Level 1: stable user-space control plane",
      sourceCapability: {
        sourceToolName: "cc_lsp",
        intendedNativeCapabilityId: "plan.openclaw.engineering_tool.lsp_source_transfer",
        migrationMode: "bounded_didopen_source_transfer_proposal_without_json_rpc",
      },
      capability: {
        id: "plan.openclaw.engineering_tool.lsp_source_transfer",
        sourceToolName: "cc_lsp",
        operationClass: "lsp_source_content_transfer_proposal",
        risk: "medium",
        approvalRequiredForTransfer: true,
        approvalRequiredForProposal: false,
      },
      workspace: {
        id: workspace.item.id,
        name: workspace.item.name,
        path: workspace.item.path,
        sourceRegistry: workspace.registry?.registry ?? null,
      },
      file: {
        relativePath: file.relativePath,
        uri: fileUri,
        languageId: profile.languageId,
        extension,
        languageMatchesExtension,
        sizeBytes: file.stats.size,
        textBytes,
        lineCount,
        textSha256: textHash,
      },
      proposedDidOpen: {
        method: "textDocument/didOpen",
        sent: false,
        textDocument: {
          uri: fileUri,
          languageId: profile.languageId,
          version: DEFAULT_TEXT_DOCUMENT_VERSION,
          textBytes,
          textSha256: textHash,
          textPreviewChars: preview.text.length,
          textPreviewTruncated: preview.truncated,
        },
      },
      sourcePreview: {
        text: preview.text,
        chars: preview.text.length,
        truncated: preview.truncated,
        fullTextReturned: !preview.truncated,
        hashCoversFullText: true,
      },
      serverContract: {
        language: safeLanguage,
        serverBinary: profile.serverBinary,
        binaryChecked: false,
        processStarted: false,
        jsonRpcSent: false,
        didOpenSent: false,
      },
      bounds: buildBounds({
        maxFileSizeBytes: safeMaxFileSizeBytes,
        maxPreviewChars: safeMaxPreviewChars,
      }),
      governance: buildGovernance(),
      auditEvidence: {
        operation: "lsp_source_transfer_proposal",
        capabilityId: "plan.openclaw.engineering_tool.lsp_source_transfer",
        generatedAt,
        persisted: false,
        evidenceKind: "response_embedded_source_transfer_proposal",
        file: {
          relativePath: file.relativePath,
          languageId: profile.languageId,
          textBytes,
          lineCount,
          textSha256: textHash,
        },
      },
      summary,
      deferredExecutionBoundaries: [
        "no LSP server process start",
        "no long-lived LSP process pool",
        "no textDocument/didOpen notification sent",
        "no source content transferred into a language server process",
        "no definition/references/hover JSON-RPC request",
        "no task creation",
        "no approval creation",
        "no workspace mutation",
        "no provider call",
      ],
      nextSmallestRealCapability: "approval-gated source transfer task that sends didOpen only after explicit approval",
    };
  }

  return {
    buildNativeEngineeringLspSourceTransferProposal,
  };
}

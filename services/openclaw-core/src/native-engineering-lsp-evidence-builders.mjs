import { readdirSync, realpathSync } from "node:fs";
import path from "node:path";

export const NATIVE_ENGINEERING_LSP_EVIDENCE_REGISTRY = "openclaw-native-engineering-lsp-evidence-v0";
export const NATIVE_ENGINEERING_LSP_LIFECYCLE_DRAFT_REGISTRY = "openclaw-native-engineering-lsp-lifecycle-draft-v0";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1_000;
const MAX_DEPTH = 8;
const SAMPLE_FILES_PER_LANGUAGE = 8;
const SUPPORTED_ACTIONS = new Set(["check", "definition", "references", "hover"]);
const SUPPORTED_LIFECYCLE_ACTIONS = new Set(["start", "stop", "restart", "recover"]);
const SUPPORTED_LANGUAGES = new Set(["typescript", "javascript", "python"]);
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

const LANGUAGE_PROFILES = Object.freeze({
  typescript: Object.freeze({
    language: "typescript",
    extensions: Object.freeze([".ts", ".tsx"]),
    serverBinary: "typescript-language-server",
    serverArgs: Object.freeze(["--stdio"]),
    installHint: "npm install -g typescript-language-server typescript",
    configFiles: Object.freeze(["tsconfig.json", "jsconfig.json", "package.json"]),
  }),
  javascript: Object.freeze({
    language: "javascript",
    extensions: Object.freeze([".js", ".jsx", ".mjs", ".cjs"]),
    serverBinary: "typescript-language-server",
    serverArgs: Object.freeze(["--stdio"]),
    installHint: "npm install -g typescript-language-server typescript",
    configFiles: Object.freeze(["jsconfig.json", "tsconfig.json", "package.json"]),
  }),
  python: Object.freeze({
    language: "python",
    extensions: Object.freeze([".py"]),
    serverBinary: "pylsp",
    serverArgs: Object.freeze([]),
    installHint: "pip install python-lsp-server",
    configFiles: Object.freeze(["pyproject.toml", "setup.py", "requirements.txt"]),
  }),
});

function normalisePositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function normaliseNonNegativeInteger(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, max) : fallback;
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

function normaliseLanguage(value) {
  const language = typeof value === "string" ? value.trim().toLowerCase() : "";
  return SUPPORTED_LANGUAGES.has(language) ? language : "typescript";
}

function normaliseAction(value) {
  const action = typeof value === "string" ? value.trim().toLowerCase() : "";
  return SUPPORTED_ACTIONS.has(action) ? action : "check";
}

function normaliseLifecycleAction(value) {
  const action = typeof value === "string" ? value.trim().toLowerCase() : "";
  return SUPPORTED_LIFECYCLE_ACTIONS.has(action) ? action : "start";
}

function normaliseRelativePath(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("relativePath is required for LSP definition, references, and hover evidence.");
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

function configFileSignals(rootRealPath, profile, safeStat) {
  return profile.configFiles
    .map((relativePath) => {
      const absolutePath = path.resolve(rootRealPath, relativePath);
      const stats = safeStat(absolutePath);
      return stats?.isFile()
        ? { relativePath, present: true, contentRead: false }
        : null;
    })
    .filter(Boolean);
}

function createLanguageAccumulator(rootRealPath, safeStat) {
  return Object.fromEntries(Object.entries(LANGUAGE_PROFILES).map(([language, profile]) => [
    language,
    {
      language,
      extensions: [...profile.extensions],
      serverBinary: profile.serverBinary,
      installHint: profile.installHint,
      fileCount: 0,
      sampleFiles: [],
      configFiles: configFileSignals(rootRealPath, profile, safeStat),
    },
  ]));
}

function collectLanguageSignals({ rootRealPath, safeStat, limit }) {
  const languages = createLanguageAccumulator(rootRealPath, safeStat);
  const counters = {
    filesScanned: 0,
    directoriesScanned: 0,
    directoriesSkipped: 0,
    resultsTruncated: false,
  };

  function visit(directoryPath, relativeDirectory, depth) {
    if (counters.filesScanned >= limit) {
      counters.resultsTruncated = true;
      return;
    }
    if (depth > MAX_DEPTH) {
      counters.resultsTruncated = true;
      return;
    }
    let entries = [];
    try {
      entries = readdirSync(directoryPath, { withFileTypes: true });
    } catch {
      return;
    }
    counters.directoriesScanned += 1;
    for (const entry of entries) {
      if (counters.filesScanned >= limit) {
        counters.resultsTruncated = true;
        return;
      }
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = path.resolve(directoryPath, entry.name);
      if (entry.isDirectory()) {
        if (shouldSkipDirectoryName(entry.name)) {
          counters.directoriesSkipped += 1;
          continue;
        }
        visit(absolutePath, relativePath, depth + 1);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      counters.filesScanned += 1;
      const ext = path.extname(entry.name).toLowerCase();
      for (const profile of Object.values(LANGUAGE_PROFILES)) {
        if (profile.extensions.includes(ext)) {
          const bucket = languages[profile.language];
          bucket.fileCount += 1;
          if (bucket.sampleFiles.length < SAMPLE_FILES_PER_LANGUAGE) {
            const stats = safeStat(absolutePath);
            bucket.sampleFiles.push({
              relativePath,
              sizeBytes: stats?.size ?? null,
              contentRead: false,
            });
          }
        }
      }
    }
  }

  visit(rootRealPath, "", 0);
  return {
    languages: Object.values(languages),
    counters,
  };
}

function buildActionContracts() {
  return [
    {
      action: "check",
      operationClass: "lsp_server_availability_check",
      enhancedSourceBehavior: "checks language server binary version",
      nativeBoundary: "reports required server binary and install hint without executing version checks",
    },
    {
      action: "definition",
      operationClass: "lsp_symbol_definition",
      enhancedSourceBehavior: "opens file in LSP and sends textDocument/definition",
      nativeBoundary: "contract mapped only; server startup and JSON-RPC request remain deferred",
    },
    {
      action: "references",
      operationClass: "lsp_symbol_references",
      enhancedSourceBehavior: "opens file in LSP and sends textDocument/references",
      nativeBoundary: "contract mapped only; server startup and JSON-RPC request remain deferred",
    },
    {
      action: "hover",
      operationClass: "lsp_symbol_hover",
      enhancedSourceBehavior: "opens file in LSP and sends textDocument/hover",
      nativeBoundary: "contract mapped only; server startup and JSON-RPC request remain deferred",
    },
  ];
}

function buildGovernance() {
  return {
    mode: "native_engineering_lsp_evidence_read_only",
    runtimeOwner: "openclaw_on_nixos",
    canReadWorkspaceMetadata: true,
    canReadSourceFileContent: false,
    canCheckServerBinary: false,
    canStartLspServer: false,
    canOpenFileInServer: false,
    canSendJsonRpcRequest: false,
    canExecuteCommand: false,
    canMutate: false,
    canCreateTask: false,
    canCreateApproval: false,
    canCallProvider: false,
    observerVisible: true,
  };
}

function buildLifecycleReadinessGates({ profile, selectedLanguageSignal }) {
  const selectedLanguageFiles = selectedLanguageSignal?.fileCount ?? 0;
  const configFileCount = selectedLanguageSignal?.configFiles?.length ?? 0;
  return [
    {
      id: "workspace_scope_resolved",
      status: "passed",
      requiredForExecution: true,
      evidence: "workspace root selected from OpenClaw workspace registry",
    },
    {
      id: "language_profile_mapped",
      status: "passed",
      requiredForExecution: true,
      evidence: `${profile.language} maps to ${profile.serverBinary}`,
    },
    {
      id: "language_files_detected",
      status: selectedLanguageFiles > 0 ? "passed" : "needs_attention",
      requiredForExecution: true,
      evidence: `${selectedLanguageFiles} ${profile.language} file metadata records found`,
    },
    {
      id: "config_metadata_detected",
      status: configFileCount > 0 ? "passed" : "needs_attention",
      requiredForExecution: false,
      evidence: `${configFileCount} ${profile.language} config metadata records found`,
    },
    {
      id: "observer_visibility_declared",
      status: "passed",
      requiredForExecution: true,
      evidence: "draft is exposed through the existing Observer LSP panel",
    },
    {
      id: "audit_evidence_declared",
      status: "passed",
      requiredForExecution: true,
      evidence: "response embeds non-persisted lifecycle draft audit evidence",
    },
    {
      id: "server_binary_check",
      status: "deferred",
      requiredForExecution: true,
      evidence: "no binary/version command is executed by this draft",
    },
    {
      id: "process_supervision",
      status: "deferred",
      requiredForExecution: true,
      evidence: "no language server process is started or supervised",
    },
    {
      id: "lifecycle_state_store",
      status: "deferred",
      requiredForExecution: true,
      evidence: "no long-lived server pool or lifecycle state is persisted",
    },
    {
      id: "approval_task_bridge",
      status: "deferred",
      requiredForExecution: true,
      evidence: "no task or approval request is created by this draft",
    },
    {
      id: "json_rpc_handshake",
      status: "deferred",
      requiredForExecution: true,
      evidence: "no initialize, didOpen, definition, references, or hover JSON-RPC is sent",
    },
  ];
}

export function createNativeEngineeringLspEvidenceBuilders({
  safeStat,
  selectOpenClawToolCatalogWorkspace,
}) {
  function resolveWorkspace(workspacePath) {
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

  function buildRequestedPosition({ action, language, relativePath, line, character, rootRealPath }) {
    if (action === "check") {
      return {
        required: false,
        valid: true,
        relativePath: null,
        line: null,
        character: null,
      };
    }
    const safeRelativePath = normaliseRelativePath(relativePath);
    const absolutePath = path.resolve(rootRealPath, safeRelativePath);
    if (!isInsidePath(rootRealPath, absolutePath)) {
      throw new Error("resolved path escapes the selected workspace.");
    }
    const targetRealPath = safeRealpath(absolutePath);
    if (!targetRealPath || !isInsidePath(rootRealPath, targetRealPath)) {
      throw new Error("resolved real path escapes the selected workspace.");
    }
    const stats = safeStat(absolutePath);
    if (!stats?.isFile()) {
      throw new Error(`workspace file is not readable: ${safeRelativePath}`);
    }
    const safeLine = normalisePositiveInteger(line, 1, 1_000_000);
    const safeCharacter = normaliseNonNegativeInteger(character, 0, 100_000);
    const ext = path.extname(safeRelativePath).toLowerCase();
    const profile = LANGUAGE_PROFILES[language];
    return {
      required: true,
      valid: profile.extensions.includes(ext),
      relativePath: safeRelativePath,
      line: safeLine,
      character: safeCharacter,
      sizeBytes: stats.size,
      languageMatchesExtension: profile.extensions.includes(ext),
      contentRead: false,
    };
  }

  function buildNativeEngineeringLspEvidence({
    workspacePath = null,
    action = "check",
    language = "typescript",
    relativePath = null,
    line = null,
    character = null,
    limit = DEFAULT_LIMIT,
  } = {}) {
    const safeAction = normaliseAction(action);
    const safeLanguage = normaliseLanguage(language);
    const safeLimit = normalisePositiveInteger(limit, DEFAULT_LIMIT, MAX_LIMIT);
    const workspace = resolveWorkspace(workspacePath);
    const languageSignals = collectLanguageSignals({
      rootRealPath: workspace.rootRealPath,
      safeStat,
      limit: safeLimit,
    });
    const profile = LANGUAGE_PROFILES[safeLanguage];
    const requestedPosition = buildRequestedPosition({
      action: safeAction,
      language: safeLanguage,
      relativePath,
      line,
      character,
      rootRealPath: workspace.rootRealPath,
    });
    const generatedAt = new Date().toISOString();
    const selectedLanguageSignal = languageSignals.languages.find((item) => item.language === safeLanguage);
    const summary = {
      selectedAction: safeAction,
      selectedLanguage: safeLanguage,
      detectedLanguages: languageSignals.languages.filter((item) => item.fileCount > 0).map((item) => item.language),
      selectedLanguageFiles: selectedLanguageSignal?.fileCount ?? 0,
      configFilesPresent: selectedLanguageSignal?.configFiles?.length ?? 0,
      serverBinaryChecked: false,
      serverStarted: false,
      jsonRpcSent: false,
      canResolveSymbolNow: false,
    };

    return {
      ok: true,
      registry: NATIVE_ENGINEERING_LSP_EVIDENCE_REGISTRY,
      mode: "lsp-contract-and-availability-evidence-only",
      generatedAt,
      identityLevel: "Level 1: stable user-space control plane",
      sourceCapability: {
        sourceToolName: "cc_lsp",
        intendedNativeCapabilityId: "sense.openclaw.engineering_tool.lsp_evidence",
        migrationMode: "contract_and_availability_evidence_without_server_start",
      },
      capability: {
        id: "sense.openclaw.engineering_tool.lsp_evidence",
        sourceToolName: "cc_lsp",
        risk: "medium",
        approvalRequired: false,
      },
      workspace: {
        id: workspace.item.id,
        name: workspace.item.name,
        path: workspace.item.path,
        sourceRegistry: workspace.registry?.registry ?? null,
      },
      query: {
        action: safeAction,
        language: safeLanguage,
        relativePath,
        line: requestedPosition.line,
        character: requestedPosition.character,
        limit: safeLimit,
      },
      actionContracts: buildActionContracts(),
      languageSignals,
      serverReadiness: {
        language: safeLanguage,
        serverBinary: profile.serverBinary,
        serverArgs: [...profile.serverArgs],
        installHint: profile.installHint,
        status: "not_checked",
        reason: "command_execution_deferred",
        wouldRunVersionCommand: false,
        canStartServer: false,
        canSendJsonRpcRequest: false,
      },
      requestedPosition,
      bounds: {
        workspaceRootConstrained: true,
        maxFilesScanned: MAX_LIMIT,
        selectedScanLimit: safeLimit,
        maxDepth: MAX_DEPTH,
        skippedDirectoryPolicy: "hidden_generated_cache_dependency_directories_skipped",
        noSourceFileContentRead: true,
        noServerBinaryCheck: true,
        noLspServerStart: true,
        noJsonRpcRequest: true,
        noCommandExecution: true,
        noProviderCall: true,
      },
      governance: buildGovernance(),
      summary,
      auditEvidence: {
        operation: "lsp_evidence",
        capabilityId: "sense.openclaw.engineering_tool.lsp_evidence",
        generatedAt,
        summary,
        persisted: false,
        evidenceKind: "response_embedded_audit_evidence",
      },
      deferredExecutionBoundaries: [
        "no server binary version check",
        "no LSP server process start",
        "no file content read into LSP",
        "no textDocument/didOpen notification",
        "no definition/references/hover JSON-RPC request",
        "no task creation",
        "no approval creation",
        "no provider call",
      ],
    };
  }

  function buildNativeEngineeringLspLifecycleDraft({
    workspacePath = null,
    language = "typescript",
    lifecycleAction = "start",
    limit = DEFAULT_LIMIT,
  } = {}) {
    const safeLanguage = normaliseLanguage(language);
    const safeLifecycleAction = normaliseLifecycleAction(lifecycleAction);
    const safeLimit = normalisePositiveInteger(limit, DEFAULT_LIMIT, MAX_LIMIT);
    const workspace = resolveWorkspace(workspacePath);
    const languageSignals = collectLanguageSignals({
      rootRealPath: workspace.rootRealPath,
      safeStat,
      limit: safeLimit,
    });
    const profile = LANGUAGE_PROFILES[safeLanguage];
    const selectedLanguageSignal = languageSignals.languages.find((item) => item.language === safeLanguage);
    const readinessGates = buildLifecycleReadinessGates({ profile, selectedLanguageSignal });
    const generatedAt = new Date().toISOString();
    const summary = {
      selectedLanguage: safeLanguage,
      lifecycleAction: safeLifecycleAction,
      detectedLanguages: languageSignals.languages.filter((item) => item.fileCount > 0).map((item) => item.language),
      selectedLanguageFiles: selectedLanguageSignal?.fileCount ?? 0,
      configFilesPresent: selectedLanguageSignal?.configFiles?.length ?? 0,
      gatesPassed: readinessGates.filter((gate) => gate.status === "passed").length,
      gatesDeferred: readinessGates.filter((gate) => gate.status === "deferred").length,
      executionReady: false,
      canCreateTaskNow: false,
      serverBinaryChecked: false,
      serverStarted: false,
      jsonRpcSent: false,
      sourceContentRead: false,
    };

    return {
      ok: true,
      registry: NATIVE_ENGINEERING_LSP_LIFECYCLE_DRAFT_REGISTRY,
      mode: "lsp-lifecycle-readiness-draft-only",
      generatedAt,
      identityLevel: "Level 1: stable user-space control plane",
      sourceCapability: {
        sourceToolName: "cc_lsp",
        intendedNativeCapabilityId: "plan.openclaw.engineering_tool.lsp_lifecycle",
        migrationMode: "governed_lifecycle_draft_without_server_start",
      },
      capability: {
        id: "plan.openclaw.engineering_tool.lsp_lifecycle",
        sourceToolName: "cc_lsp",
        risk: "medium",
        approvalRequiredForExecution: true,
        approvalRequiredForDraft: false,
      },
      workspace: {
        id: workspace.item.id,
        name: workspace.item.name,
        path: workspace.item.path,
        sourceRegistry: workspace.registry?.registry ?? null,
      },
      query: {
        language: safeLanguage,
        lifecycleAction: safeLifecycleAction,
        limit: safeLimit,
      },
      lifecycleDraft: {
        id: `openclaw-lsp-${safeLanguage}-${safeLifecycleAction}-draft`,
        lifecycleAction: safeLifecycleAction,
        operationClass: "governed_language_server_lifecycle_action",
        status: "draft_only",
        workspaceScoped: true,
        selectedLanguage: safeLanguage,
        server: {
          language: safeLanguage,
          serverBinary: profile.serverBinary,
          serverArgs: [...profile.serverArgs],
          installHint: profile.installHint,
          binaryChecked: false,
          processStarted: false,
          jsonRpcHandshakeSent: false,
        },
        intendedLifecycleState: {
          currentStateRead: false,
          nextState: `${safeLifecycleAction}_requested_after_future_approval`,
          persisted: false,
          recoveryEvidenceRequired: true,
        },
        createsTask: false,
        createsApproval: false,
        mutatesWorkspace: false,
        executesCommand: false,
      },
      readinessGates,
      languageSignals,
      recoveryDraft: {
        observerVisible: true,
        automaticRecovery: false,
        recommendation: "future lifecycle failures should attach exit status, bounded stderr/stdout metadata, server state, and a governed recovery recommendation",
      },
      bounds: {
        workspaceRootConstrained: true,
        maxFilesScanned: MAX_LIMIT,
        selectedScanLimit: safeLimit,
        maxDepth: MAX_DEPTH,
        skippedDirectoryPolicy: "hidden_generated_cache_dependency_directories_skipped",
        noSourceFileContentRead: true,
        noServerBinaryCheck: true,
        noLspServerStart: true,
        noJsonRpcRequest: true,
        noCommandExecution: true,
        noTaskCreation: true,
        noApprovalCreation: true,
        noProviderCall: true,
      },
      governance: {
        ...buildGovernance(),
        mode: "native_engineering_lsp_lifecycle_draft_read_only",
        canDraftLifecycleAction: true,
        futureLifecycleExecutionRequiresApproval: true,
      },
      summary,
      auditEvidence: {
        operation: "lsp_lifecycle_readiness_draft",
        capabilityId: "plan.openclaw.engineering_tool.lsp_lifecycle",
        generatedAt,
        summary,
        persisted: false,
        evidenceKind: "response_embedded_lifecycle_draft_audit_evidence",
      },
      deferredExecutionBoundaries: [
        "no server binary version check",
        "no LSP server process start",
        "no lifecycle task creation",
        "no approval creation",
        "no lifecycle state persistence",
        "no file content read into LSP",
        "no textDocument/didOpen notification",
        "no definition/references/hover JSON-RPC request",
        "no provider call",
      ],
    };
  }

  return {
    buildNativeEngineeringLspEvidence,
    buildNativeEngineeringLspLifecycleDraft,
  };
}

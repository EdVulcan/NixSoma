import { readFileSync } from "node:fs";
import path from "node:path";

export const NATIVE_ENGINEERING_TOOL_SURFACE_REGISTRY = "openclaw-native-engineering-tool-surface-inventory-v0";

export const NATIVE_ENGINEERING_TOOL_CONTRACTS = [
  {
    sourceToolName: "cc_read",
    intendedNativeCapabilityId: "sense.openclaw.engineering_tool.read",
    operationClass: "read_only_file_read",
    riskLevel: "low",
    domain: "workspace_engineering",
    approvalExpectation: "not_required_for_metadata_inventory; future content reads require workspace scope, budget, and audit",
    auditExpectation: "record source path, line range, byte budget, result size, and caller provenance",
    observerVisibilityExpectation: "show selected workspace, file path, line range, budget, and redacted evidence",
    migrationStatus: "contract_mapped_execution_deferred",
    deferredExecutionBoundary: "no file body is returned by this inventory; precise governed file read is the next read surface",
    expectedSourcePaths: ["extensions/cc-tools/src/tools/FileReadTool.ts"],
  },
  {
    sourceToolName: "cc_edit",
    intendedNativeCapabilityId: "act.openclaw.engineering_tool.edit_proposal",
    operationClass: "mutation_proposal",
    riskLevel: "high",
    domain: "workspace_engineering",
    approvalExpectation: "approval_required_before_apply; inventory may only describe proposal contract",
    auditExpectation: "record target, exact-match check, diff preview hash, approval id, and filesystem ledger link",
    observerVisibilityExpectation: "show diff preview, uniqueness check, approval status, and recovery evidence",
    migrationStatus: "partially_absorbed_contract_mapped",
    deferredExecutionBoundary: "no patch is generated or applied by this inventory; execution remains behind approved OpenClaw patch tasks",
    expectedSourcePaths: ["extensions/cc-tools/src/tools/FileEditTool.ts"],
  },
  {
    sourceToolName: "cc_write",
    intendedNativeCapabilityId: "act.openclaw.engineering_tool.write_proposal",
    operationClass: "mutation_proposal",
    riskLevel: "high",
    domain: "workspace_engineering",
    approvalExpectation: "approval_required_before_create_or_overwrite; prefer edit proposal for existing files",
    auditExpectation: "record target, overwrite intent, byte count, content hash, approval id, and filesystem ledger link",
    observerVisibilityExpectation: "show target metadata, overwrite flag, redacted content hash, approval status, and recovery evidence",
    migrationStatus: "partially_absorbed_contract_mapped",
    deferredExecutionBoundary: "no write is drafted or applied by this inventory; future write remains task and approval gated",
    expectedSourcePaths: ["extensions/cc-tools/src/tools/FileWriteTool.ts"],
  },
  {
    sourceToolName: "cc_glob",
    intendedNativeCapabilityId: "sense.openclaw.engineering_tool.glob",
    operationClass: "read_only_path_search",
    riskLevel: "low",
    domain: "workspace_engineering",
    approvalExpectation: "not_required_for_bounded_workspace_metadata_search",
    auditExpectation: "record pattern, root, ignored directories, cap, matched count, and truncation status",
    observerVisibilityExpectation: "show pattern, root, result cap, ignored directory policy, and matched path evidence",
    migrationStatus: "contract_mapped_execution_deferred",
    deferredExecutionBoundary: "no glob is executed by this inventory; future read/search surface must bound results and workspace scope",
    expectedSourcePaths: ["extensions/cc-tools/src/tools/GlobTool.ts"],
  },
  {
    sourceToolName: "cc_grep",
    intendedNativeCapabilityId: "sense.openclaw.engineering_tool.grep",
    operationClass: "read_only_content_search",
    riskLevel: "low",
    domain: "workspace_engineering",
    approvalExpectation: "not_required_for_bounded_workspace_search; content snippets require result budget and audit",
    auditExpectation: "record query mode, include filters, root, line evidence, result cap, and truncation status",
    observerVisibilityExpectation: "show query, literal/regex mode, filters, result counts, and bounded line evidence",
    migrationStatus: "contract_mapped_execution_deferred",
    deferredExecutionBoundary: "no grep is executed by this inventory; future surface may use rg but must remain workspace bounded",
    expectedSourcePaths: ["extensions/cc-tools/src/tools/GrepTool.ts"],
  },
  {
    sourceToolName: "cc_lsp",
    intendedNativeCapabilityId: "sense.openclaw.engineering_tool.lsp",
    operationClass: "read_only_language_intelligence",
    riskLevel: "medium",
    domain: "workspace_engineering",
    approvalExpectation: "not_required_for_inventory; future LSP lifecycle requires explicit availability and lifecycle evidence",
    auditExpectation: "record language, server binary, workspace, request kind, lifecycle state, and failure evidence",
    observerVisibilityExpectation: "show server availability, lifecycle state, definition/reference/hover request evidence, and shutdown status",
    migrationStatus: "requires_source_transfer_contract_mapped",
    deferredExecutionBoundary: "no language server is started by this inventory; lifecycle management is deferred",
    expectedSourcePaths: [
      "extensions/cc-tools/src/lsp/LSPTool.ts",
      "extensions/cc-tools/src/lsp/lsp-manager.ts",
    ],
  },
  {
    sourceToolName: "cc_verify",
    intendedNativeCapabilityId: "act.openclaw.engineering_tool.verify",
    operationClass: "verification_command_evidence",
    riskLevel: "medium",
    domain: "workspace_engineering",
    approvalExpectation: "approval_or_policy_required_for_command_execution; inventory only maps the contract",
    auditExpectation: "record command shape, timeout, retry budget, exit status, output budget, and task completion attachment",
    observerVisibilityExpectation: "show command evidence, retry state, timeout flag, exit code, and redacted output summary",
    migrationStatus: "partially_absorbed_contract_mapped",
    deferredExecutionBoundary: "no shell or verification command is run by this inventory; verification evidence is a later slice",
    expectedSourcePaths: ["extensions/cc-tools/src/tools/VerifyCodeTool.ts"],
  },
  {
    sourceToolName: "cc_plan_enter",
    intendedNativeCapabilityId: "plan.openclaw.engineering_tool.plan_enter",
    operationClass: "planning_state",
    riskLevel: "low",
    domain: "workspace_engineering",
    approvalExpectation: "not_required_for_plan_state_metadata; no hidden mode switch without task/workbench evidence",
    auditExpectation: "record planning scope, objective, active task id, and transition timestamp",
    observerVisibilityExpectation: "show active planning state, objective, task linkage, and exit condition",
    migrationStatus: "contract_mapped_state_mutation_deferred",
    deferredExecutionBoundary: "no plan mode state is changed by this inventory; future state must live in OpenClaw task/workbench records",
    expectedSourcePaths: ["extensions/cc-tools/src/tools/PlanModeTool.ts"],
  },
  {
    sourceToolName: "cc_plan_exit",
    intendedNativeCapabilityId: "plan.openclaw.engineering_tool.plan_exit",
    operationClass: "planning_state",
    riskLevel: "low",
    domain: "workspace_engineering",
    approvalExpectation: "not_required_for_plan_state_metadata; no hidden execution transition without task evidence",
    auditExpectation: "record plan summary, unresolved items, execution readiness, and task/workbench linkage",
    observerVisibilityExpectation: "show plan exit evidence, unresolved work, and next execution boundary",
    migrationStatus: "contract_mapped_state_mutation_deferred",
    deferredExecutionBoundary: "no plan state is changed by this inventory; future exit must not auto-execute mutations",
    expectedSourcePaths: ["extensions/cc-tools/src/tools/PlanModeTool.ts"],
  },
  {
    sourceToolName: "cc_todo_write",
    intendedNativeCapabilityId: "plan.openclaw.engineering_tool.todo_write",
    operationClass: "planning_state",
    riskLevel: "low",
    domain: "workspace_engineering",
    approvalExpectation: "not_required_for_task_state_metadata; filesystem persistence is deferred to governed workbench storage",
    auditExpectation: "record todo count, state transitions, active task linkage, and persistence target",
    observerVisibilityExpectation: "show todo state, current item, completion evidence, and persistence status",
    migrationStatus: "contract_mapped_state_mutation_deferred",
    deferredExecutionBoundary: "no todo file or task state is written by this inventory; future todo state must be auditable",
    expectedSourcePaths: ["extensions/cc-tools/src/tools/PlanModeTool.ts"],
  },
];

function safeReadText(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function countLines(text) {
  if (typeof text !== "string" || text.length === 0) {
    return 0;
  }
  return text.split(/\r?\n/u).length;
}

function detectSourceToolNames(indexText) {
  if (typeof indexText !== "string") {
    return [];
  }
  return [...new Set(indexText.match(/\bcc_[a-z_]+\b/gu) ?? [])].sort();
}

function summariseSourceFile(workspaceRoot, relativePath, safeStat) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  const stats = safeStat(absolutePath);
  return {
    relativePath,
    present: Boolean(stats?.isFile()),
    sizeBytes: stats?.isFile() ? stats.size : null,
    contentRead: false,
    contentExposed: false,
  };
}

export function createNativeEngineeringToolSurfaceBuilders({
  selectOpenClawToolCatalogWorkspace,
  safeStat,
} = {}) {
  if (typeof selectOpenClawToolCatalogWorkspace !== "function") {
    throw new Error("selectOpenClawToolCatalogWorkspace is required.");
  }
  if (typeof safeStat !== "function") {
    throw new Error("safeStat is required.");
  }

  function buildNativeEngineeringToolSurfaceInventory({ workspacePath = null } = {}) {
    const { registry: workspaceRegistry, item } = selectOpenClawToolCatalogWorkspace({ workspacePath });
    const sourceRoot = path.join(item.path, "extensions", "cc-tools", "src");
    const indexRelativePath = "extensions/cc-tools/src/index.ts";
    const indexPath = path.join(item.path, indexRelativePath);
    const indexStats = safeStat(indexPath);
    const indexText = indexStats?.isFile() ? safeReadText(indexPath) : null;
    const detectedSourceToolNames = detectSourceToolNames(indexText);
    const detectedToolSet = new Set(detectedSourceToolNames);
    const sourceFiles = new Map();
    for (const contract of NATIVE_ENGINEERING_TOOL_CONTRACTS) {
      for (const relativePath of contract.expectedSourcePaths) {
        if (!sourceFiles.has(relativePath)) {
          sourceFiles.set(relativePath, summariseSourceFile(item.path, relativePath, safeStat));
        }
      }
    }
    const tools = NATIVE_ENGINEERING_TOOL_CONTRACTS.map((contract) => {
      const expectedFiles = contract.expectedSourcePaths.map((relativePath) => sourceFiles.get(relativePath));
      const sourceFilesPresent = expectedFiles.filter((file) => file?.present).length;
      return {
        sourceToolName: contract.sourceToolName,
        intendedNativeCapabilityId: contract.intendedNativeCapabilityId,
        operationClass: contract.operationClass,
        riskLevel: contract.riskLevel,
        domain: contract.domain,
        approvalExpectation: contract.approvalExpectation,
        auditExpectation: contract.auditExpectation,
        observerVisibilityExpectation: contract.observerVisibilityExpectation,
        migrationStatus: contract.migrationStatus,
        deferredExecutionBoundary: contract.deferredExecutionBoundary,
        sourceEvidence: {
          indexMentioned: detectedToolSet.has(contract.sourceToolName),
          expectedSourcePaths: contract.expectedSourcePaths,
          sourceFilesPresent,
          sourceFilesMissing: expectedFiles.filter((file) => !file?.present).map((file) => file.relativePath),
          contentRead: false,
          contentExposed: false,
        },
      };
    });
    const allToolsMentioned = tools.every((tool) => tool.sourceEvidence.indexMentioned);
    const allSourceFilesPresent = [...sourceFiles.values()].every((file) => file.present);
    const missingSourceToolNames = NATIVE_ENGINEERING_TOOL_CONTRACTS
      .map((contract) => contract.sourceToolName)
      .filter((toolName) => !detectedToolSet.has(toolName));

    return {
      ok: Boolean(indexStats?.isFile()) && allToolsMentioned && allSourceFilesPresent,
      registry: NATIVE_ENGINEERING_TOOL_SURFACE_REGISTRY,
      mode: "read-only-tool-contract-mapping",
      generatedAt: new Date().toISOString(),
      identityLevel: "Level 1: stable user-space control plane",
      sourceReference: {
        repository: "https://github.com/EdVulcan/openclaw-enhanced-source",
        commit: "d90b253b0c03191613e45c36b1434078b8788bed",
        branch: "main",
        contentTransferMode: "metadata_mapping_only",
      },
      sourceRegistries: [
        workspaceRegistry.registry,
        "openclaw-enhanced-source-gap-audit-v0",
      ],
      workspace: {
        id: item.id,
        name: item.name,
        path: item.path,
      },
      sourceEvidence: {
        root: sourceRoot,
        indexFile: {
          relativePath: indexRelativePath,
          present: Boolean(indexStats?.isFile()),
          sizeBytes: indexStats?.isFile() ? indexStats.size : null,
          lineCount: countLines(indexText),
          contentRead: Boolean(indexText),
          contentExposed: false,
        },
        detectedSourceToolNames,
        missingSourceToolNames,
        sourceFiles: [...sourceFiles.values()],
      },
      tools,
      summary: {
        totalTools: tools.length,
        coveredTools: tools.filter((tool) => tool.sourceEvidence.indexMentioned).length,
        sourceFilesPresent: [...sourceFiles.values()].filter((file) => file.present).length,
        sourceFilesExpected: sourceFiles.size,
        readOnlyContracts: tools.filter((tool) => tool.operationClass.startsWith("read_only")).length,
        mutationProposalContracts: tools.filter((tool) => tool.operationClass === "mutation_proposal").length,
        planningStateContracts: tools.filter((tool) => tool.operationClass === "planning_state").length,
        verificationContracts: tools.filter((tool) => tool.operationClass === "verification_command_evidence").length,
        lspContracts: tools.filter((tool) => tool.sourceToolName === "cc_lsp").length,
        canReadSourceIndex: Boolean(indexText),
        canReadSourceFileContent: false,
        exposesSourceFileContent: false,
        canImportModule: false,
        canExecuteToolCode: false,
        canRunVerification: false,
        canStartLsp: false,
        canMutate: false,
        createsTask: false,
        createsApproval: false,
        nextRecommendedSlice: "native-governed-read-search-surface",
      },
      governance: {
        mode: "native_governed_engineering_tool_surface_inventory",
        runtimeOwner: "openclaw_on_nixos",
        canReadMetadata: true,
        canReadSourceIndex: Boolean(indexText),
        canReadSourceFileContent: false,
        exposesSourceFileContent: false,
        canImportModule: false,
        canExecuteToolCode: false,
        canRunVerification: false,
        canStartLsp: false,
        canMutate: false,
        createsTask: false,
        createsApproval: false,
        observerVisible: true,
      },
      deferredExecutionBoundaries: [
        "no cc-tools module import",
        "no raw file read surface",
        "no glob or grep execution",
        "no edit, patch, write, or filesystem mutation",
        "no shell or verification command execution",
        "no LSP server startup or process lifecycle",
        "no plan/todo state mutation",
        "no task or approval creation",
      ],
    };
  }

  return {
    buildNativeEngineeringToolSurfaceInventory,
  };
}

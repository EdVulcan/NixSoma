import {
  OPENCLAW_NATIVE_PLUGIN_CONTRACT_VERSION,
  summariseOpenClawNativePluginContract,
  validateOpenClawNativePluginContract,
} from "../../../packages/plugin-runtime/src/plugin-contract.mjs";
import {
  createOpenClawNativePluginRegistry,
  summariseOpenClawNativePluginRegistry,
  validateOpenClawNativePluginRegistry,
} from "../../../packages/plugin-runtime/src/plugin-registry.mjs";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { safeObjectKeys } from "./plugin-review-common.mjs";
import { safeDirectoryEntries, safeStat } from "./plugin-review-workspace-discovery.mjs";

export function createPluginReviewSdkContracts({
  buildOpenClawMigrationPlan,
  readJsonFileIfPresent = () => null,
} = {}) {
const SOURCE_REVIEW_EXTENSION_KINDS = new Map([
  [".ts", "typescript_source"],
  [".tsx", "typescript_source"],
  [".js", "javascript_source"],
  [".mjs", "javascript_source"],
  [".cjs", "javascript_source"],
  [".d.ts", "type_declaration"],
  [".json", "manifest_or_schema"],
  [".md", "documentation"],
]);

function sourceReviewKindForRelativePath(relativePath) {
  if (relativePath.endsWith(".d.ts")) {
    return SOURCE_REVIEW_EXTENSION_KINDS.get(".d.ts");
  }
  return SOURCE_REVIEW_EXTENSION_KINDS.get(path.extname(relativePath)) ?? "other";
}

function collectSourceReviewScopeFiles(rootPath, { maxDepth = 4, maxFiles = 80 } = {}) {
  const files = [];
  const ignoredDirectories = new Set([".git", "node_modules", "dist", "build", ".turbo", ".cache"]);
  const allowedTopLevel = new Set(["src", "types", "test", "tests", "README.md", "package.json"]);

  function visit(currentPath, depth) {
    if (files.length >= maxFiles || depth > maxDepth) {
      return;
    }
    let entries = [];
    try {
      entries = readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (files.length >= maxFiles) {
        return;
      }
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = path.relative(rootPath, absolutePath).replaceAll(path.sep, "/");
      const topLevel = relativePath.split("/")[0];
      if (!allowedTopLevel.has(topLevel)) {
        continue;
      }
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          visit(absolutePath, depth + 1);
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const kind = sourceReviewKindForRelativePath(relativePath);
      if (kind === "other") {
        continue;
      }
      const stats = safeStat(absolutePath);
      files.push({
        relativePath,
        kind,
        extension: relativePath.endsWith(".d.ts") ? ".d.ts" : path.extname(relativePath),
        sizeBytes: stats?.size ?? null,
        contentRead: false,
        recommendedReview: kind === "manifest_or_schema"
          ? "verify metadata shape without exposing script bodies or dependency versions"
          : kind === "documentation"
            ? "review public contract wording only after explicit content approval"
            : "review exported capability surface before native implementation",
      });
    }
  }

  visit(rootPath, 0);
  return files;
}

function buildPluginSdkContractReviewForPlanItem(planItem) {
  const sdkPath = path.join(planItem.workspacePath, "packages", "plugin-sdk");
  const manifest = readJsonFileIfPresent(path.join(sdkPath, "package.json"));
  const topLevelDirectories = safeDirectoryEntries(sdkPath);
  const markers = [
    "package.json",
    "README.md",
    "src",
    "dist",
    "types",
  ].filter((marker) => existsSync(path.join(sdkPath, marker)));
  const scriptNames = safeObjectKeys(manifest?.scripts);
  const exportKeys = typeof manifest?.exports === "string"
    ? ["default"]
    : safeObjectKeys(manifest?.exports);

  return {
    id: `${planItem.workspaceId}:plugin-sdk-contract-review`,
    workspaceId: planItem.workspaceId,
    workspaceName: planItem.workspaceName,
    workspacePath: planItem.workspacePath,
    packagePath: sdkPath,
    sourcePlanItemId: planItem.candidateId,
    capability: planItem.capability,
    targetArea: planItem.targetArea,
    status: "manifest_profiled_not_imported",
    verdict: "review_required_before_import",
    packageManifest: {
      present: Boolean(manifest),
      name: typeof manifest?.name === "string" ? manifest.name : null,
      private: manifest?.private === true,
      hasVersion: typeof manifest?.version === "string",
      hasMain: typeof manifest?.main === "string",
      hasModule: typeof manifest?.module === "string",
      hasTypes: typeof manifest?.types === "string" || typeof manifest?.typings === "string",
      hasExports: manifest?.exports !== undefined,
      exportKeys,
      scriptNames,
      dependencySummary: {
        dependencies: safeObjectKeys(manifest?.dependencies).length,
        devDependencies: safeObjectKeys(manifest?.devDependencies).length,
        peerDependencies: safeObjectKeys(manifest?.peerDependencies).length,
      },
    },
    structure: {
      markers,
      topLevelDirectories,
      hasSourceDirectory: topLevelDirectories.includes("src"),
      hasDistDirectory: topLevelDirectories.includes("dist"),
      hasTypesDirectory: topLevelDirectories.includes("types"),
    },
    contractSurfaces: [
      ...(exportKeys.length > 0 ? ["package_exports"] : []),
      ...(typeof manifest?.types === "string" || typeof manifest?.typings === "string" || topLevelDirectories.includes("types")
        ? ["type_declarations"]
        : []),
      ...(topLevelDirectories.includes("src") ? ["source_contract_candidates"] : []),
      ...(scriptNames.length > 0 ? ["package_scripts_metadata"] : []),
    ],
    recommendedReviews: [
      "confirm stable public capability interfaces before native reimplementation",
      "reject runtime ownership assumptions that make the old source workspace authoritative",
      "define OpenClaw policy wrappers and approval gates before exposing SDK-backed capabilities",
      "write native contract tests before any code absorption",
    ],
    blockers: [
      "source content review not explicitly approved",
      "native capability contract tests not written",
      "policy wrapper design not approved",
    ],
    governance: {
      mode: "plugin_sdk_contract_review_read_only",
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      canMutate: false,
      canExecute: false,
      createsTask: false,
      createsApproval: false,
      migrationStatus: "review_required_before_import",
      runtimeOwner: "openclaw_on_nixos",
    },
  };
}

function buildOpenClawPluginSdkSourceReviewScope({ packagePath = null } = {}) {
  const { review, item } = selectReviewedPluginSdkPackage({ packagePath });
  const files = collectSourceReviewScopeFiles(item.packagePath);
  const byKind = files.reduce((accumulator, file) => {
    accumulator[file.kind] = (accumulator[file.kind] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    ok: true,
    registry: "openclaw-plugin-sdk-source-review-scope-v0",
    mode: "scope-plan-only",
    generatedAt: new Date().toISOString(),
    sourceRegistry: review.registry,
    sourceMode: review.mode,
    workspace: {
      id: item.workspaceId,
      name: item.workspaceName,
      path: item.workspacePath,
    },
    package: {
      path: item.packagePath,
      name: item.packageManifest?.name ?? null,
      surfaces: item.contractSurfaces ?? [],
    },
    files,
    gates: [
      {
        id: "scope_metadata_only",
        label: "Only file metadata is in scope",
        required: true,
        status: "passed",
        evidence: `files=${files.length}`,
      },
      {
        id: "content_read_approval_required",
        label: "Explicit approval is required before reading source contents",
        required: true,
        status: "blocked",
        evidence: "no content-read approval exists in this scope plan",
      },
      {
        id: "native_reimplementation_required",
        label: "Approved concepts must be reimplemented natively in OpenClawOnNixOS",
        required: true,
        status: "blocked",
        evidence: "old OpenClaw remains non-authoritative source material",
      },
    ],
    summary: {
      totalFiles: files.length,
      byKind,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      createsTask: false,
      createsApproval: false,
      requiresApprovalBeforeContentRead: true,
    },
    governance: {
      mode: "plugin_sdk_source_review_scope_plan_only",
      runtimeOwner: "openclaw_on_nixos",
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      canMutate: false,
      canExecute: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      createsTask: false,
      createsApproval: false,
      requiresApprovalBeforeContentRead: true,
    },
  };
}

function analysePluginSdkSourceContentFile(rootPath, file) {
  const absolutePath = path.join(rootPath, file.relativePath);
  const stats = safeStat(absolutePath);
  const maxBytes = 64 * 1024;
  if (!stats || !stats.isFile() || stats.size > maxBytes) {
    return {
      relativePath: file.relativePath,
      kind: file.kind,
      sizeBytes: stats?.size ?? file.sizeBytes ?? null,
      contentRead: false,
      contentExposed: false,
      skipped: true,
      skipReason: stats?.size > maxBytes ? "file_too_large" : "not_readable",
    };
  }

  let text = "";
  try {
    text = readFileSync(absolutePath, "utf8");
  } catch {
    return {
      relativePath: file.relativePath,
      kind: file.kind,
      sizeBytes: stats.size,
      contentRead: false,
      contentExposed: false,
      skipped: true,
      skipReason: "read_failed",
    };
  }

  const lines = text.split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  const exportStatements = text.match(/\bexport\b/g)?.length ?? 0;
  const importStatements = text.match(/\bimport\b/g)?.length ?? 0;
  const interfaceDeclarations = text.match(/\binterface\s+[A-Za-z_$][\w$]*/g)?.length ?? 0;
  const typeDeclarations = text.match(/\btype\s+[A-Za-z_$][\w$]*/g)?.length ?? 0;
  const functionDeclarations = text.match(/\bfunction\s+[A-Za-z_$][\w$]*/g)?.length ?? 0;
  const classDeclarations = text.match(/\bclass\s+[A-Za-z_$][\w$]*/g)?.length ?? 0;
  const constDeclarations = text.match(/\bconst\s+[A-Za-z_$][\w$]*/g)?.length ?? 0;
  const capabilityTerms = [
    "capability",
    "plugin",
    "permission",
    "policy",
    "approval",
    "runtime",
    "manifest",
  ].filter((term) => text.toLowerCase().includes(term));

  return {
    relativePath: file.relativePath,
    kind: file.kind,
    sizeBytes: stats.size,
    contentRead: true,
    contentExposed: false,
    skipped: false,
    lineCount: lines.length,
    nonEmptyLineCount: nonEmptyLines.length,
    signals: {
      exportStatements,
      importStatements,
      interfaceDeclarations,
      typeDeclarations,
      functionDeclarations,
      classDeclarations,
      constDeclarations,
      capabilityTermCount: capabilityTerms.length,
      hasCapabilityVocabulary: capabilityTerms.length > 0,
    },
    recommendedAbsorption: file.kind === "type_declaration" || interfaceDeclarations > 0 || typeDeclarations > 0
      ? "derive_native_contract_shape"
      : exportStatements > 0
        ? "review_exported_surface_for_native_reimplementation"
        : "background_context_only",
  };
}

function buildOpenClawPluginSdkSourceContentReview({ packagePath = null } = {}) {
  const scope = buildOpenClawPluginSdkSourceReviewScope({ packagePath });
  const reviewableFiles = scope.files.filter((file) => [
    "typescript_source",
    "javascript_source",
    "type_declaration",
    "manifest_or_schema",
  ].includes(file.kind));
  const files = reviewableFiles.map((file) => analysePluginSdkSourceContentFile(scope.package.path, file));
  const byKind = files.reduce((accumulator, file) => {
    accumulator[file.kind] = (accumulator[file.kind] ?? 0) + 1;
    return accumulator;
  }, {});
  const totals = files.reduce((accumulator, file) => {
    if (file.contentRead) {
      accumulator.contentRead += 1;
      accumulator.lines += file.lineCount ?? 0;
      accumulator.exports += file.signals?.exportStatements ?? 0;
      accumulator.imports += file.signals?.importStatements ?? 0;
      accumulator.interfaces += file.signals?.interfaceDeclarations ?? 0;
      accumulator.types += file.signals?.typeDeclarations ?? 0;
      accumulator.functions += file.signals?.functionDeclarations ?? 0;
      accumulator.classes += file.signals?.classDeclarations ?? 0;
      accumulator.consts += file.signals?.constDeclarations ?? 0;
    } else {
      accumulator.skipped += 1;
    }
    return accumulator;
  }, {
    contentRead: 0,
    skipped: 0,
    lines: 0,
    exports: 0,
    imports: 0,
    interfaces: 0,
    types: 0,
    functions: 0,
    classes: 0,
    consts: 0,
  });

  return {
    ok: true,
    registry: "openclaw-plugin-sdk-source-content-review-v0",
    mode: "content-review-derived-signals",
    generatedAt: new Date().toISOString(),
    sourceRegistry: scope.registry,
    sourceMode: scope.mode,
    workspace: scope.workspace,
    package: scope.package,
    files,
    findings: [
      {
        id: "source_content_read_started",
        status: "passed",
        summary: "Scoped plugin SDK files were read for derived interface and export signals.",
      },
      {
        id: "raw_content_not_exposed",
        status: "passed",
        summary: "API output contains derived counts only; raw source, README text, script bodies, and dependency versions remain hidden.",
      },
      {
        id: "native_reimplementation_required",
        status: "pending",
        summary: "Reviewed concepts must be mapped into OpenClawOnNixOS-native contracts before implementation.",
      },
    ],
    summary: {
      totalFiles: files.length,
      contentRead: totals.contentRead,
      skipped: totals.skipped,
      byKind,
      lineCount: totals.lines,
      exportStatements: totals.exports,
      importStatements: totals.imports,
      interfaceDeclarations: totals.interfaces,
      typeDeclarations: totals.types,
      functionDeclarations: totals.functions,
      classDeclarations: totals.classes,
      constDeclarations: totals.consts,
      canReadSourceFileContent: true,
      exposesSourceFileContent: false,
      exposesReadmeContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      nextAllowedWork: [
        "map derived source signals into native contract deltas",
        "write native OpenClawOnNixOS tests before implementation",
        "reimplement approved concepts natively instead of importing old modules",
      ],
    },
    governance: {
      mode: "plugin_sdk_source_content_review_derived_signals",
      runtimeOwner: "openclaw_on_nixos",
      canReadSourceFileContent: true,
      exposesSourceFileContent: false,
      exposesReadmeContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      canMutate: false,
      canExecute: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      createsTask: false,
      createsApproval: false,
      absorptionMode: "native_reimplementation_required",
    },
  };
}

function collectPluginSdkModuleSourceSignals(workspacePath, { maxFiles = 120, maxDepth = 2 } = {}) {
  const sourceRoot = path.join(workspacePath, "src", "plugin-sdk");
  const rootStats = safeStat(sourceRoot);
  if (!rootStats?.isDirectory()) {
    return {
      root: sourceRoot,
      present: false,
      files: [],
      summary: {
        totalFiles: 0,
        contentRead: 0,
        skipped: 0,
        lineCount: 0,
        exportStatements: 0,
        importStatements: 0,
        interfaceDeclarations: 0,
        typeDeclarations: 0,
        functionDeclarations: 0,
        classDeclarations: 0,
        constDeclarations: 0,
        capabilityVocabularyFiles: 0,
      },
    };
  }

  const files = [];
  function visit(currentPath, depth) {
    if (files.length >= maxFiles || depth > maxDepth) {
      return;
    }
    let entries = [];
    try {
      entries = readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (files.length >= maxFiles) {
        return;
      }
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", "dist", "build", ".git", ".cache"].includes(entry.name)) {
          visit(absolutePath, depth + 1);
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const relativePath = path.relative(sourceRoot, absolutePath).replaceAll(path.sep, "/");
      const kind = sourceReviewKindForRelativePath(relativePath);
      if (!["typescript_source", "javascript_source", "type_declaration", "manifest_or_schema"].includes(kind)) {
        continue;
      }
      files.push(analysePluginSdkSourceContentFile(sourceRoot, {
        relativePath,
        kind,
      }));
    }
  }

  visit(sourceRoot, 0);
  const totals = files.reduce((accumulator, file) => {
    if (file.contentRead) {
      accumulator.contentRead += 1;
      accumulator.lineCount += file.lineCount ?? 0;
      accumulator.exportStatements += file.signals?.exportStatements ?? 0;
      accumulator.importStatements += file.signals?.importStatements ?? 0;
      accumulator.interfaceDeclarations += file.signals?.interfaceDeclarations ?? 0;
      accumulator.typeDeclarations += file.signals?.typeDeclarations ?? 0;
      accumulator.functionDeclarations += file.signals?.functionDeclarations ?? 0;
      accumulator.classDeclarations += file.signals?.classDeclarations ?? 0;
      accumulator.constDeclarations += file.signals?.constDeclarations ?? 0;
      accumulator.capabilityVocabularyFiles += file.signals?.hasCapabilityVocabulary ? 1 : 0;
    } else {
      accumulator.skipped += 1;
    }
    return accumulator;
  }, {
    contentRead: 0,
    skipped: 0,
    lineCount: 0,
    exportStatements: 0,
    importStatements: 0,
    interfaceDeclarations: 0,
    typeDeclarations: 0,
    functionDeclarations: 0,
    classDeclarations: 0,
    constDeclarations: 0,
    capabilityVocabularyFiles: 0,
  });

  return {
    root: sourceRoot,
    present: true,
    files: files.map((file) => ({
      relativePath: file.relativePath,
      kind: file.kind,
      sizeBytes: file.sizeBytes,
      contentRead: file.contentRead,
      contentExposed: false,
      skipped: file.skipped,
      skipReason: file.skipReason,
      lineCount: file.lineCount,
      nonEmptyLineCount: file.nonEmptyLineCount,
      signals: file.signals,
      recommendedAbsorption: file.recommendedAbsorption,
    })),
    summary: {
      totalFiles: files.length,
      ...totals,
    },
  };
}

function buildOpenClawPluginSdkNativeContractTests({ packagePath = null } = {}) {
  const contentReview = buildOpenClawPluginSdkSourceContentReview({ packagePath });
  const moduleSource = collectPluginSdkModuleSourceSignals(contentReview.workspace.path);
  const nativeContractResponse = buildOpenClawNativePluginContractRegistry();
  const contract = nativeContractResponse.contract ?? {};
  const capabilities = Array.isArray(contract.capabilities) ? contract.capabilities : [];
  const manifestProfileCapability = capabilities.find((capability) => capability.id === "sense.plugin.manifest_profile") ?? null;
  const invokeCapability = capabilities.find((capability) => capability.id === "act.plugin.capability.invoke") ?? null;
  const combinedSignals = {
    packageFilesRead: contentReview.summary.contentRead,
    moduleFilesRead: moduleSource.summary.contentRead,
    exportStatements: contentReview.summary.exportStatements + moduleSource.summary.exportStatements,
    importStatements: contentReview.summary.importStatements + moduleSource.summary.importStatements,
    interfaceDeclarations: contentReview.summary.interfaceDeclarations + moduleSource.summary.interfaceDeclarations,
    typeDeclarations: contentReview.summary.typeDeclarations + moduleSource.summary.typeDeclarations,
    functionDeclarations: contentReview.summary.functionDeclarations + moduleSource.summary.functionDeclarations,
    classDeclarations: contentReview.summary.classDeclarations + moduleSource.summary.classDeclarations,
    constDeclarations: contentReview.summary.constDeclarations + moduleSource.summary.constDeclarations,
    capabilityVocabularyFiles: moduleSource.summary.capabilityVocabularyFiles,
  };
  const hasCapabilityFieldCoverage = capabilities.every((capability) => (
    typeof capability.id === "string" && capability.id.length > 0
    && typeof capability.kind === "string" && capability.kind.length > 0
    && Array.isArray(capability.domains) && capability.domains.length > 0
    && typeof capability.risk === "string" && capability.risk.length > 0
    && capability.runtimeOwner === "openclaw_on_nixos"
    && capability.permissions && typeof capability.permissions === "object"
    && capability.approval && typeof capability.approval.required === "boolean"
    && capability.audit?.required === true
  ));

  const tests = [
    {
      id: "derived_source_signals_present",
      status: combinedSignals.exportStatements > 0 && combinedSignals.packageFilesRead > 0 ? "passed" : "failed",
      evidence: `packageFilesRead=${combinedSignals.packageFilesRead}; exports=${combinedSignals.exportStatements}`,
      required: true,
    },
    {
      id: "enhanced_source_module_profiled",
      status: moduleSource.present && combinedSignals.moduleFilesRead > 0 ? "passed" : "failed",
      evidence: `root=${moduleSource.root}; moduleFilesRead=${combinedSignals.moduleFilesRead}`,
      required: true,
    },
    {
      id: "native_contract_validates",
      status: nativeContractResponse.validation?.ok === true ? "passed" : "failed",
      evidence: `issues=${nativeContractResponse.validation?.issues?.length ?? 0}`,
      required: true,
    },
    {
      id: "runtime_owner_locked",
      status: contract.governance?.runtimeOwner === "openclaw_on_nixos"
        && contract.governance?.externalRuntimeDependencyAllowed === false
        ? "passed"
        : "failed",
      evidence: `runtimeOwner=${contract.governance?.runtimeOwner ?? "unknown"}; externalRuntimeDependencyAllowed=${Boolean(contract.governance?.externalRuntimeDependencyAllowed)}`,
      required: true,
    },
    {
      id: "plugin_identity_mapped",
      status: contract.plugin?.id === "openclaw.native.plugin-sdk"
        && typeof contract.plugin?.summary === "string"
        && contract.plugin.summary.length > 0
        ? "passed"
        : "failed",
      evidence: `pluginId=${contract.plugin?.id ?? "missing"}`,
      required: true,
    },
    {
      id: "manifest_profile_capability_mapped",
      status: manifestProfileCapability?.kind === "sense"
        && manifestProfileCapability?.risk === "low"
        && manifestProfileCapability?.permissions?.filesystemRead === true
        && manifestProfileCapability?.approval?.required === false
        ? "passed"
        : "failed",
      evidence: manifestProfileCapability ? `capability=${manifestProfileCapability.id}` : "missing sense.plugin.manifest_profile",
      required: true,
    },
    {
      id: "governed_invoke_capability_mapped",
      status: invokeCapability?.kind === "act"
        && invokeCapability?.risk === "high"
        && invokeCapability?.domains?.includes("cross_boundary")
        && invokeCapability?.approval?.required === true
        && invokeCapability?.audit?.required === true
        ? "passed"
        : "failed",
      evidence: invokeCapability ? `capability=${invokeCapability.id}` : "missing act.plugin.capability.invoke",
      required: true,
    },
    {
      id: "capability_policy_fields_mapped",
      status: capabilities.length > 0 && hasCapabilityFieldCoverage ? "passed" : "failed",
      evidence: `capabilities=${capabilities.length}`,
      required: true,
    },
    {
      id: "source_content_not_imported",
      status: contract.governance?.sourceContentImported === false
        && contentReview.governance.canImportModule === false
        && contentReview.governance.canExecutePluginCode === false
        ? "passed"
        : "failed",
      evidence: `sourceContentImported=${Boolean(contract.governance?.sourceContentImported)}; canImportModule=${Boolean(contentReview.governance.canImportModule)}`,
      required: true,
    },
  ];
  const requiredTests = tests.filter((test) => test.required);
  const passedRequired = requiredTests.filter((test) => test.status === "passed").length;
  const failedRequired = requiredTests.length - passedRequired;

  return {
    ok: failedRequired === 0,
    registry: "openclaw-plugin-sdk-native-contract-tests-v0",
    mode: "native-contract-tests",
    generatedAt: new Date().toISOString(),
    sourceRegistries: [
      contentReview.registry,
      nativeContractResponse.registry,
    ],
    workspace: contentReview.workspace,
    package: contentReview.package,
    enhancedSource: {
      root: moduleSource.root,
      present: moduleSource.present,
      files: moduleSource.files.slice(0, 24),
      summary: moduleSource.summary,
    },
    derivedSignals: combinedSignals,
    contract: {
      plugin: contract.plugin,
      governance: contract.governance,
      capabilities: capabilities.map((capability) => ({
        id: capability.id,
        kind: capability.kind,
        domains: capability.domains,
        risk: capability.risk,
        runtimeOwner: capability.runtimeOwner,
        permissions: capability.permissions,
        approval: capability.approval,
        audit: capability.audit,
      })),
    },
    mappings: [
      {
        sourceSignal: "plugin-sdk manifest and exported surface",
        nativeContractFields: ["plugin.id", "plugin.name", "capabilities[].id", "capabilities[].kind"],
        status: tests.find((test) => test.id === "plugin_identity_mapped")?.status ?? "failed",
      },
      {
        sourceSignal: "manifest/runtime metadata vocabulary",
        nativeContractFields: ["sense.plugin.manifest_profile", "permissions.filesystemRead", "approval.required=false"],
        status: tests.find((test) => test.id === "manifest_profile_capability_mapped")?.status ?? "failed",
      },
      {
        sourceSignal: "policy/approval/capability vocabulary",
        nativeContractFields: ["risk", "domains", "approval", "audit", "runtimeOwner"],
        status: tests.find((test) => test.id === "capability_policy_fields_mapped")?.status ?? "failed",
      },
      {
        sourceSignal: "execution-capable plugin capability shape",
        nativeContractFields: ["act.plugin.capability.invoke", "approval.required=true", "audit.required=true"],
        status: tests.find((test) => test.id === "governed_invoke_capability_mapped")?.status ?? "failed",
      },
    ],
    tests,
    summary: {
      totalTests: tests.length,
      requiredTests: requiredTests.length,
      passedRequired,
      failedRequired,
      nativeContractReadyForImplementation: failedRequired === 0,
      sourcePackageFilesRead: combinedSignals.packageFilesRead,
      enhancedSourceFilesRead: combinedSignals.moduleFilesRead,
      exportStatements: combinedSignals.exportStatements,
      interfaceDeclarations: combinedSignals.interfaceDeclarations,
      typeDeclarations: combinedSignals.typeDeclarations,
      functionDeclarations: combinedSignals.functionDeclarations,
      capabilityVocabularyFiles: combinedSignals.capabilityVocabularyFiles,
      nativeCapabilities: capabilities.length,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      createsTask: false,
      createsApproval: false,
      nextAllowedWork: [
        "implement native SDK contract deltas that fail these tests",
        "select the first real read-only OpenClaw capability absorption slice",
        "keep old OpenClaw modules non-importable until native adapters exist",
      ],
    },
    governance: {
      mode: "plugin_sdk_native_contract_tests",
      runtimeOwner: "openclaw_on_nixos",
      canReadSourceFileContent: true,
      exposesSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      absorptionMode: "test_native_contract_mapping_before_implementation",
    },
  };
}

function buildOpenClawNativePluginSdkContractImplementation({ packagePath = null } = {}) {
  const testReport = buildOpenClawPluginSdkNativeContractTests({ packagePath });
  const nativeRegistry = buildOpenClawNativePluginRegistryResponse();
  const pluginItem = nativeRegistry.items.find((item) => item.id === "openclaw.native.plugin-sdk") ?? null;
  const contract = pluginItem?.contract ?? null;
  const capabilities = Array.isArray(contract?.capabilities) ? contract.capabilities : [];
  const requiredSlotIds = [
    "sense.plugin.manifest_profile",
    "sense.openclaw.tool_catalog",
    "sense.openclaw.workspace_semantic_index",
    "sense.openclaw.workspace_symbol_lookup",
    "act.openclaw.workspace_text_write",
    "act.openclaw.workspace_patch_apply",
    "sense.openclaw.prompt_pack",
    "sense.openclaw.plugin_manifest_map",
    "plan.openclaw.plugin_capability",
    "act.plugin.capability.invoke",
  ];
  const implementationSlots = requiredSlotIds.map((capabilityId) => {
    const capability = capabilities.find((entry) => entry.id === capabilityId) ?? null;
    return {
      id: capabilityId,
      status: capability ? "implemented" : "missing",
      kind: capability?.kind ?? null,
      risk: capability?.risk ?? null,
      domains: capability?.domains ?? [],
      approvalRequired: capability?.approval?.required ?? null,
      auditLedger: capability?.audit?.ledger ?? null,
      runtimeOwner: capability?.runtimeOwner ?? null,
      adapterState: capabilityId.startsWith("sense.")
        ? "read_only_native_adapter_pending"
        : "approval_gated_runtime_adapter_pending",
    };
  });
  const missingSlots = implementationSlots.filter((slot) => slot.status !== "implemented");
  const readOnlySlots = implementationSlots.filter((slot) => slot.id.startsWith("sense."));
  const executableSlots = implementationSlots.filter((slot) => slot.id.startsWith("act."));

  return {
    ok: nativeRegistry.validation.ok === true && missingSlots.length === 0 && testReport.ok === true,
    registry: "openclaw-native-plugin-sdk-contract-implementation-v0",
    mode: "native-sdk-contract-implementation",
    generatedAt: new Date().toISOString(),
    sourceRegistries: [
      testReport.registry,
      nativeRegistry.registry,
      contract?.contractVersion ?? "openclaw-native-plugin-contract-v0",
    ],
    runtimeOwner: "openclaw_on_nixos",
    plugin: contract?.plugin ?? null,
    implementationSlots,
    contract,
    validation: nativeRegistry.validation,
    summary: {
      totalSlots: implementationSlots.length,
      implementedSlots: implementationSlots.length - missingSlots.length,
      missingSlots: missingSlots.length,
      readOnlySlots: readOnlySlots.length,
      executableSlots: executableSlots.length,
      nativeCapabilities: capabilities.length,
      nativeContractTestsPassed: testReport.ok === true,
      validationOk: nativeRegistry.validation.ok === true,
      readyForFirstReadOnlyAbsorption: missingSlots.length === 0 && testReport.ok === true,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      createsTask: false,
      createsApproval: false,
      nextAllowedWork: [
        "implement sense.openclaw.tool_catalog as the first real read-only absorption slice",
        "keep prompt pack and plugin manifest map read-only until their adapters are implemented",
        "defer act.plugin.capability.invoke until approval-gated runtime adapter exists",
      ],
    },
    governance: {
      mode: "native_plugin_sdk_contract_implementation",
      runtimeOwner: "openclaw_on_nixos",
      externalRuntimeDependencyAllowed: false,
      sourceContentImported: false,
      canReadSourceFileContent: true,
      exposesSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
    },
  };
}

function buildOpenClawPluginSdkContractReview() {
  const plan = buildOpenClawMigrationPlan();
  const items = plan.items
    .filter((item) => item.capability === "plugin_sdk")
    .map((item) => buildPluginSdkContractReviewForPlanItem(item));

  return {
    registry: "openclaw-plugin-sdk-contract-review-v0",
    mode: "read-only",
    generatedAt: plan.generatedAt,
    sourceRegistry: plan.registry,
    sourceMode: plan.mode,
    roots: plan.roots,
    count: items.length,
    items,
    summary: {
      total: items.length,
      withManifest: items.filter((item) => item.packageManifest.present).length,
      withTypes: items.filter((item) => item.packageManifest.hasTypes || item.structure.hasTypesDirectory).length,
      withExports: items.filter((item) => item.packageManifest.hasExports).length,
      byVerdict: items.reduce((accumulator, item) => {
        accumulator[item.verdict] = (accumulator[item.verdict] ?? 0) + 1;
        return accumulator;
      }, {}),
      byStatus: items.reduce((accumulator, item) => {
        accumulator[item.status] = (accumulator[item.status] ?? 0) + 1;
        return accumulator;
      }, {}),
      governance: {
        mode: "plugin_sdk_contract_review_read_only",
        canReadManifestMetadata: true,
        canReadSourceFileContent: false,
        canMutate: false,
        canExecute: false,
        createsTask: false,
        createsApproval: false,
        migrationStatus: "review_required_before_import",
      },
    },
  };
}

function buildOpenClawNativePluginContractRegistry() {
  const registry = createOpenClawNativePluginRegistry();
  const contract = registry.items[0]?.contract ?? null;
  const validation = validateOpenClawNativePluginContract(contract);
  const summary = summariseOpenClawNativePluginContract(contract);

  return {
    registry: OPENCLAW_NATIVE_PLUGIN_CONTRACT_VERSION,
    mode: "contract-only",
    generatedAt: registry.generatedAt,
    sourceRegistry: registry.registry,
    sourceMode: registry.mode,
    registryItemId: registry.items[0]?.id ?? null,
    contract,
    validation,
    summary: {
      ...summary,
      validationOk: validation.ok,
      issueCount: validation.issues.length,
      governance: {
        runtimeOwner: contract.governance.runtimeOwner,
        origin: contract.governance.origin,
        externalRuntimeDependencyAllowed: contract.governance.externalRuntimeDependencyAllowed,
        sourceContentImported: contract.governance.sourceContentImported,
        canCreateTasks: contract.governance.canCreateTasks,
        canCreateApprovals: contract.governance.canCreateApprovals,
        canExecuteDuringRegistration: contract.governance.canExecuteDuringRegistration,
        requiresHumanReviewBeforeActivation: contract.governance.requiresHumanReviewBeforeActivation,
      },
      guardrails: [
        "OpenClawOnNixOS remains runtime owner",
        "external runtime dependency is rejected",
        "registration cannot execute plugin code",
        "high-risk or mutating capabilities require approval",
        "native capabilities require audit ledgers",
      ],
    },
  };
}

function buildOpenClawNativePluginRegistryResponse() {
  const registry = createOpenClawNativePluginRegistry();
  const validation = validateOpenClawNativePluginRegistry(registry);
  const summary = summariseOpenClawNativePluginRegistry(registry);

  return {
    ok: true,
    ...registry,
    validation,
    summary: {
      ...summary,
      guardrails: [
        "registry is native to OpenClawOnNixOS",
        "activation requires a manual adapter implementation",
        "registration cannot execute plugin code",
        "external runtime ownership remains forbidden",
        "source content review is limited to derived signals; old modules remain non-importable",
      ],
    },
  };
}

function selectReviewedPluginSdkPackage({ packagePath = null } = {}) {
  const review = buildOpenClawPluginSdkContractReview();
  const reviewedPackages = review.items
    .filter((item) => item.capability === "plugin_sdk" && item.governance?.runtimeOwner === "openclaw_on_nixos")
    .filter((item) => item.governance?.canReadSourceFileContent === false && item.governance?.canExecute === false);

  if (reviewedPackages.length === 0) {
    throw new Error("No reviewed OpenClaw plugin SDK package is available for native adapter profiling.");
  }

  if (typeof packagePath === "string" && packagePath.trim()) {
    const requested = path.resolve(packagePath);
    const match = reviewedPackages.find((item) => path.resolve(item.packagePath) === requested);
    if (!match) {
      throw new Error("Requested packagePath is not an OpenClaw plugin SDK path approved by the contract review.");
    }
    return { review, item: match };
  }

  return { review, item: reviewedPackages[0] };
}

  return {
    buildOpenClawPluginSdkSourceReviewScope,
    buildOpenClawPluginSdkSourceContentReview,
    buildOpenClawPluginSdkNativeContractTests,
    buildOpenClawNativePluginSdkContractImplementation,
    buildOpenClawPluginSdkContractReview,
    buildOpenClawNativePluginContractRegistry,
    buildOpenClawNativePluginRegistryResponse,
    selectReviewedPluginSdkPackage,
  };
}

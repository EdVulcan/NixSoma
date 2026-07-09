import { createOpenClawNativePluginRegistry } from "../../../packages/plugin-runtime/src/plugin-registry.mjs";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildPromptWorkStandardsAssessment } from "./plugin-review-prompt-work-standards.mjs";

export function createPluginReviewWorkspaceIntelligence({
  buildOpenClawNativePluginSdkContractImplementation,
  buildWorkspaceRegistry,
  safeStat,
} = {}) {
  const TOOL_CATALOG_IGNORED_DIRECTORIES = new Set([".git", "node_modules", "dist", "build", ".turbo", ".cache"]);
  const TOOL_CATALOG_SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
  const TOOL_CATALOG_DOC_EXTENSIONS = new Set([".md", ".mdx"]);
  const TOOL_CATALOG_TEST_MARKERS = [
    ".test.",
    ".spec.",
    ".schema.",
    ".helpers.",
    ".support.",
    ".runtime.",
    ".model-config.",
  ];

  function normaliseToolCatalogName(fileName) {
    return path.basename(fileName, path.extname(fileName))
      .replace(/\.(test|spec|schema|helpers|support|runtime|model-config)$/u, "")
      .replace(/-tool$/u, "")
      .replace(/-commands$/u, "")
      .replace(/-helpers$/u, "")
      .replace(/-shared$/u, "")
      .replace(/-actions$/u, "")
      .replace(/-background$/u, "")
      .replace(/-generate$/u, "-generation")
      .replace(/-native-providers$/u, "")
      .replace(/-providers$/u, "")
      .replace(/-config$/u, "");
  }

  function classifyToolCatalogEntry(relativePath) {
    const lower = relativePath.toLowerCase();
    if (/(image|music|video|tts|pdf|canvas|media)/u.test(lower)) {
      return "media_generation";
    }
    if (/(web|browser|search|fetch|gateway|brave|duckduckgo|exa|firecrawl|tavily|perplexity|searxng|grok|gemini|kimi|ollama)/u.test(lower)) {
      return "web_and_gateway";
    }
    if (/(session|agent|subagent|message|chat|history)/u.test(lower)) {
      return "session_and_agents";
    }
    if (/(cron|schedule|loop|trajectory)/u.test(lower)) {
      return "automation";
    }
    if (/(exec|patch|diff|skill|slash|code|node)/u.test(lower)) {
      return "workspace_engineering";
    }
    return "general_tooling";
  }

  function collectToolCatalogFiles(rootPath, {
    kind,
    maxDepth = 2,
    maxFiles = 160,
    allowedExtensions = TOOL_CATALOG_SOURCE_EXTENSIONS,
  } = {}) {
    const rootStats = safeStat(rootPath);
    if (!rootStats?.isDirectory()) {
      return {
        root: rootPath,
        present: false,
        files: [],
        summary: {
          totalFiles: 0,
          byCategory: {},
          implementationFiles: 0,
          testFiles: 0,
          documentedFiles: 0,
          totalSizeBytes: 0,
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
          if (!TOOL_CATALOG_IGNORED_DIRECTORIES.has(entry.name)) {
            visit(absolutePath, depth + 1);
          }
          continue;
        }
        if (!entry.isFile()) {
          continue;
        }
        const extension = path.extname(entry.name);
        if (!allowedExtensions.has(extension)) {
          continue;
        }
        const relativePath = path.relative(rootPath, absolutePath).replaceAll(path.sep, "/");
        const stats = safeStat(absolutePath);
        const lowerName = entry.name.toLowerCase();
        const isTest = TOOL_CATALOG_TEST_MARKERS.some((marker) => lowerName.includes(marker));
        const isDocumentation = TOOL_CATALOG_DOC_EXTENSIONS.has(extension);
        const isToolImplementation = !isDocumentation
          && !isTest
          && (
            lowerName.endsWith("-tool.ts")
            || lowerName.endsWith("-tool.tsx")
            || lowerName === "web-fetch.ts"
            || lowerName === "web-search.ts"
            || lowerName === "gateway.ts"
            || lowerName.includes("-tool.")
          );
        files.push({
          relativePath,
          fileName: entry.name,
          extension,
          kind,
          category: classifyToolCatalogEntry(relativePath),
          sizeBytes: stats?.size ?? null,
          baseName: normaliseToolCatalogName(entry.name),
          isToolImplementation,
          isTest,
          isDocumentation,
          contentRead: false,
          contentExposed: false,
        });
      }
    }

    visit(rootPath, 0);
    const summary = files.reduce((accumulator, file) => {
      accumulator.totalFiles += 1;
      accumulator.totalSizeBytes += file.sizeBytes ?? 0;
      accumulator.byCategory[file.category] = (accumulator.byCategory[file.category] ?? 0) + 1;
      if (file.isToolImplementation) {
        accumulator.implementationFiles += 1;
      }
      if (file.isTest) {
        accumulator.testFiles += 1;
      }
      if (file.isDocumentation) {
        accumulator.documentedFiles += 1;
      }
      return accumulator;
    }, {
      totalFiles: 0,
      byCategory: {},
      implementationFiles: 0,
      testFiles: 0,
      documentedFiles: 0,
      totalSizeBytes: 0,
    });

    return {
      root: rootPath,
      present: true,
      files,
      summary,
    };
  }

  function selectOpenClawToolCatalogWorkspace({ workspacePath = null } = {}) {
    const requestedPath = typeof workspacePath === "string" && workspacePath.trim()
      ? path.resolve(workspacePath)
      : null;
    const registry = buildWorkspaceRegistry();
    const candidates = registry.items.filter((item) => item.exists && item.readable && item.openclawProfile);
    const item = requestedPath
      ? candidates.find((candidate) => path.resolve(candidate.path) === requestedPath)
      : candidates[0] ?? null;

    if (!item) {
      throw new Error(requestedPath
        ? `OpenClaw workspace is not registered or readable: ${requestedPath}`
        : "No readable OpenClaw workspace is registered.");
    }

    return { registry, item };
  }

  function buildOpenClawToolCatalog({ workspacePath = null } = {}) {
    const { registry, item } = selectOpenClawToolCatalogWorkspace({ workspacePath });
    const implementation = buildOpenClawNativePluginSdkContractImplementation({
      packagePath: path.join(item.path, "packages", "plugin-sdk"),
    });
    const capability = implementation.contract?.capabilities?.find((entry) => entry.id === "sense.openclaw.tool_catalog") ?? null;
    const toolsRoot = path.join(item.path, "src", "agents", "tools");
    const docsRoot = path.join(item.path, "docs", "tools");
    const sdkRoot = path.join(item.path, "src", "plugin-sdk");
    const toolFiles = collectToolCatalogFiles(toolsRoot, {
      kind: "agent_tool_source",
      allowedExtensions: TOOL_CATALOG_SOURCE_EXTENSIONS,
    });
    const docFiles = collectToolCatalogFiles(docsRoot, {
      kind: "tool_documentation",
      maxDepth: 1,
      allowedExtensions: TOOL_CATALOG_DOC_EXTENSIONS,
    });
    const sdkVocabulary = collectToolCatalogFiles(sdkRoot, {
      kind: "plugin_sdk_vocabulary",
      maxDepth: 2,
      maxFiles: 40,
      allowedExtensions: TOOL_CATALOG_SOURCE_EXTENSIONS,
    });
    const implementationFiles = toolFiles.files.filter((file) => file.isToolImplementation);
    const docBaseNames = new Set(docFiles.files.map((file) => file.baseName));
    const documentedImplementations = implementationFiles.filter((file) => docBaseNames.has(file.baseName));
    const docOnly = docFiles.files.filter((file) => !new Set(implementationFiles.map((entry) => entry.baseName)).has(file.baseName));
    const byCategory = [...toolFiles.files, ...docFiles.files].reduce((accumulator, file) => {
      accumulator[file.category] = (accumulator[file.category] ?? 0) + 1;
      return accumulator;
    }, {});
    const categorySummaries = Object.entries(byCategory)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([category, count]) => ({
        category,
        count,
        implementationFiles: implementationFiles.filter((file) => file.category === category).length,
        documentationFiles: docFiles.files.filter((file) => file.category === category).length,
        recommendedNativeSlot: "sense.openclaw.tool_catalog",
      }));

    return {
      ok: toolFiles.present && implementation.summary.readyForFirstReadOnlyAbsorption === true && Boolean(capability),
      registry: "openclaw-tool-catalog-v0",
      mode: "read-only-native-absorption",
      generatedAt: new Date().toISOString(),
      sourceRegistries: [
        implementation.registry,
        registry.registry,
      ],
      capability: {
        id: capability?.id ?? "sense.openclaw.tool_catalog",
        kind: capability?.kind ?? "sense",
        risk: capability?.risk ?? "low",
        approvalRequired: capability?.approval?.required ?? false,
        runtimeOwner: capability?.runtimeOwner ?? "openclaw_on_nixos",
      },
      workspace: {
        id: item.id,
        name: item.name,
        path: item.path,
      },
      roots: {
        tools: toolsRoot,
        docs: docsRoot,
        pluginSdkVocabulary: sdkRoot,
      },
      catalog: {
        tools: implementationFiles.map((file) => ({
          relativePath: file.relativePath,
          fileName: file.fileName,
          category: file.category,
          sizeBytes: file.sizeBytes,
          documented: docBaseNames.has(file.baseName),
          nativeSlot: "sense.openclaw.tool_catalog",
          recommendedAbsorption: "metadata_catalog_now_native_adapter_later",
          contentRead: false,
        })),
        documentation: docFiles.files.map((file) => ({
          relativePath: file.relativePath,
          fileName: file.fileName,
          category: file.category,
          sizeBytes: file.sizeBytes,
          matchesToolImplementation: implementationFiles.some((entry) => entry.baseName === file.baseName),
          contentRead: false,
        })),
        categories: categorySummaries,
        nativeSlotMapping: [
          {
            capabilityId: "sense.openclaw.tool_catalog",
            sourceRoots: ["src/agents/tools", "docs/tools"],
            status: implementationFiles.length > 0 ? "absorbed_as_metadata_catalog" : "blocked_no_tool_files",
            runtimeOwner: "openclaw_on_nixos",
            canExecuteSourceTool: false,
          },
        ],
      },
      summary: {
        sourceToolFiles: toolFiles.summary.totalFiles,
        toolImplementationFiles: implementationFiles.length,
        toolTestFiles: toolFiles.summary.testFiles,
        toolDocumentationFiles: docFiles.summary.totalFiles,
        documentedImplementations: documentedImplementations.length,
        documentationOnlyFiles: docOnly.length,
        pluginSdkVocabularyFiles: sdkVocabulary.summary.totalFiles,
        categoryCount: categorySummaries.length,
        byCategory,
        canReadSourceFileContent: false,
        exposesSourceFileContent: false,
        exposesDocumentationContent: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canExecuteToolCode: false,
        canActivateRuntime: false,
        canMutate: false,
        createsTask: false,
        createsApproval: false,
        nextAllowedWork: [
          "use this catalog to select the first native read-only tool adapter",
          "absorb prompt pack metadata as the next read-only catalog only if it directly supports tool execution policy",
          "keep executable tools behind native policy and approval adapters",
        ],
      },
      governance: {
        mode: "openclaw_tool_catalog_read_only_absorption",
        runtimeOwner: "openclaw_on_nixos",
        sourceRuntimeOwner: "external_openclaw_source_workspace",
        canReadMetadata: true,
        canReadSourceFileContent: false,
        exposesSourceFileContent: false,
        exposesDocumentationContent: false,
        canMutate: false,
        canExecute: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canExecuteToolCode: false,
        canActivateRuntime: false,
        createsTask: false,
        createsApproval: false,
        absorptionMode: "native_metadata_catalog_only",
      },
    };
  }


  function normalisePositiveLimit(value, fallback = 20, max = 80) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
  }

  function buildNativeOpenClawToolCatalogProfile({
    workspacePath = null,
    category = null,
    query = null,
    limit = 20,
  } = {}) {
    const catalog = buildOpenClawToolCatalog({ workspacePath });
    const safeLimit = normalisePositiveLimit(limit, 20, 80);
    const safeCategory = typeof category === "string" && category.trim() ? category.trim() : null;
    const safeQuery = typeof query === "string" && query.trim() ? query.trim().toLowerCase() : null;
    const tools = Array.isArray(catalog.catalog?.tools) ? catalog.catalog.tools : [];
    const documentation = Array.isArray(catalog.catalog?.documentation) ? catalog.catalog.documentation : [];
    const categories = Array.isArray(catalog.catalog?.categories) ? catalog.catalog.categories : [];
    const filteredTools = tools
      .filter((tool) => !safeCategory || tool.category === safeCategory)
      .filter((tool) => {
        if (!safeQuery) {
          return true;
        }
        return [
          tool.relativePath,
          tool.fileName,
          tool.category,
          tool.nativeSlot,
        ].some((value) => String(value ?? "").toLowerCase().includes(safeQuery));
      })
      .slice(0, safeLimit);
    const matchedDocNames = new Set(filteredTools.map((tool) => path.basename(tool.fileName, path.extname(tool.fileName))));
    const relatedDocumentation = documentation
      .filter((doc) => !safeCategory || doc.category === safeCategory)
      .filter((doc) => matchedDocNames.size === 0 || [...matchedDocNames].some((name) => doc.fileName.includes(name) || doc.relativePath.includes(name)))
      .slice(0, safeLimit);

    return {
      ok: catalog.ok === true,
      registry: "openclaw-native-plugin-adapter-v0",
      mode: "tool-catalog-profile-only",
      generatedAt: new Date().toISOString(),
      sourceRegistry: catalog.registry,
      sourceMode: catalog.mode,
      adapterStatus: "native_shell_active_tool_catalog_only",
      capability: catalog.capability,
      workspace: catalog.workspace,
      filter: {
        category: safeCategory,
        query: safeQuery,
        limit: safeLimit,
      },
      tools: filteredTools.map((tool) => ({
        relativePath: tool.relativePath,
        fileName: tool.fileName,
        category: tool.category,
        sizeBytes: tool.sizeBytes,
        documented: tool.documented,
        nativeSlot: tool.nativeSlot,
        contentRead: false,
      })),
      documentation: relatedDocumentation.map((doc) => ({
        relativePath: doc.relativePath,
        fileName: doc.fileName,
        category: doc.category,
        sizeBytes: doc.sizeBytes,
        matchesToolImplementation: doc.matchesToolImplementation,
        contentRead: false,
      })),
      categories,
      summary: {
        totalTools: tools.length,
        matchedTools: filteredTools.length,
        totalDocumentation: documentation.length,
        matchedDocumentation: relatedDocumentation.length,
        categoryCount: categories.length,
        filterApplied: Boolean(safeCategory || safeQuery),
        canReadSourceFileContent: false,
        exposesSourceFileContent: false,
        exposesDocumentationContent: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canExecuteToolCode: false,
        canActivateRuntime: false,
        canMutate: false,
        createsTask: false,
        createsApproval: false,
      },
      governance: {
        mode: "native_tool_catalog_adapter_read_only",
        runtimeOwner: "openclaw_on_nixos",
        sourceRegistry: catalog.registry,
        canReadMetadata: true,
        canReadSourceFileContent: false,
        exposesSourceFileContent: false,
        exposesDocumentationContent: false,
        exposesScriptBodies: false,
        exposesDependencyVersions: false,
        canMutate: false,
        canExecute: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canExecuteToolCode: false,
        canActivateRuntime: false,
        createsTask: false,
        createsApproval: false,
        requiresPolicyInvocation: true,
      },
    };
  }

  const SEMANTIC_INDEX_SCOPES = new Map([
    ["tools", "src/agents/tools"],
    ["plugin_sdk", "src/plugin-sdk"],
    ["tool_docs", "docs/tools"],
  ]);

  function semanticIndexKindForRelativePath(relativePath) {
    if (relativePath.endsWith(".d.ts")) {
      return "type_declaration";
    }
    const extension = path.extname(relativePath);
    if ([".ts", ".tsx"].includes(extension)) {
      return "typescript_source";
    }
    if ([".js", ".mjs", ".cjs"].includes(extension)) {
      return "javascript_source";
    }
    if ([".md", ".mdx"].includes(extension)) {
      return "documentation";
    }
    if (extension === ".json") {
      return "manifest_or_schema";
    }
    return "other";
  }

  const PROMPT_SEMANTICS_ROOTS = [
    { relativeRoot: "", files: ["TOOLS.md", "AGENTS.md", "CLAUDE.md"] },
    { relativeRoot: "docs/tools", maxDepth: 1 },
    { relativeRoot: "skills", maxDepth: 2 },
    { relativeRoot: ".agents", maxDepth: 2 },
    { relativeRoot: "ui", files: ["AGENTS.md", "CLAUDE.md"] },
    { relativeRoot: "src/wizard", maxDepth: 1 },
  ];

  const PROMPT_SEMANTIC_TERMS = [
    "edit",
    "patch",
    "diff",
    "verify",
    "test",
    "typecheck",
    "lint",
    "approval",
    "plan",
    "tool",
    "skill",
    "agent",
    "prompt",
    "safety",
    "command",
    "shell",
    "process",
  ];

  function promptSemanticKindForRelativePath(relativePath) {
    const extension = path.extname(relativePath);
    if ([".md", ".mdx"].includes(extension)) {
      return "prompt_documentation";
    }
    if ([".ts", ".tsx", ".js", ".mjs", ".cjs"].includes(extension)) {
      return "prompt_source";
    }
    if (extension === ".json") {
      return "prompt_manifest";
    }
    return "other";
  }

  function buildExpectedChecksFromPromptTerms(termCounts, scripts = []) {
    const checks = new Set(["diff-preview", "approval-required", "filesystem-ledger"]);
    const scriptSet = new Set(scripts);
    if ((termCounts.typecheck ?? 0) > 0 || scriptSet.has("typecheck")) {
      checks.add("typecheck");
    }
    if ((termCounts.test ?? 0) > 0 || scriptSet.has("test")) {
      checks.add("test");
    }
    if ((termCounts.lint ?? 0) > 0 || scriptSet.has("lint")) {
      checks.add("lint");
    }
    if ((termCounts.verify ?? 0) > 0) {
      checks.add("verify");
    }
    if ((termCounts.patch ?? 0) > 0 || (termCounts.diff ?? 0) > 0) {
      checks.add("patch-validation");
    }
    return [...checks];
  }

  function analysePromptSemanticFile(rootPath, absolutePath, relativePath) {
    const stats = safeStat(absolutePath);
    const kind = promptSemanticKindForRelativePath(relativePath);
    const base = {
      relativePath,
      kind,
      category: classifyToolCatalogEntry(relativePath),
      sizeBytes: stats?.size ?? null,
      contentRead: false,
      contentExposed: false,
    };
    if (!stats?.isFile() || stats.size > 64 * 1024 || kind === "other") {
      return {
        ...base,
        skipped: true,
        skipReason: stats?.size > 64 * 1024 ? "file_too_large" : "not_readable_or_supported",
      };
    }

    let text = "";
    try {
      text = readFileSync(absolutePath, "utf8");
    } catch {
      return {
        ...base,
        skipped: true,
        skipReason: "read_failed",
      };
    }

    const lower = text.toLowerCase();
    const lines = text.split(/\r?\n/);
    const termCounts = Object.fromEntries(PROMPT_SEMANTIC_TERMS.map((term) => [
      term,
      (lower.match(new RegExp(`\\b${term}\\b`, "g")) ?? []).length,
    ]));
    return {
      ...base,
      contentRead: true,
      skipped: false,
      lineCount: lines.length,
      nonEmptyLineCount: lines.filter((line) => line.trim()).length,
      signals: {
        headings: kind === "prompt_documentation" ? text.match(/^#{1,6}\s+/gm)?.length ?? 0 : 0,
        fencedCodeBlocks: kind === "prompt_documentation" ? text.match(/```/g)?.length ?? 0 : 0,
        exportedSymbols: kind === "prompt_source" ? text.match(/\bexport\b/g)?.length ?? 0 : 0,
        semanticTermCounts: termCounts,
        hasEditVocabulary: (termCounts.edit ?? 0) > 0 || (termCounts.patch ?? 0) > 0 || (termCounts.diff ?? 0) > 0,
        hasVerificationVocabulary: (termCounts.verify ?? 0) > 0 || (termCounts.test ?? 0) > 0 || (termCounts.typecheck ?? 0) > 0 || (termCounts.lint ?? 0) > 0,
        hasGovernanceVocabulary: (termCounts.approval ?? 0) > 0 || (termCounts.safety ?? 0) > 0,
      },
    };
  }

  function collectPromptSemanticFiles(rootPath, { query = null, maxFiles = 80 } = {}) {
    const safeQuery = typeof query === "string" && query.trim() ? query.trim().toLowerCase() : null;
    const files = [];

    function maybeAddFile(relativePath) {
      if (files.length >= maxFiles) {
        return;
      }
      const absolutePath = path.join(rootPath, relativePath);
      const stats = safeStat(absolutePath);
      if (!stats?.isFile()) {
        return;
      }
      if (safeQuery && !relativePath.toLowerCase().includes(safeQuery)) {
        try {
          const text = readFileSync(absolutePath, "utf8").slice(0, 64 * 1024).toLowerCase();
          if (!text.includes(safeQuery)) {
            return;
          }
        } catch {
          return;
        }
      }
      files.push(analysePromptSemanticFile(rootPath, absolutePath, relativePath.replaceAll(path.sep, "/")));
    }

    function visit(relativeRoot, depth, maxDepth) {
      if (files.length >= maxFiles || depth > maxDepth) {
        return;
      }
      const absoluteRoot = path.join(rootPath, relativeRoot);
      let entries = [];
      try {
        entries = readdirSync(absoluteRoot, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        if (files.length >= maxFiles) {
          return;
        }
        const relativePath = path.join(relativeRoot, entry.name);
        if (entry.isDirectory()) {
          if (!TOOL_CATALOG_IGNORED_DIRECTORIES.has(entry.name)) {
            visit(relativePath, depth + 1, maxDepth);
          }
          continue;
        }
        if (!entry.isFile() || promptSemanticKindForRelativePath(relativePath) === "other") {
          continue;
        }
        maybeAddFile(relativePath);
      }
    }

    for (const root of PROMPT_SEMANTICS_ROOTS) {
      for (const file of root.files ?? []) {
        maybeAddFile(path.join(root.relativeRoot, file));
      }
      if (root.maxDepth !== undefined) {
        visit(root.relativeRoot, 0, root.maxDepth);
      }
    }
    return files;
  }

  function buildNativeOpenClawPromptSemanticsProfile({
    workspacePath = null,
    query = "edit",
    limit = 40,
  } = {}) {
    const { item } = selectOpenClawToolCatalogWorkspace({ workspacePath });
    const safeLimit = normalisePositiveLimit(limit, 40, 100);
    const files = collectPromptSemanticFiles(item.path, { query, maxFiles: safeLimit });
    const scripts = Array.isArray(item.scripts) ? item.scripts : [];
    const termCounts = Object.fromEntries(PROMPT_SEMANTIC_TERMS.map((term) => [term, 0]));
    const totals = files.reduce((accumulator, file) => {
      accumulator.totalFiles += 1;
      if (file.contentRead) {
        accumulator.contentRead += 1;
        accumulator.lineCount += file.lineCount ?? 0;
        accumulator.editVocabularyFiles += file.signals?.hasEditVocabulary ? 1 : 0;
        accumulator.verificationVocabularyFiles += file.signals?.hasVerificationVocabulary ? 1 : 0;
        accumulator.governanceVocabularyFiles += file.signals?.hasGovernanceVocabulary ? 1 : 0;
        for (const [term, count] of Object.entries(file.signals?.semanticTermCounts ?? {})) {
          termCounts[term] = (termCounts[term] ?? 0) + count;
        }
      } else {
        accumulator.skipped += 1;
      }
      accumulator.byKind[file.kind] = (accumulator.byKind[file.kind] ?? 0) + 1;
      accumulator.byCategory[file.category] = (accumulator.byCategory[file.category] ?? 0) + 1;
      return accumulator;
    }, {
      totalFiles: 0,
      contentRead: 0,
      skipped: 0,
      lineCount: 0,
      editVocabularyFiles: 0,
      verificationVocabularyFiles: 0,
      governanceVocabularyFiles: 0,
      byKind: {},
      byCategory: {},
    });
    const expectedChecks = buildExpectedChecksFromPromptTerms(termCounts, scripts);
    const workStandards = buildPromptWorkStandardsAssessment({
      expectedChecks,
      termCounts,
      files,
      scripts,
      contentExposed: false,
    });
    const nativeRegistry = createOpenClawNativePluginRegistry();
    const capability = nativeRegistry.items[0]?.contract?.capabilities
      ?.find((entry) => entry.id === "sense.openclaw.prompt_pack") ?? null;

    return {
      ok: files.length > 0,
      registry: "openclaw-native-prompt-semantics-v0",
      mode: "prompt-tool-semantics-profile-only",
      generatedAt: new Date().toISOString(),
      sourceRegistry: "openclaw-source-workspace-v0",
      adapterStatus: "native_shell_active_prompt_semantics_only",
      capability: {
        id: capability?.id ?? "sense.openclaw.prompt_pack",
        kind: capability?.kind ?? "sense",
        risk: capability?.risk ?? "low",
        approvalRequired: capability?.approval?.required ?? false,
        runtimeOwner: capability?.runtimeOwner ?? "openclaw_on_nixos",
      },
      workspace: {
        id: item.id,
        name: item.name,
        path: item.path,
      },
      query: {
        text: typeof query === "string" && query.trim() ? query.trim() : "edit",
        limit: safeLimit,
      },
      files: files.map((file) => ({
        relativePath: file.relativePath,
        kind: file.kind,
        category: file.category,
        sizeBytes: file.sizeBytes,
        contentRead: file.contentRead,
        contentExposed: false,
        skipped: file.skipped,
        skipReason: file.skipReason,
        lineCount: file.lineCount,
        signals: file.signals,
      })),
      derivedPlanSemantics: {
        editIntent: {
          kind: "source_derived_workspace_edit",
          planningStyle: termCounts.plan > 0 ? "plan_first" : "direct_patch_review",
          targetSafety: termCounts.approval > 0 || termCounts.safety > 0 ? "approval_gated" : "native_policy_gated",
          verificationStyle: expectedChecks.filter((check) => ["typecheck", "test", "lint", "verify"].includes(check)),
        },
        expectedChecks,
        promptTermCounts: termCounts,
        workStandards,
        contentExposed: false,
      },
      workStandards,
      summary: {
        ...totals,
        expectedChecks,
        promptTermCounts: termCounts,
        workStandardsStatus: workStandards.status,
        workStandardsSatisfied: workStandards.score.satisfied,
        workStandardsRequired: workStandards.score.required,
        canReadPromptContent: true,
        exposesPromptContent: false,
        canImportModule: false,
        canExecutePromptCode: false,
        canExecuteToolCode: false,
        canMutate: false,
        createsTask: false,
        createsApproval: false,
      },
      governance: {
        mode: "native_prompt_semantics_read_only",
        runtimeOwner: "openclaw_on_nixos",
        canReadMetadata: true,
        canReadPromptContent: true,
        exposesPromptContent: false,
        exposesSourceFileContent: false,
        exposesFunctionBodies: false,
        canMutate: false,
        canExecute: false,
        canImportModule: false,
        canExecutePromptCode: false,
        canExecuteToolCode: false,
        canActivateRuntime: false,
        createsTask: false,
        createsApproval: false,
        requiresPolicyInvocation: true,
        outputMode: "derived_prompt_semantics_only",
      },
    };
  }

  function analyseSemanticIndexFile(rootPath, absolutePath, relativePath) {
    const stats = safeStat(absolutePath);
    const kind = semanticIndexKindForRelativePath(relativePath);
    const maxBytes = 64 * 1024;
    const base = {
      relativePath,
      kind,
      category: classifyToolCatalogEntry(relativePath),
      sizeBytes: stats?.size ?? null,
      contentRead: false,
      contentExposed: false,
    };
    if (!stats?.isFile() || stats.size > maxBytes) {
      return {
        ...base,
        skipped: true,
        skipReason: stats?.size > maxBytes ? "file_too_large" : "not_readable",
      };
    }

    let text = "";
    try {
      text = readFileSync(absolutePath, "utf8");
    } catch {
      return {
        ...base,
        skipped: true,
        skipReason: "read_failed",
      };
    }

    const lower = text.toLowerCase();
    const lines = text.split(/\r?\n/);
    const semanticTerms = [
      "tool",
      "capability",
      "policy",
      "approval",
      "session",
      "agent",
      "workspace",
      "fetch",
      "search",
      "execute",
    ].filter((term) => lower.includes(term));
    return {
      ...base,
      contentRead: true,
      skipped: false,
      lineCount: lines.length,
      nonEmptyLineCount: lines.filter((line) => line.trim()).length,
      signals: {
        exportStatements: text.match(/\bexport\b/g)?.length ?? 0,
        importStatements: text.match(/\bimport\b/g)?.length ?? 0,
        interfaceDeclarations: text.match(/\binterface\s+[A-Za-z_$][\w$]*/g)?.length ?? 0,
        typeDeclarations: text.match(/\btype\s+[A-Za-z_$][\w$]*/g)?.length ?? 0,
        functionDeclarations: text.match(/\bfunction\s+[A-Za-z_$][\w$]*/g)?.length ?? 0,
        classDeclarations: text.match(/\bclass\s+[A-Za-z_$][\w$]*/g)?.length ?? 0,
        constDeclarations: text.match(/\bconst\s+[A-Za-z_$][\w$]*/g)?.length ?? 0,
        markdownHeadings: kind === "documentation" ? text.match(/^#{1,6}\s+/gm)?.length ?? 0 : 0,
        fencedCodeBlocks: kind === "documentation" ? text.match(/```/g)?.length ?? 0 : 0,
        semanticTermCount: semanticTerms.length,
        hasSemanticVocabulary: semanticTerms.length > 0,
      },
    };
  }

  function collectWorkspaceSemanticIndexFiles(rootPath, {
    scope = "tools",
    query = null,
    maxDepth = 2,
    maxFiles = 80,
  } = {}) {
    const relativeRoot = SEMANTIC_INDEX_SCOPES.get(scope) ?? SEMANTIC_INDEX_SCOPES.get("tools");
    const sourceRoot = path.join(rootPath, relativeRoot);
    const rootStats = safeStat(sourceRoot);
    if (!rootStats?.isDirectory()) {
      return {
        scope,
        root: sourceRoot,
        relativeRoot,
        present: false,
        files: [],
      };
    }
    const safeQuery = typeof query === "string" && query.trim() ? query.trim().toLowerCase() : null;
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
          if (!TOOL_CATALOG_IGNORED_DIRECTORIES.has(entry.name)) {
            visit(absolutePath, depth + 1);
          }
          continue;
        }
        if (!entry.isFile()) {
          continue;
        }
        const relativePath = path.relative(sourceRoot, absolutePath).replaceAll(path.sep, "/");
        if (semanticIndexKindForRelativePath(relativePath) === "other") {
          continue;
        }
        if (safeQuery && !relativePath.toLowerCase().includes(safeQuery)) {
          continue;
        }
        files.push(analyseSemanticIndexFile(sourceRoot, absolutePath, relativePath));
      }
    }

    visit(sourceRoot, 0);
    return {
      scope,
      root: sourceRoot,
      relativeRoot,
      present: true,
      files,
    };
  }

  function buildNativeOpenClawWorkspaceSemanticIndex({
    workspacePath = null,
    scope = "tools",
    query = null,
    limit = 40,
  } = {}) {
    const { item } = selectOpenClawToolCatalogWorkspace({ workspacePath });
    const safeScope = SEMANTIC_INDEX_SCOPES.has(scope) ? scope : "tools";
    const safeLimit = normalisePositiveLimit(limit, 40, 100);
    const collection = collectWorkspaceSemanticIndexFiles(item.path, {
      scope: safeScope,
      query,
      maxFiles: safeLimit,
    });
    const totals = collection.files.reduce((accumulator, file) => {
      accumulator.totalFiles += 1;
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
        accumulator.markdownHeadings += file.signals?.markdownHeadings ?? 0;
        accumulator.semanticVocabularyFiles += file.signals?.hasSemanticVocabulary ? 1 : 0;
      } else {
        accumulator.skipped += 1;
      }
      accumulator.byKind[file.kind] = (accumulator.byKind[file.kind] ?? 0) + 1;
      accumulator.byCategory[file.category] = (accumulator.byCategory[file.category] ?? 0) + 1;
      return accumulator;
    }, {
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
      markdownHeadings: 0,
      semanticVocabularyFiles: 0,
      byKind: {},
      byCategory: {},
    });
    const nativeRegistry = createOpenClawNativePluginRegistry();
    const capability = nativeRegistry.items[0]?.contract?.capabilities
      ?.find((entry) => entry.id === "sense.openclaw.workspace_semantic_index") ?? null;

    return {
      ok: collection.present,
      registry: "openclaw-native-plugin-adapter-v0",
      mode: "workspace-semantic-index-only",
      generatedAt: new Date().toISOString(),
      sourceRegistry: "openclaw-tool-catalog-v0",
      adapterStatus: "native_shell_active_workspace_semantic_index_only",
      capability: {
        id: capability?.id ?? "sense.openclaw.workspace_semantic_index",
        kind: capability?.kind ?? "sense",
        risk: capability?.risk ?? "low",
        approvalRequired: capability?.approval?.required ?? false,
        runtimeOwner: capability?.runtimeOwner ?? "openclaw_on_nixos",
      },
      workspace: {
        id: item.id,
        name: item.name,
        path: item.path,
      },
      scope: {
        id: safeScope,
        relativeRoot: collection.relativeRoot,
        root: collection.root,
        query: typeof query === "string" && query.trim() ? query.trim() : null,
        limit: safeLimit,
      },
      files: collection.files.map((file) => ({
        relativePath: file.relativePath,
        kind: file.kind,
        category: file.category,
        sizeBytes: file.sizeBytes,
        contentRead: file.contentRead,
        contentExposed: false,
        skipped: file.skipped,
        skipReason: file.skipReason,
        lineCount: file.lineCount,
        nonEmptyLineCount: file.nonEmptyLineCount,
        signals: file.signals,
      })),
      summary: {
        ...totals,
        canReadSourceFileContent: true,
        exposesSourceFileContent: false,
        exposesDocumentationContent: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canExecuteToolCode: false,
        canActivateRuntime: false,
        canMutate: false,
        createsTask: false,
        createsApproval: false,
      },
      governance: {
        mode: "native_workspace_semantic_index_read_only",
        runtimeOwner: "openclaw_on_nixos",
        canReadMetadata: true,
        canReadSourceFileContent: true,
        exposesSourceFileContent: false,
        exposesDocumentationContent: false,
        exposesScriptBodies: false,
        exposesDependencyVersions: false,
        canMutate: false,
        canExecute: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canExecuteToolCode: false,
        canActivateRuntime: false,
        createsTask: false,
        createsApproval: false,
        requiresPolicyInvocation: true,
        outputMode: "derived_signals_only",
      },
    };
  }

  function normaliseSymbolLookupQuery(query) {
    if (typeof query !== "string") {
      return "tool";
    }
    const trimmed = query.trim().replace(/\s+/g, " ");
    return trimmed ? trimmed.slice(0, 64) : "tool";
  }

  function sanitizeDeclarationPreview(line) {
    const withoutBody = line
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\s*\{.*$/, " { ... }")
      .replace(/\s*=>.*$/, " => ...")
      .replace(/\s*=\s*.*$/, " = ...");
    const withoutLiteralValues = withoutBody.replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, "$1...$1");
    return withoutLiteralValues.length > 160
      ? `${withoutLiteralValues.slice(0, 157)}...`
      : withoutLiteralValues;
  }

  function collectWorkspaceSymbolLookupMatches(rootPath, {
    scope = "tools",
    query = "tool",
    maxDepth = 2,
    maxFiles = 80,
    maxMatches = 20,
  } = {}) {
    const relativeRoot = SEMANTIC_INDEX_SCOPES.get(scope) ?? SEMANTIC_INDEX_SCOPES.get("tools");
    const sourceRoot = path.join(rootPath, relativeRoot);
    const rootStats = safeStat(sourceRoot);
    if (!rootStats?.isDirectory()) {
      return {
        scope,
        root: sourceRoot,
        relativeRoot,
        present: false,
        filesScanned: 0,
        declarationsScanned: 0,
        matches: [],
      };
    }

    const safeQuery = normaliseSymbolLookupQuery(query);
    const lowerQuery = safeQuery.toLowerCase();
    const matches = [];
    let filesScanned = 0;
    let declarationsScanned = 0;

    function visit(currentPath, depth) {
      if (matches.length >= maxMatches || filesScanned >= maxFiles || depth > maxDepth) {
        return;
      }
      let entries = [];
      try {
        entries = readdirSync(currentPath, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        if (matches.length >= maxMatches || filesScanned >= maxFiles) {
          return;
        }
        const absolutePath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          if (!TOOL_CATALOG_IGNORED_DIRECTORIES.has(entry.name)) {
            visit(absolutePath, depth + 1);
          }
          continue;
        }
        if (!entry.isFile()) {
          continue;
        }
        const relativePath = path.relative(sourceRoot, absolutePath).replaceAll(path.sep, "/");
        const kind = semanticIndexKindForRelativePath(relativePath);
        if (!["typescript_source", "javascript_source", "type_declaration"].includes(kind)) {
          continue;
        }
        const stats = safeStat(absolutePath);
        if (!stats?.isFile() || stats.size > 64 * 1024) {
          continue;
        }
        let text = "";
        try {
          text = readFileSync(absolutePath, "utf8");
        } catch {
          continue;
        }
        filesScanned += 1;
        const category = classifyToolCatalogEntry(relativePath);
        const lines = text.split(/\r?\n/);
        lines.forEach((line, index) => {
          if (matches.length >= maxMatches) {
            return;
          }
          const declarationLine = line.replace(/^\uFEFF/, "");
          const declaration = declarationLine.match(/^(export\s+)?(?:default\s+)?(?:async\s+)?(function|class|interface|type|const|let|var|enum)\s+([A-Za-z_$][\w$]*)/);
          if (!declaration) {
            return;
          }
          declarationsScanned += 1;
          const exported = Boolean(declaration[1]);
          const declarationKind = declaration[2];
          const symbolName = declaration[3];
          const declarationPreview = sanitizeDeclarationPreview(declarationLine);
          const searchable = [
            relativePath,
            category,
            declarationKind,
            symbolName,
            declarationPreview,
          ].join(" ").toLowerCase();
          if (!searchable.includes(lowerQuery)) {
            return;
          }
          matches.push({
            relativePath,
            kind,
            category,
            lineNumber: index + 1,
            declarationKind,
            symbolName,
            exported,
            declarationPreview,
            contentRead: true,
            contentExposed: false,
            declarationPreviewExposed: true,
          });
        });
      }
    }

    visit(sourceRoot, 0);
    return {
      scope,
      root: sourceRoot,
      relativeRoot,
      present: true,
      query: safeQuery,
      filesScanned,
      declarationsScanned,
      matches,
    };
  }

  function buildNativeOpenClawWorkspaceSymbolLookup({
    workspacePath = null,
    scope = "tools",
    query = "tool",
    limit = 20,
  } = {}) {
    const { item } = selectOpenClawToolCatalogWorkspace({ workspacePath });
    const safeScope = SEMANTIC_INDEX_SCOPES.has(scope) ? scope : "tools";
    const safeLimit = normalisePositiveLimit(limit, 20, 50);
    const collection = collectWorkspaceSymbolLookupMatches(item.path, {
      scope: safeScope,
      query,
      maxMatches: safeLimit,
    });
    const nativeRegistry = createOpenClawNativePluginRegistry();
    const capability = nativeRegistry.items[0]?.contract?.capabilities
      ?.find((entry) => entry.id === "sense.openclaw.workspace_symbol_lookup") ?? null;

    return {
      ok: collection.present,
      registry: "openclaw-native-plugin-adapter-v0",
      mode: "workspace-symbol-lookup-executable-read-only",
      generatedAt: new Date().toISOString(),
      sourceRegistry: "openclaw-tool-catalog-v0",
      adapterStatus: "native_shell_active_workspace_symbol_lookup",
      capability: {
        id: capability?.id ?? "sense.openclaw.workspace_symbol_lookup",
        kind: capability?.kind ?? "sense",
        risk: capability?.risk ?? "low",
        approvalRequired: capability?.approval?.required ?? false,
        runtimeOwner: capability?.runtimeOwner ?? "openclaw_on_nixos",
      },
      workspace: {
        id: item.id,
        name: item.name,
        path: item.path,
      },
      query: {
        text: collection.query,
        scope: safeScope,
        relativeRoot: collection.relativeRoot,
        limit: safeLimit,
      },
      matches: collection.matches,
      summary: {
        matchedSymbols: collection.matches.length,
        filesScanned: collection.filesScanned,
        declarationsScanned: collection.declarationsScanned,
        contentRead: collection.filesScanned,
        canExecuteQuery: true,
        canReadSourceFileContent: true,
        exposesSourceFileContent: false,
        exposesDeclarationPreview: true,
        exposesFunctionBodies: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canExecuteToolCode: false,
        canActivateRuntime: false,
        canMutate: false,
        createsTask: false,
        createsApproval: false,
      },
      governance: {
        mode: "native_workspace_symbol_lookup_read_only",
        runtimeOwner: "openclaw_on_nixos",
        canReadMetadata: true,
        canReadSourceFileContent: true,
        exposesSourceFileContent: false,
        exposesDeclarationPreview: true,
        exposesFunctionBodies: false,
        exposesDocumentationContent: false,
        exposesScriptBodies: false,
        exposesDependencyVersions: false,
        canExecuteQuery: true,
        canMutate: false,
        canExecute: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canExecuteToolCode: false,
        canActivateRuntime: false,
        createsTask: false,
        createsApproval: false,
        requiresPolicyInvocation: true,
        outputMode: "declaration_symbols_only",
      },
    };
  }

  function scoreOpenClawEditTargetCandidate(candidate, query) {
    const lowerQuery = normaliseSymbolLookupQuery(query).toLowerCase();
    const searchable = [
      candidate.relativePath,
      candidate.kind,
      candidate.category,
      candidate.primarySymbol?.symbolName,
      candidate.primarySymbol?.declarationKind,
    ].join(" ").toLowerCase();
    let score = 0;
    if (candidate.kind === "typescript_source" || candidate.kind === "javascript_source") {
      score += 30;
    }
    if (candidate.kind === "type_declaration") {
      score += 15;
    }
    if (candidate.primarySymbol) {
      score += 20;
    }
    if (candidate.toolCatalogMatch) {
      score += 15;
    }
    if (candidate.semanticSignals?.hasSemanticVocabulary) {
      score += 10;
    }
    if (searchable.includes(lowerQuery)) {
      score += 25;
    }
    return score;
  }

  function buildNativeOpenClawWorkspaceEditTargetSelection({
    workspacePath = null,
    scope = "tools",
    query = "edit",
    limit = 8,
  } = {}) {
    const { item } = selectOpenClawToolCatalogWorkspace({ workspacePath });
    const safeScope = SEMANTIC_INDEX_SCOPES.has(scope) ? scope : "tools";
    const safeQuery = normaliseSymbolLookupQuery(query);
    const safeLimit = normalisePositiveLimit(limit, 8, 20);
    const relativeRoot = SEMANTIC_INDEX_SCOPES.get(safeScope) ?? SEMANTIC_INDEX_SCOPES.get("tools");
    const semanticIndex = buildNativeOpenClawWorkspaceSemanticIndex({
      workspacePath: item.path,
      scope: safeScope,
      query: safeQuery,
      limit: safeLimit * 2,
    });
    const symbolLookup = buildNativeOpenClawWorkspaceSymbolLookup({
      workspacePath: item.path,
      scope: safeScope,
      query: safeQuery,
      limit: safeLimit * 2,
    });
    let catalogProfile = null;
    if (safeScope === "tools") {
      try {
        catalogProfile = buildNativeOpenClawToolCatalogProfile({
          workspacePath: item.path,
          query: safeQuery,
          limit: safeLimit * 2,
        });
      } catch {
        catalogProfile = null;
      }
    }
    const catalogPaths = new Set((catalogProfile?.tools ?? []).map((tool) => tool.relativePath));
    const matchesByPath = new Map();
    for (const match of symbolLookup.matches ?? []) {
      if (!matchesByPath.has(match.relativePath)) {
        matchesByPath.set(match.relativePath, match);
      }
    }
    const candidates = (semanticIndex.files ?? [])
      .filter((file) => file.contentRead && !file.skipped)
      .filter((file) => ["typescript_source", "javascript_source", "type_declaration"].includes(file.kind))
      .map((file) => {
        const workspaceRelativePath = `${relativeRoot}/${file.relativePath}`.replaceAll("\\", "/");
        const primarySymbol = matchesByPath.get(file.relativePath) ?? null;
        const candidate = {
          relativePath: workspaceRelativePath,
          sourceRelativePath: file.relativePath,
          kind: file.kind,
          category: file.category,
          lineCount: file.lineCount,
          sizeBytes: file.sizeBytes,
          primarySymbol: primarySymbol ? {
            symbolName: primarySymbol.symbolName,
            declarationKind: primarySymbol.declarationKind,
            lineNumber: primarySymbol.lineNumber,
            exported: primarySymbol.exported,
            declarationPreview: primarySymbol.declarationPreview,
            declarationPreviewExposed: true,
          } : null,
          semanticSignals: {
            exportStatements: file.signals?.exportStatements ?? 0,
            functionDeclarations: file.signals?.functionDeclarations ?? 0,
            interfaceDeclarations: file.signals?.interfaceDeclarations ?? 0,
            typeDeclarations: file.signals?.typeDeclarations ?? 0,
            semanticTermCount: file.signals?.semanticTermCount ?? 0,
            hasSemanticVocabulary: Boolean(file.signals?.hasSemanticVocabulary),
          },
          toolCatalogMatch: catalogPaths.has(workspaceRelativePath),
          contentRead: true,
          contentExposed: false,
          eligibleForPatchProposal: true,
        };
        return {
          ...candidate,
          score: scoreOpenClawEditTargetCandidate(candidate, safeQuery),
        };
      })
      .sort((left, right) => right.score - left.score || left.relativePath.localeCompare(right.relativePath))
      .slice(0, safeLimit);
    const selectedTarget = candidates[0] ?? null;
    const nativeRegistry = createOpenClawNativePluginRegistry();
    const capability = nativeRegistry.items[0]?.contract?.capabilities
      ?.find((entry) => entry.id === "sense.openclaw.workspace_edit_target_select") ?? null;

    return {
      ok: Boolean(selectedTarget),
      registry: "openclaw-native-workspace-edit-target-selection-v0",
      mode: "source-derived-bounded-target-selection",
      generatedAt: new Date().toISOString(),
      sourceRegistries: [
        semanticIndex.registry,
        symbolLookup.registry,
        catalogProfile?.registry,
      ].filter(Boolean),
      capability: {
        id: capability?.id ?? "sense.openclaw.workspace_edit_target_select",
        kind: capability?.kind ?? "sense",
        risk: capability?.risk ?? "low",
        approvalRequired: capability?.approval?.required ?? false,
        runtimeOwner: capability?.runtimeOwner ?? "openclaw_on_nixos",
      },
      workspace: {
        id: item.id,
        name: item.name,
        path: item.path,
      },
      query: {
        text: safeQuery,
        scope: safeScope,
        relativeRoot,
        limit: safeLimit,
      },
      selectedTarget,
      candidates,
      summary: {
        candidateCount: candidates.length,
        selected: Boolean(selectedTarget),
        semanticFilesMatched: semanticIndex.files?.length ?? 0,
        symbolMatches: symbolLookup.matches?.length ?? 0,
        toolCatalogMatches: catalogProfile?.summary?.matchedTools ?? 0,
        canReadSourceFileContent: true,
        exposesSourceFileContent: false,
        exposesDeclarationPreview: true,
        canImportModule: false,
        canExecutePluginCode: false,
        canExecuteToolCode: false,
        canActivateRuntime: false,
        canMutate: false,
        createsTask: false,
        createsApproval: false,
        canFeedPatchProposal: Boolean(selectedTarget),
      },
      governance: {
        mode: "native_workspace_edit_target_selection_read_only",
        runtimeOwner: "openclaw_on_nixos",
        canReadMetadata: true,
        canReadSourceFileContent: true,
        exposesSourceFileContent: false,
        exposesDeclarationPreview: true,
        exposesFunctionBodies: false,
        canMutate: false,
        canExecute: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canExecuteToolCode: false,
        canActivateRuntime: false,
        createsTask: false,
        createsApproval: false,
        requiresPolicyInvocation: true,
        outputMode: "bounded_target_metadata_only",
      },
    };
  }

  return {
    normalisePositiveLimit,
    selectOpenClawToolCatalogWorkspace,
    buildOpenClawToolCatalog,
    buildNativeOpenClawToolCatalogProfile,
    buildNativeOpenClawPromptSemanticsProfile,
    buildNativeOpenClawWorkspaceSemanticIndex,
    buildNativeOpenClawWorkspaceSymbolLookup,
    buildNativeOpenClawWorkspaceEditTargetSelection,
  };
}

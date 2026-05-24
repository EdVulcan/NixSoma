import {
  OPENCLAW_NATIVE_PLUGIN_CONTRACT_VERSION,
  summariseOpenClawNativePluginContract,
  validateOpenClawNativePluginContract,
} from "../../../packages/shared-types/src/plugin-contract.mjs";
import {
  createOpenClawNativePluginRegistry,
  summariseOpenClawNativePluginRegistry,
  validateOpenClawNativePluginRegistry,
} from "../../../packages/shared-types/src/plugin-registry.mjs";
import { existsSync, readdirSync, statSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

export function createPluginReview(deps) {
  const { client, state } = deps;
  const { fetchJson, readJsonFileIfPresent } = client;
  const { workspaceRoots, tasks, persistState } = state;

  // L331-5976
function readPnpmWorkspacePackages(rootPath) {
  const filePath = path.join(rootPath, "pnpm-workspace.yaml");
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    const packages = [];
    let inPackages = false;
    for (const line of lines) {
      if (/^\s*packages\s*:/.test(line)) {
        inPackages = true;
        continue;
      }
      if (!inPackages) {
        continue;
      }
      if (/^\S/.test(line) && !/^\s*-/.test(line)) {
        break;
      }
      const match = line.match(/^\s*-\s*["']?([^"']+)["']?\s*$/);
      if (match?.[1]) {
        packages.push(match[1]);
      }
    }
    return packages;
  } catch {
    return [];
  }
}

function detectWorkspacePackageManager(rootPath) {
  if (existsSync(path.join(rootPath, "pnpm-lock.yaml")) || existsSync(path.join(rootPath, "pnpm-workspace.yaml"))) {
    return "pnpm";
  }
  if (existsSync(path.join(rootPath, "package-lock.json"))) {
    return "npm";
  }
  if (existsSync(path.join(rootPath, "yarn.lock"))) {
    return "yarn";
  }
  if (existsSync(path.join(rootPath, "bun.lockb")) || existsSync(path.join(rootPath, "bun.lock"))) {
    return "bun";
  }
  return null;
}

function safeDirectoryEntries(rootPath) {
  try {
    return readdirSync(rootPath, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith(".") && entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right))
      .slice(0, 24);
  } catch {
    return [];
  }
}

function safeDirectoryCount(rootPath) {
  try {
    return readdirSync(rootPath, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith(".") && entry.isDirectory())
      .length;
  } catch {
    return 0;
  }
}

function buildOpenClawWorkspaceProfile(rootPath, packageJson, topLevelDirectories) {
  const domainNames = [
    "apps",
    "packages",
    "extensions",
    "src",
    "ui",
    "docs",
    "skills",
    "scripts",
    "test",
    "qa",
  ];
  const presentDomains = domainNames.filter((name) => topLevelDirectories.includes(name));
  const looksLikeOpenClaw =
    packageJson?.name === "openclaw"
    || topLevelDirectories.includes("extensions")
    || existsSync(path.join(rootPath, ".openclaw"));

  if (!looksLikeOpenClaw) {
    return null;
  }

  const domainCounts = Object.fromEntries(presentDomains.map((name) => [
    name,
    safeDirectoryCount(path.join(rootPath, name)),
  ]));
  return {
    profile: "openclaw-source-workspace-v0",
    role: "external_source_workspace",
    presentDomains,
    domainCount: presentDomains.length,
    domainCounts,
    hasPluginSdk: existsSync(path.join(rootPath, "packages", "plugin-sdk")),
    hasMemoryHostSdk: existsSync(path.join(rootPath, "packages", "memory-host-sdk")),
    hasUiWorkspace: existsSync(path.join(rootPath, "ui", "package.json")),
    hasExtensionCatalog: existsSync(path.join(rootPath, "extensions")),
    governance: {
      mode: "source_profile_read_only",
      canReadFileContent: false,
      canMutate: false,
      canExecute: false,
      migrationStatus: "not_imported",
      integrationIntent: "inventory_before_absorb",
    },
  };
}

function safeStat(rootPath) {
  try {
    return statSync(rootPath);
  } catch {
    return null;
  }
}

function detectWorkspace(rootPath) {
  const resolvedPath = path.resolve(rootPath);
  const exists = existsSync(resolvedPath);
  const stats = exists ? safeStat(resolvedPath) : null;
  const isDirectory = stats?.isDirectory() === true;
  const packageJson = isDirectory ? readJsonFileIfPresent(path.join(resolvedPath, "package.json")) : null;
  const markers = isDirectory
    ? [
        "package.json",
        "pnpm-workspace.yaml",
        "README.md",
        "AGENTS.md",
        "CLAUDE.md",
        ".openclaw",
        ".git",
      ].filter((marker) => existsSync(path.join(resolvedPath, marker)))
    : [];
  const scripts = packageJson?.scripts && typeof packageJson.scripts === "object"
    ? Object.keys(packageJson.scripts).sort()
    : [];
  const workspaces = Array.isArray(packageJson?.workspaces)
    ? packageJson.workspaces
    : Array.isArray(packageJson?.workspaces?.packages)
      ? packageJson.workspaces.packages
      : isDirectory
        ? readPnpmWorkspacePackages(resolvedPath)
        : [];
  const topLevelDirectories = isDirectory ? safeDirectoryEntries(resolvedPath) : [];
  const openclawProfile = isDirectory
    ? buildOpenClawWorkspaceProfile(resolvedPath, packageJson, topLevelDirectories)
    : null;

  return {
    id: path.basename(resolvedPath) || "workspace",
    name: typeof packageJson?.name === "string" ? packageJson.name : path.basename(resolvedPath),
    path: resolvedPath,
    exists,
    readable: isDirectory,
    kind: packageJson ? "node_workspace" : isDirectory ? "filesystem_workspace" : "missing",
    packageManager: isDirectory ? detectWorkspacePackageManager(resolvedPath) : null,
    private: packageJson?.private === true,
    version: typeof packageJson?.version === "string" ? packageJson.version : null,
    scripts,
    scriptCount: scripts.length,
    workspaces,
    workspaceCount: workspaces.length,
    markers,
    topLevelDirectories,
    openclawProfile,
    governance: {
      mode: "read_only_detect",
      canReadMetadata: true,
      canReadFileContent: false,
      canMutate: false,
      canExecute: false,
    },
  };
}

function buildWorkspaceRegistry() {
  const items = workspaceRoots.map((root) => detectWorkspace(root));
  const detected = items.filter((item) => item.exists && item.readable);
  return {
    registry: "workspace-detect-v0",
    mode: "read-only",
    generatedAt: new Date().toISOString(),
    roots: workspaceRoots,
    count: items.length,
    items,
    summary: {
      total: items.length,
      detected: detected.length,
      missing: items.length - detected.length,
      nodeWorkspaces: items.filter((item) => item.kind === "node_workspace").length,
      byPackageManager: items.reduce((accumulator, item) => {
        const key = item.packageManager ?? "unknown";
        accumulator[key] = (accumulator[key] ?? 0) + 1;
        return accumulator;
      }, {}),
    },
  };
}

const WORKSPACE_COMMAND_SCRIPT_ORDER = [
  "typecheck",
  "test",
  "lint",
  "build",
  "dev",
];

function workspaceScriptCategory(scriptName) {
  if (scriptName === "typecheck" || scriptName === "test" || scriptName === "lint") {
    return "validation";
  }
  if (scriptName === "build") {
    return "build";
  }
  if (scriptName === "dev" || scriptName === "start") {
    return "runtime";
  }
  return "script";
}

function workspacePackageManagerCommand(packageManager) {
  if (packageManager === "pnpm") {
    return "pnpm";
  }
  if (packageManager === "yarn") {
    return "yarn";
  }
  if (packageManager === "bun") {
    return "bun";
  }
  return "npm";
}

function workspaceScriptArgs(packageManager, scriptName) {
  if (packageManager === "yarn") {
    return ["run", scriptName];
  }
  if (packageManager === "bun") {
    return ["run", scriptName];
  }
  return ["run", scriptName];
}

function workspaceScriptRisk(scriptName) {
  return scriptName === "dev" || scriptName === "start" ? "medium" : "low";
}

function buildWorkspaceCommandProposals() {
  const registry = buildWorkspaceRegistry();
  const items = registry.items
    .filter((workspace) => workspace.kind === "node_workspace" && workspace.exists && workspace.readable)
    .flatMap((workspace) => {
      const orderedScripts = [...workspace.scripts]
        .sort((left, right) => {
          const leftIndex = WORKSPACE_COMMAND_SCRIPT_ORDER.indexOf(left);
          const rightIndex = WORKSPACE_COMMAND_SCRIPT_ORDER.indexOf(right);
          if (leftIndex !== -1 || rightIndex !== -1) {
            return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
          }
          return left.localeCompare(right);
        });
      return orderedScripts.map((scriptName) => {
        const command = workspacePackageManagerCommand(workspace.packageManager);
        return {
          id: `${workspace.id}:${scriptName}`,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          workspacePath: workspace.path,
          scriptName,
          category: workspaceScriptCategory(scriptName),
          packageManager: workspace.packageManager ?? "npm",
          command,
          args: workspaceScriptArgs(workspace.packageManager, scriptName),
          cwd: workspace.path,
          usesShell: false,
          risk: workspaceScriptRisk(scriptName),
          status: "proposed",
          governance: {
            mode: "proposal_only",
            canExecute: false,
            requiresExplicitExecutionApproval: true,
            exposesScriptBody: false,
          },
        };
      });
    });

  return {
    registry: "workspace-command-proposals-v0",
    mode: "proposal-only",
    generatedAt: registry.generatedAt,
    workspaceRegistry: registry.registry,
    roots: registry.roots,
    count: items.length,
    items,
    summary: {
      total: items.length,
      workspaces: new Set(items.map((item) => item.workspaceId)).size,
      byWorkspace: items.reduce((accumulator, item) => {
        accumulator[item.workspaceName] = (accumulator[item.workspaceName] ?? 0) + 1;
        return accumulator;
      }, {}),
      byPackageManager: items.reduce((accumulator, item) => {
        accumulator[item.packageManager] = (accumulator[item.packageManager] ?? 0) + 1;
        return accumulator;
      }, {}),
      byCategory: items.reduce((accumulator, item) => {
        accumulator[item.category] = (accumulator[item.category] ?? 0) + 1;
        return accumulator;
      }, {}),
      byRisk: items.reduce((accumulator, item) => {
        accumulator[item.risk] = (accumulator[item.risk] ?? 0) + 1;
        return accumulator;
      }, {}),
    },
  };
}

function buildOpenClawSourceCommandProposals({
  workspacePath = null,
  query = "command",
  limit = 12,
} = {}) {
  const workspaceCommands = buildWorkspaceCommandProposals();
  const safeQuery = typeof query === "string" && query.trim() ? query.trim() : "command";
  const safeLimit = normalisePositiveLimit(limit, 12, 40);
  const selectedWorkspace = workspacePath
    ? workspaceCommands.items.find((item) => path.resolve(item.workspacePath) === path.resolve(workspacePath))?.workspacePath ?? workspacePath
    : workspaceCommands.items[0]?.workspacePath ?? workspacePath;
  let catalogProfile = null;
  let promptSemantics = null;
  try {
    catalogProfile = buildNativeOpenClawToolCatalogProfile({
      workspacePath: selectedWorkspace,
      query: safeQuery,
      limit: safeLimit,
    });
  } catch {
    catalogProfile = null;
  }
  try {
    promptSemantics = buildNativeOpenClawPromptSemanticsProfile({
      workspacePath: selectedWorkspace,
      query: safeQuery,
      limit: safeLimit,
    });
  } catch {
    promptSemantics = null;
  }

  const filteredItems = selectedWorkspace
    ? workspaceCommands.items.filter((item) => path.resolve(item.workspacePath) === path.resolve(selectedWorkspace))
    : workspaceCommands.items;
  const sourceRegistries = [
    workspaceCommands.registry,
    catalogProfile?.registry,
    promptSemantics?.registry,
  ].filter(Boolean);
  const commandTermCounts = promptSemantics?.derivedPlanSemantics?.promptTermCounts ?? {};
  const commandVocabularyFiles = (promptSemantics?.files ?? []).filter((file) => {
    const counts = file.signals?.semanticTermCounts ?? {};
    return (counts.command ?? 0) > 0 || (counts.shell ?? 0) > 0 || (counts.process ?? 0) > 0;
  }).length;
  const sourceCommandSignals = {
    registry: "openclaw-source-command-proposals-v0",
    mode: "read-only-command-proposal-absorption",
    sourceRegistries,
    query: truncatePatchMetadata(safeQuery, 120),
    toolSignals: {
      registry: catalogProfile?.registry ?? null,
      matchedTools: catalogProfile?.summary?.matchedTools ?? 0,
      matchedDocumentation: catalogProfile?.summary?.matchedDocumentation ?? 0,
      categories: catalogProfile?.categories ?? [],
      primaryTool: catalogProfile?.tools?.[0] ? {
        relativePath: catalogProfile.tools[0].relativePath,
        category: catalogProfile.tools[0].category,
        contentRead: false,
      } : null,
      contentExposed: false,
    },
    promptSignals: promptSemantics ? {
      registry: promptSemantics.registry,
      matchedFiles: promptSemantics.summary?.totalFiles ?? 0,
      commandVocabularyFiles,
      promptTermCounts: {
        command: commandTermCounts.command ?? 0,
        shell: commandTermCounts.shell ?? 0,
        process: commandTermCounts.process ?? 0,
        approval: commandTermCounts.approval ?? 0,
        safety: commandTermCounts.safety ?? 0,
      },
      contentExposed: false,
    } : null,
    governance: {
      canReadWorkspaceScripts: true,
      exposesScriptBodies: false,
      exposesPromptContent: false,
      exposesSourceFileContent: false,
      canExecute: false,
      canCreateTask: false,
      requiresSeparatePlanBeforeTask: true,
    },
  };
  const items = filteredItems.map((item) => ({
    ...item,
    sourceCommand: {
      registry: sourceCommandSignals.registry,
      absorbedFromEnhancedOpenClaw: true,
      matchedTools: sourceCommandSignals.toolSignals.matchedTools,
      promptSemanticFiles: sourceCommandSignals.promptSignals?.matchedFiles ?? 0,
      commandVocabularyFiles: sourceCommandSignals.promptSignals?.commandVocabularyFiles ?? 0,
      contentExposed: false,
    },
    governance: {
      ...(item.governance ?? {}),
      sourceAbsorptionMode: "proposal_only",
      canExecute: false,
      canCreateTaskFromSourceAbsorption: false,
      requiresExplicitExecutionApproval: true,
      exposesScriptBody: false,
      exposesPromptContent: false,
      exposesSourceFileContent: false,
    },
  }));

  return {
    ok: true,
    registry: "openclaw-source-command-proposals-v0",
    mode: "proposal-only-source-absorbed",
    generatedAt: new Date().toISOString(),
    sourceRegistry: workspaceCommands.registry,
    workspaceRegistry: workspaceCommands.workspaceRegistry,
    roots: workspaceCommands.roots,
    query: {
      text: safeQuery,
      limit: safeLimit,
    },
    count: items.length,
    items,
    sourceCommandSignals,
    summary: {
      ...workspaceCommands.summary,
      total: items.length,
      workspaces: new Set(items.map((item) => item.workspaceId)).size,
      matchedTools: sourceCommandSignals.toolSignals.matchedTools,
      promptSemanticFiles: sourceCommandSignals.promptSignals?.matchedFiles ?? 0,
      commandVocabularyFiles,
      canExecute: false,
      createsTask: false,
      createsApproval: false,
      exposesScriptBodies: false,
      exposesPromptContent: false,
      exposesSourceFileContent: false,
    },
    governance: {
      mode: "source_command_proposals_read_only",
      runtimeOwner: "openclaw_on_nixos",
      canReadWorkspaceScripts: true,
      exposesScriptBodies: false,
      canReadPromptContent: true,
      exposesPromptContent: false,
      canReadSourceMetadata: true,
      exposesSourceFileContent: false,
      canExecute: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      requiresExplicitApprovalBeforeExecution: true,
    },
  };
}

function buildOpenClawMigrationCandidatesForWorkspace(workspace) {
  const profile = workspace.openclawProfile;
  if (!profile) {
    return [];
  }

  const candidates = [];
  const addCandidate = ({
    id,
    capability,
    sourceDomain,
    targetArea,
    migrationKind,
    risk,
    priority,
    evidence,
    rationale,
  }) => {
    candidates.push({
      id: `${workspace.id}:${id}`,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      workspacePath: workspace.path,
      capability,
      sourceDomain,
      targetArea,
      migrationKind,
      risk,
      priority,
      readiness: "profiled",
      evidence,
      rationale,
      governance: {
        mode: "migration_candidate_read_only",
        canReadFileContent: false,
        canMutate: false,
        canExecute: false,
        requiresHumanReview: true,
        migrationStatus: "candidate_only",
        integrationIntent: "absorb_after_plan",
      },
    });
  };

  if (profile.hasExtensionCatalog) {
    addCandidate({
      id: "extension-catalog",
      capability: "extension_catalog",
      sourceDomain: "extensions",
      targetArea: "capability_registry",
      migrationKind: "inventory_then_adapter",
      risk: "medium",
      priority: "high",
      evidence: {
        domainPresent: true,
        approximateEntries: profile.domainCounts?.extensions ?? 0,
      },
      rationale: "Extensions look like reusable capability providers, but they need adapter and policy review before import.",
    });
  }

  if (profile.hasPluginSdk) {
    addCandidate({
      id: "plugin-sdk",
      capability: "plugin_sdk",
      sourceDomain: "packages/plugin-sdk",
      targetArea: "capability_contracts",
      migrationKind: "contract_review",
      risk: "low",
      priority: "high",
      evidence: {
        packagePresent: true,
      },
      rationale: "A plugin SDK can harden OpenClaw's native capability boundary without making the old repo the runtime owner.",
    });
  }

  if (profile.hasMemoryHostSdk) {
    addCandidate({
      id: "memory-host-sdk",
      capability: "memory_host_sdk",
      sourceDomain: "packages/memory-host-sdk",
      targetArea: "long_term_memory",
      migrationKind: "contract_review",
      risk: "medium",
      priority: "medium",
      evidence: {
        packagePresent: true,
      },
      rationale: "Memory-related APIs are valuable, but need sovereignty and privacy review before becoming native state.",
    });
  }

  if (profile.hasUiWorkspace) {
    addCandidate({
      id: "ui-workspace",
      capability: "ui_workspace",
      sourceDomain: "ui",
      targetArea: "observer_ui",
      migrationKind: "pattern_absorption",
      risk: "low",
      priority: "medium",
      evidence: {
        packagePresent: true,
      },
      rationale: "UI patterns can inform Observer without copying runtime ownership from the source workspace.",
    });
  }

  if (profile.presentDomains?.includes("src")) {
    addCandidate({
      id: "core-source",
      capability: "core_source_patterns",
      sourceDomain: "src",
      targetArea: "openclaw_core",
      migrationKind: "design_review",
      risk: "medium",
      priority: "high",
      evidence: {
        approximateEntries: profile.domainCounts?.src ?? 0,
      },
      rationale: "Core source patterns should be reviewed as design input before any native reimplementation.",
    });
  }

  if (profile.presentDomains?.includes("docs")) {
    addCandidate({
      id: "documentation-canon",
      capability: "documentation_canon",
      sourceDomain: "docs",
      targetArea: "project_memory",
      migrationKind: "canon_reconcile",
      risk: "low",
      priority: "medium",
      evidence: {
        approximateEntries: profile.domainCounts?.docs ?? 0,
      },
      rationale: "Existing docs can preserve intent and constraints while the NixOS body evolves independently.",
    });
  }

  if (profile.presentDomains?.includes("skills")) {
    addCandidate({
      id: "agent-skills",
      capability: "agent_skills",
      sourceDomain: "skills",
      targetArea: "capability_registry",
      migrationKind: "policy_wrap",
      risk: "medium",
      priority: "medium",
      evidence: {
        approximateEntries: profile.domainCounts?.skills ?? 0,
      },
      rationale: "Skills are likely useful but must be wrapped by OpenClaw governance before use.",
    });
  }

  if (profile.presentDomains?.includes("qa") || profile.presentDomains?.includes("test")) {
    addCandidate({
      id: "verification-assets",
      capability: "verification_assets",
      sourceDomain: profile.presentDomains.includes("qa") ? "qa" : "test",
      targetArea: "milestone_checks",
      migrationKind: "test_port",
      risk: "low",
      priority: "medium",
      evidence: {
        qaEntries: profile.domainCounts?.qa ?? 0,
        testEntries: profile.domainCounts?.test ?? 0,
      },
      rationale: "Existing verification assets can strengthen milestone checks without importing runtime behavior.",
    });
  }

  return candidates;
}

function buildOpenClawMigrationMap() {
  const registry = buildWorkspaceRegistry();
  const items = registry.items.flatMap((workspace) => buildOpenClawMigrationCandidatesForWorkspace(workspace));
  return {
    registry: "openclaw-source-migration-map-v0",
    mode: "read-only",
    generatedAt: registry.generatedAt,
    sourceRegistry: registry.registry,
    roots: registry.roots,
    count: items.length,
    items,
    summary: {
      total: items.length,
      workspaces: new Set(items.map((item) => item.workspaceId)).size,
      byWorkspace: items.reduce((accumulator, item) => {
        accumulator[item.workspaceName] = (accumulator[item.workspaceName] ?? 0) + 1;
        return accumulator;
      }, {}),
      byTargetArea: items.reduce((accumulator, item) => {
        accumulator[item.targetArea] = (accumulator[item.targetArea] ?? 0) + 1;
        return accumulator;
      }, {}),
      byMigrationKind: items.reduce((accumulator, item) => {
        accumulator[item.migrationKind] = (accumulator[item.migrationKind] ?? 0) + 1;
        return accumulator;
      }, {}),
      byRisk: items.reduce((accumulator, item) => {
        accumulator[item.risk] = (accumulator[item.risk] ?? 0) + 1;
        return accumulator;
      }, {}),
      byPriority: items.reduce((accumulator, item) => {
        accumulator[item.priority] = (accumulator[item.priority] ?? 0) + 1;
        return accumulator;
      }, {}),
      governance: {
        mode: "migration_candidate_read_only",
        canReadFileContent: false,
        canMutate: false,
        canExecute: false,
        migrationStatus: "candidate_only",
      },
    },
  };
}

const OPENCLAW_MIGRATION_PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};
const OPENCLAW_MIGRATION_RISK_ORDER = {
  low: 0,
  medium: 1,
  high: 2,
};
const OPENCLAW_FIRST_WAVE_CAPABILITIES = new Set([
  "plugin_sdk",
  "core_source_patterns",
  "extension_catalog",
  "verification_assets",
]);

function migrationPlanActionForCandidate(candidate) {
  const actions = {
    extension_catalog: "Inventory extension entry points, design governed adapters, then register safe capability wrappers.",
    plugin_sdk: "Review SDK contracts, extract stable capability boundaries, then reimplement native OpenClaw contracts.",
    memory_host_sdk: "Review privacy and sovereignty boundaries before designing any native long-term-memory adapter.",
    ui_workspace: "Compare UI patterns with Observer needs, then absorb presentation ideas without importing runtime ownership.",
    core_source_patterns: "Review core orchestration patterns as design input, then reimplement compatible patterns natively.",
    documentation_canon: "Reconcile old source docs with the NixOS body canon and capture retained decisions.",
    agent_skills: "Classify skills by risk, wrap candidates behind policy, then expose only approved native capabilities.",
    verification_assets: "Port useful checks into milestone slices before migrating the matching runtime behavior.",
  };
  return actions[candidate.capability] ?? "Review candidate, document fit, then create a separately governed migration slice.";
}

function migrationAcceptanceForCandidate(candidate) {
  const base = [
    "source file contents remain hidden until a later explicit review step",
    "no source workspace mutation or command execution occurs during planning",
    "native OpenClaw governance remains the runtime owner",
  ];
  const byCapability = {
    extension_catalog: [
      "adapter design lists allowed capability IDs, risks, and approval gates",
      "Observer can show imported capability metadata before any execution path exists",
    ],
    plugin_sdk: [
      "contract review identifies stable interfaces and rejected external ownership assumptions",
      "native capability contract tests pass without depending on the source workspace at runtime",
    ],
    memory_host_sdk: [
      "privacy boundary and retention policy are documented before any state import",
      "memory access is gated by explicit OpenClaw governance",
    ],
    ui_workspace: [
      "Observer UX changes preserve current control and audit visibility",
      "UI code remains owned by this repository after absorption",
    ],
    core_source_patterns: [
      "design review records which orchestration patterns are accepted or rejected",
      "new core behavior ships behind targeted milestone checks",
    ],
    documentation_canon: [
      "conflicting terminology is reconciled into current project docs",
      "retained decisions are traceable to OpenClaw body sovereignty goals",
    ],
    agent_skills: [
      "each skill has a risk classification and policy wrapper before exposure",
      "no skill can execute outside OpenClaw governance",
    ],
    verification_assets: [
      "ported checks run as targeted milestone slices",
      "checks fail before the migrated behavior is implemented",
    ],
  };
  return [...base, ...(byCapability[candidate.capability] ?? [])];
}

function buildOpenClawMigrationPlan() {
  const map = buildOpenClawMigrationMap();
  const sortedCandidates = [...map.items].sort((left, right) => {
    const priorityDelta =
      (OPENCLAW_MIGRATION_PRIORITY_ORDER[left.priority] ?? 99)
      - (OPENCLAW_MIGRATION_PRIORITY_ORDER[right.priority] ?? 99);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    const riskDelta =
      (OPENCLAW_MIGRATION_RISK_ORDER[left.risk] ?? 99)
      - (OPENCLAW_MIGRATION_RISK_ORDER[right.risk] ?? 99);
    if (riskDelta !== 0) {
      return riskDelta;
    }
    return left.capability.localeCompare(right.capability);
  });
  const firstWave = sortedCandidates
    .filter((candidate) => OPENCLAW_FIRST_WAVE_CAPABILITIES.has(candidate.capability))
    .map((candidate, index) => ({
      sequence: index + 1,
      candidateId: candidate.id,
      workspaceId: candidate.workspaceId,
      workspaceName: candidate.workspaceName,
      workspacePath: candidate.workspacePath,
      capability: candidate.capability,
      sourceDomain: candidate.sourceDomain,
      targetArea: candidate.targetArea,
      migrationKind: candidate.migrationKind,
      risk: candidate.risk,
      priority: candidate.priority,
      status: "planned_not_imported",
      recommendedNextStep: migrationPlanActionForCandidate(candidate),
      acceptanceCriteria: migrationAcceptanceForCandidate(candidate),
      blockers: [
        "human design review not completed",
        "targeted milestone check not written",
        "source content review not explicitly approved",
      ],
      governance: {
        mode: "migration_plan_only",
        canReadFileContent: false,
        canMutate: false,
        canExecute: false,
        createsTask: false,
        createsApproval: false,
        requiresHumanApprovalBeforeImport: true,
        migrationStatus: "planned_not_imported",
      },
    }));

  return {
    registry: "openclaw-source-migration-plan-v0",
    mode: "plan-only",
    generatedAt: map.generatedAt,
    sourceRegistry: map.registry,
    sourceMode: map.mode,
    roots: map.roots,
    candidateCount: map.count,
    count: firstWave.length,
    items: firstWave,
    backlog: sortedCandidates
      .filter((candidate) => !OPENCLAW_FIRST_WAVE_CAPABILITIES.has(candidate.capability))
      .map((candidate) => ({
        candidateId: candidate.id,
        capability: candidate.capability,
        sourceDomain: candidate.sourceDomain,
        targetArea: candidate.targetArea,
        risk: candidate.risk,
        priority: candidate.priority,
        status: "candidate_only",
      })),
    summary: {
      total: firstWave.length,
      candidateCount: map.count,
      backlog: map.count - firstWave.length,
      byTargetArea: firstWave.reduce((accumulator, item) => {
        accumulator[item.targetArea] = (accumulator[item.targetArea] ?? 0) + 1;
        return accumulator;
      }, {}),
      byMigrationKind: firstWave.reduce((accumulator, item) => {
        accumulator[item.migrationKind] = (accumulator[item.migrationKind] ?? 0) + 1;
        return accumulator;
      }, {}),
      byRisk: firstWave.reduce((accumulator, item) => {
        accumulator[item.risk] = (accumulator[item.risk] ?? 0) + 1;
        return accumulator;
      }, {}),
      byPriority: firstWave.reduce((accumulator, item) => {
        accumulator[item.priority] = (accumulator[item.priority] ?? 0) + 1;
        return accumulator;
      }, {}),
      governance: {
        mode: "migration_plan_only",
        canReadFileContent: false,
        canMutate: false,
        canExecute: false,
        createsTask: false,
        createsApproval: false,
        migrationStatus: "planned_not_imported",
      },
    },
  };
}

function safeObjectKeys(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value).sort()
    : [];
}

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

function buildOpenClawFormalIntegrationReadiness() {
  const nativeRegistry = buildOpenClawNativePluginRegistryResponse();
  const migrationPlan = buildOpenClawMigrationPlan();
  const pluginSdkReview = buildOpenClawPluginSdkContractReview();
  const firstWavePluginSdk = migrationPlan.items.find((item) => item.capability === "plugin_sdk") ?? null;
  const pluginSdkReviewItem = pluginSdkReview.items.find((item) => item.capability === "plugin_sdk") ?? null;
  const registryGovernance = nativeRegistry.governance ?? {};
  const gates = [
    {
      id: "native_registry_valid",
      label: "Native plugin registry validates",
      required: true,
      status: nativeRegistry.validation.ok ? "passed" : "blocked",
      evidence: `issues=${nativeRegistry.validation.issues.length}`,
    },
    {
      id: "runtime_owner_locked",
      label: "Runtime owner remains OpenClawOnNixOS",
      required: true,
      status: nativeRegistry.runtimeOwner === "openclaw_on_nixos" ? "passed" : "blocked",
      evidence: `runtimeOwner=${nativeRegistry.runtimeOwner}`,
    },
    {
      id: "source_migration_plan_selected",
      label: "Plugin SDK is selected in first-wave migration plan",
      required: true,
      status: firstWavePluginSdk ? "passed" : "blocked",
      evidence: firstWavePluginSdk ? `status=${firstWavePluginSdk.status}` : "missing plugin_sdk first-wave item",
    },
    {
      id: "sdk_contract_review_complete",
      label: "Plugin SDK contract review exists without source import",
      required: true,
      status: pluginSdkReviewItem?.governance?.canReadSourceFileContent === false ? "passed" : "blocked",
      evidence: pluginSdkReviewItem ? `verdict=${pluginSdkReviewItem.verdict}` : "missing plugin SDK review item",
    },
    {
      id: "external_runtime_dependency_blocked",
      label: "External runtime dependency remains blocked",
      required: true,
      status: registryGovernance.externalRuntimeDependencyAllowed === false ? "passed" : "blocked",
      evidence: `externalRuntimeDependencyAllowed=${Boolean(registryGovernance.externalRuntimeDependencyAllowed)}`,
    },
    {
      id: "registration_execution_blocked",
      label: "Registration cannot execute plugin code",
      required: true,
      status: registryGovernance.canExecuteDuringRegistration === false ? "passed" : "blocked",
      evidence: `canExecuteDuringRegistration=${Boolean(registryGovernance.canExecuteDuringRegistration)}`,
    },
    {
      id: "adapter_implementation_pending",
      label: "Native adapter implementation is the next manual engineering step",
      required: false,
      status: "pending",
      evidence: "no runtime adapter is activated by readiness checks",
    },
  ];
  const requiredGates = gates.filter((gate) => gate.required);
  const passedRequired = requiredGates.filter((gate) => gate.status === "passed").length;
  const readyForFormalIntegration = passedRequired === requiredGates.length;

  return {
    registry: "openclaw-formal-integration-readiness-v0",
    mode: "readiness-only",
    generatedAt: new Date().toISOString(),
    sourceRegistries: [
      nativeRegistry.registry,
      migrationPlan.registry,
      pluginSdkReview.registry,
    ],
    status: readyForFormalIntegration ? "ready_for_native_adapter_implementation" : "blocked",
    readyForFormalIntegration,
    gates,
    summary: {
      totalGates: gates.length,
      requiredGates: requiredGates.length,
      passedRequired,
      blockedRequired: requiredGates.length - passedRequired,
      pendingOptional: gates.filter((gate) => gate.status === "pending").length,
      readyForFormalIntegration,
      canImportSourceContent: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      createsTask: false,
      createsApproval: false,
      nextAllowedWork: [
        "implement a native adapter shell inside OpenClawOnNixOS",
        "map reviewed SDK concepts into native capability contracts",
        "add adapter tests before any runtime activation",
      ],
      forbiddenWork: [
        "do not wholesale copy old OpenClaw source",
        "do not make old OpenClaw a runtime dependency",
        "do not execute old repository commands",
        "do not import source contents without explicit review",
      ],
    },
  };
}

function buildOpenClawNativePluginAdapterStatus() {
  const registry = buildOpenClawNativePluginRegistryResponse();
  return {
    registry: "openclaw-native-plugin-adapter-v0",
    mode: "native-adapter-shell",
    generatedAt: new Date().toISOString(),
    sourceRegistry: registry.registry,
    runtimeOwner: "openclaw_on_nixos",
    status: "read_only_and_approval_gated_mutation_adapters_ready",
    implementedCapabilities: [
      "sense.plugin.manifest_profile",
      "sense.openclaw.tool_catalog",
      "sense.openclaw.workspace_semantic_index",
      "sense.openclaw.workspace_symbol_lookup",
      "sense.openclaw.workspace_edit_target_select",
      "sense.openclaw.prompt_pack",
      "sense.openclaw.plugin_manifest_map",
      "plan.openclaw.plugin_capability",
      "plan.openclaw.plugin_search_web_adapter_contract",
      "plan.openclaw.plugin_search_web_runtime_preflight",
      "plan.openclaw.plugin_search_web_runtime_activation",
      "act.openclaw.workspace_text_write",
      "act.openclaw.workspace_patch_apply",
      "plan.plugin.runtime_preflight",
      "plan.plugin.runtime_adapter_contract",
    ],
    pendingCapabilities: ["act.plugin.capability.invoke"],
    summary: {
      implemented: 15,
      pending: 1,
      canReadManifestMetadata: true,
      canReadToolCatalogMetadata: true,
      canReadPluginManifestMapMetadata: true,
      canPlanPluginCapabilityAbsorption: true,
      canPlanSearchWebAdapterContract: true,
      canPlanSearchWebRuntimePreflight: true,
      canPlanSearchWebRuntimeActivation: true,
      canPlanNativeRuntimeAdapterContract: true,
      canReadWorkspaceSemanticMetadata: true,
      canExecuteWorkspaceSymbolLookup: true,
      canSelectWorkspaceEditTargets: true,
      canReadPromptSemantics: true,
      canCreateApprovalGatedWorkspaceTextWriteTasks: true,
      canCreateApprovalGatedWorkspacePatchTasks: true,
      canReadSourceFileContent: false,
      canMutate: true,
      canExecutePluginCode: false,
      canExecuteToolCode: false,
      canActivateRuntime: false,
      createsTask: true,
      createsApproval: true,
      requiresPolicyInvocation: true,
    },
    guardrails: [
      "adapter shell is native to OpenClawOnNixOS",
      "manifest profile reads only bounded package metadata from reviewed plugin SDK paths",
      "tool catalog adapter reads only bounded enhanced OpenClaw tool metadata and never imports legacy tools",
      "plugin manifest map reads only bounded extension manifest metadata and never exposes manifest bodies, auth env var names, or config schema bodies",
      "plugin capability planning derives governance gates from manifest metadata only and never imports, executes, or activates plugins",
      "search/web adapter contract shell maps selected manifest-derived candidates into native contracts without network access or runtime activation",
      "search/web runtime preflight builds a governed provider execution envelope while keeping network/provider activation disabled",
      "search/web runtime activation planning records the remaining gates before any provider/network execution can be enabled",
      "native plugin runtime adapter contract defines the sandbox loader boundary before any plugin module can be loaded",
      "workspace semantic index emits derived counts only and never exposes file contents",
      "runtime preflight builds a governed execution envelope without loading plugin modules",
      "source contents, README text, script bodies, dependency versions, plugin code execution, and runtime activation remain blocked",
      "mutating plugin invocation remains pending explicit adapter design and approval gates",
    ],
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

function buildNativePluginManifestProfile({ packagePath = null } = {}) {
  const { review, item } = selectReviewedPluginSdkPackage({ packagePath });
  const manifestPath = path.join(item.packagePath, "package.json");
  const manifest = readJsonFileIfPresent(manifestPath);
  if (!manifest) {
    throw new Error("Reviewed plugin SDK package does not include a readable package manifest.");
  }

  const nativeRegistry = createOpenClawNativePluginRegistry();
  const registryItem = nativeRegistry.items.find((entry) => entry.id === "openclaw.native.plugin-sdk") ?? null;
  const contract = registryItem?.contract ?? null;
  const exportKeys = typeof manifest.exports === "string"
    ? ["default"]
    : safeObjectKeys(manifest.exports);
  const scriptNames = safeObjectKeys(manifest.scripts);
  const dependencySummary = {
    dependencies: safeObjectKeys(manifest.dependencies).length,
    devDependencies: safeObjectKeys(manifest.devDependencies).length,
    peerDependencies: safeObjectKeys(manifest.peerDependencies).length,
  };

  return {
    ok: true,
    registry: "openclaw-native-plugin-adapter-v0",
    mode: "manifest-profile-only",
    generatedAt: new Date().toISOString(),
    sourceRegistry: review.registry,
    sourceMode: review.mode,
    adapterStatus: "native_shell_active_manifest_only",
    workspace: {
      id: item.workspaceId,
      name: item.workspaceName,
      path: item.workspacePath,
    },
    plugin: {
      id: registryItem?.id ?? "openclaw.native.plugin-sdk",
      contractVersion: contract?.contractVersion ?? null,
      packageName: typeof manifest.name === "string" ? manifest.name : null,
      private: manifest.private === true,
      hasVersion: typeof manifest.version === "string",
      hasMain: typeof manifest.main === "string",
      hasModule: typeof manifest.module === "string",
      hasTypes: typeof manifest.types === "string" || typeof manifest.typings === "string",
      hasExports: manifest.exports !== undefined,
      exportKeys,
      scriptNames,
      dependencySummary,
    },
    capabilities: (contract?.capabilities ?? []).map((capability) => ({
      id: capability.id,
      kind: capability.kind,
      risk: capability.risk,
      domains: capability.domains,
      approvalRequired: capability.approval?.required === true,
      runtimeOwner: capability.runtimeOwner,
    })),
    governance: {
      mode: "native_adapter_manifest_profile_only",
      runtimeOwner: "openclaw_on_nixos",
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      canMutate: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      createsTask: false,
      createsApproval: false,
      sourcePackagePathReviewed: true,
    },
  };
}

function classifyPluginManifestEntry(manifest = {}, relativePath = "") {
  const lower = `${manifest.id ?? ""} ${relativePath} ${safeObjectKeys(manifest.contracts).join(" ")}`.toLowerCase();
  if (/(memory|lancedb|wiki)/u.test(lower)) {
    return "memory";
  }
  if (/(search|web|browser|fetch|brave|duckduckgo|exa|firecrawl|tavily|perplexity|searxng|grok|xai|gemini|kimi|ollama)/u.test(lower)) {
    return "search_and_web";
  }
  if (/(image|video|music|tts|voice|speech|audio|media|runway|elevenlabs|fal|minimax)/u.test(lower)) {
    return "media";
  }
  if (/(chat|channel|discord|slack|telegram|zalo|whatsapp|matrix|signal|imessage|teams|line|feishu|qqbot)/u.test(lower)) {
    return "channels";
  }
  if (/(openai|anthropic|qwen|deepseek|mistral|groq|bedrock|litellm|openrouter|model|llm|provider)/u.test(lower)) {
    return "model_provider";
  }
  if (/(skill|agent|codex|opencode|kilocode|thread|task)/u.test(lower)) {
    return "agent_workflow";
  }
  return "general_plugin";
}

function countNestedPropertyKeys(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return 0;
  }
  const properties = value.properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return 0;
  }
  return safeObjectKeys(properties).length;
}

function summarisePluginManifest(rootPath, absolutePath, manifest) {
  const relativePath = path.relative(rootPath, absolutePath).replaceAll(path.sep, "/");
  const stats = safeStat(absolutePath);
  const contractKeys = safeObjectKeys(manifest.contracts);
  const providerAuthEnvVars = manifest.providerAuthEnvVars && typeof manifest.providerAuthEnvVars === "object"
    ? Object.values(manifest.providerAuthEnvVars).reduce((total, value) => total + (Array.isArray(value) ? value.length : 0), 0)
    : 0;
  const channelEnvVars = manifest.channelEnvVars && typeof manifest.channelEnvVars === "object"
    ? Object.values(manifest.channelEnvVars).reduce((total, value) => total + (Array.isArray(value) ? value.length : 0), 0)
    : 0;
  const uiHints = manifest.uiHints && typeof manifest.uiHints === "object" && !Array.isArray(manifest.uiHints)
    ? Object.values(manifest.uiHints)
    : [];
  const providerEndpoints = Array.isArray(manifest.providerEndpoints) ? manifest.providerEndpoints : [];
  const configSchemaPropertyCount = countNestedPropertyKeys(manifest.configSchema);
  const category = classifyPluginManifestEntry(manifest, relativePath);

  return {
    id: typeof manifest.id === "string" ? manifest.id : path.basename(path.dirname(absolutePath)),
    relativePath,
    extensionName: path.basename(path.dirname(absolutePath)),
    category,
    enabledByDefault: manifest.enabledByDefault === true,
    manifestSizeBytes: stats?.size ?? null,
    contractKeys,
    contractCount: contractKeys.length,
    providerCount: Array.isArray(manifest.providers) ? manifest.providers.length : 0,
    providerEndpointCount: providerEndpoints.length,
    providerEndpointHostCount: providerEndpoints.reduce((total, endpoint) => total + (Array.isArray(endpoint?.hosts) ? endpoint.hosts.length : 0), 0),
    channelCount: Array.isArray(manifest.channels) ? manifest.channels.length : 0,
    toolContractCount: Array.isArray(manifest.contracts?.tools) ? manifest.contracts.tools.length : 0,
    uiHintCount: uiHints.length,
    sensitiveUiHintCount: uiHints.filter((hint) => hint?.sensitive === true).length,
    providerAuthEnvVarCount: providerAuthEnvVars,
    channelEnvVarCount: channelEnvVars,
    syntheticAuthRefCount: Array.isArray(manifest.syntheticAuthRefs) ? manifest.syntheticAuthRefs.length : 0,
    providerAuthChoiceCount: Array.isArray(manifest.providerAuthChoices) ? manifest.providerAuthChoices.length : 0,
    configSchemaPropertyCount,
    hasConfigSchema: Boolean(manifest.configSchema),
    hasConfigContracts: Boolean(manifest.configContracts),
    contentRead: true,
    contentExposed: false,
    manifestBodyExposed: false,
    authMaterialExposed: false,
  };
}

function buildOpenClawPluginManifestMap({ workspacePath = null, query = null, limit = 80 } = {}) {
  const { registry, item } = selectOpenClawToolCatalogWorkspace({ workspacePath });
  const implementation = buildOpenClawNativePluginSdkContractImplementation({
    packagePath: path.join(item.path, "packages", "plugin-sdk"),
  });
  const capability = implementation.contract?.capabilities?.find((entry) => entry.id === "sense.openclaw.plugin_manifest_map") ?? null;
  const extensionsRoot = path.join(item.path, "extensions");
  const rootStats = safeStat(extensionsRoot);
  const safeLimit = normalisePositiveLimit(limit, 80, 200);
  const safeQuery = typeof query === "string" && query.trim() ? query.trim().toLowerCase() : null;
  const manifests = [];

  if (rootStats?.isDirectory()) {
    let entries = [];
    try {
      entries = readdirSync(extensionsRoot, { withFileTypes: true });
    } catch {
      entries = [];
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isDirectory() || TOOL_CATALOG_IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      const manifestPath = path.join(extensionsRoot, entry.name, "openclaw.plugin.json");
      const manifest = readJsonFileIfPresent(manifestPath);
      if (!manifest) {
        continue;
      }
      const summary = summarisePluginManifest(item.path, manifestPath, manifest);
      if (safeQuery && ![
        summary.id,
        summary.extensionName,
        summary.category,
        ...summary.contractKeys,
      ].some((value) => String(value ?? "").toLowerCase().includes(safeQuery))) {
        continue;
      }
      manifests.push(summary);
      if (manifests.length >= safeLimit) {
        break;
      }
    }
  }

  const byCategory = manifests.reduce((accumulator, manifest) => {
    accumulator[manifest.category] = (accumulator[manifest.category] ?? 0) + 1;
    return accumulator;
  }, {});
  const contractKeyCounts = manifests.reduce((accumulator, manifest) => {
    for (const key of manifest.contractKeys) {
      accumulator[key] = (accumulator[key] ?? 0) + 1;
    }
    return accumulator;
  }, {});

  return {
    ok: true,
    registry: "openclaw-plugin-manifest-map-v0",
    mode: "read-only-plugin-manifest-absorption",
    generatedAt: new Date().toISOString(),
    sourceRegistries: [
      registry.registry,
      implementation.registry,
      "openclaw-extension-manifests",
    ],
    capability: {
      id: capability?.id ?? "sense.openclaw.plugin_manifest_map",
      kind: capability?.kind ?? "sense",
      risk: capability?.risk ?? "low",
      approvalRequired: capability?.approval?.required === true,
      runtimeOwner: capability?.runtimeOwner ?? "openclaw_on_nixos",
    },
    workspace: {
      id: item.id,
      name: item.name,
      path: item.path,
    },
    roots: {
      extensions: path.relative(item.path, extensionsRoot).replaceAll(path.sep, "/"),
    },
    filter: {
      query: safeQuery,
      limit: safeLimit,
    },
    manifests,
    categories: Object.entries(byCategory)
      .map(([category, count]) => ({ category, count }))
      .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category)),
    contractKeyCounts,
    summary: {
      manifestCount: manifests.length,
      categoryCount: Object.keys(byCategory).length,
      enabledByDefaultCount: manifests.filter((manifest) => manifest.enabledByDefault).length,
      providerCount: manifests.reduce((total, manifest) => total + manifest.providerCount, 0),
      providerEndpointCount: manifests.reduce((total, manifest) => total + manifest.providerEndpointCount, 0),
      channelCount: manifests.reduce((total, manifest) => total + manifest.channelCount, 0),
      toolContractCount: manifests.reduce((total, manifest) => total + manifest.toolContractCount, 0),
      sensitiveUiHintCount: manifests.reduce((total, manifest) => total + manifest.sensitiveUiHintCount, 0),
      authReferenceCount: manifests.reduce((total, manifest) => total + manifest.providerAuthEnvVarCount + manifest.channelEnvVarCount + manifest.syntheticAuthRefCount, 0),
      configSchemaCount: manifests.filter((manifest) => manifest.hasConfigSchema).length,
      canReadManifestMetadata: true,
      exposesManifestBodies: false,
      exposesAuthEnvVarNames: false,
      exposesConfigSchemaBodies: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
    },
    governance: {
      mode: "plugin_manifest_map_read_only",
      runtimeOwner: "openclaw_on_nixos",
      sourceRegistry: "openclaw-extension-manifests",
      canReadManifestMetadata: true,
      canReadManifestBody: true,
      exposesManifestBodies: false,
      exposesAuthEnvVarNames: false,
      exposesConfigSchemaBodies: false,
      exposesSourceFileContent: false,
      exposesScriptBodies: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
    },
  };
}

function derivePluginCapabilityPlanRisk(manifest) {
  if ((manifest.providerEndpointCount ?? 0) > 0 || (manifest.channelCount ?? 0) > 0) {
    return "high";
  }
  if ((manifest.providerCount ?? 0) > 0 || (manifest.authReferenceCount ?? 0) > 0 || (manifest.toolContractCount ?? 0) > 0) {
    return "medium";
  }
  return "low";
}

function derivePluginCapabilityPlanKind(manifest) {
  if (manifest.category === "channels" || manifest.category === "media") {
    return "act";
  }
  if (manifest.category === "memory" || manifest.category === "search_and_web" || manifest.category === "model_provider") {
    return "plan";
  }
  return "sense";
}

function buildOpenClawPluginCapabilityPlan({ workspacePath = null, query = null, limit = 40 } = {}) {
  const manifestMap = buildOpenClawPluginManifestMap({ workspacePath, query, limit });
  const nativeRegistry = createOpenClawNativePluginRegistry();
  const pluginItem = nativeRegistry.items.find((entry) => entry.id === "openclaw.native.plugin-sdk") ?? null;
  const capability = pluginItem?.contract?.capabilities?.find((entry) => entry.id === "plan.openclaw.plugin_capability") ?? null;
  const manifests = Array.isArray(manifestMap.manifests) ? manifestMap.manifests : [];
  const safeLimit = normalisePositiveLimit(limit, 40, 120);
  const candidates = manifests.slice(0, safeLimit).map((manifest) => {
    const authReferenceCount = (manifest.providerAuthEnvVarCount ?? 0) + (manifest.channelEnvVarCount ?? 0) + (manifest.syntheticAuthRefCount ?? 0);
    const risk = derivePluginCapabilityPlanRisk({ ...manifest, authReferenceCount });
    const kind = derivePluginCapabilityPlanKind(manifest);
    const crossBoundary = manifest.providerEndpointCount > 0 || manifest.channelCount > 0 || manifest.category === "search_and_web";
    const requiresRuntimeAdapter = kind !== "sense" || manifest.toolContractCount > 0 || manifest.providerCount > 0 || manifest.channelCount > 0;
    const requiresApproval = risk === "high" || crossBoundary || requiresRuntimeAdapter;
    const candidateId = `plan.${String(manifest.id ?? manifest.extensionName ?? "plugin").replace(/[^a-zA-Z0-9_.:-]+/gu, "_")}`;
    return {
      id: candidateId,
      manifestId: manifest.id,
      extensionName: manifest.extensionName,
      sourceManifestPath: manifest.relativePath,
      category: manifest.category,
      proposedCapability: {
        id: candidateId,
        kind,
        risk,
        domains: crossBoundary ? ["body_internal", "cross_boundary"] : ["body_internal"],
        runtimeOwner: "openclaw_on_nixos",
        approvalRequired: requiresApproval,
        auditLedger: "capability_history",
      },
      signals: {
        contractKeys: manifest.contractKeys,
        contractCount: manifest.contractCount,
        providerCount: manifest.providerCount,
        providerEndpointCount: manifest.providerEndpointCount,
        providerEndpointHostCount: manifest.providerEndpointHostCount,
        channelCount: manifest.channelCount,
        toolContractCount: manifest.toolContractCount,
        authReferenceCount,
        configSchemaPropertyCount: manifest.configSchemaPropertyCount,
        enabledByDefault: manifest.enabledByDefault,
      },
      gates: [
        {
          id: "manifest_metadata_absorbed",
          required: true,
          status: "passed",
          evidence: `manifest=${manifest.relativePath}`,
        },
        {
          id: "native_capability_contract_required",
          required: true,
          status: "blocked",
          evidence: "candidate is not yet registered as a native capability contract",
        },
        {
          id: "runtime_adapter_required",
          required: requiresRuntimeAdapter,
          status: requiresRuntimeAdapter ? "blocked" : "not_required",
          evidence: requiresRuntimeAdapter ? "provider/tool/channel contracts need native adapter implementation" : "metadata-only candidate",
        },
        {
          id: "explicit_approval_required",
          required: requiresApproval,
          status: requiresApproval ? "blocked" : "not_required",
          evidence: requiresApproval ? `risk=${risk}; crossBoundary=${crossBoundary}; runtimeAdapter=${requiresRuntimeAdapter}` : "read-only body-internal candidate",
        },
      ],
      status: requiresRuntimeAdapter || requiresApproval ? "blocked_pending_native_adapter" : "planned_metadata_only",
      canActivateRuntime: false,
      canExecutePluginCode: false,
      canImportModule: false,
      contentExposed: false,
    };
  });
  const countsByRisk = candidates.reduce((accumulator, candidate) => {
    accumulator[candidate.proposedCapability.risk] = (accumulator[candidate.proposedCapability.risk] ?? 0) + 1;
    return accumulator;
  }, {});
  const countsByKind = candidates.reduce((accumulator, candidate) => {
    accumulator[candidate.proposedCapability.kind] = (accumulator[candidate.proposedCapability.kind] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    ok: true,
    registry: "openclaw-plugin-capability-plan-v0",
    mode: "manifest-derived-plan-only",
    generatedAt: new Date().toISOString(),
    sourceRegistries: [
      manifestMap.registry,
      nativeRegistry.registry,
      capability?.id ?? "plan.openclaw.plugin_capability",
    ],
    capability: {
      id: capability?.id ?? "plan.openclaw.plugin_capability",
      kind: capability?.kind ?? "plan",
      risk: capability?.risk ?? "low",
      approvalRequired: capability?.approval?.required === true,
      runtimeOwner: capability?.runtimeOwner ?? "openclaw_on_nixos",
    },
    workspace: manifestMap.workspace,
    filter: manifestMap.filter,
    candidates,
    summary: {
      candidateCount: candidates.length,
      blockedCandidates: candidates.filter((candidate) => candidate.status === "blocked_pending_native_adapter").length,
      metadataOnlyCandidates: candidates.filter((candidate) => candidate.status === "planned_metadata_only").length,
      requiresApproval: candidates.filter((candidate) => candidate.proposedCapability.approvalRequired).length,
      requiresRuntimeAdapter: candidates.filter((candidate) => candidate.gates.some((gate) => gate.id === "runtime_adapter_required" && gate.required)).length,
      byRisk: countsByRisk,
      byKind: countsByKind,
      canReadManifestMetadata: true,
      exposesManifestBodies: false,
      exposesAuthEnvVarNames: false,
      exposesConfigSchemaBodies: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      nextAllowedWork: [
        "select one blocked candidate for native adapter design",
        "write native contract tests before registering candidate capabilities",
        "keep runtime activation behind future approval-gated tasks",
      ],
    },
    governance: {
      mode: "plugin_capability_manifest_derived_plan_only",
      runtimeOwner: "openclaw_on_nixos",
      sourceRegistry: manifestMap.registry,
      canReadManifestMetadata: true,
      exposesManifestBodies: false,
      exposesAuthEnvVarNames: false,
      exposesConfigSchemaBodies: false,
      exposesSourceFileContent: false,
      exposesScriptBodies: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      requiresExplicitApprovalBeforeExecution: true,
      requiresNativeAdapterBeforeRuntimeActivation: true,
    },
  };
}

function buildOpenClawPluginCandidateContractTests({
  workspacePath = null,
  category = "search_and_web",
  query = null,
  limit = 8,
} = {}) {
  const safeCategory = typeof category === "string" && category.trim()
    ? category.trim()
    : "search_and_web";
  const safeLimit = normalisePositiveLimit(limit, 8, 40);
  const capabilityPlan = buildOpenClawPluginCapabilityPlan({
    workspacePath,
    query: query ?? safeCategory,
    limit: 80,
  });
  const candidates = (Array.isArray(capabilityPlan.candidates) ? capabilityPlan.candidates : [])
    .filter((candidate) => candidate.category === safeCategory)
    .slice(0, safeLimit);
  const tests = candidates.flatMap((candidate) => {
    const proposed = candidate.proposedCapability ?? {};
    const gates = Array.isArray(candidate.gates) ? candidate.gates : [];
    const runtimeGate = gates.find((gate) => gate.id === "runtime_adapter_required") ?? null;
    const approvalGate = gates.find((gate) => gate.id === "explicit_approval_required") ?? null;
    const nativeContractGate = gates.find((gate) => gate.id === "native_capability_contract_required") ?? null;
    const sourcePrivacyLocked = candidate.contentExposed === false
      && candidate.canImportModule === false
      && candidate.canExecutePluginCode === false
      && candidate.canActivateRuntime === false;
    const expectedCrossBoundaryApproval = safeCategory === "search_and_web";

    return [
      {
        id: `${candidate.id}:candidate_selected_from_manifest_plan`,
        candidateId: candidate.id,
        manifestId: candidate.manifestId,
        required: true,
        status: candidate.status === "blocked_pending_native_adapter" ? "passed" : "failed",
        evidence: `category=${candidate.category}; status=${candidate.status}`,
      },
      {
        id: `${candidate.id}:native_contract_fields_declared`,
        candidateId: candidate.id,
        manifestId: candidate.manifestId,
        required: true,
        status: typeof proposed.id === "string"
          && proposed.id.length > 0
          && typeof proposed.kind === "string"
          && typeof proposed.risk === "string"
          && Array.isArray(proposed.domains)
          && proposed.domains.includes("body_internal")
          && proposed.runtimeOwner === "openclaw_on_nixos"
          && typeof proposed.approvalRequired === "boolean"
          && proposed.auditLedger === "capability_history"
          ? "passed"
          : "failed",
        evidence: `capability=${proposed.id ?? "missing"}; kind=${proposed.kind ?? "missing"}; risk=${proposed.risk ?? "missing"}`,
      },
      {
        id: `${candidate.id}:runtime_adapter_gate_blocks_activation`,
        candidateId: candidate.id,
        manifestId: candidate.manifestId,
        required: true,
        status: runtimeGate?.required === true
          && runtimeGate.status === "blocked"
          && nativeContractGate?.status === "blocked"
          ? "passed"
          : "failed",
        evidence: `runtimeGate=${runtimeGate?.status ?? "missing"}; nativeContractGate=${nativeContractGate?.status ?? "missing"}`,
      },
      {
        id: `${candidate.id}:policy_approval_boundary_declared`,
        candidateId: candidate.id,
        manifestId: candidate.manifestId,
        required: true,
        status: expectedCrossBoundaryApproval
          ? proposed.approvalRequired === true
            && proposed.domains?.includes("cross_boundary")
            && approvalGate?.required === true
            && approvalGate.status === "blocked"
            ? "passed"
            : "failed"
          : "passed",
        evidence: `approval=${Boolean(proposed.approvalRequired)}; domains=${(proposed.domains ?? []).join(",")}; approvalGate=${approvalGate?.status ?? "missing"}`,
      },
      {
        id: `${candidate.id}:source_privacy_boundary_locked`,
        candidateId: candidate.id,
        manifestId: candidate.manifestId,
        required: true,
        status: sourcePrivacyLocked ? "passed" : "failed",
        evidence: `contentExposed=${Boolean(candidate.contentExposed)}; import=${Boolean(candidate.canImportModule)}; execute=${Boolean(candidate.canExecutePluginCode)}; activate=${Boolean(candidate.canActivateRuntime)}`,
      },
      {
        id: `${candidate.id}:manifest_signals_are_metadata_only`,
        candidateId: candidate.id,
        manifestId: candidate.manifestId,
        required: true,
        status: typeof candidate.manifestId === "string"
          && candidate.manifestId.length > 0
          && candidate.category === safeCategory
          && Array.isArray(candidate.signals?.contractKeys)
          && Number.isFinite(candidate.signals?.providerCount)
          && Number.isFinite(candidate.signals?.providerEndpointCount)
          ? "passed"
          : "failed",
        evidence: `contracts=${(candidate.signals?.contractKeys ?? []).join(",")}; providers=${candidate.signals?.providerCount ?? 0}; endpoints=${candidate.signals?.providerEndpointCount ?? 0}`,
      },
    ];
  });
  const requiredTests = tests.filter((test) => test.required);
  const passedRequired = requiredTests.filter((test) => test.status === "passed").length;
  const failedRequired = requiredTests.length - passedRequired;

  return {
    ok: candidates.length > 0 && failedRequired === 0,
    registry: "openclaw-plugin-candidate-contract-tests-v0",
    mode: "candidate-native-adapter-contract-tests",
    generatedAt: new Date().toISOString(),
    sourceRegistries: [
      capabilityPlan.registry,
      "openclaw-plugin-manifest-map-v0",
    ],
    workspace: capabilityPlan.workspace,
    filter: {
      category: safeCategory,
      query: typeof query === "string" && query.trim() ? query.trim() : null,
      limit: safeLimit,
    },
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      manifestId: candidate.manifestId,
      extensionName: candidate.extensionName,
      sourceManifestPath: candidate.sourceManifestPath,
      category: candidate.category,
      proposedCapability: candidate.proposedCapability,
      signals: candidate.signals,
      gates: candidate.gates,
      status: candidate.status,
      canActivateRuntime: false,
      canExecutePluginCode: false,
      canImportModule: false,
      contentExposed: false,
    })),
    adapterContracts: candidates.map((candidate) => ({
      candidateId: candidate.id,
      manifestId: candidate.manifestId,
      category: candidate.category,
      proposedCapabilityId: candidate.proposedCapability?.id ?? candidate.id,
      expectedNativeSurfaces: [
        "native_capability_contract",
        "runtime_adapter_boundary",
        "policy_approval_gate",
        "capability_history_audit_binding",
        "observer_visibility",
      ],
      mustDenyBeforeFutureImplementation: [
        "import_old_openclaw_module",
        "execute_plugin_code",
        "activate_plugin_runtime",
        "expose_manifest_body",
        "expose_auth_env_var_names",
        "create_task_without_explicit_approval",
      ],
      runtimeOwner: "openclaw_on_nixos",
      approvalRequired: candidate.proposedCapability?.approvalRequired === true,
      auditLedger: candidate.proposedCapability?.auditLedger ?? "capability_history",
      implementationStatus: "contract_tests_ready_runtime_adapter_pending",
    })),
    tests,
    summary: {
      selectedCategory: safeCategory,
      candidateCount: candidates.length,
      adapterContractCount: candidates.length,
      totalTests: tests.length,
      requiredTests: requiredTests.length,
      passedRequired,
      failedRequired,
      nativeAdapterContractTestsReady: candidates.length > 0 && failedRequired === 0,
      runtimeAdapterImplemented: false,
      requiresApproval: candidates.filter((candidate) => candidate.proposedCapability?.approvalRequired === true).length,
      crossBoundaryCandidates: candidates.filter((candidate) => candidate.proposedCapability?.domains?.includes("cross_boundary")).length,
      canReadManifestMetadata: true,
      exposesManifestBodies: false,
      exposesAuthEnvVarNames: false,
      exposesConfigSchemaBodies: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      nextAllowedWork: [
        "implement the selected candidate as a native OpenClawOnNixOS adapter contract",
        "keep runtime execution behind explicit approval-gated task materialization",
        "add preflight and runtime activation gates only after contract tests stay green",
      ],
    },
    governance: {
      mode: "plugin_candidate_contract_tests_read_only",
      runtimeOwner: "openclaw_on_nixos",
      sourceRegistry: capabilityPlan.registry,
      selectedCategory: safeCategory,
      canReadManifestMetadata: true,
      exposesManifestBodies: false,
      exposesAuthEnvVarNames: false,
      exposesConfigSchemaBodies: false,
      exposesSourceFileContent: false,
      exposesScriptBodies: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      requiresExplicitApprovalBeforeExecution: true,
      requiresNativeAdapterBeforeRuntimeActivation: true,
    },
  };
}

function buildOpenClawPluginSearchWebAdapterContract({
  workspacePath = null,
  query = null,
  limit = 8,
} = {}) {
  const contractTests = buildOpenClawPluginCandidateContractTests({
    workspacePath,
    category: "search_and_web",
    query,
    limit,
  });
  const candidates = Array.isArray(contractTests.candidates) ? contractTests.candidates : [];
  const providerContracts = candidates.map((candidate) => {
    const proposed = candidate.proposedCapability ?? {};
    const signals = candidate.signals ?? {};
    const hasFetchSignal = (signals.contractKeys ?? [])
      .some((key) => /(fetch|browser|web)/iu.test(String(key)));
    const operationSet = [
      "search.query",
      hasFetchSignal ? "web.fetch_metadata" : null,
    ].filter(Boolean);

    return {
      id: `openclaw.search_web.${String(candidate.manifestId ?? candidate.extensionName ?? "candidate").replace(/[^a-zA-Z0-9_.:-]+/gu, "_")}`,
      candidateId: candidate.id,
      manifestId: candidate.manifestId,
      extensionName: candidate.extensionName,
      sourceManifestPath: candidate.sourceManifestPath,
      category: candidate.category,
      proposedCapabilityId: proposed.id ?? candidate.id,
      operations: operationSet,
      contractKeys: signals.contractKeys ?? [],
      policy: {
        domain: "cross_boundary",
        risk: proposed.risk ?? "medium",
        requiresApproval: true,
        requiresFreshApprovalForExecution: true,
      },
      audit: {
        required: true,
        ledger: proposed.auditLedger ?? "capability_history",
      },
      runtime: {
        owner: "openclaw_on_nixos",
        adapterId: "openclaw.search_web.native-adapter",
        implementationState: "contract_shell_ready_runtime_disabled",
        canReadManifestMetadata: true,
        canResolveProviderMetadata: true,
        canUseNetwork: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
      },
      privacy: {
        manifestBodyExposed: false,
        authEnvVarNamesExposed: false,
        endpointHostsExposed: false,
        configSchemaBodyExposed: false,
        sourceFileContentExposed: false,
      },
      futureTaskBoundary: {
        requiredBeforeNetworkUse: true,
        requiresExplicitApproval: true,
        createsTaskNow: false,
        createsApprovalNow: false,
      },
    };
  });
  const contractChecks = providerContracts.flatMap((contract) => ([
    {
      id: `${contract.id}:native_adapter_shell_declared`,
      providerContractId: contract.id,
      required: true,
      status: contract.runtime.adapterId === "openclaw.search_web.native-adapter"
        && contract.runtime.owner === "openclaw_on_nixos"
        ? "passed"
        : "failed",
      evidence: `adapter=${contract.runtime.adapterId}; owner=${contract.runtime.owner}`,
    },
    {
      id: `${contract.id}:cross_boundary_policy_locked`,
      providerContractId: contract.id,
      required: true,
      status: contract.policy.domain === "cross_boundary"
        && contract.policy.requiresApproval === true
        && contract.policy.requiresFreshApprovalForExecution === true
        ? "passed"
        : "failed",
      evidence: `domain=${contract.policy.domain}; approval=${Boolean(contract.policy.requiresApproval)}`,
    },
    {
      id: `${contract.id}:runtime_execution_blocked`,
      providerContractId: contract.id,
      required: true,
      status: contract.runtime.canUseNetwork === false
        && contract.runtime.canImportModule === false
        && contract.runtime.canExecutePluginCode === false
        && contract.runtime.canActivateRuntime === false
        ? "passed"
        : "failed",
      evidence: `network=${Boolean(contract.runtime.canUseNetwork)}; import=${Boolean(contract.runtime.canImportModule)}; execute=${Boolean(contract.runtime.canExecutePluginCode)}; activate=${Boolean(contract.runtime.canActivateRuntime)}`,
    },
    {
      id: `${contract.id}:privacy_boundary_locked`,
      providerContractId: contract.id,
      required: true,
      status: contract.privacy.manifestBodyExposed === false
        && contract.privacy.authEnvVarNamesExposed === false
        && contract.privacy.endpointHostsExposed === false
        && contract.privacy.configSchemaBodyExposed === false
        && contract.privacy.sourceFileContentExposed === false
        ? "passed"
        : "failed",
      evidence: "manifest/auth/endpoints/schema/source are redacted",
    },
  ]));
  const requiredChecks = contractChecks.filter((check) => check.required);
  const passedRequired = requiredChecks.filter((check) => check.status === "passed").length;
  const failedRequired = requiredChecks.length - passedRequired;

  return {
    ok: contractTests.ok === true && providerContracts.length > 0 && failedRequired === 0,
    registry: "openclaw-plugin-search-web-adapter-contract-v0",
    mode: "native-search-web-adapter-contract-shell",
    generatedAt: new Date().toISOString(),
    sourceRegistries: [
      contractTests.registry,
      "openclaw-plugin-capability-plan-v0",
      "openclaw-plugin-manifest-map-v0",
    ],
    workspace: contractTests.workspace,
    adapter: {
      id: "openclaw.search_web.native-adapter",
      title: "Native OpenClaw Search/Web Adapter Contract",
      runtimeOwner: "openclaw_on_nixos",
      status: "contract_shell_ready_runtime_disabled",
      selectedCategory: "search_and_web",
      canReadManifestMetadata: true,
      canResolveProviderMetadata: true,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      createsTask: false,
      createsApproval: false,
    },
    providerContracts,
    contractChecks,
    summary: {
      selectedCategory: "search_and_web",
      providerContractCount: providerContracts.length,
      operationCount: providerContracts.reduce((total, contract) => total + contract.operations.length, 0),
      requiredChecks: requiredChecks.length,
      passedRequired,
      failedRequired,
      adapterContractReady: providerContracts.length > 0 && failedRequired === 0,
      runtimeAdapterImplemented: false,
      requiresApproval: providerContracts.filter((contract) => contract.policy.requiresApproval === true).length,
      crossBoundaryContracts: providerContracts.filter((contract) => contract.policy.domain === "cross_boundary").length,
      canReadManifestMetadata: true,
      exposesManifestBodies: false,
      exposesAuthEnvVarNames: false,
      exposesEndpointHosts: false,
      exposesConfigSchemaBodies: false,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      nextAllowedWork: [
        "materialize search/web adapter invocations only as approval-gated task drafts",
        "add dry-run/preflight envelopes for network-bound search/web operations",
        "keep provider runtime execution disabled until explicit approval and sandbox boundaries exist",
      ],
    },
    governance: {
      mode: "plugin_search_web_adapter_contract_shell",
      runtimeOwner: "openclaw_on_nixos",
      sourceRegistry: contractTests.registry,
      selectedCategory: "search_and_web",
      canReadManifestMetadata: true,
      exposesManifestBodies: false,
      exposesAuthEnvVarNames: false,
      exposesEndpointHosts: false,
      exposesConfigSchemaBodies: false,
      exposesSourceFileContent: false,
      exposesScriptBodies: false,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      requiresExplicitApprovalBeforeNetworkUse: true,
      requiresNativeAdapterBeforeRuntimeActivation: true,
    },
  };
}

function findSearchWebProviderContract(adapterContract, providerContractId = null) {
  const providerContracts = Array.isArray(adapterContract.providerContracts) ? adapterContract.providerContracts : [];
  if (providerContracts.length === 0) {
    throw new Error("No search/web provider contract is available for task materialization.");
  }

  if (typeof providerContractId === "string" && providerContractId.trim()) {
    const requested = providerContractId.trim();
    const match = providerContracts.find((contract) => (
      contract.id === requested
      || contract.candidateId === requested
      || contract.manifestId === requested
      || contract.proposedCapabilityId === requested
    ));
    if (!match) {
      throw new Error("Requested providerContractId is not part of the search/web adapter contract.");
    }
    return match;
  }

  return providerContracts[0];
}

function buildOpenClawPluginSearchWebAdapterTaskDraft({
  workspacePath = null,
  providerContractId = null,
  query = "openclaw native integration",
  limit = 8,
} = {}) {
  const adapterContract = buildOpenClawPluginSearchWebAdapterContract({ workspacePath, limit });
  const providerContract = findSearchWebProviderContract(adapterContract, providerContractId);
  const safeQuery = typeof query === "string" && query.trim()
    ? query.trim().slice(0, 160)
    : "openclaw native integration";
  const queryDigest = createHash("sha256").update(safeQuery).digest("hex").slice(0, 16);
  const now = new Date().toISOString();
  const policyRequest = {
    intent: "plugin.search_web.invoke",
    domain: "cross_boundary",
    risk: providerContract.policy?.risk ?? "medium",
    requiresApproval: true,
    approved: false,
    providerContractId: providerContract.id,
    tags: ["openclaw_search_web_adapter", "explicit_approval_required", "network_deferred"],
  };
  const policyDecision = {
    id: randomUUID(),
    at: now,
    engine: "openclaw-plugin-search-web-adapter-task-v0",
    stage: "plugin_search_web.task.materialize",
    subject: {
      taskId: null,
      type: "openclaw_search_web_adapter_invocation",
      goal: `Prepare approved search/web adapter invocation for ${providerContract.manifestId}`,
      targetUrl: null,
      intent: policyRequest.intent,
    },
    domain: policyRequest.domain,
    risk: policyRequest.risk,
    decision: "require_approval",
    reason: "search_web_adapter_invocation_requires_explicit_user_approval_before_network_use",
    approved: false,
    autonomyMode,
    autonomous: false,
  };
  const plan = {
    planId: `plan-${randomUUID()}`,
    strategy: "openclaw-search-web-adapter-v0",
    planner: "openclaw-plugin-search-web-adapter-task-v0",
    capabilityAware: true,
    status: "planned",
    goal: `Prepare approved search/web adapter invocation for ${providerContract.manifestId}`,
    targetUrl: null,
    intent: policyRequest.intent,
    createdAt: now,
    updatedAt: now,
    capabilitySummary: {
      total: 3,
      approvalGates: 2,
      ids: [
        "plan.openclaw.plugin_search_web_adapter_contract",
        "govern.policy.evaluate",
        "boundary.cross_domain.approval",
      ],
      byRisk: {
        low: 1,
        [policyRequest.risk]: 2,
      },
    },
    steps: [
      {
        id: "step-review-search-web-contract",
        kind: "openclaw.plugin.search_web_contract",
        phase: "reviewing_search_web_contract",
        title: "Review native search/web provider contract",
        status: "pending",
        capabilityId: "plan.openclaw.plugin_search_web_adapter_contract",
        risk: "low",
        governance: "audit_only",
        requiresApproval: false,
        params: {
          providerContractId: providerContract.id,
          manifestId: providerContract.manifestId,
        },
      },
      {
        id: "step-user-approval",
        kind: "approval.gate",
        phase: "waiting_for_approval",
        title: "Wait for explicit user approval before any network-bound search/web use",
        status: "pending",
        capabilityId: "govern.policy.evaluate",
        risk: policyRequest.risk,
        governance: "require_approval",
        requiresApproval: true,
      },
      {
        id: "step-defer-network-provider-execution",
        kind: "plugin.search_web.invoke",
        phase: "network_provider_deferred",
        title: "Defer search/web provider execution until runtime preflight exists",
        status: "pending",
        capabilityId: "boundary.cross_domain.approval",
        risk: policyRequest.risk,
        governance: "require_approval",
        requiresApproval: true,
        params: {
          providerContractId: providerContract.id,
          operation: providerContract.operations?.[0] ?? "search.query",
          queryLength: safeQuery.length,
          queryDigest,
          queryContentExposed: false,
          canUseNetwork: false,
          canExecutePluginCode: false,
        },
      },
    ],
    governance: {
      mode: "openclaw_search_web_adapter_task_plan",
      runtimeOwner: "openclaw_on_nixos",
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresExplicitApproval: true,
      requiresRuntimePreflightBeforeExecution: true,
    },
  };

  return {
    ok: true,
    registry: "openclaw-plugin-search-web-adapter-task-draft-v0",
    mode: "approval-gated-search-web-task-draft",
    generatedAt: now,
    sourceRegistry: adapterContract.registry,
    sourceRegistries: [
      adapterContract.registry,
      "openclaw-plugin-candidate-contract-tests-v0",
      "openclaw-plugin-capability-plan-v0",
    ],
    workspace: adapterContract.workspace,
    adapter: adapterContract.adapter,
    providerContract,
    query: {
      present: safeQuery.length > 0,
      length: safeQuery.length,
      digest: queryDigest,
      contentExposed: false,
    },
    plan,
    policy: {
      request: policyRequest,
      decision: policyDecision,
    },
    governance: {
      mode: "plugin_search_web_adapter_task_draft",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canReadManifestMetadata: true,
      exposesManifestBodies: false,
      exposesAuthEnvVarNames: false,
      exposesEndpointHosts: false,
      exposesQueryContent: false,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApprovalBeforeNetworkUse: true,
      requiresRuntimePreflightBeforeExecution: true,
    },
  };
}

function buildOpenClawPluginSearchWebAdapterRuntimePreflight({
  workspacePath = null,
  providerContractId = null,
  query = "openclaw native integration",
  limit = 8,
} = {}) {
  const taskDraft = buildOpenClawPluginSearchWebAdapterTaskDraft({
    workspacePath,
    providerContractId,
    query,
    limit,
  });
  const providerContract = taskDraft.providerContract ?? {};
  const policyDecision = taskDraft.policy?.decision ?? {};
  const operation = providerContract.operations?.[0] ?? "search.query";

  return {
    ok: true,
    registry: "openclaw-plugin-search-web-adapter-runtime-preflight-v0",
    mode: "preflight-only",
    generatedAt: new Date().toISOString(),
    sourceRegistry: taskDraft.registry,
    sourceMode: taskDraft.mode,
    sourceRegistries: [
      taskDraft.registry,
      "openclaw-plugin-search-web-adapter-contract-v0",
      "openclaw-plugin-candidate-contract-tests-v0",
    ],
    workspace: taskDraft.workspace,
    adapter: {
      id: "openclaw.search_web.native-adapter",
      runtimeOwner: "openclaw_on_nixos",
      status: "preflight_ready_network_runtime_disabled",
      canResolveProviderMetadata: true,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
    },
    provider: {
      id: providerContract.id ?? null,
      manifestId: providerContract.manifestId ?? null,
      extensionName: providerContract.extensionName ?? null,
      category: providerContract.category ?? "search_and_web",
      operations: providerContract.operations ?? [],
      proposedCapabilityId: providerContract.proposedCapabilityId ?? null,
      policy: providerContract.policy ?? {},
      audit: providerContract.audit ?? {},
    },
    query: taskDraft.query,
    executionEnvelope: {
      envelopeVersion: "openclaw-search-web-execution-envelope-v0",
      state: "blocked_pending_network_runtime_adapter",
      adapterId: "openclaw.search_web.native-adapter",
      providerContractId: providerContract.id ?? null,
      manifestId: providerContract.manifestId ?? null,
      operation,
      query: {
        present: taskDraft.query?.present === true,
        length: taskDraft.query?.length ?? 0,
        digest: taskDraft.query?.digest ?? null,
        contentExposed: false,
      },
      policyDecision: {
        decision: policyDecision.decision ?? null,
        reason: policyDecision.reason ?? null,
        domain: policyDecision.domain ?? null,
        risk: policyDecision.risk ?? null,
        approved: policyDecision.approved === true,
      },
      approval: {
        required: true,
        collected: false,
        reason: "Search/web provider invocation requires explicit approval before any network use.",
      },
      audit: {
        required: providerContract.audit?.required !== false,
        ledger: providerContract.audit?.ledger ?? "capability_history",
      },
      permissions: {
        providerMetadataRead: true,
        networkSearch: true,
        webFetchMetadata: (providerContract.operations ?? []).includes("web.fetch_metadata"),
      },
      constraints: {
        canReadManifestMetadata: true,
        canResolveProviderMetadata: true,
        canExposeQueryContent: false,
        canExposeManifestBodies: false,
        canExposeAuthEnvVarNames: false,
        canExposeEndpointHosts: false,
        canUseNetwork: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        canMutate: false,
        canCreateTask: false,
        canCreateApproval: false,
      },
    },
    governance: {
      mode: "plugin_search_web_runtime_preflight_only",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canReadManifestMetadata: true,
      canResolveProviderMetadata: true,
      exposesManifestBodies: false,
      exposesAuthEnvVarNames: false,
      exposesEndpointHosts: false,
      exposesConfigSchemaBodies: false,
      exposesSourceFileContent: false,
      exposesQueryContent: false,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApprovalBeforeNetworkUse: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

function buildOpenClawPluginSearchWebAdapterRuntimeActivationPlan({
  workspacePath = null,
  providerContractId = null,
  query = "openclaw native integration",
  limit = 8,
} = {}) {
  const preflight = buildOpenClawPluginSearchWebAdapterRuntimePreflight({
    workspacePath,
    providerContractId,
    query,
    limit,
  });
  const envelope = preflight.executionEnvelope ?? {};
  const constraints = envelope.constraints ?? {};
  const gates = [
    {
      id: "preflight_envelope_ready",
      label: "Search/web runtime preflight envelope is available",
      required: true,
      status: envelope.envelopeVersion === "openclaw-search-web-execution-envelope-v0" ? "passed" : "blocked",
      evidence: `envelope=${envelope.envelopeVersion ?? "missing"}`,
    },
    {
      id: "audit_binding_ready",
      label: "Search/web provider audit ledger is bound",
      required: true,
      status: envelope.audit?.required === true && envelope.audit?.ledger === "capability_history" ? "passed" : "blocked",
      evidence: `ledger=${envelope.audit?.ledger ?? "missing"}`,
    },
    {
      id: "explicit_user_approval_required",
      label: "Network-bound search/web invocation requires explicit approval",
      required: true,
      status: envelope.approval?.required === true ? "passed" : "blocked",
      evidence: `approvalRequired=${Boolean(envelope.approval?.required)} collected=${Boolean(envelope.approval?.collected)}`,
    },
    {
      id: "query_privacy_locked",
      label: "Query content remains redacted before activation",
      required: true,
      status: envelope.query?.contentExposed === false && constraints.canExposeQueryContent === false ? "passed" : "blocked",
      evidence: `queryContentExposed=${Boolean(envelope.query?.contentExposed)} canExposeQueryContent=${Boolean(constraints.canExposeQueryContent)}`,
    },
    {
      id: "network_runtime_adapter_required",
      label: "Sandboxed network runtime adapter must be implemented before provider execution",
      required: true,
      status: "blocked",
      evidence: "no network runtime adapter is active",
    },
    {
      id: "provider_runtime_sandbox_required",
      label: "Provider runtime sandbox must be approved before network/provider activation",
      required: true,
      status: "blocked",
      evidence: "provider runtime sandbox is not implemented or approved",
    },
    {
      id: "runtime_activation_approval_required",
      label: "Runtime activation needs a future approval-gated task",
      required: true,
      status: "blocked",
      evidence: "this endpoint is plan-only and creates no approval",
    },
  ];
  const requiredGates = gates.filter((gate) => gate.required);
  const passedRequired = requiredGates.filter((gate) => gate.status === "passed").length;
  const blockedRequired = requiredGates.length - passedRequired;

  return {
    ok: true,
    registry: "openclaw-plugin-search-web-adapter-runtime-activation-plan-v0",
    mode: "activation-plan-only",
    generatedAt: new Date().toISOString(),
    sourceRegistry: preflight.registry,
    sourceMode: preflight.mode,
    runtimeOwner: "openclaw_on_nixos",
    status: "blocked_pending_network_runtime_adapter",
    activationReady: false,
    adapter: preflight.adapter,
    provider: preflight.provider,
    query: preflight.query,
    executionEnvelope: {
      envelopeVersion: envelope.envelopeVersion ?? null,
      state: envelope.state ?? null,
      adapterId: envelope.adapterId ?? null,
      providerContractId: envelope.providerContractId ?? null,
      manifestId: envelope.manifestId ?? null,
      operation: envelope.operation ?? null,
      query: envelope.query ?? null,
      policyDecision: envelope.policyDecision ?? null,
      approval: envelope.approval ?? null,
      audit: envelope.audit ?? null,
    },
    gates,
    summary: {
      totalGates: gates.length,
      requiredGates: requiredGates.length,
      passedRequired,
      blockedRequired,
      activationReady: false,
      canReadManifestMetadata: constraints.canReadManifestMetadata === true,
      canResolveProviderMetadata: constraints.canResolveProviderMetadata === true,
      exposesQueryContent: false,
      exposesEndpointHosts: false,
      exposesAuthEnvVarNames: false,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      nextAllowedWork: [
        "design sandboxed network runtime adapter inside OpenClawOnNixOS",
        "materialize search/web runtime activation only through approval-gated tasks",
        "bind provider execution transcripts into capability history before any live network call",
      ],
      forbiddenWork: [
        "do not perform network requests during activation planning",
        "do not import old OpenClaw provider modules in this plan",
        "do not execute provider code or expose query content before a future approval-gated activation task",
      ],
    },
    governance: {
      mode: "plugin_search_web_runtime_activation_plan_only",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canReadManifestMetadata: constraints.canReadManifestMetadata === true,
      canResolveProviderMetadata: constraints.canResolveProviderMetadata === true,
      exposesManifestBodies: false,
      exposesAuthEnvVarNames: false,
      exposesEndpointHosts: false,
      exposesConfigSchemaBodies: false,
      exposesSourceFileContent: false,
      exposesQueryContent: false,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApprovalBeforeNetworkUse: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

function buildOpenClawPluginSearchWebAdapterProviderRuntimeSandbox({
  workspacePath = null,
  providerContractId = null,
  query = "openclaw native integration",
  limit = 8,
} = {}) {
  const activationPlan = buildOpenClawPluginSearchWebAdapterRuntimeActivationPlan({
    workspacePath,
    providerContractId,
    query,
    limit,
  });
  const provider = activationPlan.provider ?? {};
  const envelope = activationPlan.executionEnvelope ?? {};
  const checks = [
    {
      id: "preflight_envelope_bound",
      label: "Provider sandbox is bound to a search/web runtime preflight envelope",
      required: true,
      status: envelope.envelopeVersion === "openclaw-search-web-execution-envelope-v0" ? "passed" : "blocked",
      evidence: `envelope=${envelope.envelopeVersion ?? "missing"}`,
    },
    {
      id: "provider_metadata_only",
      label: "Sandbox contract uses provider metadata without exposing manifest bodies",
      required: true,
      status: provider.id && provider.manifestId ? "passed" : "blocked",
      evidence: `provider=${provider.id ?? "missing"} manifest=${provider.manifestId ?? "missing"}`,
    },
    {
      id: "network_egress_default_deny",
      label: "Network egress remains denied until a future allowlisted runtime adapter exists",
      required: true,
      status: "passed",
      evidence: "networkEgressDefault=deny canUseNetwork=false",
    },
    {
      id: "query_privacy_locked",
      label: "Query content remains redacted inside the sandbox contract",
      required: true,
      status: activationPlan.query?.contentExposed === false ? "passed" : "blocked",
      evidence: `queryContentExposed=${Boolean(activationPlan.query?.contentExposed)}`,
    },
    {
      id: "provider_code_import_blocked",
      label: "Old provider modules cannot be imported by this sandbox contract",
      required: true,
      status: "passed",
      evidence: "canImportModule=false",
    },
    {
      id: "provider_execution_blocked",
      label: "Provider code execution remains blocked by this sandbox contract",
      required: true,
      status: "passed",
      evidence: "canExecuteProviderCode=false",
    },
    {
      id: "sandbox_approval_required",
      label: "Provider runtime sandbox requires separate approval before activation",
      required: true,
      status: "blocked",
      evidence: "sandbox approval task has not been materialized",
    },
    {
      id: "network_runtime_adapter_required",
      label: "Network runtime adapter is still required before live provider calls",
      required: true,
      status: "blocked",
      evidence: "no network runtime adapter is active",
    },
  ];
  const requiredChecks = checks.filter((check) => check.required);
  const passedRequired = requiredChecks.filter((check) => check.status === "passed").length;
  const blockedRequired = requiredChecks.length - passedRequired;

  return {
    ok: true,
    registry: "openclaw-plugin-search-web-adapter-provider-runtime-sandbox-v0",
    mode: "provider-runtime-sandbox-contract",
    generatedAt: new Date().toISOString(),
    sourceRegistry: activationPlan.registry,
    sourceMode: activationPlan.mode,
    runtimeOwner: "openclaw_on_nixos",
    status: "contract_ready_activation_blocked",
    activationReady: false,
    adapter: {
      id: "openclaw.search_web.native-adapter",
      runtimeOwner: "openclaw_on_nixos",
      status: "provider_runtime_sandbox_contract_ready_runtime_disabled",
      canResolveProviderMetadata: true,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
    },
    provider: {
      id: provider.id ?? null,
      manifestId: provider.manifestId ?? null,
      extensionName: provider.extensionName ?? null,
      category: provider.category ?? "search_and_web",
      operations: provider.operations ?? [],
      proposedCapabilityId: provider.proposedCapabilityId ?? null,
      policy: provider.policy ?? {},
      audit: provider.audit ?? {},
    },
    query: activationPlan.query,
    sandbox: {
      sandboxId: "openclaw.search_web.provider-runtime-sandbox.v0",
      contractVersion: "openclaw-search-web-provider-runtime-sandbox-v0",
      state: "contract_ready_not_approved",
      approval: {
        required: true,
        collected: false,
        reason: "Provider runtime sandbox must be separately approved before network/provider activation.",
      },
      isolation: {
        processIsolationRequired: true,
        providerRuntimeBoundary: "openclaw_on_nixos_owned_adapter",
        providerCodeImportAllowed: false,
        oldOpenClawModuleImportAllowed: false,
        secretsMounted: false,
      },
      egress: {
        networkEgressDefault: "deny",
        allowlistRequired: true,
        allowlist: [],
        dnsResolutionAllowed: false,
        endpointHostsExposed: false,
        canUseNetwork: false,
      },
      privacy: {
        queryContentExposed: false,
        manifestBodiesExposed: false,
        authEnvVarNamesExposed: false,
        endpointHostsExposed: false,
        sourceFileContentExposed: false,
        scriptBodiesExposed: false,
      },
      execution: {
        canImportModule: false,
        canExecuteProviderCode: false,
        canActivateRuntime: false,
        canMutate: false,
      },
      audit: {
        required: true,
        ledger: "capability_history",
        transcriptRequired: true,
        preflightRequired: true,
        runtimeActivationTaskRequired: true,
      },
    },
    checks,
    summary: {
      totalChecks: checks.length,
      requiredChecks: requiredChecks.length,
      passedRequired,
      blockedRequired,
      sandboxContractReady: passedRequired >= 6,
      sandboxApproved: false,
      activationReady: false,
      canReadManifestMetadata: true,
      canResolveProviderMetadata: true,
      exposesQueryContent: false,
      exposesEndpointHosts: false,
      exposesAuthEnvVarNames: false,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      nextAllowedWork: [
        "materialize provider runtime sandbox approval only through explicit activation tasks",
        "bind a future network runtime adapter to this sandbox contract before live provider calls",
      ],
      forbiddenWork: [
        "do not perform network requests from the sandbox contract",
        "do not import old OpenClaw provider modules",
        "do not expose query content, endpoint hosts, auth env var names, source contents, or script bodies",
      ],
    },
    governance: {
      mode: "plugin_search_web_provider_runtime_sandbox_contract",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canReadManifestMetadata: true,
      canResolveProviderMetadata: true,
      exposesManifestBodies: false,
      exposesAuthEnvVarNames: false,
      exposesEndpointHosts: false,
      exposesConfigSchemaBodies: false,
      exposesSourceFileContent: false,
      exposesQueryContent: false,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApprovalBeforeNetworkUse: true,
      requiresRuntimeAdapterBeforeExecution: true,
      requiresSandboxApprovalBeforeRuntimeActivation: true,
    },
  };
}

function buildOpenClawPluginSearchWebAdapterProviderRuntimeSandboxTaskDraft({
  workspacePath = null,
  providerContractId = null,
  query = "openclaw native integration",
  limit = 8,
} = {}) {
  const sandbox = buildOpenClawPluginSearchWebAdapterProviderRuntimeSandbox({
    workspacePath,
    providerContractId,
    query,
    limit,
  });
  const provider = sandbox.provider ?? {};
  const now = new Date().toISOString();
  const blockedCheckIds = (sandbox.checks ?? [])
    .filter((check) => check.required === true && check.status === "blocked")
    .map((check) => check.id);
  const policyRequest = {
    intent: "plugin.search_web.provider_runtime_sandbox",
    domain: "cross_boundary",
    risk: "high",
    requiresApproval: true,
    approved: false,
    providerContractId: provider.id ?? null,
    sandboxId: sandbox.sandbox?.sandboxId ?? "openclaw.search_web.provider-runtime-sandbox.v0",
    tags: ["openclaw_search_web_provider_runtime_sandbox", "explicit_approval_required", "provider_runtime_sandbox_deferred"],
  };
  const policyDecision = {
    id: randomUUID(),
    at: now,
    engine: "openclaw-plugin-search-web-adapter-provider-runtime-sandbox-task-v0",
    stage: "plugin_search_web.provider_runtime_sandbox.task.materialize",
    subject: {
      taskId: null,
      type: "openclaw_search_web_provider_runtime_sandbox",
      goal: `Prepare approved provider runtime sandbox for ${provider.manifestId ?? "search/web provider"}`,
      targetUrl: null,
      intent: policyRequest.intent,
    },
    domain: policyRequest.domain,
    risk: policyRequest.risk,
    decision: "require_approval",
    reason: "search_web_provider_runtime_sandbox_requires_explicit_user_approval_before_provider_runtime_enablement",
    approved: false,
    autonomyMode,
    autonomous: false,
  };
  const plan = {
    planId: `plan-${randomUUID()}`,
    strategy: "openclaw-search-web-provider-runtime-sandbox-v0",
    planner: "openclaw-plugin-search-web-adapter-provider-runtime-sandbox-task-v0",
    capabilityAware: true,
    status: "planned",
    goal: policyDecision.subject.goal,
    targetUrl: null,
    intent: policyRequest.intent,
    createdAt: now,
    updatedAt: now,
    capabilitySummary: {
      total: 3,
      approvalGates: 2,
      ids: [
        "plan.openclaw.plugin_search_web_runtime_activation",
        "govern.policy.evaluate",
        "boundary.cross_domain.approval",
      ],
      byRisk: {
        low: 1,
        high: 2,
      },
    },
    steps: [
      {
        id: "step-review-provider-runtime-sandbox",
        kind: "openclaw.plugin.search_web_provider_runtime_sandbox_contract",
        phase: "reviewing_provider_runtime_sandbox",
        title: "Review search/web provider runtime sandbox boundary",
        status: "pending",
        capabilityId: "plan.openclaw.plugin_search_web_runtime_activation",
        risk: "low",
        governance: "audit_only",
        requiresApproval: false,
        params: {
          providerContractId: provider.id ?? null,
          manifestId: provider.manifestId ?? null,
          sandboxId: sandbox.sandbox?.sandboxId ?? null,
          sandboxStatus: sandbox.status,
          blockedCheckIds,
        },
      },
      {
        id: "step-user-approval",
        kind: "approval.gate",
        phase: "waiting_for_approval",
        title: "Wait for explicit user approval before any provider runtime sandbox activation attempt",
        status: "pending",
        capabilityId: "govern.policy.evaluate",
        risk: "high",
        governance: "require_approval",
        requiresApproval: true,
      },
      {
        id: "step-defer-provider-runtime-sandbox",
        kind: "plugin.search_web.provider_runtime_sandbox",
        phase: "provider_runtime_sandbox_deferred",
        title: "Defer provider runtime sandbox activation until a native network runtime adapter exists",
        status: "pending",
        capabilityId: "boundary.cross_domain.approval",
        risk: "high",
        governance: "require_approval",
        requiresApproval: true,
        params: {
          providerContractId: provider.id ?? null,
          manifestId: provider.manifestId ?? null,
          sandboxId: sandbox.sandbox?.sandboxId ?? null,
          contractVersion: sandbox.sandbox?.contractVersion ?? null,
          blockedCheckIds,
          canUseNetwork: false,
          canImportModule: false,
          canExecuteProviderCode: false,
          canActivateRuntime: false,
          queryContentExposed: false,
          endpointHostsExposed: false,
          authEnvVarNamesExposed: false,
        },
      },
    ],
    governance: {
      mode: "openclaw_search_web_provider_runtime_sandbox_task_plan",
      runtimeOwner: "openclaw_on_nixos",
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresExplicitApproval: true,
      requiresRuntimeAdapterBeforeExecution: true,
      requiresSandboxApprovalBeforeRuntimeActivation: true,
    },
  };

  return {
    ok: true,
    registry: "openclaw-plugin-search-web-adapter-provider-runtime-sandbox-task-draft-v0",
    mode: "approval-gated-search-web-provider-runtime-sandbox-task-draft",
    generatedAt: now,
    sourceRegistry: sandbox.registry,
    sourceMode: sandbox.mode,
    adapter: sandbox.adapter,
    provider,
    query: sandbox.query,
    sandboxContract: {
      registry: sandbox.registry,
      status: sandbox.status,
      activationReady: sandbox.activationReady,
      sandbox: sandbox.sandbox,
      summary: sandbox.summary,
      checks: sandbox.checks,
    },
    plan,
    policy: {
      request: policyRequest,
      decision: policyDecision,
    },
    governance: {
      mode: "plugin_search_web_provider_runtime_sandbox_task_draft",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canReadManifestMetadata: true,
      canResolveProviderMetadata: true,
      exposesManifestBodies: false,
      exposesAuthEnvVarNames: false,
      exposesEndpointHosts: false,
      exposesSourceFileContent: false,
      exposesQueryContent: false,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApprovalBeforeProviderRuntimeSandbox: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

function buildOpenClawPluginSearchWebAdapterRuntimeActivationTaskDraft({
  workspacePath = null,
  providerContractId = null,
  query = "openclaw native integration",
  limit = 8,
} = {}) {
  const activationPlan = buildOpenClawPluginSearchWebAdapterRuntimeActivationPlan({
    workspacePath,
    providerContractId,
    query,
    limit,
  });
  const provider = activationPlan.provider ?? {};
  const envelope = activationPlan.executionEnvelope ?? {};
  const now = new Date().toISOString();
  const policyRequest = {
    intent: "plugin.search_web.runtime_activation",
    domain: "cross_boundary",
    risk: "high",
    requiresApproval: true,
    approved: false,
    providerContractId: provider.id ?? null,
    tags: ["openclaw_search_web_runtime_activation", "explicit_approval_required", "network_runtime_deferred"],
  };
  const policyDecision = {
    id: randomUUID(),
    at: now,
    engine: "openclaw-plugin-search-web-adapter-runtime-activation-task-v0",
    stage: "plugin_search_web.runtime_activation.task.materialize",
    subject: {
      taskId: null,
      type: "openclaw_search_web_runtime_activation",
      goal: `Prepare approved search/web runtime activation for ${provider.manifestId ?? "search/web provider"}`,
      targetUrl: null,
      intent: policyRequest.intent,
    },
    domain: policyRequest.domain,
    risk: policyRequest.risk,
    decision: "require_approval",
    reason: "search_web_runtime_activation_requires_explicit_user_approval_before_network_runtime_enablement",
    approved: false,
    autonomyMode,
    autonomous: false,
  };
  const blockedGateIds = (activationPlan.gates ?? [])
    .filter((gate) => gate.required === true && gate.status === "blocked")
    .map((gate) => gate.id);
  const plan = {
    planId: `plan-${randomUUID()}`,
    strategy: "openclaw-search-web-runtime-activation-v0",
    planner: "openclaw-plugin-search-web-adapter-runtime-activation-task-v0",
    capabilityAware: true,
    status: "planned",
    goal: policyDecision.subject.goal,
    targetUrl: null,
    intent: policyRequest.intent,
    createdAt: now,
    updatedAt: now,
    capabilitySummary: {
      total: 3,
      approvalGates: 2,
      ids: [
        "plan.openclaw.plugin_search_web_runtime_activation",
        "govern.policy.evaluate",
        "boundary.cross_domain.approval",
      ],
      byRisk: {
        low: 1,
        high: 2,
      },
    },
    steps: [
      {
        id: "step-review-search-web-activation-plan",
        kind: "openclaw.plugin.search_web_runtime_activation_plan",
        phase: "reviewing_runtime_activation_plan",
        title: "Review search/web runtime activation gates",
        status: "pending",
        capabilityId: "plan.openclaw.plugin_search_web_runtime_activation",
        risk: "low",
        governance: "audit_only",
        requiresApproval: false,
        params: {
          providerContractId: provider.id ?? null,
          manifestId: provider.manifestId ?? null,
          status: activationPlan.status,
          blockedGateIds,
        },
      },
      {
        id: "step-user-approval",
        kind: "approval.gate",
        phase: "waiting_for_approval",
        title: "Wait for explicit user approval before any search/web runtime activation attempt",
        status: "pending",
        capabilityId: "govern.policy.evaluate",
        risk: "high",
        governance: "require_approval",
        requiresApproval: true,
      },
      {
        id: "step-defer-network-runtime-activation",
        kind: "plugin.search_web.runtime_activation",
        phase: "network_runtime_deferred",
        title: "Defer search/web network runtime activation until sandbox/provider adapter exists",
        status: "pending",
        capabilityId: "boundary.cross_domain.approval",
        risk: "high",
        governance: "require_approval",
        requiresApproval: true,
        params: {
          providerContractId: provider.id ?? null,
          operation: envelope.operation ?? "search.query",
          blockedGateIds,
          canUseNetwork: false,
          canExecutePluginCode: false,
          canActivateRuntime: false,
          queryContentExposed: false,
        },
      },
    ],
    governance: {
      mode: "openclaw_search_web_runtime_activation_task_plan",
      runtimeOwner: "openclaw_on_nixos",
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresExplicitApproval: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };

  return {
    ok: true,
    registry: "openclaw-plugin-search-web-adapter-runtime-activation-task-draft-v0",
    mode: "approval-gated-search-web-runtime-activation-task-draft",
    generatedAt: now,
    sourceRegistry: activationPlan.registry,
    sourceMode: activationPlan.mode,
    adapter: activationPlan.adapter,
    provider,
    query: activationPlan.query,
    activationPlan: {
      registry: activationPlan.registry,
      status: activationPlan.status,
      activationReady: activationPlan.activationReady,
      summary: activationPlan.summary,
      gates: activationPlan.gates,
      executionEnvelope: activationPlan.executionEnvelope,
    },
    plan,
    policy: {
      request: policyRequest,
      decision: policyDecision,
    },
    governance: {
      mode: "plugin_search_web_runtime_activation_task_draft",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canReadManifestMetadata: true,
      canResolveProviderMetadata: true,
      exposesManifestBodies: false,
      exposesAuthEnvVarNames: false,
      exposesEndpointHosts: false,
      exposesSourceFileContent: false,
      exposesQueryContent: false,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApprovalBeforeNetworkRuntimeActivation: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

async function createOpenClawPluginSearchWebAdapterTask({
  workspacePath = null,
  providerContractId = null,
  query = "openclaw native integration",
  limit = 8,
  confirm = false,
} = {}) {
  if (confirm !== true) {
    throw new Error("Search/web adapter task creation requires confirm=true.");
  }

  const draft = buildOpenClawPluginSearchWebAdapterTaskDraft({
    workspacePath,
    providerContractId,
    query,
    limit,
  });
  const task = createTask({
    goal: draft.plan.goal,
    type: "openclaw_search_web_adapter_invocation",
    workViewStrategy: "openclaw-search-web-adapter",
    plan: draft.plan,
    policy: draft.policy.request,
  }, { skipInitialPolicy: true });
  task.policy = draft.policy;
  const approval = createApprovalRequestForTask(task, draft.policy.decision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent("task.created", { task: serialiseTask(task), planner: "openclaw-plugin-search-web-adapter-task-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    ok: true,
    registry: "openclaw-plugin-search-web-adapter-task-v0",
    mode: "approval-gated-search-web-task",
    generatedAt: new Date().toISOString(),
    sourceRegistry: draft.registry,
    adapter: draft.adapter,
    providerContract: draft.providerContract,
    query: draft.query,
    task,
    approval,
    governance: {
      mode: "plugin_search_web_adapter_task_approval_gated",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      canReadManifestMetadata: true,
      exposesManifestBodies: false,
      exposesAuthEnvVarNames: false,
      exposesEndpointHosts: false,
      exposesQueryContent: false,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      executed: false,
      requiresExplicitApprovalBeforeNetworkUse: true,
      requiresRuntimePreflightBeforeExecution: true,
    },
  };
}

async function createOpenClawPluginSearchWebAdapterRuntimeActivationTask({
  workspacePath = null,
  providerContractId = null,
  query = "openclaw native integration",
  limit = 8,
  confirm = false,
} = {}) {
  if (confirm !== true) {
    throw new Error("Search/web runtime activation task creation requires confirm=true.");
  }

  const draft = buildOpenClawPluginSearchWebAdapterRuntimeActivationTaskDraft({
    workspacePath,
    providerContractId,
    query,
    limit,
  });
  const task = createTask({
    goal: draft.plan.goal,
    type: "openclaw_search_web_runtime_activation",
    workViewStrategy: "openclaw-search-web-runtime-activation",
    plan: draft.plan,
    policy: draft.policy.request,
  }, { skipInitialPolicy: true });
  task.policy = draft.policy;
  const approval = createApprovalRequestForTask(task, draft.policy.decision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent("task.created", { task: serialiseTask(task), planner: "openclaw-plugin-search-web-adapter-runtime-activation-task-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    ok: true,
    registry: "openclaw-plugin-search-web-adapter-runtime-activation-task-v0",
    mode: "approval-gated-search-web-runtime-activation-task",
    generatedAt: new Date().toISOString(),
    sourceRegistry: draft.registry,
    sourceMode: draft.mode,
    adapter: draft.adapter,
    provider: draft.provider,
    query: draft.query,
    activationPlan: draft.activationPlan,
    task,
    approval,
    governance: {
      mode: "plugin_search_web_runtime_activation_task_approval_gated",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      canReadManifestMetadata: true,
      canResolveProviderMetadata: true,
      exposesManifestBodies: false,
      exposesAuthEnvVarNames: false,
      exposesEndpointHosts: false,
      exposesSourceFileContent: false,
      exposesQueryContent: false,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      executed: false,
      requiresExplicitApprovalBeforeNetworkRuntimeActivation: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

async function createOpenClawPluginSearchWebAdapterProviderRuntimeSandboxTask({
  workspacePath = null,
  providerContractId = null,
  query = "openclaw native integration",
  limit = 8,
  confirm = false,
} = {}) {
  if (confirm !== true) {
    throw new Error("Search/web provider runtime sandbox task creation requires confirm=true.");
  }

  const draft = buildOpenClawPluginSearchWebAdapterProviderRuntimeSandboxTaskDraft({
    workspacePath,
    providerContractId,
    query,
    limit,
  });
  const task = createTask({
    goal: draft.plan.goal,
    type: "openclaw_search_web_provider_runtime_sandbox",
    workViewStrategy: "openclaw-search-web-provider-runtime-sandbox",
    plan: draft.plan,
    policy: draft.policy.request,
  }, { skipInitialPolicy: true });
  task.policy = draft.policy;
  const approval = createApprovalRequestForTask(task, draft.policy.decision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent("task.created", { task: serialiseTask(task), planner: "openclaw-plugin-search-web-adapter-provider-runtime-sandbox-task-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    ok: true,
    registry: "openclaw-plugin-search-web-adapter-provider-runtime-sandbox-task-v0",
    mode: "approval-gated-search-web-provider-runtime-sandbox-task",
    generatedAt: new Date().toISOString(),
    sourceRegistry: draft.registry,
    sourceMode: draft.mode,
    adapter: draft.adapter,
    provider: draft.provider,
    query: draft.query,
    sandboxContract: draft.sandboxContract,
    task,
    approval,
    governance: {
      mode: "plugin_search_web_provider_runtime_sandbox_task_approval_gated",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      canReadManifestMetadata: true,
      canResolveProviderMetadata: true,
      exposesManifestBodies: false,
      exposesAuthEnvVarNames: false,
      exposesEndpointHosts: false,
      exposesSourceFileContent: false,
      exposesQueryContent: false,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      executed: false,
      requiresExplicitApprovalBeforeProviderRuntimeSandbox: true,
      requiresRuntimeAdapterBeforeExecution: true,
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
      contentExposed: false,
    },
    summary: {
      ...totals,
      expectedChecks,
      promptTermCounts: termCounts,
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
    detectWorkspacePackageManager,
    detectWorkspace,
    buildWorkspaceRegistry,
    buildWorkspaceCommandProposals,
    buildOpenClawSourceCommandProposals,
    buildOpenClawMigrationMap,
    buildOpenClawMigrationPlan,
    buildOpenClawPluginSdkSourceReviewScope,
    buildOpenClawPluginSdkSourceContentReview,
    buildOpenClawPluginSdkNativeContractTests,
    buildOpenClawPluginSdkContractReview,
    buildOpenClawNativePluginContractRegistry,
    buildOpenClawNativePluginRegistryResponse,
    buildOpenClawFormalIntegrationReadiness,
    buildOpenClawNativePluginAdapterStatus,
    buildOpenClawToolCatalog,
    buildOpenClawPluginCapabilityPlan,
    buildOpenClawPluginCandidateContractTests,
    buildOpenClawPluginSearchWebAdapterContract,
    createOpenClawPluginSearchWebTask,
    selectReviewedPluginSdkPackage,
    selectOpenClawToolCatalogWorkspace,
    buildNativeOpenClawToolCatalogProfile,
    buildNativeOpenClawPromptSemanticsProfile,
    buildNativeOpenClawWorkspaceSemanticIndex,
    buildNativeOpenClawWorkspaceSymbolLookup,
    buildNativeOpenClawWorkspaceEditTargetSelect,
  };
}

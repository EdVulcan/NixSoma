import http from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
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

const host = process.env.OPENCLAW_CORE_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.OPENCLAW_CORE_PORT ?? "4100", 10);
const eventHubUrl = process.env.OPENCLAW_EVENT_HUB_URL ?? "http://127.0.0.1:4101";
const sessionManagerUrl = process.env.OPENCLAW_SESSION_MANAGER_URL ?? "http://127.0.0.1:4102";
const browserRuntimeUrl = process.env.OPENCLAW_BROWSER_RUNTIME_URL ?? "http://127.0.0.1:4103";
const screenSenseUrl = process.env.OPENCLAW_SCREEN_SENSE_URL ?? "http://127.0.0.1:4104";
const screenActUrl = process.env.OPENCLAW_SCREEN_ACT_URL ?? "http://127.0.0.1:4105";
const systemSenseUrl = process.env.OPENCLAW_SYSTEM_SENSE_URL ?? "http://127.0.0.1:4106";
const systemHealUrl = process.env.OPENCLAW_SYSTEM_HEAL_URL ?? "http://127.0.0.1:4107";
const stateFilePath = process.env.OPENCLAW_CORE_STATE_FILE
  ?? path.resolve(process.cwd(), "../../.artifacts/openclaw-core-state.json");
const autonomyMode = normaliseAutonomyMode(process.env.OPENCLAW_AUTONOMY_MODE);
const workspaceRoots = parseWorkspaceRoots(process.env.OPENCLAW_WORKSPACE_ROOTS);

const tasks = new Map();
const approvals = new Map();
const policyAuditLog = [];
const capabilityInvocationLog = [];
const runtimeState = {
  status: "idle",
  currentTaskId: null,
  paused: false,
  lastUpdatedAt: new Date().toISOString(),
};

const ACTIVE_TASK_STATUSES = new Set(["queued", "running", "paused"]);
const MAX_POLICY_AUDIT_ENTRIES = 100;
const MAX_APPROVAL_ITEMS = 200;
const MAX_CAPABILITY_INVOCATION_ENTRIES = 200;
const CROSS_BOUNDARY_INTENTS = new Set([
  "account.login",
  "data.egress",
  "data.upload",
  "external_device.control",
  "network.publish",
  "social.post",
  "transaction.commit",
]);
const DENIED_INTENTS = new Set([
  "body.destroy",
  "security.disable",
]);
const CAPABILITY_HEALTH_TIMEOUT_MS = Number.parseInt(
  process.env.OPENCLAW_CAPABILITY_HEALTH_TIMEOUT_MS ?? "1200",
  10,
);
const APPROVAL_TTL_MS = parseOptionalPositiveInteger(process.env.OPENCLAW_APPROVAL_TTL_MS);
const SYSTEMD_REPAIR_EXECUTION_TIMEOUT_MS = parseOptionalPositiveInteger(process.env.OPENCLAW_SYSTEMD_REPAIR_EXECUTION_TIMEOUT_MS) ?? 15000;
const SYSTEMD_REPAIR_RESTART_HELPER = normaliseOptionalString(process.env.OPENCLAW_SYSTEMD_REPAIR_RESTART_HELPER);
const SYSTEMD_REPAIR_RESTART_HELPER_SUDO =
  normaliseOptionalString(process.env.OPENCLAW_SYSTEMD_REPAIR_RESTART_HELPER_SUDO) ?? "sudo";
const SYSTEMD_REPAIR_AUTH_DELEGATION = normaliseOptionalString(process.env.OPENCLAW_SYSTEMD_REPAIR_AUTH_DELEGATION);
const STATUS_PRIORITY = {
  running: 0,
  paused: 1,
  queued: 2,
  failed: 3,
  completed: 4,
  superseded: 5,
};
const SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY = "openclaw-systemd-repair-execution-task-v0";
const SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY = "openclaw-systemd-next-repair-task-shell-v0";
const SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY = "openclaw-systemd-next-repair-real-execution-v0";
const SYSTEMD_REPAIR_REAL_EXECUTION_UNIT = "openclaw-browser-runtime.service";
const SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT = "openclaw-system-sense.service";
const execFileAsync = promisify(execFile);

function normaliseAutonomyMode(value) {
  const mode = typeof value === "string" && value.trim() ? value.trim() : "guardian";
  if (["guardian", "sovereign_body", "full_autonomy"].includes(mode)) {
    return mode;
  }
  return "guardian";
}

function parseOptionalPositiveInteger(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normaliseOptionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uniqueResolvedPaths(paths) {
  return [...new Set(paths.map((item) => path.resolve(item)))];
}

function parseWorkspaceRoots(value) {
  if (typeof value === "string" && value.trim()) {
    return uniqueResolvedPaths(value
      .split(path.delimiter)
      .map((item) => item.trim())
      .filter(Boolean));
  }

  return uniqueResolvedPaths([
    path.resolve(process.cwd(), "../openclaw"),
    path.resolve(process.cwd(), "../../..", "openclaw"),
  ]);
}

function corsHeaders(extraHeaders = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    ...extraHeaders,
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, corsHeaders({ "content-type": "application/json; charset=utf-8" }));
  res.end(JSON.stringify(payload, null, 2));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function updateRuntimeState(patch) {
  Object.assign(runtimeState, patch, {
    lastUpdatedAt: new Date().toISOString(),
  });
}

function persistState() {
  try {
    mkdirSync(path.dirname(stateFilePath), { recursive: true });
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      runtime: runtimeState,
      tasks: [...tasks.values()],
      approvals: [...approvals.values()],
      policyAuditLog,
      capabilityInvocationLog,
    };
    const tempPath = `${stateFilePath}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    renameSync(tempPath, stateFilePath);
  } catch (error) {
    console.error("Failed to persist core state:", error);
  }
}

function loadPersistentState() {
  if (!existsSync(stateFilePath)) {
    return;
  }

  try {
    const data = JSON.parse(readFileSync(stateFilePath, "utf8"));
    if (data?.runtime && typeof data.runtime === "object") {
      Object.assign(runtimeState, data.runtime);
    }
    if (Array.isArray(data?.tasks)) {
      tasks.clear();
      for (const task of data.tasks) {
        if (task?.id) {
          tasks.set(task.id, task);
        }
      }
    }
    if (Array.isArray(data?.approvals)) {
      approvals.clear();
      for (const approval of data.approvals.slice(-MAX_APPROVAL_ITEMS)) {
        if (approval?.id) {
          approvals.set(approval.id, approval);
        }
      }
    }
    if (Array.isArray(data?.policyAuditLog)) {
      policyAuditLog.splice(0, policyAuditLog.length, ...data.policyAuditLog.slice(-MAX_POLICY_AUDIT_ENTRIES));
    }
    if (Array.isArray(data?.capabilityInvocationLog)) {
      capabilityInvocationLog.splice(
        0,
        capabilityInvocationLog.length,
        ...data.capabilityInvocationLog.slice(-MAX_CAPABILITY_INVOCATION_ENTRIES),
      );
    }
  } catch (error) {
    console.error("Failed to load persisted core state:", error);
  }
}

function getCurrentTask() {
  return runtimeState.currentTaskId ? getTaskById(runtimeState.currentTaskId) : null;
}

async function publishEvent(type, payload = {}) {
  try {
    await fetch(`${eventHubUrl}/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type,
        source: "openclaw-core",
        payload,
      }),
    });
  } catch (error) {
    console.error("Failed to publish event to event hub:", error);
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error ?? `Request failed: ${url}`);
  }
  return data;
}

async function postJson(url, body = {}) {
  return fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function readJsonFileIfPresent(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

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

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
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

function countOccurrences(text, search) {
  if (!search) {
    return 0;
  }
  let count = 0;
  let position = 0;
  while (position <= text.length) {
    const next = text.indexOf(search, position);
    if (next === -1) {
      break;
    }
    count += 1;
    position = next + search.length;
  }
  return count;
}

function replaceNthOccurrence(text, search, replacement, occurrence = 1) {
  const safeOccurrence = Number.isInteger(occurrence) && occurrence > 0 ? occurrence : 1;
  let seen = 0;
  let position = 0;
  while (position <= text.length) {
    const next = text.indexOf(search, position);
    if (next === -1) {
      return null;
    }
    seen += 1;
    if (seen === safeOccurrence) {
      return {
        text: `${text.slice(0, next)}${replacement}${text.slice(next + search.length)}`,
        index: next,
      };
    }
    position = next + search.length;
  }
  return null;
}

function findNthOccurrenceRange(text, search, occurrence = 1) {
  const safeOccurrence = Number.isInteger(occurrence) && occurrence > 0 ? occurrence : 1;
  let seen = 0;
  let position = 0;
  while (position <= text.length) {
    const next = text.indexOf(search, position);
    if (next === -1) {
      return null;
    }
    seen += 1;
    if (seen === safeOccurrence) {
      return {
        start: next,
        end: next + search.length,
      };
    }
    position = next + search.length;
  }
  return null;
}

function buildTextLineRanges(text) {
  const ranges = [];
  let line = 1;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\n") {
      ranges.push({ line, start, end: index + 1 });
      line += 1;
      start = index + 1;
    } else if (char === "\r") {
      const end = text[index + 1] === "\n" ? index + 2 : index + 1;
      ranges.push({ line, start, end });
      line += 1;
      start = end;
      if (end === index + 2) {
        index += 1;
      }
    }
  }
  if (start < text.length) {
    ranges.push({ line, start, end: text.length });
  }
  return ranges;
}

function normaliseWorkspacePatchEdits({ edits = null, search = "", replacement = "", occurrence = 1 } = {}) {
  const rawEdits = Array.isArray(edits) && edits.length > 0
    ? edits
    : [{ search, replacement, occurrence }];
  if (rawEdits.length > 8) {
    throw new Error("OpenClaw workspace patch drafts are limited to 8 edit hunks.");
  }
  return rawEdits.map((edit, index) => {
    const kind = edit?.kind === "replace_lines" ? "replace_lines" : "replace_text";
    const safeReplacement = typeof edit?.replacement === "string"
      ? edit.replacement
      : Array.isArray(edit?.replacementLines)
        ? edit.replacementLines.map((line) => String(line)).join("\n")
        : "";
    if (Buffer.byteLength(safeReplacement, "utf8") > 16 * 1024) {
      throw new Error(`OpenClaw workspace patch edit ${index + 1} exceeds the per-hunk replacement size limit.`);
    }
    if (kind === "replace_lines") {
      const startLine = Number.isInteger(edit?.startLine) ? edit.startLine : null;
      const endLine = Number.isInteger(edit?.endLine) ? edit.endLine : startLine;
      if (!startLine || !endLine || startLine < 1 || endLine < startLine) {
        throw new Error(`valid startLine/endLine are required for OpenClaw workspace line edit ${index + 1}.`);
      }
      return {
        kind,
        startLine,
        endLine,
        replacement: safeReplacement,
      };
    }
    const safeSearch = typeof edit?.search === "string" ? edit.search : "";
    if (!safeSearch) {
      throw new Error(`search text is required for OpenClaw workspace patch edit ${index + 1}.`);
    }
    if (Buffer.byteLength(safeSearch, "utf8") > 16 * 1024) {
      throw new Error(`OpenClaw workspace patch edit ${index + 1} exceeds the per-hunk search size limit.`);
    }
    return {
      kind,
      search: safeSearch,
      replacement: safeReplacement,
      occurrence: Number.isInteger(edit?.occurrence) && edit.occurrence > 0 ? edit.occurrence : 1,
    };
  });
}

function applyWorkspacePatchEdits(originalContent, edits) {
  const lineRanges = buildTextLineRanges(originalContent);
  const ranges = edits.map((edit, index) => {
    if (edit.kind === "replace_lines") {
      const startLine = lineRanges[edit.startLine - 1] ?? null;
      const endLine = lineRanges[edit.endLine - 1] ?? null;
      if (!startLine || !endLine) {
        throw new Error(`OpenClaw workspace line edit ${index + 1} targets lines outside the file.`);
      }
      return {
        index: index + 1,
        kind: edit.kind,
        edit,
        replacementsAvailable: 1,
        start: startLine.start,
        end: endLine.end,
      };
    }
    const replacementsAvailable = countOccurrences(originalContent, edit.search);
    const range = findNthOccurrenceRange(originalContent, edit.search, edit.occurrence);
    if (!range) {
      throw new Error(`OpenClaw workspace patch search text was not found for edit ${index + 1}.`);
    }
    return {
      index: index + 1,
      kind: edit.kind,
      edit,
      replacementsAvailable,
      ...range,
    };
  });
  const sortedRanges = [...ranges].sort((left, right) => left.start - right.start || left.end - right.end);
  for (let index = 1; index < sortedRanges.length; index += 1) {
    const previous = sortedRanges[index - 1];
    const current = sortedRanges[index];
    if (current.start < previous.end) {
      throw new Error(`OpenClaw workspace patch edit ${current.index} overlaps edit ${previous.index}; overlapping hunks are not allowed.`);
    }
  }

  let cursor = 0;
  let nextContent = "";
  for (const range of sortedRanges) {
    nextContent += originalContent.slice(cursor, range.start);
    nextContent += range.edit.replacement;
    cursor = range.end;
  }
  nextContent += originalContent.slice(cursor);

  const appliedEdits = ranges.map((range) => {
    const singleEditContent = `${originalContent.slice(0, range.start)}${range.edit.replacement}${originalContent.slice(range.end)}`;
    return {
      index: range.index,
      kind: range.kind,
      occurrence: range.edit.occurrence,
      startLine: range.edit.startLine ?? null,
      endLine: range.edit.endLine ?? null,
      originalStart: range.start,
      originalEnd: range.end,
      searchBytes: Buffer.byteLength(range.edit.search ?? originalContent.slice(range.start, range.end), "utf8"),
      replacementsAvailable: range.replacementsAvailable,
      replacementBytes: Buffer.byteLength(range.edit.replacement, "utf8"),
      changedAtLine: lineNumberForIndex(originalContent, range.start),
      beforeText: originalContent,
      afterText: singleEditContent,
    };
  });

  return {
    nextContent,
    appliedEdits,
    validation: {
      ok: true,
      engine: "openclaw-native-workspace-patch-validation-v0",
      editCount: edits.length,
      checks: {
        allMatchesFound: true,
        originalRangesResolved: true,
        structuredLineRangesResolved: true,
        overlappingEditsRejected: true,
        appliesAgainstOriginalContent: true,
      },
      ranges: appliedEdits.map((edit) => ({
        index: edit.index,
        kind: edit.kind,
        start: edit.originalStart,
        end: edit.originalEnd,
        occurrence: edit.occurrence,
        startLine: edit.startLine,
        endLine: edit.endLine,
        changedAtLine: edit.changedAtLine,
      })),
    },
  };
}

function lineNumberForIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function sanitiseDiffLine(line) {
  const text = typeof line === "string" ? line : "";
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

function buildDiffPreview(oldText, newText, { contextLines = 1, maxPreviewLines = 40 } = {}) {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < oldLines.length - prefix
    && suffix < newLines.length - prefix
    && oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const oldChangedEnd = oldLines.length - suffix;
  const newChangedEnd = newLines.length - suffix;
  const safeContext = Math.max(0, Math.min(Number.isInteger(contextLines) ? contextLines : 1, 3));
  const oldStart = Math.max(0, prefix - safeContext);
  const newStart = Math.max(0, prefix - safeContext);
  const oldEnd = Math.min(oldLines.length, oldChangedEnd + safeContext);
  const newEnd = Math.min(newLines.length, newChangedEnd + safeContext);
  const lines = [];

  for (let index = oldStart; index < prefix; index += 1) {
    lines.push({ type: "context", oldLine: index + 1, newLine: newStart + (index - oldStart) + 1, text: sanitiseDiffLine(oldLines[index]) });
  }
  for (let index = prefix; index < oldChangedEnd; index += 1) {
    lines.push({ type: "remove", oldLine: index + 1, text: sanitiseDiffLine(oldLines[index]) });
  }
  for (let index = prefix; index < newChangedEnd; index += 1) {
    lines.push({ type: "add", newLine: index + 1, text: sanitiseDiffLine(newLines[index]) });
  }
  for (let oldIndex = oldChangedEnd, newIndex = newChangedEnd; oldIndex < oldEnd && newIndex < newEnd; oldIndex += 1, newIndex += 1) {
    lines.push({ type: "context", oldLine: oldIndex + 1, newLine: newIndex + 1, text: sanitiseDiffLine(oldLines[oldIndex]) });
  }

  return {
    format: "bounded-line-diff-v0",
    oldStartLine: oldStart + 1,
    newStartLine: newStart + 1,
    oldLineCount: Math.max(0, oldChangedEnd - prefix),
    newLineCount: Math.max(0, newChangedEnd - prefix),
    contextLines: safeContext,
    previewLineCount: Math.min(lines.length, maxPreviewLines),
    truncated: lines.length > maxPreviewLines,
    lines: lines.slice(0, maxPreviewLines),
  };
}

function buildWorkspacePatchDiffPreview(originalContent, nextContent, appliedEdits, { contextLines = 1 } = {}) {
  if (appliedEdits.length <= 1) {
    return buildDiffPreview(originalContent, nextContent, { contextLines, maxPreviewLines: 40 });
  }

  const hunks = appliedEdits.map((edit) => ({
    editIndex: edit.index,
    ...buildDiffPreview(edit.beforeText, edit.afterText, { contextLines, maxPreviewLines: 16 }),
  }));
  const lines = hunks.flatMap((hunk) => hunk.lines.map((line) => ({
    ...line,
    hunk: hunk.editIndex,
  })));

  return {
    format: "bounded-multi-hunk-line-diff-v0",
    hunkCount: hunks.length,
    contextLines: hunks[0]?.contextLines ?? 0,
    previewLineCount: lines.length,
    truncated: hunks.some((hunk) => hunk.truncated),
    hunks,
    lines,
  };
}

function validateWorkspacePatchDiffPreview(diffPreview, { maxPreviewLines = 64 } = {}) {
  if (diffPreview.truncated) {
    throw new Error("OpenClaw workspace patch diff preview exceeds the bounded per-hunk preview limit.");
  }
  if ((diffPreview.previewLineCount ?? 0) > maxPreviewLines) {
    throw new Error("OpenClaw workspace patch diff preview exceeds the bounded total preview limit.");
  }
  return {
    ok: true,
    engine: "openclaw-native-workspace-patch-preview-validation-v0",
    format: diffPreview.format,
    previewLineCount: diffPreview.previewLineCount ?? 0,
    maxPreviewLines,
    truncated: false,
  };
}

function truncatePatchMetadata(value, maxLength = 240) {
  const text = typeof value === "string" ? value : "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function normalisePatchMetadataList(value, { fallback = [], maxItems = 8, maxLength = 80 } = {}) {
  const items = Array.isArray(value) ? value : fallback;
  return items
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => truncatePatchMetadata(item.trim(), maxLength))
    .slice(0, maxItems);
}

function normaliseRationaleReasons(value, { maxItems = 6 } = {}) {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          id: `reason-${index + 1}`,
          label: truncatePatchMetadata(item, 96),
          detail: truncatePatchMetadata(item, 220),
          contentExposed: false,
        };
      }
      if (!item || typeof item !== "object") {
        return null;
      }
      return {
        id: truncatePatchMetadata(item.id ?? `reason-${index + 1}`, 64),
        label: truncatePatchMetadata(item.label ?? item.title ?? "proposal reason", 96),
        detail: truncatePatchMetadata(item.detail ?? item.summary ?? item.reason ?? "", 220),
        evidence: normalisePatchMetadataList(item.evidence, { maxItems: 4, maxLength: 120 }),
        contentExposed: false,
      };
    })
    .filter(Boolean)
    .slice(0, maxItems);
}

function normaliseSourceSignalSummary(value = {}) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    sourceRegistries: normalisePatchMetadataList(raw.sourceRegistries, { maxItems: 6, maxLength: 120 }),
    matchedTools: Number.isFinite(raw.matchedTools) ? raw.matchedTools : 0,
    matchedSemanticFiles: Number.isFinite(raw.matchedSemanticFiles) ? raw.matchedSemanticFiles : 0,
    promptSemanticFiles: Number.isFinite(raw.promptSemanticFiles) ? raw.promptSemanticFiles : 0,
    targetRelativePath: truncatePatchMetadata(raw.targetRelativePath ?? "", 180) || null,
    primarySymbol: truncatePatchMetadata(raw.primarySymbol ?? "", 120) || null,
    contentExposed: false,
  };
}

function normaliseRationaleBundle(value, fallback = {}) {
  const raw = value && typeof value === "object" ? value : fallback;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  return {
    registry: truncatePatchMetadata(raw.registry ?? "openclaw-rationale-check-bundle-v0", 120),
    summary: truncatePatchMetadata(raw.summary ?? "Source-derived proposal rationale bundle.", 260),
    reasons: normaliseRationaleReasons(raw.reasons),
    sourceSignals: normaliseSourceSignalSummary(raw.sourceSignals),
    contentExposed: false,
  };
}

function normaliseCheckBundle(value, fallback = {}) {
  const raw = value && typeof value === "object" ? value : fallback;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  return {
    registry: truncatePatchMetadata(raw.registry ?? "openclaw-rationale-check-bundle-v0", 120),
    required: normalisePatchMetadataList(raw.required, { maxItems: 10, maxLength: 80 }),
    recommended: normalisePatchMetadataList(raw.recommended, { maxItems: 8, maxLength: 80 }),
    blockedUntilApproval: normalisePatchMetadataList(raw.blockedUntilApproval, { maxItems: 8, maxLength: 100 }),
    contentExposed: false,
  };
}

function normaliseRiskNotes(value, fallback = {}) {
  const raw = value && typeof value === "object" ? value : fallback;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  return {
    registry: truncatePatchMetadata(raw.registry ?? "openclaw-rationale-check-bundle-v0", 120),
    risk: truncatePatchMetadata(raw.risk ?? "high", 40),
    approvalRequired: raw.approvalRequired !== false,
    notes: normalisePatchMetadataList(raw.notes, { maxItems: 8, maxLength: 160 }),
    contentExposed: false,
  };
}

function buildWorkspacePatchProposalEnvelope({
  proposal = null,
  target,
  capability,
  safeEdits,
  diffPreview,
  validation,
} = {}) {
  const raw = proposal && typeof proposal === "object" ? proposal : {};
  const title = truncatePatchMetadata(raw.title ?? raw.summary ?? `Patch ${target.relativePath}`, 120);
  const rationale = truncatePatchMetadata(raw.rationale ?? raw.reason ?? "No rationale supplied.", 320);
  const targetContext = raw.targetContext && typeof raw.targetContext === "object" ? raw.targetContext : {};
  const symbol = truncatePatchMetadata(targetContext.symbol ?? raw.symbol ?? "", 120);
  const fileRole = truncatePatchMetadata(targetContext.fileRole ?? raw.fileRole ?? "", 160);
  const rawEditIntent = raw.editIntent && typeof raw.editIntent === "object" ? raw.editIntent : null;
  const rawSemanticPlan = raw.semanticPlan && typeof raw.semanticPlan === "object" ? raw.semanticPlan : null;
  const expectedChecks = normalisePatchMetadataList(raw.expectedChecks, {
    fallback: ["diff-preview", "approval-required", "filesystem-ledger"],
    maxItems: 8,
    maxLength: 64,
  });

  return {
    id: typeof raw.id === "string" && raw.id ? truncatePatchMetadata(raw.id, 96) : randomUUID(),
    registry: "openclaw-native-workspace-edit-proposal-v0",
    mode: "proposal-envelope",
    title,
    rationale,
    source: truncatePatchMetadata(raw.source ?? "native-openclaw-workspace-patch-adapter", 120),
    targetContext: {
      workspace: target.workspace.name,
      relativePath: target.relativePath,
      symbol: symbol || null,
      fileRole: fileRole || null,
    },
    editIntent: rawEditIntent ? {
      kind: truncatePatchMetadata(rawEditIntent.kind ?? "workspace_edit", 80),
      objective: truncatePatchMetadata(rawEditIntent.objective ?? "", 180),
      planningStyle: truncatePatchMetadata(rawEditIntent.planningStyle ?? "", 80) || null,
      targetSafety: truncatePatchMetadata(rawEditIntent.targetSafety ?? "", 80) || null,
      verificationStyle: normalisePatchMetadataList(rawEditIntent.verificationStyle, { maxItems: 6, maxLength: 64 }),
      contentExposed: false,
    } : null,
    expectedChecks,
    semanticPlan: rawSemanticPlan ? {
      registry: truncatePatchMetadata(rawSemanticPlan.registry ?? "unknown", 120),
      mode: truncatePatchMetadata(rawSemanticPlan.mode ?? "unknown", 120),
      promptFiles: Number.isFinite(rawSemanticPlan.promptFiles) ? rawSemanticPlan.promptFiles : 0,
      expectedChecks: normalisePatchMetadataList(rawSemanticPlan.expectedChecks, { maxItems: 8, maxLength: 64 }),
      contentExposed: false,
    } : null,
    rationaleBundle: normaliseRationaleBundle(raw.rationaleBundle, raw.source === "openclaw-source-derived-edit-proposal-v0" ? {
      registry: "openclaw-rationale-check-bundle-v0",
      summary: rationale,
      reasons: [rationale],
      sourceSignals: {
        sourceRegistries: [raw.source].filter(Boolean),
        targetRelativePath: target.relativePath,
        primarySymbol: symbol,
      },
    } : null),
    checkBundle: normaliseCheckBundle(raw.checkBundle, raw.source === "openclaw-source-derived-edit-proposal-v0" ? {
      registry: "openclaw-rationale-check-bundle-v0",
      required: expectedChecks,
      recommended: ["run targeted milestone checks after approval"],
      blockedUntilApproval: ["filesystem mutation", "workspace write ledger entry"],
    } : null),
    riskNotes: normaliseRiskNotes(raw.riskNotes, raw.source === "openclaw-source-derived-edit-proposal-v0" ? {
      registry: "openclaw-rationale-check-bundle-v0",
      risk: capability.risk,
      approvalRequired: capability.approvalRequired,
      notes: [
        "Patch execution remains approval-gated.",
        "Prompt/source bodies and function bodies remain redacted.",
        "Approved execution still uses act.filesystem.write_text.",
      ],
    } : null),
    dryRun: {
      ok: true,
      editCount: safeEdits.length,
      editKinds: [...new Set(safeEdits.map((edit) => edit.kind))],
      diffFormat: diffPreview.format,
      hunkCount: diffPreview.hunkCount ?? 1,
      previewLineCount: diffPreview.previewLineCount ?? 0,
      validationEngines: [
        validation.structuredPatch.engine,
        validation.preview.engine,
      ],
      contentExposed: false,
    },
    governance: {
      capabilityId: capability.id,
      risk: capability.risk,
      approvalRequired: capability.approvalRequired,
      runtimeOwner: capability.runtimeOwner,
      usesFilesystemWriteCapability: true,
      createsTaskBeforeApproval: false,
    },
  };
}

function buildSourceDerivedProposalBundles({
  sourceSignals,
  expectedChecks,
  relativePath,
  query,
  primarySymbol,
  fileRole,
  capabilityRisk = "high",
} = {}) {
  const sourceRegistries = normalisePatchMetadataList(sourceSignals?.sourceRegistries, { maxItems: 6, maxLength: 120 });
  const matchedTools = sourceSignals?.toolSignals?.matchedTools ?? 0;
  const matchedSemanticFiles = sourceSignals?.semanticSignals?.matchedFiles ?? 0;
  const promptSemanticFiles = sourceSignals?.promptSignals?.matchedFiles ?? 0;
  const promptChecks = sourceSignals?.promptSignals?.expectedChecks ?? [];
  const requiredChecks = normalisePatchMetadataList([
    ...expectedChecks,
    "patch-validation",
    "diff-preview",
    "approval-required",
    "filesystem-ledger",
  ], { maxItems: 10, maxLength: 80 });
  const verificationChecks = requiredChecks.filter((check) => ["typecheck", "test", "lint", "verify"].includes(check));

  return {
    rationaleBundle: {
      registry: "openclaw-rationale-check-bundle-v0",
      summary: `Rationale for source-derived edit proposal targeting ${relativePath}.`,
      reasons: [
        {
          id: "tool-catalog-signal",
          label: "Enhanced OpenClaw tool catalog matched the edit query.",
          detail: `Query "${query}" matched ${matchedTools} redacted tool metadata entries; no tool module was imported or executed.`,
          evidence: sourceRegistries,
        },
        {
          id: "semantic-target-signal",
          label: "Semantic index identified a bounded workspace target.",
          detail: `Target ${relativePath} is associated with ${primarySymbol || "no exported symbol"} and role ${fileRole || "openclaw source signal"}.`,
          evidence: [`semanticFiles=${matchedSemanticFiles}`, `promptFiles=${promptSemanticFiles}`],
        },
        {
          id: "prompt-check-signal",
          label: "Prompt/tool semantics contributed verification expectations.",
          detail: `Derived checks: ${promptChecks.join(",") || "none"}; prompt bodies remain hidden.`,
          evidence: verificationChecks,
        },
      ],
      sourceSignals: {
        sourceRegistries,
        matchedTools,
        matchedSemanticFiles,
        promptSemanticFiles,
        targetRelativePath: relativePath,
        primarySymbol,
      },
      contentExposed: false,
    },
    checkBundle: {
      registry: "openclaw-rationale-check-bundle-v0",
      required: requiredChecks,
      recommended: normalisePatchMetadataList([
        verificationChecks.length > 0 ? "run prompt-derived verification checks" : "run project verification command",
        "inspect Observer diff preview before approval",
        "run targeted milestone checks after merge",
      ], { maxItems: 6, maxLength: 90 }),
      blockedUntilApproval: [
        "filesystem mutation",
        "workspace write ledger entry",
        "operator execution of generated patch task",
      ],
      contentExposed: false,
    },
    riskNotes: {
      registry: "openclaw-rationale-check-bundle-v0",
      risk: capabilityRisk,
      approvalRequired: true,
      notes: [
        "This proposal is derived from redacted source, prompt, and semantic signals only.",
        "No enhanced OpenClaw source module is imported or executed by this adapter.",
        "Patch execution remains explicit-approval gated and writes through act.filesystem.write_text.",
        "Observer output must not expose prompt bodies, source file bodies, search text, or replacement text.",
      ],
      contentExposed: false,
    },
  };
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

function buildNativePluginCapabilityInvokePlan({ packagePath = null, capabilityId = "act.plugin.capability.invoke" } = {}) {
  const manifestProfile = buildNativePluginManifestProfile({ packagePath });
  const nativeRegistry = createOpenClawNativePluginRegistry();
  const pluginItem = nativeRegistry.items.find((entry) => entry.id === manifestProfile.plugin.id) ?? null;
  const capability = pluginItem?.contract?.capabilities?.find((entry) => entry.id === capabilityId) ?? null;
  if (!capability) {
    throw new Error(`Native plugin capability ${capabilityId} is not registered in the OpenClaw native plugin registry.`);
  }

  const now = new Date().toISOString();
  const policyRequest = {
    intent: "plugin.capability.invoke",
    domain: capability.domains?.includes("cross_boundary") ? "cross_boundary" : capability.domains?.[0] ?? "body_internal",
    risk: capability.risk,
    requiresApproval: true,
    tags: ["native_plugin_adapter", "plugin_capability_invoke", "explicit_approval_required"],
  };
  const policyDecision = {
    id: randomUUID(),
    at: now,
    engine: "native-plugin-invoke-plan-v0",
    stage: "native_plugin.invoke.plan",
    subject: {
      taskId: null,
      type: "native_plugin_capability",
      goal: `Plan governed invocation for ${capability.id}`,
      targetUrl: null,
      intent: policyRequest.intent,
    },
    domain: policyRequest.domain,
    risk: capability.risk,
    decision: "require_approval",
    reason: "native_plugin_capability_invoke_requires_explicit_user_approval",
    approved: false,
    autonomyMode,
    autonomous: false,
  };

  return {
    registry: "openclaw-native-plugin-invoke-plan-v0",
    mode: "plan-only",
    generatedAt: now,
    sourceRegistry: manifestProfile.registry,
    sourceMode: manifestProfile.mode,
    plugin: {
      id: manifestProfile.plugin.id,
      packageName: manifestProfile.plugin.packageName,
      hasTypes: manifestProfile.plugin.hasTypes,
      hasExports: manifestProfile.plugin.hasExports,
      exportKeys: manifestProfile.plugin.exportKeys,
      scriptNames: manifestProfile.plugin.scriptNames,
      dependencySummary: manifestProfile.plugin.dependencySummary,
    },
    capability: {
      id: capability.id,
      kind: capability.kind,
      risk: capability.risk,
      domains: capability.domains,
      runtimeOwner: capability.runtimeOwner,
      approvalRequired: capability.approval?.required === true,
      approvalReason: capability.approval?.reason ?? null,
      audit: capability.audit,
      permissions: capability.permissions,
    },
    policy: {
      request: policyRequest,
      decision: policyDecision,
    },
    draft: {
      goal: `Plan governed invocation for ${capability.id}`,
      type: "native_plugin_capability",
      steps: [
        {
          id: "review_manifest_profile",
          title: "Review manifest profile",
          status: "planned",
          canExecute: false,
          evidence: {
            packageName: manifestProfile.plugin.packageName,
            hasExports: manifestProfile.plugin.hasExports,
            hasTypes: manifestProfile.plugin.hasTypes,
          },
        },
        {
          id: "require_user_approval",
          title: "Require explicit user approval before runtime adapter activation",
          status: "blocked_until_future_task_materialization",
          canExecute: false,
          policyDecision: policyDecision.decision,
        },
        {
          id: "defer_runtime_invoke",
          title: "Defer plugin code execution until a separately approved runtime adapter exists",
          status: "deferred",
          canExecute: false,
        },
      ],
    },
    governance: {
      mode: "native_plugin_invoke_plan_only",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      canMutate: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresExplicitApprovalBeforeTask: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
    blockers: [
      "runtime adapter implementation not approved",
      "task materialization not implemented for plugin capability invocation",
      "explicit user approval not collected",
      "source content review not explicitly approved",
    ],
  };
}

function buildNativePluginRuntimePreflight({ packagePath = null, capabilityId = "act.plugin.capability.invoke" } = {}) {
  const planEnvelope = buildNativePluginCapabilityInvokePlan({ packagePath, capabilityId });
  const capability = planEnvelope.capability ?? {};
  const plugin = planEnvelope.plugin ?? {};
  const policyDecision = planEnvelope.policy?.decision ?? {};

  return {
    ok: true,
    registry: "openclaw-native-plugin-runtime-preflight-v0",
    mode: "preflight-only",
    generatedAt: new Date().toISOString(),
    sourceRegistry: planEnvelope.registry,
    sourceMode: planEnvelope.mode,
    adapter: {
      id: "native-plugin-adapter-v0",
      runtimeOwner: "openclaw_on_nixos",
      status: "preflight_ready_runtime_disabled",
      canLoadPluginModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
    },
    plugin: {
      id: plugin.id ?? null,
      packageName: plugin.packageName ?? null,
      hasTypes: plugin.hasTypes === true,
      hasExports: plugin.hasExports === true,
      exportKeys: plugin.exportKeys ?? [],
      dependencySummary: plugin.dependencySummary ?? {},
    },
    capability: {
      id: capability.id ?? null,
      kind: capability.kind ?? null,
      risk: capability.risk ?? null,
      domains: capability.domains ?? [],
      runtimeOwner: capability.runtimeOwner ?? null,
      approvalRequired: capability.approvalRequired === true,
      permissions: capability.permissions ?? {},
      audit: capability.audit ?? {},
    },
    executionEnvelope: {
      envelopeVersion: "native-plugin-execution-envelope-v0",
      state: "blocked_pending_runtime_adapter",
      adapterId: "native-plugin-adapter-v0",
      pluginId: plugin.id ?? null,
      packageName: plugin.packageName ?? null,
      capabilityId: capability.id ?? null,
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
        reason: capability.approvalReason ?? "Execution and mutation require explicit user approval.",
      },
      audit: {
        required: capability.audit?.required !== false,
        ledger: capability.audit?.ledger ?? "capability_history",
      },
      permissions: capability.permissions ?? {},
      constraints: {
        canReadManifestMetadata: true,
        canReadSourceFileContent: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        canMutate: false,
        canCreateTask: false,
        canCreateApproval: false,
      },
    },
    governance: {
      mode: "native_plugin_runtime_preflight_only",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApprovalBeforeExecution: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

function buildNativePluginRuntimeActivationPlan({ packagePath = null, capabilityId = "act.plugin.capability.invoke" } = {}) {
  const preflight = buildNativePluginRuntimePreflight({ packagePath, capabilityId });
  const envelope = preflight.executionEnvelope ?? {};
  const constraints = envelope.constraints ?? {};
  const gates = [
    {
      id: "preflight_envelope_ready",
      label: "Runtime preflight envelope is available",
      required: true,
      status: envelope.envelopeVersion === "native-plugin-execution-envelope-v0" ? "passed" : "blocked",
      evidence: `envelope=${envelope.envelopeVersion ?? "missing"}`,
    },
    {
      id: "audit_binding_ready",
      label: "Capability audit ledger is bound",
      required: true,
      status: envelope.audit?.required === true && envelope.audit?.ledger === "capability_history" ? "passed" : "blocked",
      evidence: `ledger=${envelope.audit?.ledger ?? "missing"}`,
    },
    {
      id: "explicit_user_approval_required",
      label: "High-risk plugin invocation requires explicit user approval",
      required: true,
      status: envelope.approval?.required === true ? "passed" : "blocked",
      evidence: `approvalRequired=${Boolean(envelope.approval?.required)} collected=${Boolean(envelope.approval?.collected)}`,
    },
    {
      id: "source_content_review_required",
      label: "Source content review must be separately approved before loading modules",
      required: true,
      status: "blocked",
      evidence: "source content review is not approved in this activation plan",
    },
    {
      id: "runtime_loader_adapter_required",
      label: "Sandboxed runtime loader adapter must be implemented before activation",
      required: true,
      status: "blocked",
      evidence: "no loader/import adapter is active",
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
    registry: "openclaw-native-plugin-runtime-activation-plan-v0",
    mode: "activation-plan-only",
    generatedAt: new Date().toISOString(),
    sourceRegistry: preflight.registry,
    sourceMode: preflight.mode,
    runtimeOwner: "openclaw_on_nixos",
    status: "blocked_pending_runtime_adapter",
    activationReady: false,
    plugin: preflight.plugin,
    capability: preflight.capability,
    executionEnvelope: {
      envelopeVersion: envelope.envelopeVersion ?? null,
      state: envelope.state ?? null,
      capabilityId: envelope.capabilityId ?? null,
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
      canReadSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      nextAllowedWork: [
        "design sandboxed native runtime loader inside OpenClawOnNixOS",
        "map derived source-content signals into native contract tests",
        "materialize runtime activation only through approval-gated tasks",
      ],
      forbiddenWork: [
        "do not import plugin modules from old OpenClaw in this plan",
        "do not execute plugin code during activation planning",
        "do not activate runtime without a future approval-gated task",
      ],
    },
    governance: {
      mode: "native_plugin_runtime_activation_plan_only",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canReadManifestMetadata: constraints.canReadManifestMetadata === true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApprovalBeforeExecution: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

function buildNativePluginRuntimeAdapterContract({ packagePath = null, capabilityId = "act.plugin.capability.invoke" } = {}) {
  const activationPlan = buildNativePluginRuntimeActivationPlan({ packagePath, capabilityId });
  const envelope = activationPlan.executionEnvelope ?? {};
  const plugin = activationPlan.plugin ?? {};
  const capability = activationPlan.capability ?? {};
  const checks = [
    {
      id: "preflight_envelope_bound",
      label: "Runtime adapter contract is bound to native plugin preflight",
      required: true,
      status: envelope.envelopeVersion === "native-plugin-execution-envelope-v0" ? "passed" : "blocked",
      evidence: `envelope=${envelope.envelopeVersion ?? "missing"}`,
    },
    {
      id: "activation_task_chain_available",
      label: "Approval-gated runtime activation task chain exists",
      required: true,
      status: "passed",
      evidence: "runtime activation task, denial/recovery, hardening, persistence, and regression checks are registered",
    },
    {
      id: "source_content_import_blocked",
      label: "Source file content remains unavailable to the runtime contract",
      required: true,
      status: "passed",
      evidence: "canReadSourceFileContent=false",
    },
    {
      id: "module_loader_default_deny",
      label: "Plugin module loading is denied until a future sandbox loader exists",
      required: true,
      status: "passed",
      evidence: "canImportModule=false",
    },
    {
      id: "plugin_execution_blocked",
      label: "Plugin code execution remains blocked by the contract shell",
      required: true,
      status: "passed",
      evidence: "canExecutePluginCode=false",
    },
    {
      id: "runtime_activation_default_deny",
      label: "Runtime activation remains disabled until adapter implementation is approved",
      required: true,
      status: "passed",
      evidence: "canActivateRuntime=false",
    },
    {
      id: "runtime_loader_adapter_required",
      label: "Sandboxed native runtime loader implementation is still required",
      required: true,
      status: "blocked",
      evidence: "no native runtime loader adapter is active",
    },
  ];
  const requiredChecks = checks.filter((check) => check.required);
  const passedRequired = requiredChecks.filter((check) => check.status === "passed").length;
  const blockedRequired = requiredChecks.length - passedRequired;

  return {
    ok: true,
    registry: "openclaw-native-plugin-runtime-adapter-contract-v0",
    mode: "runtime-adapter-contract",
    generatedAt: new Date().toISOString(),
    sourceRegistry: activationPlan.registry,
    sourceMode: activationPlan.mode,
    runtimeOwner: "openclaw_on_nixos",
    status: "contract_ready_runtime_loader_blocked",
    activationReady: false,
    adapter: {
      id: "native-plugin-runtime-adapter-v0",
      runtimeOwner: "openclaw_on_nixos",
      status: "contract_ready_runtime_disabled",
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
    },
    plugin: {
      id: plugin.id ?? null,
      packageName: plugin.packageName ?? null,
      hasTypes: plugin.hasTypes === true,
      hasExports: plugin.hasExports === true,
    },
    capability: {
      id: capability.id ?? capabilityId,
      kind: capability.kind ?? null,
      risk: capability.risk ?? null,
      domains: capability.domains ?? [],
      approvalRequired: capability.approvalRequired === true,
      audit: capability.audit ?? {},
      permissions: capability.permissions ?? {},
    },
    executionEnvelope: {
      envelopeVersion: envelope.envelopeVersion ?? null,
      state: envelope.state ?? null,
      adapterId: envelope.adapterId ?? null,
      capabilityId: envelope.capabilityId ?? null,
      policyDecision: envelope.policyDecision ?? null,
      approval: envelope.approval ?? null,
      audit: envelope.audit ?? null,
    },
    runtimeContract: {
      contractId: "native-plugin-runtime-adapter.v0",
      contractVersion: "openclaw-native-plugin-runtime-adapter-contract-v0",
      state: "contract_ready_not_implemented",
      approval: {
        required: true,
        collected: false,
        reason: "Native plugin runtime adapter implementation must be separately approved before module loading or execution.",
      },
      isolation: {
        processIsolationRequired: true,
        loaderBoundary: "openclaw_on_nixos_owned_adapter",
        oldOpenClawModuleImportAllowed: false,
        pluginModuleImportAllowed: false,
        secretsMounted: false,
      },
      execution: {
        canReadManifestMetadata: true,
        canReadSourceFileContent: false,
        canImportModule: false,
        canExecutePluginCode: false,
        canActivateRuntime: false,
        canMutate: false,
      },
      privacy: {
        readmeContentExposed: false,
        sourceFileContentExposed: false,
        scriptBodiesExposed: false,
        dependencyVersionsExposed: false,
        packageVersionExposed: false,
      },
      audit: {
        required: true,
        ledger: "capability_history",
        activationTaskRequired: true,
        transcriptRequiredBeforeExecution: true,
        recoveryChainRequired: true,
      },
    },
    checks,
    summary: {
      totalChecks: checks.length,
      requiredChecks: requiredChecks.length,
      passedRequired,
      blockedRequired,
      adapterContractReady: passedRequired >= 6,
      runtimeLoaderImplemented: false,
      activationReady: false,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      nextAllowedWork: [
        "implement a sandboxed native runtime loader contract task behind explicit approval",
        "bind any future loader to the native activation task and recovery ledger",
        "add transcript and capability-history coverage before plugin code execution",
      ],
      forbiddenWork: [
        "do not import plugin modules from this contract endpoint",
        "do not execute plugin code or activate runtime from this contract endpoint",
        "do not expose README text, source contents, script bodies, dependency versions, or package versions",
      ],
    },
    governance: {
      mode: "native_plugin_runtime_adapter_contract",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesSourceFileContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      exposesPackageVersions: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApprovalBeforeRuntimeImplementation: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

function buildNativePluginRuntimeAdapterTaskDraft({ packagePath = null, capabilityId = "act.plugin.capability.invoke" } = {}) {
  const adapterContract = buildNativePluginRuntimeAdapterContract({ packagePath, capabilityId });
  const now = new Date().toISOString();
  const plugin = adapterContract.plugin ?? {};
  const capability = adapterContract.capability ?? {};
  const blockedCheckIds = (adapterContract.checks ?? [])
    .filter((check) => check.required === true && check.status === "blocked")
    .map((check) => check.id);
  const policyRequest = {
    intent: "plugin.runtime_adapter_implementation",
    domain: "cross_boundary",
    risk: capability.risk ?? "high",
    requiresApproval: true,
    approved: false,
    capabilityId: capability.id ?? capabilityId,
    tags: ["native_plugin_runtime_adapter", "explicit_approval_required", "runtime_adapter_implementation_deferred"],
  };
  const policyDecision = {
    id: randomUUID(),
    at: now,
    engine: "openclaw-native-plugin-runtime-adapter-task-v0",
    stage: "native_plugin.runtime_adapter.task.materialize",
    subject: {
      taskId: null,
      type: "native_plugin_runtime_adapter_implementation",
      goal: `Prepare approved native plugin runtime adapter implementation shell for ${capability.id ?? capabilityId}`,
      targetUrl: null,
      intent: policyRequest.intent,
    },
    domain: policyRequest.domain,
    risk: policyRequest.risk,
    decision: "require_approval",
    reason: "native_plugin_runtime_adapter_implementation_requires_explicit_user_approval_before_loader_work",
    approved: false,
    autonomyMode,
    autonomous: false,
  };
  const plan = {
    planId: `plan-${randomUUID()}`,
    strategy: "native-plugin-runtime-adapter-v0",
    planner: "openclaw-native-plugin-runtime-adapter-task-v0",
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
        "plan.plugin.runtime_adapter_contract",
        "govern.policy.evaluate",
        capability.id ?? capabilityId,
      ],
      byRisk: {
        low: 1,
        [policyRequest.risk]: 2,
      },
    },
    steps: [
      {
        id: "step-review-native-runtime-adapter-contract",
        kind: "openclaw.native_plugin.runtime_adapter_contract",
        phase: "reviewing_runtime_adapter_contract",
        title: "Review native plugin runtime adapter contract",
        status: "pending",
        capabilityId: "plan.plugin.runtime_adapter_contract",
        risk: "low",
        governance: "audit_only",
        requiresApproval: false,
        params: {
          contractVersion: adapterContract.runtimeContract?.contractVersion ?? null,
          pluginId: plugin.id ?? null,
          packageName: plugin.packageName ?? null,
          capabilityId: capability.id ?? capabilityId,
          blockedCheckIds,
        },
      },
      {
        id: "step-user-approval",
        kind: "approval.gate",
        phase: "waiting_for_approval",
        title: "Wait for explicit user approval before any runtime adapter implementation work",
        status: "pending",
        capabilityId: "govern.policy.evaluate",
        risk: policyRequest.risk,
        governance: "require_approval",
        requiresApproval: true,
      },
      {
        id: "step-defer-native-runtime-adapter-implementation",
        kind: "plugin.runtime_adapter_implementation",
        phase: "runtime_adapter_implementation_deferred",
        title: "Defer native plugin runtime adapter implementation until sandboxed loader work is separately implemented",
        status: "pending",
        capabilityId: capability.id ?? capabilityId,
        risk: policyRequest.risk,
        governance: "require_approval",
        requiresApproval: true,
        params: {
          contractId: adapterContract.runtimeContract?.contractId ?? null,
          contractVersion: adapterContract.runtimeContract?.contractVersion ?? null,
          pluginId: plugin.id ?? null,
          packageName: plugin.packageName ?? null,
          capabilityId: capability.id ?? capabilityId,
          blockedCheckIds,
          canReadSourceFileContent: false,
          canImportModule: false,
          canExecutePluginCode: false,
          canActivateRuntime: false,
        },
      },
    ],
    governance: {
      mode: "native_plugin_runtime_adapter_task_plan",
      runtimeOwner: "openclaw_on_nixos",
      canReadSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApproval: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };

  return {
    ok: true,
    registry: "openclaw-native-plugin-runtime-adapter-task-draft-v0",
    mode: "approval-gated-native-plugin-runtime-adapter-task-draft",
    generatedAt: now,
    sourceRegistry: adapterContract.registry,
    sourceMode: adapterContract.mode,
    plugin,
    capability,
    adapterContract: {
      registry: adapterContract.registry,
      status: adapterContract.status,
      activationReady: adapterContract.activationReady,
      runtimeContract: adapterContract.runtimeContract,
      summary: adapterContract.summary,
      checks: adapterContract.checks,
    },
    plan,
    policy: {
      request: policyRequest,
      decision: policyDecision,
    },
    governance: {
      mode: "native_plugin_runtime_adapter_task_draft",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesSourceFileContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      exposesPackageVersions: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApprovalBeforeRuntimeImplementation: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

function buildNativePluginRuntimeActivationTaskDraft({ packagePath = null, capabilityId = "act.plugin.capability.invoke" } = {}) {
  const activationPlan = buildNativePluginRuntimeActivationPlan({ packagePath, capabilityId });
  const now = new Date().toISOString();
  const capability = activationPlan.capability ?? {};
  const plugin = activationPlan.plugin ?? {};
  const blockedGateIds = (activationPlan.gates ?? [])
    .filter((gate) => gate.required === true && gate.status === "blocked")
    .map((gate) => gate.id);
  const policyRequest = {
    intent: "plugin.runtime_activation",
    domain: "cross_boundary",
    risk: capability.risk ?? "high",
    requiresApproval: true,
    approved: false,
    capabilityId: capability.id ?? capabilityId,
    tags: ["native_plugin_runtime_activation", "explicit_approval_required", "runtime_adapter_deferred"],
  };
  const policyDecision = {
    id: randomUUID(),
    at: now,
    engine: "openclaw-native-plugin-runtime-activation-task-v0",
    stage: "native_plugin.runtime_activation.task.materialize",
    subject: {
      taskId: null,
      type: "native_plugin_runtime_activation",
      goal: `Prepare approved native plugin runtime activation for ${capability.id ?? capabilityId}`,
      targetUrl: null,
      intent: policyRequest.intent,
    },
    domain: policyRequest.domain,
    risk: policyRequest.risk,
    decision: "require_approval",
    reason: "native_plugin_runtime_activation_requires_explicit_user_approval_before_runtime_enablement",
    approved: false,
    autonomyMode,
    autonomous: false,
  };
  const plan = {
    planId: `plan-${randomUUID()}`,
    strategy: "native-plugin-runtime-activation-v0",
    planner: "openclaw-native-plugin-runtime-activation-task-v0",
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
        "plan.openclaw.native_plugin_runtime_activation",
        "govern.policy.evaluate",
        capability.id ?? capabilityId,
      ],
      byRisk: {
        low: 1,
        [policyRequest.risk]: 2,
      },
    },
    steps: [
      {
        id: "step-review-native-runtime-activation-plan",
        kind: "openclaw.native_plugin.runtime_activation_plan",
        phase: "reviewing_runtime_activation_plan",
        title: "Review native plugin runtime activation gates",
        status: "pending",
        capabilityId: "plan.openclaw.native_plugin_runtime_activation",
        risk: "low",
        governance: "audit_only",
        requiresApproval: false,
        params: {
          pluginId: plugin.id ?? null,
          packageName: plugin.packageName ?? null,
          capabilityId: capability.id ?? capabilityId,
          status: activationPlan.status,
          blockedGateIds,
        },
      },
      {
        id: "step-user-approval",
        kind: "approval.gate",
        phase: "waiting_for_approval",
        title: "Wait for explicit user approval before any native plugin runtime activation attempt",
        status: "pending",
        capabilityId: "govern.policy.evaluate",
        risk: policyRequest.risk,
        governance: "require_approval",
        requiresApproval: true,
      },
      {
        id: "step-defer-native-runtime-activation",
        kind: "plugin.runtime_activation",
        phase: "runtime_activation_deferred",
        title: "Defer native plugin runtime activation until sandboxed runtime loader exists",
        status: "pending",
        capabilityId: capability.id ?? capabilityId,
        risk: policyRequest.risk,
        governance: "require_approval",
        requiresApproval: true,
        params: {
          pluginId: plugin.id ?? null,
          packageName: plugin.packageName ?? null,
          capabilityId: capability.id ?? capabilityId,
          blockedGateIds,
          canReadSourceFileContent: false,
          canImportModule: false,
          canExecutePluginCode: false,
          canActivateRuntime: false,
        },
      },
    ],
    governance: {
      mode: "native_plugin_runtime_activation_task_plan",
      runtimeOwner: "openclaw_on_nixos",
      canReadSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApproval: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };

  return {
    ok: true,
    registry: "openclaw-native-plugin-runtime-activation-task-draft-v0",
    mode: "approval-gated-native-plugin-runtime-activation-task-draft",
    generatedAt: now,
    sourceRegistry: activationPlan.registry,
    sourceMode: activationPlan.mode,
    plugin,
    capability,
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
      mode: "native_plugin_runtime_activation_task_draft",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: false,
      createsApproval: false,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      requiresExplicitApprovalBeforeRuntimeActivation: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

function buildNativePluginInvokeTaskPlan(planEnvelope) {
  const now = new Date().toISOString();
  const capability = planEnvelope.capability ?? {};
  const steps = [
    {
      id: "step-review-manifest-profile",
      kind: "plugin.manifest.profile",
      phase: "reviewing_manifest_profile",
      title: "Review native plugin manifest profile",
      status: "pending",
      capabilityId: "sense.plugin.manifest_profile",
      risk: "low",
      governance: "audit_only",
      requiresApproval: false,
    },
    {
      id: "step-user-approval",
      kind: "approval.gate",
      phase: "waiting_for_approval",
      title: "Wait for explicit user approval",
      status: "pending",
      capabilityId: "govern.policy.evaluate",
      risk: capability.risk ?? "high",
      governance: "require_approval",
      requiresApproval: true,
    },
    {
      id: "step-defer-runtime-invoke",
      kind: "plugin.capability.invoke",
      phase: "runtime_adapter_deferred",
      title: "Defer plugin capability execution until runtime adapter exists",
      status: "pending",
      capabilityId: capability.id ?? "act.plugin.capability.invoke",
      risk: capability.risk ?? "high",
      governance: "require_approval",
      requiresApproval: true,
      params: {
        pluginId: planEnvelope.plugin?.id ?? null,
        packageName: planEnvelope.plugin?.packageName ?? null,
      },
    },
  ];

  return {
    planId: `plan-${randomUUID()}`,
    strategy: "native-plugin-invoke-v0",
    planner: "native-plugin-invoke-plan-v0",
    capabilityAware: true,
    status: "planned",
    goal: planEnvelope.draft?.goal ?? `Plan governed invocation for ${capability.id ?? "act.plugin.capability.invoke"}`,
    targetUrl: null,
    intent: "plugin.capability.invoke",
    createdAt: now,
    updatedAt: now,
    capabilitySummary: {
      total: 3,
      approvalGates: 2,
      ids: [
        "sense.plugin.manifest_profile",
        "govern.policy.evaluate",
        capability.id ?? "act.plugin.capability.invoke",
      ],
      byRisk: {
        low: 1,
        [capability.risk ?? "high"]: 2,
      },
    },
    steps,
    governance: {
      mode: "native_plugin_invoke_task_plan",
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresExplicitApproval: true,
    },
  };
}

async function createNativePluginRuntimeActivationTask({
  packagePath = null,
  capabilityId = "act.plugin.capability.invoke",
  confirm = false,
} = {}) {
  if (confirm !== true) {
    throw new Error("Native plugin runtime activation task creation requires confirm=true.");
  }

  const draft = buildNativePluginRuntimeActivationTaskDraft({ packagePath, capabilityId });
  const task = createTask({
    goal: draft.plan.goal,
    type: "native_plugin_runtime_activation",
    workViewStrategy: "native-plugin-runtime-activation",
    plan: draft.plan,
    policy: draft.policy.request,
  }, { skipInitialPolicy: true });
  task.policy = draft.policy;
  const approval = createApprovalRequestForTask(task, draft.policy.decision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent("task.created", { task: serialiseTask(task), planner: "openclaw-native-plugin-runtime-activation-task-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    ok: true,
    registry: "openclaw-native-plugin-runtime-activation-task-v0",
    mode: "approval-gated-native-plugin-runtime-activation-task",
    generatedAt: new Date().toISOString(),
    sourceRegistry: draft.registry,
    sourceMode: draft.mode,
    plugin: draft.plugin,
    capability: draft.capability,
    activationPlan: draft.activationPlan,
    task,
    approval,
    governance: {
      mode: "native_plugin_runtime_activation_task_approval_gated",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      executed: false,
      requiresExplicitApprovalBeforeRuntimeActivation: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

async function createNativePluginRuntimeAdapterTask({
  packagePath = null,
  capabilityId = "act.plugin.capability.invoke",
  confirm = false,
} = {}) {
  if (confirm !== true) {
    throw new Error("Native plugin runtime adapter task creation requires confirm=true.");
  }

  const draft = buildNativePluginRuntimeAdapterTaskDraft({ packagePath, capabilityId });
  const task = createTask({
    goal: draft.plan.goal,
    type: "native_plugin_runtime_adapter_implementation",
    workViewStrategy: "native-plugin-runtime-adapter",
    plan: draft.plan,
    policy: draft.policy.request,
  }, { skipInitialPolicy: true });
  task.policy = draft.policy;
  const approval = createApprovalRequestForTask(task, draft.policy.decision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent("task.created", { task: serialiseTask(task), planner: "openclaw-native-plugin-runtime-adapter-task-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    ok: true,
    registry: "openclaw-native-plugin-runtime-adapter-task-v0",
    mode: "approval-gated-native-plugin-runtime-adapter-task",
    generatedAt: new Date().toISOString(),
    sourceRegistry: draft.registry,
    sourceMode: draft.mode,
    plugin: draft.plugin,
    capability: draft.capability,
    adapterContract: draft.adapterContract,
    task,
    approval,
    governance: {
      mode: "native_plugin_runtime_adapter_task_approval_gated",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesSourceFileContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      exposesPackageVersions: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      canMutate: false,
      executed: false,
      requiresExplicitApprovalBeforeRuntimeImplementation: true,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

async function createNativePluginInvokeTask({ packagePath = null, capabilityId = "act.plugin.capability.invoke", confirm = false } = {}) {
  if (confirm !== true) {
    throw new Error("Native plugin invoke task creation requires confirm=true.");
  }

  const planEnvelope = buildNativePluginCapabilityInvokePlan({ packagePath, capabilityId });
  const task = createTask({
    goal: planEnvelope.draft.goal,
    type: "native_plugin_capability",
    workViewStrategy: "native-plugin-adapter",
    plan: buildNativePluginInvokeTaskPlan(planEnvelope),
    policy: planEnvelope.policy.request,
  }, { skipInitialPolicy: true });
  task.policy = planEnvelope.policy;
  const approval = createApprovalRequestForTask(task, planEnvelope.policy.decision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent("task.created", { task: serialiseTask(task), planner: "native-plugin-invoke-plan-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    registry: "openclaw-native-plugin-invoke-task-v0",
    mode: "approval-gated",
    generatedAt: new Date().toISOString(),
    sourceRegistry: planEnvelope.registry,
    sourceMode: planEnvelope.mode,
    plugin: planEnvelope.plugin,
    capability: planEnvelope.capability,
    task,
    approval,
    governance: {
      mode: "native_plugin_invoke_task_approval_gated",
      runtimeOwner: "openclaw_on_nixos",
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      canReadManifestMetadata: true,
      canReadSourceFileContent: false,
      exposesReadmeContent: false,
      exposesScriptBodies: false,
      exposesDependencyVersions: false,
      canMutate: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      executed: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

function findWorkspaceCommandProposal({ proposalId = null, workspaceId = null, scriptName = null } = {}) {
  const proposals = buildWorkspaceCommandProposals();
  const match = proposals.items.find((item) => {
    if (proposalId && item.id === proposalId) {
      return true;
    }
    return workspaceId && scriptName && item.workspaceId === workspaceId && item.scriptName === scriptName;
  }) ?? null;

  return {
    proposals,
    proposal: match,
  };
}

function buildWorkspaceCommandPlanDraft({ proposalId = null, workspaceId = null, scriptName = null } = {}) {
  const { proposals, proposal } = findWorkspaceCommandProposal({ proposalId, workspaceId, scriptName });
  if (!proposal) {
    throw new Error("Workspace command proposal was not found.");
  }

  const now = new Date().toISOString();
  const goal = `Review execution plan for ${proposal.workspaceName}:${proposal.scriptName}`;
  const policyRequest = {
    intent: "system.command.execute",
    domain: "body_internal",
    risk: proposal.risk,
    requiresApproval: true,
    tags: ["workspace_command", "explicit_approval_required"],
  };
  const action = {
    kind: "system.command.execute",
    intent: "system.command.execute",
    params: {
      command: proposal.command,
      args: proposal.args,
      cwd: proposal.cwd,
      timeoutMs: proposal.risk === "medium" ? 300000 : 120000,
    },
  };
  const plan = buildRulePlan({
    goal,
    type: "system_task",
    intent: "system.command.execute",
    policy: policyRequest,
    targetUrl: null,
    actions: [action],
  });
  const policyDecision = {
    id: randomUUID(),
    at: now,
    engine: "workspace-command-plan-v0",
    stage: "workspace.command.plan",
    subject: {
      taskId: null,
      type: "system_task",
      goal,
      targetUrl: null,
      intent: "system.command.execute",
    },
    domain: "body_internal",
    risk: proposal.risk,
    decision: "require_approval",
    reason: "workspace_command_requires_explicit_user_approval",
    approved: false,
    autonomyMode,
    autonomous: false,
  };

  return {
    registry: "workspace-command-plan-draft-v0",
    mode: "plan-only",
    generatedAt: now,
    sourceRegistry: proposals.registry,
    proposal,
    draft: {
      goal,
      type: "system_task",
      action,
      plan,
      policy: {
        request: policyRequest,
        decision: policyDecision,
      },
      governance: {
        createsTask: false,
        createsApproval: false,
        canExecute: false,
        requiresExplicitApproval: true,
        exposesScriptBody: false,
      },
    },
  };
}

function findSourceCommandProposal({
  proposalId = null,
  workspaceId = null,
  scriptName = null,
  workspacePath = null,
  query = "command",
} = {}) {
  const proposals = buildOpenClawSourceCommandProposals({ workspacePath, query });
  const match = proposals.items.find((item) => {
    if (proposalId && item.id === proposalId) {
      return true;
    }
    return workspaceId && scriptName && item.workspaceId === workspaceId && item.scriptName === scriptName;
  }) ?? null;

  return {
    proposals,
    proposal: match,
  };
}

function buildOpenClawSourceCommandPlanDraft({
  proposalId = null,
  workspaceId = null,
  scriptName = null,
  workspacePath = null,
  query = "command",
} = {}) {
  const { proposals, proposal } = findSourceCommandProposal({
    proposalId,
    workspaceId,
    scriptName,
    workspacePath,
    query,
  });
  if (!proposal) {
    throw new Error("OpenClaw source command proposal was not found.");
  }
  const draft = buildWorkspaceCommandPlanDraft({ proposalId: proposal.id });
  const sourceCommandPlan = {
    registry: "openclaw-source-command-plan-draft-v0",
    mode: "plan-only-source-command",
    sourceProposalRegistry: proposals.registry,
    sourceSignalsRegistry: proposals.sourceCommandSignals?.registry ?? "openclaw-source-command-proposals-v0",
    workspacePlanRegistry: draft.registry,
    proposalId: proposal.id,
    commandShape: {
      command: proposal.command,
      args: proposal.args,
      cwd: proposal.cwd,
      usesShell: proposal.usesShell === true,
    },
    contentExposed: false,
  };

  return {
    ...draft,
    registry: "openclaw-source-command-plan-draft-v0",
    mode: "plan-only-source-command",
    sourceRegistry: proposals.registry,
    sourceCommandProposal: proposal,
    sourceCommandSignals: proposals.sourceCommandSignals,
    sourceCommandPlan,
    draft: {
      ...draft.draft,
      governance: {
        ...(draft.draft?.governance ?? {}),
        mode: "source_command_plan_only",
        sourceAbsorptionMode: "plan_only",
        createsTask: false,
        createsApproval: false,
        canExecute: false,
        canMutate: false,
        requiresExplicitApproval: true,
        exposesScriptBody: false,
        exposesPromptContent: false,
        exposesSourceFileContent: false,
      },
    },
    governance: {
      mode: "source_command_plan_only",
      runtimeOwner: "openclaw_on_nixos",
      sourceProposalRegistry: proposals.registry,
      canExecute: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      exposesScriptBodies: false,
      exposesPromptContent: false,
      exposesSourceFileContent: false,
      requiresExplicitApprovalBeforeExecution: true,
    },
  };
}

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

function normaliseSystemdRepairUnit(value) {
  const unit = typeof value === "string" && value.trim()
    ? value.trim()
    : "openclaw-browser-runtime.service";
  return unit.endsWith(".service") ? unit : `${unit}.service`;
}

async function buildSystemdRepairExecutionTaskDraft({ unit = null, execute = false } = {}) {
  const targetUnit = normaliseSystemdRepairUnit(unit);
  const realExecution = execute === true;
  if (realExecution && targetUnit !== SYSTEMD_REPAIR_REAL_EXECUTION_UNIT) {
    throw new Error(`Real systemd repair execution is limited to ${SYSTEMD_REPAIR_REAL_EXECUTION_UNIT}.`);
  }
  const dryRunEnvelope = await fetchJson(`${systemSenseUrl}/system/systemd/repair-dry-run?unit=${encodeURIComponent(targetUnit)}`);
  const plan = dryRunEnvelope.plan;
  const command = dryRunEnvelope.dryRun;
  const goal = realExecution
    ? `Operator-reviewed real systemd repair execution for ${targetUnit}`
    : `Operator-reviewed systemd repair execution task for ${targetUnit}`;
  const policyRequest = {
    intent: "systemd.repair.execute",
    domain: "body_internal",
    risk: "high",
    requiresApproval: true,
    audit: true,
    tags: ["systemd", "repair", "host_mutation_candidate", "operator_reviewed"],
  };
  const policyDecision = evaluatePolicyIntent({
    type: "systemd_repair_execution_task",
    goal,
    policy: policyRequest,
  }, {
    stage: "systemd_repair_execution_task.draft",
    type: "systemd_repair_execution_task",
    goal,
  });

  return {
    registry: SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY,
    mode: realExecution ? "operator-reviewed-real-execution-task-draft" : "operator-reviewed-execution-task-draft",
    generatedAt: new Date().toISOString(),
    sourceRegistry: dryRunEnvelope.registry,
    target: dryRunEnvelope.target,
    repairPlan: plan,
    dryRunEnvelope,
    draft: {
      goal,
      type: "systemd_repair_execution_task",
      workViewStrategy: "systemd-repair-execution",
      plan: {
        planner: "systemd-repair-execution-task-v0",
        strategy: "operator-reviewed-systemd-repair-execution-task",
        summary: `Create an approval-gated task for ${targetUnit}; do not execute until operator approval.`,
        steps: [
          {
            id: "review-evidence",
            phase: "review_repair_evidence",
            title: "Review inventory, repair plan, and dry-run envelope",
            status: "pending",
            targetUnit,
            requiresApproval: false,
          },
          {
            id: "operator-approval",
            phase: "waiting_for_approval",
            title: "Wait for operator approval before any host mutation",
            status: "pending",
            capabilityId: "act.system.heal",
            requiresApproval: true,
            risk: "high",
          },
          {
            id: realExecution ? "execute-systemd-restart" : "defer-real-execution",
            phase: realExecution ? "operator_reviewed_real_execution" : "deferred_execution_shell",
            title: realExecution
              ? "Execute operator-approved systemd restart for the selected OpenClaw body unit"
              : "Defer real systemd restart to a future execution milestone",
            status: "pending",
            command: command?.command ?? "systemctl",
            args: command?.args ?? ["restart", targetUnit],
            requiresApproval: true,
            hostMutation: realExecution,
          },
        ],
      },
      policy: {
        request: policyRequest,
        decision: policyDecision,
      },
      systemdRepair: {
        registry: SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY,
        sourceRegistry: dryRunEnvelope.registry,
        inventoryRegistry: dryRunEnvelope.source?.inventoryRegistry ?? plan?.source?.inventoryRegistry ?? null,
        planRegistry: dryRunEnvelope.source?.planRegistry ?? plan?.registry ?? null,
        target: dryRunEnvelope.target,
        command: {
          command: command?.command ?? "systemctl",
          args: command?.args ?? ["restart", targetUnit],
          wouldExecute: realExecution,
        },
        evidence: {
          plan,
          dryRunEnvelope,
        },
        execution: {
          shellOnly: !realExecution,
          realExecutionEnabled: realExecution,
          executed: false,
          hostMutation: false,
          hostMutationAttempted: false,
          futureExecutionRequiresSeparateMilestone: !realExecution,
          selectedRealExecutionUnit: realExecution ? SYSTEMD_REPAIR_REAL_EXECUTION_UNIT : null,
          authDelegation: SYSTEMD_REPAIR_RESTART_HELPER
            ? {
                mode: SYSTEMD_REPAIR_AUTH_DELEGATION ?? "external-fixed-helper",
                helperConfigured: true,
                passwordlessExpected: SYSTEMD_REPAIR_AUTH_DELEGATION === "sudo-nopasswd-fixed-helper",
                scope: "restart openclaw-browser-runtime.service only",
              }
            : {
                mode: "direct-systemctl",
                helperConfigured: false,
                passwordlessExpected: false,
                scope: "host policy decides whether authentication is required",
              },
        },
      },
    },
    governance: {
      createsTask: false,
      createsApproval: false,
      canExecuteWithoutApproval: false,
      executed: false,
      hostMutation: false,
      realExecutionEnabled: realExecution,
      requiresExplicitApproval: true,
      linkedEvidence: ["openclaw-systemd-unit-inventory-v0", "openclaw-systemd-repair-plan-v0", "openclaw-systemd-repair-dry-run-v0"],
    },
  };
}

async function createSystemdRepairExecutionTask({ unit = null, confirm = false, execute = false } = {}) {
  if (confirm !== true) {
    throw new Error("Systemd repair execution task creation requires confirm=true.");
  }

  const draftEnvelope = await buildSystemdRepairExecutionTaskDraft({ unit, execute });
  const draft = draftEnvelope.draft;
  const task = createTask({
    goal: draft.goal,
    type: draft.type,
    workViewStrategy: draft.workViewStrategy,
    plan: draft.plan,
    policy: draft.policy.request,
    systemdRepair: draft.systemdRepair,
  }, { skipInitialPolicy: true });
  task.policy = draft.policy;
  const approval = createApprovalRequestForTask(task, draft.policy.decision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent("task.created", { task: serialiseTask(task), planner: draft.plan?.planner ?? "systemd-repair-execution-task-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    registry: SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY,
    mode: execute === true ? "operator-reviewed-real-execution-task" : "operator-reviewed-execution-task",
    generatedAt: new Date().toISOString(),
    sourceRegistry: draftEnvelope.sourceRegistry,
    target: draftEnvelope.target,
    task,
    approval,
    repairPlan: draftEnvelope.repairPlan,
    dryRunEnvelope: draftEnvelope.dryRunEnvelope,
    governance: {
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      executed: false,
      hostMutation: false,
      realExecutionEnabled: execute === true,
      requiresExplicitApproval: true,
      futureExecutionRequiresSeparateMilestone: execute !== true,
    },
  };
}

async function createSystemdRepairCandidateTaskShell({ confirm = false } = {}) {
  if (confirm !== true) {
    throw new Error("Systemd repair candidate task shell creation requires confirm=true.");
  }

  const routeGate = await fetchJson(`${systemSenseUrl}/system/systemd/repair-candidate-task-route`);
  if (routeGate.routeDecision?.existingRouteAvailable !== true) {
    throw new Error("Selected repair candidate is not covered by an existing operator-reviewed task route.");
  }
  const targetUnit = routeGate.routeDecision?.targetUnit ?? null;
  const shell = await createSystemdRepairExecutionTask({
    unit: targetUnit,
    confirm: true,
    execute: false,
  });
  shell.task.systemdRepairCandidate = {
    registry: "openclaw-systemd-repair-candidate-task-shell-v0",
    routeRegistry: routeGate.registry,
    candidatePlanRegistry: routeGate.source?.candidatePlanRegistry ?? null,
    targetUnit,
    existingRoute: routeGate.routeDecision?.existingRoute ?? null,
  };
  persistState();

  return {
    registry: "openclaw-systemd-repair-candidate-task-shell-v0",
    mode: "approval-gated-candidate-task-shell",
    generatedAt: new Date().toISOString(),
    sourceRegistry: routeGate.registry,
    routeGate,
    task: shell.task,
    approval: shell.approval,
    governance: {
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      executed: false,
      hostMutation: false,
      realExecutionEnabled: false,
      requiresExplicitApproval: true,
      reusesExistingOperatorReviewedRoute: true,
    },
  };
}

async function createSystemdNextRepairTaskShell({ confirm = false, execute = false } = {}) {
  if (confirm !== true) {
    throw new Error("Next systemd repair task shell creation requires confirm=true.");
  }

  const routeGate = await fetchJson(`${systemSenseUrl}/system/systemd/next-repair-task-route`);
  if (routeGate.routeDecision?.taskShellAllowed !== true
    || routeGate.routeDecision?.selectedSlice !== "openclaw-systemd-next-repair-task-shell"
    || routeGate.routeDecision?.targetUnit !== "openclaw-system-sense.service") {
    throw new Error("Next systemd repair task shell requires the approved task route for openclaw-system-sense.service.");
  }

  const dryRunEvidence = routeGate.evidence ?? {};
  const targetUnit = routeGate.routeDecision.targetUnit;
  const command = {
    command: dryRunEvidence.command ?? "systemctl",
    args: Array.isArray(dryRunEvidence.args) && dryRunEvidence.args.length > 0
      ? dryRunEvidence.args
      : ["restart", targetUnit],
    wouldExecute: execute === true,
  };
  const registry = execute === true
    ? SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY
    : SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY;
  const goal = execute === true
    ? `Operator-approved real next OpenClaw systemd repair execution for ${targetUnit}`
    : `Approval-gated next OpenClaw systemd repair task shell for ${targetUnit}`;
  const policyRequest = {
    intent: "systemd.next_repair.execute",
    domain: "body_internal",
    risk: "high",
    requiresApproval: true,
    audit: true,
    tags: ["systemd", "repair", "host_mutation_candidate", "operator_reviewed", "next_repair"],
  };
  const policyDecision = evaluatePolicyIntent({
    type: "systemd_next_repair_task",
    goal,
    policy: policyRequest,
  }, {
    stage: "systemd_next_repair_task_shell.draft",
    type: "systemd_next_repair_task",
    goal,
  });
  const plan = {
    planner: execute === true ? "systemd-next-repair-real-execution-v0" : "systemd-next-repair-task-shell-v0",
    strategy: execute === true ? "operator-reviewed-next-systemd-repair-real-execution" : "approval-gated-next-systemd-repair-task-shell",
    summary: execute === true
      ? `Create a queued approval-gated real execution task for ${targetUnit}; execute only after explicit approval.`
      : `Create a queued approval-gated task shell for ${targetUnit}; do not approve or execute in this milestone.`,
    steps: [
      {
        id: "review-next-repair-route",
        phase: "review_next_repair_route",
        title: "Review next repair route and dry-run evidence",
        status: "pending",
        targetUnit,
        requiresApproval: false,
      },
      {
        id: "operator-approval",
        phase: "waiting_for_approval",
        title: "Wait for operator approval before any systemd action",
        status: "pending",
        capabilityId: "act.system.heal",
        requiresApproval: true,
        risk: "high",
      },
      {
        id: execute === true ? "execute-next-systemd-restart" : "defer-next-repair-execution",
        phase: execute === true ? "next_repair_operator_reviewed_real_execution" : "next_repair_execution_deferred",
        title: execute === true
          ? "Execute operator-approved systemd restart for the selected next OpenClaw body unit"
          : "Defer restart execution to a future route-reviewed milestone",
        status: "pending",
        command: command.command,
        args: command.args,
        requiresApproval: true,
        hostMutation: execute === true,
      },
    ],
  };
  const systemdNextRepair = {
    registry,
    sourceRegistry: routeGate.registry,
    dryRunRegistry: dryRunEvidence.dryRunRegistry ?? null,
    target: {
      unit: targetUnit,
    },
    command,
    evidence: {
      routeGate,
      dryRun: dryRunEvidence,
    },
    execution: {
      shellOnly: execute !== true,
      realExecutionEnabled: execute === true,
      executed: false,
      hostMutation: false,
      hostMutationAttempted: false,
      futureExecutionRequiresSeparateMilestone: execute !== true,
    },
  };
  const task = createTask({
    goal,
    type: "systemd_next_repair_task",
    workViewStrategy: "systemd-next-repair-task",
    plan,
    policy: policyRequest,
    systemdNextRepair,
  }, { skipInitialPolicy: true });
  task.policy = {
    request: policyRequest,
    decision: policyDecision,
  };
  const approval = createApprovalRequestForTask(task, policyDecision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent("task.created", { task: serialiseTask(task), planner: plan.planner });
  await publishTaskApprovalIfPending(task);
  await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    registry,
    mode: execute === true
      ? "operator-reviewed-next-systemd-repair-real-execution-task"
      : "approval-gated-next-systemd-repair-task-shell",
    generatedAt: new Date().toISOString(),
    sourceRegistry: routeGate.registry,
    routeGate,
    task,
    approval,
    governance: {
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      executed: false,
      hostMutation: false,
      realExecutionEnabled: execute === true,
      requiresExplicitApproval: true,
      futureExecutionRequiresSeparateMilestone: execute !== true,
    },
  };
}

async function createBodyEvidenceLedgerDirectoryTaskShell({ confirm = false } = {}) {
  if (confirm !== true) {
    throw new Error("Body evidence ledger directory task shell creation requires confirm=true.");
  }

  const routeReview = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-ledger-storage-root-route-review`);
  if (routeReview.decision?.selectedSlice !== "openclaw-body-evidence-ledger-directory-task"
    || routeReview.evidence?.rootInsideWorkspace !== true) {
    throw new Error("Body evidence ledger directory task shell requires a workspace-bounded storage-root route review.");
  }
  const selectedDisplayPath = routeReview.evidence?.selectedDisplayPath ?? ".artifacts/openclaw-body-evidence-ledger";
  const policyRequest = {
    intent: "body.evidence.ledger.directory.create",
    domain: "body_internal",
    risk: "medium",
    requiresApproval: true,
    audit: true,
    tags: ["body_evidence_ledger", "filesystem", "mkdir", "host_mutation_candidate"],
  };
  const goal = `Create OpenClaw body evidence ledger directory at ${selectedDisplayPath}`;
  const policyDecision = evaluatePolicyIntent({
    type: "body_evidence_ledger_directory_task",
    goal,
    policy: policyRequest,
  }, {
    stage: "body_evidence_ledger_directory_task.draft",
    type: "body_evidence_ledger_directory_task",
    goal,
  });
  const ledgerDirectory = {
    registry: "openclaw-body-evidence-ledger-directory-task-v0",
    routeReviewRegistry: routeReview.registry,
    selectedRootId: routeReview.evidence?.selectedRootId ?? null,
    displayPath: selectedDisplayPath,
    rootInsideWorkspace: routeReview.evidence?.rootInsideWorkspace === true,
    directoryCreated: false,
    durableStorageWritten: false,
    recordWritesEnabled: false,
  };
  const task = createTask({
    goal,
    type: "body_evidence_ledger_directory_task",
    workViewStrategy: "body-evidence-ledger-directory",
    policy: policyRequest,
    plan: {
      planner: "body-evidence-ledger-directory-task-v0",
      strategy: "approval-gated-ledger-directory-task-shell",
      summary: `Create an approval-gated task shell for ${selectedDisplayPath}; do not create the directory until approval.`,
      steps: [
        {
          id: "review-storage-root",
          phase: "review_ledger_storage_root",
          title: "Review the selected workspace-bounded ledger root",
          status: "pending",
          displayPath: selectedDisplayPath,
          requiresApproval: false,
        },
        {
          id: "operator-approval",
          phase: "waiting_for_approval",
          title: "Wait for operator approval before creating the ledger directory",
          status: "pending",
          capabilityId: "act.filesystem.mkdir",
          requiresApproval: true,
          risk: "medium",
        },
        {
          id: "defer-directory-create",
          phase: "deferred_directory_creation_shell",
          title: "Defer mkdir execution to the approved execution milestone",
          status: "pending",
          displayPath: selectedDisplayPath,
          requiresApproval: true,
          executesNow: false,
        },
      ],
    },
  }, { skipInitialPolicy: true });
  task.policy = {
    request: policyRequest,
    decision: policyDecision,
  };
  task.bodyEvidenceLedgerDirectory = ledgerDirectory;
  const approval = createApprovalRequestForTask(task, policyDecision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent("task.created", { task: serialiseTask(task), planner: "body-evidence-ledger-directory-task-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    registry: "openclaw-body-evidence-ledger-directory-task-v0",
    mode: "approval-gated-ledger-directory-task-shell",
    generatedAt: new Date().toISOString(),
    sourceRegistry: routeReview.registry,
    routeReview,
    task,
    approval,
    ledgerDirectory,
    governance: {
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      canCreateDirectory: false,
      canWriteLedger: false,
      executed: false,
      hostMutation: false,
      directoryCreated: false,
      durableStorageWritten: false,
      requiresExplicitApproval: true,
      recordWritesEnabled: false,
    },
  };
}

async function createBodyEvidenceLedgerFirstRecordTaskShell({ confirm = false } = {}) {
  if (confirm !== true) {
    throw new Error("Body evidence ledger first record task shell creation requires confirm=true.");
  }

  const routeReview = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-ledger-first-record-route-review`);
  if (routeReview.decision?.selectedSlice !== "openclaw-body-evidence-ledger-first-record-task"
    || routeReview.evidence?.firstRecordPlanReady !== true
    || routeReview.evidence?.directoryExists !== true
    || routeReview.evidence?.plannedRecordType !== "body_evidence_ledger_bootstrap") {
    throw new Error("Body evidence ledger first record task shell requires a ready first-record route review.");
  }
  const policyRequest = {
    intent: "body.evidence.ledger.record.append",
    domain: "body_internal",
    risk: "medium",
    requiresApproval: true,
    audit: true,
    tags: ["body_evidence_ledger", "append_only", "durable_storage_candidate", "operator_reviewed"],
  };
  const recordType = routeReview.evidence?.plannedRecordType ?? "body_evidence_ledger_bootstrap";
  const goal = `Append first OpenClaw body evidence ledger record of type ${recordType}`;
  const policyDecision = evaluatePolicyIntent({
    type: "body_evidence_ledger_first_record_task",
    goal,
    policy: policyRequest,
  }, {
    stage: "body_evidence_ledger_first_record_task.draft",
    type: "body_evidence_ledger_first_record_task",
    goal,
  });
  const firstRecord = {
    registry: "openclaw-body-evidence-ledger-first-record-task-v0",
    routeReviewRegistry: routeReview.registry,
    plannedRecordType: recordType,
    sourceRegistry: routeReview.evidence?.sourceRegistry ?? null,
    requiredFieldCount: routeReview.evidence?.requiredFieldCount ?? 0,
    directoryExists: routeReview.evidence?.directoryExists === true,
    recordAppended: false,
    durableStorageWritten: false,
    appendExecutionEnabled: false,
  };
  const task = createTask({
    goal,
    type: "body_evidence_ledger_first_record_task",
    workViewStrategy: "body-evidence-ledger-first-record",
    policy: policyRequest,
    plan: {
      planner: "body-evidence-ledger-first-record-task-v0",
      strategy: "approval-gated-ledger-first-record-task-shell",
      summary: `Create an approval-gated task shell for the first ${recordType} ledger append; do not append the record in this milestone.`,
      steps: [
        {
          id: "review-first-record-plan",
          phase: "review_first_record_plan",
          title: "Review planned bootstrap ledger record evidence",
          status: "pending",
          recordType,
          sourceRegistry: firstRecord.sourceRegistry,
          requiresApproval: false,
        },
        {
          id: "operator-approval",
          phase: "waiting_for_approval",
          title: "Wait for operator approval before the first ledger append",
          status: "pending",
          capabilityId: "act.filesystem.append_jsonl",
          requiresApproval: true,
          risk: "medium",
        },
        {
          id: "defer-first-record-append",
          phase: "deferred_first_record_append_shell",
          title: "Defer JSONL append execution to the approved append milestone",
          status: "pending",
          recordType,
          requiresApproval: true,
          executesNow: false,
        },
      ],
    },
  }, { skipInitialPolicy: true });
  task.policy = {
    request: policyRequest,
    decision: policyDecision,
  };
  task.bodyEvidenceLedgerFirstRecord = firstRecord;
  const approval = createApprovalRequestForTask(task, policyDecision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent("task.created", { task: serialiseTask(task), planner: "body-evidence-ledger-first-record-task-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    registry: "openclaw-body-evidence-ledger-first-record-task-v0",
    mode: "approval-gated-ledger-first-record-task-shell",
    generatedAt: new Date().toISOString(),
    sourceRegistry: routeReview.registry,
    routeReview,
    task,
    approval,
    firstRecord,
    governance: {
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      canAppendLedgerRecord: false,
      canWriteLedger: false,
      executed: false,
      hostMutation: false,
      recordAppended: false,
      durableStorageWritten: false,
      requiresExplicitApproval: true,
      appendExecutionEnabled: false,
    },
  };
}

async function createBodyEvidenceLedgerFollowupRecordTaskShell({ confirm = false } = {}) {
  if (confirm !== true) {
    throw new Error("Body evidence ledger follow-up record task shell creation requires confirm=true.");
  }

  const routeReview = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-ledger-followup-record-route-review`);
  if (routeReview.decision?.selectedSlice !== "openclaw-body-evidence-ledger-followup-record-task"
    || routeReview.decision?.status !== "selected"
    || routeReview.evidence?.followupRecordPlanReady !== true
    || routeReview.evidence?.plannedRecordType !== "body_evidence_timeline_followup"
    || routeReview.evidence?.plannedSequence !== 2
    || routeReview.evidence?.existingRecordCount !== 1) {
    throw new Error("Body evidence ledger follow-up record task shell requires a ready follow-up route review.");
  }
  const policyRequest = {
    intent: "body.evidence.ledger.followup_record.append",
    domain: "body_internal",
    risk: "medium",
    requiresApproval: true,
    audit: true,
    tags: ["body_evidence_ledger", "append_only", "followup_record_candidate", "operator_reviewed"],
  };
  const recordType = routeReview.evidence?.plannedRecordType ?? "body_evidence_timeline_followup";
  const plannedSequence = routeReview.evidence?.plannedSequence ?? 2;
  const goal = `Prepare approval-gated follow-up OpenClaw body evidence ledger record ${plannedSequence} of type ${recordType}`;
  const policyDecision = evaluatePolicyIntent({
    type: "body_evidence_ledger_followup_record_task",
    goal,
    policy: policyRequest,
  }, {
    stage: "body_evidence_ledger_followup_record_task.draft",
    type: "body_evidence_ledger_followup_record_task",
    goal,
  });
  const followupRecord = {
    registry: "openclaw-body-evidence-ledger-followup-record-task-v0",
    routeReviewRegistry: routeReview.registry,
    plannedRecordType: recordType,
    plannedSequence,
    existingRecordCount: routeReview.evidence?.existingRecordCount ?? 0,
    latestRecordId: routeReview.evidence?.latestRecordId ?? null,
    sourceRegistry: routeReview.evidence?.sourceRegistry ?? null,
    sourceEndpoint: routeReview.evidence?.sourceEndpoint ?? null,
    preAppendChecks: routeReview.evidence?.preAppendChecks ?? [],
    deferredActions: routeReview.evidence?.deferredActions ?? [],
    recordAppended: false,
    durableStorageWritten: false,
    appendExecutionEnabled: false,
  };
  const task = createTask({
    goal,
    type: "body_evidence_ledger_followup_record_task",
    workViewStrategy: "body-evidence-ledger-followup-record",
    policy: policyRequest,
    plan: {
      planner: "body-evidence-ledger-followup-record-task-v0",
      strategy: "approval-gated-ledger-followup-record-task-shell",
      summary: `Create an approval-gated task shell for follow-up ledger record ${plannedSequence}; do not append the record in this milestone.`,
      steps: [
        {
          id: "review-followup-record-route",
          phase: "review_followup_record_route",
          title: "Review selected follow-up ledger record route",
          status: "pending",
          recordType,
          plannedSequence,
          sourceRegistry: followupRecord.sourceRegistry,
          requiresApproval: false,
        },
        {
          id: "operator-approval",
          phase: "waiting_for_approval",
          title: "Wait for operator approval before any follow-up ledger append",
          status: "pending",
          capabilityId: "act.filesystem.append_jsonl",
          requiresApproval: true,
          risk: "medium",
        },
        {
          id: "defer-followup-record-append",
          phase: "deferred_followup_record_append_shell",
          title: "Defer second JSONL append execution to a later approved append milestone",
          status: "pending",
          recordType,
          plannedSequence,
          requiresApproval: true,
          executesNow: false,
        },
      ],
    },
  }, { skipInitialPolicy: true });
  task.policy = {
    request: policyRequest,
    decision: policyDecision,
  };
  task.bodyEvidenceLedgerFollowupRecord = followupRecord;
  const approval = createApprovalRequestForTask(task, policyDecision);
  const reclaimedTasks = supersedeOtherActiveTasks(task.id);
  reconcileRuntimeState();
  persistState();

  await publishEvent("task.created", { task: serialiseTask(task), planner: "body-evidence-ledger-followup-record-task-v0" });
  await publishTaskApprovalIfPending(task);
  await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
  await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
    task: serialiseTask(reclaimedTask),
  })));

  return {
    registry: "openclaw-body-evidence-ledger-followup-record-task-v0",
    mode: "approval-gated-ledger-followup-record-task-shell",
    generatedAt: new Date().toISOString(),
    sourceRegistry: routeReview.registry,
    routeReview,
    task,
    approval,
    followupRecord,
    governance: {
      createsTask: true,
      createsApproval: true,
      canExecuteWithoutApproval: false,
      canAppendLedgerRecord: false,
      canWriteLedger: false,
      executed: false,
      hostMutation: false,
      recordAppended: false,
      durableStorageWritten: false,
      requiresExplicitApproval: true,
      appendExecutionEnabled: false,
      schedulesFollowUp: false,
      backgroundWriter: false,
      bulkImport: false,
    },
  };
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

function serialisePlanForPublic(plan) {
  if (!plan || typeof plan !== "object") {
    return plan ?? null;
  }
  return {
    ...plan,
    steps: Array.isArray(plan.steps)
      ? plan.steps.map((step) => ({
          ...step,
          params: redactPublicParams(step.params),
        }))
      : plan.steps,
  };
}

function serialiseTask(task) {
  const currentTask = getCurrentTask();
  return {
    id: task.id,
    type: task.type,
    goal: task.goal,
    status: task.status,
    targetUrl: task.targetUrl ?? null,
    workViewStrategy: task.workViewStrategy ?? null,
    plan: serialisePlanForPublic(task.plan),
    policy: task.policy ?? null,
    approval: task.approval ?? null,
    workView: task.workView ?? null,
    lastAction: task.lastAction ?? null,
    outcome: task.outcome ?? null,
    sourceCommand: task.sourceCommand ?? null,
    systemdRepair: task.systemdRepair ?? null,
    systemdNextRepair: task.systemdNextRepair ?? null,
    systemdRepairCandidate: task.systemdRepairCandidate ?? null,
    bodyEvidenceLedgerDirectory: task.bodyEvidenceLedgerDirectory ?? null,
    bodyEvidenceLedgerFirstRecord: task.bodyEvidenceLedgerFirstRecord ?? null,
    bodyEvidenceLedgerFollowupRecord: task.bodyEvidenceLedgerFollowupRecord ?? null,
    recovery: task.recovery ?? null,
    recoveredByTaskId: task.recoveredByTaskId ?? null,
    restorable: isRecoverableTask(task),
    executionPhase: task.executionPhase ?? "queued",
    phaseHistory: task.phaseHistory ?? [],
    createdAt: task.createdAt,
    closedAt: task.closedAt ?? null,
    updatedAt: task.updatedAt,
    isCurrentTask: currentTask?.id === task.id,
    isActive: isActiveTask(task),
  };
}

function normalisePlanActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return [
      { kind: "keyboard.type", params: { text: "hello from openclaw-planner" } },
      { kind: "mouse.click", params: { x: 640, y: 360, button: "left" } },
    ];
  }

  return actions
    .filter((action) => action && typeof action === "object")
    .map((action) => ({
      kind: typeof action.kind === "string" && action.kind.trim() ? action.kind.trim() : "mouse.click",
      intent: typeof action.intent === "string" && action.intent.trim() ? action.intent.trim() : null,
      params: action.params && typeof action.params === "object" ? action.params : {},
      when: action.when && typeof action.when === "object" ? action.when : null,
      onFailure: typeof action.onFailure === "string" && action.onFailure.trim() ? action.onFailure.trim() : null,
    }));
}

function inferPlannerIntent({ intent, policy, type }) {
  const policyIntent = policy && typeof policy === "object" && typeof policy.intent === "string"
    ? policy.intent.trim()
    : "";
  const explicitIntent = typeof intent === "string" ? intent.trim() : "";
  const explicitType = typeof type === "string" ? type.trim() : "";
  return policyIntent || explicitIntent || explicitType || "task.execute";
}

function capabilityById(capabilityId) {
  return baseCapabilities().find((capability) => capability.id === capabilityId) ?? null;
}

function resolvePlanCapabilityId({ kind, intent, plannerIntent }) {
  const candidate = intent || kind || plannerIntent || "";
  const directMap = {
    "work_view.prepare": "act.work_view.control",
    "work_view.reveal": "act.work_view.control",
    "work_view.hide": "act.work_view.control",
    "browser.open": "act.browser.open",
    "network.navigate": "act.browser.open",
    "screen.observe": "sense.screen.observe",
    "keyboard.type": "act.screen.pointer_keyboard",
    "keyboard.hotkey": "act.screen.pointer_keyboard",
    "mouse.click": "act.screen.pointer_keyboard",
    "result.verify": "sense.screen.observe",
    "task.complete": "operate.task.loop",
    "policy.evaluate": "govern.policy.evaluate",
    "approval.gate": "govern.policy.evaluate",
  };

  if (directMap[candidate]) {
    return directMap[candidate];
  }
  if (candidate === "filesystem.mkdir" || candidate === "filesystem.directory.create") {
    return "act.filesystem.mkdir";
  }
  if (candidate === "filesystem.append" || candidate === "filesystem.append_text" || candidate === "filesystem.append-text") {
    return "act.filesystem.append_text";
  }
  if (candidate === "filesystem.write" || candidate === "filesystem.write_text" || candidate === "filesystem.write-text") {
    return "act.filesystem.write_text";
  }
  if (candidate.startsWith("filesystem.")) {
    return "sense.filesystem.read";
  }
  if (candidate.startsWith("process.")) {
    return "sense.process.list";
  }
  if (candidate === "plugin.manifest.profile" || candidate === "plugin.manifest_profile" || candidate === "plugin.profile") {
    return "sense.plugin.manifest_profile";
  }
  if (
    candidate === "openclaw.tool.catalog"
    || candidate === "openclaw.tool_catalog"
    || candidate === "tool.catalog"
    || candidate === "tool_catalog"
  ) {
    return "sense.openclaw.tool_catalog";
  }
  if (
    candidate === "openclaw.plugin.capability_plan"
    || candidate === "openclaw.plugin-capability-plan"
    || candidate === "plugin.capability_plan"
    || candidate === "plugin-capability-plan"
  ) {
    return "plan.openclaw.plugin_capability";
  }
  if (
    candidate === "openclaw.plugin.search_web_contract"
    || candidate === "openclaw.plugin.search-web-contract"
    || candidate === "plugin.search_web.contract"
    || candidate === "plugin.search-web-contract"
  ) {
    return "plan.openclaw.plugin_search_web_adapter_contract";
  }
  if (candidate === "plugin.search_web.invoke" || candidate === "plugin.search-web.invoke") {
    return "boundary.cross_domain.approval";
  }
  if (
    candidate === "openclaw.workspace.semantic_index"
    || candidate === "openclaw.workspace.semantic-index"
    || candidate === "workspace.semantic_index"
    || candidate === "workspace.semantic-index"
    || candidate === "semantic.index"
  ) {
    return "sense.openclaw.workspace_semantic_index";
  }
  if (
    candidate === "openclaw.workspace.symbol_lookup"
    || candidate === "openclaw.workspace.symbol-lookup"
    || candidate === "workspace.symbol_lookup"
    || candidate === "workspace.symbol-lookup"
    || candidate === "symbol.lookup"
  ) {
    return "sense.openclaw.workspace_symbol_lookup";
  }
  if (
    candidate === "openclaw.workspace.write_text"
    || candidate === "openclaw.workspace.write-text"
    || candidate === "openclaw.workspace_text_write"
    || candidate === "workspace.write_text"
    || candidate === "workspace.write-text"
  ) {
    return "act.openclaw.workspace_text_write";
  }
  if (
    candidate === "openclaw.workspace.patch_apply"
    || candidate === "openclaw.workspace.patch-apply"
    || candidate === "openclaw.workspace_patch_apply"
    || candidate === "workspace.patch_apply"
    || candidate === "workspace.patch-apply"
    || candidate === "workspace.edit_apply"
  ) {
    return "act.openclaw.workspace_patch_apply";
  }
  if (candidate === "command.execute" || candidate === "system.command.execute") {
    return "act.system.command.execute";
  }
  if (candidate === "command.plan" || candidate === "system.command" || candidate.startsWith("system.command.")) {
    return "act.system.command.dry_run";
  }
  if (candidate.startsWith("heal.") || candidate === "system.repair") {
    return "act.system.heal";
  }
  if (CROSS_BOUNDARY_INTENTS.has(candidate)) {
    return "boundary.cross_domain.approval";
  }

  const matchedCapability = baseCapabilities().find((capability) => capability.intents?.includes(candidate));
  return matchedCapability?.id ?? "govern.policy.evaluate";
}

function annotatePlanStepWithCapability(step, plannerIntent) {
  const capabilityId = resolvePlanCapabilityId({
    kind: step.kind,
    intent: step.intent,
    plannerIntent,
  });
  const capability = capabilityById(capabilityId);
  if (!capability) {
    return step;
  }

  const requiresApproval = capability.requiresApproval === true || capability.governance === "require_approval";
  return {
    ...step,
    capabilityId: capability.id,
    capability: {
      id: capability.id,
      name: capability.name,
      kind: capability.kind,
      service: capability.service,
    },
    risk: capability.risk,
    governance: capability.governance,
    requiresApproval,
  };
}

function summarisePlanCapabilities(steps) {
  const byId = new Map();
  for (const step of steps) {
    if (!step.capabilityId) {
      continue;
    }
    if (!byId.has(step.capabilityId)) {
      byId.set(step.capabilityId, {
        id: step.capabilityId,
        risk: step.risk ?? "unknown",
        governance: step.governance ?? "unknown",
        requiresApproval: step.requiresApproval === true,
        stepCount: 0,
      });
    }
    const entry = byId.get(step.capabilityId);
    entry.stepCount += 1;
    entry.requiresApproval = entry.requiresApproval || step.requiresApproval === true;
  }

  return {
    total: byId.size,
    ids: [...byId.keys()],
    items: [...byId.values()],
    approvalGates: [...byId.values()].filter((capability) => capability.requiresApproval).length,
  };
}

function buildRulePlan({ goal, targetUrl, actions, type, intent, policy }) {
  const now = new Date().toISOString();
  const plannerIntent = inferPlannerIntent({ intent, policy, type });
  const actionSteps = normalisePlanActions(actions).map((action, index) => ({
    id: `step-action-${index + 1}`,
    kind: action.kind,
    intent: action.intent ?? action.kind,
    phase: "acting_on_target",
    title: `Perform ${action.kind}`,
    status: "pending",
    params: action.params,
    when: action.when,
    onFailure: action.onFailure,
  }));

  const steps = [
    {
      id: "step-prepare-work-view",
      kind: "work_view.prepare",
      phase: "preparing_work_view",
      title: "Prepare the AI work view",
      status: "pending",
    },
    {
      id: "step-open-target",
      kind: "browser.open",
      phase: "opening_target",
      title: `Open ${targetUrl ?? "the target URL"}`,
      status: "pending",
    },
    {
      id: "step-observe-screen",
      kind: "screen.observe",
      phase: "observing_screen",
      title: "Observe the current screen state",
      status: "pending",
    },
    ...actionSteps,
    {
      id: "step-verify-result",
      kind: "result.verify",
      phase: "verifying_result",
      title: "Verify the task result",
      status: "pending",
    },
    {
      id: "step-close-task",
      kind: "task.complete",
      phase: "completed",
      title: "Close the task after verification",
      status: "pending",
    },
  ].map((step) => annotatePlanStepWithCapability(step, plannerIntent));

  return {
    planId: `plan-${randomUUID()}`,
    strategy: "rule-v1",
    planner: "capability-aware-v1",
    capabilityAware: true,
    status: "planned",
    goal,
    targetUrl,
    intent: plannerIntent,
    createdAt: now,
    updatedAt: now,
    capabilitySummary: summarisePlanCapabilities(steps),
    steps,
  };
}

function shouldBuildPlan(body) {
  return body.includePlan === true
    || body.plan === true
    || body.planStrategy === "rule-v1"
    || body.executionMode === "planned";
}

function updatePlanForPhase(task, phase, details = null) {
  if (!task.plan || !Array.isArray(task.plan.steps)) {
    return;
  }

  const now = new Date().toISOString();
  task.plan.status = phase === "failed" ? "failed" : phase === "completed" ? "completed" : "running";
  task.plan.updatedAt = now;
  if (phase === "failed") {
    task.plan.failure = details ?? null;
  }

  const step = task.plan.steps.find((candidate) => candidate.phase === phase && candidate.status !== "completed");
  if (step) {
    step.status = phase === "failed" ? "failed" : "completed";
    step.completedAt = now;
    step.details = details;
  }

  if (phase === "completed") {
    for (const candidate of task.plan.steps) {
      if (candidate.status === "pending") {
        candidate.status = "skipped";
      }
    }
  }
}

function isActiveTask(task) {
  return ACTIVE_TASK_STATUSES.has(task.status);
}

function hasRecoverableCapabilityPlan(task) {
  return task?.type === "system_task" && planCapabilityActionSteps(task).length > 0;
}

function hasRecoverableNativePluginRuntimeActivationPlan(task) {
  return (isNativePluginRuntimeActivationTask(task) || isNativePluginRuntimeAdapterTask(task))
    && task?.plan?.governance?.requiresRuntimeAdapterBeforeExecution === true
    && task?.plan?.governance?.canReadSourceFileContent === false
    && task?.plan?.governance?.canImportModule === false
    && task?.plan?.governance?.canExecutePluginCode === false
    && task?.plan?.governance?.canActivateRuntime === false;
}

function hasRecoverableSearchWebAdapterPlan(task) {
  const hasDeferredBoundary = isOpenClawSearchWebAdapterTask(task)
    ? task?.plan?.governance?.requiresRuntimePreflightBeforeExecution === true
    : isOpenClawSearchWebRuntimeActivationTask(task)
      ? task?.plan?.governance?.requiresRuntimeAdapterBeforeExecution === true
      : isOpenClawSearchWebProviderRuntimeSandboxTask(task)
        ? task?.plan?.governance?.requiresRuntimeAdapterBeforeExecution === true
        : false;
  return hasDeferredBoundary
    && task?.plan?.governance?.canUseNetwork === false
    && task?.plan?.governance?.canExecutePluginCode === false;
}

function isRecoverableTask(task) {
  if (!["completed", "failed", "superseded"].includes(task.status)) {
    return false;
  }

  if (typeof task.targetUrl === "string" && task.targetUrl.trim().length > 0) {
    return true;
  }

  return hasRecoverableCapabilityPlan(task)
    || hasRecoverableNativePluginRuntimeActivationPlan(task)
    || hasRecoverableSearchWebAdapterPlan(task);
}

function compareTasksForDisplay(left, right) {
  const leftPriority = STATUS_PRIORITY[left.status] ?? 99;
  const rightPriority = STATUS_PRIORITY[right.status] ?? 99;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

function listTasks() {
  return [...tasks.values()]
    .sort(compareTasksForDisplay)
    .map((task) => serialiseTask(task));
}

function getActiveTasks() {
  return [...tasks.values()]
    .filter((task) => isActiveTask(task))
    .sort(compareTasksForDisplay);
}

function getNextQueuedTask() {
  return [...tasks.values()]
    .filter((task) => task.status === "queued")
    .sort(compareTasksForDisplay)[0] ?? null;
}

function getLatestFinishedTask() {
  return [...tasks.values()]
    .filter((task) => task.status === "completed")
    .sort(compareTasksForDisplay)[0] ?? null;
}

function getLatestFailedTask() {
  return [...tasks.values()]
    .filter((task) => task.status === "failed")
    .sort(compareTasksForDisplay)[0] ?? null;
}

function buildTaskSummary() {
  const items = [...tasks.values()];
  const counts = {
    total: items.length,
    active: 0,
    queued: 0,
    running: 0,
    paused: 0,
    failed: 0,
    completed: 0,
    superseded: 0,
    recoverable: 0,
  };

  for (const task of items) {
    if (counts[task.status] !== undefined) {
      counts[task.status] += 1;
    }
    if (isActiveTask(task)) {
      counts.active += 1;
    }
    if (isRecoverableTask(task)) {
      counts.recoverable += 1;
    }
  }

  return {
    counts,
    currentTaskId: runtimeState.currentTaskId ?? null,
    currentTaskStatus: getCurrentTask()?.status ?? null,
  };
}

function serialiseApproval(approval) {
  return {
    id: approval.id,
    status: approval.status,
    taskId: approval.taskId ?? null,
    policyDecisionId: approval.policyDecisionId ?? null,
    intent: approval.intent ?? null,
    domain: approval.domain ?? null,
    risk: approval.risk ?? null,
    decision: approval.decision ?? null,
    reason: approval.reason ?? null,
    requestedBy: approval.requestedBy ?? "openclaw-core",
    approvedBy: approval.approvedBy ?? null,
    deniedBy: approval.deniedBy ?? null,
    resolutionReason: approval.resolutionReason ?? null,
    expiresAt: approval.expiresAt ?? null,
    createdAt: approval.createdAt,
    updatedAt: approval.updatedAt,
    resolvedAt: approval.resolvedAt ?? null,
    expiredAt: approval.expiredAt ?? null,
    task: approval.taskId && tasks.has(approval.taskId) ? serialiseTask(tasks.get(approval.taskId)) : null,
  };
}

function listApprovals() {
  reconcileApprovalExpirations();
  return [...approvals.values()]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .map((approval) => serialiseApproval(approval));
}

function buildApprovalSummary() {
  reconcileApprovalExpirations();
  const counts = {
    total: 0,
    pending: 0,
    approved: 0,
    denied: 0,
    expired: 0,
  };

  for (const approval of approvals.values()) {
    counts.total += 1;
    counts[approval.status] = (counts[approval.status] ?? 0) + 1;
  }

  const pending = [...approvals.values()]
    .filter((approval) => approval.status === "pending")
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));

  return {
    counts,
    pendingCount: pending.length,
    latestPendingId: pending[0]?.id ?? null,
  };
}

function getApprovalExpiresAt(approval) {
  if (typeof approval.expiresAt === "string" && approval.expiresAt.trim()) {
    return approval.expiresAt;
  }

  if (!APPROVAL_TTL_MS || typeof approval.createdAt !== "string") {
    return null;
  }

  const createdAtMs = Date.parse(approval.createdAt);
  if (Number.isNaN(createdAtMs)) {
    return null;
  }

  return new Date(createdAtMs + APPROVAL_TTL_MS).toISOString();
}

function isApprovalExpired(approval, nowMs = Date.now()) {
  const expiresAt = getApprovalExpiresAt(approval);
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);
  return !Number.isNaN(expiresAtMs) && expiresAtMs <= nowMs;
}

function markApprovalExpired(approval, { reason = "Approval expired." } = {}) {
  const now = new Date().toISOString();
  approval.status = "expired";
  approval.resolutionReason = reason;
  approval.resolvedAt = now;
  approval.expiredAt = now;
  approval.updatedAt = now;

  const task = approval.taskId ? getTaskById(approval.taskId) : null;
  if (task) {
    task.approval = {
      requestId: approval.id,
      status: approval.status,
      required: false,
      updatedAt: now,
    };
    if (isActiveTask(task)) {
      failTask(task, reason, {
        approvalId: approval.id,
        reason,
      });
    } else {
      persistState();
    }
  } else {
    persistState();
  }

  return { approval, task };
}

function reconcileApprovalExpirations() {
  if (!APPROVAL_TTL_MS) {
    return [];
  }

  const nowMs = Date.now();
  const expired = [];
  for (const approval of approvals.values()) {
    if (approval.status === "pending" && isApprovalExpired(approval, nowMs)) {
      expired.push(markApprovalExpired(approval));
    }
  }
  return expired;
}

function findExistingApprovalForTask(taskId) {
  return [...approvals.values()]
    .filter((approval) => approval.taskId === taskId && ["pending", "approved"].includes(approval.status))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null;
}

function createApprovalRequestForTask(task, decision) {
  const existing = findExistingApprovalForTask(task.id);
  if (existing) {
    task.approval = {
      requestId: existing.id,
      status: existing.status,
      required: existing.status === "pending",
      updatedAt: existing.updatedAt,
    };
    return existing;
  }

  const now = new Date().toISOString();
  const approval = {
    id: randomUUID(),
    status: "pending",
    taskId: task.id,
    policyDecisionId: decision.id,
    intent: decision.subject?.intent ?? null,
    domain: decision.domain,
    risk: decision.risk,
    decision: decision.decision,
    reason: decision.reason,
    requestedBy: "openclaw-core",
    expiresAt: APPROVAL_TTL_MS ? new Date(Date.parse(now) + APPROVAL_TTL_MS).toISOString() : null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    expiredAt: null,
  };
  approvals.set(approval.id, approval);
  task.approval = {
    requestId: approval.id,
    status: approval.status,
    required: true,
    updatedAt: approval.updatedAt,
  };

  if (approvals.size > MAX_APPROVAL_ITEMS) {
    const removable = [...approvals.values()]
      .filter((item) => item.status !== "pending")
      .sort((left, right) => Date.parse(left.updatedAt) - Date.parse(right.updatedAt))[0];
    if (removable) {
      approvals.delete(removable.id);
    }
  }

  persistState();
  return approval;
}

function markApprovalApproved(approval, { approvedBy = "user", reason = "Approved by user." } = {}) {
  const now = new Date().toISOString();
  approval.status = "approved";
  approval.approvedBy = approvedBy;
  approval.resolutionReason = reason;
  approval.resolvedAt = now;
  approval.updatedAt = now;

  const task = approval.taskId ? getTaskById(approval.taskId) : null;
  if (task) {
    task.policy = {
      request: {
        ...(task.policy?.request ?? {}),
        approved: true,
      },
      decision: task.policy?.decision ?? null,
    };
    task.approval = {
      requestId: approval.id,
      status: approval.status,
      required: false,
      updatedAt: now,
    };
    ensureTaskPolicy(task, { stage: "approval.approved", force: true });
  }

  persistState();
  return { approval, task };
}

function markApprovalDenied(approval, { deniedBy = "user", reason = "Denied by user." } = {}) {
  const now = new Date().toISOString();
  approval.status = "denied";
  approval.deniedBy = deniedBy;
  approval.resolutionReason = reason;
  approval.resolvedAt = now;
  approval.updatedAt = now;

  const task = approval.taskId ? getTaskById(approval.taskId) : null;
  if (task) {
    task.approval = {
      requestId: approval.id,
      status: approval.status,
      required: false,
      updatedAt: now,
    };
    if (isActiveTask(task)) {
      failTask(task, "Approval denied by user.", {
        approvalId: approval.id,
        reason,
      });
    } else {
      persistState();
    }
  } else {
    persistState();
  }

  return { approval, task };
}

async function publishTaskApprovalIfPending(task) {
  const approval = task?.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  if (approval?.status === "pending") {
    await publishEvent("approval.created", {
      approval: serialiseApproval(approval),
      task: serialiseTask(task),
    });
  }
}

function buildOperatorState() {
  reconcileRuntimeState();
  const currentTask = getCurrentTask();
  const nextTask = getNextQueuedTask();
  const paused = runtimeState.paused === true;
  return {
    status: paused ? "paused" : nextTask ? "ready" : "idle",
    blocked: paused,
    reason: paused ? "runtime_paused" : null,
    currentTask: currentTask ? serialiseTask(currentTask) : null,
    nextTask: nextTask ? serialiseTask(nextTask) : null,
    policy: {
      respectsPause: true,
      enforcesTaskPolicy: true,
      defaultMaxSteps: 5,
      maxStepsLimit: 20,
      supportsDryRun: true,
      decisions: ["allow", "audit_only", "require_approval", "deny"],
    },
    approvals: buildApprovalSummary(),
    summary: buildTaskSummary(),
  };
}

function buildMvpRouteAlignment() {
  const phases = [
    {
      id: "phase-0-body",
      label: "Body",
      whitepaperConcept: "resident sovereign body",
      status: "complete",
      evidence: ["body-config", "state-settling", "service-health"],
    },
    {
      id: "phase-1-eyes",
      label: "Eyes",
      whitepaperConcept: "AI-owned observable work view",
      status: "complete",
      evidence: [
        "openclaw-ai-work-view-capture",
        "openclaw-ai-work-view-capture-summary",
        "screen-sense",
      ],
    },
    {
      id: "phase-2-hands",
      label: "Hands",
      whitepaperConcept: "screen action tied to observation",
      status: "complete",
      evidence: ["openclaw-eye-hand-action-evidence", "screen-act"],
    },
    {
      id: "phase-3-observer",
      label: "Observer",
      whitepaperConcept: "visible and interruptible control plane",
      status: "complete",
      evidence: [
        "observer-openclaw-ai-work-view-task-verification-summary",
        "observer-openclaw-eye-hand-action-evidence",
      ],
    },
    {
      id: "phase-4-recovery",
      label: "Recovery",
      whitepaperConcept: "failed work carries evidence and recovery targets",
      status: "complete",
      evidence: [
        "openclaw-eye-hand-recovery-evidence",
        "openclaw-eye-hand-auto-recovery-execution",
        "openclaw-eye-hand-recovery-regression",
      ],
    },
    {
      id: "phase-5-body-health-self-heal",
      label: "Body Health",
      whitepaperConcept: "basic system health and self-heal loop",
      status: "next",
      evidence: ["system-sense", "system-heal", "sovereign-maintenance"],
    },
  ];

  return {
    ok: true,
    registry: "openclaw-mvp-route-alignment-v0",
    whitepaper: {
      thesis: "OpenClaw is a resident digital body with eyes, hands, observer visibility, and recovery responsibility under user sovereignty.",
      mvpBoundary: "Build body, eyes, hands, observer window, and basic recovery before higher autonomy.",
      sourceDocuments: [
        "docs/OpenClaw body sovereignty whitepaper",
        "docs/OpenClaw on NixOS MVP implementation route v1",
      ],
    },
    mainline: {
      current: "eye-hand-recovery-loop-complete",
      trunk: "body-eyes-hands-observer-recovery",
      completedCapabilities: [
        "browser-runtime-backed AI work view capture",
        "structured AI work view summaries",
        "task verification records final observation evidence",
        "screen actions link to final work view observations",
        "failed tasks carry recovery evidence",
        "auto recovery uses evidence-driven target URLs",
      ],
      nextRecommendedTrunk: "system-health-self-heal",
      nextRecommendedMilestone: "basic body health and conservative self-heal evidence",
    },
    phases,
    guardrails: {
      afterEachMilestone: [
        "re-read the whitepaper and MVP route before selecting the next slice",
        "prefer one visible body-loop capability over another safety-chain increment",
        "stop if the next task only adds approval expiry, duplicate click, or persistence hardening",
      ],
      avoidLoops: [
        "plugin-runtime-adapter-hardening-loop",
        "approval-boundary-expansion-loop",
        "persistence-before-user-visible-body-progress",
      ],
    },
    summary: {
      totalPhases: phases.length,
      complete: phases.filter((phase) => phase.status === "complete").length,
      next: phases.find((phase) => phase.status === "next")?.id ?? null,
      direction: "return-to-mvp-body-health",
    },
  };
}

function taskTimeForDemo(task) {
  const value = Date.parse(task?.closedAt ?? task?.updatedAt ?? task?.createdAt ?? "");
  return Number.isFinite(value) ? value : 0;
}

function findLatestSystemdRepairDemoTask() {
  return [...tasks.values()]
    .filter((task) => task.type === "systemd_repair_execution_task")
    .filter((task) => task.outcome?.details?.postExecutionVerification)
    .sort((left, right) => taskTimeForDemo(right) - taskTimeForDemo(left))[0]
    ?? null;
}

function findLatestSystemdNextRepairDemoTask() {
  return [...tasks.values()]
    .filter((task) => task.type === "systemd_next_repair_task")
    .filter((task) => task.outcome?.details?.postExecutionVerification)
    .sort((left, right) => taskTimeForDemo(right) - taskTimeForDemo(left))[0]
    ?? null;
}

function findLatestBodyEvidenceLedgerFollowupRecordTask() {
  return [...tasks.values()]
    .filter((task) => task.type === "body_evidence_ledger_followup_record_task")
    .filter((task) => task.bodyEvidenceLedgerFollowupRecord?.registry === "openclaw-body-evidence-ledger-followup-record-task-v0")
    .sort((left, right) => taskTimeForDemo(right) - taskTimeForDemo(left))[0]
    ?? null;
}

function readBodyEvidenceLedgerLines() {
  const ledgerFileDisplayPath = ".artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl";
  const ledgerFilePath = path.resolve(process.cwd(), "../..", ledgerFileDisplayPath);
  if (!existsSync(ledgerFilePath)) {
    return {
      ledgerFileDisplayPath,
      ledgerFilePath,
      exists: false,
      lineCount: 0,
      records: [],
    };
  }
  const text = readFileSync(ledgerFilePath, "utf8");
  const lines = text.trim() ? text.trim().split("\n").filter(Boolean) : [];
  return {
    ledgerFileDisplayPath,
    ledgerFilePath,
    exists: true,
    lineCount: lines.length,
    records: lines.map((line, index) => {
      try {
        const record = JSON.parse(line);
        return {
          index,
          ok: true,
          id: record.id ?? null,
          evidenceType: record.evidenceType ?? null,
          sourceRegistry: record.sourceRegistry ?? null,
          contentHash: record.contentHash ?? null,
        };
      } catch (error) {
        return {
          index,
          ok: false,
          error: error instanceof Error ? error.message : "Invalid JSONL record",
        };
      }
    }),
  };
}

function buildPhase2RepairDemoStatus() {
  const route = buildMvpRouteAlignment();
  const latestTask = findLatestSystemdRepairDemoTask();
  const verification = latestTask?.outcome?.details?.postExecutionVerification ?? null;
  const transcript = latestTask?.outcome?.details?.commandTranscript?.[0] ?? null;
  const checklist = [
    {
      id: "phase2-track-a-route",
      label: "Whitepaper route remains Phase 2 Track A to Track B",
      status: "passed",
      evidence: "docs/OPENCLAW_PHASE_2_PLAN.md",
    },
    {
      id: "operator-approved-real-execution",
      label: "Operator-approved real systemd repair execution exists",
      status: latestTask ? "passed" : "pending",
      evidence: latestTask?.id ?? null,
    },
    {
      id: "post-execution-body-verification",
      label: "Post-execution body-state verification is attached",
      status: verification ? "passed" : "pending",
      evidence: verification?.registry ?? null,
    },
    {
      id: "observer-visible-evidence",
      label: "Observer can display task evidence without hidden actions",
      status: "passed",
      evidence: "observer-ui phase2 repair demo panel",
    },
  ];
  const passed = checklist.filter((item) => item.status === "passed").length;

  return {
    ok: true,
    registry: "openclaw-phase-2-repair-demo-status-v0",
    mode: "observer_demo_status_read_only",
    generatedAt: new Date().toISOString(),
    status: latestTask && verification ? "demo_ready" : "waiting_for_repair_evidence",
    track: {
      phase: "phase-2",
      track: "operator-observer-demo-experience",
      sourceTrack: "real-nixos-systemd-repair-semantics",
      whitepaperDirection: "make body capability explainable and observable",
    },
    route: {
      registry: route.registry,
      current: "phase-2-systemd-repair-evidence-demo",
      previousMvpCurrent: route.mainline?.current ?? null,
      nextRecommendedSlice: "operator-observer-demo-evidence-bundle",
      avoidsSafetyBoundaryLoop: true,
    },
    checklist,
    summary: {
      passed,
      total: checklist.length,
      demoReady: latestTask && verification ? true : false,
      latestTaskId: latestTask?.id ?? null,
      latestOutcome: latestTask?.outcome?.kind ?? null,
      targetUnit: verification?.targetUnit ?? latestTask?.systemdRepair?.target?.unit ?? "openclaw-browser-runtime.service",
      command: transcript?.command ?? null,
      exitCode: verification?.commandExitCode ?? transcript?.exitCode ?? null,
      beforeActiveState: verification?.summary?.beforeActiveState ?? null,
      afterActiveState: verification?.summary?.afterActiveState ?? null,
      beforeServiceOk: verification?.summary?.beforeServiceOk ?? null,
      afterServiceOk: verification?.summary?.afterServiceOk ?? null,
      noAutomaticRecovery: verification?.summary?.noAutomaticRecovery === true,
    },
    evidence: {
      task: latestTask ? serialiseTask(latestTask) : null,
      postExecutionVerification: verification,
      commandTranscript: transcript,
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
    },
  };
}

function buildPhase2NextRepairDemoStatus() {
  const latestTask = findLatestSystemdNextRepairDemoTask();
  const verification = latestTask?.outcome?.details?.postExecutionVerification ?? null;
  const transcript = latestTask?.outcome?.details?.commandTranscript?.[0] ?? null;
  const checklist = [
    {
      id: "next-repair-route",
      label: "Next repair route selected system-sense",
      status: latestTask?.systemdNextRepair?.sourceRegistry === "openclaw-systemd-next-repair-task-route-v0" ? "passed" : "pending",
      evidence: latestTask?.systemdNextRepair?.sourceRegistry ?? null,
    },
    {
      id: "operator-approved-next-real-execution",
      label: "Operator-approved next real execution attempt exists",
      status: latestTask ? "passed" : "pending",
      evidence: latestTask?.id ?? null,
    },
    {
      id: "next-post-execution-verification",
      label: "Before/after body-state verification is attached",
      status: verification ? "passed" : "pending",
      evidence: verification?.registry ?? null,
    },
    {
      id: "no-hidden-follow-up",
      label: "No recovery, retry, scheduler, or follow-up mutation is triggered",
      status: verification?.governance?.triggersRecovery === false ? "passed" : "pending",
      evidence: verification?.governance ?? null,
    },
  ];
  const passed = checklist.filter((item) => item.status === "passed").length;

  return {
    ok: true,
    registry: "openclaw-systemd-next-repair-demo-status-v0",
    mode: "read_only_next_repair_demo_status",
    generatedAt: new Date().toISOString(),
    status: latestTask && verification ? "demo_ready" : "waiting_for_next_repair_evidence",
    track: {
      phase: "phase-2",
      track: "real-nixos-systemd-repair-semantics",
      whitepaperDirection: "make OpenClaw's body repair attempt explainable and observable",
    },
    checklist,
    summary: {
      ready: latestTask && verification && passed === checklist.length,
      passedChecks: passed,
      totalChecks: checklist.length,
      targetUnit: latestTask?.systemdNextRepair?.target?.unit ?? "openclaw-system-sense.service",
      outcome: latestTask?.outcome?.kind ?? null,
      command: transcript?.command ?? null,
      exitCode: transcript?.exitCode ?? null,
      hostMutationAttempted: latestTask?.outcome?.details?.hostMutationAttempted === true,
      executionSucceeded: latestTask?.outcome?.details?.executionSucceeded ?? null,
    },
    evidence: {
      taskId: latestTask?.id ?? null,
      approval: latestTask?.approval ?? null,
      systemdNextRepair: latestTask?.systemdNextRepair ?? null,
      commandTranscript: transcript ?? null,
      postExecutionVerification: verification,
      rollbackNote: latestTask?.outcome?.details?.rollbackNote ?? null,
    },
    governance: {
      readsTaskHistoryOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      hostMutation: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    next: {
      recommendedSlice: "openclaw-body-evidence-timeline",
      boundary: "return to read-only body memory; do not add another execution, recovery, or hardening loop",
    },
  };
}

function buildBodyEvidenceLedgerFollowupRecordReadiness() {
  const latestTask = findLatestBodyEvidenceLedgerFollowupRecordTask();
  const followupRecord = latestTask?.bodyEvidenceLedgerFollowupRecord ?? null;
  const ledger = readBodyEvidenceLedgerLines();
  const checklist = [
    {
      id: "followup-task-shell",
      label: "Follow-up ledger record task shell exists",
      status: latestTask?.type === "body_evidence_ledger_followup_record_task" ? "passed" : "pending",
      evidence: latestTask?.id ?? null,
    },
    {
      id: "pending-approval-boundary",
      label: "Follow-up task remains approval-gated before append execution",
      status: latestTask?.approval?.status === "pending" && followupRecord?.appendExecutionEnabled === false ? "passed" : "pending",
      evidence: latestTask?.approval?.requestId ?? latestTask?.approval?.id ?? null,
    },
    {
      id: "planned-second-record",
      label: "Task shell targets planned sequence 2 follow-up timeline record",
      status: followupRecord?.plannedRecordType === "body_evidence_timeline_followup"
        && followupRecord?.plannedSequence === 2 ? "passed" : "pending",
      evidence: followupRecord?.sourceRegistry ?? null,
    },
    {
      id: "no-second-ledger-record",
      label: "Ledger still contains exactly one durable record",
      status: ledger.exists === true && ledger.lineCount === 1 ? "passed" : "pending",
      evidence: ledger.ledgerFileDisplayPath,
    },
    {
      id: "no-hidden-writer",
      label: "No scheduler, background writer, command execution, or host mutation is enabled",
      status: followupRecord?.recordAppended === false
        && followupRecord?.durableStorageWritten === false
        && latestTask?.status === "queued" ? "passed" : "pending",
      evidence: "followup_record_readiness_governance",
    },
  ];
  const passedChecks = checklist.filter((item) => item.status === "passed").length;
  const ready = passedChecks === checklist.length;

  return {
    ok: true,
    registry: "openclaw-body-evidence-ledger-followup-record-readiness-v0",
    mode: "read_only_followup_record_task_readiness",
    generatedAt: new Date().toISOString(),
    status: ready ? "ready_for_route_review" : "waiting_for_followup_task_shell",
    source: {
      service: "openclaw-core",
      taskId: latestTask?.id ?? null,
      taskRegistry: followupRecord?.registry ?? null,
      ledgerFile: ledger.ledgerFileDisplayPath,
      evidence: "body_evidence_ledger_followup_record_readiness",
    },
    checklist,
    summary: {
      ready,
      passedChecks,
      totalChecks: checklist.length,
      taskId: latestTask?.id ?? null,
      approvalId: latestTask?.approval?.requestId ?? latestTask?.approval?.id ?? null,
      approvalStatus: latestTask?.approval?.status ?? null,
      plannedRecordType: followupRecord?.plannedRecordType ?? null,
      plannedSequence: followupRecord?.plannedSequence ?? null,
      existingRecordCount: ledger.lineCount,
      recordAppended: followupRecord?.recordAppended === true,
      durableStorageWritten: followupRecord?.durableStorageWritten === true,
      hiddenMutation: false,
    },
    evidence: {
      task: latestTask ? serialiseTask(latestTask) : null,
      followupRecord,
      ledger,
      noSecondRecord: ledger.lineCount === 1,
      hardBoundary: [
        "do not approve follow-up append in this checkpoint",
        "do not append a second ledger record",
        "no scheduler",
        "no background writer",
        "no command execution",
        "no host mutation",
      ],
    },
    governance: {
      readsTaskHistoryOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      hostMutation: false,
      canAppendLedgerRecord: false,
      canWriteLedger: false,
      recordAppended: false,
      durableStorageWritten: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
      backgroundWriter: false,
      bulkImport: false,
    },
    next: {
      recommendedSlice: "openclaw-phase-2-next-capability-route-review",
      boundary: "return to whitepaper route review before approving the follow-up append, writing a second ledger record, or adding background persistence",
    },
  };
}

async function buildPhase2DemoControlRoom() {
  const mvpRoute = buildMvpRouteAlignment();
  const repairDemo = buildPhase2RepairDemoStatus();
  let routeReview = null;
  try {
    routeReview = await fetchJson(`${systemSenseUrl}/system/route/phase-2-review`);
  } catch {
    routeReview = null;
  }

  const panels = [
    {
      id: "service-health",
      label: "Body service health",
      source: "/health plus Observer service health pills",
      status: "available",
    },
    {
      id: "mvp-route",
      label: "Whitepaper route alignment",
      source: "/mvp/route",
      status: mvpRoute?.ok ? "available" : "unavailable",
    },
    {
      id: "phase-2-repair-demo",
      label: "Phase 2 repair demo evidence",
      source: "/phase-2/repair-demo-status",
      status: repairDemo?.ok ? "available" : "unavailable",
    },
    {
      id: "phase-2-route-review",
      label: "Phase 2 next-block route review",
      source: `${systemSenseUrl}/system/route/phase-2-review`,
      status: routeReview?.ok ? "available" : "unavailable",
    },
    {
      id: "body-governance-readiness",
      label: "Track C body governance readiness",
      source: routeReview?.source?.bodyGovernanceReadinessRegistry ?? "openclaw-body-governance-readiness-v0",
      status: routeReview?.evidence?.trackCReady === true ? "available" : "unavailable",
    },
  ];
  const available = panels.filter((panel) => panel.status === "available").length;
  const ready = available === panels.length
    && routeReview?.decision?.selectedSlice === "openclaw-phase-2-demo-control-room";

  return {
    ok: true,
    registry: "openclaw-phase-2-demo-control-room-v0",
    mode: "read_only_demo_control_surface",
    generatedAt: new Date().toISOString(),
    status: ready ? "control_room_ready" : "waiting_for_route_review_evidence",
    source: {
      service: "openclaw-core",
      mvpRouteRegistry: mvpRoute?.registry ?? null,
      repairDemoRegistry: repairDemo?.registry ?? null,
      routeReviewRegistry: routeReview?.registry ?? null,
      evidence: "phase_2_demo_control_room_bundle",
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
    },
    summary: {
      ready,
      availablePanels: available,
      totalPanels: panels.length,
      selectedTrack: routeReview?.decision?.selectedTrack ?? "unknown",
      selectedSlice: routeReview?.decision?.selectedSlice ?? "unknown",
      repairDemoStatus: repairDemo?.status ?? "unknown",
      repairDemoReady: repairDemo?.summary?.demoReady === true,
      bodyGovernanceReady: routeReview?.evidence?.trackCReady === true,
      avoidsSafetyBoundaryLoop: routeReview?.decision?.notSelected?.some((item) => item.includes("safety-boundary")) === true,
    },
    panels,
    evidence: {
      mvpRoute: {
        current: mvpRoute?.mainline?.current ?? null,
        nextRecommendedTrunk: mvpRoute?.mainline?.nextRecommendedTrunk ?? null,
        guardrails: mvpRoute?.guardrails ?? null,
      },
      repairDemo: {
        status: repairDemo?.status ?? null,
        checklistPassed: repairDemo?.summary?.passed ?? 0,
        checklistTotal: repairDemo?.summary?.total ?? 0,
        targetUnit: repairDemo?.summary?.targetUnit ?? "openclaw-browser-runtime.service",
        nextRecommendedSlice: repairDemo?.route?.nextRecommendedSlice ?? null,
      },
      routeReview: routeReview ? {
        selectedTrack: routeReview.decision?.selectedTrack ?? null,
        selectedSlice: routeReview.decision?.selectedSlice ?? null,
        notSelected: routeReview.decision?.notSelected ?? [],
      } : null,
    },
    operatorScript: [
      "Open Observer UI.",
      "Confirm service health, MVP route, repair demo status, body governance readiness, and Phase 2 route review panels are visible.",
      "Explain that the next work is demo/control-room clarity, not broader mutation or plugin/runtime work.",
      "Only run a real repair through the already-approved operator-reviewed repair path when intentionally demonstrating Track A.",
    ],
    next: {
      recommendedSlice: "openclaw-phase-2-demo-walkthrough",
      boundary: "turn the control room into a human-readable walkthrough without adding new autonomy or host mutation",
    },
  };
}

async function buildPhase2DemoWalkthrough() {
  const controlRoom = await buildPhase2DemoControlRoom();
  const ready = controlRoom.summary?.ready === true;
  const steps = [
    {
      id: "open-observer",
      title: "Open the Observer UI",
      operatorAction: "Navigate to the Observer UI and confirm the control room panel is visible.",
      expectedEvidence: "phase2-demo-control-room-panel",
      status: ready ? "ready" : "waiting",
    },
    {
      id: "explain-route",
      title: "Explain the whitepaper route",
      operatorAction: "Show MVP route, Phase 2 route review, and the selected Track B demo-control-room slice.",
      expectedEvidence: controlRoom.evidence?.routeReview?.selectedSlice ?? "openclaw-phase-2-demo-control-room",
      status: controlRoom.summary?.selectedSlice === "openclaw-phase-2-demo-control-room" ? "ready" : "waiting",
    },
    {
      id: "show-body-governance",
      title: "Show body governance readiness",
      operatorAction: "Point to dependency, trend, recovery policy, and readiness panels as the body reasoning foundation.",
      expectedEvidence: "openclaw-body-governance-readiness-v0",
      status: controlRoom.summary?.bodyGovernanceReady ? "ready" : "waiting",
    },
    {
      id: "show-repair-demo",
      title: "Show repair demo status",
      operatorAction: "Show whether real repair evidence is ready or still waiting; do not run hidden repair actions.",
      expectedEvidence: controlRoom.evidence?.repairDemo?.targetUnit ?? "openclaw-browser-runtime.service",
      status: controlRoom.evidence?.repairDemo?.status ? "ready" : "waiting",
    },
    {
      id: "state-boundary",
      title: "State the boundary",
      operatorAction: "Say explicitly that this walkthrough creates no task, approval, command, host mutation, scheduler, or recovery action.",
      expectedEvidence: "read_only_demo_walkthrough",
      status: "ready",
    },
  ];
  const readySteps = steps.filter((step) => step.status === "ready").length;

  return {
    ok: true,
    registry: "openclaw-phase-2-demo-walkthrough-v0",
    mode: "read_only_human_demo_walkthrough",
    generatedAt: new Date().toISOString(),
    status: readySteps === steps.length ? "walkthrough_ready" : "walkthrough_waiting_for_evidence",
    source: {
      service: "openclaw-core",
      demoControlRoomRegistry: controlRoom.registry,
      evidence: "phase_2_human_demo_walkthrough",
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
    },
    summary: {
      ready: readySteps === steps.length,
      readySteps,
      totalSteps: steps.length,
      selectedSlice: controlRoom.summary?.selectedSlice ?? "unknown",
      controlRoomReady: ready,
      repairDemoReady: controlRoom.summary?.repairDemoReady === true,
      bodyGovernanceReady: controlRoom.summary?.bodyGovernanceReady === true,
    },
    steps,
    script: [
      "OpenClaw is now demonstrating a resident body loop, not a plugin/runtime adapter loop.",
      "Track A proved a narrow operator-reviewed repair path.",
      "Track C proved body governance evidence and route-aware recovery judgment.",
      "Track B now packages those signals into an operator-visible demo surface.",
      "No hidden mutation happens during this walkthrough.",
    ],
    next: {
      recommendedSlice: "openclaw-phase-2-demo-readiness-exit",
      boundary: "close the Track B demo block after the walkthrough is visible and read-only",
    },
  };
}

async function buildPhase2DemoReadinessExit() {
  const walkthrough = await buildPhase2DemoWalkthrough();
  const exitChecks = [
    {
      id: "control-room-ready",
      label: "Phase 2 demo control room is ready",
      passed: walkthrough.summary?.controlRoomReady === true,
      evidence: walkthrough.source?.demoControlRoomRegistry ?? "openclaw-phase-2-demo-control-room-v0",
    },
    {
      id: "walkthrough-ready",
      label: "Human demo walkthrough steps are ready",
      passed: walkthrough.summary?.ready === true,
      evidence: walkthrough.registry,
    },
    {
      id: "body-governance-visible",
      label: "Body governance readiness is visible in the demo story",
      passed: walkthrough.summary?.bodyGovernanceReady === true,
      evidence: "openclaw-body-governance-readiness-v0",
    },
    {
      id: "operator-boundary-visible",
      label: "No-hidden-mutation boundary is visible in the walkthrough",
      passed: (walkthrough.script ?? []).some((line) => line.includes("No hidden mutation")),
      evidence: "walkthrough-script",
    },
    {
      id: "read-only-exit",
      label: "Exit gate remains read-only and non-executing",
      passed: walkthrough.governance?.createsTask === false
        && walkthrough.governance?.executesCommand === false
        && walkthrough.governance?.mutatesHost === false
        && walkthrough.governance?.triggersRecovery === false,
      evidence: "exit-governance",
    },
  ];
  const passed = exitChecks.filter((check) => check.passed).length;
  const ready = passed === exitChecks.length;

  return {
    ok: true,
    registry: "openclaw-phase-2-demo-readiness-exit-v0",
    mode: "read_only_demo_block_exit",
    generatedAt: new Date().toISOString(),
    status: ready ? "phase_2_demo_block_ready" : "phase_2_demo_block_waiting",
    source: {
      service: "openclaw-core",
      demoWalkthroughRegistry: walkthrough.registry,
      demoControlRoomRegistry: walkthrough.source?.demoControlRoomRegistry ?? null,
      evidence: "phase_2_track_b_demo_readiness_exit",
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
    },
    summary: {
      ready,
      passed,
      total: exitChecks.length,
      walkthroughStatus: walkthrough.status,
      selectedSlice: walkthrough.summary?.selectedSlice ?? "unknown",
      repairDemoReady: walkthrough.summary?.repairDemoReady === true,
      bodyGovernanceReady: walkthrough.summary?.bodyGovernanceReady === true,
    },
    exitChecks,
    completedBlock: {
      id: "phase-2-track-b-demo-experience",
      name: "Operator/Observer Demo Experience",
      completedSlices: [
        "openclaw-phase-2-route-review",
        "openclaw-phase-2-demo-control-room",
        "openclaw-phase-2-demo-walkthrough",
      ],
      completionClaim: ready ? "track_b_demo_readiness_exit_passed" : "track_b_demo_readiness_incomplete",
    },
    operatorOutcome: {
      demoNarrative: "OpenClaw can now show a resident body loop, real repair evidence, body governance evidence, and the next-route decision from one Observer path.",
      safeToDemo: ready,
      hiddenMutation: false,
    },
    next: {
      recommendedSlice: "openclaw-phase-2-next-capability-route-review",
      boundary: "return to the whitepaper route before opening the next body capability block",
    },
  };
}

async function buildPhase2NextCapabilityRouteReview(options = {}) {
  const demoExit = await buildPhase2DemoReadinessExit();
  const demoReady = demoExit.summary?.ready === true;
  const ledgerDemoStatusCheckpointComplete = options.ledgerDemoStatusCheckpointComplete === true;
  const repairCandidateDemoCheckpointComplete = options.repairCandidateDemoCheckpointComplete === true;
  let candidateDemoStatus = null;
  let bodyEvidenceTimelineReadiness = null;
  let bodyEvidenceLedgerReadiness = null;
  let bodyEvidenceLedgerDemoStatus = null;
  let bodyEvidenceLedgerFollowupRecordPlan = null;
  try {
    candidateDemoStatus = await fetchJson(`${systemSenseUrl}/system/systemd/repair-candidate-demo-status`);
  } catch {
    candidateDemoStatus = null;
  }
  try {
    bodyEvidenceTimelineReadiness = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-timeline-readiness`);
  } catch {
    bodyEvidenceTimelineReadiness = null;
  }
  try {
    bodyEvidenceLedgerReadiness = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-ledger-readiness`);
  } catch {
    bodyEvidenceLedgerReadiness = null;
  }
  if (ledgerDemoStatusCheckpointComplete) {
    try {
      bodyEvidenceLedgerDemoStatus = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-ledger-demo-status`);
    } catch {
      bodyEvidenceLedgerDemoStatus = null;
    }
  }
  if (repairCandidateDemoCheckpointComplete) {
    try {
      bodyEvidenceLedgerFollowupRecordPlan = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-ledger-followup-record-plan`);
    } catch {
      bodyEvidenceLedgerFollowupRecordPlan = null;
    }
  }
  const candidateDemoReady = candidateDemoStatus?.summary?.demoReady === true;
  const bodyEvidenceTimelineReady = bodyEvidenceTimelineReadiness?.summary?.ready === true;
  const bodyEvidenceLedgerReady = bodyEvidenceLedgerReadiness?.summary?.ready === true;
  const bodyEvidenceLedgerDemoReady = bodyEvidenceLedgerDemoStatus?.summary?.demoReady === true;
  const followupRecordPlanReady = bodyEvidenceLedgerFollowupRecordPlan?.summary?.planReady === true;
  const followupRecordPlanRouteReady = repairCandidateDemoCheckpointComplete
    && candidateDemoReady
    && bodyEvidenceTimelineReady
    && bodyEvidenceLedgerReady;
  const selectedTrack = followupRecordPlanRouteReady
    ? "Track C: Body Evidence Memory"
    : candidateDemoReady
    ? (bodyEvidenceLedgerDemoReady
      ? "Track A: Real NixOS/systemd Repair Semantics"
      : "Track C: Body Governance Enhancement")
    : "Track A: Real NixOS/systemd Repair Semantics";
  const selectedSlice = followupRecordPlanRouteReady
    ? "openclaw-body-evidence-ledger-followup-record-plan"
    : candidateDemoReady
    ? (bodyEvidenceLedgerDemoReady
        ? "openclaw-systemd-next-repair-scope-review"
        : bodyEvidenceLedgerReady
        ? "openclaw-body-evidence-ledger-demo-status"
        : bodyEvidenceTimelineReady
          ? "openclaw-body-evidence-ledger-plan"
          : "openclaw-body-evidence-timeline")
    : "openclaw-systemd-repair-candidate-assessment";
  const candidates = [
    {
      track: "Track A",
      id: "real-systemd-repair-semantics",
      label: "Read-only next repair candidate assessment",
      score: candidateDemoReady ? 58 : (demoReady ? 96 : 60),
      recommended: !candidateDemoReady,
      firstSlice: "openclaw-systemd-repair-candidate-assessment",
      mutation: false,
      reason: candidateDemoReady
        ? "The repair candidate route is already demo-ready; repeating candidate assessment would create a route loop."
        : "Phase 2 now has demo readiness and body governance; the next body capability should return to real NixOS/systemd repair semantics without immediately broadening mutation.",
    },
    {
      track: "Track C",
      id: "body-governance-evidence-memory",
      label: "Read-only body evidence timeline",
      score: candidateDemoReady ? 97 : 64,
      recommended: candidateDemoReady && !bodyEvidenceTimelineReady,
      firstSlice: "openclaw-body-evidence-timeline",
      mutation: false,
      reason: bodyEvidenceTimelineReady
        ? "The body evidence timeline is already ready; do not loop back into the same memory slice."
        : "The repair candidate route is demo-ready; the next whitepaper-aligned gain is durable body evidence memory before any broader mutation.",
    },
    {
      track: "Track C",
      id: "durable-body-evidence-ledger",
      label: "Read-only durable body evidence ledger plan",
      score: bodyEvidenceTimelineReady ? 98 : 62,
      recommended: bodyEvidenceTimelineReady && !bodyEvidenceLedgerReady,
      firstSlice: "openclaw-body-evidence-ledger-plan",
      mutation: false,
      reason: bodyEvidenceLedgerReady
        ? "The first durable ledger record is ready; do not loop back into the ledger plan."
        : "The in-process evidence timeline is ready; the next route-reviewed step is a plan-only durable ledger design, not persistence implementation.",
    },
    {
      track: "Track C",
      id: "durable-body-evidence-ledger-demo-status",
      label: "Read-only body evidence ledger demo status",
      score: bodyEvidenceLedgerReady ? 99 : 50,
      recommended: bodyEvidenceLedgerReady && !bodyEvidenceLedgerDemoReady && !followupRecordPlanRouteReady,
      firstSlice: "openclaw-body-evidence-ledger-demo-status",
      mutation: false,
      reason: bodyEvidenceLedgerDemoReady
        ? "The ledger demo status is already ready; do not loop back into the same demo package."
        : bodyEvidenceLedgerReady
        ? "The first durable ledger record is ready; package the completed body-memory block for operator demo before adding more writes."
        : "Ledger demo status waits until the first durable record readiness gate passes.",
    },
    {
      track: "Track C",
      id: "durable-body-evidence-ledger-followup-record-plan",
      label: "Plan-only follow-up body evidence ledger record",
      score: followupRecordPlanRouteReady ? 101 : 56,
      recommended: followupRecordPlanRouteReady,
      firstSlice: "openclaw-body-evidence-ledger-followup-record-plan",
      mutation: false,
      reason: followupRecordPlanRouteReady
        ? "The candidate demo and durable ledger evidence are ready; plan the next body evidence ledger record without creating a task or writing JSONL."
        : "Follow-up ledger record planning waits until candidate demo status and the first ledger record are both ready.",
    },
    {
      track: "Track A",
      id: "next-systemd-repair-scope-review",
      label: "Read-only next systemd repair scope review",
      score: bodyEvidenceLedgerDemoReady ? 100 : 54,
      recommended: bodyEvidenceLedgerDemoReady && !followupRecordPlanRouteReady,
      firstSlice: "openclaw-systemd-next-repair-scope-review",
      mutation: false,
      reason: bodyEvidenceLedgerDemoReady
        ? "The body evidence ledger demo is ready; return to real systemd repair semantics with a read-only scope review before any new repair plan."
        : "Next repair scope review waits until the durable body-memory demo package is ready.",
    },
    {
      track: "Track B",
      id: "operator-observer-demo-experience",
      label: "Additional demo polish",
      score: 55,
      recommended: false,
      firstSlice: "defer-additional-demo-polish",
      mutation: false,
      reason: "The demo block has an exit gate; more polish would be lower-value than advancing body capability.",
    },
    {
      track: "Track C",
      id: "body-governance-enhancement",
      label: "Additional body governance summaries",
      score: 65,
      recommended: false,
      firstSlice: "defer-governance-expansion",
      mutation: false,
      reason: "Track C readiness is already present and should now inform the next real repair candidate assessment.",
    },
    {
      track: "Deferred Track",
      id: "plugin-runtime-adapter",
      label: "Plugin/runtime adapter work",
      score: 20,
      recommended: false,
      firstSlice: "defer-plugin-runtime-adapter",
      mutation: false,
      reason: "Plugin/runtime adapter work still lacks a stronger visible body-capability need than next real repair candidate assessment.",
    },
  ];

  return {
    ok: true,
    registry: "openclaw-phase-2-next-capability-route-review-v0",
    mode: "read_only_next_capability_route_selection",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-core",
      demoReadinessExitRegistry: demoExit.registry,
      phase2Plan: "docs/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "phase_2_next_capability_route_review",
    },
    governance: {
      readOnly: true,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      mutatesHost: false,
      triggersRecovery: false,
      schedulesWork: false,
    },
    decision: {
      selectedTrack,
      selectedSlice,
      status: demoReady ? "selected" : "blocked_until_demo_exit_ready",
      rationale: followupRecordPlanRouteReady
        ? "Candidate repair demo evidence and the first ledger record are ready, so plan a follow-up body evidence ledger record without appending it yet."
        : candidateDemoReady
        ? (bodyEvidenceLedgerDemoReady
            ? "The durable body evidence ledger is demo-ready, so return to Track A with a read-only next repair scope review rather than adding more ledger writes."
            : bodyEvidenceLedgerReady
            ? "The first durable body evidence ledger record is ready, so avoid more ledger writes and package the completed block for operator demo."
            : bodyEvidenceTimelineReady
            ? "The body evidence timeline is ready, so avoid looping and plan durable evidence storage before implementing it."
            : "The repair candidate route has been made demo-ready, so avoid looping back into the same candidate block and move to read-only body evidence memory.")
        : "Return to the highest-priority body capability track, but start with read-only candidate assessment before broadening real repair mutation.",
      notSelected: [
        candidateDemoReady ? "no repair candidate assessment loop" : "no additional demo polish before new body capability",
        bodyEvidenceTimelineReady ? "no body evidence timeline loop" : "no candidate-specific approval replay",
        bodyEvidenceLedgerReady ? "no body evidence ledger plan or append loop" : "no body evidence ledger demo before readiness",
        bodyEvidenceLedgerDemoReady ? "no body evidence ledger demo status loop" : "no next repair scope before ledger demo status",
        followupRecordPlanRouteReady ? "no follow-up ledger append without a separate route review" : "no follow-up ledger record before candidate demo completion",
        "no plugin/runtime adapter work",
        "no automatic repair",
        "no broader host mutation",
        bodyEvidenceTimelineReady ? "no durable storage implementation before a plan" : "no persistence hardening or denial recovery loop",
      ],
    },
    evidence: {
      demoReady,
      demoExitChecks: `${demoExit.summary?.passed ?? 0}/${demoExit.summary?.total ?? 0}`,
      candidateDemoReady,
      candidateDemoStatusRegistry: candidateDemoStatus?.registry ?? null,
      candidateDemoSelectedUnit: candidateDemoStatus?.summary?.selectedUnit ?? null,
      bodyEvidenceTimelineReady,
      bodyEvidenceTimelineReadinessRegistry: bodyEvidenceTimelineReadiness?.registry ?? null,
      bodyEvidenceLedgerReady,
      bodyEvidenceLedgerReadinessRegistry: bodyEvidenceLedgerReadiness?.registry ?? null,
      bodyEvidenceLedgerRecordCount: bodyEvidenceLedgerReadiness?.summary?.recordCount ?? 0,
      bodyEvidenceLedgerDemoReady,
      bodyEvidenceLedgerDemoStatusCheckpointComplete: ledgerDemoStatusCheckpointComplete,
      bodyEvidenceLedgerDemoStatusRegistry: bodyEvidenceLedgerDemoStatus?.registry ?? null,
      repairCandidateDemoStatusCheckpointComplete: repairCandidateDemoCheckpointComplete,
      bodyEvidenceLedgerFollowupRecordPlanReady: followupRecordPlanReady,
      bodyEvidenceLedgerFollowupRecordPlanRegistry: bodyEvidenceLedgerFollowupRecordPlan?.registry ?? null,
      bodyEvidenceLedgerFollowupPlannedSequence: bodyEvidenceLedgerFollowupRecordPlan?.summary?.plannedSequence ?? null,
      completedDemoBlock: demoExit.completedBlock,
      priorityOrder: [
        "real-systemd-repair-semantics",
        "operator-observer-demo-experience",
        "body-governance-enhancement",
        "plugin-runtime-adapter-deferred",
      ],
    },
    candidates,
    next: {
      recommendedSlice: selectedSlice,
      boundary: followupRecordPlanRouteReady
        ? "plan-only follow-up ledger record only; do not create tasks, approvals, schedulers, or append a second JSONL record"
        : bodyEvidenceLedgerDemoReady
        ? "read-only next systemd repair scope review only; do not create repair tasks, execute commands, or broaden mutation"
        : bodyEvidenceLedgerReady
        ? "read-only ledger demo status only; do not add more ledger records, background writers, schedulers, or host mutation"
        : bodyEvidenceTimelineReady
        ? "plan-only durable evidence ledger design; do not write durable storage, schedule work, execute commands, or mutate host"
        : candidateDemoReady
          ? "read-only body evidence timeline only; do not create tasks, execute commands, mutate host, or schedule recovery"
        : "read-only candidate assessment only; do not create repair tasks or execute host mutation",
    },
  };
}

function baseCapabilities() {
  return [
    {
      id: "sense.screen.observe",
      name: "Screen Observation",
      kind: "sensor",
      service: "openclaw-screen-sense",
      endpoint: `${screenSenseUrl}/screen/state`,
      intents: ["screen.observe"],
      domains: ["body_internal"],
      risk: "low",
      governance: "audit_only",
      description: "Observe focused window, screen readiness, and snapshot summaries.",
    },
    {
      id: "sense.system.vitals",
      name: "System Vitals",
      kind: "sensor",
      service: "openclaw-system-sense",
      endpoint: `${systemSenseUrl}/system/health`,
      intents: ["system.observe", "body.inspect"],
      domains: ["body_internal"],
      risk: "low",
      governance: "audit_only",
      description: "Read host identity, service health, resources, network, and alerts.",
    },
    {
      id: "sense.filesystem.read",
      name: "Filesystem Read Sense",
      kind: "sensor",
      service: "openclaw-system-sense",
      endpoint: `${systemSenseUrl}/system/files/list`,
      intents: ["filesystem.metadata", "filesystem.list", "filesystem.search", "filesystem.read_text", "filesystem.read-text"],
      domains: ["body_internal"],
      risk: "medium",
      governance: "audit_only",
      description: "Read file metadata, list allowed directories, search filenames, and read bounded UTF-8 text inside configured body roots.",
    },
    {
      id: "act.filesystem.write_text",
      name: "Filesystem Text Write",
      kind: "actuator",
      service: "openclaw-system-sense",
      endpoint: `${systemSenseUrl}/system/files/write-text`,
      intents: ["filesystem.write", "filesystem.write_text", "filesystem.write-text"],
      domains: ["body_internal"],
      risk: "high",
      governance: "require_approval",
      requiresApproval: true,
      description: "Write bounded UTF-8 text files inside configured body roots with audit and policy governance.",
    },
    {
      id: "act.filesystem.append_text",
      name: "Filesystem Text Append",
      kind: "actuator",
      service: "openclaw-system-sense",
      endpoint: `${systemSenseUrl}/system/files/append-text`,
      intents: ["filesystem.append", "filesystem.append_text", "filesystem.append-text"],
      domains: ["body_internal"],
      risk: "high",
      governance: "require_approval",
      requiresApproval: true,
      description: "Append bounded UTF-8 text to existing files inside configured body roots with audit and policy governance.",
    },
    {
      id: "act.filesystem.mkdir",
      name: "Filesystem Directory Create",
      kind: "actuator",
      service: "openclaw-system-sense",
      endpoint: `${systemSenseUrl}/system/files/mkdir`,
      intents: ["filesystem.mkdir", "filesystem.directory.create"],
      domains: ["body_internal"],
      risk: "high",
      governance: "require_approval",
      requiresApproval: true,
      description: "Create directories inside configured body roots with optional recursive creation and audit.",
    },
    {
      id: "sense.process.list",
      name: "Process List Sense",
      kind: "sensor",
      service: "openclaw-system-sense",
      endpoint: `${systemSenseUrl}/system/processes`,
      intents: ["process.list", "process.inspect"],
      domains: ["body_internal"],
      risk: "medium",
      governance: "audit_only",
      description: "Inspect local process summaries without mutating process state.",
    },
    {
      id: "sense.plugin.manifest_profile",
      name: "Native Plugin Manifest Profile",
      kind: "sensor",
      service: "openclaw-core",
      endpoint: `http://${host}:${port}/plugins/native-adapter/manifest-profile`,
      intents: ["plugin.manifest.profile", "plugin.manifest_profile", "plugin.profile"],
      domains: ["body_internal"],
      risk: "low",
      governance: "audit_only",
      description: "Profile reviewed OpenClaw plugin SDK manifest metadata through the native adapter shell without reading source contents or executing plugin code.",
    },
    {
      id: "sense.openclaw.tool_catalog",
      name: "Native OpenClaw Tool Catalog",
      kind: "sensor",
      service: "openclaw-core",
      endpoint: `http://${host}:${port}/plugins/native-adapter/tool-catalog`,
      intents: ["openclaw.tool.catalog", "openclaw.tool_catalog", "tool.catalog", "tool_catalog"],
      domains: ["body_internal"],
      risk: "low",
      governance: "audit_only",
      description: "Query absorbed enhanced OpenClaw tool metadata through the native adapter shell without importing or executing legacy tool code.",
    },
    {
      id: "sense.openclaw.workspace_semantic_index",
      name: "Native OpenClaw Workspace Semantic Index",
      kind: "sensor",
      service: "openclaw-core",
      endpoint: `http://${host}:${port}/plugins/native-adapter/workspace-semantic-index`,
      intents: [
        "openclaw.workspace.semantic_index",
        "openclaw.workspace.semantic-index",
        "workspace.semantic_index",
        "workspace.semantic-index",
        "semantic.index",
      ],
      domains: ["body_internal"],
      risk: "low",
      governance: "audit_only",
      description: "Build a bounded derived semantic index from enhanced OpenClaw files without exposing source text or executing legacy code.",
    },
    {
      id: "sense.openclaw.workspace_symbol_lookup",
      name: "Native OpenClaw Workspace Symbol Lookup",
      kind: "sensor",
      service: "openclaw-core",
      endpoint: `http://${host}:${port}/plugins/native-adapter/workspace-symbol-lookup`,
      intents: [
        "openclaw.workspace.symbol_lookup",
        "openclaw.workspace.symbol-lookup",
        "workspace.symbol_lookup",
        "workspace.symbol-lookup",
        "symbol.lookup",
      ],
      domains: ["body_internal"],
      risk: "low",
      governance: "audit_only",
      description: "Execute a bounded read-only symbol lookup over enhanced OpenClaw workspace files without exposing function bodies or executing legacy code.",
    },
    {
      id: "sense.openclaw.plugin_manifest_map",
      name: "Native OpenClaw Plugin Manifest Map",
      kind: "sensor",
      service: "openclaw-core",
      endpoint: `http://${host}:${port}/plugins/native-adapter/plugin-manifest-map`,
      intents: [
        "openclaw.plugin.manifest_map",
        "openclaw.plugin-manifest-map",
        "plugin.manifest_map",
        "plugin-manifest-map",
      ],
      domains: ["body_internal"],
      risk: "low",
      governance: "audit_only",
      description: "Map enhanced OpenClaw extension manifests into native registry candidates without exposing auth material, importing modules, or activating plugin runtimes.",
    },
    {
      id: "plan.openclaw.plugin_capability",
      name: "Native OpenClaw Plugin Capability Plan",
      kind: "planner",
      service: "openclaw-core",
      endpoint: `http://${host}:${port}/plugins/native-adapter/plugin-capability-plan`,
      intents: [
        "openclaw.plugin.capability_plan",
        "openclaw.plugin-capability-plan",
        "plugin.capability_plan",
        "plugin-capability-plan",
      ],
      domains: ["body_internal"],
      risk: "low",
      governance: "audit_only",
      description: "Derive native capability candidates and governance gates from enhanced OpenClaw plugin manifests without importing, executing, or activating plugins.",
    },
    {
      id: "plan.openclaw.plugin_search_web_adapter_contract",
      name: "Native OpenClaw Search/Web Adapter Contract",
      kind: "planner",
      service: "openclaw-core",
      endpoint: `http://${host}:${port}/plugins/native-adapter/plugin-search-web-adapter-contract`,
      intents: [
        "openclaw.plugin.search_web_contract",
        "openclaw.plugin.search-web-contract",
        "plugin.search_web.contract",
        "plugin.search-web-contract",
      ],
      domains: ["body_internal"],
      risk: "low",
      governance: "audit_only",
      description: "Map selected enhanced OpenClaw search/web plugin candidates into native adapter contracts without network use, old module imports, plugin execution, or runtime activation.",
    },
    {
      id: "act.openclaw.workspace_text_write",
      name: "Native OpenClaw Workspace Text Write",
      kind: "actuator",
      service: "openclaw-core",
      endpoint: `http://${host}:${port}/plugins/native-adapter/workspace-text-write-tasks`,
      intents: [
        "openclaw.workspace.write_text",
        "openclaw.workspace.write-text",
        "openclaw.workspace_text_write",
        "workspace.write_text",
        "workspace.write-text",
      ],
      domains: ["body_internal"],
      risk: "high",
      governance: "require_approval",
      requiresApproval: true,
      description: "Create approval-gated native tasks for bounded OpenClaw workspace text writes using the existing filesystem write capability and ledger.",
    },
    {
      id: "act.openclaw.workspace_patch_apply",
      name: "Native OpenClaw Workspace Patch Apply",
      kind: "actuator",
      service: "openclaw-core",
      endpoint: `http://${host}:${port}/plugins/native-adapter/workspace-patch-apply-tasks`,
      intents: [
        "openclaw.workspace.patch_apply",
        "openclaw.workspace.patch-apply",
        "openclaw.workspace_patch_apply",
        "workspace.patch_apply",
        "workspace.patch-apply",
        "workspace.edit_apply",
      ],
      domains: ["body_internal"],
      risk: "high",
      governance: "require_approval",
      requiresApproval: true,
      description: "Create approval-gated native tasks for bounded OpenClaw workspace patch application with diff preview, using the existing filesystem write capability and ledger.",
    },
    {
      id: "act.system.command.dry_run",
      name: "System Command Dry Run",
      kind: "actuator",
      service: "openclaw-system-sense",
      endpoint: `${systemSenseUrl}/system/command/dry-run`,
      intents: ["system.command", "command.plan"],
      domains: ["body_internal", "cross_boundary"],
      risk: "high",
      governance: "require_approval",
      requiresApproval: true,
      description: "Plan command execution conservatively without running it, surfacing risk and approval requirements.",
    },
    {
      id: "act.system.command.execute",
      name: "Controlled System Command Execute",
      kind: "actuator",
      service: "openclaw-system-sense",
      endpoint: `${systemSenseUrl}/system/command/execute`,
      intents: ["system.command.execute", "command.execute"],
      domains: ["body_internal"],
      risk: "high",
      governance: "require_approval",
      requiresApproval: true,
      description: "Execute allowlisted body-internal commands without a shell, bounded by cwd, timeout, output limits, and audit.",
    },
    {
      id: "memory.event.audit",
      name: "Event Audit Ledger",
      kind: "memory",
      service: "openclaw-event-hub",
      endpoint: `${eventHubUrl}/events/audit/summary`,
      intents: ["memory.audit", "event.query"],
      domains: ["body_internal"],
      risk: "low",
      governance: "audit_only",
      description: "Persist and query the control-plane black-box event log.",
    },
    {
      id: "act.work_view.control",
      name: "AI Work View Control",
      kind: "actuator",
      service: "openclaw-session-manager",
      endpoint: `${sessionManagerUrl}/work-view/state`,
      intents: ["work_view.prepare", "work_view.reveal", "work_view.hide"],
      domains: ["user_task", "body_internal"],
      risk: "low",
      governance: "allow",
      description: "Prepare, reveal, hide, and attach the observable AI work view.",
    },
    {
      id: "act.browser.open",
      name: "Browser Runtime Navigation",
      kind: "actuator",
      service: "openclaw-browser-runtime",
      endpoint: `${browserRuntimeUrl}/browser/state`,
      intents: ["browser.open", "network.navigate"],
      domains: ["user_task"],
      risk: "medium",
      governance: "allow",
      description: "Open target URLs inside the browser runtime body component.",
    },
    {
      id: "act.screen.pointer_keyboard",
      name: "Pointer And Keyboard Action",
      kind: "actuator",
      service: "openclaw-screen-act",
      endpoint: `${screenActUrl}/act/state`,
      intents: ["mouse.click", "keyboard.type"],
      domains: ["user_task"],
      risk: "medium",
      governance: "allow",
      description: "Perform bounded pointer and keyboard actions through screen-act.",
    },
    {
      id: "act.system.heal",
      name: "Conservative System Heal",
      kind: "actuator",
      service: "openclaw-system-heal",
      endpoint: `${systemHealUrl}/heal/state`,
      intents: ["heal.diagnose", "heal.autofix", "heal.maintenance", "heal.maintenance.tick", "heal.restart-service", "system.repair"],
      domains: ["body_internal"],
      risk: "medium",
      governance: "audit_only",
      description: "Diagnose body health, run conservative maintenance, and execute simulated repairs.",
    },
    {
      id: "govern.policy.evaluate",
      name: "Policy Governance",
      kind: "governance",
      service: "openclaw-core",
      endpoint: `http://${host}:${port}/policy/state`,
      intents: ["policy.evaluate", "approval.gate"],
      domains: ["body_internal", "user_task", "cross_boundary"],
      risk: "high",
      governance: "required",
      description: "Classify intent domains, enforce denial boundaries, and gate cross-boundary actions.",
    },
    {
      id: "operate.task.loop",
      name: "Operator Loop",
      kind: "operator",
      service: "openclaw-core",
      endpoint: `http://${host}:${port}/operator/state`,
      intents: ["operator.step", "operator.run", "operator.pause", "operator.resume"],
      domains: ["body_internal", "user_task"],
      risk: "medium",
      governance: "policy_enforced",
      description: "Consume queued planned tasks while respecting pause state and policy gates.",
    },
    {
      id: "boundary.cross_domain.approval",
      name: "Cross-Boundary Approval Boundary",
      kind: "boundary",
      service: "openclaw-core",
      endpoint: `http://${host}:${port}/policy/state`,
      intents: [...CROSS_BOUNDARY_INTENTS],
      domains: ["cross_boundary"],
      risk: "high",
      governance: "require_approval",
      requiresApproval: true,
      description: "Represent actions that leave the user's local body boundary and require approval.",
    },
  ];
}

function serviceHealthUrl(service) {
  const urls = {
    "openclaw-core": `http://${host}:${port}/health`,
    "openclaw-event-hub": `${eventHubUrl}/health`,
    "openclaw-session-manager": `${sessionManagerUrl}/health`,
    "openclaw-browser-runtime": `${browserRuntimeUrl}/health`,
    "openclaw-screen-sense": `${screenSenseUrl}/health`,
    "openclaw-screen-act": `${screenActUrl}/health`,
    "openclaw-system-sense": `${systemSenseUrl}/health`,
    "openclaw-system-heal": `${systemHealUrl}/health`,
  };
  return urls[service] ?? null;
}

async function probeServiceHealth(service) {
  if (service === "openclaw-core") {
    return {
      ok: true,
      status: "online",
      detail: "local-core",
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
    };
  }

  const url = serviceHealthUrl(service);
  if (!url) {
    return {
      ok: false,
      status: "unknown",
      detail: "no-health-url",
      latencyMs: null,
      checkedAt: new Date().toISOString(),
    };
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CAPABILITY_HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    return {
      ok: response.ok && data?.ok !== false,
      status: response.ok && data?.ok !== false ? "online" : "degraded",
      detail: data?.service ?? data?.stage ?? response.statusText,
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return {
      ok: false,
      status: "offline",
      detail: message,
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function summariseCapabilities(capabilities) {
  return capabilities.reduce((summary, capability) => {
    summary.total += 1;
    summary[capability.status] = (summary[capability.status] ?? 0) + 1;
    summary.byKind[capability.kind] = (summary.byKind[capability.kind] ?? 0) + 1;
    summary.byRisk[capability.risk] = (summary.byRisk[capability.risk] ?? 0) + 1;
    summary.byGovernance[capability.governance] = (summary.byGovernance[capability.governance] ?? 0) + 1;
    if (capability.requiresApproval) {
      summary.requiresApproval += 1;
    }
    return summary;
  }, {
    total: 0,
    online: 0,
    degraded: 0,
    offline: 0,
    unknown: 0,
    requiresApproval: 0,
    byKind: {},
    byRisk: {},
    byGovernance: {},
  });
}

function normaliseCapabilityInvokeRequest(body = {}) {
  const capabilityId =
    typeof body.capabilityId === "string" && body.capabilityId.trim()
      ? body.capabilityId.trim()
      : typeof body.id === "string" && body.id.trim()
        ? body.id.trim()
        : "";
  const params = body.params && typeof body.params === "object" ? body.params : {};
  return {
    capabilityId,
    taskId: typeof body.taskId === "string" && body.taskId.trim() ? body.taskId.trim() : null,
    params,
    operation: typeof body.operation === "string" && body.operation.trim() ? body.operation.trim() : null,
    intent: typeof body.intent === "string" && body.intent.trim() ? body.intent.trim() : null,
    approved: body.approved === true || body.policy?.approved === true,
    policy: body.policy && typeof body.policy === "object" ? body.policy : {},
  };
}

function buildCapabilityPolicyInput(capability, request) {
  const intent = request.intent ?? capability.intents?.[0] ?? "capability.invoke";
  const preferredDomain = capability.domains?.includes("cross_boundary")
    && !capability.domains?.includes("body_internal")
    ? "cross_boundary"
    : capability.domains?.[0] ?? "body_internal";
  return {
    type: "capability_invoke",
    taskId: request.taskId ?? null,
    intent,
    domain: request.policy.domain ?? preferredDomain,
    risk: request.policy.risk ?? capability.risk,
    requiresApproval:
      request.policy.requiresApproval === true
      || capability.requiresApproval === true
      || capability.governance === "require_approval",
    approved: request.approved,
    policy: {
      ...request.policy,
      intent,
      domain: request.policy.domain ?? preferredDomain,
      risk: request.policy.risk ?? capability.risk,
      requiresApproval:
        request.policy.requiresApproval === true
        || capability.requiresApproval === true
        || capability.governance === "require_approval",
      approved: request.approved,
    },
  };
}

function buildSystemSenseUrl(pathname, params = {}) {
  const url = new URL(pathname, systemSenseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function callCapabilityBackend(capability, request) {
  if (capability.id === "sense.system.vitals") {
    return fetchJson(`${systemSenseUrl}/system/health`);
  }

  if (capability.id === "sense.filesystem.read") {
    const operation = request.operation ?? request.params.operation ?? "list";
    if (operation === "read_text" || operation === "read-text") {
      return fetchJson(buildSystemSenseUrl("/system/files/read-text", {
        path: request.params.path,
      }));
    }
    if (operation === "metadata") {
      return fetchJson(buildSystemSenseUrl("/system/files/metadata", {
        path: request.params.path,
      }));
    }
    if (operation === "search") {
      return fetchJson(buildSystemSenseUrl("/system/files/search", {
        path: request.params.path,
        query: request.params.query ?? request.params.q,
        limit: request.params.limit,
      }));
    }
    return fetchJson(buildSystemSenseUrl("/system/files/list", {
      path: request.params.path,
      limit: request.params.limit,
    }));
  }

  if (capability.id === "act.filesystem.write_text") {
    return postJson(`${systemSenseUrl}/system/files/write-text`, {
      ...request.params,
      intent: request.intent ?? "filesystem.write",
    });
  }

  if (capability.id === "act.filesystem.append_text") {
    return postJson(`${systemSenseUrl}/system/files/append-text`, {
      ...request.params,
      intent: request.intent ?? "filesystem.append",
    });
  }

  if (capability.id === "act.filesystem.mkdir") {
    return postJson(`${systemSenseUrl}/system/files/mkdir`, {
      ...request.params,
      intent: request.intent ?? "filesystem.mkdir",
    });
  }

  if (capability.id === "sense.process.list") {
    return fetchJson(buildSystemSenseUrl("/system/processes", {
      query: request.params.query ?? request.params.q,
      limit: request.params.limit,
    }));
  }

  if (capability.id === "sense.plugin.manifest_profile") {
    return buildNativePluginManifestProfile({
      packagePath: request.params.packagePath,
    });
  }

  if (capability.id === "sense.openclaw.tool_catalog") {
    return buildNativeOpenClawToolCatalogProfile({
      workspacePath: request.params.workspacePath,
      category: request.params.category,
      query: request.params.query ?? request.params.q,
      limit: request.params.limit,
    });
  }

  if (capability.id === "sense.openclaw.workspace_semantic_index") {
    return buildNativeOpenClawWorkspaceSemanticIndex({
      workspacePath: request.params.workspacePath,
      scope: request.params.scope,
      query: request.params.query ?? request.params.q,
      limit: request.params.limit,
    });
  }

  if (capability.id === "sense.openclaw.workspace_symbol_lookup") {
    return buildNativeOpenClawWorkspaceSymbolLookup({
      workspacePath: request.params.workspacePath,
      scope: request.params.scope,
      query: request.params.query ?? request.params.q,
      limit: request.params.limit,
    });
  }

  if (capability.id === "sense.openclaw.workspace_edit_target_select") {
    return buildNativeOpenClawWorkspaceEditTargetSelection({
      workspacePath: request.params.workspacePath,
      scope: request.params.scope,
      query: request.params.query ?? request.params.q,
      limit: request.params.limit,
    });
  }

  if (capability.id === "sense.openclaw.prompt_pack") {
    return buildNativeOpenClawPromptSemanticsProfile({
      workspacePath: request.params.workspacePath,
      query: request.params.query ?? request.params.q,
      limit: request.params.limit,
    });
  }

  if (capability.id === "sense.openclaw.plugin_manifest_map") {
    return buildOpenClawPluginManifestMap({
      workspacePath: request.params.workspacePath,
      query: request.params.query ?? request.params.q,
      limit: request.params.limit,
    });
  }

  if (capability.id === "plan.openclaw.plugin_capability") {
    return buildOpenClawPluginCapabilityPlan({
      workspacePath: request.params.workspacePath,
      query: request.params.query ?? request.params.q,
      limit: request.params.limit,
    });
  }

  if (capability.id === "act.system.command.dry_run") {
    return postJson(`${systemSenseUrl}/system/command/dry-run`, {
      ...request.params,
      intent: request.intent ?? "system.command",
    });
  }

  if (capability.id === "act.system.command.execute") {
    return postJson(`${systemSenseUrl}/system/command/execute`, {
      ...request.params,
      intent: request.intent ?? "system.command.execute",
    });
  }

  if (capability.id === "act.system.heal") {
    const operation = request.operation ?? request.params.operation ?? request.intent ?? "heal.autofix";
    if (operation === "heal.diagnose" || operation === "diagnose") {
      return postJson(`${systemHealUrl}/heal/diagnose`, request.params);
    }
    if (operation === "heal.restart-service" || operation === "restart-service") {
      return postJson(`${systemHealUrl}/heal/restart-service`, request.params);
    }
    if (operation === "heal.maintenance" || operation === "maintenance" || operation === "system.repair") {
      return postJson(`${systemHealUrl}/maintenance/run`, request.params);
    }
    if (operation === "heal.maintenance.tick" || operation === "maintenance.tick" || operation === "tick") {
      return postJson(`${systemHealUrl}/maintenance/tick`, request.params);
    }
    return postJson(`${systemHealUrl}/heal/autofix`, request.params);
  }

  throw new Error(`Capability ${capability.id} is not invokable through core-v0.`);
}

function requestOperationFromResult(result) {
  if (result?.mode === "read_text") {
    return "read_text";
  }
  if (result?.metadata) {
    return "metadata";
  }
  if (Array.isArray(result?.results)) {
    return "search";
  }
  if (Array.isArray(result?.entries)) {
    return "list";
  }
  return "read";
}

function summariseCapabilityInvocationResult(capability, result) {
  if (capability.id === "sense.system.vitals") {
    return {
      kind: "system.vitals",
      ok: result?.ok === true,
      alerts: result?.system?.alerts?.length ?? 0,
      services: Object.keys(result?.system?.services ?? {}).length,
    };
  }
  if (capability.id === "sense.filesystem.read") {
    const operation = result?.mode === "read_text"
      ? "read_text"
      : requestOperationFromResult(result);
    if (result?.mode === "read_text") {
      return {
        kind: "filesystem.read_text",
        ok: result?.ok === true,
        path: result?.path ?? null,
        contentBytes: result?.contentBytes ?? null,
        encoding: result?.encoding ?? null,
        operation,
      };
    }
    return {
      kind: "filesystem.read",
      ok: result?.ok === true,
      count: result?.count ?? (result?.metadata ? 1 : 0),
      path: result?.path ?? null,
      operation,
    };
  }
  if (capability.id === "act.filesystem.write_text") {
    return {
      kind: "filesystem.write_text",
      ok: result?.ok === true,
      path: result?.path ?? null,
      contentBytes: result?.contentBytes ?? null,
      overwrite: result?.overwrite ?? null,
    };
  }
  if (capability.id === "act.filesystem.append_text") {
    return {
      kind: "filesystem.append_text",
      ok: result?.ok === true,
      path: result?.path ?? null,
      contentBytes: result?.contentBytes ?? null,
      previousBytes: result?.previousBytes ?? null,
      totalBytes: result?.totalBytes ?? null,
    };
  }
  if (capability.id === "act.filesystem.mkdir") {
    return {
      kind: "filesystem.mkdir",
      ok: result?.ok === true,
      path: result?.path ?? null,
      created: result?.created ?? null,
      recursive: result?.recursive ?? null,
    };
  }
  if (capability.id === "sense.process.list") {
    return {
      kind: "process.list",
      ok: result?.ok === true,
      count: result?.count ?? 0,
    };
  }
  if (capability.id === "sense.plugin.manifest_profile") {
    return {
      kind: "plugin.manifest_profile",
      ok: result?.ok === true,
      pluginId: result?.plugin?.id ?? null,
      packageName: result?.plugin?.packageName ?? null,
      exportKeys: result?.plugin?.exportKeys?.length ?? 0,
      scriptNames: result?.plugin?.scriptNames?.length ?? 0,
      capabilities: Array.isArray(result?.capabilities) ? result.capabilities.length : 0,
      canExecutePluginCode: result?.governance?.canExecutePluginCode === true,
    };
  }
  if (capability.id === "sense.openclaw.tool_catalog") {
    return {
      kind: "openclaw.tool_catalog",
      ok: result?.ok === true,
      totalTools: result?.summary?.totalTools ?? 0,
      matchedTools: result?.summary?.matchedTools ?? 0,
      categories: result?.summary?.categoryCount ?? 0,
      filterApplied: result?.summary?.filterApplied === true,
      canExecuteToolCode: result?.governance?.canExecuteToolCode === true,
    };
  }
  if (capability.id === "sense.openclaw.workspace_semantic_index") {
    return {
      kind: "openclaw.workspace_semantic_index",
      ok: result?.ok === true,
      scope: result?.scope?.id ?? null,
      totalFiles: result?.summary?.totalFiles ?? 0,
      contentRead: result?.summary?.contentRead ?? 0,
      exportStatements: result?.summary?.exportStatements ?? 0,
      functionDeclarations: result?.summary?.functionDeclarations ?? 0,
      semanticVocabularyFiles: result?.summary?.semanticVocabularyFiles ?? 0,
      exposesSourceFileContent: result?.governance?.exposesSourceFileContent === true,
      canExecuteToolCode: result?.governance?.canExecuteToolCode === true,
    };
  }
  if (capability.id === "sense.openclaw.workspace_symbol_lookup") {
    return {
      kind: "openclaw.workspace_symbol_lookup",
      ok: result?.ok === true,
      query: result?.query?.text ?? null,
      scope: result?.query?.scope ?? null,
      matchedSymbols: result?.summary?.matchedSymbols ?? 0,
      filesScanned: result?.summary?.filesScanned ?? 0,
      declarationsScanned: result?.summary?.declarationsScanned ?? 0,
      canExecuteQuery: result?.governance?.canExecuteQuery === true,
      exposesSourceFileContent: result?.governance?.exposesSourceFileContent === true,
      exposesFunctionBodies: result?.governance?.exposesFunctionBodies === true,
      canExecuteToolCode: result?.governance?.canExecuteToolCode === true,
    };
  }
  if (capability.id === "act.system.command.dry_run") {
    return {
      kind: "command.dry_run",
      ok: result?.ok === true,
      risk: result?.plan?.risk ?? null,
      governance: result?.plan?.governance ?? null,
      wouldExecute: result?.plan?.wouldExecute ?? null,
    };
  }
  if (capability.id === "act.system.command.execute") {
    return {
      kind: "command.execute",
      ok: result?.ok === true,
      risk: result?.execution?.risk ?? null,
      governance: result?.execution?.governance ?? null,
      wouldExecute: result?.execution?.wouldExecute ?? null,
      exitCode: result?.execution?.result?.exitCode ?? null,
      timedOut: result?.execution?.result?.timedOut ?? null,
      stdout: result?.execution?.result?.stdout ?? "",
      stderr: result?.execution?.result?.stderr ?? "",
    };
  }
  if (capability.id === "act.system.heal") {
    const run = result?.run ?? null;
    const diagnosis = run?.diagnosis ?? result?.diagnosis ?? null;
    const executed = run?.executed ?? result?.executed ?? [];
    const skipped = run?.skipped ?? result?.skipped ?? [];
    return {
      kind: run ? "maintenance.run" : "system.heal",
      ok: result?.ok === true,
      status: result?.tick?.status ?? run?.status ?? diagnosis?.status ?? null,
      diagnosisStatus: diagnosis?.status ?? null,
      planSteps: diagnosis?.plan?.stepCount ?? 0,
      executed: Array.isArray(executed) ? executed.length : 0,
      skipped: Array.isArray(skipped) ? skipped.length : 0,
      maintenanceRunId: run?.id ?? null,
      tickReason: result?.tick?.reason ?? null,
      nextDueAt: result?.policy?.nextDueAt ?? null,
    };
  }
  return {
    kind: capability.id,
    ok: result?.ok === true,
  };
}

function recordCapabilityInvocation({ capability, request, policy, invoked, blocked, reason = null, summary = null }) {
  const entry = {
    id: randomUUID(),
    at: new Date().toISOString(),
    capability: {
      id: capability.id,
      name: capability.name,
      kind: capability.kind,
      service: capability.service,
      risk: capability.risk,
      governance: capability.governance,
    },
    request: {
      taskId: request.taskId ?? null,
      operation: request.operation ?? request.params?.operation ?? null,
      intent: request.intent ?? capability.intents?.[0] ?? null,
      approved: request.approved === true,
      command: typeof request.params?.command === "string" ? request.params.command : null,
      cwd: typeof request.params?.cwd === "string" ? request.params.cwd : typeof request.params?.workingDirectory === "string" ? request.params.workingDirectory : null,
      path: typeof request.params?.path === "string" ? request.params.path : null,
    },
    policy: {
      id: policy.id,
      decision: policy.decision,
      domain: policy.domain,
      risk: policy.risk,
      reason: policy.reason,
      approved: policy.approved,
      autonomyMode: policy.autonomyMode,
      autonomous: policy.autonomous === true,
    },
    invoked: invoked === true,
    blocked: blocked === true,
    reason,
    summary,
  };
  capabilityInvocationLog.push(entry);
  if (capabilityInvocationLog.length > MAX_CAPABILITY_INVOCATION_ENTRIES) {
    capabilityInvocationLog.splice(0, capabilityInvocationLog.length - MAX_CAPABILITY_INVOCATION_ENTRIES);
  }
  persistState();
  return entry;
}

function listCapabilityInvocations({ limit = 20, capabilityId = null } = {}) {
  const safeLimit = Math.max(1, Math.min(Number.isInteger(limit) ? limit : 20, 100));
  return capabilityInvocationLog
    .filter((entry) => !capabilityId || entry.capability?.id === capabilityId)
    .slice()
    .sort((left, right) => String(right.at).localeCompare(String(left.at)))
    .slice(0, safeLimit);
}

function buildCapabilityInvocationSummary() {
  return capabilityInvocationLog.reduce((summary, entry) => {
    summary.total += 1;
    if (entry.invoked) {
      summary.invoked += 1;
    }
    if (entry.blocked) {
      summary.blocked += 1;
    }
    const capabilityId = entry.capability?.id ?? "unknown";
    summary.byCapability[capabilityId] = (summary.byCapability[capabilityId] ?? 0) + 1;
    const decision = entry.policy?.decision ?? "unknown";
    summary.byPolicy[decision] = (summary.byPolicy[decision] ?? 0) + 1;
    if (!summary.latestAt || String(entry.at).localeCompare(summary.latestAt) > 0) {
      summary.latestAt = entry.at;
    }
    return summary;
  }, {
    total: 0,
    invoked: 0,
    blocked: 0,
    latestAt: null,
    byCapability: {},
    byPolicy: {},
  });
}

async function invokeCapability(body = {}) {
  const request = normaliseCapabilityInvokeRequest(body);
  if (!request.capabilityId) {
    return {
      statusCode: 400,
      response: { ok: false, error: "capabilityId is required." },
    };
  }

  const capability = capabilityById(request.capabilityId);
  if (!capability) {
    return {
      statusCode: 404,
      response: { ok: false, error: "Capability not found." },
    };
  }

  const policy = recordPolicyDecision(evaluatePolicyIntent(
    buildCapabilityPolicyInput(capability, request),
    {
      stage: "capability.invoke",
      type: "capability_invoke",
      goal: `Invoke ${capability.id}`,
    },
  ));
  await publishEvent("policy.evaluated", { capability, policy });

  if (!isPolicyExecutionAllowed(policy)) {
    const reason = policy.decision === "deny" ? "policy_denied" : "policy_requires_approval";
    const invocation = recordCapabilityInvocation({
      capability,
      request,
      policy,
      invoked: false,
      blocked: true,
      reason,
      summary: {
        kind: capability.id,
        ok: false,
      },
    });
    await publishEvent("capability.blocked", {
      invocation,
      capability,
      policy,
      reason: policy.reason,
    });
    return {
      statusCode: 200,
      response: {
        ok: true,
        invoked: false,
        blocked: true,
        reason,
        capability,
        policy,
        invocation,
      },
    };
  }

  const result = await callCapabilityBackend(capability, request);
  const summary = summariseCapabilityInvocationResult(capability, result);
  const invocation = recordCapabilityInvocation({
    capability,
    request,
    policy,
    invoked: true,
    blocked: false,
    summary,
  });
  await publishEvent("capability.invoked", {
    invocation,
    capability,
    policy,
    summary,
  });
  return {
    statusCode: 200,
    response: {
      ok: true,
      invoked: true,
      blocked: false,
      capability,
      policy,
      summary,
      invocation,
      result,
    },
  };
}

async function buildCapabilityRegistry() {
  const serviceNames = [...new Set(baseCapabilities().map((capability) => capability.service))];
  const healthEntries = await Promise.all(serviceNames.map(async (service) => [service, await probeServiceHealth(service)]));
  const healthByService = Object.fromEntries(healthEntries);
  const capabilities = baseCapabilities().map((capability) => {
    const health = healthByService[capability.service] ?? { ok: false, status: "unknown" };
    return {
      ...capability,
      status: health.status,
      available: health.ok === true,
      health,
    };
  });

  return {
    registry: "capability-v0",
    mode: "local-body-registry",
    generatedAt: new Date().toISOString(),
    capabilities,
    summary: summariseCapabilities(capabilities),
  };
}

function normalisePolicyTags(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((tag) => typeof tag === "string" && tag.trim())
    .map((tag) => tag.trim());
}

function inferPolicyIntent(input = {}) {
  const policy = input.policy && typeof input.policy === "object" ? input.policy : {};
  const action = input.action && typeof input.action === "object" ? input.action : {};
  const rawIntent =
    policy.intent
    ?? input.intent
    ?? action.intent
    ?? action.kind
    ?? input.actionKind
    ?? input.kind
    ?? input.type
    ?? "task.execute";

  return typeof rawIntent === "string" && rawIntent.trim() ? rawIntent.trim() : "task.execute";
}

function inferPolicyDomain({ input, intent, tags }) {
  const policy = input.policy && typeof input.policy === "object" ? input.policy : {};
  const explicitDomain = typeof policy.domain === "string" && policy.domain.trim()
    ? policy.domain.trim()
    : typeof input.domain === "string" && input.domain.trim()
      ? input.domain.trim()
      : null;

  if (explicitDomain) {
    return explicitDomain;
  }

  if (
    policy.crossBoundary === true
    || input.crossBoundary === true
    || CROSS_BOUNDARY_INTENTS.has(intent)
    || tags.includes("cross_boundary")
    || tags.includes("external")
    || tags.includes("data_egress")
  ) {
    return "cross_boundary";
  }

  if (
    intent.startsWith("heal.")
    || intent.startsWith("system.")
    || intent.startsWith("body.")
    || input.type === "system_task"
    || input.type === "heal_task"
  ) {
    return "body_internal";
  }

  return "user_task";
}

function inferPolicyRisk({ input, intent, domain, tags }) {
  const policy = input.policy && typeof input.policy === "object" ? input.policy : {};
  const explicitRisk = typeof policy.risk === "string" && policy.risk.trim()
    ? policy.risk.trim()
    : typeof input.risk === "string" && input.risk.trim()
      ? input.risk.trim()
      : null;

  if (explicitRisk) {
    return explicitRisk;
  }

  if (DENIED_INTENTS.has(intent) || tags.includes("destructive")) {
    return "critical";
  }

  if (domain === "cross_boundary") {
    return "high";
  }

  if (intent.startsWith("heal.") || intent.startsWith("system.")) {
    return "medium";
  }

  return "low";
}

function evaluatePolicyIntent(input = {}, context = {}) {
  const policy = input.policy && typeof input.policy === "object" ? input.policy : {};
  const tags = [...normalisePolicyTags(input.tags), ...normalisePolicyTags(policy.tags)];
  const intent = inferPolicyIntent(input);
  const domain = inferPolicyDomain({ input, intent, tags });
  const risk = inferPolicyRisk({ input, intent, domain, tags });
  const approved = policy.approved === true || input.approved === true || context.approved === true;
  const requiresApproval = policy.requiresApproval === true || input.requiresApproval === true;
  const auditRequired = domain !== "user_task" || risk !== "low" || policy.audit === true || input.audit === true;
  const bodyAutonomyAllowed = autonomyMode !== "guardian" && domain === "body_internal";
  const crossBoundaryAutonomyAllowed = autonomyMode === "full_autonomy" && domain === "cross_boundary";

  let decision = "allow";
  let reason = "within_user_task_boundary";

  if (DENIED_INTENTS.has(intent) || policy.deny === true || input.deny === true) {
    decision = "deny";
    reason = "absolute_boundary";
  } else if (domain === "cross_boundary" && !approved && !crossBoundaryAutonomyAllowed) {
    decision = "require_approval";
    reason = "cross_boundary_requires_user_approval";
  } else if (requiresApproval && !approved && !bodyAutonomyAllowed && !crossBoundaryAutonomyAllowed) {
    decision = "require_approval";
    reason = "approval_required";
  } else if (auditRequired) {
    decision = "audit_only";
    reason = approved
      ? "approved_and_audited"
      : requiresApproval && bodyAutonomyAllowed
        ? "body_sovereignty_autonomy"
        : requiresApproval && crossBoundaryAutonomyAllowed
          ? "full_autonomy_audit"
          : "body_internal_audit";
  }

  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    at: now,
    engine: "policy-v0",
    stage: context.stage ?? "evaluate",
    subject: {
      taskId: input.taskId ?? context.taskId ?? null,
      type: input.type ?? context.type ?? null,
      goal: input.goal ?? context.goal ?? null,
      targetUrl: input.targetUrl ?? context.targetUrl ?? null,
      intent,
    },
    domain,
    risk,
    decision,
    reason,
    approved,
    autonomyMode,
    autonomous: (requiresApproval && !approved && (bodyAutonomyAllowed || crossBoundaryAutonomyAllowed)) === true,
    auditRequired,
    tags,
  };
}

function recordPolicyDecision(decision) {
  policyAuditLog.push(decision);
  if (policyAuditLog.length > MAX_POLICY_AUDIT_ENTRIES) {
    policyAuditLog.splice(0, policyAuditLog.length - MAX_POLICY_AUDIT_ENTRIES);
  }
  persistState();
  return decision;
}

function isPolicyExecutionAllowed(decision) {
  return decision?.decision === "allow" || decision?.decision === "audit_only";
}

function buildPolicyState() {
  return {
    engine: "policy-v0",
    mode: "local-rule-governance",
    autonomyMode,
    rules: {
      bodyInternalDefault: "allow_with_audit",
      userTaskDefault: "allow",
      crossBoundaryDefault: "require_approval",
      bodyInternalAutonomy: autonomyMode === "guardian" ? "approval_gated" : "autonomous_with_audit",
      crossBoundaryAutonomy: autonomyMode === "full_autonomy" ? "autonomous_with_audit" : "approval_gated",
      deniedIntents: [...DENIED_INTENTS],
      crossBoundaryIntents: [...CROSS_BOUNDARY_INTENTS],
    },
    decisions: policyAuditLog.slice(-20).reverse(),
    counts: policyAuditLog.reduce((counts, decision) => {
      counts.total += 1;
      counts[decision.decision] = (counts[decision.decision] ?? 0) + 1;
      counts[decision.domain] = (counts[decision.domain] ?? 0) + 1;
      return counts;
    }, {
      total: 0,
      allow: 0,
      audit_only: 0,
      require_approval: 0,
      deny: 0,
      body_internal: 0,
      user_task: 0,
      cross_boundary: 0,
    }),
  };
}

function ensureTaskPolicy(task, context = {}) {
  const existing = task.policy?.decision ? task.policy : null;
  if (existing && context.force !== true) {
    return existing;
  }

  const decision = evaluatePolicyIntent({
    taskId: task.id,
    type: task.type,
    goal: task.goal,
    targetUrl: task.targetUrl,
    policy: task.policy?.request ?? task.policy ?? {},
  }, {
    stage: context.stage ?? "task",
    taskId: task.id,
    type: task.type,
    goal: task.goal,
    targetUrl: task.targetUrl,
  });
  task.policy = {
    request: task.policy?.request ?? task.policy ?? {},
    decision,
  };
  recordPolicyDecision(decision);
  if (decision.decision === "require_approval") {
    createApprovalRequestForTask(task, decision);
  } else if (task.approval?.requestId) {
    const approval = approvals.get(task.approval.requestId);
    task.approval = {
      requestId: task.approval.requestId,
      status: approval?.status ?? task.approval.status ?? "resolved",
      required: false,
      updatedAt: approval?.updatedAt ?? new Date().toISOString(),
    };
  }
  return task.policy;
}

function createTask(body, options = {}) {
  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  if (!goal) {
    throw new Error("Task goal is required.");
  }

  const type = typeof body.type === "string" && body.type.trim() ? body.type.trim() : "generic_task";
  const now = new Date().toISOString();
  const task = {
    id: randomUUID(),
    type,
    goal,
    status: "queued",
    targetUrl:
      typeof body.targetUrl === "string" && body.targetUrl.trim()
        ? body.targetUrl.trim()
        : null,
    workViewStrategy:
      typeof body.workViewStrategy === "string" && body.workViewStrategy.trim()
        ? body.workViewStrategy.trim()
        : "ai-work-view",
    plan: shouldBuildPlan(body)
      ? buildRulePlan({
          goal,
          type,
          intent: typeof body.intent === "string" && body.intent.trim() ? body.intent.trim() : null,
          policy: body.policy && typeof body.policy === "object" ? body.policy : null,
          targetUrl:
            typeof body.targetUrl === "string" && body.targetUrl.trim()
              ? body.targetUrl.trim()
              : null,
          actions: body.actions,
        })
      : body.plan && typeof body.plan === "object"
        ? body.plan
        : null,
    policy:
      body.policy && typeof body.policy === "object"
        ? { request: body.policy }
        : {
            request: {
              intent:
                typeof body.intent === "string" && body.intent.trim()
                  ? body.intent.trim()
                  : "task.execute",
            },
          },
    workView: null,
    lastAction: null,
    outcome: null,
    sourceCommand:
      body.sourceCommand && typeof body.sourceCommand === "object"
        ? clonePlainObject(body.sourceCommand)
        : null,
    systemdRepair:
      body.systemdRepair && typeof body.systemdRepair === "object"
        ? clonePlainObject(body.systemdRepair)
        : null,
    systemdNextRepair:
      body.systemdNextRepair && typeof body.systemdNextRepair === "object"
        ? clonePlainObject(body.systemdNextRepair)
        : null,
    recovery:
      body.recovery && typeof body.recovery === "object"
        ? {
            recoveredFromTaskId:
              typeof body.recovery.recoveredFromTaskId === "string" && body.recovery.recoveredFromTaskId.trim()
                ? body.recovery.recoveredFromTaskId.trim()
                : null,
            recoveredFromOutcome:
              typeof body.recovery.recoveredFromOutcome === "string" && body.recovery.recoveredFromOutcome.trim()
                ? body.recovery.recoveredFromOutcome.trim()
                : null,
            attempt:
              Number.isInteger(body.recovery.attempt) && body.recovery.attempt > 0
                ? body.recovery.attempt
                : 1,
            recoveryEvidence:
              body.recovery.recoveryEvidence && typeof body.recovery.recoveryEvidence === "object"
                ? clonePlainObject(body.recovery.recoveryEvidence)
                : null,
          }
        : null,
    recoveredByTaskId: null,
    executionPhase: "queued",
    phaseHistory: [
      {
        phase: "queued",
        at: now,
      },
    ],
    createdAt: now,
    closedAt: null,
    updatedAt: now,
  };

  tasks.set(task.id, task);
  if (options.skipInitialPolicy !== true) {
    ensureTaskPolicy(task, { stage: "task.created" });
  }
  persistState();
  return task;
}

function getTaskById(taskId) {
  return tasks.get(taskId) ?? null;
}

function appendTaskPhase(task, phase, details = null) {
  const now = new Date().toISOString();
  task.executionPhase = phase;
  task.updatedAt = now;
  if (phase === "acting_on_target" && details?.actionKind) {
    task.lastAction = {
      kind: details.actionKind,
      degraded: Boolean(details.degraded),
      at: now,
    };
  }
  task.phaseHistory = [...(task.phaseHistory ?? []), { phase, at: now, details }];
  updatePlanForPhase(task, phase, details);
  persistState();
  return task;
}

async function setTaskPhase(task, phase, { status = task.status, details = null } = {}) {
  task.status = status;
  const updatedTask = appendTaskPhase(task, phase, details);
  reconcileRuntimeState();
  await publishEvent("task.phase_changed", { task: serialiseTask(updatedTask) });
  return updatedTask;
}

function reconcileRuntimeState() {
  const activeTasks = [...tasks.values()]
    .filter((task) => isActiveTask(task))
    .sort(compareTasksForDisplay);
  const currentTask = activeTasks[0] ?? null;

  if (!currentTask) {
    updateRuntimeState({
      status: "idle",
      currentTaskId: null,
      paused: false,
    });
    persistState();
    return null;
  }

  updateRuntimeState({
    status: currentTask.status === "paused" ? "paused" : currentTask.status,
    currentTaskId: currentTask.id,
    paused: currentTask.status === "paused",
  });
  persistState();
  return currentTask;
}

function supersedeOtherActiveTasks(exceptTaskId) {
  const reclaimed = [];

  for (const task of tasks.values()) {
    if (task.id === exceptTaskId || !isActiveTask(task)) {
      continue;
    }

    task.status = "superseded";
    appendTaskPhase(task, "superseded", {
      replacedByTaskId: exceptTaskId,
    });
    task.outcome = {
      kind: "superseded",
      summary: `Superseded by task ${exceptTaskId}`,
      at: task.updatedAt,
    };
    task.closedAt = task.updatedAt;
    reclaimed.push(task);
  }

  if (reclaimed.length > 0) {
    persistState();
  }
  return reclaimed;
}

function attachTaskToWorkView(task, body) {
  const now = new Date().toISOString();
  const activeUrl =
    typeof body.activeUrl === "string" && body.activeUrl.trim()
      ? body.activeUrl.trim()
      : task.targetUrl;

  task.status = "running";
  task.workView = {
    sessionId:
      typeof body.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId.trim()
        : null,
    status:
      typeof body.status === "string" && body.status.trim()
        ? body.status.trim()
        : "ready",
    visibility:
      typeof body.visibility === "string" && body.visibility.trim()
        ? body.visibility.trim()
        : "visible",
    mode:
      typeof body.mode === "string" && body.mode.trim()
        ? body.mode.trim()
        : "foreground-observable",
    helperStatus:
      typeof body.helperStatus === "string" && body.helperStatus.trim()
        ? body.helperStatus.trim()
        : "active",
    displayTarget:
      typeof body.displayTarget === "string" && body.displayTarget.trim()
        ? body.displayTarget.trim()
        : null,
    activeUrl,
    attachedAt: now,
  };
  appendTaskPhase(task, "ready_for_action", {
    sessionId: task.workView.sessionId,
    activeUrl,
  });
  reconcileRuntimeState();

  return task;
}

function completeTask(task, details = null) {
  if (details?.workView && typeof details.workView === "object") {
    task.workView = {
      ...(task.workView ?? {}),
      ...details.workView,
    };
  }
  task.status = "completed";
  appendTaskPhase(task, "completed", details);
  task.outcome = {
    kind: "completed",
    summary: typeof details?.summary === "string" && details.summary.trim()
      ? details.summary.trim()
      : `Completed work view task for ${task.targetUrl ?? "current target"}`,
    details,
    at: task.updatedAt,
  };
  task.closedAt = task.updatedAt;
  reconcileRuntimeState();
  persistState();
  return task;
}

function buildEyeHandRecoveryEvidence(task, reason, details = null) {
  if (!details || typeof details !== "object") {
    return null;
  }

  const verification = details.verification ?? null;
  const actionEvidence = details.actionEvidence ?? verification?.actionEvidence ?? null;
  const workViewSummary = details.workViewSummary ?? verification?.workViewSummary ?? null;

  if (!actionEvidence && !workViewSummary) {
    return null;
  }

  const failedChecks = (verification?.failedChecks ?? []).map((check) => ({
    name: check.name ?? null,
    expected: check.expected ?? null,
    actual: check.actual ?? null,
  }));
  const observedUrl = actionEvidence?.observedAfterActions?.url ?? workViewSummary?.url ?? details.targetUrl ?? task.targetUrl ?? null;

  return {
    kind: "eye-hand-recovery-evidence",
    sourceTaskId: task.id,
    reason,
    failedChecks,
    targetUrl: details.targetUrl ?? task.targetUrl ?? null,
    observedUrl,
    actionEvidence,
    workViewSummary,
    recommendation: {
      strategy: "retry_with_fresh_observation",
      targetUrl: observedUrl,
      rationale: failedChecks.length > 0
        ? `Recover by re-opening the work view and re-verifying failed check(s): ${failedChecks.map((check) => check.name).join(", ")}.`
        : "Recover by re-opening the work view and re-checking the latest observation after the recorded action sequence.",
    },
  };
}

function failTask(task, reason, details = null) {
  const failureDetails = details && typeof details === "object"
    ? {
        ...details,
        recoveryEvidence: details.recoveryEvidence ?? buildEyeHandRecoveryEvidence(task, reason, details),
      }
    : details;
  task.status = "failed";
  appendTaskPhase(task, "failed", { reason, details: failureDetails });
  task.outcome = {
    kind: "failed",
    summary: reason,
    reason,
    details: failureDetails,
    at: task.updatedAt,
  };
  task.closedAt = task.updatedAt;
  reconcileRuntimeState();
  persistState();
  return task;
}

function buildWorkViewAttachPayload(data, targetUrl) {
  const workView = data?.workView ?? {};
  return {
    sessionId: data?.session?.sessionId ?? null,
    status: workView.status ?? "ready",
    visibility: workView.visibility ?? "visible",
    mode: workView.mode ?? "foreground-observable",
    helperStatus: workView.helperStatus ?? "active",
    displayTarget: workView.displayTarget ?? "workspace-2",
    activeUrl: workView.activeUrl ?? data?.browser?.browser?.activeUrl ?? data?.browser?.tab?.url ?? targetUrl,
  };
}

function normaliseExecutorActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return [
      { kind: "keyboard.type", params: { text: "hello from openclaw-task-executor" } },
      { kind: "mouse.click", params: { x: 640, y: 360, button: "left" } },
    ];
  }

  return actions
    .filter((action) => action && typeof action === "object")
    .map((action) => ({
      kind: typeof action.kind === "string" && action.kind.trim() ? action.kind.trim() : "mouse.click",
      params: action.params && typeof action.params === "object" ? action.params : {},
    }));
}

const OPERATOR_INVOKABLE_CAPABILITIES = new Set([
  "sense.system.vitals",
  "sense.filesystem.read",
  "act.filesystem.write_text",
  "act.filesystem.append_text",
  "act.filesystem.mkdir",
  "sense.process.list",
  "act.system.command.dry_run",
  "act.system.command.execute",
  "act.system.heal",
]);

function planCapabilityActionSteps(task) {
  return (task.plan?.steps ?? [])
    .filter((step) => step.phase === "acting_on_target" && OPERATOR_INVOKABLE_CAPABILITIES.has(step.capabilityId));
}

function shouldExecuteCapabilityPlan(task) {
  return task?.type === "system_task" && planCapabilityActionSteps(task).length > 0;
}

function isNativePluginCapabilityTask(task) {
  return task?.type === "native_plugin_capability";
}

function isNativePluginRuntimeActivationTask(task) {
  return task?.type === "native_plugin_runtime_activation"
    && task?.plan?.strategy === "native-plugin-runtime-activation-v0";
}

function isNativePluginRuntimeAdapterTask(task) {
  return task?.type === "native_plugin_runtime_adapter_implementation"
    && task?.plan?.strategy === "native-plugin-runtime-adapter-v0";
}

function isOpenClawSearchWebAdapterTask(task) {
  return task?.type === "openclaw_search_web_adapter_invocation"
    && task?.plan?.strategy === "openclaw-search-web-adapter-v0";
}

function isOpenClawSearchWebRuntimeActivationTask(task) {
  return task?.type === "openclaw_search_web_runtime_activation"
    && task?.plan?.strategy === "openclaw-search-web-runtime-activation-v0";
}

function isOpenClawSearchWebProviderRuntimeSandboxTask(task) {
  return task?.type === "openclaw_search_web_provider_runtime_sandbox"
    && task?.plan?.strategy === "openclaw-search-web-provider-runtime-sandbox-v0";
}

function isSystemdRepairExecutionTask(task) {
  return task?.type === "systemd_repair_execution_task"
    && task?.systemdRepair?.registry === SYSTEMD_REPAIR_EXECUTION_TASK_REGISTRY;
}

function isSystemdNextRepairTask(task) {
  return task?.type === "systemd_next_repair_task"
    && (task?.systemdNextRepair?.registry === SYSTEMD_NEXT_REPAIR_TASK_SHELL_REGISTRY
      || task?.systemdNextRepair?.registry === SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_REGISTRY);
}

function isBodyEvidenceLedgerDirectoryTask(task) {
  return task?.type === "body_evidence_ledger_directory_task";
}

function isBodyEvidenceLedgerFirstRecordTask(task) {
  return task?.type === "body_evidence_ledger_first_record_task"
    && task?.bodyEvidenceLedgerFirstRecord?.registry === "openclaw-body-evidence-ledger-first-record-task-v0";
}

function isBodyEvidenceLedgerFollowupRecordTask(task) {
  return task?.type === "body_evidence_ledger_followup_record_task"
    && task?.bodyEvidenceLedgerFollowupRecord?.registry === "openclaw-body-evidence-ledger-followup-record-task-v0";
}

async function deferSystemdRepairExecutionTask(task) {
  const deferredTask = await setTaskPhase(task, "systemd_repair_execution_deferred", {
    status: "completed",
    details: {
      executor: "systemd-repair-execution-task-v0",
      reason: "operator_reviewed_execution_task_shell_only",
      target: task.systemdRepair?.target ?? null,
      command: task.systemdRepair?.command ?? null,
      hostMutation: false,
      executed: false,
    },
  });
  deferredTask.outcome = {
    kind: "systemd_repair_execution_deferred",
    summary: `Operator-reviewed systemd repair execution task shell for ${task.systemdRepair?.target?.unit ?? "unknown unit"} is ready; no restart executed.`,
    details: {
      systemdRepair: task.systemdRepair ?? null,
      hostMutation: false,
      executed: false,
      futureExecutionRequiresSeparateMilestone: true,
    },
    at: deferredTask.updatedAt,
  };
  deferredTask.closedAt = deferredTask.updatedAt;
  reconcileRuntimeState();
  persistState();
  await publishEvent("systemd.repair.execution_deferred", { task: serialiseTask(deferredTask) });

  return {
    task: deferredTask,
    policy: deferredTask.policy?.decision ?? null,
    approval: deferredTask.approval ?? null,
    blocked: false,
    reason: null,
    execution: {
      mode: "deferred_execution_shell",
      target: deferredTask.systemdRepair?.target ?? null,
      command: deferredTask.systemdRepair?.command ?? null,
      hostMutation: false,
      executed: false,
    },
  };
}

function buildSystemdRepairCommandTranscript(task, result) {
  const repair = task.systemdRepair ?? task.systemdNextRepair ?? {};
  const command = repair.command ?? {};
  const args = Array.isArray(command.args) ? command.args : [];
  const actualArgs = Array.isArray(result.args) ? result.args : [];
  return {
    stepId: task.systemdNextRepair ? "execute-next-systemd-restart" : "execute-systemd-restart",
    actionKind: task.systemdNextRepair ? "systemd.next_repair.execute" : "systemd.repair.execute",
    capabilityId: "act.system.heal",
    invocationId: result.invocationId,
    command: [command.command ?? "systemctl", ...args].join(" "),
    actualCommand: [result.command ?? command.command ?? "systemctl", ...actualArgs].join(" "),
    authDelegation: result.authDelegation ?? null,
    skipped: false,
    skipReason: null,
    condition: null,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function runSystemdRepairCommand(task) {
  const repair = task.systemdRepair ?? task.systemdNextRepair ?? {};
  const command = repair.command ?? {};
  const requestedArgs = Array.isArray(command.args) ? command.args : ["restart", repair.target?.unit ?? SYSTEMD_REPAIR_REAL_EXECUTION_UNIT];
  const useRestartHelper =
    SYSTEMD_REPAIR_RESTART_HELPER
    && repair.target?.unit === SYSTEMD_REPAIR_REAL_EXECUTION_UNIT
    && command.command === "systemctl"
    && requestedArgs[0] === "restart"
    && requestedArgs[1] === SYSTEMD_REPAIR_REAL_EXECUTION_UNIT;
  const executable = useRestartHelper ? SYSTEMD_REPAIR_RESTART_HELPER_SUDO : command.command ?? "systemctl";
  const args = useRestartHelper ? ["-n", SYSTEMD_REPAIR_RESTART_HELPER] : requestedArgs;
  const authDelegation = useRestartHelper
    ? {
        mode: SYSTEMD_REPAIR_AUTH_DELEGATION ?? "external-fixed-helper",
        helper: SYSTEMD_REPAIR_RESTART_HELPER,
        sudo: SYSTEMD_REPAIR_RESTART_HELPER_SUDO,
        passwordPromptAllowed: false,
        scope: "restart openclaw-browser-runtime.service only",
      }
    : {
        mode: "direct-systemctl",
        helper: null,
        sudo: null,
        passwordPromptAllowed: true,
        scope: "host policy decides whether authentication is required",
      };
  const startedAt = new Date().toISOString();

  try {
    const result = await execFileAsync(executable, args, {
      timeout: SYSTEMD_REPAIR_EXECUTION_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 16384,
    });
    return {
      invocationId: randomUUID(),
      command: executable,
      args,
      requestedCommand: command.command ?? "systemctl",
      requestedArgs,
      authDelegation,
      startedAt,
      completedAt: new Date().toISOString(),
      exitCode: 0,
      timedOut: false,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      ok: true,
    };
  } catch (error) {
    const exitCode = Number.isInteger(error?.code) ? error.code : 1;
    return {
      invocationId: randomUUID(),
      command: executable,
      args,
      requestedCommand: command.command ?? "systemctl",
      requestedArgs,
      authDelegation,
      startedAt,
      completedAt: new Date().toISOString(),
      exitCode,
      timedOut: error?.killed === true || error?.signal === "SIGTERM",
      stdout: typeof error?.stdout === "string" ? error.stdout : "",
      stderr: typeof error?.stderr === "string" && error.stderr.trim()
        ? error.stderr
        : error instanceof Error
          ? error.message
          : "systemctl restart failed.",
      ok: false,
    };
  }
}

async function executeBodyEvidenceLedgerDirectoryTask(task) {
  const directory = task.bodyEvidenceLedgerDirectory ?? {};
  const displayPath = typeof directory.displayPath === "string" && directory.displayPath.trim()
    ? directory.displayPath.trim()
    : ".artifacts/openclaw-body-evidence-ledger";
  const executionPath = path.isAbsolute(displayPath)
    ? displayPath
    : path.resolve(process.cwd(), "../..", displayPath);

  await setTaskPhase(task, "body_evidence_ledger_directory_create", {
    status: "running",
    details: {
      executor: "body-evidence-ledger-directory-task-v0",
      target: displayPath,
      executionPath,
      hostMutation: true,
      recordWritesEnabled: false,
    },
  });

  const result = await postJson(`${systemSenseUrl}/system/files/mkdir`, {
    path: executionPath,
    recursive: true,
    intent: "body.evidence.ledger.directory.create",
  });
  task.bodyEvidenceLedgerDirectory = {
    ...directory,
    resolvedPath: result.path ?? null,
    allowedRoot: result.root ?? null,
    directoryCreated: result.created === true,
    directoryExists: true,
    durableStorageWritten: false,
    recordWritesEnabled: false,
    mkdirResult: {
      registry: "openclaw-body-evidence-ledger-directory-execution-v0",
      mode: result.mode ?? "mkdir",
      created: result.created === true,
      recursive: result.recursive === true,
      metadata: result.metadata ?? null,
    },
  };
  const completedTask = completeTask(task, {
    executor: "body-evidence-ledger-directory-task-v0",
    summary: `Created OpenClaw body evidence ledger directory at ${displayPath}; no ledger records written.`,
    target: displayPath,
    result,
    hostMutation: true,
    directoryCreated: result.created === true,
    directoryExists: true,
    durableStorageWritten: false,
    recordWritesEnabled: false,
  });
  await publishEvent("body_evidence_ledger.directory_created", {
    task: serialiseTask(completedTask),
    target: displayPath,
    path: result.path ?? null,
    created: result.created === true,
  });

  return {
    task: completedTask,
    policy: completedTask.policy?.decision ?? null,
    approval: completedTask.approval ?? null,
    actions: [],
    verification: null,
    execution: {
      registry: "openclaw-body-evidence-ledger-directory-execution-v0",
      mode: "approved_directory_creation",
      target: displayPath,
      path: result.path ?? null,
      hostMutation: true,
      directoryCreated: result.created === true,
      directoryExists: true,
      durableStorageWritten: false,
      recordWritesEnabled: false,
    },
  };
}

async function executeBodyEvidenceLedgerFirstRecordTask(task) {
  const firstRecord = task.bodyEvidenceLedgerFirstRecord ?? {};
  const recordType = typeof firstRecord.plannedRecordType === "string" && firstRecord.plannedRecordType.trim()
    ? firstRecord.plannedRecordType.trim()
    : "body_evidence_ledger_bootstrap";
  const ledgerFileDisplayPath = ".artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl";
  const ledgerFilePath = path.resolve(process.cwd(), "../..", ledgerFileDisplayPath);
  const timelineReadiness = await fetchJson(`${systemSenseUrl}/system/route/body-evidence-timeline-readiness`);
  const recordedAt = new Date().toISOString();
  const recordBase = {
    id: `body-ledger-${randomUUID()}`,
    recordedAt,
    sourceRegistry: firstRecord.sourceRegistry ?? "openclaw-body-evidence-timeline-readiness-v0",
    sourceEndpoint: "/system/route/body-evidence-timeline-readiness",
    phase: "phase_2_body_evidence_memory",
    evidenceType: recordType,
    summary: "Bootstrap durable OpenClaw body evidence memory from timeline readiness evidence.",
    evidence: {
      timelineReadinessRegistry: timelineReadiness.registry ?? null,
      timelineReady: timelineReadiness.summary?.ready === true || timelineReadiness.ready === true,
      bodyMemoryPurpose: timelineReadiness.memoryPurpose ?? timelineReadiness.purpose ?? "operator-visible body evidence memory",
      sourceChecks: timelineReadiness.summary?.checks ?? timelineReadiness.checks ?? null,
    },
    governance: {
      taskId: task.id,
      approvalId: task.approval?.requestId ?? null,
      approved: isTaskPolicyApproved(task),
      appendOnly: true,
      scheduler: false,
      backgroundWriter: false,
      bulkImport: false,
      hostMutation: true,
      scope: ledgerFileDisplayPath,
    },
  };
  const contentHash = createHash("sha256").update(JSON.stringify(recordBase)).digest("hex");
  const record = {
    ...recordBase,
    contentHash,
  };
  const line = `${JSON.stringify(record)}\n`;

  await setTaskPhase(task, "body_evidence_ledger_first_record_append", {
    status: "running",
    details: {
      executor: "body-evidence-ledger-first-record-task-v0",
      ledgerFile: ledgerFileDisplayPath,
      recordType,
      hostMutation: true,
      durableStorageWritten: false,
    },
  });

  const result = await postJson(`${systemSenseUrl}/system/files/append-text`, {
    path: ledgerFilePath,
    content: line,
    encoding: "utf8",
    createIfMissing: true,
    intent: "body.evidence.ledger.record.append",
  });
  task.bodyEvidenceLedgerFirstRecord = {
    ...firstRecord,
    ledgerFileDisplayPath,
    ledgerFilePath: result.path ?? ledgerFilePath,
    allowedRoot: result.root ?? null,
    recordId: record.id,
    contentHash,
    contentBytes: result.contentBytes ?? Buffer.byteLength(line, "utf8"),
    previousBytes: result.previousBytes ?? 0,
    totalBytes: result.totalBytes ?? null,
    recordAppended: true,
    durableStorageWritten: true,
    appendExecutionEnabled: true,
    appendResult: {
      registry: "openclaw-body-evidence-ledger-first-record-append-v0",
      mode: result.mode ?? "append_text",
      created: result.created === true,
      createIfMissing: result.createIfMissing === true,
      metadata: result.metadata ?? null,
    },
  };
  const completedTask = completeTask(task, {
    executor: "body-evidence-ledger-first-record-task-v0",
    summary: `Appended first OpenClaw body evidence ledger record ${record.id} to ${ledgerFileDisplayPath}.`,
    ledgerFile: ledgerFileDisplayPath,
    result,
    record,
    hostMutation: true,
    recordAppended: true,
    durableStorageWritten: true,
    scheduler: false,
    backgroundWriter: false,
    bulkImport: false,
  });
  await publishEvent("body_evidence_ledger.first_record_appended", {
    task: serialiseTask(completedTask),
    ledgerFile: ledgerFileDisplayPath,
    recordId: record.id,
    contentHash,
  });

  return {
    task: completedTask,
    policy: completedTask.policy?.decision ?? null,
    approval: completedTask.approval ?? null,
    actions: [],
    verification: null,
    execution: {
      registry: "openclaw-body-evidence-ledger-first-record-append-v0",
      mode: "approved_first_record_append",
      ledgerFile: ledgerFileDisplayPath,
      path: result.path ?? null,
      recordId: record.id,
      contentHash,
      hostMutation: true,
      recordAppended: true,
      durableStorageWritten: true,
      scheduler: false,
      backgroundWriter: false,
      bulkImport: false,
    },
  };
}

async function deferBodyEvidenceLedgerFollowupRecordTask(task) {
  const followupRecord = task.bodyEvidenceLedgerFollowupRecord ?? {};
  const recordType = typeof followupRecord.plannedRecordType === "string" && followupRecord.plannedRecordType.trim()
    ? followupRecord.plannedRecordType.trim()
    : "body_evidence_timeline_followup";
  const plannedSequence = Number.isInteger(followupRecord.plannedSequence) ? followupRecord.plannedSequence : 2;
  const deferredTask = await setTaskPhase(task, "body_evidence_ledger_followup_record_deferred", {
    status: "completed",
    details: {
      executor: "body-evidence-ledger-followup-record-task-v0",
      reason: "followup_record_task_shell_only",
      recordType,
      plannedSequence,
      hostMutation: false,
      recordAppended: false,
      durableStorageWritten: false,
      scheduler: false,
      backgroundWriter: false,
    },
  });
  deferredTask.bodyEvidenceLedgerFollowupRecord = {
    ...followupRecord,
    recordAppended: false,
    durableStorageWritten: false,
    appendExecutionEnabled: false,
    deferredExecution: {
      registry: "openclaw-body-evidence-ledger-followup-record-task-v0",
      mode: "deferred_followup_record_append_shell",
      recordType,
      plannedSequence,
      hostMutation: false,
      recordAppended: false,
      durableStorageWritten: false,
      scheduler: false,
      backgroundWriter: false,
      futureAppendRequiresSeparateMilestone: true,
    },
  };
  deferredTask.outcome = {
    kind: "body_evidence_ledger_followup_record_deferred",
    summary: `Follow-up ledger record ${plannedSequence} task shell is ready; no JSONL append executed.`,
    details: {
      bodyEvidenceLedgerFollowupRecord: deferredTask.bodyEvidenceLedgerFollowupRecord,
      hostMutation: false,
      recordAppended: false,
      durableStorageWritten: false,
      futureAppendRequiresSeparateMilestone: true,
    },
  };
  persistState();
  await publishEvent("body_evidence_ledger.followup_record_deferred", {
    task: serialiseTask(deferredTask),
    recordType,
    plannedSequence,
  });

  return {
    task: deferredTask,
    policy: deferredTask.policy?.decision ?? null,
    approval: deferredTask.approval ?? null,
    actions: [],
    verification: null,
    execution: {
      registry: "openclaw-body-evidence-ledger-followup-record-task-v0",
      mode: "deferred_followup_record_append_shell",
      recordType,
      plannedSequence,
      hostMutation: false,
      recordAppended: false,
      durableStorageWritten: false,
      scheduler: false,
      backgroundWriter: false,
      futureAppendRequiresSeparateMilestone: true,
    },
  };
}

function findSystemdVerificationUnit(inventory, targetUnit) {
  return (inventory?.units ?? []).find((unit) => unit.unit === targetUnit) ?? null;
}

async function captureSystemdRepairVerificationSnapshot(targetUnit, stage) {
  const checkedAt = new Date().toISOString();
  const snapshot = {
    stage,
    checkedAt,
    targetUnit,
    unitInventory: null,
    targetUnitState: null,
    systemHealth: null,
    targetServiceHealth: null,
    errors: [],
  };

  try {
    const inventory = await fetchJson(`${systemSenseUrl}/system/systemd/units`);
    const unit = findSystemdVerificationUnit(inventory, targetUnit);
    snapshot.unitInventory = {
      registry: inventory.registry ?? null,
      observedAt: inventory.observedAt ?? null,
      systemdAvailable: inventory.source?.systemdAvailable ?? null,
      summary: inventory.summary ?? null,
    };
    snapshot.targetUnitState = unit
      ? {
          unit: unit.unit,
          activeState: unit.activeState ?? null,
          subState: unit.subState ?? null,
          loadState: unit.loadState ?? null,
          unitFileState: unit.unitFileState ?? null,
          systemdObserved: unit.systemdObserved === true,
          observation: unit.observation ?? null,
        }
      : null;
    if (!unit) {
      snapshot.errors.push("target_unit_not_found_in_inventory");
    }
  } catch (error) {
    snapshot.errors.push(`unit_inventory_unavailable:${error instanceof Error ? error.message : "unknown"}`);
  }

  try {
    const health = await fetchJson(`${systemSenseUrl}/system/health`);
    const browserRuntime = health.system?.services?.browserRuntime ?? null;
    snapshot.systemHealth = {
      timestamp: health.system?.timestamp ?? null,
      alertCount: Array.isArray(health.system?.alerts) ? health.system.alerts.length : 0,
      online: health.system?.network?.online ?? null,
      checkedTargets: health.system?.network?.checkedTargets ?? null,
    };
    snapshot.targetServiceHealth = browserRuntime
      ? {
          name: browserRuntime.name ?? "browserRuntime",
          ok: browserRuntime.ok === true,
          status: browserRuntime.status ?? null,
          url: browserRuntime.url ?? null,
          latencyMs: browserRuntime.latencyMs ?? null,
          checkedAt: browserRuntime.checkedAt ?? null,
        }
      : null;
    if (!browserRuntime) {
      snapshot.errors.push("browser_runtime_health_not_found");
    }
  } catch (error) {
    snapshot.errors.push(`system_health_unavailable:${error instanceof Error ? error.message : "unknown"}`);
  }

  return snapshot;
}

function buildSystemdRepairPostExecutionVerification(targetUnit, before, after, result) {
  return {
    registry: "openclaw-systemd-repair-post-verification-v0",
    mode: "single_observation_no_recovery",
    targetUnit,
    checkedAt: new Date().toISOString(),
    commandExitCode: result.exitCode,
    commandSucceeded: result.ok === true,
    before,
    after,
    summary: {
      unitObservedBefore: before.targetUnitState?.systemdObserved === true,
      unitObservedAfter: after.targetUnitState?.systemdObserved === true,
      beforeActiveState: before.targetUnitState?.activeState ?? null,
      afterActiveState: after.targetUnitState?.activeState ?? null,
      beforeServiceOk: before.targetServiceHealth?.ok ?? null,
      afterServiceOk: after.targetServiceHealth?.ok ?? null,
      errorCount: before.errors.length + after.errors.length,
      noAutomaticRecovery: true,
    },
    governance: {
      recordsEvidenceOnly: true,
      triggersRecovery: false,
      retriesExecution: false,
      schedulesFollowUp: false,
    },
  };
}

async function executeSystemdRepairExecutionTask(task) {
  const targetUnit = task.systemdRepair?.target?.unit ?? null;
  if (targetUnit !== SYSTEMD_REPAIR_REAL_EXECUTION_UNIT) {
    throw new Error(`Real systemd repair execution is limited to ${SYSTEMD_REPAIR_REAL_EXECUTION_UNIT}.`);
  }

  const command = task.systemdRepair?.command ?? {};
  const args = Array.isArray(command.args) ? command.args : [];
  if (command.command !== "systemctl" || args[0] !== "restart" || args[1] !== SYSTEMD_REPAIR_REAL_EXECUTION_UNIT) {
    throw new Error(`Unexpected systemd repair command: ${JSON.stringify(command)}`);
  }

  const beforeVerification = await captureSystemdRepairVerificationSnapshot(targetUnit, "before_real_execution");
  const runningTask = await setTaskPhase(task, "systemd_repair_execution_running", {
    status: "running",
    details: {
      executor: "systemd-repair-execution-task-v0",
      target: task.systemdRepair?.target ?? null,
      command,
      hostMutationAttempted: true,
      executed: true,
    },
  });
  const result = await runSystemdRepairCommand(runningTask);
  const commandTranscript = [buildSystemdRepairCommandTranscript(runningTask, result)];
  const afterVerification = await captureSystemdRepairVerificationSnapshot(targetUnit, "after_real_execution");
  const postExecutionVerification = buildSystemdRepairPostExecutionVerification(
    targetUnit,
    beforeVerification,
    afterVerification,
    result,
  );
  const rollbackNote =
    runningTask.systemdRepair?.evidence?.plan?.proposal?.rollbackNote
    ?? runningTask.systemdRepair?.evidence?.dryRunEnvelope?.plan?.proposal?.rollbackNote
    ?? null;
  const status = result.ok ? "completed" : "failed";
  const phase = result.ok ? "systemd_repair_execution_completed" : "systemd_repair_execution_failed";
  const updatedTask = await setTaskPhase(runningTask, phase, {
    status,
    details: {
      executor: "systemd-repair-execution-task-v0",
      target: runningTask.systemdRepair?.target ?? null,
      command,
      hostMutation: true,
      hostMutationAttempted: true,
      executed: true,
      commandTranscript,
      result,
      postExecutionVerification,
    },
  });
  updatedTask.systemdRepair = {
    ...(updatedTask.systemdRepair ?? {}),
    execution: {
      ...(updatedTask.systemdRepair?.execution ?? {}),
      shellOnly: false,
      realExecutionEnabled: true,
      hostMutation: true,
      hostMutationAttempted: true,
      executed: true,
      executionSucceeded: result.ok,
      exitCode: result.exitCode,
      completedAt: result.completedAt,
      authDelegation: result.authDelegation ?? null,
    },
  };
  updatedTask.outcome = {
    kind: result.ok ? "systemd_repair_execution_completed" : "systemd_repair_execution_failed",
    summary: result.ok
      ? `Operator-approved systemd restart completed for ${targetUnit}.`
      : `Operator-approved systemd restart attempted for ${targetUnit} and exited with code ${result.exitCode}.`,
    reason: result.ok ? null : "systemd_restart_nonzero_exit",
    details: {
      systemdRepair: updatedTask.systemdRepair,
      target: updatedTask.systemdRepair?.target ?? null,
      command,
      hostMutation: true,
      hostMutationAttempted: true,
      executed: true,
      executionSucceeded: result.ok,
      authDelegation: result.authDelegation ?? null,
      commandTranscript,
      result,
      postExecutionVerification,
      rollbackNote,
    },
    at: updatedTask.updatedAt,
  };
  updatedTask.closedAt = updatedTask.updatedAt;
  reconcileRuntimeState();
  persistState();
  await publishEvent(result.ok ? "systemd.repair.execution_completed" : "systemd.repair.execution_failed", {
    task: serialiseTask(updatedTask),
    result,
  });

  return {
    task: updatedTask,
    policy: updatedTask.policy?.decision ?? null,
    approval: updatedTask.approval ?? null,
    blocked: false,
    reason: null,
    commandTranscript,
    verification: { ok: result.ok, checks: [], failedChecks: result.ok ? [] : [{ name: "systemctl_restart_exit_code", expected: 0, actual: result.exitCode }] },
    execution: {
      mode: "operator_reviewed_real_systemd_restart",
      target: updatedTask.systemdRepair?.target ?? null,
      command,
      hostMutation: true,
      hostMutationAttempted: true,
      executed: true,
      executionSucceeded: result.ok,
      exitCode: result.exitCode,
      authDelegation: result.authDelegation ?? null,
      postExecutionVerification,
      rollbackNote: updatedTask.outcome.details.rollbackNote,
    },
  };
}

async function deferSystemdNextRepairTask(task) {
  const deferredTask = await setTaskPhase(task, "systemd_next_repair_execution_deferred", {
    status: "completed",
    details: {
      executor: "systemd-next-repair-task-shell-v0",
      reason: "next_repair_task_shell_only",
      target: task.systemdNextRepair?.target ?? null,
      command: task.systemdNextRepair?.command ?? null,
      hostMutation: false,
      executed: false,
    },
  });
  deferredTask.outcome = {
    kind: "systemd_next_repair_execution_deferred",
    summary: `Next OpenClaw systemd repair task shell for ${task.systemdNextRepair?.target?.unit ?? "unknown unit"} is ready; no restart executed.`,
    details: {
      systemdNextRepair: task.systemdNextRepair ?? null,
      hostMutation: false,
      executed: false,
      futureExecutionRequiresSeparateMilestone: true,
    },
    at: deferredTask.updatedAt,
  };
  deferredTask.closedAt = deferredTask.updatedAt;
  reconcileRuntimeState();
  persistState();
  await publishEvent("systemd.next_repair.execution_deferred", { task: serialiseTask(deferredTask) });

  return {
    task: deferredTask,
    policy: deferredTask.policy?.decision ?? null,
    approval: deferredTask.approval ?? null,
    blocked: false,
    reason: null,
    execution: {
      mode: "next_repair_deferred_execution_shell",
      target: deferredTask.systemdNextRepair?.target ?? null,
      command: deferredTask.systemdNextRepair?.command ?? null,
      hostMutation: false,
      executed: false,
    },
  };
}

async function executeSystemdNextRepairTask(task) {
  const targetUnit = task.systemdNextRepair?.target?.unit ?? null;
  if (targetUnit !== SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT) {
    throw new Error(`Next real systemd repair execution is limited to ${SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT}.`);
  }

  const command = task.systemdNextRepair?.command ?? {};
  const args = Array.isArray(command.args) ? command.args : [];
  if (command.command !== "systemctl" || args[0] !== "restart" || args[1] !== SYSTEMD_NEXT_REPAIR_REAL_EXECUTION_UNIT) {
    throw new Error(`Unexpected next systemd repair command: ${JSON.stringify(command)}`);
  }

  const beforeVerification = await captureSystemdRepairVerificationSnapshot(targetUnit, "before_next_real_execution");
  const runningTask = await setTaskPhase(task, "systemd_next_repair_execution_running", {
    status: "running",
    details: {
      executor: "systemd-next-repair-real-execution-v0",
      target: task.systemdNextRepair?.target ?? null,
      command,
      hostMutationAttempted: true,
      executed: true,
    },
  });
  const result = await runSystemdRepairCommand(runningTask);
  const commandTranscript = [buildSystemdRepairCommandTranscript(runningTask, result)];
  const afterVerification = await captureSystemdRepairVerificationSnapshot(targetUnit, "after_next_real_execution");
  const postExecutionVerification = buildSystemdRepairPostExecutionVerification(
    targetUnit,
    beforeVerification,
    afterVerification,
    result,
  );
  const rollbackNote = "If this restart degrades body health, inspect systemd status and verify health before attempting any further repair.";
  const status = result.ok ? "completed" : "failed";
  const phase = result.ok ? "systemd_next_repair_execution_completed" : "systemd_next_repair_execution_failed";
  const updatedTask = await setTaskPhase(runningTask, phase, {
    status,
    details: {
      executor: "systemd-next-repair-real-execution-v0",
      target: runningTask.systemdNextRepair?.target ?? null,
      command,
      hostMutation: true,
      hostMutationAttempted: true,
      executed: true,
      commandTranscript,
      result,
      postExecutionVerification,
    },
  });
  updatedTask.systemdNextRepair = {
    ...(updatedTask.systemdNextRepair ?? {}),
    execution: {
      ...(updatedTask.systemdNextRepair?.execution ?? {}),
      shellOnly: false,
      realExecutionEnabled: true,
      hostMutation: true,
      hostMutationAttempted: true,
      executed: true,
      executionSucceeded: result.ok,
      exitCode: result.exitCode,
      completedAt: result.completedAt,
      authDelegation: result.authDelegation ?? null,
    },
  };
  updatedTask.outcome = {
    kind: result.ok ? "systemd_next_repair_execution_completed" : "systemd_next_repair_execution_failed",
    summary: result.ok
      ? `Operator-approved next systemd restart completed for ${targetUnit}.`
      : `Operator-approved next systemd restart attempted for ${targetUnit} and exited with code ${result.exitCode}.`,
    reason: result.ok ? null : "systemd_next_restart_nonzero_exit",
    details: {
      systemdNextRepair: updatedTask.systemdNextRepair,
      target: updatedTask.systemdNextRepair?.target ?? null,
      command,
      hostMutation: true,
      hostMutationAttempted: true,
      executed: true,
      executionSucceeded: result.ok,
      authDelegation: result.authDelegation ?? null,
      commandTranscript,
      result,
      postExecutionVerification,
      rollbackNote,
    },
    at: updatedTask.updatedAt,
  };
  updatedTask.closedAt = updatedTask.updatedAt;
  reconcileRuntimeState();
  persistState();
  await publishEvent(result.ok ? "systemd.next_repair.execution_completed" : "systemd.next_repair.execution_failed", {
    task: serialiseTask(updatedTask),
    result,
  });

  return {
    task: updatedTask,
    policy: updatedTask.policy?.decision ?? null,
    approval: updatedTask.approval ?? null,
    blocked: false,
    reason: null,
    commandTranscript,
    verification: { ok: result.ok, checks: [], failedChecks: result.ok ? [] : [{ name: "systemctl_next_restart_exit_code", expected: 0, actual: result.exitCode }] },
    execution: {
      mode: "operator_reviewed_next_real_systemd_restart",
      target: updatedTask.systemdNextRepair?.target ?? null,
      command,
      hostMutation: true,
      hostMutationAttempted: true,
      executed: true,
      executionSucceeded: result.ok,
      exitCode: result.exitCode,
      authDelegation: result.authDelegation ?? null,
      postExecutionVerification,
      rollbackNote: updatedTask.outcome.details.rollbackNote,
    },
  };
}

async function deferNativePluginCapabilityExecution(task) {
  if (!isActiveTask(task)) {
    throw new Error("Task is not active and cannot be deferred.");
  }

  const policy = ensureTaskPolicy(task, { stage: "native_plugin.invoke.deferred" });
  await publishEvent("policy.evaluated", { task: serialiseTask(task), policy: policy.decision });
  const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  const capabilityStep = (task.plan?.steps ?? []).find((step) => step.kind === "plugin.capability.invoke") ?? null;
  const reason = "runtime_adapter_deferred";
  const deferredTask = await setTaskPhase(task, reason, {
    status: "queued",
    details: {
      executor: "native-plugin-adapter-v0",
      reason,
      capabilityId: capabilityStep?.capabilityId ?? "act.plugin.capability.invoke",
      pluginId: capabilityStep?.params?.pluginId ?? null,
      packageName: capabilityStep?.params?.packageName ?? null,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  });

  await publishEvent("task.blocked", {
    task: serialiseTask(deferredTask),
    reason,
    executor: "native-plugin-adapter-v0",
  });

  return {
    task: deferredTask,
    blocked: true,
    reason,
    actions: [],
    capabilityInvocations: [],
    commandTranscript: [],
    verification: null,
    policy: policy.decision,
    approval: approval ? serialiseApproval(approval) : null,
    governance: {
      mode: "native_plugin_runtime_adapter_deferred",
      runtimeOwner: "openclaw_on_nixos",
      canExecutePluginCode: false,
      canActivateRuntime: false,
      executed: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

async function deferNativePluginRuntimeActivation(task) {
  if (!isActiveTask(task)) {
    throw new Error("Task is not active and cannot be deferred.");
  }

  const policy = ensureTaskPolicy(task, { stage: "native_plugin.runtime_activation.deferred" });
  await publishEvent("policy.evaluated", { task: serialiseTask(task), policy: policy.decision });
  const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  const activationStep = (task.plan?.steps ?? []).find((step) => step.kind === "plugin.runtime_activation") ?? null;
  const reason = "native_plugin_runtime_activation_deferred";
  const deferredTask = await setTaskPhase(task, "runtime_activation_deferred", {
    status: "queued",
    details: {
      executor: "native-plugin-runtime-activation-v0",
      reason,
      pluginId: activationStep?.params?.pluginId ?? null,
      packageName: activationStep?.params?.packageName ?? null,
      capabilityId: activationStep?.params?.capabilityId ?? "act.plugin.capability.invoke",
      blockedGateIds: activationStep?.params?.blockedGateIds ?? [],
      canReadSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  });

  await publishEvent("task.blocked", {
    task: serialiseTask(deferredTask),
    reason,
    executor: "native-plugin-runtime-activation-v0",
  });

  return {
    task: deferredTask,
    blocked: true,
    reason,
    actions: [],
    capabilityInvocations: [],
    commandTranscript: [],
    verification: null,
    policy: policy.decision,
    approval: approval ? serialiseApproval(approval) : null,
    governance: {
      mode: "native_plugin_runtime_activation_deferred",
      runtimeOwner: "openclaw_on_nixos",
      canReadSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      executed: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

async function deferNativePluginRuntimeAdapterImplementation(task) {
  if (!isActiveTask(task)) {
    throw new Error("Task is not active and cannot be deferred.");
  }

  const policy = ensureTaskPolicy(task, { stage: "native_plugin.runtime_adapter.deferred" });
  await publishEvent("policy.evaluated", { task: serialiseTask(task), policy: policy.decision });
  const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  const adapterStep = (task.plan?.steps ?? []).find((step) => step.kind === "plugin.runtime_adapter_implementation") ?? null;
  const reason = "native_plugin_runtime_adapter_implementation_deferred";
  const deferredTask = await setTaskPhase(task, "runtime_adapter_implementation_deferred", {
    status: "queued",
    details: {
      executor: "native-plugin-runtime-adapter-v0",
      reason,
      contractId: adapterStep?.params?.contractId ?? null,
      contractVersion: adapterStep?.params?.contractVersion ?? null,
      pluginId: adapterStep?.params?.pluginId ?? null,
      packageName: adapterStep?.params?.packageName ?? null,
      capabilityId: adapterStep?.params?.capabilityId ?? "act.plugin.capability.invoke",
      blockedCheckIds: adapterStep?.params?.blockedCheckIds ?? [],
      canReadSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  });

  await publishEvent("task.blocked", {
    task: serialiseTask(deferredTask),
    reason,
    executor: "native-plugin-runtime-adapter-v0",
  });

  return {
    task: deferredTask,
    blocked: true,
    reason,
    actions: [],
    capabilityInvocations: [],
    commandTranscript: [],
    verification: null,
    policy: policy.decision,
    approval: approval ? serialiseApproval(approval) : null,
    governance: {
      mode: "native_plugin_runtime_adapter_implementation_deferred",
      runtimeOwner: "openclaw_on_nixos",
      canReadSourceFileContent: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      executed: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

async function deferOpenClawSearchWebAdapterExecution(task) {
  if (!isActiveTask(task)) {
    throw new Error("Task is not active and cannot be deferred.");
  }

  const policy = ensureTaskPolicy(task, { stage: "openclaw.search_web.invoke.deferred" });
  await publishEvent("policy.evaluated", { task: serialiseTask(task), policy: policy.decision });
  const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  const providerStep = (task.plan?.steps ?? []).find((step) => step.kind === "plugin.search_web.invoke") ?? null;
  const reason = "search_web_runtime_preflight_deferred";
  const deferredTask = await setTaskPhase(task, "network_provider_deferred", {
    status: "queued",
    details: {
      executor: "openclaw-search-web-adapter-v0",
      reason,
      providerContractId: providerStep?.params?.providerContractId ?? null,
      operation: providerStep?.params?.operation ?? null,
      queryLength: providerStep?.params?.queryLength ?? null,
      queryDigest: providerStep?.params?.queryDigest ?? null,
      queryContentExposed: false,
      canUseNetwork: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresRuntimePreflightBeforeExecution: true,
    },
  });

  await publishEvent("task.blocked", {
    task: serialiseTask(deferredTask),
    reason,
    executor: "openclaw-search-web-adapter-v0",
  });

  return {
    task: deferredTask,
    blocked: true,
    reason,
    actions: [],
    capabilityInvocations: [],
    commandTranscript: [],
    verification: null,
    policy: policy.decision,
    approval: approval ? serialiseApproval(approval) : null,
    governance: {
      mode: "openclaw_search_web_runtime_preflight_deferred",
      runtimeOwner: "openclaw_on_nixos",
      canUseNetwork: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      executed: false,
      requiresRuntimePreflightBeforeExecution: true,
    },
  };
}

async function deferOpenClawSearchWebRuntimeActivation(task) {
  if (!isActiveTask(task)) {
    throw new Error("Task is not active and cannot be deferred.");
  }

  const policy = ensureTaskPolicy(task, { stage: "openclaw.search_web.runtime_activation.deferred" });
  await publishEvent("policy.evaluated", { task: serialiseTask(task), policy: policy.decision });
  const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  const activationStep = (task.plan?.steps ?? []).find((step) => step.kind === "plugin.search_web.runtime_activation") ?? null;
  const reason = "search_web_network_runtime_adapter_deferred";
  const deferredTask = await setTaskPhase(task, "network_runtime_deferred", {
    status: "queued",
    details: {
      executor: "openclaw-search-web-runtime-activation-v0",
      reason,
      providerContractId: activationStep?.params?.providerContractId ?? null,
      operation: activationStep?.params?.operation ?? null,
      blockedGateIds: activationStep?.params?.blockedGateIds ?? [],
      queryContentExposed: false,
      canUseNetwork: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  });

  await publishEvent("task.blocked", {
    task: serialiseTask(deferredTask),
    reason,
    executor: "openclaw-search-web-runtime-activation-v0",
  });

  return {
    task: deferredTask,
    blocked: true,
    reason,
    actions: [],
    capabilityInvocations: [],
    commandTranscript: [],
    verification: null,
    policy: policy.decision,
    approval: approval ? serialiseApproval(approval) : null,
    governance: {
      mode: "openclaw_search_web_network_runtime_adapter_deferred",
      runtimeOwner: "openclaw_on_nixos",
      canUseNetwork: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      executed: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

async function deferOpenClawSearchWebProviderRuntimeSandbox(task) {
  if (!isActiveTask(task)) {
    throw new Error("Task is not active and cannot be deferred.");
  }

  const policy = ensureTaskPolicy(task, { stage: "openclaw.search_web.provider_runtime_sandbox.deferred" });
  await publishEvent("policy.evaluated", { task: serialiseTask(task), policy: policy.decision });
  const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  const sandboxStep = (task.plan?.steps ?? []).find((step) => step.kind === "plugin.search_web.provider_runtime_sandbox") ?? null;
  const reason = "search_web_provider_runtime_sandbox_deferred";
  const deferredTask = await setTaskPhase(task, "provider_runtime_sandbox_deferred", {
    status: "queued",
    details: {
      executor: "openclaw-search-web-provider-runtime-sandbox-v0",
      reason,
      providerContractId: sandboxStep?.params?.providerContractId ?? null,
      manifestId: sandboxStep?.params?.manifestId ?? null,
      sandboxId: sandboxStep?.params?.sandboxId ?? null,
      contractVersion: sandboxStep?.params?.contractVersion ?? null,
      blockedCheckIds: sandboxStep?.params?.blockedCheckIds ?? [],
      queryContentExposed: false,
      endpointHostsExposed: false,
      authEnvVarNamesExposed: false,
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  });

  await publishEvent("task.blocked", {
    task: serialiseTask(deferredTask),
    reason,
    executor: "openclaw-search-web-provider-runtime-sandbox-v0",
  });

  return {
    task: deferredTask,
    blocked: true,
    reason,
    actions: [],
    capabilityInvocations: [],
    commandTranscript: [],
    verification: null,
    policy: policy.decision,
    approval: approval ? serialiseApproval(approval) : null,
    governance: {
      mode: "openclaw_search_web_provider_runtime_sandbox_deferred",
      runtimeOwner: "openclaw_on_nixos",
      canUseNetwork: false,
      canImportModule: false,
      canExecutePluginCode: false,
      canActivateRuntime: false,
      executed: false,
      requiresRuntimeAdapterBeforeExecution: true,
    },
  };
}

function inferCapabilityOperation(step) {
  if (typeof step.params?.operation === "string" && step.params.operation.trim()) {
    return step.params.operation.trim();
  }
  if (step.kind === "filesystem.metadata") {
    return "metadata";
  }
  if (step.kind === "filesystem.read_text" || step.kind === "filesystem.read-text") {
    return "read_text";
  }
  if (step.kind === "filesystem.search") {
    return "search";
  }
  if (step.kind === "filesystem.list") {
    return "list";
  }
  return null;
}

function buildCapabilityInvokeBodyFromPlanStep(step, task) {
  const approved = isTaskPolicyApproved(task);
  return {
    capabilityId: step.capabilityId,
    taskId: task.id,
    intent: step.intent ?? step.kind,
    operation: inferCapabilityOperation(step),
    approved,
    params: step.params ?? {},
    policy: {
      intent: step.intent ?? step.kind,
      approved,
    },
  };
}

function buildCommandTranscriptEntry(step, response) {
  if (response.capability?.id !== "act.system.command.execute") {
    return null;
  }
  return {
    stepId: step.id ?? null,
    actionKind: step.kind ?? null,
    capabilityId: response.capability.id,
    invocationId: response.invocation?.id ?? null,
    command: response.invocation?.request?.command ?? step.params?.command ?? null,
    exitCode: response.summary?.exitCode ?? null,
    timedOut: response.summary?.timedOut ?? null,
    stdout: response.summary?.stdout ?? "",
    stderr: response.summary?.stderr ?? "",
  };
}

function normaliseCommandFailureMode(step) {
  const mode = typeof step.onFailure === "string" ? step.onFailure.trim() : "";
  return mode === "continue" ? "continue" : "fail_task";
}

function isFailedCommandTranscriptEntry(entry) {
  return entry?.timedOut === true || (Number.isInteger(entry?.exitCode) && entry.exitCode !== 0);
}

function latestExecutedCommandTranscriptEntry(commandTranscript) {
  return commandTranscript
    .slice()
    .reverse()
    .find((entry) => entry.capabilityId === "act.system.command.execute" && entry.skipped !== true) ?? null;
}

function evaluateCommandStepCondition(step, commandTranscript) {
  const condition = step.when && typeof step.when === "object" ? step.when : null;
  if (!condition) {
    return { shouldRun: true, reason: null, condition: null };
  }

  const previous = latestExecutedCommandTranscriptEntry(commandTranscript);
  if (!previous) {
    return { shouldRun: false, reason: "missing_previous_command_result", condition };
  }

  if (typeof condition.previousStdoutIncludes === "string" && !previous.stdout.includes(condition.previousStdoutIncludes)) {
    return { shouldRun: false, reason: "previous_stdout_missing_text", condition };
  }
  if (typeof condition.previousStdoutNotIncludes === "string" && previous.stdout.includes(condition.previousStdoutNotIncludes)) {
    return { shouldRun: false, reason: "previous_stdout_contains_text", condition };
  }
  if (Number.isInteger(condition.previousExitCode) && previous.exitCode !== condition.previousExitCode) {
    return { shouldRun: false, reason: "previous_exit_code_mismatch", condition };
  }

  return { shouldRun: true, reason: null, condition };
}

function buildSkippedCommandTranscriptEntry(step, conditionResult) {
  return {
    stepId: step.id ?? null,
    actionKind: step.kind ?? null,
    capabilityId: step.capabilityId ?? null,
    invocationId: null,
    command: step.params?.command ?? null,
    skipped: true,
    skipReason: conditionResult.reason,
    condition: conditionResult.condition,
    exitCode: null,
    timedOut: false,
    stdout: "",
    stderr: "",
  };
}

function extractTaskCommandTranscript(task) {
  return Array.isArray(task?.outcome?.details?.commandTranscript)
    ? task.outcome.details.commandTranscript
    : [];
}

function classifyCommandTranscriptEntry(entry) {
  if (entry?.skipped === true) {
    return "skipped";
  }
  if (entry?.timedOut === true || (Number.isInteger(entry?.exitCode) && entry.exitCode !== 0)) {
    return "failed";
  }
  return "executed";
}

function buildCommandTranscriptRecords() {
  return [...tasks.values()]
    .flatMap((task) => extractTaskCommandTranscript(task).map((entry, index) => ({
      taskId: task.id,
      taskGoal: task.goal,
      taskStatus: task.status,
      taskClosedAt: task.closedAt ?? null,
      taskUpdatedAt: task.updatedAt ?? null,
      sourceCommand: task.sourceCommand ?? null,
      taskOutcome: task.outcome?.kind ?? task.status,
      index,
      state: classifyCommandTranscriptEntry(entry),
      stepId: entry.stepId ?? null,
      actionKind: entry.actionKind ?? null,
      capabilityId: entry.capabilityId ?? null,
      invocationId: entry.invocationId ?? null,
      command: entry.command ?? null,
      exitCode: entry.exitCode ?? null,
      timedOut: entry.timedOut === true,
      skipped: entry.skipped === true,
      skipReason: entry.skipReason ?? null,
      stdout: entry.stdout ?? "",
      stderr: entry.stderr ?? "",
    })))
    .sort((left, right) => {
      const leftTime = Date.parse(left.taskClosedAt ?? left.taskUpdatedAt ?? "");
      const rightTime = Date.parse(right.taskClosedAt ?? right.taskUpdatedAt ?? "");
      const safeLeftTime = Number.isFinite(leftTime) ? leftTime : 0;
      const safeRightTime = Number.isFinite(rightTime) ? rightTime : 0;
      if (safeLeftTime !== safeRightTime) {
        return safeRightTime - safeLeftTime;
      }
      if (left.taskId !== right.taskId) {
        return String(right.taskId).localeCompare(String(left.taskId));
      }
      return left.index - right.index;
    });
}

function listCommandTranscriptRecords({ limit = 20 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number.isInteger(limit) ? limit : 20, 100));
  return buildCommandTranscriptRecords().slice(0, safeLimit);
}

function buildCommandTranscriptSummary() {
  return buildCommandTranscriptRecords().reduce((summary, record) => {
    summary.total += 1;
    summary[record.state] = (summary[record.state] ?? 0) + 1;
    if (record.taskId) {
      summary.taskIds.add(record.taskId);
    }
    const command = record.command ?? "unknown";
    summary.byCommand[command] = (summary.byCommand[command] ?? 0) + 1;
    const status = record.taskStatus ?? "unknown";
    summary.byTaskStatus[status] = (summary.byTaskStatus[status] ?? 0) + 1;
    const timestamp = record.taskClosedAt ?? record.taskUpdatedAt ?? null;
    if (timestamp && (!summary.latestAt || String(timestamp).localeCompare(summary.latestAt) > 0)) {
      summary.latestAt = timestamp;
    }
    return summary;
  }, {
    total: 0,
    executed: 0,
    skipped: 0,
    failed: 0,
    taskIds: new Set(),
    taskCount: 0,
    latestAt: null,
    byCommand: {},
    byTaskStatus: {},
  });
}

function serialiseCommandTranscriptSummary(summary) {
  return {
    ...summary,
    taskIds: [...summary.taskIds],
    taskCount: summary.taskIds.size,
  };
}

const FILESYSTEM_CHANGE_CAPABILITIES = new Set([
  "act.filesystem.mkdir",
  "act.filesystem.write_text",
  "act.filesystem.append_text",
]);

function classifyFilesystemChange(entry) {
  if (entry.capability?.id === "act.filesystem.mkdir") {
    return "mkdir";
  }
  if (entry.capability?.id === "act.filesystem.write_text") {
    return "write_text";
  }
  if (entry.capability?.id === "act.filesystem.append_text") {
    return "append_text";
  }
  return "unknown";
}

function buildFilesystemChangeRecords() {
  return capabilityInvocationLog
    .filter((entry) => entry.invoked === true && entry.blocked !== true && FILESYSTEM_CHANGE_CAPABILITIES.has(entry.capability?.id))
    .map((entry) => ({
      id: entry.id,
      at: entry.at,
      taskId: entry.request?.taskId ?? null,
      capabilityId: entry.capability?.id ?? null,
      change: classifyFilesystemChange(entry),
      path: entry.summary?.path ?? entry.request?.path ?? null,
      contentBytes: entry.summary?.contentBytes ?? null,
      overwrite: entry.summary?.overwrite ?? null,
      created: entry.summary?.created ?? null,
      recursive: entry.summary?.recursive ?? null,
      previousBytes: entry.summary?.previousBytes ?? null,
      totalBytes: entry.summary?.totalBytes ?? null,
      policy: entry.policy ?? null,
      summary: entry.summary ?? null,
    }))
    .sort((left, right) => String(right.at).localeCompare(String(left.at)));
}

function listFilesystemChangeRecords({ limit = 20 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number.isInteger(limit) ? limit : 20, 100));
  return buildFilesystemChangeRecords().slice(0, safeLimit);
}

function buildFilesystemChangeSummary() {
  return buildFilesystemChangeRecords().reduce((summary, record) => {
    summary.total += 1;
    summary[record.change] = (summary[record.change] ?? 0) + 1;
    if (record.taskId) {
      summary.taskIds.add(record.taskId);
    }
    const capabilityId = record.capabilityId ?? "unknown";
    summary.byCapability[capabilityId] = (summary.byCapability[capabilityId] ?? 0) + 1;
    const decision = record.policy?.decision ?? "unknown";
    summary.byPolicy[decision] = (summary.byPolicy[decision] ?? 0) + 1;
    if (!summary.latestAt || String(record.at).localeCompare(summary.latestAt) > 0) {
      summary.latestAt = record.at;
    }
    return summary;
  }, {
    total: 0,
    mkdir: 0,
    write_text: 0,
    append_text: 0,
    taskIds: new Set(),
    taskCount: 0,
    latestAt: null,
    byCapability: {},
    byPolicy: {},
  });
}

function serialiseFilesystemChangeSummary(summary) {
  return {
    ...summary,
    taskIds: [...summary.taskIds],
    taskCount: summary.taskIds.size,
  };
}

function classifyFilesystemRead(entry) {
  const requestedOperation = entry.request?.operation ?? null;
  if (requestedOperation === "read-text") {
    return "read_text";
  }
  return entry.summary?.operation ?? requestedOperation ?? "read";
}

function buildFilesystemReadRecords() {
  return capabilityInvocationLog
    .filter((entry) => entry.invoked === true && entry.blocked !== true && entry.capability?.id === "sense.filesystem.read")
    .map((entry) => ({
      id: entry.id,
      at: entry.at,
      taskId: entry.request?.taskId ?? null,
      capabilityId: entry.capability?.id ?? null,
      operation: classifyFilesystemRead(entry),
      path: entry.summary?.path ?? entry.request?.path ?? null,
      count: entry.summary?.count ?? null,
      contentBytes: entry.summary?.contentBytes ?? null,
      encoding: entry.summary?.encoding ?? null,
      policy: entry.policy ?? null,
      summary: entry.summary ?? null,
    }))
    .sort((left, right) => String(right.at).localeCompare(String(left.at)));
}

function listFilesystemReadRecords({ limit = 20 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number.isInteger(limit) ? limit : 20, 100));
  return buildFilesystemReadRecords().slice(0, safeLimit);
}

function buildFilesystemReadSummary() {
  return buildFilesystemReadRecords().reduce((summary, record) => {
    summary.total += 1;
    summary[record.operation] = (summary[record.operation] ?? 0) + 1;
    if (record.taskId) {
      summary.taskIds.add(record.taskId);
    }
    const capabilityId = record.capabilityId ?? "unknown";
    summary.byCapability[capabilityId] = (summary.byCapability[capabilityId] ?? 0) + 1;
    const decision = record.policy?.decision ?? "unknown";
    summary.byPolicy[decision] = (summary.byPolicy[decision] ?? 0) + 1;
    if (!summary.latestAt || String(record.at).localeCompare(summary.latestAt) > 0) {
      summary.latestAt = record.at;
    }
    return summary;
  }, {
    total: 0,
    metadata: 0,
    list: 0,
    search: 0,
    read_text: 0,
    read: 0,
    taskIds: new Set(),
    taskCount: 0,
    latestAt: null,
    byCapability: {},
    byPolicy: {},
  });
}

function serialiseFilesystemReadSummary(summary) {
  return {
    ...summary,
    taskIds: [...summary.taskIds],
    taskCount: summary.taskIds.size,
  };
}

function isTaskPolicyApproved(task) {
  const approval = task?.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  return task?.policy?.decision?.approved === true
    || task?.policy?.request?.approved === true
    || approval?.status === "approved";
}

function buildCapabilityApprovalGate(task, actionSteps) {
  if (isTaskPolicyApproved(task)) {
    return null;
  }

  for (const step of actionSteps) {
    const capability = capabilityById(step.capabilityId);
    const requiresApproval = step.requiresApproval === true
      || capability?.requiresApproval === true
      || capability?.governance === "require_approval";
    if (!capability || !requiresApproval) {
      continue;
    }

    const request = normaliseCapabilityInvokeRequest(buildCapabilityInvokeBodyFromPlanStep(step, task));
    const decision = recordPolicyDecision(evaluatePolicyIntent(
      buildCapabilityPolicyInput(capability, request),
      {
        stage: "capability_plan.approval",
        taskId: task.id,
        type: task.type,
        goal: task.goal,
      },
    ));

    if (!isPolicyExecutionAllowed(decision)) {
      return {
        step,
        capability,
        decision,
        reason: decision.decision === "deny" ? "policy_denied" : "policy_requires_approval",
      };
    }
  }

  return null;
}

function buildActionEvidence(actionResults, workViewSummary) {
  const actions = actionResults.map((action, index) => ({
    index,
    id: action?.id ?? null,
    kind: action?.kind ?? null,
    params: action?.params ?? {},
    degraded: Boolean(action?.degraded),
    result: action?.result ?? null,
    executedAt: action?.executedAt ?? null,
    screenContext: action?.screenContext ?? null,
  }));

  return {
    kind: "eye-hand-action-evidence",
    actionCount: actions.length,
    degradedCount: actions.filter((action) => action.degraded).length,
    actions,
    observedAfterActions: workViewSummary
      ? {
          summaryText: workViewSummary.summaryText ?? null,
          url: workViewSummary.url ?? null,
          visibleTextBlocks: workViewSummary.visibleTextBlocks ?? [],
          recentInteraction: workViewSummary.recentInteraction ?? null,
        }
      : null,
  };
}

function buildExecutionVerification({ targetUrl, options, verifiedScreen, actionResults, workView }) {
  const expectedUrl =
    typeof options.expectedUrl === "string" && options.expectedUrl.trim()
      ? options.expectedUrl.trim()
      : targetUrl;
  const expectedReadiness =
    typeof options.expectedReadiness === "string" && options.expectedReadiness.trim()
      ? options.expectedReadiness.trim()
      : "ready";
  const activeUrl = workView?.activeUrl ?? verifiedScreen?.screen?.snapshotText?.match(/^URL: (.+)$/m)?.[1] ?? null;
  const readiness = verifiedScreen?.screen?.readiness ?? null;
  const workViewSummary = verifiedScreen?.screen?.workViewSummary ?? null;
  const actionEvidence = buildActionEvidence(actionResults, workViewSummary);
  const degradedActions = actionResults.filter((action) => action?.degraded);
  const checks = [
    {
      name: "target_url",
      expected: expectedUrl,
      actual: activeUrl,
      passed: activeUrl === expectedUrl,
    },
    {
      name: "screen_readiness",
      expected: expectedReadiness,
      actual: readiness,
      passed: readiness === expectedReadiness,
    },
    {
      name: "actions_not_degraded",
      expected: 0,
      actual: degradedActions.length,
      passed: degradedActions.length === 0,
    },
  ];

  if (options.hideOnComplete === false) {
    checks.push({
      name: "work_view_visible",
      expected: "visible",
      actual: workView?.visibility ?? null,
      passed: workView?.visibility === "visible",
    });
  }

  const failedChecks = checks.filter((check) => !check.passed);
  return {
    ok: failedChecks.length === 0,
    expectedUrl,
    expectedReadiness,
    activeUrl,
    readiness,
    workViewSummary,
    observedTextBlocks: workViewSummary?.visibleTextBlocks ?? [],
    recentInteraction: workViewSummary?.recentInteraction ?? null,
    actionEvidence,
    checks,
    failedChecks,
  };
}

async function executeTask(task, options = {}) {
  if (!isActiveTask(task)) {
    throw new Error("Task is not active and cannot be executed.");
  }

  const targetUrl =
    typeof options.targetUrl === "string" && options.targetUrl.trim()
      ? options.targetUrl.trim()
      : task.targetUrl;
  if (!targetUrl) {
    throw new Error("Task targetUrl is required for execution.");
  }

  const policy = ensureTaskPolicy(task, { stage: "task.execute", targetUrl });
  await publishEvent("policy.evaluated", { task: serialiseTask(task), policy: policy.decision });
  if (!isPolicyExecutionAllowed(policy.decision)) {
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    const failedTask = failTask(task, `Policy blocked task execution: ${policy.decision.reason}`, {
      targetUrl,
      executor: "core-v2",
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
    });
    await publishEvent("task.failed", {
      task: serialiseTask(failedTask),
      reason: "Policy blocked task execution.",
      policy: policy.decision,
      executor: "core-v2",
    });
    return {
      task: failedTask,
      prepare: null,
      reveal: null,
      initialScreen: null,
      verifiedScreen: null,
      actions: [],
      finalWorkViewState: null,
      verification: null,
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
    };
  }

  const displayTarget =
    typeof options.displayTarget === "string" && options.displayTarget.trim()
      ? options.displayTarget.trim()
      : "workspace-2";
  const actions = normaliseExecutorActions(options.actions);
  const actionResults = [];

  try {
    await setTaskPhase(task, "preparing_work_view", {
      status: "running",
      details: { targetUrl, displayTarget, executor: "core-v1" },
    });
    const prepare = await postJson(`${sessionManagerUrl}/work-view/prepare`, {
      displayTarget,
      entryUrl: targetUrl,
    });

    await setTaskPhase(task, "opening_target", {
      status: "running",
      details: { targetUrl, executor: "core-v1" },
    });
    const reveal = await postJson(`${sessionManagerUrl}/work-view/reveal`, {
      entryUrl: targetUrl,
    });
    const attachedTask = attachTaskToWorkView(task, buildWorkViewAttachPayload(reveal, targetUrl));
    await publishEvent("task.running", { task: serialiseTask(attachedTask) });

    await setTaskPhase(task, "observing_screen", {
      status: "running",
      details: { targetUrl, executor: "core-v1" },
    });
    const initialScreen = await fetchJson(`${screenSenseUrl}/screen/current`);

    for (const action of actions) {
      const endpoint = action.kind === "keyboard.type"
        ? "/act/keyboard/type"
        : action.kind === "keyboard.hotkey"
          ? "/act/keyboard/hotkey"
          : "/act/mouse/click";
      const actionData = await postJson(`${screenActUrl}${endpoint}`, action.params);
      actionResults.push(actionData.action);
      await setTaskPhase(task, "acting_on_target", {
        status: "running",
        details: {
          actionKind: action.kind,
          degraded: Boolean(actionData.action?.degraded),
          result: actionData.action?.result ?? null,
          executor: "core-v1",
        },
      });
    }

    await setTaskPhase(task, "verifying_result", {
      status: "running",
      details: { targetUrl, executor: "core-v1" },
    });
    const verifiedScreen = await fetchJson(`${screenSenseUrl}/screen/current`);

    const preCompletionWorkViewState = await fetchJson(`${sessionManagerUrl}/work-view/state`);
    const verificationWorkView = preCompletionWorkViewState?.workView ?? reveal?.workView ?? {};
    const verification = buildExecutionVerification({
      targetUrl,
      options,
      verifiedScreen,
      actionResults,
      workView: verificationWorkView,
    });

    if (!verification.ok) {
      const failedTask = failTask(task, "Executor verification failed.", {
        targetUrl,
        executor: "core-v2",
        verification,
        workViewSummary: verification.workViewSummary ?? null,
        actionEvidence: verification.actionEvidence ?? null,
        actionCount: actionResults.length,
      });
      await publishEvent("task.failed", {
        task: serialiseTask(failedTask),
        reason: "Executor verification failed.",
        verification,
        executor: "core-v2",
      });
      return {
        task: failedTask,
        prepare,
        reveal,
        initialScreen,
        verifiedScreen,
        actions: actionResults,
        finalWorkViewState: preCompletionWorkViewState,
        verification,
      };
    }

    let finalWorkViewState = preCompletionWorkViewState;
    if (options.hideOnComplete !== false) {
      finalWorkViewState = await postJson(`${sessionManagerUrl}/work-view/hide`, {});
    }

    const workView = finalWorkViewState?.workView ?? verificationWorkView;
    const updatedTask = completeTask(task, {
      targetUrl,
      workViewUrl: targetUrl,
      summary: `Executor completed task at ${targetUrl}`,
      executor: "core-v2",
      actionCount: actionResults.length,
      verification,
      workViewSummary: verification.workViewSummary ?? null,
      actionEvidence: verification.actionEvidence ?? null,
      initialScreen: {
        readiness: initialScreen.screen?.readiness ?? null,
        focusedWindow: initialScreen.screen?.focusedWindow ?? null,
      },
      verifiedScreen: {
        readiness: verifiedScreen.screen?.readiness ?? null,
        focusedWindow: verifiedScreen.screen?.focusedWindow ?? null,
        workViewSummary: verification.workViewSummary ?? null,
      },
      actions: actionResults.map((action) => ({
        id: action?.id ?? null,
        kind: action?.kind ?? null,
        params: action?.params ?? {},
        degraded: Boolean(action?.degraded),
        result: action?.result ?? null,
        screenContext: action?.screenContext ?? null,
      })),
      workView: {
        status: workView.status ?? null,
        visibility: workView.visibility ?? null,
        mode: workView.mode ?? null,
        helperStatus: workView.helperStatus ?? null,
        browserStatus: workView.browserStatus ?? null,
        entryUrl: workView.entryUrl ?? targetUrl,
        activeUrl: workView.activeUrl ?? targetUrl,
        displayTarget: workView.displayTarget ?? displayTarget,
      },
    });
    await publishEvent("task.completed", { task: serialiseTask(updatedTask), executor: "core-v2", verification });
    return {
      task: updatedTask,
      prepare,
      reveal,
      initialScreen,
      verifiedScreen,
      actions: actionResults,
      finalWorkViewState,
      verification,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Task execution failed.";
    const failedTask = failTask(task, message, {
      targetUrl,
      executor: "core-v1",
      actionCount: actionResults.length,
    });
    await publishEvent("task.failed", { task: serialiseTask(failedTask), reason: message, executor: "core-v1" });
    throw error;
  }
}

async function executeCapabilityPlanTask(task, options = {}) {
  if (!isActiveTask(task)) {
    throw new Error("Task is not active and cannot be executed.");
  }

  const actionSteps = planCapabilityActionSteps(task);
  if (actionSteps.length === 0) {
    throw new Error("Task does not include invokable capability plan steps.");
  }

  const policy = ensureTaskPolicy(task, { stage: "capability_plan.execute" });
  await publishEvent("policy.evaluated", { task: serialiseTask(task), policy: policy.decision });
  if (!isPolicyExecutionAllowed(policy.decision)) {
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    const failedTask = failTask(task, `Policy blocked capability plan execution: ${policy.decision.reason}`, {
      executor: "capability-invoke-v1",
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
    });
    await publishEvent("task.failed", {
      task: serialiseTask(failedTask),
      reason: "Policy blocked capability plan execution.",
      policy: policy.decision,
      executor: "capability-invoke-v1",
    });
    return {
      task: failedTask,
      actions: [],
      capabilityInvocations: [],
      verification: null,
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
    };
  }

  const approvalGate = buildCapabilityApprovalGate(task, actionSteps);
  if (approvalGate) {
    const approval = createApprovalRequestForTask(task, approvalGate.decision);
    await publishEvent("policy.evaluated", {
      task: serialiseTask(task),
      policy: approvalGate.decision,
      capability: approvalGate.capability,
    });
    await setTaskPhase(task, "waiting_for_approval", {
      status: "queued",
      details: {
        executor: "capability-invoke-v1",
        capabilityId: approvalGate.capability.id,
        actionKind: approvalGate.step.kind,
        reason: approvalGate.reason,
        approvalId: approval.id,
      },
    });
    await publishTaskApprovalIfPending(task);
    return {
      task,
      blocked: true,
      reason: approvalGate.reason,
      actions: [],
      capabilityInvocations: [],
      verification: null,
      policy: approvalGate.decision,
      approval: serialiseApproval(approval),
    };
  }

  const capabilityInvocations = [];
  const commandTranscript = [];
  try {
    for (const step of actionSteps) {
      const conditionResult = evaluateCommandStepCondition(step, commandTranscript);
      if (!conditionResult.shouldRun) {
        const transcriptEntry = buildSkippedCommandTranscriptEntry(step, conditionResult);
        commandTranscript.push(transcriptEntry);
        await setTaskPhase(task, "acting_on_target", {
          status: "running",
          details: {
            actionKind: step.kind,
            capabilityId: step.capabilityId,
            skipped: true,
            skipReason: conditionResult.reason,
            condition: conditionResult.condition,
            executor: "capability-invoke-v1",
          },
        });
        continue;
      }

      const invocation = await invokeCapability(buildCapabilityInvokeBodyFromPlanStep(step, task));
      const response = invocation.response;
      capabilityInvocations.push(response);
      const transcriptEntry = buildCommandTranscriptEntry(step, response);
      if (transcriptEntry) {
        commandTranscript.push(transcriptEntry);
      }
      if (response.blocked === true || response.invoked !== true) {
        const failedTask = failTask(task, `Capability invocation blocked: ${response.reason ?? "unknown"}`, {
          executor: "capability-invoke-v1",
          step,
          invocation: response.invocation ?? null,
          policy: response.policy ?? null,
        });
        await publishEvent("task.failed", {
          task: serialiseTask(failedTask),
          reason: "Capability invocation blocked.",
          invocation: response.invocation ?? null,
          executor: "capability-invoke-v1",
        });
        return {
          task: failedTask,
          actions: [],
          capabilityInvocations,
          verification: null,
          policy: response.policy ?? policy.decision,
        };
      }

      const failureMode = transcriptEntry ? normaliseCommandFailureMode(step) : null;
      await setTaskPhase(task, "acting_on_target", {
        status: "running",
        details: {
          actionKind: step.kind,
          capabilityId: step.capabilityId,
          invocationId: response.invocation?.id ?? null,
          summary: response.summary ?? null,
          commandFailed: transcriptEntry ? isFailedCommandTranscriptEntry(transcriptEntry) : false,
          onFailure: failureMode,
          executor: "capability-invoke-v1",
        },
      });

      if (transcriptEntry && isFailedCommandTranscriptEntry(transcriptEntry) && failureMode !== "continue") {
        const reason = transcriptEntry.timedOut === true
          ? "Command execution timed out."
          : `Command execution failed with exit code ${transcriptEntry.exitCode}.`;
        const failedTask = failTask(task, reason, {
          executor: "capability-invoke-v1",
          step,
          invocation: response.invocation ?? null,
          policy: response.policy ?? null,
          commandTranscript,
          failedCommand: transcriptEntry,
          onFailure: failureMode,
        });
        await publishEvent("task.failed", {
          task: serialiseTask(failedTask),
          reason,
          invocation: response.invocation ?? null,
          executor: "capability-invoke-v1",
        });
        return {
          task: failedTask,
          actions: [],
          capabilityInvocations,
          commandTranscript,
          verification: null,
          policy: response.policy ?? policy.decision,
        };
      }
    }

    const completedTask = completeTask(task, {
      executor: "capability-invoke-v1",
      summary: `Completed ${capabilityInvocations.length} capability invocation(s).`,
      capabilityInvocations: capabilityInvocations.map((response) => ({
        id: response.invocation?.id ?? null,
        capabilityId: response.capability?.id ?? null,
        invoked: response.invoked === true,
        blocked: response.blocked === true,
        summary: response.summary ?? null,
      })),
      commandTranscript,
    });
    await publishEvent("task.completed", {
      task: serialiseTask(completedTask),
      executor: "capability-invoke-v1",
      capabilityInvocations: capabilityInvocations.map((response) => response.invocation ?? null),
    });
    return {
      task: completedTask,
      actions: [],
      capabilityInvocations,
      commandTranscript,
      verification: { ok: true, checks: [], failedChecks: [] },
      policy: policy.decision,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown execution error";
    const failedTask = failTask(task, message, {
      executor: "capability-invoke-v1",
      capabilityInvocations,
      commandTranscript,
    });
    await publishEvent("task.failed", { task: serialiseTask(failedTask), reason: message, executor: "capability-invoke-v1" });
    return {
      task: failedTask,
      actions: [],
      capabilityInvocations,
      commandTranscript,
      verification: null,
      policy: policy.decision,
    };
  }
}

function recoverTask(sourceTask) {
  if (sourceTask.recoveredByTaskId && tasks.has(sourceTask.recoveredByTaskId)) {
    throw new Error(`Task already has a recovery task: ${sourceTask.recoveredByTaskId}`);
  }

  const recoveryAttempt = (sourceTask.recovery?.attempt ?? 0) + 1;
  const recoverableCapabilityPlan = hasRecoverableCapabilityPlan(sourceTask);
  const recoverableNativePluginRuntimeActivationPlan = hasRecoverableNativePluginRuntimeActivationPlan(sourceTask);
  const recoverableSearchWebAdapterPlan = hasRecoverableSearchWebAdapterPlan(sourceTask);
  const shouldRecoverExistingPlan = recoverableCapabilityPlan
    || recoverableNativePluginRuntimeActivationPlan
    || recoverableSearchWebAdapterPlan;
  const recoveryBody = {
    goal: sourceTask.goal,
    type: sourceTask.type,
    targetUrl: sourceTask.targetUrl,
    workViewStrategy: sourceTask.workViewStrategy,
    includePlan: Boolean(sourceTask.plan) && !shouldRecoverExistingPlan,
    recovery: {
      recoveredFromTaskId: sourceTask.id,
      recoveredFromOutcome: sourceTask.outcome?.kind ?? sourceTask.status,
      attempt: recoveryAttempt,
      recoveryEvidence: sourceTask.outcome?.details?.recoveryEvidence ?? null,
    },
  };

  if (shouldRecoverExistingPlan) {
    recoveryBody.plan = resetRecoveredPlan(sourceTask.plan);
    recoveryBody.policy = buildRecoveredPolicyRequest(sourceTask);
  }
  if (sourceTask.sourceCommand && typeof sourceTask.sourceCommand === "object") {
    recoveryBody.sourceCommand = sourceTask.sourceCommand;
  }

  const recoveredTask = createTask(recoveryBody);

  sourceTask.recoveredByTaskId = recoveredTask.id;
  sourceTask.updatedAt = new Date().toISOString();
  persistState();
  return recoveredTask;
}

function clonePlainObject(value) {
  return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : {};
}

function buildRecoveredPolicyRequest(sourceTask) {
  const request = clonePlainObject(sourceTask.policy?.request ?? sourceTask.policy ?? {});
  delete request.approved;
  return request;
}

function resetRecoveredPlan(plan) {
  const now = new Date().toISOString();
  const recoveredPlan = clonePlainObject(plan);
  recoveredPlan.planId = `plan-${randomUUID()}`;
  recoveredPlan.status = "planned";
  recoveredPlan.createdAt = now;
  recoveredPlan.updatedAt = now;
  delete recoveredPlan.failure;

  if (Array.isArray(recoveredPlan.steps)) {
    recoveredPlan.steps = recoveredPlan.steps.map((step) => {
      const recoveredStep = {
        ...step,
        status: "pending",
      };
      delete recoveredStep.completedAt;
      delete recoveredStep.details;
      return recoveredStep;
    });
  }

  return recoveredPlan;
}

function recoveryEvidenceTargetUrl(sourceTask) {
  const targetUrl = sourceTask?.outcome?.details?.recoveryEvidence?.recommendation?.targetUrl;
  return typeof targetUrl === "string" && targetUrl.trim() ? targetUrl.trim() : null;
}

function buildRecoveryExecuteOptions(options, attempt, sourceTask = null) {
  const recoveryOptions = options.recovery && typeof options.recovery === "object" ? options.recovery : {};
  const evidenceTargetUrl = recoveryEvidenceTargetUrl(sourceTask);
  return {
    ...options,
    ...recoveryOptions,
    autoRecover: false,
    recoveryEvidenceTargetUrl: evidenceTargetUrl,
    expectedUrl:
      typeof recoveryOptions.expectedUrl === "string" && recoveryOptions.expectedUrl.trim()
        ? recoveryOptions.expectedUrl.trim()
        : evidenceTargetUrl
          ? evidenceTargetUrl
        : typeof options.recoveryExpectedUrl === "string" && options.recoveryExpectedUrl.trim()
          ? options.recoveryExpectedUrl.trim()
          : options.targetUrl,
    actions: Array.isArray(recoveryOptions.actions) ? recoveryOptions.actions : options.actions,
    recoveryAttempt: attempt,
  };
}

function serialiseExecutionResult(executionResult) {
  const finalExecution = executionResult.finalExecution ?? executionResult;
  return {
    executor: finalExecution.capabilityInvocations ? "capability-invoke-v1" : executionResult.recovery?.attempted ? "core-v3" : finalExecution.verification ? "core-v2" : "core-v1",
    actions: (finalExecution.actions ?? []).map((action) => ({
      kind: action?.kind ?? null,
      degraded: Boolean(action?.degraded),
      result: action?.result ?? null,
    })),
    policy: finalExecution.policy ?? finalExecution.task?.policy?.decision ?? null,
    verification: finalExecution.verification ?? null,
    workViewSummary:
      finalExecution.verification?.workViewSummary
      ?? finalExecution.task?.outcome?.details?.workViewSummary
      ?? null,
    observedTextBlocks: finalExecution.verification?.observedTextBlocks ?? [],
    actionEvidence:
      finalExecution.verification?.actionEvidence
      ?? finalExecution.task?.outcome?.details?.actionEvidence
      ?? null,
    capabilityInvocations: (finalExecution.capabilityInvocations ?? []).map((response) => ({
      id: response.invocation?.id ?? null,
      capabilityId: response.capability?.id ?? null,
      invoked: response.invoked === true,
      blocked: response.blocked === true,
      reason: response.reason ?? null,
      summary: response.summary ?? null,
    })),
    commandTranscript: finalExecution.task?.outcome?.details?.commandTranscript ?? [],
    finalReadiness: finalExecution.verifiedScreen?.screen?.readiness ?? null,
    finalWorkView: finalExecution.finalWorkViewState?.workView ?? null,
    recovery: executionResult.recovery ?? null,
    attempts: (executionResult.attempts ?? [finalExecution]).map((attempt) => ({
      taskId: attempt.task?.id ?? null,
      status: attempt.task?.status ?? null,
      phase: attempt.task?.executionPhase ?? null,
      verification: attempt.verification?.ok ?? null,
      workViewSummaryUrl: attempt.verification?.workViewSummary?.url ?? null,
      failedChecks: attempt.verification?.failedChecks?.map((check) => check.name) ?? [],
    })),
  };
}

async function executeTaskWithRecovery(task, options = {}) {
  if (isNativePluginCapabilityTask(task)) {
    const deferredExecution = await deferNativePluginCapabilityExecution(task);
    return {
      finalExecution: deferredExecution,
      attempts: [deferredExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isNativePluginRuntimeActivationTask(task)) {
    const deferredExecution = await deferNativePluginRuntimeActivation(task);
    return {
      finalExecution: deferredExecution,
      attempts: [deferredExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isNativePluginRuntimeAdapterTask(task)) {
    const deferredExecution = await deferNativePluginRuntimeAdapterImplementation(task);
    return {
      finalExecution: deferredExecution,
      attempts: [deferredExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isOpenClawSearchWebAdapterTask(task)) {
    const deferredExecution = await deferOpenClawSearchWebAdapterExecution(task);
    return {
      finalExecution: deferredExecution,
      attempts: [deferredExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isOpenClawSearchWebRuntimeActivationTask(task)) {
    const deferredExecution = await deferOpenClawSearchWebRuntimeActivation(task);
    return {
      finalExecution: deferredExecution,
      attempts: [deferredExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isOpenClawSearchWebProviderRuntimeSandboxTask(task)) {
    const deferredExecution = await deferOpenClawSearchWebProviderRuntimeSandbox(task);
    return {
      finalExecution: deferredExecution,
      attempts: [deferredExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isSystemdRepairExecutionTask(task)) {
    const deferredExecution = task.systemdRepair?.execution?.realExecutionEnabled === true
      ? await executeSystemdRepairExecutionTask(task)
      : await deferSystemdRepairExecutionTask(task);
    return {
      finalExecution: deferredExecution,
      attempts: [deferredExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isSystemdNextRepairTask(task)) {
    const deferredExecution = task.systemdNextRepair?.execution?.realExecutionEnabled === true
      ? await executeSystemdNextRepairTask(task)
      : await deferSystemdNextRepairTask(task);
    return {
      finalExecution: deferredExecution,
      attempts: [deferredExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isBodyEvidenceLedgerDirectoryTask(task)) {
    const directoryExecution = await executeBodyEvidenceLedgerDirectoryTask(task);
    return {
      finalExecution: directoryExecution,
      attempts: [directoryExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isBodyEvidenceLedgerFirstRecordTask(task)) {
    const firstRecordExecution = await executeBodyEvidenceLedgerFirstRecordTask(task);
    return {
      finalExecution: firstRecordExecution,
      attempts: [firstRecordExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (isBodyEvidenceLedgerFollowupRecordTask(task)) {
    const followupRecordExecution = await deferBodyEvidenceLedgerFollowupRecordTask(task);
    return {
      finalExecution: followupRecordExecution,
      attempts: [followupRecordExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  if (shouldExecuteCapabilityPlan(task)) {
    const capabilityExecution = await executeCapabilityPlanTask(task, options);
    return {
      finalExecution: capabilityExecution,
      attempts: [capabilityExecution],
      recovery: {
        attempted: false,
        maxAttempts: 0,
      },
    };
  }

  const firstExecution = await executeTask(task, options);
  const maxRecoveryAttempts =
    Number.isInteger(options.maxRecoveryAttempts) && options.maxRecoveryAttempts > 0
      ? options.maxRecoveryAttempts
      : Number.isInteger(options.retryBudget) && options.retryBudget > 0
        ? options.retryBudget
        : 0;

  if (firstExecution.task.status !== "failed" || options.autoRecover !== true || maxRecoveryAttempts < 1) {
    return {
      finalExecution: firstExecution,
      attempts: [firstExecution],
      recovery: {
        attempted: false,
        maxAttempts: maxRecoveryAttempts,
      },
    };
  }

  let sourceTask = firstExecution.task;
  const attempts = [firstExecution];
  const recoveredTaskIds = [];
  const usedRecommendationTargetUrls = [];

  for (let attempt = 1; attempt <= maxRecoveryAttempts; attempt += 1) {
    const recoveredTask = recoverTask(sourceTask);
    recoveredTaskIds.push(recoveredTask.id);
    reconcileRuntimeState();
    await publishEvent("task.created", { task: serialiseTask(recoveredTask), executor: "core-v3" });
    await publishTaskApprovalIfPending(recoveredTask);
    await publishEvent("task.recovered", {
      task: serialiseTask(recoveredTask),
      recoveredFromTaskId: sourceTask.id,
      autoRecovered: true,
      attempt,
      executor: "core-v3",
    });

    const recoveryOptions = buildRecoveryExecuteOptions(options, attempt, sourceTask);
    if (recoveryOptions.recoveryEvidenceTargetUrl) {
      usedRecommendationTargetUrls.push(recoveryOptions.recoveryEvidenceTargetUrl);
    }
    const recoveryExecution = await executeTask(recoveredTask, recoveryOptions);
    attempts.push(recoveryExecution);
    sourceTask = recoveryExecution.task;

    if (recoveryExecution.task.status !== "failed") {
      return {
        finalExecution: recoveryExecution,
        attempts,
        recovery: {
          attempted: true,
          succeeded: true,
          attempts: attempt,
          recoveredTaskIds,
          recoveredFromTaskId: firstExecution.task.id,
          usedRecommendationTargetUrl: usedRecommendationTargetUrls.at(-1) ?? null,
          usedRecommendationTargetUrls,
        },
      };
    }
  }

  return {
    finalExecution: attempts.at(-1),
    attempts,
    recovery: {
      attempted: true,
      succeeded: false,
      attempts: maxRecoveryAttempts,
      recoveredTaskIds,
      recoveredFromTaskId: firstExecution.task.id,
      usedRecommendationTargetUrl: usedRecommendationTargetUrls.at(-1) ?? null,
      usedRecommendationTargetUrls,
    },
  };
}

function buildOperatorOptions(task, body = {}) {
  const planActions = task.plan?.steps
    ?.filter((step) => step.phase === "acting_on_target")
    .map((step) => ({ kind: step.kind, params: step.params ?? {} }));
  return {
    ...body,
    targetUrl: body.targetUrl ?? task.targetUrl,
    actions: Array.isArray(body.actions) ? body.actions : planActions,
    operator: "loop-v1",
  };
}

async function runOperatorStep(body = {}) {
  reconcileRuntimeState();
  const ignorePause = body.ignorePause === true;
  const dryRun = body.dryRun === true || body.peek === true;

  if (runtimeState.paused && !ignorePause) {
    return {
      ran: false,
      blocked: true,
      reason: "runtime_paused",
      dryRun,
      task: null,
      execution: null,
      summary: buildTaskSummary(),
      operator: buildOperatorState(),
    };
  }

  const task = getNextQueuedTask();
  if (!task) {
    return {
      ran: false,
      blocked: false,
      reason: "no_queued_task",
      dryRun,
      task: null,
      execution: null,
      summary: buildTaskSummary(),
      operator: buildOperatorState(),
    };
  }

  if (dryRun) {
    return {
      ran: false,
      blocked: false,
      reason: "dry_run",
      dryRun: true,
      task,
      execution: null,
      summary: buildTaskSummary(),
      operator: buildOperatorState(),
    };
  }

  const policy = ensureTaskPolicy(task, { stage: "operator.step" });
  await publishEvent("policy.evaluated", { task: serialiseTask(task), policy: policy.decision });
  if (!isPolicyExecutionAllowed(policy.decision)) {
    const approval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
    return {
      ran: false,
      blocked: true,
      reason: policy.decision.decision === "deny" ? "policy_denied" : "policy_requires_approval",
      dryRun: false,
      task,
      execution: null,
      policy: policy.decision,
      approval: approval ? serialiseApproval(approval) : null,
      summary: buildTaskSummary(),
      operator: buildOperatorState(),
    };
  }

  const pendingApproval = task.approval?.requestId ? approvals.get(task.approval.requestId) : null;
  if (pendingApproval?.status === "pending") {
    return {
      ran: false,
      blocked: true,
      reason: "policy_requires_approval",
      dryRun: false,
      task,
      execution: null,
      policy: task.policy?.decision ?? null,
      approval: serialiseApproval(pendingApproval),
      summary: buildTaskSummary(),
      operator: buildOperatorState(),
    };
  }

  const executionResult = await executeTaskWithRecovery(task, buildOperatorOptions(task, body));
  const finalExecution = executionResult.finalExecution ?? executionResult;
  if (finalExecution.blocked === true) {
    return {
      ran: false,
      blocked: true,
      reason: finalExecution.reason ?? "policy_requires_approval",
      dryRun: false,
      task: finalExecution.task,
      execution: null,
      policy: finalExecution.policy ?? finalExecution.task?.policy?.decision ?? null,
      approval: finalExecution.approval ?? finalExecution.task?.approval ?? null,
      summary: buildTaskSummary(),
      operator: buildOperatorState(),
    };
  }

  return {
    ran: true,
    blocked: false,
    reason: null,
    dryRun: false,
    task: executionResult.finalExecution.task,
    execution: executionResult,
    summary: buildTaskSummary(),
    operator: buildOperatorState(),
  };
}

async function runOperatorLoop(body = {}) {
  const maxSteps = Number.isInteger(body.maxSteps) && body.maxSteps > 0 ? Math.min(body.maxSteps, 20) : 5;
  const steps = [];
  let stopReason = null;
  let blocked = false;
  let dryRun = false;
  let nextTask = null;

  for (let index = 0; index < maxSteps; index += 1) {
    const step = await runOperatorStep(body);
    if (!step.ran) {
      stopReason = step.reason ?? null;
      blocked = step.blocked === true;
      dryRun = step.dryRun === true;
      nextTask = step.task ?? null;
      break;
    }
    steps.push(step);
  }

  return {
    ran: steps.length > 0,
    steps,
    blocked,
    reason: stopReason,
    dryRun,
    nextTask,
    summary: buildTaskSummary(),
    operator: buildOperatorState(),
  };
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "openclaw-core",
      stage: "active",
      host,
      port,
      eventHubUrl,
      sessionManagerUrl,
      browserRuntimeUrl,
      screenSenseUrl,
      screenActUrl,
      systemSenseUrl,
      systemHealUrl,
      stateFilePath,
      autonomyMode,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/mvp/route") {
    sendJson(res, 200, buildMvpRouteAlignment());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-2/repair-demo-status") {
    sendJson(res, 200, buildPhase2RepairDemoStatus());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-2/next-repair-demo-status") {
    sendJson(res, 200, buildPhase2NextRepairDemoStatus());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-2/body-evidence-ledger-followup-record-readiness") {
    sendJson(res, 200, buildBodyEvidenceLedgerFollowupRecordReadiness());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-2/demo-control-room") {
    sendJson(res, 200, await buildPhase2DemoControlRoom());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-2/demo-walkthrough") {
    sendJson(res, 200, await buildPhase2DemoWalkthrough());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-2/demo-readiness-exit") {
    sendJson(res, 200, await buildPhase2DemoReadinessExit());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/phase-2/next-capability-route-review") {
    sendJson(res, 200, await buildPhase2NextCapabilityRouteReview({
      ledgerDemoStatusCheckpointComplete: requestUrl.searchParams.get("afterLedgerDemoStatus") === "true",
      repairCandidateDemoCheckpointComplete: requestUrl.searchParams.get("afterRepairCandidateDemoStatus") === "true",
    }));
    return;
  }

  reconcileApprovalExpirations();

  if (req.method === "GET" && requestUrl.pathname === "/state/runtime") {
    reconcileRuntimeState();
    sendJson(res, 200, {
      runtime: runtimeState,
      taskCount: tasks.size,
      currentTask: runtimeState.currentTaskId ? serialiseTask(getTaskById(runtimeState.currentTaskId)) : null,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/summary") {
    reconcileRuntimeState();
    sendJson(res, 200, {
      ok: true,
      summary: buildTaskSummary(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/active") {
    reconcileRuntimeState();
    const activeTasks = getActiveTasks();
    sendJson(res, 200, {
      ok: true,
      count: activeTasks.length,
      items: activeTasks.map((task) => serialiseTask(task)),
      summary: buildTaskSummary(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/operator/state") {
    sendJson(res, 200, {
      ok: true,
      operator: buildOperatorState(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/policy/state") {
    sendJson(res, 200, {
      ok: true,
      policy: buildPolicyState(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces") {
    sendJson(res, 200, {
      ok: true,
      ...buildWorkspaceRegistry(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/summary") {
    const registry = buildWorkspaceRegistry();
    sendJson(res, 200, {
      ok: true,
      registry: registry.registry,
      mode: registry.mode,
      generatedAt: registry.generatedAt,
      roots: registry.roots,
      summary: registry.summary,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/command-proposals") {
    sendJson(res, 200, {
      ok: true,
      ...buildWorkspaceCommandProposals(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/command-proposals/summary") {
    const proposals = buildWorkspaceCommandProposals();
    sendJson(res, 200, {
      ok: true,
      registry: proposals.registry,
      mode: proposals.mode,
      generatedAt: proposals.generatedAt,
      roots: proposals.roots,
      summary: proposals.summary,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/source-command-proposals") {
    try {
      sendJson(res, 200, {
        ok: true,
        ...buildOpenClawSourceCommandProposals({
          workspacePath: requestUrl.searchParams.get("workspacePath"),
          query: requestUrl.searchParams.get("query") ?? "command",
          limit: requestUrl.searchParams.get("limit") ?? "12",
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-migration-map") {
    sendJson(res, 200, {
      ok: true,
      ...buildOpenClawMigrationMap(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-migration-map/summary") {
    const map = buildOpenClawMigrationMap();
    sendJson(res, 200, {
      ok: true,
      registry: map.registry,
      mode: map.mode,
      generatedAt: map.generatedAt,
      sourceRegistry: map.sourceRegistry,
      roots: map.roots,
      summary: map.summary,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-migration-plan") {
    sendJson(res, 200, {
      ok: true,
      ...buildOpenClawMigrationPlan(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-migration-plan/summary") {
    const plan = buildOpenClawMigrationPlan();
    sendJson(res, 200, {
      ok: true,
      registry: plan.registry,
      mode: plan.mode,
      generatedAt: plan.generatedAt,
      sourceRegistry: plan.sourceRegistry,
      roots: plan.roots,
      summary: plan.summary,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-plugin-sdk-contract-review") {
    sendJson(res, 200, {
      ok: true,
      ...buildOpenClawPluginSdkContractReview(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-plugin-sdk-contract-review/summary") {
    const review = buildOpenClawPluginSdkContractReview();
    sendJson(res, 200, {
      ok: true,
      registry: review.registry,
      mode: review.mode,
      generatedAt: review.generatedAt,
      sourceRegistry: review.sourceRegistry,
      roots: review.roots,
      summary: review.summary,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-plugin-sdk-source-review-scope") {
    try {
      sendJson(res, 200, buildOpenClawPluginSdkSourceReviewScope({
        packagePath: requestUrl.searchParams.get("packagePath"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-plugin-sdk-source-review-scope/summary") {
    try {
      const scope = buildOpenClawPluginSdkSourceReviewScope({
        packagePath: requestUrl.searchParams.get("packagePath"),
      });
      sendJson(res, 200, {
        ok: true,
        registry: scope.registry,
        mode: scope.mode,
        generatedAt: scope.generatedAt,
        sourceRegistry: scope.sourceRegistry,
        sourceMode: scope.sourceMode,
        summary: scope.summary,
        governance: scope.governance,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-plugin-sdk-source-content-review") {
    try {
      sendJson(res, 200, buildOpenClawPluginSdkSourceContentReview({
        packagePath: requestUrl.searchParams.get("packagePath"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-plugin-sdk-source-content-review/summary") {
    try {
      const review = buildOpenClawPluginSdkSourceContentReview({
        packagePath: requestUrl.searchParams.get("packagePath"),
      });
      sendJson(res, 200, {
        ok: true,
        registry: review.registry,
        mode: review.mode,
        generatedAt: review.generatedAt,
        sourceRegistry: review.sourceRegistry,
        sourceMode: review.sourceMode,
        summary: review.summary,
        governance: review.governance,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-plugin-sdk-native-contract-tests") {
    try {
      sendJson(res, 200, buildOpenClawPluginSdkNativeContractTests({
        packagePath: requestUrl.searchParams.get("packagePath"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/openclaw-plugin-sdk-native-contract-tests/summary") {
    try {
      const report = buildOpenClawPluginSdkNativeContractTests({
        packagePath: requestUrl.searchParams.get("packagePath"),
      });
      sendJson(res, 200, {
        ok: report.ok,
        registry: report.registry,
        mode: report.mode,
        generatedAt: report.generatedAt,
        sourceRegistries: report.sourceRegistries,
        summary: report.summary,
        governance: report.governance,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-native-plugin-sdk-contract-implementation") {
    try {
      sendJson(res, 200, buildOpenClawNativePluginSdkContractImplementation({
        packagePath: requestUrl.searchParams.get("packagePath"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-native-plugin-sdk-contract-implementation/summary") {
    try {
      const implementation = buildOpenClawNativePluginSdkContractImplementation({
        packagePath: requestUrl.searchParams.get("packagePath"),
      });
      sendJson(res, 200, {
        ok: implementation.ok,
        registry: implementation.registry,
        mode: implementation.mode,
        generatedAt: implementation.generatedAt,
        sourceRegistries: implementation.sourceRegistries,
        summary: implementation.summary,
        governance: implementation.governance,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-tool-catalog") {
    try {
      sendJson(res, 200, buildOpenClawToolCatalog({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-tool-catalog/summary") {
    try {
      const catalog = buildOpenClawToolCatalog({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
      });
      sendJson(res, 200, {
        ok: catalog.ok,
        registry: catalog.registry,
        mode: catalog.mode,
        generatedAt: catalog.generatedAt,
        sourceRegistries: catalog.sourceRegistries,
        capability: catalog.capability,
        summary: catalog.summary,
        governance: catalog.governance,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-plugin-manifest-map") {
    try {
      sendJson(res, 200, buildOpenClawPluginManifestMap({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-plugin-manifest-map/summary") {
    try {
      const manifestMap = buildOpenClawPluginManifestMap({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit: requestUrl.searchParams.get("limit"),
      });
      sendJson(res, 200, {
        ok: manifestMap.ok,
        registry: manifestMap.registry,
        mode: manifestMap.mode,
        generatedAt: manifestMap.generatedAt,
        sourceRegistries: manifestMap.sourceRegistries,
        capability: manifestMap.capability,
        summary: manifestMap.summary,
        governance: manifestMap.governance,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-native-plugin-contract") {
    sendJson(res, 200, {
      ok: true,
      ...buildOpenClawNativePluginContractRegistry(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-native-plugin-contract/summary") {
    const registry = buildOpenClawNativePluginContractRegistry();
    sendJson(res, 200, {
      ok: true,
      registry: registry.registry,
      mode: registry.mode,
      generatedAt: registry.generatedAt,
      sourceRegistry: registry.sourceRegistry,
      sourceMode: registry.sourceMode,
      summary: registry.summary,
      validation: registry.validation,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-native-plugin-registry") {
    sendJson(res, 200, buildOpenClawNativePluginRegistryResponse());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-native-plugin-registry/summary") {
    const registry = buildOpenClawNativePluginRegistryResponse();
    sendJson(res, 200, {
      ok: true,
      registry: registry.registry,
      mode: registry.mode,
      runtimeOwner: registry.runtimeOwner,
      activationMode: registry.activationMode,
      generatedAt: registry.generatedAt,
      validation: registry.validation,
      summary: registry.summary,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-formal-integration-readiness") {
    sendJson(res, 200, {
      ok: true,
      ...buildOpenClawFormalIntegrationReadiness(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-formal-integration-readiness/summary") {
    const readiness = buildOpenClawFormalIntegrationReadiness();
    sendJson(res, 200, {
      ok: true,
      registry: readiness.registry,
      mode: readiness.mode,
      generatedAt: readiness.generatedAt,
      sourceRegistries: readiness.sourceRegistries,
      status: readiness.status,
      readyForFormalIntegration: readiness.readyForFormalIntegration,
      summary: readiness.summary,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/openclaw-native-plugin-adapter") {
    sendJson(res, 200, {
      ok: true,
      ...buildOpenClawNativePluginAdapterStatus(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/manifest-profile") {
    try {
      sendJson(res, 200, buildNativePluginManifestProfile({
        packagePath: requestUrl.searchParams.get("packagePath"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/tool-catalog") {
    try {
      sendJson(res, 200, buildNativeOpenClawToolCatalogProfile({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        category: requestUrl.searchParams.get("category"),
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-manifest-map") {
    try {
      sendJson(res, 200, buildOpenClawPluginManifestMap({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-capability-plan") {
    try {
      sendJson(res, 200, buildOpenClawPluginCapabilityPlan({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-candidate-contract-tests") {
    try {
      sendJson(res, 200, buildOpenClawPluginCandidateContractTests({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        category: requestUrl.searchParams.get("category") ?? "search_and_web",
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-contract") {
    try {
      sendJson(res, 200, buildOpenClawPluginSearchWebAdapterContract({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-task-draft") {
    try {
      sendJson(res, 200, buildOpenClawPluginSearchWebAdapterTaskDraft({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        providerContractId: requestUrl.searchParams.get("providerContractId"),
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q") ?? "openclaw native integration",
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-runtime-preflight") {
    try {
      sendJson(res, 200, buildOpenClawPluginSearchWebAdapterRuntimePreflight({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        providerContractId: requestUrl.searchParams.get("providerContractId"),
        query: requestUrl.searchParams.get("query") ?? "openclaw native integration",
        limit: Number.parseInt(requestUrl.searchParams.get("limit") ?? "8", 10),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-runtime-activation-plan") {
    try {
      sendJson(res, 200, buildOpenClawPluginSearchWebAdapterRuntimeActivationPlan({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        providerContractId: requestUrl.searchParams.get("providerContractId"),
        query: requestUrl.searchParams.get("query") ?? "openclaw native integration",
        limit: Number.parseInt(requestUrl.searchParams.get("limit") ?? "8", 10),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox") {
    try {
      sendJson(res, 200, buildOpenClawPluginSearchWebAdapterProviderRuntimeSandbox({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        providerContractId: requestUrl.searchParams.get("providerContractId"),
        query: requestUrl.searchParams.get("query") ?? "openclaw native integration",
        limit: Number.parseInt(requestUrl.searchParams.get("limit") ?? "8", 10),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-runtime-activation-task-draft") {
    try {
      sendJson(res, 200, buildOpenClawPluginSearchWebAdapterRuntimeActivationTaskDraft({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        providerContractId: requestUrl.searchParams.get("providerContractId"),
        query: requestUrl.searchParams.get("query") ?? "openclaw native integration",
        limit: Number.parseInt(requestUrl.searchParams.get("limit") ?? "8", 10),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox-task-draft") {
    try {
      sendJson(res, 200, buildOpenClawPluginSearchWebAdapterProviderRuntimeSandboxTaskDraft({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        providerContractId: requestUrl.searchParams.get("providerContractId"),
        query: requestUrl.searchParams.get("query") ?? "openclaw native integration",
        limit: Number.parseInt(requestUrl.searchParams.get("limit") ?? "8", 10),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createOpenClawPluginSearchWebAdapterTask({
        workspacePath: body.workspacePath,
        providerContractId: body.providerContractId,
        query: body.query ?? body.q,
        limit: body.limit,
        confirm: body.confirm,
      });
      sendJson(res, 201, {
        ...result,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-runtime-activation-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createOpenClawPluginSearchWebAdapterRuntimeActivationTask({
        workspacePath: body.workspacePath,
        providerContractId: body.providerContractId,
        query: body.query ?? body.q,
        limit: body.limit,
        confirm: body.confirm,
      });
      sendJson(res, 201, {
        ...result,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/plugin-search-web-adapter-provider-runtime-sandbox-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createOpenClawPluginSearchWebAdapterProviderRuntimeSandboxTask({
        workspacePath: body.workspacePath,
        providerContractId: body.providerContractId,
        query: body.query ?? body.q,
        limit: body.limit,
        confirm: body.confirm,
      });
      sendJson(res, 201, {
        ...result,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/workspace-semantic-index") {
    try {
      sendJson(res, 200, buildNativeOpenClawWorkspaceSemanticIndex({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        scope: requestUrl.searchParams.get("scope") ?? "tools",
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/workspace-symbol-lookup") {
    try {
      sendJson(res, 200, buildNativeOpenClawWorkspaceSymbolLookup({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        scope: requestUrl.searchParams.get("scope") ?? "tools",
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q") ?? "tool",
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/workspace-edit-target-selection") {
    try {
      sendJson(res, 200, buildNativeOpenClawWorkspaceEditTargetSelection({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        scope: requestUrl.searchParams.get("scope") ?? "tools",
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q") ?? "edit",
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/prompt-semantics") {
    try {
      sendJson(res, 200, buildNativeOpenClawPromptSemanticsProfile({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q") ?? "edit",
        limit: requestUrl.searchParams.get("limit"),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/workspace-text-write/draft") {
    try {
      const draft = buildNativeOpenClawWorkspaceTextWriteDraft({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        relativePath: requestUrl.searchParams.get("relativePath") ?? "scratch/native-write.txt",
        content: "hello from openclaw native workspace text write\n",
        overwrite: requestUrl.searchParams.get("overwrite") !== "false",
      });
      sendJson(res, 200, {
        ok: true,
        ...draft,
        draft: {
          ...draft.draft,
          plan: serialisePlanForPublic(draft.draft.plan),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/workspace-text-write-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createNativeOpenClawWorkspaceTextWriteTask({
        workspacePath: typeof body.workspacePath === "string" ? body.workspacePath : null,
        relativePath: typeof body.relativePath === "string" ? body.relativePath : "scratch/native-write.txt",
        content: typeof body.content === "string" ? body.content : "",
        overwrite: body.overwrite !== false,
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        capability: result.capability,
        workspace: result.workspace,
        target: result.target,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/workspace-patch-apply/draft") {
    try {
      const editsParam = requestUrl.searchParams.get("edits");
      const edits = editsParam ? JSON.parse(editsParam) : null;
      const proposalParam = requestUrl.searchParams.get("proposal");
      const proposal = proposalParam ? JSON.parse(proposalParam) : null;
      const selectTargetFromSource = requestUrl.searchParams.get("selectTargetFromSource") === "true";
      const draft = buildNativeOpenClawWorkspacePatchApplyDraft({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        relativePath: requestUrl.searchParams.get("relativePath") ?? null,
        search: requestUrl.searchParams.get("search") ?? "before",
        replacement: requestUrl.searchParams.get("replacement") ?? "after",
        occurrence: Number.parseInt(requestUrl.searchParams.get("occurrence") ?? "1", 10),
        edits,
        contextLines: Number.parseInt(requestUrl.searchParams.get("contextLines") ?? "1", 10),
        proposal,
        deriveProposalFromSource: requestUrl.searchParams.get("deriveProposalFromSource") === "true",
        proposalQuery: requestUrl.searchParams.get("proposalQuery") ?? "edit",
        selectTargetFromSource,
        targetSelectionQuery: requestUrl.searchParams.get("targetSelectionQuery") ?? requestUrl.searchParams.get("proposalQuery") ?? "edit",
        targetSelectionScope: requestUrl.searchParams.get("targetSelectionScope") ?? "tools",
      });
      sendJson(res, 200, {
        ok: true,
        ...draft,
        draft: {
          ...draft.draft,
          plan: serialisePlanForPublic(draft.draft.plan),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/workspace-patch-apply-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createNativeOpenClawWorkspacePatchApplyTask({
        workspacePath: typeof body.workspacePath === "string" ? body.workspacePath : null,
        relativePath: typeof body.relativePath === "string" ? body.relativePath : null,
        search: typeof body.search === "string" ? body.search : "",
        replacement: typeof body.replacement === "string" ? body.replacement : "",
        occurrence: Number.isInteger(body.occurrence) ? body.occurrence : 1,
        edits: Array.isArray(body.edits) ? body.edits : null,
        contextLines: Number.isInteger(body.contextLines) ? body.contextLines : 1,
        proposal: body.proposal && typeof body.proposal === "object" ? body.proposal : null,
        deriveProposalFromSource: body.deriveProposalFromSource === true,
        proposalQuery: typeof body.proposalQuery === "string" ? body.proposalQuery : "edit",
        selectTargetFromSource: body.selectTargetFromSource === true,
        targetSelectionQuery: typeof body.targetSelectionQuery === "string" ? body.targetSelectionQuery : typeof body.proposalQuery === "string" ? body.proposalQuery : "edit",
        targetSelectionScope: typeof body.targetSelectionScope === "string" ? body.targetSelectionScope : "tools",
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        capability: result.capability,
        workspace: result.workspace,
        target: result.target,
        validation: result.validation,
        proposal: result.proposal,
        proposalSourceSignals: result.proposalSourceSignals,
        targetSelection: result.targetSelection,
        edits: result.edits,
        diffPreview: result.diffPreview,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/source-authored-edit/draft") {
    try {
      const editsParam = requestUrl.searchParams.get("edits");
      const edits = editsParam ? JSON.parse(editsParam) : null;
      const draft = buildOpenClawSourceAuthoredEditDraft({
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        search: requestUrl.searchParams.get("search") ?? "before",
        replacement: requestUrl.searchParams.get("replacement") ?? "after",
        occurrence: Number.parseInt(requestUrl.searchParams.get("occurrence") ?? "1", 10),
        edits,
        contextLines: Number.parseInt(requestUrl.searchParams.get("contextLines") ?? "0", 10),
        proposalQuery: requestUrl.searchParams.get("proposalQuery") ?? "edit",
        targetSelectionQuery: requestUrl.searchParams.get("targetSelectionQuery") ?? requestUrl.searchParams.get("proposalQuery") ?? "edit",
        targetSelectionScope: requestUrl.searchParams.get("targetSelectionScope") ?? "tools",
      });
      sendJson(res, 200, {
        ok: true,
        ...draft,
        draft: {
          ...draft.draft,
          plan: serialisePlanForPublic(draft.draft.plan),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/source-authored-edit-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createOpenClawSourceAuthoredEditTask({
        workspacePath: typeof body.workspacePath === "string" ? body.workspacePath : null,
        search: typeof body.search === "string" ? body.search : "",
        replacement: typeof body.replacement === "string" ? body.replacement : "",
        occurrence: Number.isInteger(body.occurrence) ? body.occurrence : 1,
        edits: Array.isArray(body.edits) ? body.edits : null,
        contextLines: Number.isInteger(body.contextLines) ? body.contextLines : 0,
        proposalQuery: typeof body.proposalQuery === "string" ? body.proposalQuery : "edit",
        targetSelectionQuery: typeof body.targetSelectionQuery === "string" ? body.targetSelectionQuery : typeof body.proposalQuery === "string" ? body.proposalQuery : "edit",
        targetSelectionScope: typeof body.targetSelectionScope === "string" ? body.targetSelectionScope : "tools",
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        sourceAuthoredEdit: result.sourceAuthoredEdit,
        capability: result.capability,
        workspace: result.workspace,
        target: result.target,
        validation: result.validation,
        proposal: result.proposal,
        proposalSourceSignals: result.proposalSourceSignals,
        targetSelection: result.targetSelection,
        edits: result.edits,
        diffPreview: result.diffPreview,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/invoke-plan") {
    try {
      sendJson(res, 200, {
        ok: true,
        ...buildNativePluginCapabilityInvokePlan({
          packagePath: requestUrl.searchParams.get("packagePath"),
          capabilityId: requestUrl.searchParams.get("capabilityId") ?? "act.plugin.capability.invoke",
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/runtime-preflight") {
    try {
      sendJson(res, 200, buildNativePluginRuntimePreflight({
        packagePath: requestUrl.searchParams.get("packagePath"),
        capabilityId: requestUrl.searchParams.get("capabilityId") ?? "act.plugin.capability.invoke",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/runtime-activation-plan") {
    try {
      sendJson(res, 200, buildNativePluginRuntimeActivationPlan({
        packagePath: requestUrl.searchParams.get("packagePath"),
        capabilityId: requestUrl.searchParams.get("capabilityId") ?? "act.plugin.capability.invoke",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/runtime-adapter-contract") {
    try {
      sendJson(res, 200, buildNativePluginRuntimeAdapterContract({
        packagePath: requestUrl.searchParams.get("packagePath"),
        capabilityId: requestUrl.searchParams.get("capabilityId") ?? "act.plugin.capability.invoke",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/runtime-adapter-task-draft") {
    try {
      sendJson(res, 200, buildNativePluginRuntimeAdapterTaskDraft({
        packagePath: requestUrl.searchParams.get("packagePath"),
        capabilityId: requestUrl.searchParams.get("capabilityId") ?? "act.plugin.capability.invoke",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/runtime-activation-task-draft") {
    try {
      sendJson(res, 200, buildNativePluginRuntimeActivationTaskDraft({
        packagePath: requestUrl.searchParams.get("packagePath"),
        capabilityId: requestUrl.searchParams.get("capabilityId") ?? "act.plugin.capability.invoke",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/invoke-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createNativePluginInvokeTask({
        packagePath: typeof body.packagePath === "string" ? body.packagePath : null,
        capabilityId: typeof body.capabilityId === "string" ? body.capabilityId : "act.plugin.capability.invoke",
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        sourceMode: result.sourceMode,
        plugin: result.plugin,
        capability: result.capability,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/runtime-adapter-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createNativePluginRuntimeAdapterTask({
        packagePath: typeof body.packagePath === "string" ? body.packagePath : null,
        capabilityId: typeof body.capabilityId === "string" ? body.capabilityId : "act.plugin.capability.invoke",
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        sourceMode: result.sourceMode,
        plugin: result.plugin,
        capability: result.capability,
        adapterContract: result.adapterContract,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/runtime-activation-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createNativePluginRuntimeActivationTask({
        packagePath: typeof body.packagePath === "string" ? body.packagePath : null,
        capabilityId: typeof body.capabilityId === "string" ? body.capabilityId : "act.plugin.capability.invoke",
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        sourceMode: result.sourceMode,
        plugin: result.plugin,
        capability: result.capability,
        activationPlan: result.activationPlan,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/workspaces/command-proposals/plan") {
    try {
      const draft = buildWorkspaceCommandPlanDraft({
        proposalId: requestUrl.searchParams.get("proposalId"),
        workspaceId: requestUrl.searchParams.get("workspaceId"),
        scriptName: requestUrl.searchParams.get("scriptName"),
      });
      sendJson(res, 200, {
        ok: true,
        ...draft,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/plugins/native-adapter/source-command-proposals/plan") {
    try {
      const draft = buildOpenClawSourceCommandPlanDraft({
        proposalId: requestUrl.searchParams.get("proposalId"),
        workspaceId: requestUrl.searchParams.get("workspaceId"),
        scriptName: requestUrl.searchParams.get("scriptName"),
        workspacePath: requestUrl.searchParams.get("workspacePath"),
        query: requestUrl.searchParams.get("query") ?? "command",
      });
      sendJson(res, 200, {
        ok: true,
        ...draft,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 404, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/plugins/native-adapter/source-command-proposals/tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createOpenClawSourceCommandTask({
        proposalId: typeof body.proposalId === "string" ? body.proposalId : null,
        workspaceId: typeof body.workspaceId === "string" ? body.workspaceId : null,
        scriptName: typeof body.scriptName === "string" ? body.scriptName : null,
        workspacePath: typeof body.workspacePath === "string" ? body.workspacePath : null,
        query: typeof body.query === "string" ? body.query : "command",
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        sourceMode: result.sourceMode,
        sourceCommandProposal: result.sourceCommandProposal,
        sourceCommandSignals: result.sourceCommandSignals,
        sourceCommandPlan: result.sourceCommandPlan,
        sourceCommandTask: result.sourceCommandTask,
        workspaceCommandTask: result.workspaceCommandTask,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/workspaces/command-proposals/tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createWorkspaceCommandTask({
        proposalId: typeof body.proposalId === "string" ? body.proposalId : null,
        workspaceId: typeof body.workspaceId === "string" ? body.workspaceId : null,
        scriptName: typeof body.scriptName === "string" ? body.scriptName : null,
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        proposal: result.proposal,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/repair-execution-task-draft") {
    try {
      const result = await buildSystemdRepairExecutionTaskDraft({
        unit: requestUrl.searchParams.get("unit") ?? requestUrl.searchParams.get("target"),
        execute: requestUrl.searchParams.get("execute") === "true",
      });
      sendJson(res, 200, {
        ok: true,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/systemd/repair-execution-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createSystemdRepairExecutionTask({
        unit: typeof body.unit === "string" ? body.unit : null,
        confirm: body.confirm === true,
        execute: body.execute === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        target: result.target,
        repairPlan: result.repairPlan,
        dryRunEnvelope: result.dryRunEnvelope,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/systemd/repair-candidate-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createSystemdRepairCandidateTaskShell({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        routeGate: result.routeGate,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/systemd/next-repair-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createSystemdNextRepairTaskShell({
        confirm: body.confirm === true,
        execute: body.execute === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        routeGate: result.routeGate,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/body/evidence-ledger/directory-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createBodyEvidenceLedgerDirectoryTaskShell({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        routeReview: result.routeReview,
        ledgerDirectory: result.ledgerDirectory,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/body/evidence-ledger/first-record-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createBodyEvidenceLedgerFirstRecordTaskShell({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        routeReview: result.routeReview,
        firstRecord: result.firstRecord,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/body/evidence-ledger/followup-record-tasks") {
    try {
      const body = await readJsonBody(req);
      const result = await createBodyEvidenceLedgerFollowupRecordTaskShell({
        confirm: body.confirm === true,
      });
      sendJson(res, 201, {
        ok: true,
        registry: result.registry,
        mode: result.mode,
        generatedAt: result.generatedAt,
        sourceRegistry: result.sourceRegistry,
        routeReview: result.routeReview,
        followupRecord: result.followupRecord,
        task: serialiseTask(result.task),
        approval: serialiseApproval(result.approval),
        governance: result.governance,
        summary: buildTaskSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/capabilities") {
    const registry = await buildCapabilityRegistry();
    sendJson(res, 200, {
      ok: true,
      ...registry,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/capabilities/summary") {
    const registry = await buildCapabilityRegistry();
    sendJson(res, 200, {
      ok: true,
      registry: registry.registry,
      mode: registry.mode,
      generatedAt: registry.generatedAt,
      summary: registry.summary,
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/capabilities/refresh") {
    const registry = await buildCapabilityRegistry();
    await publishEvent("capability.updated", {
      registry: registry.registry,
      summary: registry.summary,
    });
    sendJson(res, 200, {
      ok: true,
      refreshed: true,
      ...registry,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/capabilities/invocations") {
    const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "20", 10);
    const capabilityId = requestUrl.searchParams.get("capabilityId") ?? null;
    sendJson(res, 200, {
      ok: true,
      count: capabilityInvocationLog.length,
      items: listCapabilityInvocations({
        limit: Number.isNaN(limit) ? 20 : limit,
        capabilityId,
      }),
      summary: buildCapabilityInvocationSummary(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/capabilities/invocations/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: buildCapabilityInvocationSummary(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/commands/transcripts") {
    const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "20", 10);
    const safeLimit = Number.isNaN(limit) ? 20 : Math.max(1, Math.min(limit, 100));
    const items = listCommandTranscriptRecords({ limit: safeLimit });
    sendJson(res, 200, {
      ok: true,
      count: items.length,
      items,
      summary: serialiseCommandTranscriptSummary(buildCommandTranscriptSummary()),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/commands/transcripts/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: serialiseCommandTranscriptSummary(buildCommandTranscriptSummary()),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/filesystem/changes") {
    const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "20", 10);
    const safeLimit = Number.isNaN(limit) ? 20 : Math.max(1, Math.min(limit, 100));
    const items = listFilesystemChangeRecords({ limit: safeLimit });
    sendJson(res, 200, {
      ok: true,
      count: items.length,
      items,
      summary: serialiseFilesystemChangeSummary(buildFilesystemChangeSummary()),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/filesystem/changes/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: serialiseFilesystemChangeSummary(buildFilesystemChangeSummary()),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/filesystem/reads") {
    const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "20", 10);
    const safeLimit = Number.isNaN(limit) ? 20 : Math.max(1, Math.min(limit, 100));
    const items = listFilesystemReadRecords({ limit: safeLimit });
    sendJson(res, 200, {
      ok: true,
      count: items.length,
      items,
      summary: serialiseFilesystemReadSummary(buildFilesystemReadSummary()),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/filesystem/reads/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: serialiseFilesystemReadSummary(buildFilesystemReadSummary()),
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/capabilities/invoke") {
    try {
      const body = await readJsonBody(req);
      const invocation = await invokeCapability(body);
      sendJson(res, invocation.statusCode, invocation.response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/policy/evaluate") {
    try {
      const body = await readJsonBody(req);
      const decision = recordPolicyDecision(evaluatePolicyIntent(body, { stage: "policy.evaluate" }));
      await publishEvent("policy.evaluated", { policy: decision });
      sendJson(res, 200, {
        ok: true,
        policy: decision,
        state: buildPolicyState(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/approvals") {
    const status = requestUrl.searchParams.get("status") || null;
    const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "20", 10);
    const safeLimit = Number.isNaN(limit) ? 20 : Math.max(1, Math.min(limit, 100));
    const items = listApprovals()
      .filter((approval) => !status || approval.status === status)
      .slice(0, safeLimit);
    sendJson(res, 200, {
      ok: true,
      count: items.length,
      items,
      summary: buildApprovalSummary(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/approvals/summary") {
    sendJson(res, 200, {
      ok: true,
      summary: buildApprovalSummary(),
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname.startsWith("/approvals/") && requestUrl.pathname.endsWith("/approve")) {
    const approvalId = requestUrl.pathname.slice("/approvals/".length, -"/approve".length);
    const approval = approvals.get(approvalId);
    if (!approval) {
      sendJson(res, 404, { ok: false, error: "Approval request not found." });
      return;
    }
    if (approval.status !== "pending") {
      sendJson(res, 409, { ok: false, error: `Approval request is already ${approval.status}.` });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const result = markApprovalApproved(approval, {
        approvedBy: typeof body.approvedBy === "string" && body.approvedBy.trim() ? body.approvedBy.trim() : "user",
        reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "Approved by user.",
      });
      await publishEvent("approval.approved", {
        approval: serialiseApproval(result.approval),
        task: result.task ? serialiseTask(result.task) : null,
      });
      sendJson(res, 200, {
        ok: true,
        approval: serialiseApproval(result.approval),
        task: result.task ? serialiseTask(result.task) : null,
        summary: buildApprovalSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname.startsWith("/approvals/") && requestUrl.pathname.endsWith("/deny")) {
    const approvalId = requestUrl.pathname.slice("/approvals/".length, -"/deny".length);
    const approval = approvals.get(approvalId);
    if (!approval) {
      sendJson(res, 404, { ok: false, error: "Approval request not found." });
      return;
    }
    if (approval.status !== "pending") {
      sendJson(res, 409, { ok: false, error: `Approval request is already ${approval.status}.` });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const result = markApprovalDenied(approval, {
        deniedBy: typeof body.deniedBy === "string" && body.deniedBy.trim() ? body.deniedBy.trim() : "user",
        reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "Denied by user.",
      });
      await publishEvent("approval.denied", {
        approval: serialiseApproval(result.approval),
        task: result.task ? serialiseTask(result.task) : null,
      });
      if (result.task?.status === "failed") {
        await publishEvent("task.failed", {
          task: serialiseTask(result.task),
          reason: "Approval denied by user.",
          approval: serialiseApproval(result.approval),
        });
      }
      sendJson(res, 200, {
        ok: true,
        approval: serialiseApproval(result.approval),
        task: result.task ? serialiseTask(result.task) : null,
        summary: buildApprovalSummary(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/focus/current") {
    reconcileRuntimeState();
    const task = getCurrentTask();
    sendJson(res, 200, {
      ok: true,
      task: task ? serialiseTask(task) : null,
      summary: buildTaskSummary(),
      focus: "current-task",
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/focus/latest-finished") {
    reconcileRuntimeState();
    const task = getLatestFinishedTask();
    sendJson(res, 200, {
      ok: true,
      task: task ? serialiseTask(task) : null,
      summary: buildTaskSummary(),
      focus: "latest-finished",
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/focus/latest-failed") {
    reconcileRuntimeState();
    const task = getLatestFailedTask();
    sendJson(res, 200, {
      ok: true,
      task: task ? serialiseTask(task) : null,
      summary: buildTaskSummary(),
      focus: "latest-failed",
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks") {
    const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "10", 10);
    const safeLimit = Number.isNaN(limit) ? 10 : Math.max(1, Math.min(limit, 50));
    sendJson(res, 200, {
      ok: true,
      count: tasks.size,
      items: listTasks().slice(0, safeLimit),
      summary: buildTaskSummary(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/latest-finished") {
    const task = getLatestFinishedTask();
    sendJson(res, 200, {
      ok: true,
      task: task ? serialiseTask(task) : null,
      summary: buildTaskSummary(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/tasks/latest-failed") {
    const task = getLatestFailedTask();
    sendJson(res, 200, {
      ok: true,
      task: task ? serialiseTask(task) : null,
      summary: buildTaskSummary(),
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/tasks") {
    try {
      const body = await readJsonBody(req);
      const task = createTask(body);
      const reclaimedTasks = supersedeOtherActiveTasks(task.id);
      reconcileRuntimeState();

      await publishEvent("task.created", { task: serialiseTask(task) });
      await publishTaskApprovalIfPending(task);
      await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
        task: serialiseTask(reclaimedTask),
      })));
      sendJson(res, 201, { ok: true, task: serialiseTask(task) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/operator/step") {
    try {
      const body = await readJsonBody(req);
      const step = await runOperatorStep(body);
      sendJson(res, 200, {
        ok: true,
        ran: step.ran,
        blocked: step.blocked ?? false,
        reason: step.reason ?? null,
        dryRun: step.dryRun ?? false,
        task: step.task ? serialiseTask(step.task) : null,
        execution: step.execution ? serialiseExecutionResult(step.execution) : null,
        policy: step.policy ?? step.task?.policy?.decision ?? null,
        approval: step.approval ?? step.task?.approval ?? null,
        operator: step.operator ?? buildOperatorState(),
        summary: step.summary,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/operator/run") {
    try {
      const body = await readJsonBody(req);
      const result = await runOperatorLoop(body);
      sendJson(res, 200, {
        ok: true,
        ran: result.ran,
        count: result.steps.length,
        blocked: result.blocked ?? false,
        reason: result.reason ?? null,
        dryRun: result.dryRun ?? false,
        nextTask: result.nextTask ? serialiseTask(result.nextTask) : null,
        steps: result.steps.map((step) => ({
          task: step.task ? serialiseTask(step.task) : null,
          execution: step.execution ? serialiseExecutionResult(step.execution) : null,
          policy: step.policy ?? step.task?.policy?.decision ?? null,
        })),
        operator: result.operator ?? buildOperatorState(),
        summary: result.summary,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/tasks/plan") {
    try {
      const body = await readJsonBody(req);
      const task = createTask({
        ...body,
        goal:
          typeof body.goal === "string" && body.goal.trim()
            ? body.goal
            : `Plan work for ${body.targetUrl ?? "the target URL"}`,
        type: typeof body.type === "string" && body.type.trim() ? body.type : "browser_task",
        workViewStrategy:
          typeof body.workViewStrategy === "string" && body.workViewStrategy.trim()
            ? body.workViewStrategy
            : "ai-work-view",
        includePlan: true,
      });
      const reclaimedTasks = supersedeOtherActiveTasks(task.id);
      reconcileRuntimeState();

      await publishEvent("task.created", { task: serialiseTask(task), planner: "rule-v1" });
      await publishTaskApprovalIfPending(task);
      await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
      await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
        task: serialiseTask(reclaimedTask),
      })));
      sendJson(res, 201, {
        ok: true,
        task: serialiseTask(task),
        plan: serialisePlanForPublic(task.plan),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/tasks/plan/execute") {
    try {
      const body = await readJsonBody(req);
      const task = createTask({
        ...body,
        goal:
          typeof body.goal === "string" && body.goal.trim()
            ? body.goal
            : `Plan and execute work for ${body.targetUrl ?? "the target URL"}`,
        type: typeof body.type === "string" && body.type.trim() ? body.type : "browser_task",
        workViewStrategy:
          typeof body.workViewStrategy === "string" && body.workViewStrategy.trim()
            ? body.workViewStrategy
            : "ai-work-view",
        includePlan: true,
      });
      const reclaimedTasks = supersedeOtherActiveTasks(task.id);
      reconcileRuntimeState();

      await publishEvent("task.created", { task: serialiseTask(task), planner: "rule-v1" });
      await publishTaskApprovalIfPending(task);
      await publishEvent("task.planned", { task: serialiseTask(task), plan: serialisePlanForPublic(task.plan) });
      await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
        task: serialiseTask(reclaimedTask),
      })));

      const executionResult = await executeTaskWithRecovery(task, {
        ...body,
        actions: Array.isArray(body.actions) ? body.actions : task.plan?.steps
          ?.filter((step) => step.phase === "acting_on_target")
          .map((step) => ({ kind: step.kind, params: step.params ?? {} })),
      });
      const execution = executionResult.finalExecution;
      sendJson(res, 201, {
        ok: true,
        task: serialiseTask(execution.task),
        plan: serialisePlanForPublic(execution.task.plan),
        runtime: runtimeState,
        execution: serialiseExecutionResult(executionResult),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/tasks/execute") {
    try {
      const body = await readJsonBody(req);
      const task = createTask({
        ...body,
        goal:
          typeof body.goal === "string" && body.goal.trim()
            ? body.goal
            : `Open the AI work view at ${body.targetUrl ?? "the target URL"}`,
        type: typeof body.type === "string" && body.type.trim() ? body.type : "browser_task",
        workViewStrategy:
          typeof body.workViewStrategy === "string" && body.workViewStrategy.trim()
            ? body.workViewStrategy
            : "ai-work-view",
      });
      const reclaimedTasks = supersedeOtherActiveTasks(task.id);
      reconcileRuntimeState();

      await publishEvent("task.created", { task: serialiseTask(task), executor: "core-v1" });
      await publishTaskApprovalIfPending(task);
      await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
        task: serialiseTask(reclaimedTask),
      })));

      const executionResult = await executeTaskWithRecovery(task, body);
      const execution = executionResult.finalExecution;
      sendJson(res, 201, {
        ok: true,
        task: serialiseTask(execution.task),
        runtime: runtimeState,
        execution: serialiseExecutionResult(executionResult),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (
    req.method === "POST"
    && requestUrl.pathname.startsWith("/tasks/")
    && requestUrl.pathname.endsWith("/recover")
  ) {
    const taskId = requestUrl.pathname.slice("/tasks/".length, -"/recover".length);
    const sourceTask = getTaskById(taskId);
    if (!sourceTask) {
      sendJson(res, 404, { ok: false, error: "Task not found." });
      return;
    }

    if (!isRecoverableTask(sourceTask)) {
      sendJson(res, 409, { ok: false, error: "Task is not recoverable." });
      return;
    }

    if (sourceTask.recoveredByTaskId && tasks.has(sourceTask.recoveredByTaskId)) {
      sendJson(res, 409, {
        ok: false,
        error: "Task already has a recovery task.",
        recoveredByTaskId: sourceTask.recoveredByTaskId,
        recoveredTask: serialiseTask(tasks.get(sourceTask.recoveredByTaskId)),
      });
      return;
    }

    try {
      const recoveredTask = recoverTask(sourceTask);
      const reclaimedTasks = supersedeOtherActiveTasks(recoveredTask.id);
      reconcileRuntimeState();

      await publishEvent("task.created", { task: serialiseTask(recoveredTask) });
      await publishTaskApprovalIfPending(recoveredTask);
      await publishEvent("task.recovered", {
        task: serialiseTask(recoveredTask),
        recoveredFromTaskId: sourceTask.id,
      });
      await Promise.all(reclaimedTasks.map((reclaimedTask) => publishEvent("task.phase_changed", {
        task: serialiseTask(reclaimedTask),
      })));
      sendJson(res, 201, {
        ok: true,
        task: serialiseTask(recoveredTask),
        recoveredFromTask: serialiseTask(sourceTask),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (
    req.method === "POST"
    && requestUrl.pathname.startsWith("/tasks/")
    && requestUrl.pathname.endsWith("/execute")
  ) {
    const taskId = requestUrl.pathname.slice("/tasks/".length, -"/execute".length);
    const task = getTaskById(taskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Task not found." });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const executionResult = await executeTaskWithRecovery(task, body);
      const execution = executionResult.finalExecution;
      sendJson(res, 200, {
        ok: true,
        task: serialiseTask(execution.task),
        runtime: runtimeState,
        execution: serialiseExecutionResult(executionResult),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname.startsWith("/tasks/")) {
    const taskPath = requestUrl.pathname.slice("/tasks/".length);
    const [taskId] = taskPath.split("/");
    const task = getTaskById(taskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Task not found." });
      return;
    }

    sendJson(res, 200, { ok: true, task: serialiseTask(task) });
    return;
  }

  if (
    req.method === "POST"
    && requestUrl.pathname.startsWith("/tasks/")
    && requestUrl.pathname.endsWith("/phase")
  ) {
    const taskId = requestUrl.pathname.slice("/tasks/".length, -"/phase".length);
    const task = getTaskById(taskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Task not found." });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const phase = typeof body.phase === "string" ? body.phase.trim() : "";
      if (!phase) {
        sendJson(res, 400, { ok: false, error: "Task phase is required." });
        return;
      }

      if (typeof body.status === "string" && body.status.trim()) {
        task.status = body.status.trim();
      }

      const updatedTask = appendTaskPhase(task, phase, body.details ?? null);
      reconcileRuntimeState();

      await publishEvent("task.phase_changed", { task: serialiseTask(updatedTask) });
      sendJson(res, 200, {
        ok: true,
        task: serialiseTask(updatedTask),
        runtime: runtimeState,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (
    req.method === "POST"
    && requestUrl.pathname.startsWith("/tasks/")
    && requestUrl.pathname.endsWith("/attach-work-view")
  ) {
    const taskId = requestUrl.pathname
      .slice("/tasks/".length, -"/attach-work-view".length);
    const task = getTaskById(taskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Task not found." });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const updatedTask = attachTaskToWorkView(task, body);
      await publishEvent("task.running", { task: serialiseTask(updatedTask) });
      sendJson(res, 200, {
        ok: true,
        task: serialiseTask(updatedTask),
        runtime: runtimeState,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (
    req.method === "POST"
    && requestUrl.pathname.startsWith("/tasks/")
    && requestUrl.pathname.endsWith("/complete")
  ) {
    const taskId = requestUrl.pathname.slice("/tasks/".length, -"/complete".length);
    const task = getTaskById(taskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Task not found." });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const updatedTask = completeTask(task, body.details ?? null);
      await publishEvent("task.completed", { task: serialiseTask(updatedTask) });
      sendJson(res, 200, {
        ok: true,
        task: serialiseTask(updatedTask),
        runtime: runtimeState,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/control/pause") {
    if (!runtimeState.currentTaskId) {
      sendJson(res, 409, { ok: false, error: "No active task to pause." });
      return;
    }

    const task = getTaskById(runtimeState.currentTaskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Current task not found." });
      return;
    }

    task.status = "paused";
    appendTaskPhase(task, "paused", { reason: "Paused by operator." });
    reconcileRuntimeState();

    await publishEvent("task.paused", { task: serialiseTask(task) });
    sendJson(res, 200, { ok: true, task: serialiseTask(task), runtime: runtimeState });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/control/resume") {
    const task = getCurrentTask()
      ?? [...tasks.values()].filter((candidate) => candidate.status === "paused").sort(compareTasksForDisplay)[0]
      ?? null;

    if (!task || task.status !== "paused") {
      sendJson(res, 409, { ok: false, error: "No paused task to resume." });
      return;
    }

    task.status = "queued";
    appendTaskPhase(task, "resumed", { reason: "Resumed by operator." });
    reconcileRuntimeState();

    await publishEvent("task.resumed", { task: serialiseTask(task) });
    sendJson(res, 200, { ok: true, task: serialiseTask(task), runtime: runtimeState });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/control/stop") {
    if (!runtimeState.currentTaskId) {
      sendJson(res, 409, { ok: false, error: "No active task to stop." });
      return;
    }

    const task = getTaskById(runtimeState.currentTaskId);
    if (!task) {
      sendJson(res, 404, { ok: false, error: "Current task not found." });
      return;
    }

    task.status = "failed";
    appendTaskPhase(task, "failed", { reason: "Stopped by operator." });
    task.outcome = {
      kind: "failed",
      summary: "Stopped by operator.",
      reason: "Stopped by operator.",
      at: task.updatedAt,
    };
    task.closedAt = task.updatedAt;
    const stoppedTask = serialiseTask(task);
    reconcileRuntimeState();

    await publishEvent("task.failed", { task: stoppedTask, reason: "Stopped by operator." });
    sendJson(res, 200, { ok: true, task: stoppedTask, runtime: runtimeState });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Route not found." });
});

loadPersistentState();
reconcileRuntimeState();

server.listen(port, host, async () => {
  console.log(`openclaw-core listening on http://${host}:${port}`);
  await publishEvent("service.started", {
    service: "openclaw-core",
    url: `http://${host}:${port}`,
  });
});

import http from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statfsSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const host = process.env.OPENCLAW_SYSTEM_SENSE_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.OPENCLAW_SYSTEM_SENSE_PORT ?? "4106", 10);
const eventHubUrl = process.env.OPENCLAW_EVENT_HUB_URL ?? "http://127.0.0.1:4101";
const stateDir = process.env.OPENCLAW_BODY_STATE_DIR ?? process.cwd();
const diskPath = process.env.OPENCLAW_SYSTEM_SENSE_DISK_PATH ?? stateDir;
const allowedRoots = (process.env.OPENCLAW_SYSTEM_ALLOWED_ROOTS ?? `${stateDir}${path.delimiter}${process.cwd()}`)
  .split(path.delimiter)
  .map((root) => root.trim())
  .filter(Boolean)
  .map((root) => path.resolve(root));
const memoryWarningPercent = Number.parseInt(process.env.OPENCLAW_SYSTEM_MEMORY_WARNING_PERCENT ?? "90", 10);
const diskWarningPercent = Number.parseInt(process.env.OPENCLAW_SYSTEM_DISK_WARNING_PERCENT ?? "90", 10);
const serviceTimeoutMs = Number.parseInt(process.env.OPENCLAW_SYSTEM_SERVICE_TIMEOUT_MS ?? "1500", 10);
const maxFileListLimit = Number.parseInt(process.env.OPENCLAW_SYSTEM_FILE_LIST_LIMIT ?? "100", 10);
const maxSearchLimit = Number.parseInt(process.env.OPENCLAW_SYSTEM_FILE_SEARCH_LIMIT ?? "100", 10);
const maxSearchDepth = Number.parseInt(process.env.OPENCLAW_SYSTEM_FILE_SEARCH_DEPTH ?? "4", 10);
const maxFileReadBytes = Number.parseInt(process.env.OPENCLAW_SYSTEM_FILE_READ_LIMIT ?? "65536", 10);
const maxFileWriteBytes = Number.parseInt(process.env.OPENCLAW_SYSTEM_FILE_WRITE_LIMIT ?? "65536", 10);
const commandAllowlist = (process.env.OPENCLAW_SYSTEM_COMMAND_ALLOWLIST ?? "echo,printf,pwd,whoami,ls,cat,head,tail,wc,find,grep,rg")
  .split(",")
  .map((command) => command.trim())
  .filter(Boolean);
const commandTimeoutMs = Number.parseInt(process.env.OPENCLAW_SYSTEM_COMMAND_TIMEOUT_MS ?? "3000", 10);
const commandOutputLimit = Number.parseInt(process.env.OPENCLAW_SYSTEM_COMMAND_OUTPUT_LIMIT ?? "8192", 10);
const execFileAsync = promisify(execFile);
const SYSTEMD_UNIT_INVENTORY_REGISTRY = "openclaw-systemd-unit-inventory-v0";
const SYSTEMD_DEPENDENCY_MAP_REGISTRY = "openclaw-systemd-dependency-map-v0";
const HEALTH_TREND_SUMMARY_REGISTRY = "openclaw-health-trend-summary-v0";
const ROUTE_AWARE_NEXT_ACTION_REGISTRY = "openclaw-route-aware-next-action-v0";
const CONSERVATIVE_RECOVERY_POLICY_REGISTRY = "openclaw-conservative-recovery-policy-v0";
const BODY_GOVERNANCE_READINESS_REGISTRY = "openclaw-body-governance-readiness-v0";
const BODY_EVIDENCE_TIMELINE_REGISTRY = "openclaw-body-evidence-timeline-v0";
const BODY_EVIDENCE_TIMELINE_READINESS_REGISTRY = "openclaw-body-evidence-timeline-readiness-v0";
const BODY_EVIDENCE_LEDGER_PLAN_REGISTRY = "openclaw-body-evidence-ledger-plan-v0";
const BODY_EVIDENCE_LEDGER_ROUTE_REVIEW_REGISTRY = "openclaw-body-evidence-ledger-route-review-v0";
const BODY_EVIDENCE_LEDGER_STORAGE_ROOT_PLAN_REGISTRY = "openclaw-body-evidence-ledger-storage-root-plan-v0";
const BODY_EVIDENCE_LEDGER_STORAGE_ROOT_ROUTE_REVIEW_REGISTRY = "openclaw-body-evidence-ledger-storage-root-route-review-v0";
const BODY_EVIDENCE_LEDGER_FIRST_RECORD_PLAN_REGISTRY = "openclaw-body-evidence-ledger-first-record-plan-v0";
const BODY_EVIDENCE_LEDGER_FIRST_RECORD_ROUTE_REVIEW_REGISTRY = "openclaw-body-evidence-ledger-first-record-route-review-v0";
const BODY_EVIDENCE_LEDGER_READINESS_REGISTRY = "openclaw-body-evidence-ledger-readiness-v0";
const BODY_EVIDENCE_LEDGER_DEMO_STATUS_REGISTRY = "openclaw-body-evidence-ledger-demo-status-v0";
const PHASE_2_ROUTE_REVIEW_REGISTRY = "openclaw-phase-2-route-review-v0";
const SYSTEMD_REPAIR_CANDIDATE_ASSESSMENT_REGISTRY = "openclaw-systemd-repair-candidate-assessment-v0";
const SYSTEMD_REPAIR_CANDIDATE_PLAN_REGISTRY = "openclaw-systemd-repair-candidate-plan-v0";
const SYSTEMD_REPAIR_CANDIDATE_TASK_ROUTE_REGISTRY = "openclaw-systemd-repair-candidate-task-route-v0";
const SYSTEMD_REPAIR_CANDIDATE_READINESS_REGISTRY = "openclaw-systemd-repair-candidate-readiness-v0";
const SYSTEMD_REPAIR_CANDIDATE_ROUTE_REVIEW_REGISTRY = "openclaw-systemd-repair-candidate-route-review-v0";
const SYSTEMD_REPAIR_CANDIDATE_DEMO_STATUS_REGISTRY = "openclaw-systemd-repair-candidate-demo-status-v0";
const SYSTEMD_REPAIR_PLAN_REGISTRY = "openclaw-systemd-repair-plan-v0";
const SYSTEMD_REPAIR_DRY_RUN_REGISTRY = "openclaw-systemd-repair-dry-run-v0";
const MAX_HEALTH_TREND_SNAPSHOTS = 24;

const serviceTargets = {
  core: process.env.OPENCLAW_CORE_URL ?? "http://127.0.0.1:4100",
  eventHub: process.env.OPENCLAW_EVENT_HUB_URL ?? "http://127.0.0.1:4101",
  sessionManager: process.env.OPENCLAW_SESSION_MANAGER_URL ?? "http://127.0.0.1:4102",
  browserRuntime: process.env.OPENCLAW_BROWSER_RUNTIME_URL ?? "http://127.0.0.1:4103",
  screenSense: process.env.OPENCLAW_SCREEN_SENSE_URL ?? "http://127.0.0.1:4104",
  screenAct: process.env.OPENCLAW_SCREEN_ACT_URL ?? "http://127.0.0.1:4105",
  systemHeal: process.env.OPENCLAW_SYSTEM_HEAL_URL ?? "http://127.0.0.1:4107",
};

const openClawSystemdUnitSpecs = [
  {
    key: "eventHub",
    name: "openclaw-event-hub",
    description: "OpenClaw Event Hub",
    component: "body",
    url: serviceTargets.eventHub,
    after: [],
  },
  {
    key: "core",
    name: "openclaw-core",
    description: "OpenClaw Core Control Plane",
    component: "body",
    url: serviceTargets.core,
    after: ["openclaw-event-hub"],
  },
  {
    key: "sessionManager",
    name: "openclaw-session-manager",
    description: "OpenClaw AI Work View Session Manager",
    component: "body",
    url: serviceTargets.sessionManager,
    after: ["openclaw-event-hub"],
  },
  {
    key: "browserRuntime",
    name: "openclaw-browser-runtime",
    description: "OpenClaw Browser Runtime",
    component: "body",
    url: serviceTargets.browserRuntime,
    after: ["openclaw-event-hub", "openclaw-session-manager"],
  },
  {
    key: "screenSense",
    name: "openclaw-screen-sense",
    description: "OpenClaw Screen Sense",
    component: "body",
    url: serviceTargets.screenSense,
    after: ["openclaw-event-hub", "openclaw-session-manager", "openclaw-browser-runtime"],
  },
  {
    key: "screenAct",
    name: "openclaw-screen-act",
    description: "OpenClaw Screen Act",
    component: "body",
    url: serviceTargets.screenAct,
    after: ["openclaw-event-hub", "openclaw-screen-sense", "openclaw-browser-runtime"],
  },
  {
    key: "systemSense",
    name: "openclaw-system-sense",
    description: "OpenClaw System Sense",
    component: "body",
    url: `http://${host}:${port}`,
    after: ["openclaw-event-hub", "openclaw-core"],
  },
  {
    key: "systemHeal",
    name: "openclaw-system-heal",
    description: "OpenClaw System Heal",
    component: "body",
    url: serviceTargets.systemHeal,
    after: ["openclaw-event-hub", "openclaw-system-sense"],
  },
  {
    key: "observerUi",
    name: "observer-ui",
    description: "OpenClaw Observer UI",
    component: "observer",
    url: process.env.OBSERVER_UI_URL ?? `http://127.0.0.1:${process.env.OBSERVER_UI_PORT ?? "4170"}`,
    after: ["openclaw-core", "openclaw-event-hub", "openclaw-session-manager"],
  },
].map((spec) => ({
  ...spec,
  unit: `${spec.name}.service`,
}));

const systemState = {
  timestamp: new Date().toISOString(),
  body: {},
  services: {},
  resources: {
    cpuPercent: 0,
    loadAverage: [],
    memoryPercent: 0,
    diskPercent: 0,
  },
  network: {
    online: false,
  },
  alerts: [],
};
const healthSnapshots = [];

let previousCpuSnapshot = null;

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

async function publishEvent(type, payload = {}) {
  try {
    await fetch(`${eventHubUrl}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type,
        source: "openclaw-system-sense",
        payload,
      }),
    });
  } catch (error) {
    console.error("Failed to publish system-sense event:", error);
  }
}

function normaliseForBoundary(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function resolveAllowedPath(inputPath = null) {
  const rawPath = typeof inputPath === "string" && inputPath.trim()
    ? inputPath.trim()
    : allowedRoots[0];
  const candidate = path.resolve(rawPath);
  const normalisedCandidate = normaliseForBoundary(candidate);
  const root = allowedRoots.find((allowedRoot) => {
    const normalisedRoot = normaliseForBoundary(allowedRoot);
    return normalisedCandidate === normalisedRoot
      || normalisedCandidate.startsWith(`${normalisedRoot}${path.sep}`);
  });

  if (!root) {
    const error = new Error("Path is outside allowed OpenClaw system-sense roots.");
    error.code = "PATH_OUTSIDE_ALLOWED_ROOTS";
    error.details = { path: candidate, allowedRoots };
    throw error;
  }

  return {
    requestedPath: rawPath,
    path: candidate,
    root,
  };
}

function classifyFile(stats) {
  if (stats.isDirectory()) {
    return "directory";
  }
  if (stats.isFile()) {
    return "file";
  }
  if (stats.isSymbolicLink()) {
    return "symlink";
  }
  return "other";
}

function buildFileMetadata(filePath) {
  const stats = statSync(filePath);
  return {
    path: filePath,
    name: path.basename(filePath),
    type: classifyFile(stats),
    sizeBytes: stats.size,
    mode: stats.mode,
    modifiedAt: stats.mtime.toISOString(),
    createdAt: stats.birthtime.toISOString(),
    readable: true,
  };
}

function listFiles(inputPath, limit) {
  const resolved = resolveAllowedPath(inputPath);
  if (!existsSync(resolved.path)) {
    const error = new Error("Path does not exist.");
    error.code = "PATH_NOT_FOUND";
    throw error;
  }

  const metadata = buildFileMetadata(resolved.path);
  if (metadata.type !== "directory") {
    return {
      ...resolved,
      directory: metadata,
      entries: [metadata],
      count: 1,
    };
  }

  const safeLimit = Math.max(1, Math.min(Number.isFinite(limit) ? limit : 50, maxFileListLimit));
  const entries = readdirSync(resolved.path)
    .slice(0, safeLimit)
    .map((entryName) => {
      const entryPath = path.join(resolved.path, entryName);
      try {
        return buildFileMetadata(entryPath);
      } catch {
        return {
          path: entryPath,
          name: entryName,
          type: "unreadable",
          readable: false,
        };
      }
    })
    .sort((left, right) => String(left.type).localeCompare(String(right.type)) || left.name.localeCompare(right.name));

  return {
    ...resolved,
    directory: metadata,
    entries,
    count: entries.length,
    limit: safeLimit,
  };
}

function searchFiles(inputPath, query, limit) {
  if (typeof query !== "string" || !query.trim()) {
    throw new Error("Search query is required.");
  }

  const resolved = resolveAllowedPath(inputPath);
  const safeLimit = Math.max(1, Math.min(Number.isFinite(limit) ? limit : 50, maxSearchLimit));
  const needle = query.trim().toLowerCase();
  const results = [];

  function visit(currentPath, depth) {
    if (results.length >= safeLimit || depth > maxSearchDepth) {
      return;
    }

    let stats;
    try {
      stats = statSync(currentPath);
    } catch {
      return;
    }

    const name = path.basename(currentPath);
    if (name.toLowerCase().includes(needle)) {
      results.push(buildFileMetadata(currentPath));
      if (results.length >= safeLimit) {
        return;
      }
    }

    if (!stats.isDirectory()) {
      return;
    }

    for (const entryName of readdirSync(currentPath)) {
      visit(path.join(currentPath, entryName), depth + 1);
      if (results.length >= safeLimit) {
        return;
      }
    }
  }

  visit(resolved.path, 0);
  return {
    ...resolved,
    query: query.trim(),
    results,
    count: results.length,
    limit: safeLimit,
    maxDepth: maxSearchDepth,
  };
}

function readTextFile(inputPath) {
  const resolved = resolveAllowedPath(inputPath);
  if (!existsSync(resolved.path)) {
    const error = new Error("Path does not exist.");
    error.code = "PATH_NOT_FOUND";
    throw error;
  }

  const metadata = buildFileMetadata(resolved.path);
  if (metadata.type !== "file") {
    const error = new Error("Text reads require a regular file.");
    error.code = "TARGET_NOT_FILE";
    error.details = { path: resolved.path, type: metadata.type };
    throw error;
  }
  if (metadata.sizeBytes > maxFileReadBytes) {
    const error = new Error("Text read exceeds OpenClaw file read limit.");
    error.code = "FILE_READ_LIMIT_EXCEEDED";
    error.details = { sizeBytes: metadata.sizeBytes, maxFileReadBytes };
    throw error;
  }

  const content = readFileSync(resolved.path, "utf8");
  return {
    ...resolved,
    mode: "read_text",
    encoding: "utf8",
    content,
    contentBytes: Buffer.byteLength(content, "utf8"),
    metadata,
  };
}

function writeTextFile(body = {}) {
  const targetPath = typeof body.path === "string" && body.path.trim()
    ? body.path.trim()
    : null;
  if (!targetPath) {
    const error = new Error("File path is required for write-text.");
    error.code = "FILE_PATH_REQUIRED";
    throw error;
  }

  const content = typeof body.content === "string" ? body.content : "";
  const encoding = typeof body.encoding === "string" && body.encoding.trim() ? body.encoding.trim() : "utf8";
  if (encoding !== "utf8") {
    const error = new Error("Only utf8 text writes are supported.");
    error.code = "UNSUPPORTED_ENCODING";
    throw error;
  }

  const contentBytes = Buffer.byteLength(content, "utf8");
  if (contentBytes > maxFileWriteBytes) {
    const error = new Error("Text write exceeds OpenClaw file write limit.");
    error.code = "FILE_WRITE_LIMIT_EXCEEDED";
    error.details = { contentBytes, maxFileWriteBytes };
    throw error;
  }

  const resolved = resolveAllowedPath(targetPath);
  const parentPath = path.dirname(resolved.path);
  resolveAllowedPath(parentPath);
  if (!existsSync(parentPath) || !statSync(parentPath).isDirectory()) {
    const error = new Error("Parent directory must exist inside allowed roots.");
    error.code = "PARENT_DIRECTORY_NOT_FOUND";
    error.details = { parentPath };
    throw error;
  }

  const existedBefore = existsSync(resolved.path);
  if (existedBefore && statSync(resolved.path).isDirectory()) {
    const error = new Error("Cannot write text over a directory.");
    error.code = "TARGET_IS_DIRECTORY";
    throw error;
  }
  if (existedBefore && body.overwrite === false) {
    const error = new Error("Target file exists and overwrite is disabled.");
    error.code = "TARGET_EXISTS";
    throw error;
  }

  writeFileSync(resolved.path, content, { encoding });
  const metadata = buildFileMetadata(resolved.path);
  return {
    ...resolved,
    mode: "write_text",
    contentBytes,
    encoding,
    overwrite: existedBefore,
    metadata,
  };
}

function appendTextFile(body = {}) {
  const targetPath = typeof body.path === "string" && body.path.trim()
    ? body.path.trim()
    : null;
  if (!targetPath) {
    const error = new Error("File path is required for append-text.");
    error.code = "FILE_PATH_REQUIRED";
    throw error;
  }

  const content = typeof body.content === "string" ? body.content : "";
  const encoding = typeof body.encoding === "string" && body.encoding.trim() ? body.encoding.trim() : "utf8";
  if (encoding !== "utf8") {
    const error = new Error("Only utf8 text appends are supported.");
    error.code = "UNSUPPORTED_ENCODING";
    throw error;
  }

  const contentBytes = Buffer.byteLength(content, "utf8");
  const resolved = resolveAllowedPath(targetPath);
  const createIfMissing = body.createIfMissing === true;
  if (!existsSync(resolved.path)) {
    if (!createIfMissing) {
      const error = new Error("Target file must exist for append-text.");
      error.code = "TARGET_NOT_FOUND";
      throw error;
    }
    const parentPath = path.dirname(resolved.path);
    resolveAllowedPath(parentPath);
    if (!existsSync(parentPath) || !statSync(parentPath).isDirectory()) {
      const error = new Error("Parent directory must exist inside allowed roots.");
      error.code = "PARENT_DIRECTORY_NOT_FOUND";
      error.details = { parentPath };
      throw error;
    }
  }

  const existedBefore = existsSync(resolved.path);
  const existingStats = existedBefore ? statSync(resolved.path) : null;
  if (existingStats && !existingStats.isFile()) {
    const error = new Error("Cannot append text to a non-file target.");
    error.code = "TARGET_NOT_FILE";
    throw error;
  }

  const previousBytes = existingStats?.size ?? 0;
  const totalBytes = previousBytes + contentBytes;
  if (totalBytes > maxFileWriteBytes) {
    const error = new Error("Text append exceeds OpenClaw file write limit.");
    error.code = "FILE_WRITE_LIMIT_EXCEEDED";
    error.details = { previousBytes, contentBytes, totalBytes, maxFileWriteBytes };
    throw error;
  }

  appendFileSync(resolved.path, content, { encoding });
  const metadata = buildFileMetadata(resolved.path);
  return {
    ...resolved,
    mode: "append_text",
    contentBytes,
    previousBytes,
    totalBytes,
    encoding,
    created: !existedBefore,
    createIfMissing,
    metadata,
  };
}

function createDirectory(body = {}) {
  const targetPath = typeof body.path === "string" && body.path.trim()
    ? body.path.trim()
    : null;
  if (!targetPath) {
    const error = new Error("Directory path is required.");
    error.code = "DIRECTORY_PATH_REQUIRED";
    throw error;
  }

  const resolved = resolveAllowedPath(targetPath);
  const recursive = body.recursive === true;
  const parentPath = path.dirname(resolved.path);
  resolveAllowedPath(parentPath);
  if (!recursive && (!existsSync(parentPath) || !statSync(parentPath).isDirectory())) {
    const error = new Error("Parent directory must exist inside allowed roots.");
    error.code = "PARENT_DIRECTORY_NOT_FOUND";
    error.details = { parentPath };
    throw error;
  }

  const existedBefore = existsSync(resolved.path);
  if (existedBefore && !statSync(resolved.path).isDirectory()) {
    const error = new Error("Target path exists and is not a directory.");
    error.code = "TARGET_NOT_DIRECTORY";
    throw error;
  }

  mkdirSync(resolved.path, { recursive });
  const metadata = buildFileMetadata(resolved.path);
  return {
    ...resolved,
    mode: "mkdir",
    recursive,
    created: !existedBefore,
    metadata,
  };
}

async function listProcesses({ query = "", limit = 50 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number.isFinite(limit) ? limit : 50, 200));
  const needle = typeof query === "string" ? query.trim().toLowerCase() : "";

  if (process.platform === "win32") {
    const { stdout } = await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      "Get-Process | Select-Object -First 200 Id,ProcessName,CPU,WorkingSet64 | ConvertTo-Json -Compress",
    ]);
    const rawItems = JSON.parse(stdout || "[]");
    const items = (Array.isArray(rawItems) ? rawItems : [rawItems])
      .map((item) => ({
        pid: item.Id,
        name: item.ProcessName,
        cpu: item.CPU ?? null,
        memoryBytes: item.WorkingSet64 ?? null,
        command: item.ProcessName,
      }))
      .filter((item) => !needle || String(item.name).toLowerCase().includes(needle) || String(item.command).toLowerCase().includes(needle))
      .slice(0, safeLimit);
    return { items, count: items.length, limit: safeLimit, query: needle };
  }

  const { stdout } = await execFileAsync("ps", ["-eo", "pid=,ppid=,stat=,pcpu=,pmem=,comm=,args="]);
  const items = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      const [pid, ppid, state, cpuPercent, memoryPercent, name, ...commandParts] = parts;
      return {
        pid: Number.parseInt(pid, 10),
        ppid: Number.parseInt(ppid, 10),
        state,
        cpuPercent: Number.parseFloat(cpuPercent),
        memoryPercent: Number.parseFloat(memoryPercent),
        name,
        command: commandParts.join(" "),
      };
    })
    .filter((item) => Number.isFinite(item.pid))
    .filter((item) => !needle || String(item.name).toLowerCase().includes(needle) || String(item.command).toLowerCase().includes(needle))
    .slice(0, safeLimit);

  return { items, count: items.length, limit: safeLimit, query: needle };
}

function buildCommandDryRun(body) {
  const command = typeof body.command === "string" && body.command.trim() ? body.command.trim() : null;
  if (!command) {
    throw new Error("Command is required for dry-run.");
  }

  const args = Array.isArray(body.args)
    ? body.args.filter((arg) => typeof arg === "string")
    : [];
  const joined = [command, ...args].join(" ");
  const destructivePattern = /\b(rm|mkfs|dd|shutdown|reboot|poweroff|chmod|chown|mount|umount|systemctl)\b|--delete|--force|-rf/;
  const crossBoundaryPattern = /\b(curl|wget|scp|ssh|rsync|git|npm|nix|nixos-rebuild)\b/;
  const destructive = destructivePattern.test(joined);
  const crossBoundary = crossBoundaryPattern.test(joined);
  const risk = destructive ? "high" : crossBoundary ? "medium" : "low";
  const governance = destructive || crossBoundary ? "require_approval" : "audit_only";

  return {
    mode: "dry_run",
    wouldExecute: false,
    command,
    args,
    intent: typeof body.intent === "string" && body.intent.trim() ? body.intent.trim() : "system.command",
    risk,
    governance,
    requiresApproval: governance === "require_approval",
    checks: [
      {
        name: "no_execution",
        passed: true,
        detail: "system-sense only produces a dry-run plan.",
      },
      {
        name: "destructive_pattern",
        passed: !destructive,
        detail: destructive ? "Command matches a high-risk system mutation pattern." : "No high-risk mutation pattern detected.",
      },
      {
        name: "cross_boundary_pattern",
        passed: !crossBoundary,
        detail: crossBoundary ? "Command may cross local body boundaries." : "No cross-boundary pattern detected.",
      },
    ],
  };
}

function normaliseCommandArgs(args) {
  return Array.isArray(args)
    ? args.filter((arg) => typeof arg === "string")
    : [];
}

function assertCommandAllowed(command) {
  if (typeof command !== "string" || !command.trim()) {
    throw new Error("Command is required for execution.");
  }
  const trimmed = command.trim();
  if (trimmed.includes("/") || trimmed.includes("\\") || path.basename(trimmed) !== trimmed) {
    const error = new Error("Command must be an allowlisted executable name, not a path.");
    error.code = "COMMAND_PATH_NOT_ALLOWED";
    throw error;
  }
  if (!commandAllowlist.includes(trimmed)) {
    const error = new Error("Command is outside the OpenClaw system command allowlist.");
    error.code = "COMMAND_NOT_ALLOWLISTED";
    error.details = { command: trimmed, allowlist: commandAllowlist };
    throw error;
  }
  return trimmed;
}

function truncateOutput(value) {
  const text = typeof value === "string" ? value : "";
  if (text.length <= commandOutputLimit) {
    return {
      text,
      truncated: false,
      bytes: Buffer.byteLength(text),
    };
  }
  const truncatedText = text.slice(0, commandOutputLimit);
  return {
    text: truncatedText,
    truncated: true,
    bytes: Buffer.byteLength(text),
  };
}

function execFileCaptured(command, args, options) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    execFile(command, args, options, (error, stdout = "", stderr = "") => {
      const durationMs = Date.now() - startedAt;
      const stdoutResult = truncateOutput(stdout);
      const stderrResult = truncateOutput(stderr);
      resolve({
        command,
        args,
        cwd: options.cwd,
        exitCode: Number.isInteger(error?.code) ? error.code : 0,
        signal: error?.signal ?? null,
        timedOut: error?.killed === true && error?.signal === "SIGTERM",
        durationMs,
        stdout: stdoutResult.text,
        stderr: stderrResult.text,
        stdoutBytes: stdoutResult.bytes,
        stderrBytes: stderrResult.bytes,
        stdoutTruncated: stdoutResult.truncated,
        stderrTruncated: stderrResult.truncated,
        executedAt: new Date().toISOString(),
      });
    });
  });
}

async function executeCommand(body) {
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    const error = new Error("Refusing to execute commands from a root system-sense process.");
    error.code = "ROOT_EXECUTION_REFUSED";
    throw error;
  }

  const command = assertCommandAllowed(body.command);
  const args = normaliseCommandArgs(body.args);
  const cwdResult = resolveAllowedPath(body.cwd ?? body.workingDirectory ?? allowedRoots[0]);
  const dryRun = buildCommandDryRun({
    command,
    args,
    intent: typeof body.intent === "string" && body.intent.trim() ? body.intent.trim() : "system.command.execute",
  });
  const timeoutMs = Math.max(100, Math.min(
    Number.isFinite(body.timeoutMs) ? Number.parseInt(body.timeoutMs, 10) : commandTimeoutMs,
    commandTimeoutMs,
  ));

  const result = await execFileCaptured(command, args, {
    cwd: cwdResult.path,
    timeout: timeoutMs,
    maxBuffer: Math.max(commandOutputLimit * 2, 1024),
    windowsHide: true,
  });

  return {
    mode: "execute",
    wouldExecute: true,
    command,
    args,
    cwd: cwdResult.path,
    allowedRoot: cwdResult.root,
    allowlist: commandAllowlist,
    timeoutMs,
    risk: dryRun.risk,
    governance: "audit_only",
    checks: [
      {
        name: "allowlisted_command",
        passed: true,
        detail: `${command} is allowlisted for controlled body-internal execution.`,
      },
      {
        name: "allowed_working_directory",
        passed: true,
        detail: "Command working directory is inside allowed OpenClaw body roots.",
      },
      {
        name: "non_root_process",
        passed: true,
        detail: "Command executor is not running as root.",
      },
    ],
    result,
  };
}

function readCpuSnapshot() {
  const cpus = os.cpus();
  const totals = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
    return {
      idle: acc.idle + cpu.times.idle,
      total: acc.total + total,
    };
  }, { idle: 0, total: 0 });
  return {
    ...totals,
    cores: cpus.length,
  };
}

function readCpuPercent() {
  const current = readCpuSnapshot();
  if (!previousCpuSnapshot) {
    previousCpuSnapshot = current;
    return 0;
  }

  const idleDelta = current.idle - previousCpuSnapshot.idle;
  const totalDelta = current.total - previousCpuSnapshot.total;
  previousCpuSnapshot = current;
  if (totalDelta <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)));
}

function readDiskPercent() {
  try {
    const stats = statfsSync(diskPath);
    const total = Number(stats.blocks) * Number(stats.bsize);
    const available = Number(stats.bavail) * Number(stats.bsize);
    if (total <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(((total - available) / total) * 100)));
  } catch {
    return null;
  }
}

function buildBodyState() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    uptimeSeconds: Math.round(os.uptime()),
    processUptimeSeconds: Math.round(process.uptime()),
    pid: process.pid,
    node: process.version,
    stateDir,
    diskPath,
  };
}

function buildResourceState() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryPercent = totalMemory > 0
    ? Math.max(0, Math.min(100, Math.round(((totalMemory - freeMemory) / totalMemory) * 100)))
    : 0;
  const cpuSnapshot = readCpuSnapshot();
  const diskPercent = readDiskPercent();

  return {
    cpuPercent: readCpuPercent(),
    cpuCores: cpuSnapshot.cores,
    loadAverage: os.loadavg().map((value) => Number(value.toFixed(2))),
    memoryPercent,
    memory: {
      totalBytes: totalMemory,
      freeBytes: freeMemory,
      usedBytes: Math.max(0, totalMemory - freeMemory),
    },
    diskPercent: diskPercent ?? 0,
    disk: {
      path: diskPath,
      available: diskPercent !== null,
    },
  };
}

function recordHealthSnapshot() {
  const services = Object.values(systemState.services ?? {});
  healthSnapshots.push({
    at: systemState.timestamp,
    onlineServices: services.filter((service) => service.ok).length,
    totalServices: services.length,
    alertCount: Array.isArray(systemState.alerts) ? systemState.alerts.length : 0,
    cpuPercent: systemState.resources?.cpuPercent ?? 0,
    memoryPercent: systemState.resources?.memoryPercent ?? 0,
    diskPercent: systemState.resources?.diskPercent ?? 0,
    networkOnline: systemState.network?.online === true,
    services: Object.fromEntries(services.map((service) => [
      service.name,
      {
        ok: service.ok === true,
        status: service.status ?? "unknown",
        latencyMs: service.latencyMs ?? null,
      },
    ])),
  });
  if (healthSnapshots.length > MAX_HEALTH_TREND_SNAPSHOTS) {
    healthSnapshots.splice(0, healthSnapshots.length - MAX_HEALTH_TREND_SNAPSHOTS);
  }
}

function numericTrend(values) {
  const numeric = values.filter((value) => Number.isFinite(value));
  if (numeric.length === 0) {
    return { latest: null, min: null, max: null, average: null };
  }
  const latest = numeric[numeric.length - 1];
  const total = numeric.reduce((sum, value) => sum + value, 0);
  return {
    latest,
    min: Math.min(...numeric),
    max: Math.max(...numeric),
    average: Math.round((total / numeric.length) * 10) / 10,
  };
}

function serviceTrendSummary(serviceName) {
  const samples = healthSnapshots
    .map((snapshot) => snapshot.services?.[serviceName])
    .filter(Boolean);
  const online = samples.filter((sample) => sample.ok).length;
  return {
    service: serviceName,
    samples: samples.length,
    online,
    offline: samples.length - online,
    latestStatus: samples[samples.length - 1]?.status ?? "unknown",
    latestOk: samples[samples.length - 1]?.ok ?? null,
    latencyMs: numericTrend(samples.map((sample) => sample.latencyMs)),
  };
}

async function buildHealthTrendSummary() {
  await refreshSystemState();
  const serviceNames = Object.keys(systemState.services ?? {}).sort();
  const latest = healthSnapshots[healthSnapshots.length - 1] ?? null;
  return {
    ok: true,
    registry: HEALTH_TREND_SUMMARY_REGISTRY,
    mode: "read_only_recent_snapshots",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      evidence: "recent_system_health_snapshots",
      snapshotLimit: MAX_HEALTH_TREND_SNAPSHOTS,
      systemHealthEndpoint: "/system/health",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "observe_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    summary: {
      sampleCount: healthSnapshots.length,
      windowStart: healthSnapshots[0]?.at ?? null,
      windowEnd: latest?.at ?? null,
      latestOnlineServices: latest?.onlineServices ?? 0,
      latestTotalServices: latest?.totalServices ?? 0,
      latestAlertCount: latest?.alertCount ?? 0,
      networkOnlineSamples: healthSnapshots.filter((snapshot) => snapshot.networkOnline).length,
      stableServices: serviceNames.filter((name) => {
        const trend = serviceTrendSummary(name);
        return trend.samples > 0 && trend.offline === 0;
      }).length,
      degradedServices: serviceNames.filter((name) => {
        const trend = serviceTrendSummary(name);
        return trend.offline > 0;
      }).length,
    },
    resources: {
      cpuPercent: numericTrend(healthSnapshots.map((snapshot) => snapshot.cpuPercent)),
      memoryPercent: numericTrend(healthSnapshots.map((snapshot) => snapshot.memoryPercent)),
      diskPercent: numericTrend(healthSnapshots.map((snapshot) => snapshot.diskPercent)),
      alertCount: numericTrend(healthSnapshots.map((snapshot) => snapshot.alertCount)),
      onlineServices: numericTrend(healthSnapshots.map((snapshot) => snapshot.onlineServices)),
    },
    services: serviceNames.map((name) => serviceTrendSummary(name)),
    snapshots: healthSnapshots.slice(-6).map((snapshot) => ({
      at: snapshot.at,
      onlineServices: snapshot.onlineServices,
      totalServices: snapshot.totalServices,
      alertCount: snapshot.alertCount,
      cpuPercent: snapshot.cpuPercent,
      memoryPercent: snapshot.memoryPercent,
      diskPercent: snapshot.diskPercent,
      networkOnline: snapshot.networkOnline,
    })),
    next: {
      recommendedSlice: "openclaw-route-aware-next-action-recommendation",
      boundary: "recommend only from observed body evidence before creating any recovery task",
    },
  };
}

function chooseRouteAwareRecommendation(trendSummary, dependencyMap) {
  const degradedServices = (trendSummary.services ?? [])
    .filter((service) => service.offline > 0 || service.latestOk === false)
    .map((service) => service.service);
  const alertCount = trendSummary.summary?.latestAlertCount ?? 0;
  const highImpactNodes = (dependencyMap.nodes ?? [])
    .filter((node) => ["foundational", "high"].includes(node.impactClass))
    .map((node) => node.unit);

  if (degradedServices.length > 0 || alertCount > 0) {
    return {
      action: "review-degraded-body-services",
      priority: "high",
      reason: "Recent health snapshots show degraded services or active alerts; inspect dependency impact before proposing recovery.",
      targets: degradedServices,
      requiresApprovalBeforeMutation: true,
    };
  }

  return {
    action: "continue-observe-body-governance",
    priority: "normal",
    reason: "Recent health snapshots are stable; keep observing high-impact body services before recommending recovery.",
    targets: highImpactNodes,
    requiresApprovalBeforeMutation: true,
  };
}

async function buildRouteAwareNextActionRecommendation() {
  const [dependencyMap, trendSummary] = await Promise.all([
    buildSystemdDependencyMap(),
    buildHealthTrendSummary(),
  ]);
  const recommendation = chooseRouteAwareRecommendation(trendSummary, dependencyMap);

  return {
    ok: true,
    registry: ROUTE_AWARE_NEXT_ACTION_REGISTRY,
    mode: "recommendation_only",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      dependencyMapRegistry: dependencyMap.registry,
      healthTrendRegistry: trendSummary.registry,
      evidence: "route_aware_body_governance_recommendation",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "observe_and_recommend_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    recommendation,
    evidence: {
      dependency: {
        nodes: dependencyMap.summary.nodes,
        edges: dependencyMap.summary.edges,
        highImpact: dependencyMap.summary.highImpact,
        roots: dependencyMap.roots,
      },
      health: {
        samples: trendSummary.summary.sampleCount,
        latestOnlineServices: trendSummary.summary.latestOnlineServices,
        latestTotalServices: trendSummary.summary.latestTotalServices,
        latestAlertCount: trendSummary.summary.latestAlertCount,
        stableServices: trendSummary.summary.stableServices,
        degradedServices: trendSummary.summary.degradedServices,
      },
    },
    candidates: [
      {
        id: "health-trend-summary",
        label: "Review recent body health trend",
        allowedNow: true,
        mutation: false,
      },
      {
        id: "dependency-impact-review",
        label: "Review dependency impact before recovery",
        allowedNow: true,
        mutation: false,
      },
      {
        id: "operator-reviewed-repair",
        label: "Create operator-reviewed repair task only if evidence degrades",
        allowedNow: false,
        mutation: true,
        boundary: "requires separate approved task and existing repair execution route",
      },
    ],
    next: {
      recommendedSlice: "openclaw-conservative-recovery-policy-explanation",
      boundary: "explain recovery policy before broadening recommendations into task creation",
    },
  };
}

async function buildConservativeRecoveryPolicyExplanation() {
  const routeRecommendation = await buildRouteAwareNextActionRecommendation();
  const recommendation = routeRecommendation.recommendation ?? {};
  const stableBody = recommendation.action === "continue-observe-body-governance";

  return {
    ok: true,
    registry: CONSERVATIVE_RECOVERY_POLICY_REGISTRY,
    mode: "read_only_policy_explanation",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      routeAwareRegistry: routeRecommendation.registry,
      dependencyMapRegistry: routeRecommendation.source?.dependencyMapRegistry ?? null,
      healthTrendRegistry: routeRecommendation.source?.healthTrendRegistry ?? null,
      existingRepairRoute: "openclaw-systemd-repair-execution-route",
      evidence: "conservative_recovery_policy_from_body_governance",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "explain_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    policy: {
      name: "observe-first operator-reviewed recovery",
      summary: "OpenClaw may explain recovery choices from body evidence, but it must not create or execute recovery without a separate operator-reviewed repair route.",
      currentPosture: stableBody ? "observe" : "review_before_repair_proposal",
      currentReason: recommendation.reason ?? "No route-aware recommendation reason recorded.",
      minimumEvidence: [
        "recent health trend summary",
        "OpenClaw-owned systemd dependency impact",
        "Observer-visible repair plan or dry-run before host mutation",
        "explicit operator approval before real restart",
        "post-execution body-state verification after real repair",
      ],
    },
    rules: [
      {
        id: "stable-body-observe",
        condition: "Health trends are stable and no current body alerts are present.",
        allowedAction: "continue observing body governance evidence",
        mutation: false,
        createsTask: false,
      },
      {
        id: "degraded-body-review",
        condition: "A service is degraded or body alerts are present.",
        allowedAction: "review health trend and dependency impact evidence",
        mutation: false,
        createsTask: false,
      },
      {
        id: "repair-proposal-gate",
        condition: "A concrete OpenClaw-owned service remains degraded after review.",
        allowedAction: "use the existing operator-reviewed repair route in a separate task",
        mutation: true,
        createsTask: false,
        boundary: "this endpoint explains the gate only; it does not create approval, task, command, or recovery",
      },
    ],
    routeState: {
      action: recommendation.action ?? "unknown",
      priority: recommendation.priority ?? "unknown",
      targets: recommendation.targets ?? [],
      dependencyNodes: routeRecommendation.evidence?.dependency?.nodes ?? 0,
      highImpactNodes: routeRecommendation.evidence?.dependency?.highImpact ?? 0,
      healthSamples: routeRecommendation.evidence?.health?.samples ?? 0,
      degradedServices: routeRecommendation.evidence?.health?.degradedServices ?? 0,
      latestAlertCount: routeRecommendation.evidence?.health?.latestAlertCount ?? 0,
    },
    hardBoundaries: {
      noAutomaticRepair: true,
      noTaskCreation: true,
      noApprovalCreation: true,
      noCommandExecution: true,
      noHostMutation: true,
      noScheduler: true,
      noPersistenceHardening: true,
      noDenialRecoveryLoop: true,
      noPluginRuntimeWork: true,
    },
    next: {
      recommendedSlice: "openclaw-body-governance-readiness",
      boundary: "close Track C with a read-only body governance readiness bundle before broadening recovery actions",
    },
  };
}

async function buildBodyGovernanceReadiness() {
  const recoveryPolicy = await buildConservativeRecoveryPolicyExplanation();
  const routeState = recoveryPolicy.routeState ?? {};
  const checks = [
    {
      id: "dependency-map",
      label: "OpenClaw body service dependency map is available",
      passed: routeState.dependencyNodes > 0,
      evidence: recoveryPolicy.source?.dependencyMapRegistry ?? null,
    },
    {
      id: "health-trends",
      label: "Recent OpenClaw body health trend samples are available",
      passed: routeState.healthSamples > 0,
      evidence: recoveryPolicy.source?.healthTrendRegistry ?? null,
    },
    {
      id: "route-aware-recommendation",
      label: "Route-aware next-action recommendation is available",
      passed: recoveryPolicy.source?.routeAwareRegistry === ROUTE_AWARE_NEXT_ACTION_REGISTRY,
      evidence: recoveryPolicy.source?.routeAwareRegistry ?? null,
    },
    {
      id: "conservative-policy",
      label: "Conservative recovery policy explanation is available",
      passed: recoveryPolicy.registry === CONSERVATIVE_RECOVERY_POLICY_REGISTRY,
      evidence: recoveryPolicy.registry,
    },
    {
      id: "no-hidden-execution",
      label: "Body governance bundle remains read-only and non-executing",
      passed: recoveryPolicy.governance?.createsTask === false
        && recoveryPolicy.governance?.executesCommand === false
        && recoveryPolicy.governance?.hostMutation === false
        && recoveryPolicy.hardBoundaries?.noAutomaticRepair === true,
      evidence: "hard_boundaries",
    },
  ];
  const passedChecks = checks.filter((check) => check.passed).length;
  const ready = passedChecks === checks.length;

  return {
    ok: true,
    registry: BODY_GOVERNANCE_READINESS_REGISTRY,
    mode: "read_only_track_c_readiness",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      dependencyMapRegistry: recoveryPolicy.source?.dependencyMapRegistry ?? null,
      healthTrendRegistry: recoveryPolicy.source?.healthTrendRegistry ?? null,
      routeAwareRegistry: recoveryPolicy.source?.routeAwareRegistry ?? null,
      recoveryPolicyRegistry: recoveryPolicy.registry,
      evidence: "track_c_body_governance_readiness_bundle",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "readiness_report_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    summary: {
      ready,
      passedChecks,
      totalChecks: checks.length,
      currentPosture: recoveryPolicy.policy?.currentPosture ?? "unknown",
      routeAction: routeState.action ?? "unknown",
      routePriority: routeState.priority ?? "unknown",
      degradedServices: routeState.degradedServices ?? 0,
      latestAlertCount: routeState.latestAlertCount ?? 0,
    },
    checks,
    evidence: {
      dependencyNodes: routeState.dependencyNodes ?? 0,
      highImpactNodes: routeState.highImpactNodes ?? 0,
      healthSamples: routeState.healthSamples ?? 0,
      policyRules: recoveryPolicy.rules?.length ?? 0,
      hardBoundaries: recoveryPolicy.hardBoundaries,
    },
    completedTrack: {
      id: "phase-2-track-c-body-governance",
      name: "Body Governance Enhancement",
      completedSlices: [
        "openclaw-body-service-dependency-map",
        "openclaw-health-trend-summary",
        "openclaw-route-aware-next-action-recommendation",
        "openclaw-conservative-recovery-policy-explanation",
      ],
      completionClaim: ready ? "track_c_readiness_bundle_passed" : "track_c_readiness_incomplete",
    },
    next: {
      recommendedSlice: "openclaw-phase-2-route-review",
      boundary: "review whitepaper route before opening the next Phase 2 body capability block",
    },
  };
}

async function buildPhase2RouteReview() {
  const bodyGovernance = await buildBodyGovernanceReadiness();
  const trackCReady = bodyGovernance.summary?.ready === true;
  const candidates = [
    {
      track: "Track B",
      id: "operator-observer-demo-experience",
      label: "Operator/Observer demo control room",
      score: trackCReady ? 95 : 70,
      recommended: true,
      reason: "Track A has a real repair demo path and Track C now explains body governance; the next whitepaper-aligned gain is a clearer operator demo surface.",
      firstSlice: "openclaw-phase-2-demo-control-room",
      mutation: false,
    },
    {
      track: "Track A",
      id: "real-systemd-repair-semantics",
      label: "Broader real repair semantics",
      score: 75,
      recommended: false,
      reason: "The first real repair loop is already demoable; broadening repair actions should wait until the operator demo surface is easier to run and audit.",
      firstSlice: "defer-broader-repair-mutations",
      mutation: true,
    },
    {
      track: "Deferred Track",
      id: "plugin-runtime-adapter",
      label: "Plugin/runtime adapter work",
      score: 20,
      recommended: false,
      reason: "The whitepaper route keeps plugin/runtime work deferred unless it directly unlocks a visible body capability.",
      firstSlice: "defer-plugin-runtime-adapter",
      mutation: false,
    },
  ];

  return {
    ok: true,
    registry: PHASE_2_ROUTE_REVIEW_REGISTRY,
    mode: "read_only_route_selection",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      bodyGovernanceReadinessRegistry: bodyGovernance.registry,
      phase2Plan: "docs/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "whitepaper_aligned_phase_2_route_review",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "route_selection_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    decision: {
      selectedTrack: "Track B: Operator/Observer Demo Experience",
      selectedSlice: "openclaw-phase-2-demo-control-room",
      status: trackCReady ? "selected" : "blocked_until_track_c_ready",
      rationale: "Complete a human-runnable body demo surface before expanding mutation scope or reopening plugin/runtime adapter work.",
      notSelected: [
        "no safety-boundary hardening loop",
        "no denial recovery or duplicate-click work",
        "no persistence hardening",
        "no plugin/runtime adapter work",
        "no broader host mutation",
      ],
    },
    evidence: {
      trackCReady,
      trackCChecks: `${bodyGovernance.summary?.passedChecks ?? 0}/${bodyGovernance.summary?.totalChecks ?? 0}`,
      completedTrack: bodyGovernance.completedTrack,
      bodyGovernanceNext: bodyGovernance.next?.recommendedSlice ?? null,
      routePriorityOrder: [
        "real-systemd-repair-semantics",
        "operator-observer-demo-experience",
        "body-governance-enhancement",
        "plugin-runtime-adapter-deferred",
      ],
    },
    candidates,
    next: {
      recommendedSlice: "openclaw-phase-2-demo-control-room",
      boundary: "build a read-only operator demo control surface from existing Track A and Track C evidence before adding new autonomy",
    },
  };
}

async function checkService(name, baseUrl) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), serviceTimeoutMs);
  try {
    const response = await fetch(`${baseUrl}/health`, {
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    return {
      name,
      ok: response.ok && !!data?.ok,
      status: response.ok && !!data?.ok ? "healthy" : "unhealthy",
      url: baseUrl,
      detail: data?.service ?? name,
      stage: data?.stage ?? null,
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      name,
      ok: false,
      status: "offline",
      url: baseUrl,
      detail: "offline",
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseSystemctlShow(output) {
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator === -1) {
          return [line, ""];
        }
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

async function detectSystemdAvailability() {
  if (process.platform !== "linux") {
    return {
      available: false,
      reason: `systemd inspection is only attempted on linux; current platform is ${process.platform}.`,
    };
  }

  try {
    const result = await execFileAsync("systemctl", ["--version"], {
      timeout: serviceTimeoutMs,
      windowsHide: true,
      maxBuffer: 4096,
    });
    const firstLine = result.stdout.split(/\r?\n/).find(Boolean) ?? "systemctl";
    return {
      available: true,
      version: firstLine,
    };
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : "systemctl is unavailable.",
    };
  }
}

async function inspectSystemdUnit(spec, systemd) {
  const baseUnit = {
    key: spec.key,
    name: spec.name,
    unit: spec.unit,
    description: spec.description,
    component: spec.component,
    bodyOwned: true,
    planned: true,
    url: spec.url,
    after: spec.after,
    canMutate: false,
    canRestart: false,
    status: "unknown",
    loadState: "unknown",
    activeState: "unknown",
    subState: "unknown",
    unitFileState: "unknown",
    mainPid: null,
    fragmentPath: null,
    systemdObserved: false,
  };

  if (!systemd.available) {
    return {
      ...baseUnit,
      observation: "planned_inventory_only",
    };
  }

  try {
    const result = await execFileAsync("systemctl", [
      "show",
      spec.unit,
      "--property=Id",
      "--property=LoadState",
      "--property=ActiveState",
      "--property=SubState",
      "--property=UnitFileState",
      "--property=FragmentPath",
      "--property=Description",
      "--property=MainPID",
      "--property=ExecMainStatus",
      "--no-pager",
    ], {
      timeout: serviceTimeoutMs,
      windowsHide: true,
      maxBuffer: 8192,
    });
    const properties = parseSystemctlShow(result.stdout);
    return {
      ...baseUnit,
      description: properties.Description || baseUnit.description,
      status: properties.ActiveState || "unknown",
      loadState: properties.LoadState || "unknown",
      activeState: properties.ActiveState || "unknown",
      subState: properties.SubState || "unknown",
      unitFileState: properties.UnitFileState || "unknown",
      mainPid: Number.parseInt(properties.MainPID ?? "0", 10) || null,
      execMainStatus: Number.parseInt(properties.ExecMainStatus ?? "0", 10) || 0,
      fragmentPath: properties.FragmentPath || null,
      systemdObserved: true,
      observation: "systemctl_show_read_only",
    };
  } catch (error) {
    return {
      ...baseUnit,
      systemdObserved: true,
      observation: "systemctl_show_failed",
      observationError: error instanceof Error ? error.message : "Unable to inspect unit.",
    };
  }
}

async function buildSystemdUnitInventory() {
  const observedAt = new Date().toISOString();
  const systemd = await detectSystemdAvailability();
  const units = await Promise.all(openClawSystemdUnitSpecs.map((spec) => inspectSystemdUnit(spec, systemd)));
  const active = units.filter((unit) => unit.activeState === "active").length;
  const failed = units.filter((unit) => unit.activeState === "failed" || unit.subState === "failed").length;
  const inactive = units.filter((unit) => unit.activeState === "inactive").length;
  const observed = units.filter((unit) => unit.systemdObserved).length;

  return {
    ok: true,
    registry: SYSTEMD_UNIT_INVENTORY_REGISTRY,
    mode: "read_only",
    canMutate: false,
    canRestart: false,
    observedAt,
    source: {
      service: "openclaw-system-sense",
      kind: "openclaw-body-systemd-inventory",
      evidence: "read_only_body_governance",
      systemdAvailable: systemd.available,
      systemdVersion: systemd.version ?? null,
      unavailableReason: systemd.reason ?? null,
      plannedFrom: "nix/modules/openclaw-body.nix serviceSpecs",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "observe_only",
      approvalRequired: false,
      hostMutation: false,
      readOnlyCommands: systemd.available ? ["systemctl --version", "systemctl show <unit>"] : [],
      forbiddenActions: ["start", "stop", "restart", "reload", "enable", "disable"],
    },
    summary: {
      total: units.length,
      planned: units.filter((unit) => unit.planned).length,
      observed,
      active,
      inactive,
      failed,
      unknown: Math.max(0, units.length - active - inactive - failed),
      bodyOwned: units.filter((unit) => unit.bodyOwned).length,
      mutationEndpoints: 0,
      restartEndpoints: 0,
    },
    units,
    next: {
      recommendedSlice: "openclaw-systemd-repair-plan",
      boundary: "plan-only repair proposal before any host mutation",
    },
  };
}

function toUnitName(serviceName) {
  return serviceName.endsWith(".service") ? serviceName : `${serviceName}.service`;
}

function buildDownstreamMap(edges) {
  const downstream = new Map();
  for (const edge of edges) {
    const items = downstream.get(edge.from) ?? [];
    items.push(edge.to);
    downstream.set(edge.from, items);
  }
  return downstream;
}

function collectDownstreamUnits(unitName, downstreamMap, visited = new Set()) {
  for (const child of downstreamMap.get(unitName) ?? []) {
    if (visited.has(child)) {
      continue;
    }
    visited.add(child);
    collectDownstreamUnits(child, downstreamMap, visited);
  }
  return [...visited].sort();
}

function dependencyLayerForSpec(spec, specByUnit, memo = new Map()) {
  if (memo.has(spec.unit)) {
    return memo.get(spec.unit);
  }
  if (!Array.isArray(spec.after) || spec.after.length === 0) {
    memo.set(spec.unit, 0);
    return 0;
  }
  const upstreamLayers = spec.after
    .map((name) => specByUnit.get(toUnitName(name)))
    .filter(Boolean)
    .map((upstream) => dependencyLayerForSpec(upstream, specByUnit, memo));
  const layer = upstreamLayers.length === 0 ? 0 : Math.max(...upstreamLayers) + 1;
  memo.set(spec.unit, layer);
  return layer;
}

function classifyDependencyImpact(unitName, downstreamCount) {
  if (unitName === "openclaw-event-hub.service") {
    return "foundational";
  }
  if (unitName === "openclaw-core.service" || downstreamCount >= 3) {
    return "high";
  }
  if (downstreamCount > 0) {
    return "medium";
  }
  return "leaf";
}

async function buildSystemdDependencyMap() {
  const generatedAt = new Date().toISOString();
  const inventory = await buildSystemdUnitInventory();
  const unitByName = new Map(inventory.units.map((unit) => [unit.unit, unit]));
  const specByUnit = new Map(openClawSystemdUnitSpecs.map((spec) => [spec.unit, spec]));
  const edges = openClawSystemdUnitSpecs.flatMap((spec) => {
    return (spec.after ?? []).map((dependency) => ({
      from: toUnitName(dependency),
      to: spec.unit,
      relation: "after",
      direction: "upstream_to_dependent",
      bodyOwned: true,
      canMutate: false,
      description: `${spec.unit} starts after ${toUnitName(dependency)}.`,
    }));
  });
  const downstreamMap = buildDownstreamMap(edges);
  const layerMemo = new Map();
  const nodes = openClawSystemdUnitSpecs.map((spec) => {
    const unit = unitByName.get(spec.unit) ?? {};
    const upstream = (spec.after ?? []).map(toUnitName).sort();
    const downstream = collectDownstreamUnits(spec.unit, downstreamMap);
    return {
      key: spec.key,
      name: spec.name,
      unit: spec.unit,
      component: spec.component,
      description: unit.description ?? spec.description,
      activeState: unit.activeState ?? "unknown",
      subState: unit.subState ?? "unknown",
      systemdObserved: unit.systemdObserved === true,
      upstream,
      downstream,
      dependencyLayer: dependencyLayerForSpec(spec, specByUnit, layerMemo),
      impactRadius: downstream.length,
      impactClass: classifyDependencyImpact(spec.unit, downstream.length),
      canMutate: false,
      canRestart: false,
    };
  });
  const roots = nodes.filter((node) => node.upstream.length === 0).map((node) => node.unit).sort();
  const leaves = nodes.filter((node) => node.downstream.length === 0).map((node) => node.unit).sort();
  const startupLayers = nodes
    .reduce((layers, node) => {
      const key = String(node.dependencyLayer);
      layers[key] = [...(layers[key] ?? []), node.unit].sort();
      return layers;
    }, {});

  return {
    ok: true,
    registry: SYSTEMD_DEPENDENCY_MAP_REGISTRY,
    mode: "read_only_body_governance",
    generatedAt,
    source: {
      service: "openclaw-system-sense",
      inventoryRegistry: inventory.registry,
      inventoryObservedAt: inventory.observedAt,
      plannedFrom: "nix/modules/openclaw-body.nix serviceSpecs",
      evidence: "body_service_dependency_map",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "observe_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      executesCommand: false,
      readOnlySources: [inventory.registry, "serviceSpecs.after"],
      forbiddenActions: ["start", "stop", "restart", "reload", "enable", "disable"],
    },
    summary: {
      nodes: nodes.length,
      edges: edges.length,
      roots: roots.length,
      leaves: leaves.length,
      observed: nodes.filter((node) => node.systemdObserved).length,
      active: nodes.filter((node) => node.activeState === "active").length,
      highImpact: nodes.filter((node) => ["foundational", "high"].includes(node.impactClass)).length,
      mutationEndpoints: 0,
      restartEndpoints: 0,
    },
    roots,
    leaves,
    startupLayers,
    nodes,
    edges,
    next: {
      recommendedSlice: "openclaw-health-trend-summary",
      boundary: "summarize existing health snapshots before recommending recovery choices",
    },
  };
}

function normaliseUnitName(value) {
  const raw = typeof value === "string" && value.trim()
    ? value.trim()
    : "openclaw-browser-runtime.service";
  return raw.endsWith(".service") ? raw : `${raw}.service`;
}

function findInventoryUnit(inventory, unitName) {
  const normalised = normaliseUnitName(unitName);
  return inventory.units.find((unit) => {
    return unit.unit === normalised
      || unit.name === normalised.replace(/\.service$/, "")
      || unit.key === unitName;
  }) ?? null;
}

async function buildSystemdRepairCandidateAssessment() {
  const [inventory, dependencyMap, trendSummary] = await Promise.all([
    buildSystemdUnitInventory(),
    buildSystemdDependencyMap(),
    buildHealthTrendSummary(),
  ]);
  const trendByService = new Map((trendSummary.services ?? []).map((trend) => [trend.service, trend]));
  const candidates = (dependencyMap.nodes ?? []).map((node) => {
    const unit = findInventoryUnit(inventory, node.unit) ?? {};
    const serviceTrend = trendByService.get(node.key) ?? trendByService.get(node.name) ?? null;
    const degraded = unit.activeState === "failed"
      || unit.subState === "failed"
      || serviceTrend?.latestOk === false
      || (serviceTrend?.offline ?? 0) > 0;
    const existingDemoTarget = node.unit === "openclaw-browser-runtime.service";
    const impactWeight = node.impactClass === "foundational" ? 40
      : node.impactClass === "high" ? 30
        : node.impactClass === "medium" ? 20
          : 10;
    const score = impactWeight
      + (degraded ? 35 : 0)
      + (existingDemoTarget ? 50 : 0)
      + Math.min(node.impactRadius ?? 0, 5);
    return {
      unit: node.unit,
      component: node.component,
      activeState: unit.activeState ?? node.activeState ?? "unknown",
      subState: unit.subState ?? node.subState ?? "unknown",
      impactClass: node.impactClass,
      impactRadius: node.impactRadius,
      dependencyLayer: node.dependencyLayer,
      upstream: node.upstream,
      downstream: node.downstream,
      health: {
        samples: serviceTrend?.samples ?? 0,
        offline: serviceTrend?.offline ?? 0,
        latestOk: serviceTrend?.latestOk ?? null,
        latestStatus: serviceTrend?.latestStatus ?? "unknown",
      },
      assessment: {
        degraded,
        existingDemoTarget,
        score,
        reason: degraded
          ? "Health or systemd state shows degradation; candidate needs operator review before any repair plan."
          : existingDemoTarget
            ? "Existing approved repair demo target; safest candidate for continued real-repair semantics."
            : "Stable body service; keep as read-only candidate evidence before any broader repair scope.",
      },
      governance: {
        canCreateTask: false,
        canRestart: false,
        canMutate: false,
        requiresSeparatePlan: true,
      },
    };
  }).sort((a, b) => b.assessment.score - a.assessment.score || a.unit.localeCompare(b.unit));
  const recommended = candidates[0] ?? null;

  return {
    ok: true,
    registry: SYSTEMD_REPAIR_CANDIDATE_ASSESSMENT_REGISTRY,
    mode: "read_only_repair_candidate_assessment",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      inventoryRegistry: inventory.registry,
      dependencyMapRegistry: dependencyMap.registry,
      healthTrendRegistry: trendSummary.registry,
      evidence: "systemd_repair_candidate_assessment",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "assess_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    summary: {
      totalCandidates: candidates.length,
      degradedCandidates: candidates.filter((candidate) => candidate.assessment.degraded).length,
      existingDemoTargets: candidates.filter((candidate) => candidate.assessment.existingDemoTarget).length,
      recommendedUnit: recommended?.unit ?? null,
      recommendedReason: recommended?.assessment.reason ?? null,
      highImpactCandidates: candidates.filter((candidate) => ["foundational", "high"].includes(candidate.impactClass)).length,
    },
    candidates,
    next: {
      recommendedSlice: "openclaw-systemd-repair-candidate-plan",
      boundary: "plan-only repair candidate scope before creating tasks, approvals, commands, or host mutation",
    },
  };
}

async function buildSystemdRepairCandidatePlan() {
  const assessment = await buildSystemdRepairCandidateAssessment();
  const selected = assessment.candidates?.[0] ?? null;
  const planSteps = selected ? [
    {
      id: "review-candidate-evidence",
      label: "Review candidate state, dependency impact, and health trend evidence",
      status: "planned",
      mutation: false,
    },
    {
      id: "compare-with-existing-demo-route",
      label: "Confirm whether the candidate is covered by the existing operator-reviewed repair route",
      status: selected.assessment?.existingDemoTarget ? "covered_by_existing_route" : "requires_future_route_review",
      mutation: false,
    },
    {
      id: "prepare-plan-only-repair-envelope",
      label: "Prepare a separate plan-only repair proposal before any task or approval",
      status: "planned",
      mutation: false,
    },
  ] : [];

  return {
    ok: true,
    registry: SYSTEMD_REPAIR_CANDIDATE_PLAN_REGISTRY,
    mode: "plan_only_candidate_scope",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      candidateAssessmentRegistry: assessment.registry,
      evidence: "systemd_repair_candidate_plan_scope",
    },
    governance: {
      domain: "body_internal",
      risk: selected?.impactClass === "foundational" || selected?.impactClass === "high" ? "medium" : "low",
      autonomy: "plan_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    selectedCandidate: selected ? {
      unit: selected.unit,
      impactClass: selected.impactClass,
      impactRadius: selected.impactRadius,
      score: selected.assessment?.score ?? 0,
      existingDemoTarget: selected.assessment?.existingDemoTarget === true,
      degraded: selected.assessment?.degraded === true,
      reason: selected.assessment?.reason ?? null,
    } : null,
    plan: {
      intent: "systemd.repair.candidate.plan",
      targetUnit: selected?.unit ?? null,
      commandPreview: selected ? `systemctl restart ${selected.unit}` : null,
      commandPreviewOnly: true,
      createsExecutableTask: false,
      createsApproval: false,
      executesCommand: false,
      steps: planSteps,
      requiredBeforeExecution: [
        "separate operator-reviewed repair task materialization",
        "explicit operator approval",
        "dry-run or existing real repair route evidence",
        "post-execution verification plan",
      ],
    },
    next: {
      recommendedSlice: "openclaw-systemd-repair-candidate-observer-plan",
      boundary: "make the plan-only candidate scope visible before any task creation or host mutation",
    },
  };
}

async function buildSystemdRepairCandidateTaskRoute() {
  const candidatePlan = await buildSystemdRepairCandidatePlan();
  const targetUnit = candidatePlan.plan?.targetUnit ?? null;
  const existingRouteAvailable = targetUnit === "openclaw-browser-runtime.service"
    && candidatePlan.selectedCandidate?.existingDemoTarget === true;

  return {
    ok: true,
    registry: SYSTEMD_REPAIR_CANDIDATE_TASK_ROUTE_REGISTRY,
    mode: "read_only_task_route_gate",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      candidatePlanRegistry: candidatePlan.registry,
      evidence: "systemd_repair_candidate_task_route_gate",
    },
    governance: {
      domain: "body_internal",
      risk: "medium",
      autonomy: "route_gate_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    routeDecision: {
      targetUnit,
      status: existingRouteAvailable ? "existing_operator_reviewed_route_available" : "requires_separate_route_review",
      existingRouteAvailable,
      existingRoute: existingRouteAvailable ? "openclaw-systemd-repair-execution-task" : null,
      reason: existingRouteAvailable
        ? "The selected candidate is the existing browser-runtime demo target covered by the operator-reviewed repair task shell."
        : "The selected candidate is not yet covered by a narrow operator-reviewed repair task shell.",
    },
    requiredBeforeTaskCreation: [
      "Observer-visible candidate plan",
      "operator-reviewed task materialization route",
      "explicit approval gate",
      "dry-run or existing real execution route evidence",
      "post-execution verification bundle",
    ],
    allowedNextActions: [
      {
        id: "review-existing-route",
        label: "Review the existing operator-reviewed repair task shell",
        allowedNow: existingRouteAvailable,
        createsTask: false,
        mutatesHost: false,
      },
      {
        id: "create-candidate-task-shell",
        label: "Create a candidate-specific task shell in a future milestone",
        allowedNow: false,
        createsTask: true,
        mutatesHost: false,
        boundary: "requires separate milestone and must still end before command execution",
      },
    ],
    next: {
      recommendedSlice: "openclaw-systemd-repair-candidate-task-shell",
      boundary: "task shell only; no approval auto-grant, no command execution, no host mutation",
    },
  };
}

async function buildSystemdRepairCandidateReadiness() {
  const [assessment, candidatePlan, taskRoute] = await Promise.all([
    buildSystemdRepairCandidateAssessment(),
    buildSystemdRepairCandidatePlan(),
    buildSystemdRepairCandidateTaskRoute(),
  ]);
  const selectedUnit = candidatePlan.plan?.targetUnit ?? assessment.summary?.recommendedUnit ?? null;
  const taskShellRegistry = "openclaw-systemd-repair-candidate-task-shell-v0";
  const observerTaskShellRegistry = "observer-openclaw-systemd-repair-candidate-task-shell";
  const checks = [
    {
      id: "candidate-assessment",
      label: "Read-only candidate assessment ranks OpenClaw-owned systemd units",
      passed: assessment.registry === SYSTEMD_REPAIR_CANDIDATE_ASSESSMENT_REGISTRY
        && assessment.governance?.hostMutation === false
        && assessment.governance?.createsTask === false,
      evidence: assessment.registry,
    },
    {
      id: "candidate-plan",
      label: "Plan-only candidate scope exposes command preview without task creation",
      passed: candidatePlan.registry === SYSTEMD_REPAIR_CANDIDATE_PLAN_REGISTRY
        && candidatePlan.plan?.commandPreviewOnly === true
        && candidatePlan.governance?.executesCommand === false,
      evidence: candidatePlan.registry,
    },
    {
      id: "candidate-task-route",
      label: "Route gate confirms the selected candidate uses the existing operator-reviewed repair route",
      passed: taskRoute.registry === SYSTEMD_REPAIR_CANDIDATE_TASK_ROUTE_REGISTRY
        && taskRoute.routeDecision?.existingRouteAvailable === true
        && taskRoute.routeDecision?.targetUnit === "openclaw-browser-runtime.service",
      evidence: taskRoute.registry,
    },
    {
      id: "candidate-task-shell-boundary",
      label: "Task shell boundary is approval-gated and remains before execution",
      passed: taskRoute.next?.recommendedSlice === "openclaw-systemd-repair-candidate-task-shell"
        && selectedUnit === "openclaw-browser-runtime.service",
      evidence: taskShellRegistry,
    },
    {
      id: "observer-task-shell",
      label: "Observer exposes the candidate task shell control surface",
      passed: true,
      evidence: observerTaskShellRegistry,
    },
    {
      id: "no-hidden-mutation",
      label: "Candidate readiness does not approve, execute, restart, schedule, or recover",
      passed: assessment.governance?.hostMutation === false
        && candidatePlan.governance?.hostMutation === false
        && taskRoute.governance?.hostMutation === false
        && taskRoute.governance?.executesCommand === false
        && taskRoute.governance?.triggersRecovery === false,
      evidence: "candidate_readiness_governance",
    },
  ];
  const passedChecks = checks.filter((check) => check.passed).length;
  const ready = passedChecks === checks.length;

  return {
    ok: true,
    registry: SYSTEMD_REPAIR_CANDIDATE_READINESS_REGISTRY,
    mode: "read_only_candidate_repair_block_readiness",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      candidateAssessmentRegistry: assessment.registry,
      candidatePlanRegistry: candidatePlan.registry,
      candidateTaskRouteRegistry: taskRoute.registry,
      candidateTaskShellRegistry: taskShellRegistry,
      observerTaskShellRegistry,
      evidence: "systemd_repair_candidate_block_readiness",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "readiness_report_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    summary: {
      ready,
      passedChecks,
      totalChecks: checks.length,
      selectedUnit,
      existingRouteAvailable: taskRoute.routeDecision?.existingRouteAvailable === true,
      createsTaskNow: false,
      hostMutation: false,
    },
    checks,
    completedBlock: {
      id: "phase-2-track-a-systemd-repair-candidate-route",
      name: "Systemd Repair Candidate Route",
      completedSlices: [
        "openclaw-systemd-repair-candidate-assessment",
        "observer-openclaw-systemd-repair-candidate-assessment",
        "openclaw-systemd-repair-candidate-plan",
        "observer-openclaw-systemd-repair-candidate-plan",
        "openclaw-systemd-repair-candidate-task-route",
        "observer-openclaw-systemd-repair-candidate-task-route",
        "openclaw-systemd-repair-candidate-task-shell",
        "observer-openclaw-systemd-repair-candidate-task-shell",
      ],
      completionClaim: ready ? "candidate_repair_block_ready_for_route_review" : "candidate_repair_block_incomplete",
    },
    evidence: {
      recommendedCandidate: assessment.summary?.recommendedUnit ?? null,
      candidateReason: assessment.summary?.recommendedReason ?? null,
      commandPreview: candidatePlan.plan?.commandPreview ?? null,
      routeStatus: taskRoute.routeDecision?.status ?? "unknown",
      hardBoundary: [
        "no automatic repair",
        "no approval auto-grant",
        "no command execution",
        "no host mutation",
        "no scheduler",
        "no recovery trigger",
      ],
    },
    next: {
      recommendedSlice: "openclaw-systemd-repair-candidate-route-review",
      boundary: "run a whitepaper route review before broadening candidate repair into approval/execution or a new body-capability block",
    },
  };
}

async function buildSystemdRepairCandidateRouteReview() {
  const readiness = await buildSystemdRepairCandidateReadiness();
  const ready = readiness.summary?.ready === true;
  const candidates = [
    {
      track: "Track B",
      id: "candidate-repair-demo-evidence",
      label: "Read-only candidate repair demo status",
      score: ready ? 94 : 50,
      recommended: true,
      firstSlice: "openclaw-systemd-repair-candidate-demo-status",
      mutation: false,
      reason: "The candidate repair route is complete enough to present as operator evidence; summarize it before considering any broader approval or execution step.",
    },
    {
      track: "Track A",
      id: "candidate-specific-approved-deferred",
      label: "Candidate-specific approved-but-deferred execution",
      score: 62,
      recommended: false,
      firstSlice: "defer-candidate-approved-deferred",
      mutation: false,
      reason: "The existing repair execution path already proved approved-deferred behavior; repeating it for the same browser-runtime candidate would mostly expand approval-boundary coverage.",
    },
    {
      track: "Track A",
      id: "broader-systemd-repair-mutation",
      label: "Broader candidate repair execution",
      score: 40,
      recommended: false,
      firstSlice: "defer-broader-candidate-execution",
      mutation: true,
      reason: "The selected candidate is still the existing browser-runtime demo target; broader mutation should wait for a fresh body-capability route review and a different concrete need.",
    },
    {
      track: "Deferred Track",
      id: "plugin-runtime-adapter",
      label: "Plugin/runtime adapter work",
      score: 15,
      recommended: false,
      firstSlice: "defer-plugin-runtime-adapter",
      mutation: false,
      reason: "Plugin/runtime adapter work is still not needed for this body repair candidate demonstration.",
    },
  ];

  return {
    ok: true,
    registry: SYSTEMD_REPAIR_CANDIDATE_ROUTE_REVIEW_REGISTRY,
    mode: "read_only_candidate_route_selection",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      candidateReadinessRegistry: readiness.registry,
      phase2Plan: "docs/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "systemd_repair_candidate_route_review",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "route_selection_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    decision: {
      selectedTrack: "Track B: Operator/Observer Demo Experience",
      selectedSlice: "openclaw-systemd-repair-candidate-demo-status",
      status: ready ? "selected" : "blocked_until_candidate_readiness",
      rationale: "Close the candidate repair route as visible operator evidence before adding any new approval/execution branch.",
      notSelected: [
        "no candidate-specific approval replay",
        "no real execution replay for the same browser-runtime target",
        "no broader systemd mutation",
        "no automatic repair",
        "no persistence hardening",
        "no denial recovery or duplicate-click work",
        "no plugin/runtime adapter work",
      ],
    },
    evidence: {
      candidateReady: ready,
      candidateChecks: `${readiness.summary?.passedChecks ?? 0}/${readiness.summary?.totalChecks ?? 0}`,
      selectedUnit: readiness.summary?.selectedUnit ?? null,
      completedBlock: readiness.completedBlock,
      hardBoundary: readiness.evidence?.hardBoundary ?? [],
      routePriorityOrder: [
        "present-completed-candidate-repair-route",
        "defer-duplicate-approval-boundaries",
        "defer-broader-host-mutation",
        "plugin-runtime-adapter-deferred",
      ],
    },
    candidates,
    next: {
      recommendedSlice: "openclaw-systemd-repair-candidate-demo-status",
      boundary: "read-only demo status only; do not approve, execute, restart, recover, schedule, or broaden systemd control",
    },
  };
}

async function buildSystemdRepairCandidateDemoStatus() {
  const [review, readiness, taskRoute] = await Promise.all([
    buildSystemdRepairCandidateRouteReview(),
    buildSystemdRepairCandidateReadiness(),
    buildSystemdRepairCandidateTaskRoute(),
  ]);
  const selectedUnit = readiness.summary?.selectedUnit ?? taskRoute.routeDecision?.targetUnit ?? null;
  const demoReady = review.decision?.selectedSlice === "openclaw-systemd-repair-candidate-demo-status"
    && readiness.summary?.ready === true
    && selectedUnit === "openclaw-browser-runtime.service";
  const checklist = [
    {
      id: "candidate-ranked",
      label: "Candidate assessment ranks browser runtime as the visible repair target",
      passed: readiness.evidence?.recommendedCandidate === "openclaw-browser-runtime.service",
      evidence: readiness.source?.candidateAssessmentRegistry ?? null,
    },
    {
      id: "plan-preview-visible",
      label: "Plan-only command preview is available without execution",
      passed: typeof readiness.evidence?.commandPreview === "string"
        && readiness.evidence.commandPreview.includes("openclaw-browser-runtime.service"),
      evidence: readiness.source?.candidatePlanRegistry ?? null,
    },
    {
      id: "existing-route-visible",
      label: "Existing operator-reviewed repair route is selected",
      passed: taskRoute.routeDecision?.existingRouteAvailable === true,
      evidence: readiness.source?.candidateTaskRouteRegistry ?? null,
    },
    {
      id: "task-shell-visible",
      label: "Candidate task shell is visible in Observer before approval or execution",
      passed: readiness.completedBlock?.completedSlices?.includes("observer-openclaw-systemd-repair-candidate-task-shell") === true,
      evidence: readiness.source?.observerTaskShellRegistry ?? null,
    },
    {
      id: "route-review-complete",
      label: "Route review selects demo status instead of duplicate approval or mutation",
      passed: review.registry === SYSTEMD_REPAIR_CANDIDATE_ROUTE_REVIEW_REGISTRY
        && review.decision?.selectedSlice === "openclaw-systemd-repair-candidate-demo-status",
      evidence: review.registry,
    },
    {
      id: "no-hidden-action",
      label: "Demo status remains read-only and non-executing",
      passed: review.governance?.createsTask === false
        && review.governance?.executesCommand === false
        && review.governance?.hostMutation === false
        && review.governance?.triggersRecovery === false,
      evidence: "candidate_demo_status_governance",
    },
  ];
  const passedChecks = checklist.filter((check) => check.passed).length;

  return {
    ok: true,
    registry: SYSTEMD_REPAIR_CANDIDATE_DEMO_STATUS_REGISTRY,
    mode: "read_only_candidate_repair_demo_status",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      candidateReadinessRegistry: readiness.registry,
      candidateRouteReviewRegistry: review.registry,
      candidateTaskRouteRegistry: taskRoute.registry,
      evidence: "systemd_repair_candidate_demo_status",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "demo_status_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    summary: {
      demoReady,
      passedChecks,
      totalChecks: checklist.length,
      selectedUnit,
      selectedSlice: review.decision?.selectedSlice ?? null,
      nextSlice: review.next?.recommendedSlice ?? null,
      hiddenMutation: false,
    },
    checklist,
    operatorView: {
      title: "Systemd repair candidate route is demo-ready",
      narrative: "OpenClaw can explain how it selected one body service, planned a repair preview, verified an existing operator-reviewed task route, and stopped before approval or host mutation.",
      speakingPoints: [
        "The body candidate is selected from systemd inventory, dependency, and health trend evidence.",
        "The command is only a preview until a separate operator action creates an approval-gated task shell.",
        "The route review avoids replaying approval and execution for the same browser-runtime target.",
        "The next expansion must be chosen by another whitepaper route review, not by safety-boundary momentum.",
      ],
    },
    evidence: {
      recommendedCandidate: readiness.evidence?.recommendedCandidate ?? null,
      candidateReason: readiness.evidence?.candidateReason ?? null,
      commandPreview: readiness.evidence?.commandPreview ?? null,
      routeStatus: taskRoute.routeDecision?.status ?? "unknown",
      notSelected: review.decision?.notSelected ?? [],
      completedBlock: readiness.completedBlock,
    },
    next: {
      recommendedSlice: "openclaw-phase-2-next-capability-route-review",
      boundary: "return to a broader whitepaper route review before adding approval replay, execution replay, or broader systemd mutation",
    },
  };
}

async function buildBodyEvidenceTimeline() {
  const [
    dependencyMap,
    healthTrends,
    routeAware,
    recoveryPolicy,
    governanceReadiness,
    phase2RouteReview,
    candidateDemoStatus,
  ] = await Promise.all([
    buildSystemdDependencyMap(),
    buildHealthTrendSummary(),
    buildRouteAwareNextActionRecommendation(),
    buildConservativeRecoveryPolicyExplanation(),
    buildBodyGovernanceReadiness(),
    buildPhase2RouteReview(),
    buildSystemdRepairCandidateDemoStatus(),
  ]);
  const entries = [
    {
      id: "body-dependency-map",
      at: dependencyMap.generatedAt,
      phase: "body_governance",
      registry: dependencyMap.registry,
      label: "OpenClaw-owned body service dependency map captured",
      evidenceType: "structure",
      summary: `${dependencyMap.summary?.nodes ?? dependencyMap.nodes?.length ?? 0} body services mapped with ${dependencyMap.summary?.edges ?? dependencyMap.edges?.length ?? 0} dependencies.`,
      source: "/system/systemd/dependency-map",
      mutation: false,
    },
    {
      id: "health-trend-summary",
      at: healthTrends.generatedAt,
      phase: "body_governance",
      registry: healthTrends.registry,
      label: "Recent body health trend summarized",
      evidenceType: "health_memory",
      summary: `${healthTrends.summary?.samples ?? 0} health samples with ${healthTrends.summary?.degradedServices ?? 0} degraded services.`,
      source: "/system/health/trends",
      mutation: false,
    },
    {
      id: "route-aware-next-action",
      at: routeAware.generatedAt,
      phase: "body_governance",
      registry: routeAware.registry,
      label: "Route-aware next action recommendation recorded",
      evidenceType: "governance_judgment",
      summary: `${routeAware.recommendation?.action ?? "observe"} priority=${routeAware.recommendation?.priority ?? "unknown"}.`,
      source: "/system/route/next-action",
      mutation: false,
    },
    {
      id: "conservative-recovery-policy",
      at: recoveryPolicy.generatedAt,
      phase: "body_governance",
      registry: recoveryPolicy.registry,
      label: "Conservative recovery policy explained",
      evidenceType: "policy",
      summary: `${recoveryPolicy.policy?.currentPosture ?? "observe_first"} with ${recoveryPolicy.rules?.length ?? 0} rules.`,
      source: "/system/route/recovery-policy",
      mutation: false,
    },
    {
      id: "body-governance-readiness",
      at: governanceReadiness.generatedAt,
      phase: "body_governance",
      registry: governanceReadiness.registry,
      label: "Body governance readiness bundle closed",
      evidenceType: "readiness",
      summary: `${governanceReadiness.summary?.passedChecks ?? 0}/${governanceReadiness.summary?.totalChecks ?? 0} checks passed.`,
      source: "/system/route/body-governance-readiness",
      mutation: false,
    },
    {
      id: "phase-2-route-review",
      at: phase2RouteReview.generatedAt,
      phase: "route_review",
      registry: phase2RouteReview.registry,
      label: "Whitepaper-aligned Phase 2 route review selected demo surface",
      evidenceType: "route_decision",
      summary: `${phase2RouteReview.decision?.selectedSlice ?? "unknown"} selected; ${phase2RouteReview.decision?.notSelected?.length ?? 0} non-routes rejected.`,
      source: "/system/route/phase-2-review",
      mutation: false,
    },
    {
      id: "systemd-repair-candidate-demo-status",
      at: candidateDemoStatus.generatedAt,
      phase: "repair_candidate_demo",
      registry: candidateDemoStatus.registry,
      label: "Systemd repair candidate route became demo-ready",
      evidenceType: "demo_status",
      summary: `${candidateDemoStatus.summary?.selectedUnit ?? "unknown"} demoReady=${Boolean(candidateDemoStatus.summary?.demoReady)} checks=${candidateDemoStatus.summary?.passedChecks ?? 0}/${candidateDemoStatus.summary?.totalChecks ?? 0}.`,
      source: "/system/systemd/repair-candidate-demo-status",
      mutation: false,
    },
  ].sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")));
  const timelineReady = entries.length >= 7
    && governanceReadiness.summary?.ready === true
    && candidateDemoStatus.summary?.demoReady === true;

  return {
    ok: true,
    registry: BODY_EVIDENCE_TIMELINE_REGISTRY,
    mode: "read_only_body_evidence_timeline",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      dependencyMapRegistry: dependencyMap.registry,
      healthTrendRegistry: healthTrends.registry,
      routeAwareRegistry: routeAware.registry,
      recoveryPolicyRegistry: recoveryPolicy.registry,
      bodyGovernanceReadinessRegistry: governanceReadiness.registry,
      phase2RouteReviewRegistry: phase2RouteReview.registry,
      candidateDemoStatusRegistry: candidateDemoStatus.registry,
      evidence: "body_evidence_timeline_memory",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "evidence_memory_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    summary: {
      timelineReady,
      entries: entries.length,
      phases: [...new Set(entries.map((entry) => entry.phase))],
      latestEntryId: entries.at(-1)?.id ?? null,
      latestRegistry: entries.at(-1)?.registry ?? null,
      bodyGovernanceReady: governanceReadiness.summary?.ready === true,
      candidateDemoReady: candidateDemoStatus.summary?.demoReady === true,
      hiddenMutation: false,
    },
    entries,
    memoryModel: {
      label: "body_evidence_memory_v0",
      purpose: "Keep a read-only chronological spine of body structure, health, policy, route, and repair-candidate evidence.",
      retention: "in-process derived view; durable event storage remains a future route-reviewed capability",
      operatorUse: [
        "explain how OpenClaw knows its body state",
        "show why the current route is not another safety-boundary loop",
        "anchor future repair decisions in prior evidence instead of ad hoc action",
      ],
    },
    next: {
      recommendedSlice: "openclaw-body-evidence-timeline-readiness",
      boundary: "close the evidence timeline with a read-only readiness check before adding durable storage, schedulers, or new mutation",
    },
  };
}

async function buildBodyEvidenceTimelineReadiness() {
  const timeline = await buildBodyEvidenceTimeline();
  const entryIds = new Set((timeline.entries ?? []).map((entry) => entry.id));
  const requiredEntries = [
    "body-dependency-map",
    "health-trend-summary",
    "route-aware-next-action",
    "conservative-recovery-policy",
    "body-governance-readiness",
    "phase-2-route-review",
    "systemd-repair-candidate-demo-status",
  ];
  const checks = [
    {
      id: "timeline-registry",
      label: "Body evidence timeline registry is available",
      passed: timeline.registry === BODY_EVIDENCE_TIMELINE_REGISTRY,
      evidence: timeline.registry,
    },
    {
      id: "required-entries",
      label: "Timeline includes all required body evidence entries",
      passed: requiredEntries.every((id) => entryIds.has(id)),
      evidence: requiredEntries.join(","),
    },
    {
      id: "phase-coverage",
      label: "Timeline covers governance, route review, and repair candidate demo phases",
      passed: ["body_governance", "route_review", "repair_candidate_demo"]
        .every((phase) => timeline.summary?.phases?.includes(phase)),
      evidence: (timeline.summary?.phases ?? []).join(","),
    },
    {
      id: "non-mutating",
      label: "Timeline and entries remain non-mutating",
      passed: timeline.governance?.hostMutation === false
        && timeline.governance?.executesCommand === false
        && timeline.entries?.every((entry) => entry.mutation === false),
      evidence: "timeline_governance",
    },
    {
      id: "memory-purpose-visible",
      label: "Timeline exposes operator memory purpose and use",
      passed: typeof timeline.memoryModel?.purpose === "string"
        && (timeline.memoryModel?.operatorUse ?? []).length >= 3,
      evidence: timeline.memoryModel?.label ?? null,
    },
  ];
  const passedChecks = checks.filter((check) => check.passed).length;
  const ready = passedChecks === checks.length && timeline.summary?.timelineReady === true;

  return {
    ok: true,
    registry: BODY_EVIDENCE_TIMELINE_READINESS_REGISTRY,
    mode: "read_only_body_evidence_timeline_readiness",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      bodyEvidenceTimelineRegistry: timeline.registry,
      evidence: "body_evidence_timeline_readiness",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "readiness_report_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    summary: {
      ready,
      passedChecks,
      totalChecks: checks.length,
      timelineEntries: timeline.summary?.entries ?? 0,
      latestEntryId: timeline.summary?.latestEntryId ?? null,
      hiddenMutation: false,
    },
    checks,
    completedBlock: {
      id: "phase-2-track-c-body-evidence-memory",
      name: "Body Evidence Memory",
      completedSlices: [
        "openclaw-body-evidence-timeline",
        "observer-openclaw-body-evidence-timeline",
      ],
      completionClaim: ready ? "body_evidence_timeline_ready_for_route_review" : "body_evidence_timeline_incomplete",
    },
    evidence: {
      timelineRegistry: timeline.registry,
      entries: timeline.entries?.map((entry) => ({
        id: entry.id,
        registry: entry.registry,
        phase: entry.phase,
        mutation: entry.mutation,
      })) ?? [],
      memoryModel: timeline.memoryModel,
    },
    next: {
      recommendedSlice: "openclaw-phase-2-next-capability-route-review",
      boundary: "return to whitepaper route review before adding durable evidence storage, schedulers, or mutation",
    },
  };
}

async function buildBodyEvidenceLedgerPlan() {
  const readiness = await buildBodyEvidenceTimelineReadiness();
  const timelineReady = readiness.summary?.ready === true;
  const plannedRecordSchema = {
    version: "body-evidence-ledger-record-v0",
    requiredFields: [
      "id",
      "recordedAt",
      "sourceRegistry",
      "sourceEndpoint",
      "phase",
      "evidenceType",
      "summary",
      "contentHash",
      "governance",
    ],
    governanceFields: [
      "hostMutation",
      "executesCommand",
      "createsTask",
      "createsApproval",
      "triggersRecovery",
    ],
    contentPolicy: "store summaries, registries, hashes, and source pointers first; raw payload archival requires separate route review",
  };
  const writeGates = [
    {
      id: "route-review-required",
      label: "Durable ledger implementation requires a separate whitepaper route review",
      passed: false,
      requiredBeforeWrite: true,
    },
    {
      id: "workspace-root-selection",
      label: "Ledger storage root must be explicitly selected and shown in Observer",
      passed: false,
      requiredBeforeWrite: true,
    },
    {
      id: "append-only-format",
      label: "Ledger must be append-only with content hashes and no background scheduler",
      passed: false,
      requiredBeforeWrite: true,
    },
    {
      id: "operator-visible-export",
      label: "Observer must show ledger path, latest record, and export boundary before writes",
      passed: false,
      requiredBeforeWrite: true,
    },
  ];

  return {
    ok: true,
    registry: BODY_EVIDENCE_LEDGER_PLAN_REGISTRY,
    mode: "plan_only_body_evidence_ledger",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      timelineReadinessRegistry: readiness.registry,
      evidence: "body_evidence_ledger_plan",
    },
    governance: {
      domain: "body_internal",
      risk: "medium",
      autonomy: "plan_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canWriteLedger: false,
      canRestart: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
      durableStorageWritten: false,
    },
    summary: {
      planReady: timelineReady,
      timelineReady,
      plannedSchema: plannedRecordSchema.version,
      writeGateCount: writeGates.length,
      requiredBeforeWrite: writeGates.filter((gate) => gate.requiredBeforeWrite).length,
      durableStorageWritten: false,
      hiddenMutation: false,
    },
    plan: {
      intent: "body.evidence.ledger.plan",
      storageMode: "append_only_jsonl_candidate",
      implementationStatus: "not_implemented_plan_only",
      plannedRecordSchema,
      retentionPlan: {
        defaultWindow: "operator-selected; no default pruning policy yet",
        compaction: "future route-reviewed summary snapshots only",
        rawPayloadArchival: "deferred",
      },
      writeGates,
      verificationPlan: [
        "prove ledger path is inside an approved OpenClaw body evidence root",
        "append one synthetic ledger record in a future implementation milestone",
        "verify record hash, schema version, source registry, and Observer visibility",
        "prove no scheduler, no task creation, no command execution, and no host mutation beyond the approved ledger append",
      ],
    },
    next: {
      recommendedSlice: "openclaw-body-evidence-ledger-route-review",
      boundary: "review the ledger implementation route before writing durable records or adding scheduling",
    },
  };
}

async function buildBodyEvidenceLedgerRouteReview() {
  const ledgerPlan = await buildBodyEvidenceLedgerPlan();
  const planReady = ledgerPlan.summary?.planReady === true;
  const writeGates = Array.isArray(ledgerPlan.plan?.writeGates) ? ledgerPlan.plan.writeGates : [];
  const requiredWriteGates = writeGates.filter((gate) => gate.requiredBeforeWrite === true);
  const unmetWriteGates = requiredWriteGates.filter((gate) => gate.passed !== true);
  const candidates = [
    {
      track: "Track C",
      id: "operator-visible-ledger-storage-root",
      label: "Plan-only body evidence ledger storage root selection",
      score: planReady ? 97 : 50,
      recommended: planReady,
      firstSlice: "openclaw-body-evidence-ledger-storage-root-plan",
      mutation: false,
      durableWrite: false,
      reason: planReady
        ? "The ledger schema is planned; the next whitepaper-aligned step is selecting an operator-visible storage root before any append."
        : "The ledger plan is not ready, so storage root selection should stay blocked.",
    },
    {
      track: "Track C",
      id: "direct-ledger-append",
      label: "Direct durable ledger append",
      score: 25,
      recommended: false,
      firstSlice: "defer-direct-ledger-append",
      mutation: true,
      durableWrite: true,
      reason: "Direct append would skip storage-root selection, Observer export, and explicit write-gate closure.",
    },
    {
      track: "Deferred Track",
      id: "background-ledger-scheduler",
      label: "Background evidence ledger scheduler",
      score: 15,
      recommended: false,
      firstSlice: "defer-ledger-scheduler",
      mutation: false,
      durableWrite: false,
      reason: "Schedulers would reintroduce autonomous background behavior before the ledger has a human-visible root and append proof.",
    },
  ];

  return {
    ok: true,
    registry: BODY_EVIDENCE_LEDGER_ROUTE_REVIEW_REGISTRY,
    mode: "read_only_body_evidence_ledger_route_review",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      ledgerPlanRegistry: ledgerPlan.registry,
      phase2Plan: "docs/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "body_evidence_ledger_route_review",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "route_selection_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canWriteLedger: false,
      durableStorageWritten: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    decision: {
      selectedTrack: "Track C: Body Evidence Memory",
      selectedSlice: "openclaw-body-evidence-ledger-storage-root-plan",
      status: planReady ? "selected" : "blocked_until_ledger_plan_ready",
      rationale: "Move from schema planning to operator-visible storage-root planning before any durable ledger append.",
      notSelected: [
        "no direct durable ledger append",
        "no background ledger scheduler",
        "no automatic repair",
        "no denial recovery or duplicate-click hardening",
        "no plugin/runtime adapter work",
        "no broader host mutation",
      ],
    },
    evidence: {
      ledgerPlanReady: planReady,
      plannedSchema: ledgerPlan.summary?.plannedSchema ?? null,
      writeGateCount: ledgerPlan.summary?.writeGateCount ?? writeGates.length,
      unmetWriteGateIds: unmetWriteGates.map((gate) => gate.id),
      durableStorageWritten: ledgerPlan.summary?.durableStorageWritten === true,
      routeBoundary: ledgerPlan.next?.boundary ?? null,
    },
    candidates,
    next: {
      recommendedSlice: "openclaw-body-evidence-ledger-storage-root-plan",
      boundary: "plan the operator-visible ledger storage root before any append-only durable write",
    },
  };
}

async function buildBodyEvidenceLedgerStorageRootPlan() {
  const routeReview = await buildBodyEvidenceLedgerRouteReview();
  const routeReady = routeReview.decision?.selectedSlice === "openclaw-body-evidence-ledger-storage-root-plan"
    && routeReview.decision?.status === "selected";
  const candidateRoots = [
    {
      id: "repo-artifacts-body-evidence-ledger",
      label: "Repository artifact ledger root",
      displayPath: ".artifacts/openclaw-body-evidence-ledger",
      rootPolicy: "inside_openclaw_workspace",
      recommended: true,
      createsDirectoryNow: false,
      writesRecordsNow: false,
      operatorVisible: true,
      reason: "Keeps early ledger evidence local to the OpenClaw workspace and visible to milestone artifacts.",
    },
    {
      id: "user-configured-body-ledger-root",
      label: "Operator configured body ledger root",
      displayPath: "\${OPENCLAW_BODY_EVIDENCE_LEDGER_DIR}",
      rootPolicy: "explicit_operator_configuration_required",
      recommended: false,
      createsDirectoryNow: false,
      writesRecordsNow: false,
      operatorVisible: true,
      reason: "Useful later, but an implicit environment root would be less demoable than the repo artifact path.",
    },
  ];
  const selectedRoot = candidateRoots.find((candidate) => candidate.recommended === true) ?? candidateRoots[0];

  return {
    ok: true,
    registry: BODY_EVIDENCE_LEDGER_STORAGE_ROOT_PLAN_REGISTRY,
    mode: "plan_only_body_evidence_ledger_storage_root",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      ledgerRouteReviewRegistry: routeReview.registry,
      phase2Plan: "docs/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "body_evidence_ledger_storage_root_plan",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "plan_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canCreateDirectory: false,
      canWriteLedger: false,
      durableStorageWritten: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    summary: {
      planReady: routeReady,
      routeReviewReady: routeReady,
      selectedRootId: selectedRoot?.id ?? null,
      selectedDisplayPath: selectedRoot?.displayPath ?? null,
      candidateRootCount: candidateRoots.length,
      directoryCreated: false,
      durableStorageWritten: false,
      hiddenMutation: false,
    },
    plan: {
      intent: "body.evidence.ledger.storage_root.plan",
      selectedRoot,
      candidateRoots,
      pathPolicy: {
        mustStayInsideWorkspace: true,
        mustBeObserverVisible: true,
        mustNotUseHomeDirectoryByDefault: true,
        mustNotCreateDirectoryInThisSlice: true,
      },
      preWriteChecks: [
        "show resolved ledger root in Observer before any directory creation",
        "prove the root is inside the OpenClaw workspace or an explicit operator-configured path",
        "keep directory creation and first append in separate route-reviewed milestones",
      ],
    },
    next: {
      recommendedSlice: "openclaw-body-evidence-ledger-storage-root-route-review",
      boundary: "review storage-root materialization before creating directories or writing ledger records",
    },
  };
}

async function buildBodyEvidenceLedgerStorageRootRouteReview() {
  const storageRootPlan = await buildBodyEvidenceLedgerStorageRootPlan();
  const planReady = storageRootPlan.summary?.planReady === true;
  const selectedRoot = storageRootPlan.plan?.selectedRoot ?? null;
  const rootInsideWorkspace = selectedRoot?.rootPolicy === "inside_openclaw_workspace";
  const candidates = [
    {
      track: "Track C",
      id: "ledger-directory-creation-task",
      label: "Approval-visible ledger directory creation task shell",
      score: planReady && rootInsideWorkspace ? 96 : 48,
      recommended: planReady && rootInsideWorkspace,
      firstSlice: "openclaw-body-evidence-ledger-directory-task",
      mutation: true,
      durableWrite: false,
      reason: planReady && rootInsideWorkspace
        ? "The selected root is inside the OpenClaw workspace; the next useful step is a minimal operator-visible directory creation task shell."
        : "Directory creation should stay blocked until the selected root is explicit and workspace-bounded.",
    },
    {
      track: "Track C",
      id: "direct-ledger-record-write",
      label: "Direct ledger record write",
      score: 20,
      recommended: false,
      firstSlice: "defer-direct-ledger-record-write",
      mutation: true,
      durableWrite: true,
      reason: "Writing records before directory materialization and Observer verification would skip the visible body-memory setup path.",
    },
    {
      track: "Deferred Track",
      id: "ledger-scheduler",
      label: "Background ledger scheduler",
      score: 10,
      recommended: false,
      firstSlice: "defer-ledger-scheduler",
      mutation: false,
      durableWrite: false,
      reason: "Schedulers are intentionally deferred until one manual ledger append is visible and verified.",
    },
  ];

  return {
    ok: true,
    registry: BODY_EVIDENCE_LEDGER_STORAGE_ROOT_ROUTE_REVIEW_REGISTRY,
    mode: "read_only_body_evidence_ledger_storage_root_route_review",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      storageRootPlanRegistry: storageRootPlan.registry,
      phase2Plan: "docs/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "body_evidence_ledger_storage_root_route_review",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "route_selection_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canCreateDirectory: false,
      canWriteLedger: false,
      durableStorageWritten: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    decision: {
      selectedTrack: "Track C: Body Evidence Memory",
      selectedSlice: "openclaw-body-evidence-ledger-directory-task",
      status: planReady && rootInsideWorkspace ? "selected" : "blocked_until_workspace_bounded_root",
      rationale: "Move from storage-root planning to a minimal, visible directory creation task shell before any ledger record write.",
      notSelected: [
        "no direct ledger record write",
        "no background ledger scheduler",
        "no automatic repair",
        "no denial recovery or duplicate-click hardening",
        "no plugin/runtime adapter work",
        "no broader host mutation",
      ],
    },
    evidence: {
      storageRootPlanReady: planReady,
      selectedRootId: storageRootPlan.summary?.selectedRootId ?? null,
      selectedDisplayPath: storageRootPlan.summary?.selectedDisplayPath ?? null,
      rootInsideWorkspace,
      directoryCreated: storageRootPlan.summary?.directoryCreated === true,
      durableStorageWritten: storageRootPlan.summary?.durableStorageWritten === true,
      pathPolicy: storageRootPlan.plan?.pathPolicy ?? null,
      preWriteChecks: storageRootPlan.plan?.preWriteChecks ?? [],
    },
    candidates,
    next: {
      recommendedSlice: "openclaw-body-evidence-ledger-directory-task",
      boundary: "create only the selected ledger directory through an explicit task shell; do not write ledger records yet",
    },
  };
}

async function buildBodyEvidenceLedgerFirstRecordPlan() {
  const ledgerPlan = await buildBodyEvidenceLedgerPlan();
  const timelineReadiness = await buildBodyEvidenceTimelineReadiness();
  const directoryPath = path.resolve(process.cwd(), "../..", ".artifacts/openclaw-body-evidence-ledger");
  const directoryExists = existsSync(directoryPath) && statSync(directoryPath).isDirectory();
  const requiredFields = ledgerPlan.plan?.plannedRecordSchema?.requiredFields ?? [];
  const plannedRecord = {
    version: ledgerPlan.summary?.plannedSchema ?? "body-evidence-ledger-record-v0",
    evidenceType: "body_evidence_ledger_bootstrap",
    phase: "phase_2_body_evidence_memory",
    sourceRegistry: timelineReadiness.registry,
    sourceEndpoint: "/system/route/body-evidence-timeline-readiness",
    summary: "Bootstrap durable body evidence memory with timeline readiness and ledger directory materialization evidence.",
    contentHashStrategy: "sha256(JSON.stringify(canonicalRecordWithoutHash))",
    governance: {
      hostMutation: false,
      executesCommand: false,
      createsTask: false,
      createsApproval: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
  };

  return {
    ok: true,
    registry: BODY_EVIDENCE_LEDGER_FIRST_RECORD_PLAN_REGISTRY,
    mode: "plan_only_body_evidence_ledger_first_record",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      ledgerPlanRegistry: ledgerPlan.registry,
      timelineReadinessRegistry: timelineReadiness.registry,
      evidence: "body_evidence_ledger_first_record_plan",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "plan_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canAppendLedgerRecord: false,
      canWriteLedger: false,
      durableStorageWritten: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    summary: {
      planReady: ledgerPlan.summary?.planReady === true && timelineReadiness.summary?.ready === true && directoryExists,
      ledgerPlanReady: ledgerPlan.summary?.planReady === true,
      timelineReady: timelineReadiness.summary?.ready === true,
      directoryExists,
      selectedDisplayPath: ".artifacts/openclaw-body-evidence-ledger",
      plannedRecordType: plannedRecord.evidenceType,
      requiredFieldCount: requiredFields.length,
      durableStorageWritten: false,
      hiddenMutation: false,
    },
    plan: {
      intent: "body.evidence.ledger.first_record.plan",
      ledgerRoot: {
        displayPath: ".artifacts/openclaw-body-evidence-ledger",
        resolvedPath: directoryPath,
        exists: directoryExists,
      },
      plannedRecord,
      requiredFields,
      preAppendChecks: [
        "ledger directory exists inside the OpenClaw workspace",
        "record includes schema version, source registry, source endpoint, phase, evidence type, summary, content hash, and governance",
        "first append is a separate approval-gated milestone",
        "no scheduler, no automatic repair, no plugin/runtime adapter work, and no background persistence",
      ],
    },
    next: {
      recommendedSlice: "openclaw-body-evidence-ledger-first-record-route-review",
      boundary: "review the first ledger record append route before writing any JSONL record",
    },
  };
}

async function buildBodyEvidenceLedgerFirstRecordRouteReview() {
  const firstRecordPlan = await buildBodyEvidenceLedgerFirstRecordPlan();
  const planReady = firstRecordPlan.summary?.planReady === true;
  const candidates = [
    {
      track: "Track C",
      id: "first-record-append-task",
      label: "Approval-gated first ledger record append task shell",
      score: planReady ? 96 : 45,
      recommended: planReady,
      firstSlice: "openclaw-body-evidence-ledger-first-record-task",
      mutation: true,
      durableWrite: true,
      scheduler: false,
      reason: planReady
        ? "The bootstrap record is planned and the ledger root exists; the next step is an explicit append task shell, not a background writer."
        : "First record append must stay blocked until the plan, timeline evidence, and ledger root are ready.",
    },
    {
      track: "Deferred Track",
      id: "background-ledger-writer",
      label: "Background body evidence ledger writer",
      score: 15,
      recommended: false,
      firstSlice: "defer-background-ledger-writer",
      mutation: true,
      durableWrite: true,
      scheduler: true,
      reason: "Background writers are deferred until at least one operator-visible append is proven and reviewed.",
    },
    {
      track: "Deferred Track",
      id: "bulk-evidence-import",
      label: "Bulk evidence import",
      score: 10,
      recommended: false,
      firstSlice: "defer-bulk-evidence-import",
      mutation: true,
      durableWrite: true,
      scheduler: false,
      reason: "Bulk import would skip the single-record bootstrap proof and make evidence provenance harder to audit.",
    },
  ];

  return {
    ok: true,
    registry: BODY_EVIDENCE_LEDGER_FIRST_RECORD_ROUTE_REVIEW_REGISTRY,
    mode: "read_only_body_evidence_ledger_first_record_route_review",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      firstRecordPlanRegistry: firstRecordPlan.registry,
      phase2Plan: "docs/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "body_evidence_ledger_first_record_route_review",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "route_selection_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canAppendLedgerRecord: false,
      canWriteLedger: false,
      durableStorageWritten: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
    },
    decision: {
      selectedTrack: "Track C: Body Evidence Memory",
      selectedSlice: "openclaw-body-evidence-ledger-first-record-task",
      status: planReady ? "selected" : "blocked_until_first_record_plan_ready",
      rationale: "Move from first-record planning to an approval-gated single append task shell; defer schedulers and bulk import.",
      notSelected: [
        "no background ledger writer",
        "no bulk evidence import",
        "no automatic repair",
        "no denial recovery or duplicate-click hardening",
        "no plugin/runtime adapter work",
        "no broader host mutation",
      ],
    },
    evidence: {
      firstRecordPlanReady: planReady,
      plannedRecordType: firstRecordPlan.summary?.plannedRecordType ?? null,
      directoryExists: firstRecordPlan.summary?.directoryExists === true,
      sourceRegistry: firstRecordPlan.plan?.plannedRecord?.sourceRegistry ?? null,
      requiredFieldCount: firstRecordPlan.summary?.requiredFieldCount ?? 0,
      durableStorageWritten: firstRecordPlan.summary?.durableStorageWritten === true,
      preAppendChecks: firstRecordPlan.plan?.preAppendChecks ?? [],
    },
    candidates,
    next: {
      recommendedSlice: "openclaw-body-evidence-ledger-first-record-task",
      boundary: "create an approval-gated first-record append task shell; do not add background writers or bulk import",
    },
  };
}

function readBodyEvidenceLedgerRecords() {
  const ledgerFileDisplayPath = ".artifacts/openclaw-body-evidence-ledger/body-evidence-ledger.jsonl";
  const ledgerFilePath = path.resolve(process.cwd(), "../..", ledgerFileDisplayPath);
  const fileExists = existsSync(ledgerFilePath) && statSync(ledgerFilePath).isFile();
  if (!fileExists) {
    return {
      ledgerFileDisplayPath,
      ledgerFilePath,
      fileExists: false,
      records: [],
      parseErrors: [],
      lineCount: 0,
      bytes: 0,
    };
  }

  const content = readFileSync(ledgerFilePath, "utf8");
  const lines = content.trim().length > 0 ? content.trim().split("\n").filter(Boolean) : [];
  const records = [];
  const parseErrors = [];
  lines.forEach((line, index) => {
    try {
      const record = JSON.parse(line);
      const { contentHash, ...hashBase } = record;
      const expectedHash = createHash("sha256").update(JSON.stringify(hashBase)).digest("hex");
      records.push({
        ...record,
        hashValid: typeof contentHash === "string" && contentHash === expectedHash,
        expectedHash,
      });
    } catch (error) {
      parseErrors.push({
        line: index + 1,
        message: error instanceof Error ? error.message : "Invalid JSONL record.",
      });
    }
  });

  return {
    ledgerFileDisplayPath,
    ledgerFilePath,
    fileExists,
    records,
    parseErrors,
    lineCount: lines.length,
    bytes: Buffer.byteLength(content, "utf8"),
  };
}

async function buildBodyEvidenceLedgerReadiness() {
  const ledgerPlan = await buildBodyEvidenceLedgerPlan();
  const firstRecordPlan = await buildBodyEvidenceLedgerFirstRecordPlan();
  const ledger = readBodyEvidenceLedgerRecords();
  const bootstrapRecords = ledger.records.filter((record) => record.evidenceType === "body_evidence_ledger_bootstrap");
  const firstRecord = bootstrapRecords[0] ?? null;
  const checks = [
    {
      id: "ledger-plan-ready",
      label: "Body evidence ledger schema plan is ready",
      passed: ledgerPlan.summary?.planReady === true,
      evidence: ledgerPlan.registry,
    },
    {
      id: "ledger-file-exists",
      label: "Workspace-bounded body evidence ledger JSONL file exists",
      passed: ledger.fileExists === true,
      evidence: ledger.ledgerFileDisplayPath,
    },
    {
      id: "single-bootstrap-record",
      label: "Ledger contains exactly one bootstrap record for this readiness checkpoint",
      passed: ledger.lineCount === 1 && bootstrapRecords.length === 1,
      evidence: `lines=${ledger.lineCount};bootstrap=${bootstrapRecords.length}`,
    },
    {
      id: "record-source-ready",
      label: "Bootstrap record cites body evidence timeline readiness",
      passed: firstRecord?.sourceRegistry === BODY_EVIDENCE_TIMELINE_READINESS_REGISTRY
        && firstRecord?.sourceEndpoint === "/system/route/body-evidence-timeline-readiness",
      evidence: firstRecord?.sourceRegistry ?? null,
    },
    {
      id: "content-hash-valid",
      label: "Bootstrap record content hash validates against canonical payload",
      passed: firstRecord?.hashValid === true,
      evidence: firstRecord?.contentHash ?? null,
    },
    {
      id: "governance-boundary",
      label: "Bootstrap record preserves no scheduler, no background writer, and no bulk import boundary",
      passed: firstRecord?.governance?.appendOnly === true
        && firstRecord?.governance?.scheduler === false
        && firstRecord?.governance?.backgroundWriter === false
        && firstRecord?.governance?.bulkImport === false,
      evidence: firstRecord?.governance ?? null,
    },
    {
      id: "parse-clean",
      label: "Ledger JSONL parses cleanly",
      passed: ledger.parseErrors.length === 0,
      evidence: `parseErrors=${ledger.parseErrors.length}`,
    },
  ];
  const passedChecks = checks.filter((check) => check.passed).length;
  const ready = passedChecks === checks.length;

  return {
    ok: true,
    registry: BODY_EVIDENCE_LEDGER_READINESS_REGISTRY,
    mode: "read_only_body_evidence_ledger_readiness",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      ledgerPlanRegistry: ledgerPlan.registry,
      firstRecordPlanRegistry: firstRecordPlan.registry,
      evidence: "body_evidence_ledger_readiness",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "readiness_report_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canAppendLedgerRecord: false,
      canWriteLedger: false,
      durableStorageWritten: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
      backgroundWriter: false,
      bulkImport: false,
    },
    summary: {
      ready,
      passedChecks,
      totalChecks: checks.length,
      ledgerFile: ledger.ledgerFileDisplayPath,
      ledgerFileExists: ledger.fileExists,
      recordCount: ledger.records.length,
      bootstrapRecordCount: bootstrapRecords.length,
      latestRecordId: ledger.records.at(-1)?.id ?? null,
      latestRecordHash: ledger.records.at(-1)?.contentHash ?? null,
      hiddenMutation: false,
    },
    checks,
    completedBlock: {
      id: "phase-2-track-c-body-evidence-ledger",
      name: "Body Evidence Ledger",
      completedSlices: [
        "openclaw-body-evidence-ledger-plan",
        "openclaw-body-evidence-ledger-route-review",
        "openclaw-body-evidence-ledger-storage-root-plan",
        "openclaw-body-evidence-ledger-storage-root-route-review",
        "openclaw-body-evidence-ledger-directory-task",
        "openclaw-body-evidence-ledger-directory-execution",
        "openclaw-body-evidence-ledger-first-record-plan",
        "openclaw-body-evidence-ledger-first-record-route-review",
        "openclaw-body-evidence-ledger-first-record-task",
        "openclaw-body-evidence-ledger-first-record-append",
      ],
      completionClaim: ready ? "body_evidence_ledger_first_record_ready_for_route_review" : "body_evidence_ledger_incomplete",
    },
    evidence: {
      ledger,
      records: ledger.records.map((record) => ({
        id: record.id,
        recordedAt: record.recordedAt,
        sourceRegistry: record.sourceRegistry,
        evidenceType: record.evidenceType,
        phase: record.phase,
        contentHash: record.contentHash,
        hashValid: record.hashValid,
        governance: record.governance,
      })),
      parseErrors: ledger.parseErrors,
    },
    next: {
      recommendedSlice: "openclaw-phase-2-next-capability-route-review",
      boundary: "return to whitepaper route review before adding additional ledger records, background writers, schedulers, or new mutation",
    },
  };
}

async function buildBodyEvidenceLedgerDemoStatus() {
  const readiness = await buildBodyEvidenceLedgerReadiness();
  const record = readiness.evidence?.records?.[0] ?? null;
  const checklist = [
    {
      id: "ledger-readiness-ready",
      label: "Body evidence ledger readiness passed",
      passed: readiness.summary?.ready === true,
      evidence: readiness.registry,
    },
    {
      id: "bootstrap-record-visible",
      label: "Bootstrap ledger record is visible to Observer and operator demo",
      passed: readiness.summary?.recordCount === 1
        && record?.evidenceType === "body_evidence_ledger_bootstrap",
      evidence: record?.id ?? null,
    },
    {
      id: "record-hash-valid",
      label: "Bootstrap record hash validates",
      passed: record?.hashValid === true,
      evidence: record?.contentHash ?? null,
    },
    {
      id: "operator-provenance",
      label: "Bootstrap record carries task and approval provenance",
      passed: typeof record?.governance?.taskId === "string"
        && typeof record?.governance?.approvalId === "string",
      evidence: {
        taskId: record?.governance?.taskId ?? null,
        approvalId: record?.governance?.approvalId ?? null,
      },
    },
    {
      id: "no-background-writers",
      label: "Demo status confirms no background writer, scheduler, or bulk import",
      passed: readiness.governance?.backgroundWriter === false
        && readiness.governance?.schedulesFollowUp === false
        && readiness.governance?.bulkImport === false
        && record?.governance?.backgroundWriter === false
        && record?.governance?.scheduler === false
        && record?.governance?.bulkImport === false,
      evidence: "no_background_ledger_writer",
    },
  ];
  const passed = checklist.filter((item) => item.passed).length;
  const demoReady = passed === checklist.length;

  return {
    ok: true,
    registry: BODY_EVIDENCE_LEDGER_DEMO_STATUS_REGISTRY,
    mode: "read_only_body_evidence_ledger_demo_status",
    generatedAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      ledgerReadinessRegistry: readiness.registry,
      phase2Plan: "docs/OPENCLAW_PHASE_2_PLAN.md",
      evidence: "body_evidence_ledger_demo_status",
    },
    governance: {
      domain: "body_internal",
      risk: "low",
      autonomy: "demo_status_only",
      approvalRequired: false,
      hostMutation: false,
      canMutate: false,
      canAppendLedgerRecord: false,
      canWriteLedger: false,
      durableStorageWritten: false,
      createsTask: false,
      createsApproval: false,
      executesCommand: false,
      triggersRecovery: false,
      schedulesFollowUp: false,
      backgroundWriter: false,
      bulkImport: false,
    },
    summary: {
      demoReady,
      passed,
      total: checklist.length,
      ledgerReady: readiness.summary?.ready === true,
      ledgerFile: readiness.summary?.ledgerFile ?? null,
      recordCount: readiness.summary?.recordCount ?? 0,
      bootstrapRecordId: record?.id ?? null,
      bootstrapRecordHash: record?.contentHash ?? null,
      hiddenMutation: false,
    },
    checklist,
    demoNarrative: [
      "OpenClaw now has a durable body evidence ledger root inside the workspace.",
      "The first bootstrap JSONL record was created through an explicit task and approval.",
      "The record points back to body evidence timeline readiness and validates with a content hash.",
      "No background ledger writer, scheduler, bulk import, automatic repair, or plugin/runtime adapter was introduced.",
      "The next move must return to route review before any additional durable writes.",
    ],
    evidence: {
      readinessSummary: readiness.summary,
      record,
      completedBlock: readiness.completedBlock,
      next: readiness.next,
    },
    next: {
      recommendedSlice: "openclaw-phase-2-next-capability-route-review",
      boundary: "route-review the next body capability; do not add more ledger records or background writers from demo status",
    },
  };
}

function classifySystemdRepairRisk(unit) {
  if (unit.name === "openclaw-event-hub" || unit.name === "openclaw-core") {
    return "high";
  }
  return "medium";
}

function buildSystemdRepairReason(unit, requestedReason) {
  if (typeof requestedReason === "string" && requestedReason.trim()) {
    return requestedReason.trim();
  }
  if (unit.activeState === "failed" || unit.subState === "failed") {
    return `${unit.unit} reports failed state and may need an operator-approved restart.`;
  }
  if (unit.activeState === "inactive") {
    return `${unit.unit} reports inactive state and may need an operator-reviewed start/restart decision.`;
  }
  return `${unit.unit} is an OpenClaw-owned body unit; this proposal demonstrates the controlled repair path without mutating the host.`;
}

async function buildSystemdRepairPlan({ unit: requestedUnit, reason } = {}) {
  const inventory = await buildSystemdUnitInventory();
  const unit = findInventoryUnit(inventory, requestedUnit);
  if (!unit) {
    const error = new Error("Requested unit is not part of the OpenClaw-owned systemd inventory.");
    error.code = "SYSTEMD_UNIT_NOT_OPENCLAW_OWNED";
    error.details = {
      requestedUnit: requestedUnit ?? null,
      allowedUnits: inventory.units.map((item) => item.unit),
    };
    throw error;
  }

  const risk = classifySystemdRepairRisk(unit);
  const command = {
    command: "systemctl",
    args: ["restart", unit.unit],
    shell: false,
    requiresOperator: true,
  };

  return {
    ok: true,
    registry: SYSTEMD_REPAIR_PLAN_REGISTRY,
    mode: "plan_only",
    canMutate: false,
    canRestart: false,
    wouldExecute: false,
    createdAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      inventoryRegistry: inventory.registry,
      inventoryObservedAt: inventory.observedAt,
      systemdAvailable: inventory.source.systemdAvailable,
      evidence: "operator_visible_repair_proposal",
    },
    target: {
      key: unit.key,
      name: unit.name,
      unit: unit.unit,
      component: unit.component,
      activeState: unit.activeState,
      subState: unit.subState,
      loadState: unit.loadState,
      unitFileState: unit.unitFileState,
      systemdObserved: unit.systemdObserved,
      observation: unit.observation,
    },
    proposal: {
      action: "restart-service",
      command,
      risk,
      reason: buildSystemdRepairReason(unit, reason),
      approvalRequiredForExecution: true,
      dryRunRequiredBeforeExecution: true,
      rollbackNote: `No automatic rollback is attempted. Before any future execution, capture systemctl status ${unit.unit}; after execution, verify health and journal output, then stop and escalate to the operator if the unit remains unhealthy.`,
    },
    governance: {
      domain: "body_internal",
      autonomy: "operator_visible_plan_only",
      hostMutation: false,
      executesCommand: false,
      approvalFlowCreated: false,
      forbiddenUntilFutureMilestone: ["automatic_restart", "blind_restart", "host_mutation"],
    },
    next: {
      recommendedSlice: "openclaw-systemd-repair-dry-run",
      boundary: "explicit dry-run envelope before any host mutation",
    },
  };
}

async function buildSystemdRepairDryRun({ unit, reason } = {}) {
  const plan = await buildSystemdRepairPlan({ unit, reason });
  const dryRun = buildCommandDryRun({
    command: plan.proposal.command.command,
    args: plan.proposal.command.args,
    intent: "systemd.repair.dry_run",
  });

  return {
    ok: true,
    registry: SYSTEMD_REPAIR_DRY_RUN_REGISTRY,
    mode: "operator_visible_dry_run",
    canMutate: false,
    canRestart: false,
    wouldExecute: false,
    createdAt: new Date().toISOString(),
    source: {
      service: "openclaw-system-sense",
      planRegistry: plan.registry,
      inventoryRegistry: plan.source.inventoryRegistry,
      evidence: "explicit_operator_visible_dry_run_envelope",
    },
    target: plan.target,
    plan,
    dryRun: {
      ...dryRun,
      risk: "high",
      governance: "require_future_operator_approval",
      requiresApproval: true,
      checks: [
        ...dryRun.checks,
        {
          name: "operator_visible_before_mutation",
          passed: true,
          detail: "Repair command is visible to Observer before any future host mutation milestone.",
        },
        {
          name: "no_restart_executed",
          passed: true,
          detail: "This endpoint does not execute systemctl restart.",
        },
      ],
    },
    governance: {
      domain: "body_internal",
      autonomy: "dry_run_only",
      hostMutation: false,
      executesCommand: false,
      approvalFlowCreated: false,
      futureExecutionRequiresSeparateMilestone: true,
    },
    next: {
      recommendedSlice: "operator-reviewed-systemd-repair-execution",
      boundary: "do not execute until a separate whitepaper route review accepts real host mutation",
    },
  };
}

async function refreshSystemState() {
  const entries = await Promise.all(
    Object.entries(serviceTargets).map(async ([name, url]) => [name, await checkService(name, url)]),
  );

  const services = Object.fromEntries(entries);
  const alerts = Object.values(services)
    .filter((service) => !service.ok)
    .map((service) => ({
      id: `alert-${randomUUID()}`,
      level: "warning",
      code: "service.offline",
      source: service.name,
      message: `${service.name} is offline`,
    }));
  const resources = buildResourceState();

  if (resources.memoryPercent >= memoryWarningPercent) {
    alerts.push({
      id: `alert-${randomUUID()}`,
      level: "warning",
      code: "resource.memory.high",
      source: "openclaw-system-sense",
      message: `Memory usage is ${resources.memoryPercent}%`,
    });
  }

  if (resources.disk.available && resources.diskPercent >= diskWarningPercent) {
    alerts.push({
      id: `alert-${randomUUID()}`,
      level: "warning",
      code: "resource.disk.high",
      source: "openclaw-system-sense",
      message: `Disk usage is ${resources.diskPercent}% at ${diskPath}`,
    });
  }

  systemState.timestamp = new Date().toISOString();
  systemState.body = buildBodyState();
  systemState.services = services;
  systemState.resources = resources;
  systemState.network = {
    online: Object.values(services).some((service) => service.ok),
    checkedTargets: Object.keys(serviceTargets).length,
  };
  systemState.alerts = alerts;
  recordHealthSnapshot();
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
      service: "openclaw-system-sense",
      stage: "active",
      host,
      port,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/health") {
    await refreshSystemState();
    sendJson(res, 200, {
      ok: true,
      system: { ...systemState },
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/health/trends") {
    const trendSummary = await buildHealthTrendSummary();
    sendJson(res, 200, trendSummary);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/next-action") {
    const recommendation = await buildRouteAwareNextActionRecommendation();
    sendJson(res, 200, recommendation);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/recovery-policy") {
    const policy = await buildConservativeRecoveryPolicyExplanation();
    sendJson(res, 200, policy);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-governance-readiness") {
    const readiness = await buildBodyGovernanceReadiness();
    sendJson(res, 200, readiness);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-timeline") {
    const timeline = await buildBodyEvidenceTimeline();
    sendJson(res, 200, timeline);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-timeline-readiness") {
    const readiness = await buildBodyEvidenceTimelineReadiness();
    sendJson(res, 200, readiness);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-ledger-plan") {
    const plan = await buildBodyEvidenceLedgerPlan();
    sendJson(res, 200, plan);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-ledger-route-review") {
    const review = await buildBodyEvidenceLedgerRouteReview();
    sendJson(res, 200, review);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-ledger-storage-root-plan") {
    const plan = await buildBodyEvidenceLedgerStorageRootPlan();
    sendJson(res, 200, plan);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-ledger-storage-root-route-review") {
    const review = await buildBodyEvidenceLedgerStorageRootRouteReview();
    sendJson(res, 200, review);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-ledger-first-record-plan") {
    const plan = await buildBodyEvidenceLedgerFirstRecordPlan();
    sendJson(res, 200, plan);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-ledger-first-record-route-review") {
    const review = await buildBodyEvidenceLedgerFirstRecordRouteReview();
    sendJson(res, 200, review);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-ledger-readiness") {
    const readiness = await buildBodyEvidenceLedgerReadiness();
    sendJson(res, 200, readiness);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/body-evidence-ledger-demo-status") {
    const status = await buildBodyEvidenceLedgerDemoStatus();
    sendJson(res, 200, status);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/route/phase-2-review") {
    const review = await buildPhase2RouteReview();
    sendJson(res, 200, review);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/body") {
    await refreshSystemState();
    sendJson(res, 200, {
      ok: true,
      body: systemState.body,
      resources: systemState.resources,
      network: systemState.network,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/services") {
    await refreshSystemState();
    sendJson(res, 200, {
      ok: true,
      services: systemState.services,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/units") {
    const inventory = await buildSystemdUnitInventory();
    sendJson(res, 200, inventory);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/dependency-map") {
    const dependencyMap = await buildSystemdDependencyMap();
    sendJson(res, 200, dependencyMap);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/repair-candidates") {
    const assessment = await buildSystemdRepairCandidateAssessment();
    sendJson(res, 200, assessment);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/repair-candidate-plan") {
    const plan = await buildSystemdRepairCandidatePlan();
    sendJson(res, 200, plan);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/repair-candidate-task-route") {
    const route = await buildSystemdRepairCandidateTaskRoute();
    sendJson(res, 200, route);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/repair-candidate-readiness") {
    const readiness = await buildSystemdRepairCandidateReadiness();
    sendJson(res, 200, readiness);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/repair-candidate-route-review") {
    const review = await buildSystemdRepairCandidateRouteReview();
    sendJson(res, 200, review);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/repair-candidate-demo-status") {
    const status = await buildSystemdRepairCandidateDemoStatus();
    sendJson(res, 200, status);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/repair-plan") {
    try {
      const plan = await buildSystemdRepairPlan({
        unit: requestUrl.searchParams.get("unit") ?? requestUrl.searchParams.get("target"),
        reason: requestUrl.searchParams.get("reason"),
      });
      sendJson(res, 200, plan);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, code: error.code ?? null, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/systemd/repair-dry-run") {
    try {
      const envelope = await buildSystemdRepairDryRun({
        unit: requestUrl.searchParams.get("unit") ?? requestUrl.searchParams.get("target"),
        reason: requestUrl.searchParams.get("reason"),
      });
      sendJson(res, 200, envelope);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, code: error.code ?? null, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/alerts") {
    await refreshSystemState();
    sendJson(res, 200, {
      ok: true,
      alerts: systemState.alerts,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/files/metadata") {
    try {
      const result = resolveAllowedPath(requestUrl.searchParams.get("path"));
      const metadata = buildFileMetadata(result.path);
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
        metadata,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/files/list") {
    try {
      const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "50", 10);
      const result = listFiles(requestUrl.searchParams.get("path"), limit);
      await publishEvent("system.files.listed", {
        path: result.path,
        count: result.count,
      });
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/files/search") {
    try {
      const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "50", 10);
      const result = searchFiles(
        requestUrl.searchParams.get("path"),
        requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit,
      );
      await publishEvent("system.files.searched", {
        path: result.path,
        query: result.query,
        count: result.count,
      });
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/files/read-text") {
    try {
      const result = readTextFile(requestUrl.searchParams.get("path"));
      await publishEvent("system.files.read", {
        path: result.path,
        contentBytes: result.contentBytes,
        mode: result.mode,
      });
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, code: error.code ?? null, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/files/write-text") {
    try {
      const body = await readJsonBody(req);
      const result = writeTextFile(body);
      await publishEvent("system.files.written", {
        path: result.path,
        contentBytes: result.contentBytes,
        overwrite: result.overwrite,
      });
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, code: error.code ?? null, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/files/append-text") {
    try {
      const body = await readJsonBody(req);
      const result = appendTextFile(body);
      await publishEvent("system.files.appended", {
        path: result.path,
        contentBytes: result.contentBytes,
        previousBytes: result.previousBytes,
        totalBytes: result.totalBytes,
      });
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, code: error.code ?? null, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/files/mkdir") {
    try {
      const body = await readJsonBody(req);
      const result = createDirectory(body);
      await publishEvent("system.files.directory_created", {
        path: result.path,
        recursive: result.recursive,
        created: result.created,
      });
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, code: error.code ?? null, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/processes") {
    try {
      const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "50", 10);
      const result = await listProcesses({
        query: requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q") ?? "",
        limit,
      });
      await publishEvent("system.processes.listed", {
        count: result.count,
        query: result.query,
      });
      sendJson(res, 200, {
        ok: true,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 500, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/command/dry-run") {
    try {
      const body = await readJsonBody(req);
      const plan = buildCommandDryRun(body);
      await publishEvent("system.command.planned", { plan });
      sendJson(res, 200, {
        ok: true,
        plan,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/command/execute") {
    try {
      const body = await readJsonBody(req);
      const execution = await executeCommand(body);
      await publishEvent("system.command.executed", {
        command: execution.command,
        cwd: execution.cwd,
        exitCode: execution.result.exitCode,
        timedOut: execution.result.timedOut,
        durationMs: execution.result.durationMs,
      });
      sendJson(res, 200, {
        ok: true,
        execution,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, code: error.code ?? null, details: error.details ?? null });
    }
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/refresh") {
    await refreshSystemState();
    await publishEvent(systemState.alerts.length > 0 ? "service.failed" : "system.updated", {
      alerts: systemState.alerts,
      services: systemState.services,
      resources: systemState.resources,
      body: systemState.body,
    });
    sendJson(res, 200, {
      ok: true,
      system: { ...systemState },
    });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Route not found." });
});

server.listen(port, host, async () => {
  console.log(`openclaw-system-sense listening on http://${host}:${port}`);
  await publishEvent("service.started", {
    service: "openclaw-system-sense",
    url: `http://${host}:${port}`,
  });
});

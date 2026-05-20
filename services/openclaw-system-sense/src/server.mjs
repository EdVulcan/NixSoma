import http from "node:http";
import { randomUUID } from "node:crypto";
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
const PHASE_2_ROUTE_REVIEW_REGISTRY = "openclaw-phase-2-route-review-v0";
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
  if (!existsSync(resolved.path)) {
    const error = new Error("Target file must exist for append-text.");
    error.code = "TARGET_NOT_FOUND";
    throw error;
  }

  const existingStats = statSync(resolved.path);
  if (!existingStats.isFile()) {
    const error = new Error("Cannot append text to a non-file target.");
    error.code = "TARGET_NOT_FILE";
    throw error;
  }

  const previousBytes = existingStats.size;
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

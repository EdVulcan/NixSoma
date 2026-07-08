import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const defaultExecFileAsync = promisify(execFile);

export function createSystemCommandOperations({
  commandAllowlist = [],
  commandTimeoutMs = 3000,
  commandOutputLimit = 8192,
  resolveAllowedPath,
  defaultCwd = process.cwd(),
  execFileAsync = defaultExecFileAsync,
  execFileImpl = execFile,
  getUid = typeof process.getuid === "function" ? process.getuid.bind(process) : null,
} = {}) {
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
    execFileImpl(command, args, options, (error, stdout = "", stderr = "") => {
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
  if (typeof getUid === "function" && getUid() === 0) {
    const error = new Error("Refusing to execute commands from a root system-sense process.");
    error.code = "ROOT_EXECUTION_REFUSED";
    throw error;
  }

  const command = assertCommandAllowed(body.command);
  const args = normaliseCommandArgs(body.args);
  const cwdResult = resolveAllowedPath(body.cwd ?? body.workingDirectory ?? defaultCwd);
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


  return {
    listProcesses,
    buildCommandDryRun,
    executeCommand,
  };
}

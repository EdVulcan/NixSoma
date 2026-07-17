import { createHash, randomUUID } from "node:crypto";
import { execFile as nodeExecFile } from "node:child_process";
import { access, lstat, readFile, rename, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

import {
  HOSTD_ACTIVATION_CAPABILITY_REGISTRY,
  HOSTD_ACTIVATION_CAPABILITY_ID,
  HOSTD_ACTIVATION_MAX_AGE_MS,
  HOSTD_ACTIVATION_OPERATION,
  HOSTD_ACTIVATION_RECEIPT_REGISTRY,
  HOSTD_ACTIVATION_TARGET_PATH,
  hashManagedConfigActivationReceipt,
  parseActivationExpiry,
  isNixStorePath,
  isSha256,
} from "../../../packages/shared-systemd/src/openclaw-hostd-activation.mjs";

const execFile = promisify(nodeExecFile);
const DEFAULT_STAGING_DIRECTORY = "/var/lib/openclaw/managed-config-staging";
const DEFAULT_NIXOS_REBUILD = "/run/current-system/sw/bin/nixos-rebuild";
const DEFAULT_FLAKE_ATTRIBUTE = "openclaw-local-dev";
const MAX_OUTPUT_CHARS = 4096;

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function boundedText(value) {
  return typeof value === "string" ? value.slice(0, MAX_OUTPUT_CHARS) : "";
}

function requestAgeMs(expiresAt, nowMs) {
  const expiry = parseActivationExpiry(expiresAt);
  if (expiry === null) return null;
  return expiry - nowMs;
}

function expectedStagingPath(stagingDirectory, candidateHash) {
  return path.join(path.resolve(stagingDirectory), `openclaw-managed-${candidateHash}.nix`);
}

function activationError(message, code = "activation_failed") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function buildReceipt({
  request,
  status,
  activationExecuted,
  candidateBytes = null,
  previousTargetHash = null,
  command = null,
  result = null,
  startedAt,
  completedAt,
  error = null,
}) {
  const receipt = {
    registry: HOSTD_ACTIVATION_RECEIPT_REGISTRY,
    version: 1,
    receiptId: randomUUID(),
    requestId: request.requestId,
    operation: HOSTD_ACTIVATION_OPERATION,
    targetPath: request.target,
    stagingPath: request.stagingPath,
    candidateHash: request.candidateHash,
    candidateBytes,
    evaluatedClosurePath: request.evaluatedClosurePath,
    sourceStagingTaskId: request.sourceStagingTaskId ?? null,
    activationTaskId: request.activationTaskId ?? null,
    activationDecisionTaskId: request.activationDecisionTaskId ?? null,
    previousTargetHash,
    command,
    status,
    activationExecuted,
    generationSwitched: status === "passed",
    rollbackExecuted: false,
    startedAt,
    completedAt,
    result: result
      ? { exitCode: result.exitCode ?? null, stdout: boundedText(result.stdout), stderr: boundedText(result.stderr) }
      : null,
    error: error ? { code: error.code ?? "activation_failed", message: boundedText(error.message) } : null,
  };
  return { ...receipt, receiptHash: hashManagedConfigActivationReceipt(receipt) };
}

export function createManagedConfigActivationRunner({
  enabled = process.env.OPENCLAW_HOSTD_ACTIVATION_ENABLED === "true",
  stagingDirectory = process.env.OPENCLAW_MANAGED_CONFIG_STAGING_DIR ?? DEFAULT_STAGING_DIRECTORY,
  targetPath = HOSTD_ACTIVATION_TARGET_PATH,
  nixosRebuild = process.env.OPENCLAW_NIXOS_REBUILD ?? DEFAULT_NIXOS_REBUILD,
  flakePath = process.env.OPENCLAW_NIXOS_FLAKE ?? "/etc/nixos",
  flakeAttribute = process.env.OPENCLAW_NIXOS_FLAKE_ATTRIBUTE ?? DEFAULT_FLAKE_ATTRIBUTE,
  now = () => Date.now(),
  readFileImpl = readFile,
  lstatImpl = lstat,
  accessImpl = access,
  renameImpl = rename,
  writeFileImpl = writeFile,
  execFileImpl = execFile,
} = {}) {
  const resolvedStagingDirectory = path.resolve(stagingDirectory);

  return async function runManagedConfigActivation(request) {
    const startedAt = new Date(now()).toISOString();
    let candidateBytes = null;
    let previousTargetHash = null;
    let command = null;
    let activationExecuted = false;
    try {
      if (enabled !== true) throw activationError("Managed config activation is disabled on this host.", "activation_disabled");
      if (request.target !== targetPath || targetPath !== HOSTD_ACTIVATION_TARGET_PATH) {
        throw activationError("Managed config activation target is not the fixed OpenClaw target.", "target_rejected");
      }
      if (!isSha256(request.candidateHash) || !isNixStorePath(request.evaluatedClosurePath)) {
        throw activationError("Managed config activation requires a bound candidate hash and Nix store closure.", "binding_rejected");
      }
      const remainingLifetime = requestAgeMs(request.expiresAt, now());
      if (remainingLifetime === null || remainingLifetime < 0 || remainingLifetime > HOSTD_ACTIVATION_MAX_AGE_MS) {
        throw activationError("Managed config activation request is expired or exceeds the bounded lifetime.", "request_expired");
      }
      const expectedPath = expectedStagingPath(resolvedStagingDirectory, request.candidateHash);
      if (path.resolve(request.stagingPath) !== expectedPath) {
        throw activationError("Managed config activation staging path is not hash-bound.", "staging_path_rejected");
      }
      await accessImpl(request.evaluatedClosurePath);
      const candidateText = await readFileImpl(expectedPath, { encoding: "utf8" });
      candidateBytes = Buffer.byteLength(candidateText, "utf8");
      if (sha256(candidateText) !== request.candidateHash) {
        throw activationError("Managed config activation candidate hash does not match staging bytes.", "candidate_hash_mismatch");
      }

      try {
        const previousStat = await lstatImpl(targetPath);
        if (previousStat.isSymbolicLink()) throw activationError("Managed config activation refuses a symlink target.", "target_symlink_rejected");
        previousTargetHash = sha256(await readFileImpl(targetPath, { encoding: "utf8" }));
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }

      const temporaryTarget = `${targetPath}.openclaw-${request.requestId}.tmp`;
      await writeFileImpl(temporaryTarget, candidateText, { encoding: "utf8", mode: 0o640, flag: "wx" });
      await renameImpl(temporaryTarget, targetPath);
      command = {
        executable: nixosRebuild,
        args: ["switch", "--flake", `${flakePath}#${flakeAttribute}`],
      };
      activationExecuted = true;
      const result = await execFileImpl(nixosRebuild, command.args, {
        cwd: "/etc/nixos",
        timeout: 120000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });
      const completedAt = new Date(now()).toISOString();
      return buildReceipt({
        request,
        status: "passed",
        activationExecuted,
        candidateBytes,
        previousTargetHash,
        command,
        result: { exitCode: 0, stdout: result.stdout, stderr: result.stderr },
        startedAt,
        completedAt,
      });
    } catch (error) {
      const completedAt = new Date(now()).toISOString();
      return buildReceipt({
        request,
        status: "failed",
        activationExecuted,
        candidateBytes,
        previousTargetHash,
        command,
        result: error?.stdout || error?.stderr ? { exitCode: error.code ?? 1, stdout: error.stdout, stderr: error.stderr } : null,
        startedAt,
        completedAt,
        error,
      });
    }
  };
}

export const runFixedManagedConfigActivation = createManagedConfigActivationRunner();

export {
  HOSTD_ACTIVATION_CAPABILITY_ID,
  HOSTD_ACTIVATION_CAPABILITY_REGISTRY,
  HOSTD_ACTIVATION_OPERATION,
  HOSTD_ACTIVATION_TARGET_PATH,
};

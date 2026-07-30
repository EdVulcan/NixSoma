import { createHash, randomUUID } from "node:crypto";
import { execFile as nodeExecFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

import {
  HOSTD_ACTIVATION_CAPABILITY_REGISTRY,
  HOSTD_ACTIVATION_CAPABILITY_ID,
  HOSTD_ACTIVATION_HELPER_RECEIPT_REGISTRY,
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

function parseHelperEvidence(stdout) {
  try {
    return JSON.parse(String(stdout ?? "").trim());
  } catch {
    throw activationError("Managed config activation helper returned invalid evidence.", "activation_helper_evidence_invalid");
  }
}

function validateHelperEvidence(evidence, request) {
  return evidence?.registry === HOSTD_ACTIVATION_HELPER_RECEIPT_REGISTRY
    && evidence.candidateHash === request.candidateHash
    && evidence.evaluatedClosurePath === request.evaluatedClosurePath
    && (evidence.previousTargetHash === null || isSha256(evidence.previousTargetHash))
    && isNixStorePath(evidence.generationBefore)
    && evidence.generationBefore !== request.evaluatedClosurePath
    && evidence.generationAfter === request.evaluatedClosurePath
    && evidence.profileAfter === request.evaluatedClosurePath
    && evidence.targetHashAfter === request.candidateHash
    && evidence.targetInstalled === true
    && evidence.rollbackExecuted === false;
}

function buildReceipt({
  request,
  status,
  activationExecuted,
  candidateBytes = null,
  previousTargetHash = null,
  command = null,
  helperEvidence = null,
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
    previousGenerationPath: helperEvidence?.generationBefore ?? null,
    activatedGenerationPath: helperEvidence?.generationAfter ?? null,
    activatedProfilePath: helperEvidence?.profileAfter ?? null,
    helperEvidence,
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
  activationHelper = process.env.OPENCLAW_HOSTD_ACTIVATION_HELPER ?? null,
  sudoExecutable = process.env.OPENCLAW_HOSTD_ACTIVATION_SUDO ?? null,
  now = () => Date.now(),
  readFileImpl = readFile,
  accessImpl = access,
  execFileImpl = execFile,
} = {}) {
  const resolvedStagingDirectory = path.resolve(stagingDirectory);

  return async function runManagedConfigActivation(request) {
    const startedAt = new Date(now()).toISOString();
    let candidateBytes = null;
    let previousTargetHash = null;
    let command = null;
    let helperEvidence = null;
    let activationExecuted = false;
    try {
      if (enabled !== true) throw activationError("Managed config activation is disabled on this host.", "activation_disabled");
      if (request.target !== targetPath || targetPath !== HOSTD_ACTIVATION_TARGET_PATH) {
        throw activationError("Managed config activation target is not the fixed OpenClaw target.", "target_rejected");
      }
      if (!isSha256(request.candidateHash) || !isNixStorePath(request.evaluatedClosurePath)) {
        throw activationError("Managed config activation requires a bound candidate hash and Nix store closure.", "binding_rejected");
      }
      if (typeof activationHelper !== "string" || !path.isAbsolute(activationHelper)
        || typeof sudoExecutable !== "string" || !path.isAbsolute(sudoExecutable)) {
        throw activationError("Managed config activation requires one fixed privileged helper.", "activation_helper_unconfigured");
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

      command = {
        executable: sudoExecutable,
        args: ["--non-interactive", activationHelper, request.candidateHash, request.evaluatedClosurePath],
      };
      activationExecuted = true;
      const result = await execFileImpl(command.executable, command.args, {
        cwd: resolvedStagingDirectory,
        timeout: 120000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });
      helperEvidence = parseHelperEvidence(result.stdout);
      if (!validateHelperEvidence(helperEvidence, request)) {
        throw activationError("Managed config activation helper evidence did not match the bound candidate and generation.", "activation_helper_evidence_mismatch");
      }
      previousTargetHash = helperEvidence.previousTargetHash;
      const completedAt = new Date(now()).toISOString();
      return buildReceipt({
        request,
        status: "passed",
        activationExecuted,
        candidateBytes,
        previousTargetHash,
        command,
        helperEvidence,
        result: { exitCode: 0, stdout: "", stderr: "" },
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
        helperEvidence,
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

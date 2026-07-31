import { randomUUID } from "node:crypto";
import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

import {
  HOSTD_ROLLBACK_CAPABILITY_ID,
  HOSTD_ROLLBACK_CAPABILITY_REGISTRY,
  HOSTD_ROLLBACK_HELPER_RECEIPT_REGISTRY,
  HOSTD_ROLLBACK_MAX_AGE_MS,
  HOSTD_ROLLBACK_OPERATION,
  HOSTD_ROLLBACK_RECEIPT_REGISTRY,
  HOSTD_ROLLBACK_TARGET_PATH,
  hashManagedConfigRollbackReceipt,
  isRollbackSnapshotId,
} from "../../../packages/shared-systemd/src/openclaw-hostd-rollback.mjs";
import {
  isNixStorePath,
  isSha256,
  parseActivationExpiry,
} from "../../../packages/shared-systemd/src/openclaw-hostd-activation.mjs";

const execFile = promisify(nodeExecFile);
const MAX_OUTPUT_CHARS = 4096;

function boundedText(value) {
  return typeof value === "string" ? value.slice(0, MAX_OUTPUT_CHARS) : "";
}

function rollbackError(message, code = "rollback_failed") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseHelperEvidence(stdout) {
  try {
    return JSON.parse(String(stdout ?? "").trim());
  } catch {
    throw rollbackError("Managed config rollback helper returned invalid evidence.", "rollback_helper_evidence_invalid");
  }
}

function validateHelperEvidence(evidence, request) {
  return evidence?.registry === HOSTD_ROLLBACK_HELPER_RECEIPT_REGISTRY
    && evidence.rollbackSnapshotId === request.rollbackSnapshotId
    && evidence.candidateHash === request.candidateHash
    && evidence.generationBefore === request.activatedGenerationPath
    && evidence.profileBefore === request.activatedGenerationPath
    && evidence.generationAfter === request.previousGenerationPath
    && evidence.profileAfter === request.previousGenerationPath
    && evidence.targetHashBefore === request.candidateHash
    && evidence.previousTargetPresent === request.previousTargetPresent
    && evidence.previousTargetHash === request.previousTargetHash
    && evidence.targetPresentAfter === request.previousTargetPresent
    && evidence.targetHashAfter === request.previousTargetHash
    && evidence.rollbackExecuted === true
    && evidence.snapshotConsumed === true;
}

function buildReceipt({ request, status, command = null, helperEvidence = null, result = null, startedAt, completedAt, error = null }) {
  const passed = status === "passed";
  const receipt = {
    registry: HOSTD_ROLLBACK_RECEIPT_REGISTRY,
    version: 1,
    receiptId: randomUUID(),
    requestId: request.requestId,
    operation: HOSTD_ROLLBACK_OPERATION,
    targetPath: request.target,
    activationTaskId: request.activationTaskId,
    rollbackTaskId: request.rollbackTaskId,
    activationReceiptHash: request.activationReceiptHash,
    rollbackSnapshotId: request.rollbackSnapshotId,
    candidateHash: request.candidateHash,
    previousGenerationPath: request.previousGenerationPath,
    activatedGenerationPath: request.activatedGenerationPath,
    previousTargetPresent: request.previousTargetPresent,
    previousTargetHash: request.previousTargetHash,
    helperEvidence,
    command,
    status,
    rollbackExecuted: passed,
    generationRestored: passed,
    snapshotConsumed: passed,
    startedAt,
    completedAt,
    result: result
      ? { exitCode: result.exitCode ?? null, stdout: boundedText(result.stdout), stderr: boundedText(result.stderr) }
      : null,
    error: error ? { code: error.code ?? "rollback_failed", message: boundedText(error.message) } : null,
  };
  return { ...receipt, receiptHash: hashManagedConfigRollbackReceipt(receipt) };
}

export function createManagedConfigRollbackRunner({
  enabled = process.env.OPENCLAW_HOSTD_ACTIVATION_ENABLED === "true",
  targetPath = HOSTD_ROLLBACK_TARGET_PATH,
  rollbackHelper = process.env.OPENCLAW_HOSTD_ROLLBACK_HELPER ?? null,
  sudoExecutable = process.env.OPENCLAW_HOSTD_ROLLBACK_SUDO ?? null,
  now = () => Date.now(),
  execFileImpl = execFile,
} = {}) {
  return async function runManagedConfigRollback(request) {
    const startedAt = new Date(now()).toISOString();
    let command = null;
    let helperEvidence = null;
    try {
      if (enabled !== true) throw rollbackError("Managed config rollback is disabled on this host.", "rollback_disabled");
      if (request.target !== targetPath || targetPath !== HOSTD_ROLLBACK_TARGET_PATH) {
        throw rollbackError("Managed config rollback target is not the fixed OpenClaw target.", "target_rejected");
      }
      if (!isRollbackSnapshotId(request.rollbackSnapshotId)
        || !isSha256(request.activationReceiptHash)
        || !isSha256(request.candidateHash)
        || !isNixStorePath(request.previousGenerationPath)
        || !isNixStorePath(request.activatedGenerationPath)
        || request.previousGenerationPath === request.activatedGenerationPath
        || typeof request.previousTargetPresent !== "boolean"
        || !(request.previousTargetHash === null || isSha256(request.previousTargetHash))
        || request.previousTargetPresent !== (request.previousTargetHash !== null)) {
        throw rollbackError("Managed config rollback requires one exact activation receipt binding.", "binding_rejected");
      }
      if (typeof rollbackHelper !== "string" || !path.isAbsolute(rollbackHelper)
        || typeof sudoExecutable !== "string" || !path.isAbsolute(sudoExecutable)) {
        throw rollbackError("Managed config rollback requires one fixed privileged helper.", "rollback_helper_unconfigured");
      }
      const expiry = parseActivationExpiry(request.expiresAt);
      const remainingLifetime = expiry === null ? null : expiry - now();
      if (remainingLifetime === null || remainingLifetime < 0 || remainingLifetime > HOSTD_ROLLBACK_MAX_AGE_MS) {
        throw rollbackError("Managed config rollback request is expired or exceeds the bounded lifetime.", "request_expired");
      }

      command = {
        executable: sudoExecutable,
        args: ["--non-interactive", rollbackHelper, request.rollbackSnapshotId],
      };
      const result = await execFileImpl(command.executable, command.args, {
        timeout: 120000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });
      helperEvidence = parseHelperEvidence(result.stdout);
      if (!validateHelperEvidence(helperEvidence, request)) {
        throw rollbackError("Managed config rollback helper evidence did not match the activation receipt.", "rollback_helper_evidence_mismatch");
      }
      return buildReceipt({
        request,
        status: "passed",
        command,
        helperEvidence,
        result: { exitCode: 0, stdout: "", stderr: "" },
        startedAt,
        completedAt: new Date(now()).toISOString(),
      });
    } catch (error) {
      return buildReceipt({
        request,
        status: "failed",
        command,
        helperEvidence,
        result: error?.stdout || error?.stderr
          ? { exitCode: error.code ?? 1, stdout: error.stdout, stderr: error.stderr }
          : null,
        startedAt,
        completedAt: new Date(now()).toISOString(),
        error,
      });
    }
  };
}

export const runFixedManagedConfigRollback = createManagedConfigRollbackRunner();

export {
  HOSTD_ROLLBACK_CAPABILITY_ID,
  HOSTD_ROLLBACK_CAPABILITY_REGISTRY,
  HOSTD_ROLLBACK_OPERATION,
  HOSTD_ROLLBACK_TARGET_PATH,
};

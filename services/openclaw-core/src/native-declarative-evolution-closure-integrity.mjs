import { createHash, randomUUID } from "node:crypto";
import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFile = promisify(nodeExecFile);
const MAX_OUTPUT_CHARS = 4096;
const DEFAULT_QUERY_TIMEOUT_MS = 30_000;

export const NATIVE_DECLARATIVE_EVOLUTION_CLOSURE_INTEGRITY_REGISTRY = "openclaw-native-declarative-evolution-closure-integrity-v0";
export const NATIVE_DECLARATIVE_EVOLUTION_CLOSURE_INTEGRITY_RECEIPT_REGISTRY = "openclaw-native-declarative-evolution-closure-integrity-receipt-v0";

function canonicalise(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalise);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalise(value[key])]));
}
function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(canonicalise(value)), "utf8").digest("hex");
}

function boundedText(value) {
  return typeof value === "string" ? value.slice(0, MAX_OUTPUT_CHARS) : "";
}

export function isNixStorePath(value) {
  return typeof value === "string" && /^\/nix\/store\/[a-z0-9][a-z0-9+._?=-]*$/u.test(value);
}

export function isNixDerivationPath(value) {
  return isNixStorePath(value) && value.endsWith(".drv");
}

function normaliseNixStoreReference(value) {
  if (isNixStorePath(value)) return value;
  if (typeof value === "string" && /^[a-z0-9][a-z0-9+._?=-]*$/u.test(value)) {
    return `/nix/store/${value}`;
  }
  return null;
}

export function isNixNarHash(value) {
  return typeof value === "string" && /^sha256-[A-Za-z0-9+/=]+$/u.test(value);
}

export function hashNativeDeclarativeEvolutionClosureReceipt(receipt) {
  const { receiptHash: _ignored, ...unsignedReceipt } = receipt ?? {};
  return sha256Json(unsignedReceipt);
}

function approvalRecordProjection(approval) {
  return {
    id: approval?.id ?? null,
    taskId: approval?.taskId ?? null,
    status: approval?.status ?? null,
    policyDecisionId: approval?.policyDecisionId ?? null,
    intent: approval?.intent ?? null,
    domain: approval?.domain ?? null,
    risk: approval?.risk ?? null,
    decision: approval?.decision ?? null,
    approvedBy: approval?.approvedBy ?? null,
    deniedBy: approval?.deniedBy ?? null,
    createdAt: approval?.createdAt ?? null,
    updatedAt: approval?.updatedAt ?? null,
    resolvedAt: approval?.resolvedAt ?? null,
    binding: approval?.binding ?? null,
  };
}

export function hashNativeDeclarativeEvolutionApprovalRecord(approval) {
  return sha256Json(approvalRecordProjection(approval));
}

function parsePathInfo(stdout, storePath) {
  let parsed;
  try {
    parsed = JSON.parse(String(stdout ?? "").trim());
  } catch {
    return { status: "failed", reason: "nix_path_info_invalid_json" };
  }

  const info = parsed?.info && typeof parsed.info === "object" ? parsed.info : parsed;
  if (!info || typeof info !== "object" || Array.isArray(info)) {
    return { status: "failed", reason: "nix_path_info_invalid_shape" };
  }
  const expectedName = path.basename(storePath);
  const entry = Object.entries(info).find(([key, value]) => key === expectedName
    || value?.path === storePath
    || `/nix/store/${key}` === storePath);
  if (!entry || !entry[1] || typeof entry[1] !== "object") {
    return { status: "failed", reason: "nix_path_info_output_not_found" };
  }

  const record = entry[1];
  const derivationPath = normaliseNixStoreReference(record.deriver);
  const narHash = record.narHash ?? null;
  const narSize = record.narSize ?? null;
  if (!isNixDerivationPath(derivationPath)) {
    return { status: "failed", reason: "nix_path_info_derivation_missing" };
  }
  if (!isNixNarHash(narHash)) {
    return { status: "failed", reason: "nix_path_info_nar_hash_missing" };
  }
  if (!Number.isInteger(narSize) || narSize < 0) {
    return { status: "failed", reason: "nix_path_info_nar_size_invalid" };
  }

  return {
    status: "passed",
    mode: "nix-path-info",
    outputPath: storePath,
    derivationPath,
    narHash,
    narSize,
    referenceCount: Array.isArray(record.references) ? record.references.length : null,
  };
}

export function createNativeDeclarativeEvolutionClosureQuery({
  nixCommand = process.env.OPENCLAW_NIX_COMMAND ?? "nix",
  timeoutMs = Number.parseInt(process.env.OPENCLAW_NIX_CLOSURE_QUERY_TIMEOUT_MS ?? `${DEFAULT_QUERY_TIMEOUT_MS}`, 10),
  execFileImpl = execFile,
} = {}) {
  const safeTimeoutMs = Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_QUERY_TIMEOUT_MS;

  return async function queryNativeDeclarativeEvolutionClosure({ storePath } = {}) {
    if (!isNixStorePath(storePath)) {
      return { status: "blocked", reason: "evaluated_closure_path_invalid" };
    }
    try {
      const result = await execFileImpl(nixCommand, [
        "--extra-experimental-features",
        "nix-command flakes",
        "path-info",
        "--json-format",
        "2",
        "--json",
        storePath,
      ], {
        timeout: safeTimeoutMs,
        maxBuffer: MAX_OUTPUT_CHARS * 4,
        windowsHide: true,
      });
      return parsePathInfo(result?.stdout, storePath);
    } catch (error) {
      return {
        status: error?.code === "ENOENT" ? "unavailable" : "failed",
        reason: error?.killed ? "nix_path_info_timeout" : error?.code === "ENOENT"
          ? "nix_command_unavailable"
          : "nix_path_info_failed",
        exitCode: Number.isInteger(error?.status) ? error.status : null,
        error: boundedText(error?.stderr ?? error?.message),
      };
    }
  };
}

export function createNativeDeclarativeEvolutionClosureIntegrityReceipt({
  receiptId = randomUUID(),
  issuedAt,
  sourceStagingTaskId,
  approval,
  candidateHash,
  candidateBytes,
  stagedFileHash,
  stagedFileBytes,
  evaluatedClosurePath,
  closure,
} = {}) {
  const receipt = {
    registry: NATIVE_DECLARATIVE_EVOLUTION_CLOSURE_INTEGRITY_RECEIPT_REGISTRY,
    version: 1,
    receiptId,
    issuedAt: issuedAt ?? new Date().toISOString(),
    sourceStagingTaskId: sourceStagingTaskId ?? null,
    approvalId: approval?.id ?? null,
    approvalStatus: approval?.status ?? null,
    approvalRecordHash: hashNativeDeclarativeEvolutionApprovalRecord(approval),
    candidateHash: candidateHash ?? null,
    candidateBytes: candidateBytes ?? null,
    stagedFileHash: stagedFileHash ?? null,
    stagedFileBytes: stagedFileBytes ?? null,
    evaluatedClosurePath: evaluatedClosurePath ?? null,
    derivationPath: closure?.derivationPath ?? null,
    narHash: closure?.narHash ?? null,
    narSize: closure?.narSize ?? null,
    queryMode: closure?.mode ?? null,
    status: closure?.status ?? null,
  };
  return Object.freeze({ ...receipt, receiptHash: hashNativeDeclarativeEvolutionClosureReceipt(receipt) });
}

export function validateNativeDeclarativeEvolutionClosureIntegrityReceipt(receipt) {
  return Boolean(receipt)
    && typeof receipt === "object"
    && receipt.registry === NATIVE_DECLARATIVE_EVOLUTION_CLOSURE_INTEGRITY_RECEIPT_REGISTRY
    && receipt.version === 1
    && typeof receipt.receiptHash === "string"
    && receipt.receiptHash === hashNativeDeclarativeEvolutionClosureReceipt(receipt)
    && typeof receipt.receiptId === "string"
    && typeof receipt.issuedAt === "string"
    && typeof receipt.sourceStagingTaskId === "string"
    && typeof receipt.approvalId === "string"
    && receipt.approvalStatus === "approved"
    && /^[a-f0-9]{64}$/u.test(receipt.approvalRecordHash ?? "")
    && /^[a-f0-9]{64}$/u.test(receipt.candidateHash ?? "")
    && Number.isInteger(receipt.candidateBytes)
    && receipt.candidateBytes >= 0
    && /^[a-f0-9]{64}$/u.test(receipt.stagedFileHash ?? "")
    && Number.isInteger(receipt.stagedFileBytes)
    && receipt.stagedFileBytes >= 0
    && isNixStorePath(receipt.evaluatedClosurePath)
    && isNixDerivationPath(receipt.derivationPath)
    && isNixNarHash(receipt.narHash)
    && Number.isInteger(receipt.narSize)
    && receipt.narSize >= 0
    && receipt.status === "passed";
}

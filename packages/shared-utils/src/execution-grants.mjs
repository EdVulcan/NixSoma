import fs from "node:fs";
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign,
  verify,
} from "node:crypto";

export const EXECUTION_GRANT_HEADER = "x-openclaw-execution-grant";
export const EXECUTION_GRANT_ISSUER = "openclaw-core";
export const EXECUTION_GRANT_VERSION = 1;

const DEFAULT_TTL_MS = 10_000;
const MAX_TTL_MS = 60_000;
const MAX_TOKEN_CHARS = 16_384;

function canonicalise(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalise);
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalise(value[key])]),
  );
}

function boundedContextValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= 200 ? trimmed : null;
}

export function normaliseExecutionGrantContext(context = {}) {
  return {
    taskId: boundedContextValue(context.taskId),
    stepId: boundedContextValue(context.stepId),
    capabilityId: boundedContextValue(context.capabilityId),
    intent: boundedContextValue(context.intent),
  };
}

function normaliseMethod(method) {
  return typeof method === "string" && method.trim()
    ? method.trim().toUpperCase()
    : "POST";
}

function normalisePath(pathname) {
  const value = typeof pathname === "string" ? pathname.trim() : "";
  if (!value || !value.startsWith("/")) {
    throw new Error("Execution grant target path must be an absolute URL path.");
  }
  if (value.length > 2_048) {
    throw new Error("Execution grant target path is too long.");
  }
  return value;
}

function normaliseAudience(audience) {
  const value = typeof audience === "string" ? audience.trim() : "";
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/u.test(value)) {
    throw new Error("Execution grant audience is invalid.");
  }
  return value;
}

function readKeyFile(filePath, label) {
  const value = typeof filePath === "string" ? filePath.trim() : "";
  if (!value) return null;
  try {
    return fs.readFileSync(value, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : "unable to read key file";
    throw new Error(`Unable to read OpenClaw ${label} file: ${message}`);
  }
}

function resolveKey({ key, keyFilePath, kind, required }) {
  const material = key ?? readKeyFile(keyFilePath, kind);
  if (!material) {
    if (required) {
      throw new Error(`OpenClaw execution grant ${kind} key is required.`);
    }
    return null;
  }
  try {
    return kind === "private"
      ? createPrivateKey(material)
      : createPublicKey(material);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid key";
    throw new Error(`OpenClaw execution grant ${kind} key is invalid: ${message}`);
  }
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(canonicalise(payload)), "utf8").toString("base64url");
}

function decodePayload(encoded) {
  if (typeof encoded !== "string" || !encoded || encoded.length > MAX_TOKEN_CHARS) {
    throw new Error("Execution grant payload is invalid.");
  }
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Execution grant payload is invalid.");
  }
  return payload;
}

function encodeSignature(value) {
  return Buffer.from(value).toString("base64url");
}

function decodeSignature(value) {
  if (typeof value !== "string" || !value || value.length > MAX_TOKEN_CHARS) {
    throw new Error("Execution grant signature is invalid.");
  }
  return Buffer.from(value, "base64url");
}

export function hashExecutionGrantRequest({ method, path, body, context = {} } = {}) {
  const payload = canonicalise({
    method: normaliseMethod(method),
    path: normalisePath(path),
    body: body === undefined ? null : body,
    context: normaliseExecutionGrantContext(context),
  });
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

export function createExecutionGrantSigner({
  privateKey = null,
  privateKeyFilePath = process.env.OPENCLAW_EXECUTION_GRANT_PRIVATE_KEY_FILE,
  issuer = EXECUTION_GRANT_ISSUER,
  ttlMs = DEFAULT_TTL_MS,
  now = () => Date.now(),
  createId = randomUUID,
  required = false,
} = {}) {
  const signingKey = resolveKey({
    key: privateKey,
    keyFilePath: privateKeyFilePath,
    kind: "private",
    required,
  });
  if (!signingKey) return null;

  const safeIssuer = normaliseAudience(issuer);
  const safeTtlMs = Number.isFinite(ttlMs) && ttlMs > 0
    ? Math.min(ttlMs, MAX_TTL_MS)
    : DEFAULT_TTL_MS;

  function issue({ audience, method = "POST", path, body = null, context = {} } = {}) {
    const safeAudience = normaliseAudience(audience);
    const safeMethod = normaliseMethod(method);
    const safePath = normalisePath(path);
    const safeContext = normaliseExecutionGrantContext(context);
    const issuedAt = now();
    const payload = {
      version: EXECUTION_GRANT_VERSION,
      grantId: createId(),
      issuer: safeIssuer,
      audience: safeAudience,
      method: safeMethod,
      path: safePath,
      requestHash: hashExecutionGrantRequest({
        method: safeMethod,
        path: safePath,
        body,
        context: safeContext,
      }),
      ...safeContext,
      issuedAt,
      expiresAt: issuedAt + safeTtlMs,
      useCount: 1,
    };
    const encodedPayload = encodePayload(payload);
    const signature = sign(null, Buffer.from(encodedPayload, "utf8"), signingKey);
    return `${encodedPayload}.${encodeSignature(signature)}`;
  }

  return Object.freeze({
    issue,
    issuer: safeIssuer,
  });
}

function invalidGrant(code, reason, statusCode = 403) {
  return { ok: false, code, reason, statusCode };
}

export function createExecutionGrantVerifier({
  publicKey = null,
  publicKeyFilePath = process.env.OPENCLAW_EXECUTION_GRANT_PUBLIC_KEY_FILE,
  audience,
  issuer = EXECUTION_GRANT_ISSUER,
  now = () => Date.now(),
  required = false,
} = {}) {
  const verificationKey = resolveKey({
    key: publicKey,
    keyFilePath: publicKeyFilePath,
    kind: "public",
    required,
  });
  const safeAudience = normaliseAudience(audience);
  const safeIssuer = normaliseAudience(issuer);
  const consumed = new Map();

  function pruneConsumed(currentTime) {
    for (const [grantId, expiresAt] of consumed) {
      if (expiresAt <= currentTime) consumed.delete(grantId);
    }
  }

  function verifyRequest({ token, method = "POST", path, body = null, context = {} } = {}) {
    const currentTime = now();
    pruneConsumed(currentTime);
    if (!verificationKey) {
      return invalidGrant("EXECUTION_GRANT_VERIFIER_UNAVAILABLE", "Actuator execution grants are not configured.", 503);
    }
    if (typeof token !== "string" || token.length > MAX_TOKEN_CHARS * 2) {
      return invalidGrant("EXECUTION_GRANT_REQUIRED", "A Core-issued execution grant is required.", 401);
    }

    let encodedPayload;
    let signature;
    let payload;
    try {
      const separator = token.indexOf(".");
      if (separator < 1 || separator === token.length - 1) {
        return invalidGrant("EXECUTION_GRANT_MALFORMED", "Execution grant format is invalid.");
      }
      encodedPayload = token.slice(0, separator);
      signature = decodeSignature(token.slice(separator + 1));
      payload = decodePayload(encodedPayload);
    } catch {
      return invalidGrant("EXECUTION_GRANT_MALFORMED", "Execution grant format is invalid.");
    }

    if (!verify(null, Buffer.from(encodedPayload, "utf8"), verificationKey, signature)) {
      return invalidGrant("EXECUTION_GRANT_SIGNATURE_INVALID", "Execution grant signature is invalid.");
    }
    if (payload.version !== EXECUTION_GRANT_VERSION || payload.issuer !== safeIssuer || payload.audience !== safeAudience) {
      return invalidGrant("EXECUTION_GRANT_AUDIENCE_INVALID", "Execution grant audience is invalid.");
    }
    if (typeof payload.grantId !== "string" || !payload.grantId || payload.useCount !== 1) {
      return invalidGrant("EXECUTION_GRANT_REPLAYED", "Execution grant use count is invalid.");
    }
    if (!Number.isInteger(payload.issuedAt) || !Number.isInteger(payload.expiresAt)
      || payload.expiresAt <= currentTime || payload.issuedAt > currentTime + 5_000) {
      return invalidGrant("EXECUTION_GRANT_EXPIRED", "Execution grant is expired or not yet valid.");
    }
    if (consumed.has(payload.grantId)) {
      return invalidGrant("EXECUTION_GRANT_REPLAYED", "Execution grant has already been consumed.");
    }

    let expectedHash;
    try {
      expectedHash = hashExecutionGrantRequest({ method, path, body, context });
    } catch {
      return invalidGrant("EXECUTION_GRANT_TARGET_INVALID", "Execution grant target is invalid.");
    }
    if (payload.method !== normaliseMethod(method)
      || payload.path !== normalisePath(path)
      || payload.requestHash !== expectedHash) {
      return invalidGrant("EXECUTION_GRANT_TARGET_MISMATCH", "Execution grant does not match this request.");
    }

    consumed.set(payload.grantId, payload.expiresAt);
    return {
      ok: true,
      grant: {
        version: payload.version,
        grantId: payload.grantId,
        issuer: payload.issuer,
        audience: payload.audience,
        method: payload.method,
        path: payload.path,
        requestHash: payload.requestHash,
        taskId: payload.taskId ?? null,
        stepId: payload.stepId ?? null,
        capabilityId: payload.capabilityId ?? null,
        intent: payload.intent ?? null,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
        useCount: payload.useCount,
      },
    };
  }

  return Object.freeze({
    configured: Boolean(verificationKey),
    audience: safeAudience,
    verifyRequest,
  });
}

export function executionGrantContextFromHeaders(headers = {}) {
  return normaliseExecutionGrantContext({
    taskId: headers["x-openclaw-task-id"],
    stepId: headers["x-openclaw-step-id"],
    capabilityId: headers["x-openclaw-capability-id"],
    intent: headers["x-openclaw-intent"],
  });
}

export function assertExecutionGrant({ verifier, req, requestUrl, body } = {}) {
  const result = verifier?.verifyRequest({
    token: req?.headers?.[EXECUTION_GRANT_HEADER],
    method: req?.method,
    path: `${requestUrl?.pathname ?? "/"}${requestUrl?.search ?? ""}`,
    body,
    context: executionGrantContextFromHeaders(req?.headers),
  }) ?? invalidGrant(
    "EXECUTION_GRANT_VERIFIER_UNAVAILABLE",
    "Actuator execution grants are not configured.",
    503,
  );
  if (result.ok) return result.grant;
  const error = new Error(result.reason);
  error.code = result.code;
  error.statusCode = result.statusCode;
  throw error;
}

export function executionGrantContextHeaders(context = {}) {
  const safeContext = normaliseExecutionGrantContext(context);
  return Object.fromEntries(
    [
      ["x-openclaw-task-id", safeContext.taskId],
      ["x-openclaw-step-id", safeContext.stepId],
      ["x-openclaw-capability-id", safeContext.capabilityId],
      ["x-openclaw-intent", safeContext.intent],
    ].filter(([, value]) => value !== null)
  );
}

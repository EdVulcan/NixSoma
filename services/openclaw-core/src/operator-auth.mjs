import fs from "node:fs";
import { randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE_NAME = "nixsoma_operator_session";
const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function normaliseSecret(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function secretsMatch(left, right) {
  const leftBuffer = Buffer.from(left ?? "", "utf8");
  const rightBuffer = Buffer.from(right ?? "", "utf8");
  const length = Math.max(leftBuffer.length, rightBuffer.length);
  const paddedLeft = Buffer.alloc(length);
  const paddedRight = Buffer.alloc(length);
  leftBuffer.copy(paddedLeft);
  rightBuffer.copy(paddedRight);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(paddedLeft, paddedRight);
}

function readTokenFile(filePath) {
  const path = typeof filePath === "string" ? filePath.trim() : "";
  if (!path) return null;
  try {
    return normaliseSecret(fs.readFileSync(path, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unable to read token file";
    throw new Error(`Unable to read OpenClaw operator token file: ${message}`);
  }
}

function boundedActor(value) {
  const actor = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9._:-]{1,80}$/u.test(actor) ? actor : "operator";
}

function normaliseOrigin(value) {
  const origin = typeof value === "string" ? value.trim() : "";
  if (!origin || origin === "null") return null;
  try {
    const parsed = new URL(origin);
    if (!parsed.origin || parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function parseCookieHeader(value) {
  const cookies = new Map();
  if (typeof value !== "string") return cookies;
  for (const part of value.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const cookieValue = part.slice(separator + 1).trim();
    if (name) cookies.set(name, cookieValue);
  }
  return cookies;
}

function authFailure(statusCode, error, headers = {}) {
  return { ok: false, statusCode, error, headers };
}

function configuredOrigins(input) {
  const values = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];
  return new Set(values.map(normaliseOrigin).filter(Boolean));
}

export function createOperatorAuthenticator({
  token = process.env.OPENCLAW_OPERATOR_TOKEN,
  tokenFilePath = process.env.OPENCLAW_OPERATOR_TOKEN_FILE,
  actor = process.env.OPENCLAW_OPERATOR_ACTOR ?? "operator",
  allowedOrigins = process.env.OPENCLAW_OPERATOR_ALLOWED_ORIGINS ?? [],
  sessionTtlMs = DEFAULT_SESSION_TTL_MS,
  secureCookies = process.env.OPENCLAW_OPERATOR_COOKIE_SECURE === "1",
  required = true,
  now = () => Date.now(),
  createSessionToken = () => randomBytes(32).toString("hex"),
} = {}) {
  const expectedToken = normaliseSecret(token) ?? readTokenFile(tokenFilePath);
  if (required && !expectedToken) {
    throw new Error("OpenClaw Core requires OPENCLAW_OPERATOR_TOKEN or OPENCLAW_OPERATOR_TOKEN_FILE.");
  }

  const operatorActor = boundedActor(actor);
  const origins = configuredOrigins(allowedOrigins);
  const safeSessionTtlMs = Number.isFinite(sessionTtlMs) && sessionTtlMs > 0
    ? Math.min(sessionTtlMs, 24 * 60 * 60 * 1000)
    : DEFAULT_SESSION_TTL_MS;
  const sessions = new Map();

  function identity(authMethod, expiresAt = null) {
    return {
      actor: operatorActor,
      role: "operator",
      authMethod,
      ...(expiresAt ? { sessionExpiresAt: new Date(expiresAt).toISOString() } : {}),
    };
  }

  function pruneSessions() {
    const currentTime = now();
    for (const [sessionToken, session] of sessions) {
      if (session.expiresAt <= currentTime) sessions.delete(sessionToken);
    }
  }

  function authorizeOrigin(req) {
    const rawOrigin = req?.headers?.origin;
    if (typeof rawOrigin !== "string" || !rawOrigin.trim()) {
      return { ok: true, origin: null };
    }
    const origin = normaliseOrigin(rawOrigin);
    if (!origin || !origins.has(origin)) {
      return authFailure(403, "Request origin is not allowed for the OpenClaw operator control plane.");
    }
    return { ok: true, origin };
  }

  function buildCorsHeaders(req) {
    const origin = normaliseOrigin(req?.headers?.origin);
    const base = {
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type, authorization, x-request-id",
      "vary": "Origin",
    };
    if (!origin || !origins.has(origin)) {
      return {
        ...base,
        "access-control-allow-origin": "*",
      };
    }
    return {
      ...base,
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
    };
  }

  function bearerToken(req) {
    const authorization = typeof req?.headers?.authorization === "string"
      ? req.headers.authorization.trim()
      : "";
    if (!authorization) return null;
    const match = /^Bearer\s+([^\s]+)$/iu.exec(authorization);
    return match?.[1] ?? "";
  }

  function sessionIdentity(req) {
    pruneSessions();
    const sessionToken = parseCookieHeader(req?.headers?.cookie).get(SESSION_COOKIE_NAME);
    const session = sessionToken ? sessions.get(sessionToken) : null;
    if (!session || session.expiresAt <= now()) return null;
    return {
      sessionToken,
      identity: identity("session", session.expiresAt),
      expiresAt: session.expiresAt,
    };
  }

  function authenticateRequest(req, { requireAuth = false } = {}) {
    const originResult = authorizeOrigin(req);
    if (!originResult.ok) return originResult;
    if (!requireAuth) {
      return { ok: true, identity: null, origin: originResult.origin };
    }
    if (!expectedToken) {
      return authFailure(503, "OpenClaw operator authentication is not configured.");
    }

    const suppliedToken = bearerToken(req);
    if (suppliedToken && secretsMatch(suppliedToken, expectedToken)) {
      return {
        ok: true,
        identity: identity("bearer"),
        origin: originResult.origin,
      };
    }

    const session = sessionIdentity(req);
    if (session) {
      return {
        ok: true,
        identity: session.identity,
        origin: originResult.origin,
      };
    }

    return authFailure(401, "OpenClaw operator authentication is required.", {
      "www-authenticate": "Bearer",
    });
  }

  function requestRequiresAuth(req, requestUrl) {
    const method = typeof req?.method === "string" ? req.method.toUpperCase() : "GET";
    const pathname = requestUrl?.pathname ?? "/";
    if (method === "OPTIONS" || (method === "GET" && pathname === "/health")) return false;
    if (method === "POST" && pathname === "/auth/login") return false;
    if (pathname === "/auth/session" || pathname === "/auth/logout") return true;
    return MUTATION_METHODS.has(method);
  }

  function authorizeRequest(req, requestUrl) {
    return authenticateRequest(req, { requireAuth: requestRequiresAuth(req, requestUrl) });
  }

  function createSession(suppliedToken) {
    if (!expectedToken || !secretsMatch(normaliseSecret(suppliedToken) ?? "", expectedToken)) {
      return authFailure(401, "Invalid OpenClaw operator credentials.", {
        "www-authenticate": "Bearer",
      });
    }
    const sessionToken = createSessionToken();
    const expiresAt = now() + safeSessionTtlMs;
    sessions.set(sessionToken, { expiresAt });
    return {
      ok: true,
      identity: identity("session", expiresAt),
      sessionToken,
      expiresAt,
      setCookie: buildSessionCookie(sessionToken, safeSessionTtlMs),
    };
  }

  function buildSessionCookie(sessionToken, maxAgeSeconds) {
    const secure = secureCookies ? "; Secure" : "";
    return `${SESSION_COOKIE_NAME}=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}${secure}`;
  }

  function clearSession(req) {
    const sessionToken = parseCookieHeader(req?.headers?.cookie).get(SESSION_COOKIE_NAME);
    if (sessionToken) sessions.delete(sessionToken);
    return buildSessionCookie("", 0);
  }

  return Object.freeze({
    authenticateRequest,
    authorizeOrigin,
    authorizeRequest,
    buildCorsHeaders,
    clearSession,
    createSession,
    requestRequiresAuth,
    sessionCookieName: SESSION_COOKIE_NAME,
  });
}

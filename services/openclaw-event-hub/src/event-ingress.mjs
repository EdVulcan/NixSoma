import { randomUUID } from "node:crypto";
import { credentialsMatch, readServiceCredentialMap } from "../../../packages/shared-utils/src/service-credentials.mjs";

function boundedSource(value) {
  const source = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9._-]{1,120}$/u.test(source) ? source : null;
}

function authError(message) {
  const error = new Error(message);
  error.code = "EVENT_INGRESS_AUTH_REQUIRED";
  return error;
}

function bearerCredential(req) {
  const authorization = typeof req?.headers?.authorization === "string"
    ? req.headers.authorization
    : "";
  const match = /^Bearer\s+([^\s]+)$/iu.exec(authorization.trim());
  return match?.[1] ?? null;
}

export function createEventIngress({
  token = null,
  tokensBySource = null,
  tokenMapFilePath = process.env.OPENCLAW_EVENT_HUB_TOKEN_MAP_FILE,
  required = false,
  now = () => new Date().toISOString(),
  createId = randomUUID,
} = {}) {
  const expectedToken = typeof token === "string" && token.trim() ? token.trim() : null;
  const expectedTokensBySource = readServiceCredentialMap({
    value: tokensBySource,
    filePath: tokenMapFilePath,
    label: "event-hub credential map",
  });
  if (required && !expectedToken && !expectedTokensBySource) {
    throw new Error("OpenClaw Event Hub requires a service credential map.");
  }

  function authenticateRequest(req) {
    const source = boundedSource(req?.headers?.["x-openclaw-event-source"]);
    const caller = boundedSource(req?.headers?.["x-openclaw-service-caller"]);
    if (expectedTokensBySource) {
      if (!source || caller !== source || !credentialsMatch(bearerCredential(req), expectedTokensBySource[source])) {
        throw authError("Event ingress requires the credential assigned to its service source.");
      }
      return { ok: true, authenticated: true, source, identity: source };
    }
    if (!expectedToken && !required) {
      return {
        ok: true,
        authenticated: false,
        source: source ?? "event-hub-ingress",
      };
    }

    if (!credentialsMatch(bearerCredential(req), expectedToken)) {
      throw authError("Event ingress requires the configured internal token.");
    }
    if (!source) {
      throw authError("Event ingress requires a bounded authenticated source header.");
    }
    return { ok: true, authenticated: true, source };
  }

  function normaliseEvent(input, { source } = {}) {
    if (!input || typeof input !== "object") {
      throw new Error("Event payload must be an object.");
    }

    const type = typeof input.type === "string" && input.type.trim() ? input.type.trim() : null;
    if (!type) {
      throw new Error("Event type is required.");
    }

    const payload = input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
      ? input.payload
      : {};

    return {
      id: createId(),
      type,
      source: boundedSource(source) ?? "event-hub-ingress",
      timestamp: now(),
      payload,
    };
  }

  return { authenticateRequest, normaliseEvent };
}

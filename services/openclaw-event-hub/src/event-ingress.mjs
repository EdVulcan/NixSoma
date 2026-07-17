import { randomUUID } from "node:crypto";

function boundedSource(value) {
  const source = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9._-]{1,120}$/u.test(source) ? source : null;
}

function authError(message) {
  const error = new Error(message);
  error.code = "EVENT_INGRESS_AUTH_REQUIRED";
  return error;
}

export function createEventIngress({ token = null, now = () => new Date().toISOString(), createId = randomUUID } = {}) {
  const expectedToken = typeof token === "string" && token.trim() ? token.trim() : null;

  function authenticateRequest(req) {
    if (!expectedToken) {
      return {
        ok: true,
        authenticated: false,
        source: "event-hub-ingress",
      };
    }

    const authorization = typeof req?.headers?.authorization === "string" ? req.headers.authorization : "";
    if (authorization !== `Bearer ${expectedToken}`) {
      throw authError("Event ingress requires the configured internal token.");
    }
    const source = boundedSource(req?.headers?.["x-openclaw-event-source"]);
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

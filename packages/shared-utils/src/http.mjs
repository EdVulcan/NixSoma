// 所有服务共享的 HTTP 工具函数
import { randomUUID } from "node:crypto";


const MAX_REQUEST_BODY_BYTES = 1_048_576;

export function corsHeaders(extraHeaders = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    ...extraHeaders,
  };
}

export function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, corsHeaders({ "content-type": "application/json; charset=utf-8" }));
  res.end(JSON.stringify(payload, null, 2));
}

export function createBearerAuthHeaders(token, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (normalizedToken) {
    headers.authorization = `Bearer ${normalizedToken}`;
  }
  return headers;
}

export function readJsonBody(req, maxBytes = MAX_REQUEST_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let receivedBytes = 0;
    req.on("data", (chunk) => {
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        req.destroy();
        reject(new Error("Request body exceeds maximum allowed size."));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) { resolve({}); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

export function createEventPublisher(eventHubUrl, serviceName, fetchFn = fetch, { required = false, token = process.env.OPENCLAW_EVENT_HUB_TOKEN } = {}) {
  return async function publishEvent(type, payload = {}) {
    try {
      const headers = {
        "content-type": "application/json",
        "x-openclaw-event-source": serviceName,
      };
      if (typeof token === "string" && token.trim()) {
        headers.authorization = `Bearer ${token.trim()}`;
      }
      const response = await fetchFn(`${eventHubUrl}/events`, {
        method: "POST",
        headers,
        body: JSON.stringify({ type, payload }),
      });
      if (!response.ok) {
        throw new Error(`event-hub returned HTTP ${response.status}`);
      }
      return { ok: true };
    } catch (error) {
      console.error(`Failed to publish ${serviceName} event:`, error);
      if (required) {
        throw error;
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : "event publish failed",
      };
    }
  };
}

export async function registerService(eventHubUrl, name, url) {
  try {
    const headers = {
      "content-type": "application/json",
      "x-openclaw-event-source": name,
    };
    if (typeof process.env.OPENCLAW_EVENT_HUB_TOKEN === "string" && process.env.OPENCLAW_EVENT_HUB_TOKEN.trim()) {
      headers.authorization = `Bearer ${process.env.OPENCLAW_EVENT_HUB_TOKEN.trim()}`;
    }
    await fetch(`${eventHubUrl}/services/register`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name, url }),
    });
    console.log(`Successfully registered ${name} to event-hub.`);
  } catch (error) {
    console.warn(`Failed to register ${name} to event-hub: ${error.message}`);
  }
}

export function getRequestId(req) {
  return req.headers["x-request-id"] ?? randomUUID();
}

export function withTracing(fetchFn, serviceName) {
  return async function tracedFetch(url, options = {}) {
    const requestId = options.requestId ?? randomUUID();
    const headers = {
      ...(options.headers ?? {}),
      "x-request-id": requestId,
      "x-source-service": serviceName,
    };
    return fetchFn(url, { ...options, headers });
  };
}

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

export function createEventPublisher(eventHubUrl, serviceName) {
  return async function publishEvent(type, payload = {}) {
    try {
      await fetch(`${eventHubUrl}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, source: serviceName, payload }),
      });
    } catch (error) {
      console.error(`Failed to publish ${serviceName} event:`, error);
    }
  };
}

export async function registerService(eventHubUrl, name, url) {
  try {
    await fetch(`${eventHubUrl}/services/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
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

import http from "node:http";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { createEventIngress } from "./event-ingress.mjs";

const host = process.env.OPENCLAW_EVENT_HUB_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.OPENCLAW_EVENT_HUB_PORT ?? "4101", 10);
const maxRecentEvents = Number.parseInt(process.env.OPENCLAW_EVENT_HUB_MAX_RECENT ?? "200", 10);
const bodyStateDir = process.env.OPENCLAW_BODY_STATE_DIR;
const auditLogFile =
  process.env.OPENCLAW_EVENT_LOG_FILE
  ?? (bodyStateDir ? path.join(bodyStateDir, "openclaw-events.jsonl") : path.resolve(".artifacts", "openclaw-events.jsonl"));
const maxAuditQueryLimit = Number.parseInt(process.env.OPENCLAW_EVENT_AUDIT_MAX_LIMIT ?? "1000", 10);
const eventIngress = createEventIngress({ token: process.env.OPENCLAW_EVENT_HUB_TOKEN });

const recentEvents = [];
const streamClients = new Map();
const serviceRegistry = new Map();


import { corsHeaders, sendJson, readJsonBody } from "../../../packages/shared-utils/src/http.mjs";


// M-6 Fix: Converted from sync I/O (mkdirSync, existsSync, writeFileSync) to
// async fs.promises API to avoid blocking the event loop during audit setup.
let auditLogReady = false;
let auditLogReadyPromise = null;
async function ensureAuditLogReady() {
  if (auditLogReady) return;
  if (!auditLogReadyPromise) {
    auditLogReadyPromise = (async () => {
      await fs.promises.mkdir(path.dirname(auditLogFile), { recursive: true });
      try {
        await fs.promises.access(auditLogFile);
      } catch {
        await fs.promises.writeFile(auditLogFile, "", "utf8");
      }
      auditLogReady = true;
    })();
  }
  try {
    await auditLogReadyPromise;
  } catch (error) {
    auditLogReadyPromise = null;
    throw error;
  }
}

function safeParseAuditLine(line) {
  if (!line.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(line);
    if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// H-3 Fix: Async file read to avoid blocking the event loop on large log files.
async function readAuditEvents({ type = null, source = null, limit = 100 } = {}) {
  await ensureAuditLogReady();
  const safeLimit = Math.max(1, Math.min(limit, maxAuditQueryLimit));
  const text = await fsPromises.readFile(auditLogFile, "utf8");
  const items = [];

  for (const line of text.split(/\r?\n/)) {
    const event = safeParseAuditLine(line);
    if (!event) {
      continue;
    }
    if (type && event.type !== type) {
      continue;
    }
    if (source && event.source !== source) {
      continue;
    }
    items.push(event);
  }

  return items.slice(-safeLimit);
}

// H-3 Fix: Async file read to avoid blocking the event loop on large log files.
async function buildAuditSummary() {
  await ensureAuditLogReady();
  const text = await fsPromises.readFile(auditLogFile, "utf8");
  const byType = {};
  const bySource = {};
  let total = 0;
  let malformed = 0;
  let earliestTimestamp = null;
  let latestTimestamp = null;

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    const event = safeParseAuditLine(line);
    if (!event) {
      malformed += 1;
      continue;
    }

    total += 1;
    byType[event.type] = (byType[event.type] ?? 0) + 1;
    bySource[event.source] = (bySource[event.source] ?? 0) + 1;

    if (typeof event.timestamp === "string" && event.timestamp) {
      earliestTimestamp = earliestTimestamp ?? event.timestamp;
      // M-2 Fix: Compare timestamps lexicographically instead of always taking
      // the last one, so that out-of-order entries don't produce a wrong result.
      latestTimestamp = latestTimestamp === null || event.timestamp > latestTimestamp
        ? event.timestamp
        : latestTimestamp;
    }
  }

  return {
    logFile: auditLogFile,
    total,
    malformed,
    byType,
    bySource,
    earliestTimestamp,
    latestTimestamp,
    recentEventCount: recentEvents.length,
    maxQueryLimit: maxAuditQueryLimit,
  };
}

// H-3 Fix: Async append to avoid blocking the event loop during log writes.
async function appendAuditEvent(event) {
  await ensureAuditLogReady();
  await fsPromises.appendFile(auditLogFile, `${JSON.stringify(event)}\n`, "utf8");
}

// H-3 Fix: Now async since readAuditEvents is async.
async function hydrateRecentEventsFromAuditLog() {
  try {
    for (const event of await readAuditEvents({ limit: maxRecentEvents })) {
      recentEvents.push(event);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`Unable to hydrate recent events from audit log: ${message}`);
  }
}

// H-3 Fix: publishEvent is now async to await the async appendAuditEvent.
async function publishEvent(event) {
  await appendAuditEvent(event);

  recentEvents.push(event);
  // L-1 Fix: Use shift() instead of splice(0, N) since we push exactly one
  // element at a time, so at most one element needs to be removed. This avoids
  // a potentially large splice when the array is only one over the limit.
  if (recentEvents.length > maxRecentEvents) {
    recentEvents.shift();
  }

  const frame = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const res of streamClients.values()) {
    res.write(frame);
  }
}

function handleSse(req, res) {
  const clientId = randomUUID();

  res.writeHead(200, corsHeaders({
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  }));
  res.write(`event: ready\ndata: ${JSON.stringify({ clientId })}\n\n`);

  streamClients.set(clientId, res);

  req.on("close", () => {
    streamClients.delete(clientId);
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/services/register") {
    try {
      eventIngress.authenticateRequest(req);
      const body = await readJsonBody(req);
      if (body.name && body.url) {
        serviceRegistry.set(body.name, {
          name: body.name,
          url: body.url,
          healthUrl: `${body.url}/health`,
          registeredAt: new Date().toISOString(),
          lastHeartbeat: new Date().toISOString(),
        });
        sendJson(res, 200, { ok: true });
      } else {
        sendJson(res, 400, { ok: false, error: "name and url are required" });
      }
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/services/registry") {
    sendJson(res, 200, {
      ok: true,
      services: Object.fromEntries(serviceRegistry),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "openclaw-event-hub",
      stage: "active",
      host,
      port,
      recentEventCount: recentEvents.length,
      streamClientCount: streamClients.size,
      auditLogFile,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/events/recent") {
    sendJson(res, 200, {
      items: recentEvents,
      count: recentEvents.length,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/events/audit") {
    const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "100", 10);
    const type = requestUrl.searchParams.get("type") || null;
    const source = requestUrl.searchParams.get("source") || null;
    // H-3 Fix: readAuditEvents is now async.
    const items = await readAuditEvents({
      limit: Number.isFinite(limit) ? limit : 100,
      type,
      source,
    });
    sendJson(res, 200, {
      items,
      count: items.length,
      filters: { type, source },
      logFile: auditLogFile,
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/events/audit/summary") {
    // H-3 Fix: buildAuditSummary is now async.
    sendJson(res, 200, {
      ok: true,
      audit: await buildAuditSummary(),
    });
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/events/stream") {
    handleSse(req, res);
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/events") {
    try {
      const ingress = eventIngress.authenticateRequest(req);
      const body = await readJsonBody(req);
      const event = eventIngress.normaliseEvent(body, ingress);
      // H-3 Fix: await publishEvent since it is now async (async audit log append).
      await publishEvent(event);
      sendJson(res, 201, { ok: true, event });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, error?.code === "EVENT_INGRESS_AUTH_REQUIRED" ? 401 : 400, { ok: false, error: message });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Route not found." });
});

async function startEventHub() {
  await ensureAuditLogReady();
  await hydrateRecentEventsFromAuditLog();
  server.listen(port, host, () => {
    console.log(`openclaw-event-hub listening on http://${host}:${port}`);
    console.log(`openclaw-event-hub audit log: ${auditLogFile}`);
  });
}

startEventHub().catch((error) => {
  console.error(`Unable to start openclaw-event-hub: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});

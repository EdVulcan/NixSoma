import { createEventName } from "../../../packages/shared-events/src/event-factory.mjs";
import { readJsonBody, sendJson } from "../../../packages/shared-utils/src/http.mjs";

function sendRouteError(res, error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  sendJson(res, 400, {
    ok: false,
    error: message,
    code: error.code ?? null,
    details: error.details ?? null,
  });
}

export async function handleSystemFileRoutes({
  req,
  res,
  requestUrl,
  publishEvent,
  publishAuditEvent = publishEvent,
  allowedRoots,
  operations,
}) {
  if (req.method === "GET" && requestUrl.pathname === "/system/files/metadata") {
    try {
      const result = operations.resolveAllowedPath(requestUrl.searchParams.get("path"));
      const metadata = operations.buildFileMetadata(result.path);
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
        metadata,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, details: error.details ?? null });
    }
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/files/list") {
    try {
      const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "50", 10);
      const result = operations.listFiles(requestUrl.searchParams.get("path"), limit);
      await publishEvent(createEventName("system.files.listed"), {
        path: result.path,
        count: result.count,
      });
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, details: error.details ?? null });
    }
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/files/search") {
    try {
      const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "50", 10);
      const result = operations.searchFiles(
        requestUrl.searchParams.get("path"),
        requestUrl.searchParams.get("query") ?? requestUrl.searchParams.get("q"),
        limit,
      );
      await publishEvent(createEventName("system.files.searched"), {
        path: result.path,
        query: result.query,
        count: result.count,
      });
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(res, 400, { ok: false, error: message, details: error.details ?? null });
    }
    return true;
  }

  if (req.method === "GET" && requestUrl.pathname === "/system/files/read-text") {
    try {
      const result = operations.readTextFile(requestUrl.searchParams.get("path"));
      await publishEvent(createEventName("system.files.read"), {
        path: result.path,
        contentBytes: result.contentBytes,
        mode: result.mode,
      });
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
      });
    } catch (error) {
      sendRouteError(res, error);
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/files/write-text") {
    try {
      const body = await readJsonBody(req);
      await publishAuditEvent(createEventName("system.files.write_requested"), {
        path: body.path ?? null,
        contentBytes: typeof body.content === "string" ? Buffer.byteLength(body.content, "utf8") : 0,
        overwrite: body.overwrite !== false,
      });
      const result = operations.writeTextFile(body);
      await publishEvent(createEventName("system.files.written"), {
        path: result.path,
        contentBytes: result.contentBytes,
        overwrite: result.overwrite,
      });
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
      });
    } catch (error) {
      sendRouteError(res, error);
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/files/append-text") {
    try {
      const body = await readJsonBody(req);
      await publishAuditEvent(createEventName("system.files.append_requested"), {
        path: body.path ?? null,
        contentBytes: typeof body.content === "string" ? Buffer.byteLength(body.content, "utf8") : 0,
        createIfMissing: body.createIfMissing === true,
      });
      const result = operations.appendTextFile(body);
      await publishEvent(createEventName("system.files.appended"), {
        path: result.path,
        contentBytes: result.contentBytes,
        previousBytes: result.previousBytes,
        totalBytes: result.totalBytes,
      });
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
      });
    } catch (error) {
      sendRouteError(res, error);
    }
    return true;
  }

  if (req.method === "POST" && requestUrl.pathname === "/system/files/mkdir") {
    try {
      const body = await readJsonBody(req);
      await publishAuditEvent(createEventName("system.files.directory_requested"), {
        path: body.path ?? null,
        recursive: body.recursive === true,
      });
      const result = operations.createDirectory(body);
      await publishEvent(createEventName("system.files.directory_created"), {
        path: result.path,
        recursive: result.recursive,
        created: result.created,
      });
      sendJson(res, 200, {
        ok: true,
        allowedRoots,
        ...result,
      });
    } catch (error) {
      sendRouteError(res, error);
    }
    return true;
  }

  return false;
}

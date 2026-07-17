import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

import { handleSystemCommandRoutes } from "../src/system-command-routes.mjs";
import { handleSystemFileRoutes } from "../src/system-file-routes.mjs";

function createJsonRequest(method, body) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  req.method = method;
  return req;
}

function createResponseCapture() {
  return {
    statusCode: null,
    headers: null,
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body) {
      this.body = body ?? "";
    },
  };
}

function parseResponse(res) {
  return JSON.parse(res.body);
}

test("system file routes preserve listed event and response envelope", async () => {
  const events = [];
  const res = createResponseCapture();
  const handled = await handleSystemFileRoutes({
    req: { method: "GET" },
    res,
    requestUrl: new URL("http://127.0.0.1/system/files/list?path=/workspace&limit=3"),
    allowedRoots: ["/workspace"],
    publishEvent: async (type, payload) => events.push({ type, payload }),
    operations: {
      listFiles(path, limit) {
        assert.equal(path, "/workspace");
        assert.equal(limit, 3);
        return { path, count: 1, entries: [{ name: "note.txt" }] };
      },
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(events, [{
    type: "system.files.listed",
    payload: { path: "/workspace", count: 1 },
  }]);
  assert.deepEqual(parseResponse(res), {
    ok: true,
    allowedRoots: ["/workspace"],
    path: "/workspace",
    count: 1,
    entries: [{ name: "note.txt" }],
  });
});

test("system file routes preserve write-text body parsing and event payload", async () => {
  const events = [];
  const res = createResponseCapture();
  const handled = await handleSystemFileRoutes({
    req: createJsonRequest("POST", { path: "/workspace/note.txt", content: "openclaw", overwrite: true }),
    res,
    requestUrl: new URL("http://127.0.0.1/system/files/write-text"),
    allowedRoots: ["/workspace"],
    publishEvent: async (type, payload) => events.push({ type, payload }),
    operations: {
      writeTextFile(body) {
        assert.deepEqual(body, { path: "/workspace/note.txt", content: "openclaw", overwrite: true });
        return {
          path: body.path,
          contentBytes: 8,
          overwrite: true,
          mode: "write_text",
        };
      },
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(events, [{
    type: "system.files.write_requested",
    payload: { path: "/workspace/note.txt", contentBytes: 8, overwrite: true },
  }, {
    type: "system.files.written",
    payload: { path: "/workspace/note.txt", contentBytes: 8, overwrite: true },
  }]);
  assert.equal(parseResponse(res).mode, "write_text");
});

test("system file routes fail closed before mutation when the required audit publish fails", async () => {
  let writeCalled = false;
  const res = createResponseCapture();
  await handleSystemFileRoutes({
    req: createJsonRequest("POST", { path: "/workspace/note.txt", content: "must not write" }),
    res,
    requestUrl: new URL("http://127.0.0.1/system/files/write-text"),
    allowedRoots: ["/workspace"],
    publishEvent: async () => {},
    publishAuditEvent: async () => {
      throw new Error("audit unavailable");
    },
    operations: {
      writeTextFile() {
        writeCalled = true;
        return { path: "/workspace/note.txt", contentBytes: 14, overwrite: false };
      },
    },
  });

  assert.equal(res.statusCode, 400);
  assert.equal(writeCalled, false);
  assert.match(parseResponse(res).error, /audit unavailable/u);
});

test("system command routes preserve dry-run envelope and event", async () => {
  const events = [];
  const res = createResponseCapture();
  const handled = await handleSystemCommandRoutes({
    req: createJsonRequest("POST", { command: "echo", args: ["ok"] }),
    res,
    requestUrl: new URL("http://127.0.0.1/system/command/dry-run"),
    publishEvent: async (type, payload) => events.push({ type, payload }),
    operations: {
      buildCommandDryRun(body) {
        assert.deepEqual(body, { command: "echo", args: ["ok"] });
        return { command: "echo", args: ["ok"], risk: "low", requiresApproval: false };
      },
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(events, [{
    type: "system.command.planned",
    payload: { plan: { command: "echo", args: ["ok"], risk: "low", requiresApproval: false } },
  }]);
  assert.deepEqual(parseResponse(res), {
    ok: true,
    plan: { command: "echo", args: ["ok"], risk: "low", requiresApproval: false },
  });
});

test("system command routes return false for unrelated paths", async () => {
  const res = createResponseCapture();
  const handled = await handleSystemCommandRoutes({
    req: { method: "GET" },
    res,
    requestUrl: new URL("http://127.0.0.1/system/body"),
    publishEvent: async () => {},
    operations: {},
  });

  assert.equal(handled, false);
  assert.equal(res.statusCode, null);
});

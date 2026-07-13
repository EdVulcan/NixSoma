import test from "node:test";
import assert from "node:assert/strict";

import { handleSystemKernelEventRoutes } from "../src/system-kernel-event-routes.mjs";

function responseCapture() {
  return {
    statusCode: null,
    body: "",
    writeHead(statusCode) {
      this.statusCode = statusCode;
    },
    end(body) {
      this.body = body ?? "";
    },
  };
}

test("system kernel event route exposes the read-only process exec read model", async () => {
  const res = responseCapture();
  const handled = await handleSystemKernelEventRoutes({
    req: { method: "GET" },
    res,
    requestUrl: new URL("http://127.0.0.1/system/kernel/process-exec-events"),
    builders: {
      buildKernelProcessExecEvents: async () => ({
        ok: true,
        registry: "openclaw-kernel-process-exec-v0",
        status: "captured",
        mode: "read_only",
        events: [],
      }),
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), {
    ok: true,
    registry: "openclaw-kernel-process-exec-v0",
    status: "captured",
    mode: "read_only",
    events: [],
  });
});

test("system kernel event route ignores non-GET and unrelated paths", async () => {
  const res = responseCapture();
  assert.equal(await handleSystemKernelEventRoutes({
    req: { method: "POST" },
    res,
    requestUrl: new URL("http://127.0.0.1/system/kernel/process-exec-events"),
    builders: {},
  }), false);
  assert.equal(await handleSystemKernelEventRoutes({
    req: { method: "GET" },
    res,
    requestUrl: new URL("http://127.0.0.1/system/kernel/other"),
    builders: {},
  }), false);
});

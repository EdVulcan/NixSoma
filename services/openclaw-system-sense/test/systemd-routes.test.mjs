import test from "node:test";
import assert from "node:assert/strict";

import { handleSystemdRoutes } from "../src/systemd-routes.mjs";

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

test("systemd routes dispatch table-backed GET builders", async () => {
  const res = createResponseCapture();
  const handled = await handleSystemdRoutes({
    req: { method: "GET" },
    res,
    requestUrl: new URL("http://127.0.0.1/system/systemd/next-repair-plan"),
    builders: {
      buildSystemdNextRepairPlan: async () => ({
        ok: true,
        registry: "openclaw-systemd-next-repair-plan-v0",
      }),
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(parseResponse(res), {
    ok: true,
    registry: "openclaw-systemd-next-repair-plan-v0",
  });
});

test("systemd routes preserve repair query aliases", async () => {
  const res = createResponseCapture();
  const handled = await handleSystemdRoutes({
    req: { method: "GET" },
    res,
    requestUrl: new URL("http://127.0.0.1/system/systemd/repair-plan?target=openclaw-core&reason=restart"),
    builders: {
      buildSystemdRepairPlan: async (request) => ({
        ok: true,
        request,
      }),
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(parseResponse(res), {
    ok: true,
    request: {
      unit: "openclaw-core",
      reason: "restart",
    },
  });
});

test("systemd routes preserve repair error envelope", async () => {
  const res = createResponseCapture();
  const error = new Error("Unknown systemd unit.");
  error.code = "SYSTEMD_UNIT_NOT_IN_INVENTORY";
  error.details = { unit: "ssh.service" };

  const handled = await handleSystemdRoutes({
    req: { method: "GET" },
    res,
    requestUrl: new URL("http://127.0.0.1/system/systemd/repair-dry-run?unit=ssh.service"),
    builders: {
      buildSystemdRepairDryRun: async () => {
        throw error;
      },
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(parseResponse(res), {
    ok: false,
    error: "Unknown systemd unit.",
    code: "SYSTEMD_UNIT_NOT_IN_INVENTORY",
    details: { unit: "ssh.service" },
  });
});

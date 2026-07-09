import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

import { handleNativeAdapterPluginRoute } from "../src/native-adapter-plugin-routes.mjs";

async function invokeNativeAdapterPluginRoute(pluginReview, method, path, body = null) {
  const chunks = body === null ? [] : [Buffer.from(JSON.stringify(body))];
  const req = Readable.from(chunks);
  req.method = method;
  req.headers = {};

  let statusCode = null;
  let headers = null;
  let payload = "";
  const res = {
    writeHead(code, responseHeaders) {
      statusCode = code;
      headers = responseHeaders;
    },
    end(chunk = "") {
      payload = String(chunk);
    },
  };

  const handled = await handleNativeAdapterPluginRoute({
    req,
    res,
    requestUrl: new URL(path, "http://127.0.0.1:4100"),
    pluginReview,
    serialiseTask: (task) => ({ id: task.id, status: task.status }),
    serialiseApproval: (approval) => ({ id: approval.id, status: approval.status }),
  });

  return {
    handled,
    statusCode,
    headers,
    body: payload ? JSON.parse(payload) : null,
  };
}

test("native adapter plugin route preserves q alias and 404 lookup errors", async () => {
  let observedInput = null;
  const response = await invokeNativeAdapterPluginRoute({
    buildOpenClawPluginCapabilityPlan: (input) => {
      observedInput = input;
      return {
        ok: true,
        registry: "openclaw-plugin-capability-plan-v0",
        summary: { total: 2 },
      };
    },
  }, "GET", "/plugins/native-adapter/plugin-capability-plan?workspacePath=/tmp/openclaw&q=search&limit=7");

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"], /application\/json/);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw",
    query: "search",
    limit: "7",
  });
  assert.equal(response.body.registry, "openclaw-plugin-capability-plan-v0");

  const failed = await invokeNativeAdapterPluginRoute({
    buildOpenClawPluginCapabilityPlan: () => {
      throw new Error("workspace missing");
    },
  }, "GET", "/plugins/native-adapter/plugin-capability-plan");

  assert.equal(failed.statusCode, 404);
  assert.deepEqual(failed.body, { ok: false, error: "workspace missing" });
});

test("native adapter search web runtime route parses numeric limit and uses 400 errors", async () => {
  let observedInput = null;
  const response = await invokeNativeAdapterPluginRoute({
    buildOpenClawPluginSearchWebAdapterRuntimePreflight: (input) => {
      observedInput = input;
      return {
        ok: true,
        registry: "openclaw-plugin-search-web-adapter-runtime-preflight-v0",
      };
    },
  }, "GET", "/plugins/native-adapter/plugin-search-web-adapter-runtime-preflight?providerContractId=openclaw.web-search&limit=12");

  assert.equal(response.statusCode, 200);
  assert.deepEqual(observedInput, {
    workspacePath: null,
    providerContractId: "openclaw.web-search",
    query: "openclaw native integration",
    limit: 12,
  });

  const failed = await invokeNativeAdapterPluginRoute({
    buildOpenClawPluginSearchWebAdapterRuntimePreflight: () => {
      throw new Error("provider missing");
    },
  }, "GET", "/plugins/native-adapter/plugin-search-web-adapter-runtime-preflight");

  assert.equal(failed.statusCode, 400);
  assert.deepEqual(failed.body, { ok: false, error: "provider missing" });
});

test("native adapter engineering tool surface route preserves workspace path", async () => {
  let observedInput = null;
  const response = await invokeNativeAdapterPluginRoute({
    buildNativeEngineeringToolSurfaceInventory: (input) => {
      observedInput = input;
      return {
        ok: true,
        registry: "openclaw-native-engineering-tool-surface-inventory-v0",
        mode: "read-only-tool-contract-mapping",
        summary: { totalTools: 10 },
      };
    },
  }, "GET", "/plugins/native-adapter/engineering-tool-surface?workspacePath=/tmp/openclaw-enhanced-source");

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw-enhanced-source",
  });
  assert.equal(response.body.registry, "openclaw-native-engineering-tool-surface-inventory-v0");
});

test("native adapter plugin task route preserves raw body values and serializes task approval", async () => {
  let observedInput = null;
  const response = await invokeNativeAdapterPluginRoute({
    createOpenClawPluginSearchWebAdapterRuntimeActivationTask: async (input) => {
      observedInput = input;
      return {
        ok: true,
        registry: "openclaw-plugin-search-web-adapter-runtime-activation-task-v0",
        mode: "approval-gated",
        task: { id: "task-1", status: "pending" },
        approval: { id: "approval-1", status: "pending" },
      };
    },
  }, "POST", "/plugins/native-adapter/plugin-search-web-adapter-runtime-activation-tasks", {
    workspacePath: "/tmp/openclaw",
    providerContractId: "openclaw.web-search",
    q: "web query",
    limit: "3",
    confirm: "yes",
  });

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 201);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw",
    providerContractId: "openclaw.web-search",
    query: "web query",
    limit: "3",
    confirm: "yes",
  });
  assert.deepEqual(response.body.task, { id: "task-1", status: "pending" });
  assert.deepEqual(response.body.approval, { id: "approval-1", status: "pending" });
});

test("native adapter plugin route reports misses without writing a response", async () => {
  const missed = await invokeNativeAdapterPluginRoute({}, "GET", "/workspaces");

  assert.equal(missed.handled, false);
  assert.equal(missed.statusCode, null);
  assert.equal(missed.body, null);
});

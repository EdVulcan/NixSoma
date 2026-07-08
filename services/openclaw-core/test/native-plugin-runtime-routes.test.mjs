import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

import { handleNativePluginRuntimeRoute } from "../src/native-plugin-runtime-routes.mjs";

async function invokeNativePluginRuntimeRoute(planBuilder, method, path, body = null) {
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

  const handled = await handleNativePluginRuntimeRoute({
    req,
    res,
    requestUrl: new URL(path, "http://127.0.0.1:4100"),
    planBuilder,
    serialiseTask: (task) => ({ id: task.id, status: task.status }),
    serialiseApproval: (approval) => ({ id: approval.id, status: approval.status }),
    buildTaskSummary: () => ({ total: 3 }),
  });

  return {
    handled,
    statusCode,
    headers,
    body: payload ? JSON.parse(payload) : null,
  };
}

function nativePluginTaskResult(extra = {}) {
  return {
    registry: "openclaw-native-plugin-runtime-task-v0",
    mode: "approval-gated",
    generatedAt: "2026-07-08T00:00:00.000Z",
    sourceRegistry: "openclaw-native-plugin-runtime-draft-v0",
    sourceMode: "native-plugin-runtime",
    plugin: { id: "plugin-a" },
    capability: { id: "capability-a" },
    task: { id: "task-a", status: "pending" },
    approval: { id: "approval-a", status: "pending" },
    governance: { decision: "require_approval" },
    ...extra,
  };
}

test("native plugin runtime GET routes preserve defaults, wrappers, and error statuses", async () => {
  let observedInvokeInput = null;
  const invokePlan = await invokeNativePluginRuntimeRoute({
    buildNativePluginCapabilityInvokePlan: (input) => {
      observedInvokeInput = input;
      return {
        registry: "openclaw-native-plugin-invoke-plan-v0",
        plugin: { id: "plugin-a" },
      };
    },
  }, "GET", "/plugins/native-adapter/invoke-plan?packagePath=/tmp/plugin");

  assert.equal(invokePlan.handled, true);
  assert.equal(invokePlan.statusCode, 200);
  assert.match(invokePlan.headers["content-type"], /application\/json/);
  assert.deepEqual(observedInvokeInput, {
    packagePath: "/tmp/plugin",
    capabilityId: "act.plugin.capability.invoke",
  });
  assert.equal(invokePlan.body.ok, true);
  assert.equal(invokePlan.body.registry, "openclaw-native-plugin-invoke-plan-v0");

  const invokePlanFailure = await invokeNativePluginRuntimeRoute({
    buildNativePluginCapabilityInvokePlan: () => {
      throw new Error("plugin missing");
    },
  }, "GET", "/plugins/native-adapter/invoke-plan");

  assert.equal(invokePlanFailure.statusCode, 404);
  assert.deepEqual(invokePlanFailure.body, { ok: false, error: "plugin missing" });

  const preflightFailure = await invokeNativePluginRuntimeRoute({
    buildNativePluginRuntimePreflight: () => {
      throw new Error("runtime blocked");
    },
  }, "GET", "/plugins/native-adapter/runtime-preflight");

  assert.equal(preflightFailure.statusCode, 400);
  assert.deepEqual(preflightFailure.body, { ok: false, error: "runtime blocked" });
});

test("native plugin runtime POST routes preserve strict body coercion and route-specific envelopes", async () => {
  const cases = [
    {
      path: "/plugins/native-adapter/invoke-tasks",
      builder: "createNativePluginInvokeTask",
      extraResult: {},
      expectedExtra: ["sourceMode", "plugin", "capability"],
    },
    {
      path: "/plugins/native-adapter/runtime-adapter-tasks",
      builder: "createNativePluginRuntimeAdapterTask",
      extraResult: { adapterContract: { id: "adapter-contract-a" } },
      expectedExtra: ["sourceMode", "plugin", "capability", "adapterContract"],
    },
    {
      path: "/plugins/native-adapter/runtime-activation-tasks",
      builder: "createNativePluginRuntimeActivationTask",
      extraResult: { activationPlan: { id: "activation-plan-a" } },
      expectedExtra: ["sourceMode", "plugin", "capability", "activationPlan"],
    },
  ];

  for (const routeCase of cases) {
    let observedInput = null;
    const response = await invokeNativePluginRuntimeRoute({
      [routeCase.builder]: async (input) => {
        observedInput = input;
        return nativePluginTaskResult(routeCase.extraResult);
      },
    }, "POST", routeCase.path, {
      packagePath: 7,
      capabilityId: false,
      confirm: "yes",
    });

    assert.equal(response.handled, true, routeCase.path);
    assert.equal(response.statusCode, 201, routeCase.path);
    assert.deepEqual(observedInput, {
      packagePath: null,
      capabilityId: "act.plugin.capability.invoke",
      confirm: false,
    }, routeCase.path);
    assert.deepEqual(response.body.task, { id: "task-a", status: "pending" }, routeCase.path);
    assert.deepEqual(response.body.approval, { id: "approval-a", status: "pending" }, routeCase.path);
    assert.deepEqual(response.body.summary, { total: 3 }, routeCase.path);
    assert.deepEqual(Object.keys(response.body).filter((key) => routeCase.expectedExtra.includes(key)), routeCase.expectedExtra, routeCase.path);
  }
});

test("native plugin runtime route reports misses without writing a response", async () => {
  const missed = await invokeNativePluginRuntimeRoute({}, "GET", "/plugins/native-adapter/plugin-capability-plan");

  assert.equal(missed.handled, false);
  assert.equal(missed.statusCode, null);
  assert.equal(missed.body, null);
});

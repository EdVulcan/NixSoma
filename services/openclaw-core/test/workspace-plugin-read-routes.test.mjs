import test from "node:test";
import assert from "node:assert/strict";

import { handleWorkspacePluginReadRoute } from "../src/workspace-plugin-read-routes.mjs";

async function invokeWorkspacePluginReadRoute(pluginReview, method, path) {
  const req = { method };
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

  const handled = await handleWorkspacePluginReadRoute({
    req,
    res,
    requestUrl: new URL(path, "http://127.0.0.1:4100"),
    pluginReview,
  });

  return {
    handled,
    statusCode,
    headers,
    body: payload ? JSON.parse(payload) : null,
  };
}

test("workspace plugin read routes return summary projections without extra review fields", async () => {
  const response = await invokeWorkspacePluginReadRoute({
    buildOpenClawPluginSdkContractReview: () => ({
      registry: "plugin-sdk-contract-review-v0",
      mode: "read_only",
      generatedAt: "2026-07-08T00:00:00.000Z",
      sourceRegistry: "workspace-registry-v0",
      roots: [{ id: "openclaw" }],
      summary: { total: 1 },
      internalSignals: ["not-public"],
    }),
  }, "GET", "/workspaces/openclaw-plugin-sdk-contract-review/summary");

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"], /application\/json/);
  assert.deepEqual(response.body, {
    ok: true,
    registry: "plugin-sdk-contract-review-v0",
    mode: "read_only",
    generatedAt: "2026-07-08T00:00:00.000Z",
    sourceRegistry: "workspace-registry-v0",
    roots: [{ id: "openclaw" }],
    summary: { total: 1 },
  });
});

test("workspace plugin manifest map route preserves q alias and limit query contract", async () => {
  let observedInput = null;
  const response = await invokeWorkspacePluginReadRoute({
    buildOpenClawPluginManifestMap: (input) => {
      observedInput = input;
      return {
        ok: true,
        registry: "plugin-manifest-map-v0",
        mode: "read_only",
        generatedAt: "2026-07-08T00:00:00.000Z",
        sourceRegistries: ["native-plugin-registry-v0"],
        capability: { id: "sense.plugin.manifest_map" },
        summary: { matches: 2 },
        governance: { decision: "audit_only" },
        items: [{ id: "plugin-a" }],
      };
    },
  }, "GET", "/plugins/openclaw-plugin-manifest-map/summary?workspacePath=/tmp/openclaw&q=search&limit=9");

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw",
    query: "search",
    limit: "9",
  });
  assert.deepEqual(response.body, {
    ok: true,
    registry: "plugin-manifest-map-v0",
    mode: "read_only",
    generatedAt: "2026-07-08T00:00:00.000Z",
    sourceRegistries: ["native-plugin-registry-v0"],
    capability: { id: "sense.plugin.manifest_map" },
    summary: { matches: 2 },
    governance: { decision: "audit_only" },
  });
});

test("workspace plugin read routes preserve handled error status and miss behavior", async () => {
  const failed = await invokeWorkspacePluginReadRoute({
    buildOpenClawPluginSdkSourceReviewScope: () => {
      throw new Error("package missing");
    },
  }, "GET", "/workspaces/openclaw-plugin-sdk-source-review-scope");

  assert.equal(failed.handled, true);
  assert.equal(failed.statusCode, 400);
  assert.deepEqual(failed.body, { ok: false, error: "package missing" });

  const missed = await invokeWorkspacePluginReadRoute({}, "POST", "/workspaces");

  assert.equal(missed.handled, false);
  assert.equal(missed.statusCode, null);
  assert.equal(missed.body, null);
});

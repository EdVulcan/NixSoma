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

test("native adapter engineering read/search routes preserve bounded query inputs", async () => {
  const observed = {};
  const pluginReview = {
    buildNativeEngineeringReadFile: (input) => {
      observed.read = input;
      return { ok: true, registry: "openclaw-native-engineering-read-search-v0", operation: "read" };
    },
    buildNativeEngineeringGlob: (input) => {
      observed.glob = input;
      return { ok: true, registry: "openclaw-native-engineering-read-search-v0", operation: "glob" };
    },
    buildNativeEngineeringGrep: (input) => {
      observed.grep = input;
      return { ok: true, registry: "openclaw-native-engineering-read-search-v0", operation: "grep" };
    },
  };

  const read = await invokeNativeAdapterPluginRoute(
    pluginReview,
    "GET",
    "/plugins/native-adapter/engineering-read-search/read?workspacePath=/tmp/openclaw&path=src/app.ts&start_line=2&end_line=4&maxOutputChars=500",
  );
  const glob = await invokeNativeAdapterPluginRoute(
    pluginReview,
    "GET",
    "/plugins/native-adapter/engineering-read-search/glob?pattern=src/**/*.ts&limit=3",
  );
  const grep = await invokeNativeAdapterPluginRoute(
    pluginReview,
    "GET",
    "/plugins/native-adapter/engineering-read-search/grep?q=OpenClawNeedle&include=src/**/*.ts&literal=true&case_sensitive=true&limit=2&maxFileSizeBytes=1024",
  );

  assert.equal(read.statusCode, 200);
  assert.equal(glob.statusCode, 200);
  assert.equal(grep.statusCode, 200);
  assert.deepEqual(observed.read, {
    workspacePath: "/tmp/openclaw",
    relativePath: "src/app.ts",
    startLine: "2",
    endLine: "4",
    maxOutputChars: "500",
    maxFileSizeBytes: null,
  });
  assert.deepEqual(observed.glob, {
    workspacePath: null,
    pattern: "src/**/*.ts",
    limit: "3",
  });
  assert.deepEqual(observed.grep, {
    workspacePath: null,
    query: "OpenClawNeedle",
    literal: "true",
    caseSensitive: "true",
    include: "src/**/*.ts",
    limit: "2",
    maxOutputChars: null,
    maxFileSizeBytes: "1024",
  });
});

test("native adapter engineering LSP evidence route preserves action and position inputs", async () => {
  let observedInput = null;
  const response = await invokeNativeAdapterPluginRoute({
    buildNativeEngineeringLspEvidence: (input) => {
      observedInput = input;
      return {
        ok: true,
        registry: "openclaw-native-engineering-lsp-evidence-v0",
        mode: "lsp-contract-and-availability-evidence-only",
      };
    },
  }, "GET", "/plugins/native-adapter/engineering-lsp/evidence?workspacePath=/tmp/openclaw&action=definition&language=typescript&relativePath=src/app.ts&line=12&character=4&limit=7");

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw",
    action: "definition",
    language: "typescript",
    relativePath: "src/app.ts",
    line: "12",
    character: "4",
    limit: "7",
  });
  assert.equal(response.body.registry, "openclaw-native-engineering-lsp-evidence-v0");
});

test("native adapter engineering write proposal route preserves bounded proposal inputs", async () => {
  let observedInput = null;
  const response = await invokeNativeAdapterPluginRoute({
    buildNativeEngineeringWriteProposal: (input) => {
      observedInput = input;
      return {
        ok: true,
        registry: "openclaw-native-engineering-write-proposal-v0",
        mode: "source-write-proposal-diff-metadata-preview-only",
      };
    },
  }, "GET", "/plugins/native-adapter/engineering-write-proposal/draft?workspacePath=/tmp/openclaw&relativePath=src/new.txt&content=hello&overwrite=true&contextLines=2&maxContentBytes=512&maxExistingFileBytes=1024");

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw",
    relativePath: "src/new.txt",
    content: "hello",
    contentBase64: null,
    overwrite: "true",
    contextLines: "2",
    maxContentBytes: "512",
    maxExistingFileBytes: "1024",
  });
  assert.equal(response.body.registry, "openclaw-native-engineering-write-proposal-v0");
});

test("native adapter engineering edit proposal route preserves proposal query inputs", async () => {
  let observedInput = null;
  const response = await invokeNativeAdapterPluginRoute({
    buildNativeEngineeringEditProposal: (input) => {
      observedInput = input;
      return {
        ok: true,
        registry: "openclaw-native-engineering-edit-proposal-v0",
        mode: "surgical-edit-proposal-diff-preview-only",
      };
    },
  }, "GET", "/plugins/native-adapter/engineering-edit-proposal/draft?workspacePath=/tmp/openclaw&path=src/app.ts&search=old&replacement=new&contextLines=0&maxOutputChars=8000&maxFileSizeBytes=4096");

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw",
    relativePath: "src/app.ts",
    oldString: "old",
    newString: "new",
    contextLines: "0",
    maxOutputChars: "8000",
    maxFileSizeBytes: "4096",
  });
  assert.equal(response.body.registry, "openclaw-native-engineering-edit-proposal-v0");
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

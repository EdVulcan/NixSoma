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

test("native adapter engineering LSP lifecycle draft route preserves bounded draft inputs", async () => {
  let observedInput = null;
  const response = await invokeNativeAdapterPluginRoute({
    buildNativeEngineeringLspLifecycleDraft: (input) => {
      observedInput = input;
      return {
        ok: true,
        registry: "openclaw-native-engineering-lsp-lifecycle-draft-v0",
        mode: "lsp-lifecycle-readiness-draft-only",
      };
    },
  }, "GET", "/plugins/native-adapter/engineering-lsp/lifecycle-draft?workspacePath=/tmp/openclaw&language=python&lifecycleAction=restart&limit=9");

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw",
    language: "python",
    lifecycleAction: "restart",
    limit: "9",
  });
  assert.equal(response.body.registry, "openclaw-native-engineering-lsp-lifecycle-draft-v0");
});

test("native adapter engineering LSP lifecycle state route preserves readback filters", async () => {
  let observedInput = null;
  const response = await invokeNativeAdapterPluginRoute({
    buildNativeEngineeringLspLifecycleState: (input) => {
      observedInput = input;
      return {
        ok: true,
        registry: "openclaw-native-engineering-lsp-lifecycle-state-v0",
        mode: "read-only-lsp-lifecycle-state-readback",
        summary: { totalRecords: 1 },
      };
    },
  }, "GET", "/plugins/native-adapter/engineering-lsp/lifecycle-state?workspacePath=/tmp/openclaw&language=typescript&limit=3");

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw",
    language: "typescript",
    limit: "3",
  });
  assert.equal(response.body.registry, "openclaw-native-engineering-lsp-lifecycle-state-v0");
});

test("native adapter engineering LSP source-transfer proposal route preserves bounded proposal inputs", async () => {
  let observedInput = null;
  const response = await invokeNativeAdapterPluginRoute({
    buildNativeEngineeringLspSourceTransferProposal: (input) => {
      observedInput = input;
      return {
        ok: true,
        registry: "openclaw-native-engineering-lsp-source-transfer-proposal-v0",
        mode: "lsp-didopen-source-transfer-proposal-only",
      };
    },
  }, "GET", "/plugins/native-adapter/engineering-lsp/source-transfer-proposal?workspacePath=/tmp/openclaw&language=typescript&path=src/app.ts&maxFileSizeBytes=2048&maxPreviewChars=500");

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw",
    language: "typescript",
    relativePath: "src/app.ts",
    maxFileSizeBytes: "2048",
    maxPreviewChars: "500",
  });
  assert.equal(response.body.registry, "openclaw-native-engineering-lsp-source-transfer-proposal-v0");
});

test("native adapter engineering LSP symbol request proposal route preserves request inputs", async () => {
  let observedInput = null;
  const response = await invokeNativeAdapterPluginRoute({
    buildNativeEngineeringLspSymbolRequestProposal: (input) => {
      observedInput = input;
      return {
        ok: true,
        registry: "openclaw-native-engineering-lsp-symbol-request-proposal-v0",
        mode: "lsp-symbol-request-proposal-only",
      };
    },
  }, "GET", "/plugins/native-adapter/engineering-lsp/symbol-request-proposal?workspacePath=/tmp/openclaw&language=typescript&action=definition&path=src/app.ts&line=2&character=14");

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw",
    language: "typescript",
    action: "definition",
    relativePath: "src/app.ts",
    line: "2",
    character: "14",
  });
  assert.equal(response.body.registry, "openclaw-native-engineering-lsp-symbol-request-proposal-v0");
});

test("native adapter engineering LSP selected-target read bridge route preserves bounded read inputs", async () => {
  let observedInput = null;
  const response = await invokeNativeAdapterPluginRoute({
    buildNativeEngineeringLspSelectedTargetReadBridge: (input) => {
      observedInput = input;
      return {
        ok: true,
        registry: "openclaw-native-engineering-lsp-selected-target-read-bridge-v0",
        mode: "lsp-selected-target-to-native-read-bridge",
      };
    },
  }, "GET", "/plugins/native-adapter/engineering-lsp/selected-target-read-bridge?workspacePath=/tmp/openclaw&language=typescript&taskId=task-symbol&targetIndex=1&contextLines=2&includeRead=true&maxOutputChars=700&maxFileSizeBytes=2048");

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw",
    language: "typescript",
    taskId: "task-symbol",
    targetIndex: "1",
    contextLines: "2",
    includeRead: "true",
    maxOutputChars: "700",
    maxFileSizeBytes: "2048",
  });
  assert.equal(response.body.registry, "openclaw-native-engineering-lsp-selected-target-read-bridge-v0");
});

test("native adapter engineering LSP selected-target edit proposal seed route preserves seed inputs", async () => {
  let observedInput = null;
  const response = await invokeNativeAdapterPluginRoute({
    buildNativeEngineeringLspSelectedTargetEditProposalSeed: (input) => {
      observedInput = input;
      return {
        ok: true,
        registry: "openclaw-native-engineering-lsp-selected-target-edit-proposal-seed-v0",
        mode: "lsp-selected-target-edit-proposal-seed",
      };
    },
  }, "GET", "/plugins/native-adapter/engineering-lsp/selected-target-edit-proposal-seed?workspacePath=/tmp/openclaw&language=typescript&taskId=task-symbol&targetIndex=1&contextLines=0&newString=replacement&maxOutputChars=700&maxFileSizeBytes=2048");

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(observedInput, {
    workspacePath: "/tmp/openclaw",
    language: "typescript",
    taskId: "task-symbol",
    targetIndex: "1",
    contextLines: "0",
    newString: "replacement",
    maxOutputChars: "700",
    maxFileSizeBytes: "2048",
  });
  assert.equal(response.body.registry, "openclaw-native-engineering-lsp-selected-target-edit-proposal-seed-v0");
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

test("native adapter ACPX/Codex bridge routes preserve query and persistence body", async () => {
  const observed = {};
  const getResponse = await invokeNativeAdapterPluginRoute({
    buildNativeAcpxCodexBridgeCompatibility: (input) => {
      observed.get = input;
      return {
        ok: true,
        registry: "openclaw-native-acpx-codex-bridge-compatibility-v0",
        persistence: { totalRecords: 0 },
      };
    },
  }, "GET", "/plugins/native-adapter/acpx-codex-bridge-compatibility?sessionKey=agent:codex:test");

  assert.equal(getResponse.handled, true);
  assert.equal(getResponse.statusCode, 200);
  assert.deepEqual(observed.get, {
    sessionKey: "agent:codex:test",
  });
  assert.equal(getResponse.body.registry, "openclaw-native-acpx-codex-bridge-compatibility-v0");

  const draftResponse = await invokeNativeAdapterPluginRoute({
    buildNativeAcpxCodexBridgeWrapperDraft: (input) => {
      observed.draft = input;
      return {
        ok: true,
        registry: "openclaw-native-acpx-codex-bridge-wrapper-draft-v0",
        proposal: { status: "ready_for_approval_bridge" },
      };
    },
  }, "GET", "/plugins/native-adapter/acpx-codex-bridge-wrapper-draft?sessionKey=agent:codex:test&command=npx.cmd&wrapperName=codex-acp-test");

  assert.equal(draftResponse.handled, true);
  assert.equal(draftResponse.statusCode, 200);
  assert.deepEqual(observed.draft, {
    sessionKey: "agent:codex:test",
    command: "npx.cmd",
    wrapperName: "codex-acp-test",
  });
  assert.equal(draftResponse.body.registry, "openclaw-native-acpx-codex-bridge-wrapper-draft-v0");

  const writeProposalResponse = await invokeNativeAdapterPluginRoute({
    buildNativeAcpxCodexBridgeWrapperWriteProposal: (input) => {
      observed.writeProposal = input;
      return {
        ok: true,
        registry: "openclaw-native-acpx-codex-bridge-wrapper-write-proposal-v0",
        proposal: { status: "ready_for_write_approval" },
      };
    },
  }, "GET", "/plugins/native-adapter/acpx-codex-bridge-wrapper-write-proposal?sessionKey=agent:codex:test&command=npx.cmd&wrapperName=codex-acp-test");

  assert.equal(writeProposalResponse.handled, true);
  assert.equal(writeProposalResponse.statusCode, 200);
  assert.deepEqual(observed.writeProposal, {
    sessionKey: "agent:codex:test",
    command: "npx.cmd",
    wrapperName: "codex-acp-test",
  });
  assert.equal(writeProposalResponse.body.registry, "openclaw-native-acpx-codex-bridge-wrapper-write-proposal-v0");

  const postResponse = await invokeNativeAdapterPluginRoute({
    recordNativeAcpxCodexSession: async (input) => {
      observed.post = input;
      return {
        ok: true,
        registry: "openclaw-native-acpx-codex-session-persistence-v0",
        session: { sessionKey: input.sessionKey, acpxRecordId: input.recordId },
      };
    },
  }, "POST", "/plugins/native-adapter/acpx-codex-session-records", {
    sessionKey: "agent:codex:test",
    agentId: "codex",
    recordId: "record-a",
    metadata: { purpose: "route" },
    confirm: true,
  });

  assert.equal(postResponse.handled, true);
  assert.equal(postResponse.statusCode, 201);
  assert.deepEqual(observed.post, {
    sessionKey: "agent:codex:test",
    agentId: "codex",
    recordId: "record-a",
    metadata: { purpose: "route" },
    confirm: true,
  });
  assert.equal(postResponse.body.registry, "openclaw-native-acpx-codex-session-persistence-v0");
  assert.equal(postResponse.body.session.sessionKey, "agent:codex:test");

  const taskResponse = await invokeNativeAdapterPluginRoute({
    createNativeAcpxCodexBridgeWrapperTask: async (input) => {
      observed.task = input;
      return {
        ok: true,
        registry: "openclaw-native-acpx-codex-bridge-wrapper-task-v0",
        mode: "approval-gated-acpx-codex-bridge-wrapper-task",
        generatedAt: "2026-07-10T00:00:00.000Z",
        sourceRegistry: "openclaw-native-acpx-codex-bridge-wrapper-task-draft-v0",
        task: { id: "task-acpx", status: "pending" },
        approval: { id: "approval-acpx", status: "pending" },
        governance: { createsTask: true, createsApproval: true, canWriteWrapper: false },
      };
    },
  }, "POST", "/plugins/native-adapter/acpx-codex-bridge-wrapper-tasks", {
    sessionKey: "agent:codex:test",
    command: "npx.cmd",
    wrapperName: "codex-acp-test",
    confirm: true,
  });

  assert.equal(taskResponse.handled, true);
  assert.equal(taskResponse.statusCode, 201);
  assert.deepEqual(observed.task, {
    sessionKey: "agent:codex:test",
    command: "npx.cmd",
    wrapperName: "codex-acp-test",
    confirm: true,
  });
  assert.equal(taskResponse.body.registry, "openclaw-native-acpx-codex-bridge-wrapper-task-v0");
  assert.deepEqual(taskResponse.body.task, { id: "task-acpx", status: "pending" });
  assert.deepEqual(taskResponse.body.approval, { id: "approval-acpx", status: "pending" });
});

test("native adapter declarative evolution route accepts only structured changes", async () => {
  let observedInput = null;
  const response = await invokeNativeAdapterPluginRoute({
    buildNativeDeclarativeEvolutionCandidate: async (input) => {
      observedInput = input;
      return {
        ok: true,
        registry: "openclaw-native-declarative-evolution-candidate-v0",
        candidateStatus: "validated",
      };
    },
  }, "POST", "/plugins/native-adapter/declarative-evolution/candidate", {
    changes: [{ operation: "enable_component", component: "systemSense" }],
    candidateText: "must-not-be-forwarded",
  });

  assert.equal(response.handled, true);
  assert.equal(response.statusCode, 201);
  assert.deepEqual(observedInput, {
    changes: [{ operation: "enable_component", component: "systemSense" }],
  });
  assert.equal(response.body.registry, "openclaw-native-declarative-evolution-candidate-v0");
});

test("native adapter plugin route reports misses without writing a response", async () => {
  const missed = await invokeNativeAdapterPluginRoute({}, "GET", "/workspaces");

  assert.equal(missed.handled, false);
  assert.equal(missed.statusCode, null);
  assert.equal(missed.body, null);
});

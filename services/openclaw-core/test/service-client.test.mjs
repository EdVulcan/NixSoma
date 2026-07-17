import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createServiceClient } from "../src/service-client.mjs";
import { generateKeyPairSync } from "node:crypto";
import {
  createExecutionGrantSigner,
  createExecutionGrantVerifier,
  executionGrantContextFromHeaders,
} from "../../../packages/shared-utils/src/execution-grants.mjs";

function createClient(overrides = {}, options = {}) {
  return createServiceClient({
    eventHubUrl: "http://127.0.0.1:4101",
    sessionManagerUrl: "http://127.0.0.1:4102",
    browserRuntimeUrl: "http://127.0.0.1:4103",
    screenSenseUrl: "http://127.0.0.1:4104",
    screenActUrl: "http://127.0.0.1:4105",
    systemSenseUrl: "http://127.0.0.1:4106",
    systemHealUrl: "http://127.0.0.1:4107",
    ...overrides,
  }, options);
}

test("fetchJson returns parsed successful responses", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://127.0.0.1/test");
    assert.equal(options.method, "GET");
    return new Response(JSON.stringify({ ok: true, value: 42 }), { status: 200 });
  };

  try {
    const client = createClient();
    assert.deepEqual(await client.fetchJson("http://127.0.0.1/test", { method: "GET" }), { ok: true, value: 42 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchJson raises service error payloads", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error: "not allowed" }), { status: 200 });

  try {
    const client = createClient();
    await assert.rejects(() => client.fetchJson("http://127.0.0.1/fail"), /not allowed/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("postJson sends JSON request bodies", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    const client = createClient();
    await client.postJson("http://127.0.0.1/post", { confirm: true });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["content-type"], "application/json");
  assert.equal(calls[0].options.body, '{"confirm":true}');
});

test("postJson signs configured actuator requests and binds async task context", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const signer = createExecutionGrantSigner({
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
    createId: () => "service-client-grant",
    now: () => 1_000,
  });
  const verifier = createExecutionGrantVerifier({
    publicKey: publicKey.export({ type: "spki", format: "pem" }),
    audience: "openclaw-system-sense",
    now: () => 1_000,
  });
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    const client = createClient({}, { executionGrantSigner: signer });
    await client.postJsonWithExecutionGrantContext(
      {
        taskId: "task-client",
        stepId: "step-client",
        capabilityId: "act.filesystem.write_text",
        intent: "filesystem.write",
      },
      () => client.postJson("http://127.0.0.1:4106/system/files/write-text", {
        path: "/workspace/note.txt",
        content: "bound",
      }),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  const context = executionGrantContextFromHeaders(captured.options.headers);
  const verified = verifier.verifyRequest({
    token: captured.options.headers["x-openclaw-execution-grant"],
    method: captured.options.method,
    path: new URL(captured.url).pathname,
    body: JSON.parse(captured.options.body),
    context,
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.grant.taskId, "task-client");
  assert.equal(verified.grant.stepId, "step-client");
  assert.equal(verified.grant.capabilityId, "act.filesystem.write_text");
});

test("readJsonFileIfPresent tolerates missing and malformed files", () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "openclaw-service-client-"));
  const validFile = path.join(tempDir, "valid.json");
  const invalidFile = path.join(tempDir, "invalid.json");
  writeFileSync(validFile, "\uFEFF{\"ok\":true}\n", "utf8");
  writeFileSync(invalidFile, "{not-json", "utf8");

  try {
    const client = createClient();
    assert.equal(client.readJsonFileIfPresent(path.join(tempDir, "missing.json")), null);
    assert.equal(client.readJsonFileIfPresent(invalidFile), null);
    assert.deepEqual(client.readJsonFileIfPresent(validFile), { ok: true });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("buildSystemSenseUrl includes only meaningful query params", () => {
  const client = createClient({ systemSenseUrl: "http://127.0.0.1:5106/root/" });

  const url = client.buildSystemSenseUrl("/system/files", {
    path: "/tmp/openclaw",
    empty: "",
    missing: null,
    limit: 5,
  });

  assert.equal(url, "http://127.0.0.1:5106/system/files?path=%2Ftmp%2Fopenclaw&limit=5");
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildLiveProviderConfig,
  buildLiveProviderEgressGate,
  sendLiveProviderRequest,
  CLOUD_PROVIDER_API_KEY_ENV,
  CLOUD_PROVIDER_API_KEY_FILE_ENV,
  CLOUD_PROVIDER_ENDPOINT_ENV,
  CLOUD_PROVIDER_LIVE_EGRESS_ENV,
  DEEPSEEK_CREDENTIAL_REFERENCE,
} from "../src/cloud-live-provider-network-sender.mjs";

const credentialReference = DEEPSEEK_CREDENTIAL_REFERENCE;
const authorised = {
  state: "authorized",
  confirmed: true,
  credentialValueAccessAuthorized: true,
  endpointNetworkEgressAuthorized: true,
  liveProviderCallEnabled: true,
};

function providerRequest(body = {}, reference = credentialReference) {
  return {
    request: {
      credentialReference: reference,
      body: {
        model: "operator-selected-model",
        messages: [{ role: "user", content: "hello" }],
        ...body,
      },
    },
  };
}

function responseFromJson(value, { status = 200, ok = status >= 200 && status < 300 } = {}) {
  const text = JSON.stringify(value);
  return {
    ok,
    status,
    headers: { get: () => String(Buffer.byteLength(text, "utf8")) },
    text: async () => text,
  };
}

test("live provider configuration is disabled and invalid without an explicit endpoint", () => {
  const config = buildLiveProviderConfig({ env: {} });
  assert.equal(config.ok, false);
  assert.equal(config.liveEgressEnabled, false);
  assert.equal(config.endpoint.allowed, false);
  assert.equal(config.endpoint.requestUrl, null);
});

test("the egress gate rejects a non-DeepSeek endpoint and incomplete authorization", () => {
  const config = buildLiveProviderConfig({
    env: {
      [CLOUD_PROVIDER_ENDPOINT_ENV]: "https://example.invalid",
      [CLOUD_PROVIDER_LIVE_EGRESS_ENV]: "true",
    },
  });
  const gate = buildLiveProviderEgressGate({ config, operatorAuthorization: {} });
  assert.equal(gate.allowed, false);
  assert.equal(gate.checks.endpointAllowlisted, false);
  assert.equal(gate.checks.operatorAuthorized, false);
});

test("a denied gate does not read the credential or call fetch", async () => {
  let credentialRead = false;
  const env = new Proxy({
    [CLOUD_PROVIDER_ENDPOINT_ENV]: "https://api.deepseek.com",
    [CLOUD_PROVIDER_LIVE_EGRESS_ENV]: "false",
  }, {
    get(target, property, receiver) {
      if (property === CLOUD_PROVIDER_API_KEY_ENV || property === CLOUD_PROVIDER_API_KEY_FILE_ENV) {
        credentialRead = true;
      }
      return Reflect.get(target, property, receiver);
    },
  });
  let fetchCalled = false;
  const result = await sendLiveProviderRequest({
    env,
    providerRequest: providerRequest(),
    credentialResolution: { credential: { reference: credentialReference } },
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error("fetch should not run");
    },
    operatorAuthorization: authorised,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "live_provider_egress_gate_not_satisfied");
  assert.equal(credentialRead, false);
  assert.equal(fetchCalled, false);
});

test("authorised DeepSeek request prefers a systemd credential file", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "openclaw-deepseek-credential-"));
  const credentialFile = path.join(root, "deepseek-api-key");
  const fileSecret = "file-secret-value";
  await writeFile(credentialFile, `${fileSecret}\n`, { mode: 0o600 });
  try {
    let authorization;
    const result = await sendLiveProviderRequest({
      env: {
        [CLOUD_PROVIDER_ENDPOINT_ENV]: "https://api.deepseek.com",
        [CLOUD_PROVIDER_API_KEY_FILE_ENV]: credentialFile,
        [CLOUD_PROVIDER_API_KEY_ENV]: "legacy-environment-secret",
        [CLOUD_PROVIDER_LIVE_EGRESS_ENV]: "true",
      },
      providerRequest: providerRequest(),
      credentialResolution: { credential: { reference: credentialReference } },
      operatorAuthorization: authorised,
      fetchImpl: async (_url, options) => {
        authorization = options.headers.authorization;
        return responseFromJson({
          id: "chatcmpl-file-credential",
          model: "deepseek-chat",
          choices: [{ message: { role: "assistant", content: "credential file accepted" } }],
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(authorization, `Bearer ${fileSecret}`);
    assert.equal(JSON.stringify(result).includes(fileSecret), false);
    assert.equal(JSON.stringify(result).includes("legacy-environment-secret"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("configured provider credential file fails closed when unavailable", async () => {
  let fetchCalled = false;
  const result = await sendLiveProviderRequest({
    env: {
      [CLOUD_PROVIDER_ENDPOINT_ENV]: "https://api.deepseek.com",
      [CLOUD_PROVIDER_API_KEY_FILE_ENV]: "/missing/openclaw/deepseek-api-key",
      [CLOUD_PROVIDER_LIVE_EGRESS_ENV]: "true",
    },
    providerRequest: providerRequest(),
    credentialResolution: { credential: { reference: credentialReference } },
    operatorAuthorization: authorised,
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error("fetch should not run");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "provider_credential_unavailable");
  assert.equal(fetchCalled, false);
  assert.doesNotMatch(JSON.stringify(result), /missing\/openclaw/u);
});

test("authorised DeepSeek request sends only bounded chat fields and redacts credential output", async () => {
  const secret = "test-secret-value";
  let capturedUrl;
  let capturedOptions;
  const result = await sendLiveProviderRequest({
    env: {
      [CLOUD_PROVIDER_ENDPOINT_ENV]: "https://api.deepseek.com",
      [CLOUD_PROVIDER_API_KEY_ENV]: secret,
      [CLOUD_PROVIDER_LIVE_EGRESS_ENV]: "true",
    },
    providerRequest: providerRequest({
      metadata: { shouldNotLeaveOpenClaw: true },
      temperature: 0.2,
      max_tokens: 64,
    }),
    credentialResolution: { credential: { reference: credentialReference } },
    operatorAuthorization: authorised,
    fetchImpl: async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return responseFromJson({
        id: "chatcmpl-test",
        model: "deepseek-chat",
        choices: [{ message: { role: "assistant", content: "hello from DeepSeek" } }],
        usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
      });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(capturedUrl, "https://api.deepseek.com/v1/chat/completions");
  assert.equal(capturedOptions.headers.authorization, `Bearer ${secret}`);
  const sentBody = JSON.parse(capturedOptions.body);
  assert.deepEqual(sentBody, {
    model: "deepseek-chat",
    messages: [{ role: "user", content: "hello" }],
    max_tokens: 64,
    temperature: 0.2,
  });
  assert.equal(result.response.assistantContent, "hello from DeepSeek");
  assert.equal(result.governance.credentialValueExposed, false);
  assert.equal(result.audit.providerResponseCreated, true);
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test("DeepSeek sender rejects redirects without a second hop", async () => {
  let fetchCalls = 0;
  let capturedOptions;
  const result = await sendLiveProviderRequest({
    env: {
      [CLOUD_PROVIDER_ENDPOINT_ENV]: "https://api.deepseek.com",
      [CLOUD_PROVIDER_API_KEY_ENV]: "test-secret-value",
      [CLOUD_PROVIDER_LIVE_EGRESS_ENV]: "true",
    },
    providerRequest: providerRequest(),
    credentialResolution: { credential: { reference: credentialReference } },
    operatorAuthorization: authorised,
    fetchImpl: async (_url, options) => {
      fetchCalls += 1;
      capturedOptions = options;
      return responseFromJson({ location: "https://unexpected.example" }, { status: 307, ok: false });
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "provider_redirect_rejected");
  assert.equal(fetchCalls, 1);
  assert.equal(capturedOptions.redirect, "error");
});

test("DeepSeek sender rejects a credential reference that is not the configured key", async () => {
  let fetchCalled = false;
  const result = await sendLiveProviderRequest({
    env: {
      [CLOUD_PROVIDER_ENDPOINT_ENV]: "https://api.deepseek.com",
      [CLOUD_PROVIDER_API_KEY_ENV]: "test-secret-value",
      [CLOUD_PROVIDER_LIVE_EGRESS_ENV]: "true",
    },
    providerRequest: providerRequest({}, "openclaw://credential/other-provider-key"),
    credentialResolution: { credential: { reference: "openclaw://credential/other-provider-key" } },
    operatorAuthorization: authorised,
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error("fetch should not run");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "credential_reference_not_allowed");
  assert.equal(fetchCalled, false);
});

test("provider HTTP errors remain bounded and do not expose the credential", async () => {
  const secret = "test-secret-value";
  const result = await sendLiveProviderRequest({
    env: {
      [CLOUD_PROVIDER_ENDPOINT_ENV]: "https://api.deepseek.com",
      [CLOUD_PROVIDER_API_KEY_ENV]: secret,
      [CLOUD_PROVIDER_LIVE_EGRESS_ENV]: "true",
    },
    providerRequest: providerRequest(),
    credentialResolution: { credential: { reference: credentialReference } },
    operatorAuthorization: authorised,
    fetchImpl: async () => responseFromJson({ error: { code: "bad_request", message: "request rejected" } }, { status: 400, ok: false }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "provider_http_error");
  assert.equal(result.status, 400);
  assert.equal(JSON.stringify(result).includes(secret), false);
});

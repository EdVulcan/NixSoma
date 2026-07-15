import { createHash } from "node:crypto";

export const CLOUD_PROVIDER_ENDPOINT_ENV = "OPENCLAW_CLOUD_PROVIDER_ENDPOINT";
export const CLOUD_PROVIDER_API_KEY_ENV = "OPENCLAW_CLOUD_PROVIDER_API_KEY";
export const CLOUD_PROVIDER_MODEL_ENV = "OPENCLAW_CLOUD_PROVIDER_MODEL";
export const CLOUD_PROVIDER_LIVE_EGRESS_ENV = "OPENCLAW_CLOUD_PROVIDER_LIVE_EGRESS";
export const DEEPSEEK_PROVIDER_HOST = "api.deepseek.com";
export const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";
export const DEEPSEEK_CREDENTIAL_REFERENCE = "openclaw://credential/deepseek-api-key";
export const LIVE_PROVIDER_REQUEST_PATH = "/v1/chat/completions";

const LIVE_PROVIDER_SENDER_REGISTRY =
  "openclaw-cloud-consciousness-live-provider-network-sender-v0";
const MAX_MESSAGE_COUNT = 16;
const MAX_MESSAGE_CONTENT_CHARS = 8_000;
const MAX_REQUEST_BYTES = 32 * 1024;
const MAX_RESPONSE_BYTES = 128 * 1024;
const MAX_RESPONSE_CONTENT_CHARS = 16_000;
const MAX_TIMEOUT_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_SOURCE_TASK_ID_CHARS = 200;
const ALLOWED_MESSAGE_ROLES = new Set(["system", "user", "assistant"]);

function stableJson(value) {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseBoolean(value) {
  return value === true || value === "true" || value === "1";
}

function boundedText(value, maxChars) {
  return typeof value === "string" ? value.slice(0, maxChars) : "";
}

function normaliseSourceTaskId(value) {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, value: null };
  const normalised = value.trim();
  if (normalised.length === 0) return { ok: true, value: null };
  if (normalised.length > MAX_SOURCE_TASK_ID_CHARS) return { ok: false, value: null };
  return { ok: true, value: normalised };
}

function redactText(value, secret) {
  const text = boundedText(value, MAX_RESPONSE_CONTENT_CHARS);
  return secret && text.includes(secret) ? text.split(secret).join("[redacted]") : text;
}

function normaliseEndpoint(endpoint, allowedHosts) {
  if (typeof endpoint !== "string" || endpoint.trim().length === 0) {
    return { ok: false, reason: "provider_endpoint_missing" };
  }

  let parsed;
  try {
    parsed = new URL(endpoint.trim());
  } catch {
    return { ok: false, reason: "provider_endpoint_invalid" };
  }

  const pathname = parsed.pathname.replace(/\/+$/, "");
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "provider_endpoint_requires_https" };
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.port) {
    return { ok: false, reason: "provider_endpoint_contains_disallowed_parts" };
  }
  if (pathname !== "" && pathname !== "/v1") {
    return { ok: false, reason: "provider_endpoint_path_not_allowed" };
  }
  if (!allowedHosts.includes(parsed.hostname)) {
    return { ok: false, reason: "provider_endpoint_host_not_allowlisted" };
  }

  const origin = parsed.origin;
  return {
    ok: true,
    host: parsed.hostname,
    requestUrl: `${origin}${LIVE_PROVIDER_REQUEST_PATH}`,
    endpointFingerprint: hashText(origin),
  };
}

export function buildLiveProviderConfig({ env = process.env } = {}) {
  const endpoint = normaliseEndpoint(env[CLOUD_PROVIDER_ENDPOINT_ENV], [DEEPSEEK_PROVIDER_HOST]);
  const model = typeof env[CLOUD_PROVIDER_MODEL_ENV] === "string"
    && env[CLOUD_PROVIDER_MODEL_ENV].trim().length > 0
    ? boundedText(env[CLOUD_PROVIDER_MODEL_ENV].trim(), 120)
    : DEEPSEEK_DEFAULT_MODEL;

  return {
    ok: endpoint.ok,
    provider: "deepseek",
    model,
    endpoint: {
      configured: typeof env[CLOUD_PROVIDER_ENDPOINT_ENV] === "string"
        && env[CLOUD_PROVIDER_ENDPOINT_ENV].trim().length > 0,
      allowed: endpoint.ok,
      host: endpoint.host ?? null,
      requestUrl: endpoint.requestUrl ?? null,
      fingerprint: endpoint.endpointFingerprint ?? null,
    },
    endpointFingerprint: endpoint.endpointFingerprint ?? null,
    credentialEnv: CLOUD_PROVIDER_API_KEY_ENV,
    liveEgressEnabled: parseBoolean(env[CLOUD_PROVIDER_LIVE_EGRESS_ENV]),
    error: endpoint.ok ? null : endpoint.reason,
  };
}

export function buildLiveProviderEgressGate({ config, operatorAuthorization = {} } = {}) {
  const checks = {
    endpointConfigured: config?.endpoint?.configured === true,
    endpointAllowlisted: config?.endpoint?.allowed === true,
    liveEgressEnabled: config?.liveEgressEnabled === true,
    operatorAuthorized: operatorAuthorization.state === "authorized",
    confirmed: operatorAuthorization.confirmed === true,
    credentialValueAccessAuthorized: operatorAuthorization.credentialValueAccessAuthorized === true,
    endpointNetworkEgressAuthorized: operatorAuthorization.endpointNetworkEgressAuthorized === true,
    liveProviderCallEnabled: operatorAuthorization.liveProviderCallEnabled === true,
  };
  const allowed = Object.values(checks).every(Boolean);
  return {
    allowed,
    checks,
    reason: allowed ? null : "live_provider_egress_gate_not_satisfied",
  };
}

function buildOutboundBody(providerRequest, model) {
  const request = providerRequest?.request ?? providerRequest ?? {};
  const source = request.body && typeof request.body === "object" ? request.body : {};
  const messages = Array.isArray(source.messages) ? source.messages : [];
  if (messages.length === 0 || messages.length > MAX_MESSAGE_COUNT) {
    return { ok: false, reason: "provider_messages_count_out_of_bounds" };
  }

  const normalisedMessages = [];
  let messageBytes = 0;
  for (const message of messages) {
    if (!message || typeof message !== "object" || !ALLOWED_MESSAGE_ROLES.has(message.role)) {
      return { ok: false, reason: "provider_message_role_not_allowed" };
    }
    if (typeof message.content !== "string" || message.content.length > MAX_MESSAGE_CONTENT_CHARS) {
      return { ok: false, reason: "provider_message_content_out_of_bounds" };
    }
    messageBytes += Buffer.byteLength(message.content, "utf8");
    normalisedMessages.push({ role: message.role, content: message.content });
  }

  const body = {
    model: typeof source.model === "string"
      && source.model.trim().length > 0
      && source.model !== "operator-selected-model"
      ? boundedText(source.model.trim(), 120)
      : model,
    messages: normalisedMessages,
  };
  if (typeof source.temperature === "number" && Number.isFinite(source.temperature)
    && source.temperature >= 0 && source.temperature <= 2) {
    body.temperature = source.temperature;
  }
  if (Number.isInteger(source.max_tokens) && source.max_tokens > 0 && source.max_tokens <= 4096) {
    body.max_tokens = source.max_tokens;
  }

  const bodyText = stableJson(body);
  if (messageBytes > MAX_REQUEST_BYTES || Buffer.byteLength(bodyText, "utf8") > MAX_REQUEST_BYTES) {
    return { ok: false, reason: "provider_request_out_of_bounds" };
  }
  return { ok: true, body, bodyText, requestContentHash: hashText(bodyText) };
}

export function validateLiveProviderRequestEnvelope({ requestEnvelope, model = DEEPSEEK_DEFAULT_MODEL } = {}) {
  if (!requestEnvelope || typeof requestEnvelope !== "object" || Array.isArray(requestEnvelope)) {
    return { ok: false, reason: "provider_request_envelope_required" };
  }
  const outbound = buildOutboundBody({ request: { body: requestEnvelope } }, model);
  return outbound.ok
    ? {
        ok: true,
        model: outbound.body.model,
        requestContentHash: outbound.requestContentHash,
      }
    : { ok: false, reason: outbound.reason };
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function bindingHash(binding) {
  const { bindingHash: _ignored, ...hashable } = binding;
  if (hashable.sourceTaskId == null) delete hashable.sourceTaskId;
  return hashText(stableJson(hashable));
}

export function validateLiveProviderRequestBinding(binding) {
  if (!binding || typeof binding !== "object" || Array.isArray(binding)) {
    return { ok: false, reason: "provider_request_binding_missing" };
  }
  const sourceTaskId = normaliseSourceTaskId(binding.sourceTaskId);
  if (binding.registry !== "openclaw-cloud-consciousness-live-provider-request-binding-v0"
    || binding.provider !== "deepseek"
    || binding.credentialReference !== DEEPSEEK_CREDENTIAL_REFERENCE
    || typeof binding.model !== "string"
    || binding.model.length === 0
    || !isSha256(binding.endpointFingerprint)
    || !isSha256(binding.requestContentHash)
    || (binding.contextContentHash !== null && !isSha256(binding.contextContentHash))
    || (binding.responseContract !== null && typeof binding.responseContract !== "string")
    || binding.requestContentIncluded !== false
    || binding.credentialValueIncluded !== false
    || binding.executionAuthorization?.credentialValueAccessAuthorized !== true
    || binding.executionAuthorization?.endpointNetworkEgressAuthorized !== true
    || binding.executionAuthorization?.liveProviderCallEnabled !== true
    || !sourceTaskId.ok
    || (binding.sourceTaskId != null && binding.sourceTaskId !== sourceTaskId.value)
    || !isSha256(binding.bindingHash)
    || binding.bindingHash !== bindingHash(binding)) {
    return { ok: false, reason: "provider_request_binding_invalid" };
  }
  return { ok: true, binding };
}

export function buildLiveProviderRequestBinding({
  providerRequest = null,
  requestEnvelope = null,
  credentialReference = null,
  responseContract = null,
  contextContentHash = null,
  sourceTaskId = null,
  env = process.env,
} = {}) {
  const config = buildLiveProviderConfig({ env });
  const normalisedSourceTaskId = normaliseSourceTaskId(sourceTaskId);
  if (!normalisedSourceTaskId.ok) {
    return { ok: false, reason: "provider_source_task_id_invalid" };
  }
  const request = providerRequest ?? {
    request: {
      credentialReference,
      body: requestEnvelope,
    },
  };
  const actualCredentialReference = request?.request?.credentialReference
    ?? credentialReference
    ?? null;
  if (actualCredentialReference !== DEEPSEEK_CREDENTIAL_REFERENCE) {
    return { ok: false, reason: "credential_reference_not_allowed" };
  }
  if (!config.endpointFingerprint) {
    return { ok: false, reason: "provider_endpoint_not_bound" };
  }
  const outbound = buildOutboundBody(request, config.model);
  if (!outbound.ok) return { ok: false, reason: outbound.reason };
  const binding = {
    registry: "openclaw-cloud-consciousness-live-provider-request-binding-v0",
    provider: "deepseek",
    model: outbound.body.model,
    endpointFingerprint: config.endpointFingerprint,
    credentialReference: actualCredentialReference,
    requestContentHash: outbound.requestContentHash,
    contextContentHash: contextContentHash ?? null,
    responseContract: responseContract ?? null,
    requestContentIncluded: false,
    credentialValueIncluded: false,
    executionAuthorization: {
      credentialValueAccessAuthorized: true,
      endpointNetworkEgressAuthorized: true,
      liveProviderCallEnabled: true,
    },
  };
  if (normalisedSourceTaskId.value) binding.sourceTaskId = normalisedSourceTaskId.value;
  const result = validateLiveProviderRequestBinding({ ...binding, bindingHash: bindingHash(binding) });
  return result.ok ? result : { ok: false, reason: result.reason };
}

function safeUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  const result = {};
  for (const key of ["prompt_tokens", "completion_tokens", "total_tokens"]) {
    if (Number.isInteger(usage[key]) && usage[key] >= 0) result[key] = usage[key];
  }
  return Object.keys(result).length > 0 ? result : null;
}

async function readBoundedResponse(response) {
  const contentLength = Number.parseInt(response.headers?.get?.("content-length") ?? "", 10);
  if (Number.isInteger(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    await response.body?.cancel?.();
    return { ok: false, reason: "provider_response_out_of_bounds" };
  }

  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          return { ok: false, reason: "provider_response_out_of_bounds" };
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock?.();
    }
    return { ok: true, text: Buffer.concat(chunks).toString("utf8") };
  }

  const text = await response.text();
  return Buffer.byteLength(text, "utf8") <= MAX_RESPONSE_BYTES
    ? { ok: true, text }
    : { ok: false, reason: "provider_response_out_of_bounds" };
}

function baseResult({ config, gate, credentialReference, requestContentHash = null } = {}) {
  return {
    ok: false,
    registry: LIVE_PROVIDER_SENDER_REGISTRY,
    mode: "governed_deepseek_live_provider_sender",
    provider: config?.provider ?? "deepseek",
    model: config?.model ?? null,
    gate,
    audit: {
      endpointFingerprint: config?.endpointFingerprint ?? null,
      credentialReference,
      requestContentHash,
      responseContentHash: null,
      endpointContacted: false,
      networkEgress: false,
      transmitsExternally: false,
      providerResponseCreated: false,
    },
    governance: {
      credentialValueIncluded: false,
      credentialValueExposed: false,
      providerCredentialRead: false,
      credentialValueRead: false,
      endpointContacted: false,
      networkEgress: false,
      transmitsExternally: false,
      providerResponseCreated: false,
      liveProviderCallEnabled: false,
    },
    response: null,
  };
}

export async function sendLiveProviderRequest({
  providerRequest = {},
  credentialResolution = {},
  operatorAuthorization = {},
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const config = buildLiveProviderConfig({ env });
  const gate = buildLiveProviderEgressGate({ config, operatorAuthorization });
  const credential = credentialResolution?.credential ?? {};
  const credentialReference = providerRequest?.request?.credentialReference
    ?? credential.reference
    ?? null;
  const result = baseResult({ config, gate, credentialReference });
  if (!gate.allowed) return { ...result, reason: gate.reason, configurationError: config.error };
  if (typeof fetchImpl !== "function") return { ...result, reason: "fetch_unavailable" };
  if (credentialReference !== DEEPSEEK_CREDENTIAL_REFERENCE) {
    return { ...result, reason: "credential_reference_not_allowed" };
  }

  const outbound = buildOutboundBody(providerRequest, config.model);
  if (!outbound.ok) return { ...result, reason: outbound.reason };
  result.audit.requestContentHash = outbound.requestContentHash;

  const credentialValue = typeof env[CLOUD_PROVIDER_API_KEY_ENV] === "string"
    ? env[CLOUD_PROVIDER_API_KEY_ENV].trim()
    : "";
  if (credentialValue.length === 0) return { ...result, reason: "provider_credential_missing" };

  const boundedTimeoutMs = Math.min(MAX_TIMEOUT_MS, Math.max(1, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), boundedTimeoutMs);
  let response;
  let responseBody;
  try {
    response = await fetchImpl(config.endpoint.requestUrl, {
      method: "POST",
      redirect: "error",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${credentialValue}`,
      },
      body: outbound.bodyText,
      signal: controller.signal,
    });
    result.audit.endpointContacted = true;
    result.audit.networkEgress = true;
    result.audit.transmitsExternally = true;
    result.governance.providerCredentialRead = true;
    result.governance.credentialValueRead = true;
    result.governance.endpointContacted = true;
    result.governance.networkEgress = true;
    result.governance.transmitsExternally = true;
    result.governance.liveProviderCallEnabled = true;
    if (response.status >= 300 && response.status < 400) {
      return {
        ...result,
        reason: "provider_redirect_rejected",
        status: response.status,
        governance: {
          ...result.governance,
          providerCredentialRead: true,
          credentialValueRead: true,
          endpointContacted: true,
          networkEgress: true,
          transmitsExternally: true,
          liveProviderCallEnabled: true,
        },
      };
    }
    responseBody = await readBoundedResponse(response);
  } catch (error) {
    result.audit.endpointContacted = true;
    result.audit.networkEgress = true;
    result.audit.transmitsExternally = true;
    result.governance.providerCredentialRead = true;
    result.governance.credentialValueRead = true;
    result.governance.endpointContacted = true;
    result.governance.networkEgress = true;
    result.governance.transmitsExternally = true;
    result.governance.liveProviderCallEnabled = true;
    return {
      ...result,
      reason: error?.name === "AbortError" ? "provider_request_timed_out" : "provider_request_failed",
      errorMessage: redactText(error?.message ?? "Provider request failed.", credentialValue).slice(0, 500),
    };
  } finally {
    clearTimeout(timer);
  }

  if (!responseBody.ok) {
    return {
      ...result,
      reason: responseBody.reason,
      status: response.status,
      governance: {
        ...result.governance,
        providerCredentialRead: true,
        credentialValueRead: true,
        endpointContacted: true,
        networkEgress: true,
        transmitsExternally: true,
        liveProviderCallEnabled: true,
      },
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(responseBody.text);
  } catch {
    return {
      ...result,
      reason: "provider_response_invalid_json",
      status: response.status,
      governance: {
        ...result.governance,
        providerCredentialRead: true,
        credentialValueRead: true,
        endpointContacted: true,
        networkEgress: true,
        transmitsExternally: true,
        liveProviderCallEnabled: true,
      },
    };
  }

  if (!response.ok) {
    const providerError = parsed?.error;
    return {
      ...result,
      reason: "provider_http_error",
      status: response.status,
      errorCode: boundedText(providerError?.code, 120) || null,
      errorMessage: redactText(providerError?.message ?? "Provider returned an error.", credentialValue).slice(0, 500),
      governance: {
        ...result.governance,
        providerCredentialRead: true,
        credentialValueRead: true,
        endpointContacted: true,
        networkEgress: true,
        transmitsExternally: true,
        liveProviderCallEnabled: true,
      },
    };
  }

  const message = parsed?.choices?.[0]?.message;
  const content = typeof message?.content === "string" ? message.content : "";
  if (content.length === 0) {
    return {
      ...result,
      reason: "provider_response_missing_assistant_content",
      status: response.status,
      governance: {
        ...result.governance,
        providerCredentialRead: true,
        credentialValueRead: true,
        endpointContacted: true,
        networkEgress: true,
        transmitsExternally: true,
        liveProviderCallEnabled: true,
      },
    };
  }

  const responseContentHash = hashText(content);
  result.audit.responseContentHash = responseContentHash;
  result.audit.providerResponseCreated = true;
  result.governance.providerCredentialRead = true;
  result.governance.credentialValueRead = true;
  result.governance.endpointContacted = true;
  result.governance.networkEgress = true;
  result.governance.transmitsExternally = true;
  result.governance.providerResponseCreated = true;
  result.governance.liveProviderCallEnabled = true;
  return {
    ...result,
    ok: response.ok,
    status: response.status,
    response: {
      transient: true,
      id: boundedText(parsed.id, 160) || null,
      model: boundedText(parsed.model, 120) || config.model,
      assistantContent: redactText(content, credentialValue),
      responseContentHash,
      responseTruncated: content.length > MAX_RESPONSE_CONTENT_CHARS,
      usage: safeUsage(parsed.usage),
    },
  };
}

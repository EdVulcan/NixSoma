import {
  buildLiveProviderConfig,
  sendLiveProviderRequest,
  CLOUD_PROVIDER_API_KEY_ENV,
  CLOUD_PROVIDER_API_KEY_FILE_ENV,
  CLOUD_PROVIDER_ENDPOINT_ENV,
  CLOUD_PROVIDER_MODEL_ENV,
  CLOUD_PROVIDER_LIVE_EGRESS_ENV,
} from "../../services/openclaw-core/src/cloud-live-provider-network-sender.mjs";
import { buildProviderRequest } from "../../services/openclaw-core/src/cloud-live-provider-runtime-adapter.mjs";

if (!process.argv.includes("--confirm-live-call")) {
  throw new Error("Pass --confirm-live-call to authorize one bounded provider request.");
}

const config = buildLiveProviderConfig();
if (!config.ok) {
  throw new Error(`Provider configuration is not ready: ${config.error}.`);
}

const credentialReference = "openclaw://credential/deepseek-api-key";
const operatorAuthorization = {
  state: "authorized",
  confirmed: true,
  credentialValueAccessAuthorized: true,
  endpointNetworkEgressAuthorized: true,
  liveProviderCallEnabled: true,
};
const providerRequest = buildProviderRequest({
  executionPlan: {
    credentialReference,
    endpointFingerprint: config.endpointFingerprint,
  },
  requestEnvelope: {
    id: "openclaw-deepseek-connectivity-check",
    model: config.model,
    messages: [
      {
        role: "user",
        content: "Return exactly: OpenClaw DeepSeek connectivity check passed.",
      },
    ],
  },
  operatorAuthorization,
});

const result = await sendLiveProviderRequest({
  providerRequest,
  credentialResolution: { credential: { reference: credentialReference, value: null, resolvedValue: null } },
  operatorAuthorization,
});

const output = {
  ok: result.ok,
  provider: result.provider,
  model: result.model,
  status: result.status ?? null,
  reason: result.reason ?? null,
  response: result.response
    ? {
      id: result.response.id,
      model: result.response.model,
      assistantContent: result.response.assistantContent,
      responseContentHash: result.response.responseContentHash,
      responseTruncated: result.response.responseTruncated,
      usage: result.response.usage,
    }
    : null,
  audit: result.audit,
  governance: result.governance,
  configuration: {
    endpointEnv: CLOUD_PROVIDER_ENDPOINT_ENV,
    credentialEnv: CLOUD_PROVIDER_API_KEY_ENV,
    credentialFileEnv: CLOUD_PROVIDER_API_KEY_FILE_ENV,
    modelEnv: CLOUD_PROVIDER_MODEL_ENV,
    liveEgressEnv: CLOUD_PROVIDER_LIVE_EGRESS_ENV,
    endpointHost: config.endpoint.host,
    endpointFingerprint: config.endpointFingerprint,
  },
};
console.log(JSON.stringify(output, null, 2));
if (!result.ok) process.exitCode = 1;

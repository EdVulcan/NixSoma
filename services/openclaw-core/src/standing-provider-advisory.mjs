import { createHash } from "node:crypto";

import {
  buildProviderRequest,
} from "./cloud-live-provider-runtime-adapter.mjs";
import {
  buildLiveProviderRequestBinding,
  DEEPSEEK_CREDENTIAL_REFERENCE,
  sendLiveProviderRequest,
} from "./cloud-live-provider-network-sender.mjs";
import {
  buildCloudLiveProviderEngineeringRecommendationInstruction,
  CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
  parseCloudLiveProviderEngineeringRecommendation,
} from "./cloud-live-provider-runtime-response-contract.mjs";
import { listFixedUnitIncidentTargets } from "./fixed-unit-incident-scheduler.mjs";

export const STANDING_PROVIDER_ADVISORY_REGISTRY =
  "openclaw-standing-provider-advisory-v0";

const DEFAULT_MAX_CALLS_PER_DAY = 3;
const DEFAULT_MAX_TOKENS_PER_DAY = 4096;
const DEFAULT_COOLDOWN_SECONDS = 900;
const MAX_COMPLETION_TOKENS = 256;
const CONSERVATIVE_TOKEN_CHARGE = 1024;
const ALLOWED_LOAD_STATES = new Set(["loaded", "not-found", "error", "masked", "stub"]);
const ALLOWED_ACTIVE_STATES = new Set([
  "active", "reloading", "inactive", "failed", "activating", "deactivating",
]);
const ALLOWED_SUB_STATES = new Set([
  "running", "exited", "dead", "failed", "start", "stop", "auto-restart",
]);

function stableJson(value) {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashValue(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function parseBoolean(value) {
  return value === true || value === "true" || value === "1";
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function compactEnum(value, allowed) {
  return typeof value === "string" && allowed.has(value) ? value : "unknown";
}

function dayKey(timestamp) {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

function safeTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Date(Date.parse(value)).toISOString()
    : null;
}

function safeHash(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value) ? value : null;
}

export function buildStandingProviderAdvisoryConfig({ env = process.env } = {}) {
  return {
    enabled: parseBoolean(env.OPENCLAW_CLOUD_PROVIDER_STANDING_ADVISORY_ENABLED),
    maxCallsPerDay: boundedInteger(
      env.OPENCLAW_CLOUD_PROVIDER_STANDING_ADVISORY_MAX_CALLS_PER_DAY,
      DEFAULT_MAX_CALLS_PER_DAY,
      1,
      24,
    ),
    maxTokensPerDay: boundedInteger(
      env.OPENCLAW_CLOUD_PROVIDER_STANDING_ADVISORY_MAX_TOKENS_PER_DAY,
      DEFAULT_MAX_TOKENS_PER_DAY,
      CONSERVATIVE_TOKEN_CHARGE,
      65_536,
    ),
    cooldownSeconds: boundedInteger(
      env.OPENCLAW_CLOUD_PROVIDER_STANDING_ADVISORY_COOLDOWN_SECONDS,
      DEFAULT_COOLDOWN_SECONDS,
      30,
      86_400,
    ),
    maxCompletionTokens: MAX_COMPLETION_TOKENS,
    conservativeTokenCharge: CONSERVATIVE_TOKEN_CHARGE,
  };
}

export function normaliseStandingProviderAdvisoryState(state = {}, {
  now = () => new Date().toISOString(),
} = {}) {
  const currentDay = dayKey(now()) ?? new Date().toISOString().slice(0, 10);
  const restoredDay = typeof state.day === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(state.day)
    ? state.day
    : currentDay;
  const sameDay = restoredDay === currentDay;
  Object.assign(state, {
    registry: STANDING_PROVIDER_ADVISORY_REGISTRY,
    day: currentDay,
    callsUsed: sameDay ? boundedInteger(state.callsUsed, 0, 0, 24) : 0,
    tokensUsed: sameDay ? boundedInteger(state.tokensUsed, 0, 0, 65_536) : 0,
    lastCallAt: safeTimestamp(state.lastCallAt),
    lastContextHash: safeHash(state.lastContextHash),
    lastRequestHash: safeHash(state.lastRequestHash),
    lastResponseHash: safeHash(state.lastResponseHash),
    lastActionId: typeof state.lastActionId === "string" ? state.lastActionId.slice(0, 80) : null,
    lastResult: typeof state.lastResult === "string" ? state.lastResult.slice(0, 80) : "not_called",
    lastUsageTokens: boundedInteger(state.lastUsageTokens, 0, 0, 65_536),
  });
  for (const key of Object.keys(state)) {
    if (!["registry", "day", "callsUsed", "tokensUsed", "lastCallAt", "lastContextHash",
      "lastRequestHash", "lastResponseHash", "lastActionId", "lastResult", "lastUsageTokens"].includes(key)) {
      delete state[key];
    }
  }
  return state;
}

function compactContext({ health, inventory, observedAt }) {
  const inventoryUnits = Array.isArray(inventory?.units) ? inventory.units : [];
  return {
    registry: "openclaw-standing-provider-advisory-context-v0",
    observedAt,
    targets: listFixedUnitIncidentTargets().map((target) => {
      const unit = inventoryUnits.find((item) => item?.unit === target.unit) ?? null;
      const service = target.healthServiceKey === "systemSense" && health?.ok === true
        ? { ok: true, status: "healthy" }
        : health?.system?.services?.[target.healthServiceKey] ?? null;
      return {
        unit: target.unit,
        healthServiceKey: target.healthServiceKey,
        service: {
          observed: service !== null,
          ok: service?.ok === true,
          status: compactEnum(service?.status, new Set(["healthy", "unhealthy", "offline"])),
        },
        systemd: {
          observed: unit?.systemdObserved === true,
          loadState: compactEnum(unit?.loadState, ALLOWED_LOAD_STATES),
          activeState: compactEnum(unit?.activeState, ALLOWED_ACTIVE_STATES),
          subState: compactEnum(unit?.subState, ALLOWED_SUB_STATES),
        },
      };
    }),
    exclusions: {
      urls: true,
      errorMessages: true,
      journalMessages: true,
      commands: true,
      filePaths: true,
      credentials: true,
      callerContext: true,
    },
  };
}

function fallbackResult(reason, state, config) {
  return {
    ok: true,
    registry: STANDING_PROVIDER_ADVISORY_REGISTRY,
    status: "local_fallback",
    fallback: {
      reason,
      actionId: "review_current_todo",
      requiresOperatorReview: true,
      createsTaskAutomatically: false,
      createsApprovalAutomatically: false,
      executesAutomatically: false,
    },
    evidence: {
      contextContentHash: null,
      requestContentHash: null,
      responseContentHash: null,
      actionId: "review_current_todo",
      budget: {
        day: state.day,
        callsUsed: state.callsUsed,
        callsLimit: config.maxCallsPerDay,
        tokensUsed: state.tokensUsed,
        tokensLimit: config.maxTokensPerDay,
      },
    },
    governance: {
      standingAuthorization: true,
      providerCalled: false,
      networkEgress: false,
      createsTask: false,
      createsApproval: false,
      executesRecommendation: false,
      mutatesHost: false,
    },
  };
}

export function createStandingProviderAdvisory({
  state = {},
  fetchJson,
  systemSenseUrl,
  publishAuditEvent = async () => ({ ok: true }),
  persistState = () => {},
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString(),
  sendProviderRequest = sendLiveProviderRequest,
} = {}) {
  const config = buildStandingProviderAdvisoryConfig({ env });
  normaliseStandingProviderAdvisoryState(state, { now });
  let inFlight = false;

  async function invoke() {
    normaliseStandingProviderAdvisoryState(state, { now });
    if (!config.enabled) return fallbackResult("standing_advisory_disabled", state, config);
    if (inFlight) return fallbackResult("standing_advisory_in_flight", state, config);

    const invocationAt = now();
    const lastCallMs = Date.parse(state.lastCallAt ?? "");
    const invocationMs = Date.parse(invocationAt);
    if (Number.isFinite(lastCallMs) && Number.isFinite(invocationMs)
      && invocationMs - lastCallMs < config.cooldownSeconds * 1000) {
      return fallbackResult("standing_advisory_cooldown", state, config);
    }
    if (state.callsUsed >= config.maxCallsPerDay) {
      return fallbackResult("standing_advisory_call_budget_exhausted", state, config);
    }
    if (state.tokensUsed + config.conservativeTokenCharge > config.maxTokensPerDay) {
      return fallbackResult("standing_advisory_token_budget_exhausted", state, config);
    }

    inFlight = true;
    try {
      let health;
      let inventory;
      try {
        [health, inventory] = await Promise.all([
          fetchJson(`${systemSenseUrl}/system/health`),
          fetchJson(`${systemSenseUrl}/system/systemd/units`),
        ]);
      } catch {
        return fallbackResult("standing_advisory_context_unavailable", state, config);
      }

      const context = compactContext({ health, inventory, observedAt: invocationAt });
      const contextContentHash = hashValue(context);
      const providerRequest = buildProviderRequest({
        executionPlan: { credentialReference: DEEPSEEK_CREDENTIAL_REFERENCE },
        requestEnvelope: {
          messages: [
            { role: "system", content: buildCloudLiveProviderEngineeringRecommendationInstruction() },
            {
              role: "user",
              content: `Select one operator-reviewed next action from this fixed-unit health context: ${stableJson(context)}`,
            },
          ],
          temperature: 0,
          max_tokens: config.maxCompletionTokens,
        },
        operatorAuthorization: { state: "standing_authorized" },
      });
      const bindingResult = buildLiveProviderRequestBinding({
        providerRequest,
        responseContract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
        contextContentHash,
        env,
      });
      if (!bindingResult.ok) {
        return fallbackResult("standing_advisory_request_invalid", state, config);
      }
      const binding = bindingResult.binding;

      try {
        const audit = await publishAuditEvent("cloud_provider.standing_advisory_egress_authorized", {
          registry: STANDING_PROVIDER_ADVISORY_REGISTRY,
          at: invocationAt,
          contextContentHash,
          requestContentHash: binding.requestContentHash,
          bindingHash: binding.bindingHash,
          endpointFingerprint: binding.endpointFingerprint,
          credentialReference: binding.credentialReference,
          model: binding.model,
          conservativeTokenCharge: config.conservativeTokenCharge,
          callsUsedBefore: state.callsUsed,
          tokensUsedBefore: state.tokensUsed,
          createsTask: false,
          createsApproval: false,
          executesRecommendation: false,
        });
        if (audit?.ok !== true) {
          throw new Error("required standing advisory audit was not accepted");
        }
      } catch {
        return fallbackResult("standing_advisory_audit_unavailable", state, config);
      }

      Object.assign(state, {
        callsUsed: state.callsUsed + 1,
        tokensUsed: state.tokensUsed + config.conservativeTokenCharge,
        lastCallAt: invocationAt,
        lastContextHash: contextContentHash,
        lastRequestHash: binding.requestContentHash,
        lastResponseHash: null,
        lastActionId: null,
        lastResult: "provider_call_reserved",
        lastUsageTokens: 0,
      });
      persistState();
      persistState.flush?.();

      let providerResult;
      try {
        providerResult = await sendProviderRequest({
          providerRequest,
          credentialResolution: { credential: { reference: DEEPSEEK_CREDENTIAL_REFERENCE } },
          operatorAuthorization: {
            state: "authorized",
            confirmed: true,
            credentialValueAccessAuthorized: true,
            endpointNetworkEgressAuthorized: true,
            liveProviderCallEnabled: true,
          },
          env,
          fetchImpl,
        });
      } catch {
        state.lastResult = "provider_call_failed";
        persistState();
        return fallbackResult("standing_advisory_provider_failed", state, config);
      }
      if (!providerResult?.ok) {
        state.lastResult = "provider_call_failed";
        persistState();
        return fallbackResult("standing_advisory_provider_failed", state, config);
      }

      const parsed = parseCloudLiveProviderEngineeringRecommendation({
        contract: CLOUD_CONSCIOUSNESS_LIVE_PROVIDER_ENGINEERING_RECOMMENDATION_CONTRACT,
        assistantContent: providerResult.response?.assistantContent,
        responseContentHash: providerResult.response?.responseContentHash,
      });
      if (!parsed.ok) {
        state.lastResponseHash = safeHash(providerResult.response?.responseContentHash);
        state.lastResult = "response_contract_failed";
        state.lastUsageTokens = boundedInteger(providerResult.response?.usage?.total_tokens, 0, 0, 65_536);
        persistState();
        return fallbackResult("standing_advisory_response_invalid", state, config);
      }

      Object.assign(state, {
        lastResponseHash: safeHash(providerResult.response?.responseContentHash),
        lastActionId: parsed.recommendation.actionId,
        lastResult: "recommendation_returned",
        lastUsageTokens: boundedInteger(providerResult.response?.usage?.total_tokens, 0, 0, 65_536),
      });
      persistState();
      return {
        ok: true,
        registry: STANDING_PROVIDER_ADVISORY_REGISTRY,
        status: "recommendation_returned",
        recommendation: parsed.recommendation,
        evidence: {
          contextContentHash,
          requestContentHash: binding.requestContentHash,
          responseContentHash: providerResult.response?.responseContentHash ?? null,
          actionId: parsed.recommendation.actionId,
          model: providerResult.response?.model ?? binding.model,
          usage: providerResult.response?.usage ?? null,
          budget: {
            day: state.day,
            callsUsed: state.callsUsed,
            callsLimit: config.maxCallsPerDay,
            tokensUsed: state.tokensUsed,
            tokensLimit: config.maxTokensPerDay,
          },
        },
        governance: {
          standingAuthorization: true,
          providerCalled: true,
          networkEgress: true,
          createsTask: false,
          createsApproval: false,
          executesRecommendation: false,
          mutatesHost: false,
        },
      };
    } finally {
      inFlight = false;
    }
  }

  function restoreState() {
    normaliseStandingProviderAdvisoryState(state, { now });
    persistState();
    persistState.flush?.();
    return {
      ok: true,
      registry: STANDING_PROVIDER_ADVISORY_REGISTRY,
      day: state.day,
      callsUsed: state.callsUsed,
      tokensUsed: state.tokensUsed,
    };
  }

  return {
    config,
    state,
    invoke,
    restoreState,
  };
}

import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";

import { createStandingProviderAdvisory } from "../src/standing-provider-advisory.mjs";

const BASE_ENV = {
  OPENCLAW_CLOUD_PROVIDER_ENDPOINT: "https://api.deepseek.com",
  OPENCLAW_CLOUD_PROVIDER_MODEL: "deepseek-chat",
  OPENCLAW_CLOUD_PROVIDER_LIVE_EGRESS: "1",
  OPENCLAW_CLOUD_PROVIDER_STANDING_ADVISORY_ENABLED: "1",
  OPENCLAW_CLOUD_PROVIDER_STANDING_ADVISORY_MAX_CALLS_PER_DAY: "3",
  OPENCLAW_CLOUD_PROVIDER_STANDING_ADVISORY_MAX_TOKENS_PER_DAY: "4096",
  OPENCLAW_CLOUD_PROVIDER_STANDING_ADVISORY_COOLDOWN_SECONDS: "900",
};

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
}

function providerSuccess({ reason = "Review the current bounded work state." } = {}) {
  const assistantContent = JSON.stringify({
    actionId: "review_current_todo",
    reason,
    confidence: 0.8,
    requiresOperatorReview: true,
  });
  return {
    ok: true,
    response: {
      model: "deepseek-chat",
      assistantContent,
      responseContentHash: hashText(assistantContent),
      usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
    },
  };
}

function createHarness(overrides = {}) {
  const calls = { fetch: [], audit: [], send: [], persist: 0 };
  const state = overrides.state ?? {};
  let currentTime = overrides.currentTime ?? "2026-07-19T00:00:00.000Z";
  const advisory = createStandingProviderAdvisory({
    state,
    systemSenseUrl: "http://127.0.0.1:4106",
    env: { ...BASE_ENV, ...overrides.env },
    now: () => currentTime,
    persistState: () => { calls.persist += 1; },
    fetchJson: overrides.fetchJson ?? (async (url) => {
      calls.fetch.push(url);
      if (url.endsWith("/system/health")) {
        return {
          ok: true,
          system: {
            services: {
              systemSense: { ok: true, status: "healthy", error: "secret-service-error" },
              eventHub: { ok: false, status: "offline", url: "https://not-exported.invalid" },
              systemHeal: { ok: true, status: "healthy", credential: "secret-value" },
            },
            alerts: [{ message: "journal text must not leave" }],
          },
        };
      }
      return {
        ok: true,
        units: [
          {
            unit: "openclaw-system-sense.service",
            systemdObserved: true,
            loadState: "loaded",
            activeState: "active",
            subState: "running",
            fragmentPath: "/etc/systemd/system/private.service",
          },
        ],
      };
    }),
    publishAuditEvent: overrides.publishAuditEvent ?? (async (name, payload) => {
      calls.audit.push({ name, payload });
      return { ok: true };
    }),
    sendProviderRequest: overrides.sendProviderRequest ?? (async (input) => {
      calls.send.push(input);
      return providerSuccess(overrides.providerSuccess);
    }),
  });
  return {
    advisory,
    state,
    calls,
    setTime(value) { currentTime = value; },
  };
}

test("standing advisory remains local when disabled", async () => {
  const { advisory, calls } = createHarness({
    env: { OPENCLAW_CLOUD_PROVIDER_STANDING_ADVISORY_ENABLED: "0" },
  });

  const result = await advisory.invoke();

  assert.equal(result.status, "local_fallback");
  assert.equal(result.fallback.reason, "standing_advisory_disabled");
  assert.equal(result.governance.networkEgress, false);
  assert.equal(calls.fetch.length, 0);
  assert.equal(calls.audit.length, 0);
  assert.equal(calls.send.length, 0);
});

test("standing advisory sends only fixed bounded context and returns a transient recommendation", async () => {
  const { advisory, state, calls } = createHarness({
    providerSuccess: { reason: "transient-recommendation-reason" },
  });

  const result = await advisory.invoke();

  assert.equal(result.status, "recommendation_returned");
  assert.equal(result.recommendation.reason, "transient-recommendation-reason");
  assert.equal(result.recommendation.executesAutomatically, false);
  assert.equal(result.governance.createsTask, false);
  assert.equal(result.governance.createsApproval, false);
  assert.equal(result.governance.mutatesHost, false);
  assert.equal(calls.audit.length, 1);
  assert.equal(calls.send.length, 1);
  const outbound = JSON.stringify(calls.send[0].providerRequest);
  for (const forbidden of [
    "secret-service-error",
    "https://not-exported.invalid",
    "secret-value",
    "journal text must not leave",
    "/etc/systemd/system/private.service",
  ]) {
    assert.equal(outbound.includes(forbidden), false);
  }
  assert.equal(state.callsUsed, 1);
  assert.equal(state.tokensUsed, 1024);
  assert.equal(state.lastActionId, "review_current_todo");
  assert.equal(JSON.stringify(state).includes("transient-recommendation-reason"), false);
  assert.equal(JSON.stringify(state).includes("assistantContent"), false);
});

test("standing advisory enforces cooldown and daily call budget", async () => {
  const harness = createHarness({
    env: {
      OPENCLAW_CLOUD_PROVIDER_STANDING_ADVISORY_MAX_CALLS_PER_DAY: "1",
      OPENCLAW_CLOUD_PROVIDER_STANDING_ADVISORY_COOLDOWN_SECONDS: "30",
    },
  });

  await harness.advisory.invoke();
  const cooldown = await harness.advisory.invoke();
  harness.setTime("2026-07-19T00:01:00.000Z");
  const exhausted = await harness.advisory.invoke();

  assert.equal(cooldown.fallback.reason, "standing_advisory_cooldown");
  assert.equal(exhausted.fallback.reason, "standing_advisory_call_budget_exhausted");
  assert.equal(harness.calls.send.length, 1);
});

test("standing advisory enforces conservative daily token budget", async () => {
  const { advisory, calls } = createHarness({
    state: { day: "2026-07-19", tokensUsed: 1024, callsUsed: 1 },
    env: { OPENCLAW_CLOUD_PROVIDER_STANDING_ADVISORY_MAX_TOKENS_PER_DAY: "1024" },
  });

  const result = await advisory.invoke();

  assert.equal(result.fallback.reason, "standing_advisory_token_budget_exhausted");
  assert.equal(calls.fetch.length, 0);
  assert.equal(calls.send.length, 0);
});

test("standing advisory rolls daily budgets without restoring unknown state fields", async () => {
  const { advisory, state } = createHarness({
    state: {
      day: "2026-07-18",
      callsUsed: 3,
      tokensUsed: 4096,
      prompt: "must-be-removed",
      reason: "must-be-removed",
    },
  });

  const result = await advisory.invoke();

  assert.equal(result.status, "recommendation_returned");
  assert.equal(state.day, "2026-07-19");
  assert.equal(state.callsUsed, 1);
  assert.equal(state.tokensUsed, 1024);
  assert.equal("prompt" in state, false);
  assert.equal("reason" in state, false);
});

test("standing advisory sanitizes state loaded after owner construction", () => {
  const { advisory, state, calls } = createHarness();
  Object.assign(state, {
    day: "2026-07-19",
    callsUsed: 2,
    tokensUsed: 2048,
    prompt: "late-loaded-prompt",
    recommendationReason: "late-loaded-reason",
  });

  const restored = advisory.restoreState();

  assert.equal(restored.ok, true);
  assert.equal(restored.callsUsed, 2);
  assert.equal(restored.tokensUsed, 2048);
  assert.equal("prompt" in state, false);
  assert.equal("recommendationReason" in state, false);
  assert.ok(calls.persist >= 1);
});

test("standing advisory rejects concurrent calls with a local fallback", async () => {
  let releaseFetch;
  const firstFetch = new Promise((resolve) => { releaseFetch = resolve; });
  let fetchCount = 0;
  const harness = createHarness({
    fetchJson: async (url) => {
      fetchCount += 1;
      if (fetchCount === 1) await firstFetch;
      return url.endsWith("/system/health") ? { ok: true, system: { services: {} } } : { ok: true, units: [] };
    },
  });

  const first = harness.advisory.invoke();
  await Promise.resolve();
  const second = await harness.advisory.invoke();
  releaseFetch();
  await first;

  assert.equal(second.fallback.reason, "standing_advisory_in_flight");
  assert.equal(harness.calls.send.length, 1);
});

test("standing advisory fails closed before egress when required audit fails", async () => {
  const { advisory, state, calls } = createHarness({
    publishAuditEvent: async () => { throw new Error("event hub unavailable"); },
  });

  const result = await advisory.invoke();

  assert.equal(result.fallback.reason, "standing_advisory_audit_unavailable");
  assert.equal(calls.send.length, 0);
  assert.equal(state.callsUsed, 0);
  assert.equal(state.tokensUsed, 0);
});

test("standing advisory keeps provider failures local after charging the attempted call", async () => {
  const { advisory, state, calls } = createHarness({
    sendProviderRequest: async (input) => {
      calls.send.push(input);
      return { ok: false, reason: "provider_request_failed", errorMessage: "raw secret failure" };
    },
  });

  const result = await advisory.invoke();

  assert.equal(result.fallback.reason, "standing_advisory_provider_failed");
  assert.equal(state.callsUsed, 1);
  assert.equal(state.tokensUsed, 1024);
  assert.equal(JSON.stringify(state).includes("raw secret failure"), false);
});

test("standing advisory converts unexpected sender exceptions into a local fallback", async () => {
  const { advisory, state } = createHarness({
    sendProviderRequest: async () => { throw new Error("sender internals must remain private"); },
  });

  const result = await advisory.invoke();

  assert.equal(result.fallback.reason, "standing_advisory_provider_failed");
  assert.equal(state.lastResult, "provider_call_failed");
  assert.equal(JSON.stringify(state).includes("sender internals"), false);
});

test("standing advisory rejects malformed provider recommendations without persisting content", async () => {
  const assistantContent = "not-json-provider-content";
  const { advisory, state } = createHarness({
    sendProviderRequest: async () => ({
      ok: true,
      response: {
        assistantContent,
        responseContentHash: hashText(assistantContent),
        usage: { total_tokens: 77 },
      },
    }),
  });

  const result = await advisory.invoke();

  assert.equal(result.fallback.reason, "standing_advisory_response_invalid");
  assert.equal(state.lastResult, "response_contract_failed");
  assert.equal(state.lastUsageTokens, 77);
  assert.equal(JSON.stringify(state).includes(assistantContent), false);
});

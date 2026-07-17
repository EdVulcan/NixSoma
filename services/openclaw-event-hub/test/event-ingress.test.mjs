import test from "node:test";
import assert from "node:assert/strict";

import { createEventIngress } from "../src/event-ingress.mjs";

function request(headers = {}) {
  return { headers };
}

test("event ingress ignores caller supplied id, source, and timestamp", () => {
  const ingress = createEventIngress({
    now: () => "2026-07-17T14:00:00.000Z",
    createId: () => "server-event-id",
  });
  const authenticated = ingress.authenticateRequest(request());
  const event = ingress.normaliseEvent({
    id: "forged-id",
    source: "forged-source",
    timestamp: "2000-01-01T00:00:00.000Z",
    type: "test.event",
    payload: { bounded: true },
  }, authenticated);

  assert.deepEqual(event, {
    id: "server-event-id",
    type: "test.event",
    source: "event-hub-ingress",
    timestamp: "2026-07-17T14:00:00.000Z",
    payload: { bounded: true },
  });
});

test("configured event ingress requires an internal token and bounded source", () => {
  const ingress = createEventIngress({ token: "internal-token", createId: () => "event-1" });
  assert.throws(
    () => ingress.authenticateRequest(request()),
    (error) => error?.code === "EVENT_INGRESS_AUTH_REQUIRED",
  );
  assert.throws(
    () => ingress.authenticateRequest(request({ authorization: "Bearer wrong", "x-openclaw-event-source": "openclaw-core" })),
    (error) => error?.code === "EVENT_INGRESS_AUTH_REQUIRED",
  );
  const authenticated = ingress.authenticateRequest(request({
    authorization: "Bearer internal-token",
    "x-openclaw-event-source": "openclaw-core",
  }));
  assert.equal(authenticated.source, "openclaw-core");
  assert.equal(ingress.normaliseEvent({ type: "test.event", source: "forged" }, authenticated).source, "openclaw-core");
});

test("per-source event ingress rejects a token assigned to another service", () => {
  const ingress = createEventIngress({
    tokensBySource: {
      "openclaw-core": "core-token",
      "openclaw-screen-act": "screen-act-token",
    },
  });

  assert.throws(
    () => ingress.authenticateRequest(request({
      authorization: "Bearer core-token",
      "x-openclaw-event-source": "openclaw-screen-act",
      "x-openclaw-service-caller": "openclaw-screen-act",
    })),
    (error) => error?.code === "EVENT_INGRESS_AUTH_REQUIRED",
  );

  const authenticated = ingress.authenticateRequest(request({
    authorization: "Bearer screen-act-token",
    "x-openclaw-event-source": "openclaw-screen-act",
    "x-openclaw-service-caller": "openclaw-screen-act",
  }));
  assert.deepEqual(authenticated, {
    ok: true,
    authenticated: true,
    source: "openclaw-screen-act",
    identity: "openclaw-screen-act",
  });
});

test("required event ingress fails closed without a credential map", () => {
  assert.throws(
    () => createEventIngress({ required: true }),
    /requires a service credential map/u,
  );
});

import test from "node:test";
import assert from "node:assert/strict";

import { createBrowserRuntimeAuthenticator } from "../src/browser-runtime-auth.mjs";

function request(headers = {}) {
  return { headers };
}

test("browser runtime authenticator binds a credential to one caller", () => {
  const authenticator = createBrowserRuntimeAuthenticator({
    tokensByCaller: {
      "openclaw-session-manager": "session-token",
      "openclaw-screen-act": "screen-act-token",
    },
  });

  assert.throws(
    () => authenticator.authenticateRequest(request({
      authorization: "Bearer session-token",
      "x-openclaw-service-caller": "openclaw-screen-act",
    })),
    (error) => error?.code === "BROWSER_RUNTIME_AUTH_REQUIRED",
  );

  assert.deepEqual(authenticator.authenticateRequest(request({
    authorization: "Bearer session-token",
    "x-openclaw-service-caller": "openclaw-session-manager",
  })), {
    ok: true,
    authenticated: true,
    caller: "openclaw-session-manager",
    identity: "openclaw-session-manager",
    mode: "per-caller",
  });
});

test("browser runtime authenticator retains loopback compatibility without credentials", () => {
  const authenticator = createBrowserRuntimeAuthenticator();
  assert.equal(authenticator.authenticateRequest(request()).authenticated, false);
});

test("required browser runtime authenticator fails closed without credentials", () => {
  assert.throws(
    () => createBrowserRuntimeAuthenticator({ required: true }),
    /requires a per-caller credential map/u,
  );
});

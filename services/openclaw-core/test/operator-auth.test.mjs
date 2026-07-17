import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createOperatorAuthenticator } from "../src/operator-auth.mjs";

function request(method = "GET", headers = {}) {
  return { method, headers };
}

test("operator authentication fails closed when no token is configured", () => {
  assert.throws(
    () => createOperatorAuthenticator({ token: null, tokenFilePath: null }),
    /requires OPENCLAW_OPERATOR_TOKEN/u,
  );
});

test("operator authentication accepts bearer credentials and derives the actor", () => {
  const auth = createOperatorAuthenticator({
    token: "operator-secret",
    actor: "edvulcan",
    allowedOrigins: ["http://127.0.0.1:4170"],
  });

  const allowed = auth.authorizeRequest(
    request("POST", {
      authorization: "Bearer operator-secret",
      origin: "http://127.0.0.1:4170",
    }),
    new URL("/operator/step", "http://127.0.0.1:4100"),
  );

  assert.deepEqual(allowed.identity, {
    actor: "edvulcan",
    role: "operator",
    authMethod: "bearer",
  });
  assert.equal(allowed.origin, "http://127.0.0.1:4170");

  const missing = auth.authorizeRequest(
    request("POST"),
    new URL("/operator/step", "http://127.0.0.1:4100"),
  );
  assert.equal(missing.statusCode, 401);
  assert.equal(missing.headers["www-authenticate"], "Bearer");
});

test("operator credential files take precedence over legacy token values", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nixsoma-operator-auth-"));
  const tokenFilePath = path.join(directory, "operator-token");
  fs.writeFileSync(tokenFilePath, "file-secret\n", "utf8");

  try {
    const auth = createOperatorAuthenticator({
      token: "legacy-secret",
      tokenFilePath,
    });
    const fileCredential = auth.authorizeRequest(
      request("POST", { authorization: "Bearer file-secret" }),
      new URL("/operator/step", "http://127.0.0.1:4100"),
    );
    const legacyCredential = auth.authorizeRequest(
      request("POST", { authorization: "Bearer legacy-secret" }),
      new URL("/operator/step", "http://127.0.0.1:4100"),
    );

    assert.equal(fileCredential.ok, true);
    assert.equal(legacyCredential.statusCode, 401);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("operator origin policy rejects untrusted browser origins and keeps health public", () => {
  const auth = createOperatorAuthenticator({
    token: "operator-secret",
    allowedOrigins: ["http://127.0.0.1:4170"],
  });

  const denied = auth.authorizeRequest(
    request("POST", { origin: "http://attacker.invalid", authorization: "Bearer operator-secret" }),
    new URL("/capabilities/invoke", "http://127.0.0.1:4100"),
  );
  assert.equal(denied.statusCode, 403);

  const health = auth.authorizeRequest(
    request("GET", { origin: "http://127.0.0.1:4170" }),
    new URL("/health", "http://127.0.0.1:4100"),
  );
  assert.equal(health.ok, true);
  assert.equal(health.identity, null);
  assert.equal(auth.requestRequiresAuth(request("GET"), new URL("/tasks", "http://127.0.0.1:4100")), true);
  assert.equal(auth.requestRequiresAuth(request("GET"), new URL("/approvals/summary", "http://127.0.0.1:4100")), true);
  assert.equal(auth.requestRequiresAuth(request("GET"), new URL("/capabilities/invocations", "http://127.0.0.1:4100")), true);
  assert.equal(auth.requestRequiresAuth(request("GET"), new URL("/capabilities", "http://127.0.0.1:4100")), false);
  assert.equal(auth.requestRequiresAuth(request("POST"), new URL("/tasks", "http://127.0.0.1:4100")), true);
});

test("operator login issues an expiring HttpOnly session and logout revokes it", () => {
  let currentTime = 1000;
  const auth = createOperatorAuthenticator({
    token: "operator-secret",
    actor: "operator-one",
    allowedOrigins: ["http://127.0.0.1:4170"],
    sessionTtlMs: 5000,
    now: () => currentTime,
    createSessionToken: () => "session-token",
  });

  const login = auth.createSession("operator-secret");
  assert.equal(login.ok, true);
  assert.match(login.setCookie, /HttpOnly/u);
  assert.match(login.setCookie, /SameSite=Strict/u);
  assert.equal(login.identity.authMethod, "session");

  const sessionRequest = request("POST", {
    cookie: `${auth.sessionCookieName}=session-token`,
    origin: "http://127.0.0.1:4170",
  });
  const authenticated = auth.authorizeRequest(
    sessionRequest,
    new URL("/operator/run", "http://127.0.0.1:4100"),
  );
  assert.equal(authenticated.ok, true);
  assert.equal(authenticated.identity.actor, "operator-one");

  currentTime = 7000;
  assert.equal(auth.authorizeRequest(sessionRequest, new URL("/operator/run", "http://127.0.0.1:4100")).statusCode, 401);

  currentTime = 1000;
  const secondLogin = auth.createSession("operator-secret");
  const secondRequest = request("POST", { cookie: `${auth.sessionCookieName}=${secondLogin.sessionToken}` });
  assert.match(auth.clearSession(secondRequest), /Max-Age=0/u);
  assert.equal(auth.authorizeRequest(secondRequest, new URL("/operator/run", "http://127.0.0.1:4100")).statusCode, 401);
});

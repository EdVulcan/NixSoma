import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const serviceDirectory = path.resolve(new URL("..", import.meta.url).pathname);

async function unusedPort() {
  const probe = http.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForHealth(url, child) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`browser runtime exited before health: ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      // The child may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("browser runtime did not become healthy");
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    once(child, "exit"),
    new Promise((resolve) => setTimeout(resolve, 1_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

test("browser runtime protects state and returns the helper lease only to authenticated callers", async (t) => {
  const port = await unusedPort();
  const stateDirectory = mkdtempSync(path.join(tmpdir(), "openclaw-browser-auth-test-"));
  const baseUrl = `http://127.0.0.1:${port}`;
  const token = "browser-runtime-test-token";
  const otherToken = "browser-runtime-other-token";
  const credentialMapPath = path.join(stateDirectory, "browser-runtime-credentials.json");
  writeFileSync(credentialMapPath, JSON.stringify({
    "openclaw-session-manager": token,
    "openclaw-screen-act": otherToken,
  }), "utf8");
  const child = spawn(process.execPath, ["src/server.mjs"], {
    cwd: serviceDirectory,
    env: {
      ...process.env,
      OPENCLAW_BROWSER_RUNTIME_HOST: "127.0.0.1",
      OPENCLAW_BROWSER_RUNTIME_PORT: String(port),
      OPENCLAW_BROWSER_RUNTIME_AUTH_TOKEN: "",
      OPENCLAW_BROWSER_RUNTIME_CREDENTIAL_MAP_FILE: credentialMapPath,
      OPENCLAW_BROWSER_RUNTIME_AUTH_REQUIRED: "1",
      OPENCLAW_BROWSER_ENGINE_MODE: "simulated",
      OPENCLAW_BROWSER_RUNTIME_STATE_FILE: path.join(stateDirectory, "state.json"),
      OPENCLAW_BROWSER_PROFILE_DIR: path.join(stateDirectory, "profile"),
      OPENCLAW_EVENT_HUB_URL: "http://127.0.0.1:1",
      OPENCLAW_SESSION_MANAGER_URL: "http://127.0.0.1:1",
    },
    stdio: "ignore",
  });
  t.after(async () => {
    await stopChild(child);
    rmSync(stateDirectory, { recursive: true, force: true });
  });

  await waitForHealth(baseUrl, child);

  const unauthenticatedState = await fetch(`${baseUrl}/browser/state`);
  assert.equal(unauthenticatedState.status, 401);

  const headers = {
    authorization: `Bearer ${token}`,
    "x-openclaw-service-caller": "openclaw-session-manager",
    "content-type": "application/json",
  };
  const swappedCaller = await fetch(`${baseUrl}/browser/state`, {
    headers: { ...headers, "x-openclaw-service-caller": "openclaw-screen-act" },
  });
  assert.equal(swappedCaller.status, 401);
  const swappedToken = await fetch(`${baseUrl}/browser/state`, {
    headers: { ...headers, authorization: `Bearer ${otherToken}` },
  });
  assert.equal(swappedToken.status, 401);
  const publicState = await fetch(`${baseUrl}/browser/state`, { headers });
  assert.equal(publicState.status, 200);
  assert.equal((await publicState.json()).browser.trustedHelperLease, null);

  const trustedHelperLease = {
    registry: "openclaw-trusted-work-view-helper-lease-v0",
    owner: "openclaw-session-manager",
    mode: "in_process_session_helper",
    scope: "ai_owned_work_view_only",
    leaseId: "lease-browser-auth-test",
    sessionId: "session-browser-auth-test",
    workViewId: "work-view-primary",
    actionAuthority: "active",
  };
  const opened = await fetch(`${baseUrl}/browser/open`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      url: "https://example.com",
      sessionId: trustedHelperLease.sessionId,
      sessionAuthority: "openclaw-session-manager",
      trustedHelperLease,
    }),
  });
  assert.equal(opened.status, 201);
  assert.equal((await opened.json()).browser.trustedHelperLease.leaseId, trustedHelperLease.leaseId);

  const rebound = await fetch(`${baseUrl}/browser/trusted-helper-lease`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sessionId: trustedHelperLease.sessionId,
      trustedHelperLease,
    }),
  });
  const reboundBody = await rebound.json();
  assert.equal(rebound.status, 200);
  assert.equal(reboundBody.browser.trustedHelperLease.leaseId, trustedHelperLease.leaseId);
  assert.equal(reboundBody.trustedHelperLease.leaseId, trustedHelperLease.leaseId);
});

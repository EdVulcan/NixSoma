import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

import {
  EXECUTION_GRANT_HEADER,
  createExecutionGrantSigner,
} from "../../../packages/shared-utils/src/execution-grants.mjs";

const SESSION_ID = "current-tab-close-route-session";
const LEASE_ID = "current-tab-close-route-lease";

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function listen(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server;
}

function serverUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function unusedPort() {
  const server = await listen((_req, res) => res.end());
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

async function waitForHealth(url, child) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`screen-act exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("screen-act did not become healthy");
}

test("current-tab close route binds grant audience, path, body, replay, and current-only payload", async (t) => {
  let browserRequest = null;
  const eventHub = await listen(async (req, res) => {
    await readBody(req);
    json(res, 200, { ok: true });
  });
  const screenSense = await listen(async (req, res) => {
    if (req.method === "POST" && req.url === "/screen/refresh") {
      json(res, 200, { ok: true });
      return;
    }
    if (req.method === "GET" && req.url === "/screen/current") {
      json(res, 200, {
        ok: true,
        screen: {
          readiness: "ready",
          sessionId: SESSION_ID,
          focusedWindow: { title: "AI Browser", pid: 8124 },
          trustedSession: {
            sessionIdentity: {
              authority: "openclaw-session-manager",
              authoritativeSessionId: SESSION_ID,
            },
            helperRuntime: {
              registry: "openclaw-trusted-work-view-helper-runtime-v0",
              owner: "openclaw-session-manager",
              status: "active",
              actionAuthority: "active",
              leaseMatched: true,
              leaseId: LEASE_ID,
              browserLeaseId: LEASE_ID,
              sessionId: SESSION_ID,
              workViewId: "work-view-primary",
              heartbeatAt: new Date().toISOString(),
            },
          },
        },
      });
      return;
    }
    json(res, 404, { ok: false });
  });
  const browserRuntime = await listen(async (req, res) => {
    if (req.method === "POST" && req.url === "/browser/current-tab/close") {
      browserRequest = await readBody(req);
      json(res, 200, {
        ok: true,
        mediation: { accepted: true, leaseMatched: true },
        effect: {
          registry: "openclaw-browser-current-tab-close-v0",
          operation: "browser.current_tab.close",
          status: "closed",
          tabCountBefore: 3,
          tabCountAfter: 2,
          currentTabClosed: true,
          activeTabChanged: true,
          lastTabPreserved: true,
          callerSelectedTab: false,
          automaticCleanup: false,
          browserProcessControlled: false,
          browserWindowControlled: false,
          desktopTakeover: false,
        },
      });
      return;
    }
    json(res, 404, { ok: false });
  });
  t.after(() => Promise.all([eventHub, screenSense, browserRuntime].map(
    (server) => new Promise((resolve) => server.close(resolve)),
  )));

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const tempDirectory = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "screen-act-close-route-"));
  const publicKeyPath = path.join(tempDirectory, "execution-grant-public.pem");
  fs.writeFileSync(publicKeyPath, publicKey.export({ type: "spki", format: "pem" }), { mode: 0o600 });
  t.after(() => fs.rmSync(tempDirectory, { recursive: true, force: true }));

  const port = await unusedPort();
  const serviceDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const child = spawn(process.execPath, ["src/server.mjs"], {
    cwd: serviceDirectory,
    env: {
      ...process.env,
      OPENCLAW_SCREEN_ACT_HOST: "127.0.0.1",
      OPENCLAW_SCREEN_ACT_PORT: String(port),
      OPENCLAW_EVENT_HUB_URL: serverUrl(eventHub),
      OPENCLAW_SCREEN_SENSE_URL: serverUrl(screenSense),
      OPENCLAW_BROWSER_RUNTIME_URL: serverUrl(browserRuntime),
      OPENCLAW_EXECUTION_GRANT_PUBLIC_KEY_FILE: publicKeyPath,
      OPENCLAW_BROWSER_RUNTIME_TOKEN_FILE: "",
      OPENCLAW_BROWSER_RUNTIME_AUTH_TOKEN: "",
      OPENCLAW_EVENT_HUB_TOKEN_FILE: "",
      OPENCLAW_EVENT_HUB_TOKEN: "",
      OPENCLAW_SCREEN_ACT_WAIT_MS: "200",
      OPENCLAW_SCREEN_ACT_POLL_MS: "10",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let childOutput = "";
  child.stdout.on("data", (chunk) => { childOutput += chunk.toString(); });
  child.stderr.on("data", (chunk) => { childOutput += chunk.toString(); });
  t.after(async () => {
    if (child.exitCode === null) child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 1_000)),
    ]);
  });

  const serviceUrl = `http://127.0.0.1:${port}`;
  const route = "/act/browser/current-tab/close";
  await waitForHealth(serviceUrl, child).catch((error) => {
    throw new Error(`${error.message}: ${childOutput}`);
  });
  const signer = createExecutionGrantSigner({
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
  });
  const issue = ({ audience = "openclaw-screen-act", body = {}, path: grantPath = route } = {}) => signer.issue({
    audience,
    path: grantPath,
    body,
  });
  const post = (body, token) => fetch(`${serviceUrl}${route}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { [EXECUTION_GRANT_HEADER]: token } : {}),
    },
    body: JSON.stringify(body),
  });

  assert.equal((await post({}, null)).ok, false);
  assert.equal((await post({}, issue({ audience: "openclaw-session-manager" }))).ok, false);
  assert.equal((await post({}, issue({ path: "/act/browser/new-tab" }))).ok, false);
  assert.equal((await post({ tabId: "caller-tab" }, issue())).ok, false);
  assert.equal((await post({ tabId: "caller-tab" }, issue({ body: { tabId: "caller-tab" } }))).status, 400);

  const token = issue();
  const accepted = await post({}, token);
  const acceptedBody = await accepted.json();
  assert.equal(accepted.status, 200, childOutput);
  assert.equal(acceptedBody.action.result, "executed-browser-runtime");
  assert.equal(acceptedBody.action.mediation.effect.status, "closed");
  assert.deepEqual(Object.keys(browserRequest), ["trustedHelperLease"]);
  assert.equal(browserRequest.trustedHelperLease.leaseId, LEASE_ID);
  assert.equal((await post({}, token)).ok, false);
});

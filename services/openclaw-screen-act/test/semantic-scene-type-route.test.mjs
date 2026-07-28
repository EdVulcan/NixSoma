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
import { buildWriteOnlyInputEvidence } from "../../../packages/shared-utils/src/work-view-input-evidence.mjs";
import { buildWorkViewSemanticScene } from "../../../packages/shared-utils/src/work-view-semantic-scene.mjs";

const PRIVATE_TEXT = "NixSoma";
const SESSION_ID = "screen-act-route-session";
const LEASE_ID = "screen-act-route-lease";
const BROWSER_PID = 8123;

function visualFrame({ sha256 = "a".repeat(64), sequence = 7 } = {}) {
  return {
    registry: "openclaw-browser-visual-frame-v0",
    available: true,
    sourceScope: "ai_owned_active_page_only",
    desktopWideCapture: false,
    persisted: false,
    mediaType: "image/jpeg",
    encoding: "base64_data_url",
    width: 960,
    height: 540,
    byteLength: 120,
    sha256,
    capturedAt: new Date().toISOString(),
    sequence,
  };
}

function capture(frame) {
  return {
    visualFrame: frame,
    semanticTargets: {
      available: true,
      frame,
      items: [{
        role: "textbox",
        name: "Customer name",
        disabled: false,
        bounds: { x: 120, y: 18, width: 180, height: 32 },
      }],
    },
  };
}

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

test("semantic type HTTP route preserves the raw action until the dispatch owner", async (t) => {
  const beforeFrame = visualFrame();
  const afterFrame = visualFrame({ sha256: "b".repeat(64), sequence: 8 });
  const beforeCapture = capture(beforeFrame);
  const browser = { running: true, browserPid: BROWSER_PID };
  const scene = buildWorkViewSemanticScene({ browser, capture: beforeCapture });
  let captureCount = 0;
  let browserInput = null;

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
          focusedWindow: { title: "Form", pid: BROWSER_PID },
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
    if (req.method === "GET" && req.url?.startsWith("/browser/capture?")) {
      captureCount += 1;
      json(res, 200, {
        ok: true,
        running: true,
        browser,
        capture: capture(captureCount === 1 ? beforeFrame : afterFrame),
      });
      return;
    }
    if (req.method === "POST" && req.url === "/browser/input") {
      browserInput = await readBody(req);
      const inputEvidence = buildWriteOnlyInputEvidence(browserInput.text).evidence;
      json(res, 200, {
        ok: true,
        mediation: { accepted: true, leaseMatched: true },
        inputEvidence,
        effect: {
          operation: "type",
          status: "executed",
          targetId: browserInput.semanticTarget.targetId,
          inventorySha256: browserInput.semanticTarget.inventorySha256,
          frame: browserInput.semanticTarget.frame,
          inputEvidence,
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
  const tempDirectory = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "screen-act-route-"));
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
  await waitForHealth(serviceUrl, child).catch((error) => {
    throw new Error(`${error.message}: ${childOutput}`);
  });
  const requestBody = {
    sceneContentSha256: scene.sceneContentSha256,
    itemOrdinal: 1,
    browserPid: BROWSER_PID,
    semanticFrame: { sha256: beforeFrame.sha256, sequence: beforeFrame.sequence },
    text: PRIVATE_TEXT,
  };
  const signer = createExecutionGrantSigner({
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
  });
  const token = signer.issue({
    audience: "openclaw-screen-act",
    path: "/act/keyboard/semantic-type",
    body: requestBody,
  });
  const response = await fetch(`${serviceUrl}/act/keyboard/semantic-type`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [EXECUTION_GRANT_HEADER]: token,
    },
    body: JSON.stringify(requestBody),
  });
  const data = await response.json();

  assert.equal(response.status, 200, childOutput);
  assert.equal(data.ok, true);
  assert.equal(data.action.result, "executed-browser-runtime");
  assert.equal(data.action.mediation.accepted, true);
  assert.equal(data.action.mediation.semanticType.actionExecuted, true);
  assert.equal(data.action.params.inputEvidence.charCount, PRIVATE_TEXT.length);
  assert.equal(browserInput.text, PRIVATE_TEXT);
  assert.equal(JSON.stringify(data).includes(PRIVATE_TEXT), false);
  assert.equal("text" in data.action.params, false);
});

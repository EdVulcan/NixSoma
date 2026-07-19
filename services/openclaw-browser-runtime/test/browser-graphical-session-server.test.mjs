import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import test from "node:test";

const serverPath = fileURLToPath(new URL("../src/server.mjs", import.meta.url));

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve) => server.close(resolve));
  assert.ok(Number.isInteger(port));
  return port;
}

async function waitForJson(url, attempts = 80) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw lastError ?? new Error("browser-runtime did not become ready");
}

test("browser-runtime assembles bounded nested-Wayland binding evidence", async (t) => {
  const runtimeBaseDir = mkdtempSync(path.join(os.tmpdir(), "nixsoma-browser-server-"));
  const runtimeDir = path.join(runtimeBaseDir, "nixsoma-ai-graphical-session");
  mkdirSync(runtimeDir, { mode: 0o700 });
  const waylandServer = net.createServer();
  await new Promise((resolve, reject) => {
    waylandServer.once("error", reject);
    waylandServer.listen(path.join(runtimeDir, "nixsoma-ai-0"), resolve);
  });

  const port = await reservePort();
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      XDG_RUNTIME_DIR: runtimeBaseDir,
      OPENCLAW_BROWSER_RUNTIME_HOST: "127.0.0.1",
      OPENCLAW_BROWSER_RUNTIME_PORT: String(port),
      OPENCLAW_BROWSER_ENGINE_MODE: "simulated",
      OPENCLAW_BROWSER_RUNTIME_STATE_FILE: path.join(runtimeBaseDir, "browser-state.json"),
      OPENCLAW_EVENT_HUB_URL: "http://127.0.0.1:1",
      OPENCLAW_SESSION_MANAGER_URL: "http://127.0.0.1:1",
      OPENCLAW_BROWSER_GRAPHICAL_SESSION_ENABLED: "1",
      OPENCLAW_BROWSER_GRAPHICAL_SESSION_MODE: "nested_headed_wayland",
      OPENCLAW_BROWSER_GRAPHICAL_SESSION_RUNTIME_DIRECTORY: "nixsoma-ai-graphical-session",
      OPENCLAW_BROWSER_GRAPHICAL_SESSION_SOCKET_NAME: "nixsoma-ai-0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(async () => {
    child.kill("SIGTERM");
    if (child.exitCode === null) {
      await new Promise((resolve) => child.once("exit", resolve));
    }
    await new Promise((resolve) => waylandServer.close(resolve));
    rmSync(runtimeBaseDir, { recursive: true, force: true });
  });

  const health = await waitForJson(`http://127.0.0.1:${port}/health`);
  const state = await waitForJson(`http://127.0.0.1:${port}/browser/state`);
  assert.equal(health.graphicalSession.status, "ready");
  assert.equal(health.graphicalSession.attached, false);
  assert.equal(state.browser.engine.graphicalSession.status, "ready");
  assert.equal(state.browser.engine.graphicalSession.headed, true);
  assert.equal(JSON.stringify(state.browser.engine.graphicalSession).includes(runtimeBaseDir), false);
});

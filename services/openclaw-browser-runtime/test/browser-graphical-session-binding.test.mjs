import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createBrowserGraphicalSessionBinding } from "../src/browser-graphical-session-binding.mjs";

function enabledEnv(runtimeBaseDir, overrides = {}) {
  return {
    DISPLAY: ":0",
    DBUS_SESSION_BUS_ADDRESS: "unix:path=/run/user/1000/bus",
    OPENCLAW_TEST_SECRET: "must-not-reach-firefox",
    XDG_RUNTIME_DIR: runtimeBaseDir,
    OPENCLAW_BROWSER_GRAPHICAL_SESSION_ENABLED: "1",
    OPENCLAW_BROWSER_GRAPHICAL_SESSION_MODE: "nested_headed_wayland",
    OPENCLAW_BROWSER_GRAPHICAL_SESSION_RUNTIME_DIRECTORY: "nixsoma-ai-graphical-session",
    OPENCLAW_BROWSER_GRAPHICAL_SESSION_SOCKET_NAME: "nixsoma-ai-0",
    ...overrides,
  };
}

test("browser graphical binding preserves the disabled headless default", () => {
  const binding = createBrowserGraphicalSessionBinding({ env: {} });

  assert.equal(binding.inspect().status, "disabled");
  assert.equal(binding.launchOptions().headless, true);
});

test("browser graphical binding verifies and attaches only to the fixed nested socket", async (t) => {
  const runtimeBaseDir = mkdtempSync(path.join(os.tmpdir(), "nixsoma-browser-graphics-"));
  const runtimeDir = path.join(runtimeBaseDir, "nixsoma-ai-graphical-session");
  mkdirSync(runtimeDir, { mode: 0o700 });
  const socketPath = path.join(runtimeDir, "nixsoma-ai-0");
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve);
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    rmSync(runtimeBaseDir, { recursive: true, force: true });
  });

  const binding = createBrowserGraphicalSessionBinding({ env: enabledEnv(runtimeBaseDir) });
  const launch = binding.launchOptions();
  const attached = binding.inspect({ browserRunning: true });

  assert.equal(launch.headless, false);
  assert.equal(launch.env.XDG_RUNTIME_DIR, runtimeDir);
  assert.equal(launch.env.WAYLAND_DISPLAY, "nixsoma-ai-0");
  assert.equal(launch.env.MOZ_ENABLE_WAYLAND, "1");
  assert.equal(launch.env.GSETTINGS_BACKEND, "memory");
  assert.equal("DISPLAY" in launch.env, false);
  assert.equal("DBUS_SESSION_BUS_ADDRESS" in launch.env, false);
  assert.equal("OPENCLAW_TEST_SECRET" in launch.env, false);
  assert.equal(attached.status, "attached");
  assert.equal(attached.attached, true);
  assert.equal(attached.headed, true);
  assert.equal(attached.socket.ownerMatched, true);
  assert.equal(attached.boundary.networkScope, "existing_browser_runtime");
  assert.equal(attached.boundary.networkAuthorityExpanded, false);
  assert.equal(JSON.stringify(attached).includes(runtimeBaseDir), false);
});

test("browser graphical binding fails closed for changed identity or a missing socket", () => {
  const runtimeBaseDir = mkdtempSync(path.join(os.tmpdir(), "nixsoma-browser-graphics-"));
  const runtimeDir = path.join(runtimeBaseDir, "nixsoma-ai-graphical-session");
  mkdirSync(runtimeDir, { mode: 0o700 });
  try {
    const changed = createBrowserGraphicalSessionBinding({
      env: enabledEnv(runtimeBaseDir, {
        OPENCLAW_BROWSER_GRAPHICAL_SESSION_SOCKET_NAME: "wayland-0",
      }),
    });
    const missing = createBrowserGraphicalSessionBinding({ env: enabledEnv(runtimeBaseDir) });

    assert.equal(changed.inspect().status, "configuration_invalid");
    assert.throws(() => changed.launchOptions(), /configuration_invalid/u);
    assert.equal(missing.inspect().status, "socket_missing");
    assert.throws(() => missing.launchOptions(), /socket_missing/u);
  } finally {
    rmSync(runtimeBaseDir, { recursive: true, force: true });
  }
});

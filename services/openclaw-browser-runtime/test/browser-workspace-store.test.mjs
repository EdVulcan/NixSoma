import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createBrowserWorkspaceStore } from "../src/browser-workspace-store.mjs";

function statePath(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "openclaw-browser-workspace-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return path.join(directory, "workspace.json");
}

test("browser workspace store persists bounded navigation intent without action authority", (t) => {
  const targetPath = statePath(t);
  const store = createBrowserWorkspaceStore({
    stateFilePath: targetPath,
    now: () => "2026-07-10T00:00:00.000Z",
  });
  store.persist({
    running: true,
    browserPid: 12345,
    profile: "ai-browser-profile",
    sessionId: "session-workspace",
    sessionAuthority: "openclaw-session-manager",
    activeTitle: "OpenClaw Docs",
    activeUrl: "https://example.com/docs",
    tabs: [{
      id: "tab-docs",
      title: "OpenClaw Docs",
      url: "https://example.com/docs",
      createdAt: "2026-07-10T00:00:00.000Z",
    }],
    trustedHelperLease: { leaseId: "must-not-persist" },
    lastInput: "must-not-persist",
    lastClick: { x: 1, y: 2 },
    capture: { text: "must-not-persist" },
  });

  const contents = readFileSync(targetPath, "utf8");
  const persisted = JSON.parse(contents);
  const restored = store.restore();
  assert.equal(statSync(targetPath).mode & 0o777, 0o600);
  assert.equal(restored.restored, true);
  assert.equal(restored.status, "restored_requires_explicit_prepare");
  assert.equal(restored.intent.workspace.sessionId, "session-workspace");
  assert.equal(restored.intent.workspace.wasRunning, true);
  assert.deepEqual(restored.intent.workspace.tabs.map((tab) => tab.url), ["https://example.com/docs"]);
  for (const forbidden of ["must-not-persist", "lastInput", "lastClick", "browserPid"]) {
    assert.equal(contents.includes(forbidden), false);
  }
  for (const forbiddenField of ["trustedHelperLease", "lastInput", "lastClick", "browserPid", "capture"]) {
    assert.equal(Object.hasOwn(persisted.workspace, forbiddenField), false);
  }
  assert.equal(persisted.safety.trustedHelperLeasePersisted, false);
  assert.equal(persisted.safety.capturePersisted, false);
  assert.equal(restored.intent.safety.automaticActionReplay, false);
});

test("browser workspace store ignores invalid and oversized state", (t) => {
  const targetPath = statePath(t);
  const store = createBrowserWorkspaceStore({ stateFilePath: targetPath });
  writeFileSync(targetPath, "not-json", "utf8");
  assert.equal(store.restore().status, "invalid_state_ignored");
  writeFileSync(targetPath, "x".repeat(129 * 1024), "utf8");
  assert.equal(store.restore().status, "invalid_state_ignored");
});

test("browser workspace store retains only the newest bounded tab set", (t) => {
  const targetPath = statePath(t);
  const store = createBrowserWorkspaceStore({ stateFilePath: targetPath });
  store.persist({
    running: true,
    tabs: Array.from({ length: 40 }, (_, index) => ({
      id: `tab-${index}`,
      url: `https://example.com/${index}`,
      title: `Tab ${index}`,
    })),
  });
  const tabs = store.restore().intent.workspace.tabs;
  assert.equal(tabs.length, 32);
  assert.equal(tabs[0].id, "tab-8");
  assert.equal(tabs[31].id, "tab-39");
});

test("browser workspace store restores only the exact fixed local fixture", (t) => {
  const targetPath = statePath(t);
  const fixture = "http://127.0.0.1:4103/fixtures/semantic-submit";
  const store = createBrowserWorkspaceStore({
    stateFilePath: targetPath,
    localFixtureUrls: [fixture],
  });
  store.persist({
    running: true,
    activeUrl: fixture,
    tabs: [
      { id: "fixture", url: fixture },
      { id: "other-loopback", url: "http://127.0.0.1:4103/internal" },
    ],
  });
  const restored = store.restore();
  assert.equal(restored.intent.workspace.activeUrl, fixture);
  assert.deepEqual(restored.intent.workspace.tabs.map((tab) => tab.url), [fixture]);
});

import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createBrowserEngineAdapter } from "../src/browser-engine-adapter.mjs";

function createFakePuppeteer(t) {
  const root = mkdtempSync(path.join(tmpdir(), "openclaw-browser-engine-test-"));
  const executablePath = path.join(root, "browser");
  const profileDirectory = path.join(root, "profile");
  writeFileSync(executablePath, "#!/bin/sh\n", "utf8");
  chmodSync(executablePath, 0o700);
  t.after(() => rmSync(root, { recursive: true, force: true }));

  class FakePage {
    constructor(owner) {
      this.owner = owner;
      this.currentUrl = "about:blank";
      this.typed = [];
      this.clicked = [];
      this.keyboard = { type: async (text) => this.typed.push(text) };
      this.mouse = { click: async (x, y) => this.clicked.push({ x, y }) };
    }

    async goto(url) {
      this.currentUrl = url;
    }

    url() {
      return this.currentUrl;
    }

    async title() {
      return new URL(this.currentUrl).pathname.slice(1) || "home";
    }

    async bringToFront() {}

    async close() {
      this.owner.pageList = this.owner.pageList.filter((page) => page !== this);
    }
  }

  class FakeBrowser {
    constructor() {
      this.connected = true;
      this.pageList = [new FakePage(this)];
      this.listeners = new Map();
    }

    async pages() {
      return this.pageList;
    }

    async newPage() {
      const page = new FakePage(this);
      this.pageList.push(page);
      return page;
    }

    process() {
      return { pid: 4242 };
    }

    once(event, listener) {
      this.listeners.set(event, listener);
    }

    async close() {
      this.connected = false;
      this.listeners.get("disconnected")?.();
    }
  }

  const launches = [];
  const browser = new FakeBrowser();
  return {
    browser,
    executablePath,
    launches,
    profileDirectory,
    puppeteerApi: {
      async launch(options) {
        launches.push(options);
        return browser;
      },
    },
  };
}

test("browser engine adapter launches a bounded profile and delegates real page operations", async (t) => {
  const fake = createFakePuppeteer(t);
  let disconnected = 0;
  const adapter = createBrowserEngineAdapter({
    executablePath: fake.executablePath,
    profileDirectory: fake.profileDirectory,
    puppeteerApi: fake.puppeteerApi,
    onDisconnected: () => { disconnected += 1; },
  });

  const opened = await adapter.open({
    url: "http://127.0.0.1/current",
    restoreUrls: ["http://127.0.0.1/first", "http://127.0.0.1/second"],
  });
  assert.equal(opened.realEngine, true);
  assert.equal(opened.browserPid, 4242);
  assert.equal(opened.activeUrl, "http://127.0.0.1/current");
  assert.equal(opened.activeTitle, "current");
  assert.equal(opened.tabCount, 3);
  assert.equal(fake.launches.length, 1);
  assert.equal(fake.launches[0].executablePath, fake.executablePath);
  assert.equal(fake.launches[0].browser, "firefox");
  assert.equal(fake.launches[0].userDataDir, fake.profileDirectory);
  assert.equal(fake.launches[0].headless, true);
  assert.equal(existsSync(fake.profileDirectory), true);

  await adapter.type("bounded input");
  await adapter.click({ x: 10, y: 20 });
  const updated = await adapter.newTab("http://127.0.0.1/new-tab");
  const previousActivePage = fake.browser.pageList.find((page) => page.url() === "http://127.0.0.1/current");
  assert.equal(updated.activeUrl, "http://127.0.0.1/new-tab");
  assert.equal(updated.tabCount, 4);
  assert.deepEqual(previousActivePage.typed, ["bounded input"]);
  assert.deepEqual(previousActivePage.clicked, [{ x: 10, y: 20 }]);

  await adapter.close();
  assert.equal(disconnected, 1);
  assert.equal(existsSync(fake.profileDirectory), false);
});

test("browser engine adapter rejects unsupported families and unbounded paths", () => {
  assert.throws(
    () => createBrowserEngineAdapter({ browserFamily: "custom", executablePath: "/tmp/browser", profileDirectory: "/tmp/profile" }),
    /Unsupported real browser family/u,
  );
  assert.throws(
    () => createBrowserEngineAdapter({ executablePath: "/", profileDirectory: "/tmp/profile" }),
    /bounded executable path/u,
  );
  assert.throws(
    () => createBrowserEngineAdapter({ executablePath: "/tmp/browser", profileDirectory: "/" }),
    /bounded profile directory/u,
  );
});

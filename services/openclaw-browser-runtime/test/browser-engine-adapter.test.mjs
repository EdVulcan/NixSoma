import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createBrowserEngineAdapter } from "../src/browser-engine-adapter.mjs";
import { WORK_VIEW_VISUAL_FRAME_MAX_BYTES } from "../../../packages/shared-utils/src/work-view-visual-frame.mjs";

function createFakePuppeteer(t, {
  screenshotBytes = Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
  screenshotImpl = null,
  semanticItems = [{
    role: "textbox",
    tag: "input",
    name: "work-input",
    inputType: "text",
    disabled: false,
    bounds: { x: 20, y: 30, width: 180, height: 32 },
  }],
} = {}) {
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
      this.viewport = null;
      this.screenshotCalls = 0;
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

    async setViewport(viewport) {
      this.viewport = viewport;
    }

    async screenshot() {
      this.screenshotCalls += 1;
      return screenshotImpl ? screenshotImpl() : screenshotBytes;
    }

    async evaluate() {
      return { items: semanticItems, truncated: semanticItems.length > 64 };
    }

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
  assert.deepEqual(fake.browser.pageList.map((page) => page.viewport), [
    { width: 960, height: 540, deviceScaleFactor: 1 },
    { width: 960, height: 540, deviceScaleFactor: 1 },
    { width: 960, height: 540, deviceScaleFactor: 1 },
  ]);

  await adapter.type("bounded input");
  await adapter.click({ x: 10, y: 20 });
  const updated = await adapter.newTab("http://127.0.0.1/new-tab");
  const previousActivePage = fake.browser.pageList.find((page) => page.url() === "http://127.0.0.1/current");
  assert.equal(updated.activeUrl, "http://127.0.0.1/new-tab");
  assert.equal(updated.tabCount, 4);
  assert.deepEqual(previousActivePage.typed, ["bounded input"]);
  assert.deepEqual(previousActivePage.clicked, [{ x: 10, y: 20 }]);

  const frame = await adapter.captureVisualFrame();
  assert.equal(frame.available, true);
  assert.equal(frame.sourceScope, "ai_owned_active_page_only");
  assert.equal(frame.width, 960);
  assert.equal(frame.height, 540);
  assert.equal(frame.dataExposed, true);
  assert.match(frame.dataUrl, /^data:image\/jpeg;base64,/u);
  const targets = adapter.semanticTargetInventory();
  assert.equal(targets.available, true);
  assert.equal(targets.frame.sha256, frame.sha256);
  assert.equal(targets.frame.sequence, frame.sequence);
  assert.equal(targets.itemCount, 1);
  assert.equal(targets.items[0].name, "work-input");
  assert.equal(targets.inputValuesExposed, false);
  assert.equal(targets.selectorsExposed, false);
  const cached = await adapter.captureVisualFrame();
  assert.equal(cached.sequence, frame.sequence);
  assert.equal(fake.browser.pageList.at(-1).screenshotCalls, 1);
  const metadata = await adapter.captureVisualFrame({ includeData: false });
  assert.equal(metadata.dataExposed, false);
  assert.equal("dataUrl" in metadata, false);

  await adapter.type("invalidate visual frame");
  assert.equal(adapter.semanticTargetInventory().available, false);
  const refreshed = await adapter.captureVisualFrame();
  assert.equal(refreshed.sequence, frame.sequence + 1);
  assert.equal(fake.browser.pageList.at(-1).screenshotCalls, 2);

  await adapter.close();
  assert.equal(disconnected, 1);
  assert.equal(existsSync(fake.profileDirectory), false);
});

test("browser engine adapter fails closed when an AI-owned frame exceeds the byte limit", async (t) => {
  const fake = createFakePuppeteer(t, {
    screenshotBytes: Buffer.alloc(WORK_VIEW_VISUAL_FRAME_MAX_BYTES + 1),
  });
  const adapter = createBrowserEngineAdapter({
    executablePath: fake.executablePath,
    profileDirectory: fake.profileDirectory,
    puppeteerApi: fake.puppeteerApi,
  });

  await adapter.open({ url: "http://127.0.0.1/oversized" });
  const frame = await adapter.captureVisualFrame();
  assert.equal(frame.available, false);
  assert.equal(frame.reason, "frame_exceeds_byte_limit");
  assert.equal(frame.dataExposed, false);
  assert.equal("dataUrl" in frame, false);
  assert.equal(adapter.semanticTargetInventory().available, false);
  await adapter.close();
});

test("browser engine adapter does not publish a frame captured across a page mutation", async (t) => {
  let releaseScreenshot;
  let screenshotStarted;
  const started = new Promise((resolve) => { screenshotStarted = resolve; });
  const screenshot = new Promise((resolve) => { releaseScreenshot = resolve; });
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
  const fake = createFakePuppeteer(t, {
    screenshotImpl: async () => {
      screenshotStarted();
      return screenshot;
    },
  });
  const adapter = createBrowserEngineAdapter({
    executablePath: fake.executablePath,
    profileDirectory: fake.profileDirectory,
    puppeteerApi: fake.puppeteerApi,
  });

  await adapter.open({ url: "http://127.0.0.1/mutable" });
  const pendingFrame = adapter.captureVisualFrame();
  await started;
  await adapter.type("mutation during capture");
  releaseScreenshot(bytes);
  const invalidated = await pendingFrame;
  assert.equal(invalidated.available, false);
  assert.equal(invalidated.reason, "frame_invalidated_during_capture");

  const refreshed = await adapter.captureVisualFrame();
  assert.equal(refreshed.available, true);
  assert.equal(refreshed.sequence, 1);
  await adapter.close();
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

import { randomUUID } from "node:crypto";
import { accessSync, constants, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import puppeteer from "puppeteer-core";

const ENGINE_REGISTRY = "openclaw-browser-engine-adapter-v0";
const MAX_RESTORED_TABS = 32;

function requiredAbsolutePath(value, label) {
  const resolved = typeof value === "string" && value.trim() ? path.resolve(value) : null;
  if (!resolved || resolved === path.parse(resolved).root) {
    throw new Error(`Real browser engine requires a bounded ${label}.`);
  }
  return resolved;
}

function uniqueUrls(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))]
    .slice(-MAX_RESTORED_TABS);
}

export function createBrowserEngineAdapter({
  executablePath,
  profileDirectory,
  browserFamily = "firefox",
  puppeteerApi = puppeteer,
  navigationTimeoutMs = 10_000,
  onDisconnected = () => {},
} = {}) {
  if (!["chrome", "firefox"].includes(browserFamily)) {
    throw new Error(`Unsupported real browser family: ${browserFamily}.`);
  }
  const browserExecutable = requiredAbsolutePath(executablePath, "executable path");
  const boundedProfileDirectory = requiredAbsolutePath(profileDirectory, "profile directory");
  let browser = null;
  let activePage = null;
  const pageIds = new WeakMap();

  function pageId(page) {
    if (!pageIds.has(page)) pageIds.set(page, `engine-tab-${randomUUID()}`);
    return pageIds.get(page);
  }

  async function pageSummary(page) {
    return {
      id: pageId(page),
      url: page.url(),
      title: (await page.title()).slice(0, 200),
      createdAt: null,
    };
  }

  async function snapshot() {
    const pages = browser ? await browser.pages() : [];
    const tabs = await Promise.all(pages
      .filter((page) => page.url() !== "about:blank" || page === activePage)
      .map(pageSummary));
    const active = activePage && pages.includes(activePage)
      ? await pageSummary(activePage)
      : tabs.at(-1) ?? null;
    return {
      registry: ENGINE_REGISTRY,
      mode: browserFamily,
      realEngine: Boolean(browser?.connected),
      browserPid: browser?.process()?.pid ?? null,
      activeTitle: active?.title ?? null,
      activeUrl: active?.url ?? null,
      tabs,
      tabCount: tabs.length,
      profileEphemeral: true,
      desktopWideCapture: false,
      rootRequired: false,
    };
  }

  async function ensureBrowser() {
    if (browser?.connected) return false;
    accessSync(browserExecutable, constants.X_OK);
    rmSync(boundedProfileDirectory, { recursive: true, force: true });
    mkdirSync(boundedProfileDirectory, { recursive: true, mode: 0o700 });
    browser = await puppeteerApi.launch({
      browser: browserFamily,
      executablePath: browserExecutable,
      headless: true,
      userDataDir: boundedProfileDirectory,
      args: browserFamily === "chrome" ? [
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-sync",
        "--metrics-recording-only",
        "--no-first-run",
        "--safebrowsing-disable-auto-update",
      ] : [],
    });
    browser.once("disconnected", () => {
      browser = null;
      activePage = null;
      rmSync(boundedProfileDirectory, { recursive: true, force: true });
      onDisconnected();
    });
    return true;
  }

  async function navigatePage(page, url) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: navigationTimeoutMs });
    return page;
  }

  async function open({ url, restoreUrls = [] } = {}) {
    const started = await ensureBrowser();
    const existingPages = await browser.pages();
    if (started) {
      const initialPage = existingPages[0] ?? await browser.newPage();
      const restored = uniqueUrls(restoreUrls).filter((candidate) => candidate !== url);
      for (const restoredUrl of restored) {
        const page = await browser.newPage();
        try {
          await navigatePage(page, restoredUrl);
        } catch {
          await page.close().catch(() => {});
        }
      }
      activePage = await navigatePage(initialPage, url);
    } else {
      activePage = await navigatePage(await browser.newPage(), url);
    }
    await activePage.bringToFront();
    return snapshot();
  }

  async function newTab(url) {
    await ensureBrowser();
    activePage = await navigatePage(await browser.newPage(), url);
    await activePage.bringToFront();
    return snapshot();
  }

  async function type(text) {
    if (!activePage) throw new Error("Real browser engine has no active page.");
    await activePage.keyboard.type(String(text).slice(0, 2_000));
    return snapshot();
  }

  async function click({ x, y }) {
    if (!activePage) throw new Error("Real browser engine has no active page.");
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("Real browser click requires finite coordinates.");
    }
    await activePage.mouse.click(x, y);
    return snapshot();
  }

  async function close() {
    const current = browser;
    browser = null;
    activePage = null;
    await current?.close().catch(() => {});
    rmSync(boundedProfileDirectory, { recursive: true, force: true });
  }

  return { click, close, newTab, open, snapshot, type };
}
